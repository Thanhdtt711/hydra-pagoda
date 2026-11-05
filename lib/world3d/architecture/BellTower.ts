import * as THREE from 'three'
import type { PBRMaterialFactory } from '../materials/PBRMaterialFactory'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'

/**
 * Sinh hình học mái cong đầu đao truyền thống cho lầu chuông
 */
function createCurvedTowerRoofGeometry(
  baseW: number,
  baseD: number,
  height: number,
  ridgeW: number,
  ridgeD: number,
  eaveLift: number
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const segments = 6

  const addRoofFace = (
    bottomLeft: [number, number],
    bottomRight: [number, number],
    topLeft: [number, number],
    topRight: [number, number]
  ) => {
    const startIndex = positions.length / 3
    for (let row = 0; row <= segments; row++) {
      const t = row / segments
      const yNorm = Math.pow(t, 1.3)
      const baseHeightAtRow = yNorm * height

      for (let col = 0; col <= segments; col++) {
        const s = (col / segments) * 2.0 - 1.0

        const leftX = THREE.MathUtils.lerp(bottomLeft[0], topLeft[0], t)
        const leftZ = THREE.MathUtils.lerp(bottomLeft[1], topLeft[1], t)
        const rightX = THREE.MathUtils.lerp(bottomRight[0], topRight[0], t)
        const rightZ = THREE.MathUtils.lerp(bottomRight[1], topRight[1], t)

        const uCol = (s + 1.0) * 0.5
        const vx = THREE.MathUtils.lerp(leftX, rightX, uCol)
        const vz = THREE.MathUtils.lerp(leftZ, rightZ, uCol)

        // Độ vểnh cong đầu đao ở 4 góc
        const cornerFactor = Math.pow(Math.abs(s), 2.0) * Math.pow(1.0 - t, 1.5)
        const vy = baseHeightAtRow + cornerFactor * eaveLift

        positions.push(vx, vy, vz)
        uvs.push(uCol * 3, t * 2)
        normals.push(0, 1, 0)
      }
    }

    const colsCount = segments + 1
    for (let r = 0; r < segments; r++) {
      for (let c = 0; c < segments; c++) {
        const i0 = startIndex + r * colsCount + c
        const i1 = i0 + 1
        const i2 = startIndex + (r + 1) * colsCount + c
        const i3 = i2 + 1

        indices.push(i0, i2, i1)
        indices.push(i1, i2, i3)
      }
    }
  }

  // 4 mặt mái đối xứng
  addRoofFace([-baseW * 0.5, baseD * 0.5], [baseW * 0.5, baseD * 0.5], [-ridgeW * 0.5, ridgeD * 0.5], [ridgeW * 0.5, ridgeD * 0.5])
  addRoofFace([baseW * 0.5, -baseD * 0.5], [-baseW * 0.5, -baseD * 0.5], [ridgeW * 0.5, -ridgeD * 0.5], [-ridgeW * 0.5, -ridgeD * 0.5])
  addRoofFace([-baseW * 0.5, -baseD * 0.5], [-baseW * 0.5, baseD * 0.5], [-ridgeW * 0.5, -ridgeD * 0.5], [-ridgeW * 0.5, ridgeD * 0.5])
  addRoofFace([baseW * 0.5, baseD * 0.5], [baseW * 0.5, -baseD * 0.5], [ridgeW * 0.5, ridgeD * 0.5], [ridgeW * 0.5, -ridgeD * 0.5])

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * BellTower (Lầu Chuông Cổ Tự & Đại Hồng Chung):
 * Traditional Vietnamese wooden bell tower with 4 ironwood pillars,
 * 2-tier flared eaves, Dougong brackets, and sculpted bronze bell (Đại Hồng Chung).
 * Pedestal is fully walkable (isFloor: true, floorY: 0.70) so players can enter the pavilion.
 */
export class BellTower {
  public root: THREE.Group = new THREE.Group()
  private materials: PBRMaterialFactory
  public bellMesh!: THREE.Mesh
  public strikerMesh!: THREE.Mesh
  public bellGroup!: THREE.Group
  public position = new THREE.Vector3(
    MapLayout.LANDMARKS.BELL_TOWER.center.x,
    MapLayout.LANDMARKS.BELL_TOWER.center.y,
    MapLayout.LANDMARKS.BELL_TOWER.center.z
  )

  constructor(materials: PBRMaterialFactory, collision: CollisionWorld) {
    this.materials = materials
    this.root.position.copy(this.position)

    // 1. Bệ tam cấp đá hoa cương 2 tầng (Bước lên được, isFloor: true)
    this.buildStonePedestal(collision)

    // 2. Hệ khung cột gỗ lim & sàn gỗ
    this.buildTimberFramework(collision)

    // 3. Mái ngói âm dương 2 tầng uốn cong đầu đao (Curved Eaves)
    this.buildDoubleCurvedRoofs()

    // 4. Đại Hồng Chung bằng đồng cổ tiện hình dáng truyền thống
    this.buildGreatBronzeBell()
  }

  private buildStonePedestal(collision: CollisionWorld) {
    const graniteMat = this.materials.createGraniteStepMaterial()

    // Tầng thềm đá dưới (7.2m x 7.2m x 0.35m)
    const baseLow = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 7.2), graniteMat)
    baseLow.position.y = 0.18
    baseLow.receiveShadow = true
    baseLow.castShadow = true
    this.root.add(baseLow)

    // Tầng thềm đá trên (6.2m x 6.2m x 0.35m)
    const baseHigh = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 6.2), graniteMat)
    baseHigh.position.y = 0.52
    baseHigh.receiveShadow = true
    baseHigh.castShadow = true
    this.root.add(baseHigh)

    // Bậc thềm tam cấp chuẩn hóa hướng Tây (4 bậc, mỗi bậc cao 0.175m <= 0.18m)
    const stepCount = 4
    const stepH = 0.70 / stepCount // 0.175m
    const stepTread = 0.35          // 0.35m >= 0.30m
    const stepWidth = 2.4

    for (let i = 0; i < stepCount; i++) {
      const y = (i + 0.5) * stepH
      const relX = -3.1 - (stepCount - 1 - i + 0.5) * stepTread
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stepTread + 0.02, stepH, stepWidth), graniteMat)
      stepMesh.position.set(relX, y, 0)
      stepMesh.receiveShadow = true
      this.root.add(stepMesh)
    }

    // Đăng ký Collider cho bệ lầu chuông là SÀN ĐI LẠI ĐƯỢC (isFloor: true, floorY: 0.70)
    collision.add(
      new BoxCollider(
        'bell_tower_base_floor',
        new THREE.Vector3(this.position.x, 0.35, this.position.z),
        new THREE.Vector3(6.2, 0.7, 6.2),
        false,
        true,
        0.70
      )
    )

    // 4 Bậc thang phía Tây chuẩn hóa collider (leo bằng WASD mượt mà không cần nhảy)
    for (let i = 0; i < stepCount; i++) {
      const floorY = (i + 1) * stepH
      const relX = -3.1 - (stepCount - 1 - i + 0.5) * stepTread
      collision.add(
        new BoxCollider(
          `bell_tower_step_${i}`,
          new THREE.Vector3(this.position.x + relX, floorY * 0.5, this.position.z),
          new THREE.Vector3(stepTread + 0.04, floorY, stepWidth),
          false,
          true,
          floorY
        )
      )
    }
  }

  private buildTimberFramework(collision: CollisionWorld) {
    const ironwoodMat = this.materials.createIronwoodMaterial()

    // 4 Cột gỗ lim cái vững chãi (đường kính 0.45m, cao 4.2m)
    const colCoords = [
      [-2.2, -2.2],
      [2.2, -2.2],
      [-2.2, 2.2],
      [2.2, 2.2]
    ]

    colCoords.forEach(([cx, cz], i) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 4.2, 16),
        ironwoodMat
      )
      col.position.set(cx, 2.7, cz)
      col.castShadow = true
      col.receiveShadow = true
      this.root.add(col)

      // Chân tảng đá kê cột
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.42, 0.25, 12),
        this.materials.createGraniteStepMaterial()
      )
      plinth.position.set(cx, 0.78, cz)
      plinth.castShadow = true
      this.root.add(plinth)

      // Collider cho từng thân cột gỗ
      collision.add(
        new CylinderCollider(
          `bell_col_${i}`,
          new THREE.Vector3(this.position.x + cx, 2.7, this.position.z + cz),
          0.32,
          4.2,
          false
        )
      )
    })

    // Xà ngang liên kết 4 cột
    const beamGeo = new THREE.BoxGeometry(4.8, 0.22, 0.22)
    for (const cz of [-2.2, 2.2]) {
      const beam = new THREE.Mesh(beamGeo, ironwoodMat)
      beam.position.set(0, 4.6, cz)
      beam.castShadow = true
      this.root.add(beam)
    }
    const beamSideGeo = new THREE.BoxGeometry(0.22, 0.22, 4.8)
    for (const cx of [-2.2, 2.2]) {
      const beam = new THREE.Mesh(beamSideGeo, ironwoodMat)
      beam.position.set(cx, 4.6, 0)
      beam.castShadow = true
      this.root.add(beam)
    }

    // Lan can gỗ con tiện bao 3 hướng (Bắc, Nam, Đông) - Chừa lối vào hướng Tây
    const railMat = this.materials.createIronwoodMaterial()
    const railings = [
      { pos: [0, 1.25, -2.2], size: [4.4, 0.8, 0.12] }, // Lan can Bắc
      { pos: [0, 1.25, 2.2], size: [4.4, 0.8, 0.12] },  // Lan can Nam
      { pos: [2.2, 1.25, 0], size: [0.12, 0.8, 4.4] }   // Lan can Đông
    ]

    railings.forEach((r, i) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(r.size[0], r.size[1], r.size[2]), railMat)
      rail.position.set(r.pos[0], r.pos[1], r.pos[2])
      rail.castShadow = true
      this.root.add(rail)

      collision.add(
        new BoxCollider(
          `bell_rail_${i}`,
          new THREE.Vector3(this.position.x + r.pos[0], r.pos[1], this.position.z + r.pos[2]),
          new THREE.Vector3(r.size[0] + 0.1, r.size[1], r.size[2] + 0.1),
          false
        )
      )
    })
  }

  private buildDoubleCurvedRoofs() {
    const roofMat = this.materials.createYinYangRoofMaterial()

    // 1. Mái tầng 1 (Mái hạ xòe rộng 6.6m x 6.6m, cao 1.6m, đầu đao cong 0.9m)
    const lowerRoofGeo = createCurvedTowerRoofGeometry(6.6, 6.6, 1.6, 3.2, 3.2, 0.9)
    const roofLower = new THREE.Mesh(lowerRoofGeo, roofMat)
    roofLower.position.y = 4.8
    roofLower.castShadow = true
    roofLower.receiveShadow = true
    this.root.add(roofLower)

    // Cổ diêm / Cổ các ngăn giữa 2 tầng mái (2.8m x 2.8m x 0.8m)
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.8, 2.8),
      this.materials.createIronwoodMaterial()
    )
    neck.position.y = 5.8
    neck.castShadow = true
    this.root.add(neck)

    // 2. Mái tầng 2 (Mái thượng vút cao 4.8m x 4.8m, cao 1.5m, đầu đao cong 1.1m)
    const upperRoofGeo = createCurvedTowerRoofGeometry(4.8, 4.8, 1.5, 0.4, 0.4, 1.1)
    const roofUpper = new THREE.Mesh(upperRoofGeo, roofMat)
    roofUpper.position.y = 6.2
    roofUpper.castShadow = true
    roofUpper.receiveShadow = true
    this.root.add(roofUpper)

    // Đỉnh chóp hồ lô / búp sen đồng vàng
    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.25, 0.9, 12),
      this.materials.createSacredGoldLeafMaterial()
    )
    finial.position.set(0, 7.8, 0)
    finial.castShadow = true
    this.root.add(finial)
  }

  private buildGreatBronzeBell() {
    const bronzeMat = this.materials.createAntiqueBronzeMaterial()
    const bellGroup = new THREE.Group()
    bellGroup.position.set(0, 3.4, 0)

    // Quai chuông chạm Bồ Lao (Rồng 2 đầu uốn cong)
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16, Math.PI), bronzeMat)
    handle.position.y = 0.85
    handle.castShadow = true
    bellGroup.add(handle)

    // Thân chuông tiện hình thang cong đặc trưng (Đại Hồng Chung)
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.25, 0.8),
      new THREE.Vector2(0.45, 0.65),
      new THREE.Vector2(0.55, 0.35),
      new THREE.Vector2(0.62, 0.0),
      new THREE.Vector2(0.72, -0.45),
      new THREE.Vector2(0.85, -0.75),
      new THREE.Vector2(0.88, -0.85),
      new THREE.Vector2(0.72, -0.85) // Vành miệng chuông dày
    ]
    const bellGeo = new THREE.LatheGeometry(points, 24)
    this.bellMesh = new THREE.Mesh(bellGeo, bronzeMat)
    this.bellMesh.castShadow = true
    bellGroup.add(this.bellMesh)

    // Núm thỉnh chuông (4 núm tròn tương ứng 4 mùa)
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2
      const boss = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        this.materials.createSacredGoldLeafMaterial()
      )
      boss.position.set(Math.cos(angle) * 0.74, -0.52, Math.sin(angle) * 0.74)
      boss.castShadow = true
      bellGroup.add(boss)
    }

    // Chày kình gõ chuông bằng gỗ lim treo nghiêng 1 góc
    const strikerGroup = new THREE.Group()
    const strikerMat = this.materials.createIronwoodMaterial()
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.8, 12), strikerMat)
    log.rotation.z = Math.PI * 0.5
    log.position.set(0.9, 0, 0)
    log.castShadow = true
    strikerGroup.add(log)

    bellGroup.add(strikerGroup)
    this.strikerMesh = log
    this.bellGroup = bellGroup

    this.root.add(bellGroup)
  }

  public swingBell(delta: number, elapsed: number) {
    if (this.bellGroup) {
      this.bellGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.03
    }
    if (this.strikerMesh) {
      this.strikerMesh.rotation.y = Math.sin(elapsed * 1.5 + 0.5) * 0.05
    }
  }
}
