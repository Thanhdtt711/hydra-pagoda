import * as THREE from 'three'
import type { PBRMaterialFactory } from '../materials/PBRMaterialFactory'
import { CollisionWorld, BoxCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'

/**
 * Sinh hình học mái cong đầu đao truyền thống cho cổng Tam Quan
 */
function createCurvedGateRoofGeometry(
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

  // Mặt trước
  addRoofFace([-baseW * 0.5, baseD * 0.5], [baseW * 0.5, baseD * 0.5], [-ridgeW * 0.5, ridgeD * 0.5], [ridgeW * 0.5, ridgeD * 0.5])
  // Mặt sau
  addRoofFace([baseW * 0.5, -baseD * 0.5], [-baseW * 0.5, -baseD * 0.5], [ridgeW * 0.5, -ridgeD * 0.5], [-ridgeW * 0.5, -ridgeD * 0.5])
  // Hông trái
  addRoofFace([-baseW * 0.5, -baseD * 0.5], [-baseW * 0.5, baseD * 0.5], [-ridgeW * 0.5, -ridgeD * 0.5], [-ridgeW * 0.5, ridgeD * 0.5])
  // Hông phải
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
 * TamQuanGate (Cổng Tam Quan Cổ Kính):
 * Classical 3-entrance monastery gate: Trung Quan (Center), Giả Quan (Right), Không Quan (Left).
 * Masonry pillars, decorative plaque, curved eaves, and colliders for smooth player traversal.
 */
export class TamQuanGate {
  public root: THREE.Group = new THREE.Group()
  private materials: PBRMaterialFactory
  public position = new THREE.Vector3(
    MapLayout.LANDMARKS.TAM_QUAN_GATE.center.x,
    MapLayout.LANDMARKS.TAM_QUAN_GATE.center.y,
    MapLayout.LANDMARKS.TAM_QUAN_GATE.center.z
  )

  constructor(materials: PBRMaterialFactory, collision: CollisionWorld) {
    this.materials = materials
    this.root.position.copy(this.position)

    // 1. Hệ 4 Trụ biểu & Tường hoa bao cổng (Đã khắc phục hoàn toàn khe hở 0.9m)
    this.buildGatePillarsAndWalls(collision)

    // 2. Mái ngói đao cong 3 gian giật cấp (Thay thế hoàn toàn khối nón Cone)
    this.buildTripleCurvedRoofs()

    // 3. Hoành phi câu đối "VẠN CẢNH THIỀN TỰ"
    this.buildCalligraphyPlaque()
  }

  private buildGatePillarsAndWalls(collision: CollisionWorld) {
    const stoneMat = this.materials.createGraniteStepMaterial()
    const woodMat = this.materials.createIronwoodMaterial()

    // 4 Cột trụ biểu chính
    const pillarPositions = [-6.2, -2.2, 2.2, 6.2]

    pillarPositions.forEach((px, i) => {
      const isInner = (i === 1 || i === 2)
      const height = isInner ? 5.2 : 4.2
      const width = isInner ? 0.85 : 0.72

      // Thân cột đá nguyên khối
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        stoneMat
      )
      col.position.set(px, height * 0.5, 0)
      col.castShadow = true
      col.receiveShadow = true
      this.root.add(col)

      // Chân tảng đá vuông giật cấp
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.35, 0.45, width + 0.35),
        stoneMat
      )
      plinth.position.set(px, 0.22, 0)
      plinth.castShadow = true
      this.root.add(plinth)

      // Đỉnh trụ chạm đài sen hoặc nghê đá
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.25, 0.3, width + 0.25),
        woodMat
      )
      cap.position.set(px, height + 0.15, 0)
      cap.castShadow = true
      this.root.add(cap)

      // Đăng ký Collider cho từng trụ cổng (chừa 3 cửa đi thông thoáng)
      collision.add(
        new BoxCollider(
          `tam_quan_pillar_${i}`,
          new THREE.Vector3(this.position.x + px, height * 0.5, this.position.z),
          new THREE.Vector3(width + 0.1, height, width + 0.1),
          false
        )
      )
    })

    // Xà ngang gỗ lim đè trên 3 vòm cổng
    const beamCenter = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 0.55), woodMat)
    beamCenter.position.set(0, 4.4, 0)
    beamCenter.castShadow = true
    this.root.add(beamCenter)

    const beamWest = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.38, 0.48), woodMat)
    beamWest.position.set(-4.2, 3.5, 0)
    beamWest.castShadow = true
    this.root.add(beamWest)

    const beamEast = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.38, 0.48), woodMat)
    beamEast.position.set(4.2, 3.5, 0)
    beamEast.castShadow = true
    this.root.add(beamEast)

    // Bức tường cánh tả & cánh hữu: Kéo dài từ x = +-6.2 đến +-23.8m để khép kín hoàn toàn với hàng rào biên
    const wallMat = this.materials.createStonePavementMaterial()
    const wallLen = 17.6 // Nối liền hoàn toàn từ 6.2 sang 23.8 (xóa bỏ lỗ hở 0.9m)
    
    // Tường Tây: Tâm tại x = -(6.2 + 23.8)/2 = -15.0m
    const wallWest = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 3.4, 0.65), wallMat)
    wallWest.position.set(-15.0, 1.7, 0)
    wallWest.castShadow = true
    wallWest.receiveShadow = true
    this.root.add(wallWest)

    collision.add(
      new BoxCollider(
        'tam_quan_wall_west',
        new THREE.Vector3(this.position.x - 15.0, 1.7, this.position.z),
        new THREE.Vector3(wallLen, 3.4, 0.7),
        false
      )
    )

    // Tường Đông: Tâm tại x = 15.0m
    const wallEast = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 3.4, 0.65), wallMat)
    wallEast.position.set(15.0, 1.7, 0)
    wallEast.castShadow = true
    wallEast.receiveShadow = true
    this.root.add(wallEast)

    collision.add(
      new BoxCollider(
        'tam_quan_wall_east',
        new THREE.Vector3(this.position.x + 15.0, 1.7, this.position.z),
        new THREE.Vector3(wallLen, 3.4, 0.7),
        false
      )
    )
  }

  private buildTripleCurvedRoofs() {
    const roofMat = this.materials.createYinYangRoofMaterial()

    // 1. Mái Trung Quan: Mái cong đao chính cao nhất ở giữa (Rộng 5.8m, Sâu 3.6m, Cao 1.8m, Đao vểnh 0.85m)
    const roofCenterGeo = createCurvedGateRoofGeometry(5.8, 3.6, 1.8, 3.4, 0.3, 0.85)
    const roofCenter = new THREE.Mesh(roofCenterGeo, roofMat)
    roofCenter.position.set(0, 4.6, 0)
    roofCenter.castShadow = true
    roofCenter.receiveShadow = true
    this.root.add(roofCenter)

    // Đỉnh chóp hoa sen mạ vàng
    const centerFinial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.28, 0.8, 12),
      this.materials.createSacredGoldLeafMaterial()
    )
    centerFinial.position.set(0, 6.7, 0)
    centerFinial.castShadow = true
    this.root.add(centerFinial)

    // 2. Mái Giả Quan (Tây: Rộng 4.6m, Sâu 3.0m, Cao 1.4m, Đao vểnh 0.65m)
    const roofWestGeo = createCurvedGateRoofGeometry(4.6, 3.0, 1.4, 2.6, 0.3, 0.65)
    const roofWest = new THREE.Mesh(roofWestGeo, roofMat)
    roofWest.position.set(-4.2, 3.7, 0)
    roofWest.castShadow = true
    roofWest.receiveShadow = true
    this.root.add(roofWest)

    // 3. Mái Không Quan (Đông: Rộng 4.6m, Sâu 3.0m, Cao 1.4m, Đao vểnh 0.65m)
    const roofEastGeo = createCurvedGateRoofGeometry(4.6, 3.0, 1.4, 2.6, 0.3, 0.65)
    const roofEast = new THREE.Mesh(roofEastGeo, roofMat)
    roofEast.position.set(4.2, 3.7, 0)
    roofEast.castShadow = true
    roofEast.receiveShadow = true
    this.root.add(roofEast)
  }

  private buildCalligraphyPlaque() {
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0x801818, // Sơn son son đỏ
      roughness: 0.38,
      metalness: 0.15
    })

    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.85, 0.08), plaqueMat)
    frame.position.set(0, 4.75, 0.32)
    frame.castShadow = true
    this.root.add(frame)

    // Khắc chữ nổi mạ vàng
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#7a1818'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 6
    ctx.strokeRect(8, 8, 496, 112)

    ctx.font = 'bold 44px serif'
    ctx.fillStyle = '#ffd700'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('VẠN CẢNH THIỀN TỰ', 256, 64)

    const textTex = new THREE.CanvasTexture(canvas)
    const textMat = new THREE.MeshBasicMaterial({ map: textTex, transparent: true })
    const textPlate = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.75), textMat)
    textPlate.position.set(0, 4.75, 0.38)
    this.root.add(textPlate)
  }
}
