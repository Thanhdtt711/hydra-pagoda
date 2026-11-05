import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WindSystem } from './WindSystem'
import { MapLayout } from '../world/MapLayout'
import {
  type TreeSpeciesType,
  type TreeSpawnData,
  TREE_SPECIES_PROFILES
} from './TreeSpecies'
import { CylinderCollider } from '../collision/Collider'
import { CollisionWorld } from '../collision/CollisionWorld'
import { TerrainSystem } from '../world/TerrainSystem'

/**
 * TreeSystem (Hệ Thống Cây Cối & Môi Trường Đa Loài Tối Ưu):
 * - Implements 6 distinct Asian sacred temple tree species:
 *   1. Bodhi (Bồ Đề Bát Nhã) - Sacred ancient tree with buttress roots & umbrella canopy
 *   2. Banyan (Đa Cổ Thụ) - Massive trunk with hanging aerial roots (rễ phụ)
 *   3. Bamboo (Trúc Thiền Tông) - Slender segmented culms with delicate leaf sprays
 *   4. Pine (Thông Cổ Tự) - Sinuous bonsai trunk with tiered horizontal needle cloud boughs
 *   5. Cherry / Maple (Phong Đỏ / Anh Đào) - Graceful branching with country-adaptive foliage
 *   6. Palm (Cau Cảnh Nam Á) - Tall ringed trunk with fountain frond starburst
 * - Renders entire island (>70 trees) in exactly 12 GPU draw calls via InstancedMesh.
 * - Foliage & trunk sway synchronized globally with WindSystem via onBeforeCompile vertex shader.
 * - Automatically registers CylinderColliders into CollisionWorld directly from MapLayout.getTreeSpawns().
 */
export class TreeSystem {
  public root: THREE.Group
  private windSystem: WindSystem
  private trunkMeshes: Map<TreeSpeciesType, THREE.InstancedMesh> = new Map()
  private foliageMeshes: Map<TreeSpeciesType, THREE.InstancedMesh> = new Map()
  private geometries: THREE.BufferGeometry[] = []
  private materials: THREE.Material[] = []
  private mapleMaterial: THREE.MeshStandardMaterial | null = null

  constructor(scene?: THREE.Scene, windSystem?: WindSystem) {
    this.root = new THREE.Group()
    this.root.name = 'TreeSystem'
    this.windSystem = windSystem || WindSystem.getInstance()

    // Khởi tạo các loài cây và gộp nhóm instanced
    this.buildAllSpecies()

    if (scene) {
      scene.add(this.root)
    }
  }

  /**
   * Tự động đăng ký CylinderCollider cho toàn bộ thân cây từ MapLayout.getTreeSpawns()
   * Đảm bảo hình ảnh và vùng va chạm 100% đồng bộ, không bao giờ lệch vị trí.
   */
  public registerColliders(collisionWorld: CollisionWorld): number {
    const spawns = MapLayout.getTreeSpawns()
    let registeredCount = 0

    for (const spawn of spawns) {
      const profile = TREE_SPECIES_PROFILES[spawn.species]
      const scale = spawn.scale || 1.0
      const radius = profile.colliderRadius * scale
      const height = profile.trunkHeight * scale
      const elev = TerrainSystem.computeElevation(spawn.x, spawn.z)
      const centerY = elev + height * 0.5

      collisionWorld.add(
        new CylinderCollider(
          `tree_trunk_${spawn.id}`,
          new THREE.Vector3(spawn.x, centerY, spawn.z),
          radius,
          height,
          false
        )
      )
      registeredCount++
    }

    return registeredCount
  }

  /**
   * Khởi tạo hình học và InstancedMesh cho toàn bộ 6 loài cây
   */
  private buildAllSpecies() {
    const spawns = MapLayout.getTreeSpawns()

    // Phân nhóm danh sách spawn theo từng loài cây
    const speciesMap = new Map<TreeSpeciesType, TreeSpawnData[]>()
    const speciesList: TreeSpeciesType[] = ['bodhi', 'banyan', 'bamboo', 'pine', 'cherry_maple', 'palm']
    for (const sp of speciesList) {
      speciesMap.set(sp, [])
    }
    for (const s of spawns) {
      const list = speciesMap.get(s.species)
      if (list) list.push(s)
    }

    // Xây dựng từng loài
    for (const sp of speciesList) {
      const spawnList = speciesMap.get(sp) || []
      if (spawnList.length === 0) continue

      const { trunkGeo, foliageGeo } = this.createSpeciesGeometries(sp)
      this.geometries.push(trunkGeo, foliageGeo)

      const profile = TREE_SPECIES_PROFILES[sp]

      // 1. Vật liệu thân cây PBR có nhún gió ngọn
      const trunkMat = new THREE.MeshStandardMaterial({
        color: profile.barkColor,
        roughness: 0.92,
        metalness: 0.05
      })
      this.attachWindSway(trunkMat, 0.45, false)
      this.materials.push(trunkMat)

      // 2. Vật liệu tán lá PBR có lay động cành & rung rinh phiến lá
      const foliageMat = new THREE.MeshStandardMaterial({
        color: profile.leafColor,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
      if (sp === 'cherry_maple') {
        this.mapleMaterial = foliageMat
      }
      this.attachWindSway(foliageMat, 1.0, true)
      this.materials.push(foliageMat)

      // 3. Tạo InstancedMesh cho thân và tán lá (mỗi loài = 2 draw calls)
      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spawnList.length)
      const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, spawnList.length)

      trunkMesh.castShadow = true
      trunkMesh.receiveShadow = true
      foliageMesh.castShadow = true
      foliageMesh.receiveShadow = true

      const dummy = new THREE.Object3D()
      for (let i = 0; i < spawnList.length; i++) {
        const item = spawnList[i]
        const s = item.scale || 1.0
        const elev = TerrainSystem.computeElevation(item.x, item.z)
        dummy.position.set(item.x, elev, item.z)
        dummy.rotation.set(0, item.rotY || 0, 0)
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()

        trunkMesh.setMatrixAt(i, dummy.matrix)
        foliageMesh.setMatrixAt(i, dummy.matrix)
      }

      trunkMesh.instanceMatrix.needsUpdate = true
      foliageMesh.instanceMatrix.needsUpdate = true

      this.trunkMeshes.set(sp, trunkMesh)
      this.foliageMeshes.set(sp, foliageMesh)

      this.root.add(trunkMesh)
      this.root.add(foliageMesh)
    }
  }

  /**
   * Tạo hình học chi tiết đặc trưng cho từng loài
   */
  private createSpeciesGeometries(species: TreeSpeciesType): {
    trunkGeo: THREE.BufferGeometry
    foliageGeo: THREE.BufferGeometry
  } {
    switch (species) {
      case 'bodhi':
        return this.generateBodhiGeometries()
      case 'banyan':
        return this.generateBanyanGeometries()
      case 'bamboo':
        return this.generateBambooGeometries()
      case 'pine':
        return this.generatePineGeometries()
      case 'cherry_maple':
        return this.generateCherryMapleGeometries()
      case 'palm':
        return this.generatePalmGeometries()
    }
  }

  // ==========================================
  // 1. CÂY BỒ ĐỀ BÁT NHÃ (BODHI TREE)
  // Gốc xòe rễ bạnh vững chãi, 3 cành chính vươn ngang, tán vòm xòe rộng che chở
  // ==========================================
  private generateBodhiGeometries() {
    const trunkParts: THREE.BufferGeometry[] = []

    // Thân chính hình côn thon dần
    const mainTrunk = new THREE.CylinderGeometry(0.68, 1.15, 7.8, 14)
    mainTrunk.translate(0, 3.9, 0)
    trunkParts.push(mainTrunk)

    // 4 rễ bạnh (buttress roots) tỏa ra 4 hướng cắm sâu xuống đất
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + 0.3
      const root = new THREE.CylinderGeometry(0.18, 0.42, 2.4, 8)
      root.rotateZ(0.42)
      root.rotateY(angle)
      root.translate(Math.cos(angle) * 0.95, 0.9, Math.sin(angle) * 0.95)
      trunkParts.push(root)
    }

    // 3 cành lớn phân nhánh ở độ cao 5.0 - 6.5m
    const branchAngles = [0.4, 2.5, 4.6]
    for (const ba of branchAngles) {
      const b = new THREE.CylinderGeometry(0.22, 0.44, 3.2, 8)
      b.rotateZ(0.55)
      b.rotateY(ba)
      b.translate(Math.cos(ba) * 1.35, 5.8, Math.sin(ba) * 1.35)
      trunkParts.push(b)
    }

    // Tán lá: 5 khối vòm phẳng hữu cơ xếp tầng đan xen che bóng
    const foliageParts: THREE.BufferGeometry[] = []
    const folClusters = [
      { x: 0.0, y: 7.8, z: 0.0, rx: 3.6, ry: 1.6, rz: 3.6 },
      { x: 1.8, y: 6.8, z: 1.2, rx: 2.6, ry: 1.3, rz: 2.6 },
      { x: -1.9, y: 6.6, z: 1.4, rx: 2.5, ry: 1.2, rz: 2.5 },
      { x: 0.2, y: 6.4, z: -2.2, rx: 2.8, ry: 1.3, rz: 2.8 },
      { x: 0.0, y: 9.0, z: 0.0, rx: 2.0, ry: 1.1, rz: 2.0 }
    ]

    for (const c of folClusters) {
      const fol = new THREE.SphereGeometry(1.0, 14, 10)
      fol.scale(c.rx, c.ry, c.rz)
      fol.translate(c.x, c.y, c.z)
      foliageParts.push(fol)
    }

    return {
      trunkGeo: mergeGeometries(trunkParts),
      foliageGeo: mergeGeometries(foliageParts)
    }
  }

  // ==========================================
  // 2. CÂY ĐA CỔ THỤ RỄ PHỤ (BANYAN TREE)
  // Thân đại thụ cuồn cuộn, 6 rễ phụ rủ thẳng từ cành xuống mặt đất
  // ==========================================
  private generateBanyanGeometries() {
    const trunkParts: THREE.BufferGeometry[] = []

    // Thân đại thụ đồ sộ
    const mainTrunk = new THREE.CylinderGeometry(0.95, 1.45, 8.2, 16)
    mainTrunk.translate(0, 4.1, 0)
    trunkParts.push(mainTrunk)

    // 4 cành bàng bè ngang dài vươn xa
    const bAngles = [0.2, 1.7, 3.3, 4.9]
    for (const a of bAngles) {
      const b = new THREE.CylinderGeometry(0.28, 0.58, 4.2, 8)
      b.rotateZ(0.75)
      b.rotateY(a)
      b.translate(Math.cos(a) * 1.8, 6.2, Math.sin(a) * 1.8)
      trunkParts.push(b)
    }

    // 6 rễ phụ rủ từ cành xuống đất (đặc trưng không thể nhầm lẫn của cây Đa)
    const aerialRootCoords = [
      { x: 2.6, z: 1.2, h: 5.8 },
      { x: -2.4, z: 1.4, h: 5.6 },
      { x: 0.8, z: -2.7, h: 5.7 },
      { x: -1.2, z: -2.5, h: 5.5 },
      { x: 3.1, z: -1.1, h: 5.9 },
      { x: -2.9, z: -0.8, h: 5.8 }
    ]
    for (const ar of aerialRootCoords) {
      const root = new THREE.CylinderGeometry(0.12, 0.16, ar.h, 6)
      root.translate(ar.x, ar.h * 0.5, ar.z)
      trunkParts.push(root)
    }

    // Tán lá đại thụ xòe rộng ngang che mát một vùng lớn
    const foliageParts: THREE.BufferGeometry[] = []
    const folClusters = [
      { x: 0.0, y: 8.2, z: 0.0, rx: 4.8, ry: 1.7, rz: 4.8 },
      { x: 2.8, y: 7.2, z: 1.5, rx: 3.2, ry: 1.4, rz: 3.2 },
      { x: -2.9, y: 7.0, z: 1.6, rx: 3.0, ry: 1.3, rz: 3.0 },
      { x: 1.0, y: 6.9, z: -3.0, rx: 3.4, ry: 1.4, rz: 3.4 },
      { x: -1.5, y: 6.8, z: -2.8, rx: 3.1, ry: 1.3, rz: 3.1 },
      { x: 0.0, y: 9.6, z: 0.0, rx: 2.5, ry: 1.2, rz: 2.5 }
    ]
    for (const c of folClusters) {
      const fol = new THREE.SphereGeometry(1.0, 14, 10)
      fol.scale(c.rx, c.ry, c.rz)
      fol.translate(c.x, c.y, c.z)
      foliageParts.push(fol)
    }

    return {
      trunkGeo: mergeGeometries(trunkParts),
      foliageGeo: mergeGeometries(foliageParts)
    }
  }

  // ==========================================
  // 3. CỤM TRÚC THIỀN TÔNG (BAMBOO GROVE)
  // Cụm 7 thân trúc xanh ngọc thanh mảnh có mắt trúc, lá trúc mềm mại
  // ==========================================
  private generateBambooGeometries() {
    const culmParts: THREE.BufferGeometry[] = []
    const leafParts: THREE.BufferGeometry[] = []

    // Tọa độ 7 thân trúc trong một cụm
    const culmOffsets = [
      { x: 0.0, z: 0.0, h: 7.4, tiltX: 0.02, tiltZ: -0.03 },
      { x: 0.35, z: 0.25, h: 7.0, tiltX: 0.04, tiltZ: 0.02 },
      { x: -0.32, z: 0.28, h: 7.2, tiltX: -0.03, tiltZ: 0.04 },
      { x: 0.42, z: -0.30, h: 6.7, tiltX: 0.05, tiltZ: -0.04 },
      { x: -0.38, z: -0.32, h: 6.9, tiltX: -0.04, tiltZ: -0.02 },
      { x: 0.05, z: 0.55, h: 6.5, tiltX: 0.02, tiltZ: 0.05 },
      { x: -0.15, z: -0.58, h: 6.6, tiltX: -0.02, tiltZ: -0.05 }
    ]

    for (const c of culmOffsets) {
      // Thân trúc gồm các lóng trúc hình trụ
      const culm = new THREE.CylinderGeometry(0.065, 0.085, c.h, 7)
      culm.rotateX(c.tiltX)
      culm.rotateZ(c.tiltZ)
      culm.translate(c.x, c.h * 0.5, c.z)
      culmParts.push(culm)

      // Các mắt trúc (đốt trúc) vòng quanh thân
      const nodeCount = 7
      for (let n = 1; n < nodeCount; n++) {
        const ny = (c.h / nodeCount) * n
        const nodeRing = new THREE.CylinderGeometry(0.095, 0.095, 0.08, 7)
        nodeRing.translate(c.x + c.tiltZ * ny, ny, c.z + c.tiltX * ny)
        culmParts.push(nodeRing)
      }

      // Nhánh lá trúc tỏa ra ở các tầng trên (y > 3.5m)
      for (let l = 0; l < 4; l++) {
        const ly = 4.2 + l * 0.75
        const lAngle = l * 1.57 + c.x * 3.0
        const leafSpray = new THREE.ConeGeometry(0.45, 1.4, 4)
        leafSpray.rotateX(Math.PI * 0.45)
        leafSpray.rotateY(lAngle)
        leafSpray.translate(
          c.x + Math.cos(lAngle) * 0.45,
          ly,
          c.z + Math.sin(lAngle) * 0.45
        )
        leafParts.push(leafSpray)
      }
    }

    return {
      trunkGeo: mergeGeometries(culmParts),
      foliageGeo: mergeGeometries(leafParts)
    }
  }

  // ==========================================
  // 4. THÔNG CỔ TỰ (PINE TREE)
  // Thân uốn chữ S phong cách Bonsai thiền tông, 4 tầng mây lá thông xếp lớp
  // ==========================================
  private generatePineGeometries() {
    const trunkParts: THREE.BufferGeometry[] = []

    // Thân thông uốn lượn chữ S qua 3 đoạn nối
    const seg1 = new THREE.CylinderGeometry(0.48, 0.65, 3.0, 10)
    seg1.rotateZ(0.14)
    seg1.translate(-0.25, 1.5, 0)
    trunkParts.push(seg1)

    const seg2 = new THREE.CylinderGeometry(0.36, 0.48, 2.8, 10)
    seg2.rotateZ(-0.16)
    seg2.translate(0.15, 4.2, 0)
    trunkParts.push(seg2)

    const seg3 = new THREE.CylinderGeometry(0.24, 0.36, 2.4, 8)
    seg3.rotateZ(0.08)
    seg3.translate(-0.05, 6.6, 0)
    trunkParts.push(seg3)

    // Tán lá thông: 4 tầng dĩa phẳng dạng mây tùng (layered_pine cloud boughs)
    const foliageParts: THREE.BufferGeometry[] = []
    const tiers = [
      { y: 3.8, r: 2.8, h: 0.65, x: 0.8, z: 0.2 },
      { y: 5.2, r: 2.3, h: 0.55, x: -0.6, z: 0.3 },
      { y: 6.5, r: 1.8, h: 0.45, x: 0.4, z: -0.3 },
      { y: 7.7, r: 1.2, h: 0.40, x: -0.1, z: 0.0 }
    ]

    for (const t of tiers) {
      // Dĩa mây tùng hình nón cụt/vòm dẹt
      const pad = new THREE.CylinderGeometry(t.r * 0.4, t.r, t.h, 12)
      pad.translate(t.x, t.y, t.z)
      foliageParts.push(pad)
    }

    return {
      trunkGeo: mergeGeometries(trunkParts),
      foliageGeo: mergeGeometries(foliageParts)
    }
  }

  // ==========================================
  // 5. CÂY PHONG ĐỎ / ANH ĐÀO (CHERRY MAPLE)
  // Thân thanh thoát uốn cong, 2 nhánh duyên dáng nâng đỡ các đám mây hoa/lá đỏ
  // ==========================================
  private generateCherryMapleGeometries() {
    const trunkParts: THREE.BufferGeometry[] = []

    // Thân gốc uốn lượn nhẹ
    const lowerTrunk = new THREE.CylinderGeometry(0.32, 0.45, 3.6, 10)
    lowerTrunk.rotateZ(0.12)
    lowerTrunk.translate(-0.2, 1.8, 0)
    trunkParts.push(lowerTrunk)

    // Nhánh trái vươn xa
    const bLeft = new THREE.CylinderGeometry(0.18, 0.32, 3.2, 8)
    bLeft.rotateZ(0.52)
    bLeft.translate(-0.95, 4.6, 0.2)
    trunkParts.push(bLeft)

    // Nhánh phải vươn cao
    const bRight = new THREE.CylinderGeometry(0.16, 0.28, 3.0, 8)
    bRight.rotateZ(-0.42)
    bRight.translate(0.85, 4.7, -0.2)
    trunkParts.push(bRight)

    // Tán lá: 4 cụm bông bồng bềnh thanh tao
    const foliageParts: THREE.BufferGeometry[] = []
    const folClouds = [
      { x: -1.6, y: 5.6, z: 0.4, rx: 1.8, ry: 1.2, rz: 1.8 },
      { x: 1.5, y: 5.8, z: -0.3, rx: 1.7, ry: 1.1, rz: 1.7 },
      { x: 0.0, y: 6.8, z: 0.0, rx: 1.9, ry: 1.3, rz: 1.9 },
      { x: -0.4, y: 5.1, z: -0.8, rx: 1.4, ry: 0.9, rz: 1.4 }
    ]

    for (const c of folClouds) {
      const fol = new THREE.SphereGeometry(1.0, 12, 10)
      fol.scale(c.rx, c.ry, c.rz)
      fol.translate(c.x, c.y, c.z)
      foliageParts.push(fol)
    }

    return {
      trunkGeo: mergeGeometries(trunkParts),
      foliageGeo: mergeGeometries(foliageParts)
    }
  }

  // ==========================================
  // 6. HÀNG CAU CẢNH NAM Á / CỌ THIỀN (PALM)
  // Thân thon cao đốt vòng nhịp nhàng, chùm 10 tàu cau uốn cong xòe nan quạt
  // ==========================================
  private generatePalmGeometries() {
    const trunkParts: THREE.BufferGeometry[] = []

    // Thân cau thon cao, hơi cong nhẹ tự nhiên
    const trunk = new THREE.CylinderGeometry(0.16, 0.24, 7.5, 10)
    trunk.rotateZ(0.04)
    trunk.translate(0.15, 3.75, 0)
    trunkParts.push(trunk)

    // Cổ họng bẹ cau xanh mướt ở đỉnh thân
    const crownShaft = new THREE.CylinderGeometry(0.18, 0.16, 1.1, 8)
    crownShaft.translate(0.28, 7.2, 0)
    trunkParts.push(crownShaft)

    // 10 tàu lá cau xòe tròn như đài phun nước rủ xuống
    const frondParts: THREE.BufferGeometry[] = []
    const frondCount = 10

    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2
      // Tàu lá cong hình vòng cung mềm mại
      const frond = new THREE.ConeGeometry(0.48, 2.6, 4)
      frond.rotateX(Math.PI * 0.42) // Uốn rủ xuống
      frond.rotateY(angle)
      frond.translate(
        0.28 + Math.cos(angle) * 1.1,
        7.4,
        Math.sin(angle) * 1.1
      )
      frondParts.push(frond)
    }

    return {
      trunkGeo: mergeGeometries(trunkParts),
      foliageGeo: mergeGeometries(frondParts)
    }
  }

  /**
   * Cài đặt shader lay động gió đồng bộ toàn cầu qua onBeforeCompile
   */
  private attachWindSway(material: THREE.MeshStandardMaterial, swayScale = 1.0, isFoliage = false) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.windSystem.uniforms.uWindTime
      shader.uniforms.uWindDirection = this.windSystem.uniforms.uWindDirection
      shader.uniforms.uWindStrength = this.windSystem.uniforms.uWindStrength
      shader.uniforms.uWindGust = this.windSystem.uniforms.uWindGust

      shader.vertexShader = `
        uniform float uWindTime;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uWindGust;
      ` + shader.vertexShader

      const swayChunk = isFoliage
        ? `
          // Tán lá: lay động cành theo gió + rung rinh phiến lá tự nhiên
          float heightFactor = clamp(transformed.y / 7.2, 0.0, 1.8);
          float hSq = heightFactor * heightFactor;
          
          float spatial = transformed.x * 0.35 + transformed.z * 0.35;
          float branchSway = sin(uWindTime * 1.9 + spatial) * 0.18 * hSq * uWindStrength * ${swayScale.toFixed(2)};
          float leafFlutter = sin(uWindTime * 5.5 + transformed.x * 4.0 + transformed.y * 3.5) * 0.045 * (1.0 + uWindGust * 0.7) * heightFactor;

          transformed.x += uWindDirection.x * branchSway + leafFlutter;
          transformed.z += uWindDirection.y * branchSway + leafFlutter;
        `
        : `
          // Thân cây: cố định 100% tại gốc (y = 0), uốn dẻo tăng dần theo độ cao
          float heightFactor = clamp(transformed.y / 8.5, 0.0, 1.0);
          float hSq = heightFactor * heightFactor;
          float trunkSway = sin(uWindTime * 1.4 + transformed.x * 0.2) * 0.065 * hSq * uWindStrength * ${swayScale.toFixed(2)};

          transformed.x += uWindDirection.x * trunkSway;
          transformed.z += uWindDirection.y * trunkSway;
        `

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${swayChunk}`
      )
    }
  }

  /**
   * Điều chỉnh màu sắc tán lá theo quốc gia (Nhật/Hàn = Hoa Anh Đào hồng phấn, còn lại = Phong đỏ)
   */
  public setCountry(countryCode: string) {
    if (!this.mapleMaterial) return

    if (countryCode === 'japan' || countryCode === 'korea') {
      this.mapleMaterial.color.setHex(0xf5b7b1) // Hoa anh đào hồng phấn tao nhã
    } else {
      this.mapleMaterial.color.setHex(0xa8201a) // Phong đỏ rực rỡ
    }
  }

  public update(delta: number) {
    // Wind uniforms are updated automatically by WindSystem
  }

  public dispose() {
    for (const geo of this.geometries) {
      geo.dispose()
    }
    for (const mat of this.materials) {
      mat.dispose()
    }
    this.geometries = []
    this.materials = []
    this.trunkMeshes.clear()
    this.foliageMeshes.clear()
  }
}

