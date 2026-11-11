import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { LowPolyBuilder, type ColoredPart } from '../style/LowPolyBuilder'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { PixelCandleSystem } from '../fx/PixelCandleSystem'

/**
 * LoveTreeProp (Cây Nguyệt Lão & Án Thư Gieo Quẻ Tơ Duyên):
 * - Đặt tại bờ Hồ Sen Bát Nhã (x = -10.5, z = 18.0), soi bóng xuống mặt nước sen.
 * - Cây đại thụ Hồng Thần Mộc tán lá hồng đào / đỏ son rực rỡ, rủ 8 dải lụa đỏ thắt gút đồng tâm.
 * - Án thư gỗ hương cổ kính có lư trầm, tráp cuộn chỉ hồng và 2 đệm quỳ cói thêu hoa sen.
 * - Tích hợp collider và điểm kích hoạt tương tác phím [E] cho người chơi.
 */
export class LoveTreeProp {
  public root = new THREE.Group()
  public readonly centerPos = new THREE.Vector3(-10.5, 0.0, 18.0)
  public readonly altarPos = new THREE.Vector3(-10.5, 0.0, 16.6)
  public readonly interactPos = new THREE.Vector3(-10.5, 0.5, 16.6)

  private ribbonsGroup = new THREE.Group()
  private incenseSmokeGroup = new THREE.Group()

  constructor(collisionWorld?: CollisionWorld) {
    this.root.name = 'LoveTreeProp'
    this.buildTreeAndAltar()

    if (collisionWorld) {
      this.registerColliders(collisionWorld)
    }
  }

  private buildTreeAndAltar() {
    const parts: ColoredPart[] = []

    // 1. GỐC VÀ THÂN CÂY ĐẠI THỤ (Hồng Thần Mộc)
    const trunkColor = 0x4a2c17
    const trunkBarkDark = 0x381f10

    // Gốc cây xòe bạnh rễ
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.95, 1.45, 1.2, 7),
      color: trunkBarkDark,
      position: [-10.5, 0.6, 18.0]
    })
    // Thân dưới vươn nghiêng nhẹ
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.75, 0.95, 2.4, 7),
      color: trunkColor,
      position: [-10.4, 2.2, 18.1],
      rotation: [0.08, 0.3, -0.06]
    })
    // Thân trên phân nhánh
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.55, 0.75, 2.2, 6),
      color: trunkColor,
      position: [-10.2, 4.2, 18.2],
      rotation: [-0.05, 0.6, 0.12]
    })
    // Nhánh lớn hướng Tây (hướng ra mặt hồ sen)
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.35, 0.52, 2.8, 5),
      color: trunkBarkDark,
      position: [-11.4, 5.0, 17.8],
      rotation: [0.2, 0.1, 0.58]
    })
    // Nhánh lớn hướng Bắc (hướng về án thư & Chánh Điện)
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.32, 0.48, 2.6, 5),
      color: trunkBarkDark,
      position: [-10.3, 5.2, 17.1],
      rotation: [-0.55, 0.4, -0.15]
    })
    // Nhánh lớn hướng Nam
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.30, 0.45, 2.5, 5),
      color: trunkBarkDark,
      position: [-9.7, 5.1, 18.9],
      rotation: [0.45, -0.3, -0.35]
    })

    // 2. TÁN LÁ HOA ĐÀO / HỒNG PHONG (Sắc hồng đỏ ngũ phúc)
    const leafPinkLight = 0xff758c
    const leafRoseRed = 0xe84118
    const leafCoral = 0xfd79a8
    const leafCrimson = 0xc0392b

    // Cụm tán trung tâm đỉnh
    parts.push({
      geometry: LowPolyBuilder.sphere(1.9, 1),
      color: leafPinkLight,
      position: [-10.2, 6.2, 18.1],
      scale: [1.3, 0.9, 1.2]
    })
    // Cụm tán vươn Tây ra hồ
    parts.push({
      geometry: LowPolyBuilder.sphere(1.7, 1),
      color: leafRoseRed,
      position: [-12.5, 5.8, 17.6],
      scale: [1.2, 0.85, 1.1]
    })
    // Cụm tán vươn Bắc
    parts.push({
      geometry: LowPolyBuilder.sphere(1.6, 1),
      color: leafCoral,
      position: [-10.1, 5.9, 16.2],
      scale: [1.1, 0.8, 1.2]
    })
    // Cụm tán vươn Nam
    parts.push({
      geometry: LowPolyBuilder.sphere(1.5, 1),
      color: leafCrimson,
      position: [-9.3, 5.6, 19.5],
      scale: [1.2, 0.8, 1.0]
    })
    // Cụm tán phụ bồng bềnh
    parts.push({
      geometry: LowPolyBuilder.sphere(1.3, 1),
      color: leafPinkLight,
      position: [-11.1, 6.8, 18.8],
      scale: [1.0, 0.8, 1.0]
    })

    // 3. ÁN THƯ GỖ HƯƠNG KẾT DUYÊN
    const woodTableColor = 0x5a2d18
    const tableTopColor = 0x6e381f
    const bronzeColor = 0xf1c40f
    const cushionColor = 0xb33939
    const cushionTrim = 0xf39c12

    // Mặt bàn gỗ hương
    parts.push({
      geometry: LowPolyBuilder.box(1.5, 0.1, 0.75),
      color: tableTopColor,
      position: [-10.5, 0.82, 16.6]
    })
    // Chân bàn chạm hoa sen (4 chân)
    const legW = 0.12
    const legH = 0.78
    parts.push({
      geometry: LowPolyBuilder.box(legW, legH, legW),
      color: woodTableColor,
      position: [-11.15, 0.4, 16.32]
    })
    parts.push({
      geometry: LowPolyBuilder.box(legW, legH, legW),
      color: woodTableColor,
      position: [-9.85, 0.4, 16.32]
    })
    parts.push({
      geometry: LowPolyBuilder.box(legW, legH, legW),
      color: woodTableColor,
      position: [-11.15, 0.4, 16.88]
    })
    parts.push({
      geometry: LowPolyBuilder.box(legW, legH, legW),
      color: woodTableColor,
      position: [-9.85, 0.4, 16.88]
    })
    // Diềm bàn uốn lượn cổ truyền
    parts.push({
      geometry: LowPolyBuilder.box(1.4, 0.12, 0.05),
      color: woodTableColor,
      position: [-10.5, 0.74, 16.3]
    })

    // Lư hương đồng trên bàn
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.14, 0.09, 0.18, 6),
      color: bronzeColor,
      position: [-10.5, 0.96, 16.6]
    })
    // 3 nén nhang trầm đỏ thắm
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.015, 0.015, 0.28, 4),
      color: 0xe84118,
      position: [-10.5, 1.14, 16.6]
    })

    // Tráp gỗ đựng Cuộn Chỉ Hồng Nguyệt Lão
    parts.push({
      geometry: LowPolyBuilder.box(0.26, 0.14, 0.2),
      color: 0x8b0000,
      position: [-10.05, 0.94, 16.6]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.05, 0.05, 0.18, 6),
      color: 0xff1744, // Cuộn chỉ hồng đỏ tươi
      position: [-10.05, 1.02, 16.6],
      rotation: [0, 0, Math.PI * 0.5]
    })

    // 2 Đệm quỳ tròn bằng cói gấm đỏ
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.36, 0.38, 0.1, 8),
      color: cushionColor,
      position: [-10.95, 0.05, 15.6]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.39, 0.39, 0.03, 8),
      color: cushionTrim,
      position: [-10.95, 0.09, 15.6]
    })

    parts.push({
      geometry: LowPolyBuilder.cylinder(0.36, 0.38, 0.1, 8),
      color: cushionColor,
      position: [-10.05, 0.05, 15.6]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.39, 0.39, 0.03, 8),
      color: cushionTrim,
      position: [-10.05, 0.09, 15.6]
    })

    // Đèn lồng hoa đăng nhỏ 2 bên án thư
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.08, 0.06, 0.24, 6),
      color: 0xf39c12,
      position: [-11.35, 0.98, 16.6]
    })

    // Bake toàn bộ static geometry
    const staticGeo = LowPolyBuilder.mergeColored(parts)
    const mat = FlatMaterialFactory.getInstance().vertexColor()
    const staticMesh = new THREE.Mesh(staticGeo, mat)
    staticMesh.castShadow = true
    staticMesh.receiveShadow = true
    this.root.add(staticMesh)

    // 4. DẢI LỤA ĐỎ NGUYỆT LÃO & CHUÔNG GIÓ (Dynamic ribbons)
    this.buildHangingRibbons()
    this.root.add(this.ribbonsGroup)

    // Khói trầm nhẹ bay từ lư hương
    this.buildIncenseSmoke()
    this.root.add(this.incenseSmokeGroup)

    // 5. Ngọn nến lung linh Pixel Art trên Án Thư Nguyệt Lão
    const candleSys = PixelCandleSystem.getInstance()
    candleSys.addCandle({
      parent: this.root,
      position: [-10.98, 0.87, 16.6],
      height: 0.45,
      withLight: true,
      lightIntensity: 0.65,
      lightDistance: 3.5,
      lightColor: 0xffa040,
      timeOffset: 0.5
    })
    candleSys.addCandle({
      parent: this.root,
      position: [-10.02, 0.87, 16.6],
      height: 0.45,
      withLight: true,
      lightIntensity: 0.65,
      lightDistance: 3.5,
      lightColor: 0xffa040,
      timeOffset: 2.1
    })
  }

  private buildHangingRibbons() {
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xd63031,
      side: THREE.DoubleSide
    })
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      roughness: 0.3,
      metalness: 0.8
    })

    // 8 dải lụa đỏ treo từ các cành cây
    const ribbonPositions: [number, number, number, number][] = [
      [-11.2, 5.0, 17.6, 1.8],
      [-11.9, 4.8, 17.2, 2.2],
      [-10.6, 5.1, 16.5, 2.0],
      [-10.1, 4.9, 16.3, 1.6],
      [-9.8, 4.8, 18.5, 2.1],
      [-9.3, 4.6, 19.2, 1.7],
      [-10.8, 5.2, 18.8, 2.3],
      [-11.6, 5.3, 18.3, 1.9]
    ]

    ribbonPositions.forEach(([rx, ry, rz, length], i) => {
      const g = new THREE.Group()
      g.position.set(rx, ry, rz)
      g.userData = { phase: i * 0.8, len: length }

      // Dải lụa mỏng
      const ribbonGeo = new THREE.PlaneGeometry(0.12, length, 1, 4)
      ribbonGeo.translate(0, -length * 0.5, 0)
      const rMesh = new THREE.Mesh(ribbonGeo, ribbonMat)
      g.add(rMesh)

      // Nút gút đồng tâm vàng
      const knotGeo = new THREE.BoxGeometry(0.16, 0.16, 0.04)
      const knotMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f })
      const knotMesh = new THREE.Mesh(knotGeo, knotMat)
      knotMesh.position.set(0, -length * 0.4, 0)
      g.add(knotMesh)

      // Chiếc chuông đồng nhỏ ở đuôi dải lụa
      const bellGeo = new THREE.ConeGeometry(0.06, 0.1, 5)
      bellGeo.rotateX(Math.PI)
      const bellMesh = new THREE.Mesh(bellGeo, bellMat)
      bellMesh.position.set(0, -length, 0)
      g.add(bellMesh)

      this.ribbonsGroup.add(g)
    })
  }

  private buildIncenseSmoke() {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xecf0f1,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    })

    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.04 + i * 0.02, 5, 4), smokeMat)
      puff.position.set(-10.5, 1.25 + i * 0.12, 16.6)
      puff.userData = { offset: i * 0.5, speed: 0.3 + i * 0.1 }
      this.incenseSmokeGroup.add(puff)
    }
  }

  private registerColliders(cw: CollisionWorld) {
    // 1. Gốc cây cổ thụ
    cw.add(
      new CylinderCollider(
        'love_tree_trunk',
        new THREE.Vector3(-10.5, 1.8, 18.0),
        1.1,
        3.6
      )
    )

    // 2. Bàn án thư gieo quẻ
    cw.add(
      new BoxCollider(
        'love_tree_altar',
        new THREE.Vector3(-10.5, 0.42, 16.6),
        new THREE.Vector3(1.6, 0.85, 0.85),
        false,
        true,
        0.85
      )
    )
  }

  /**
   * Cập nhật chuyển động dải lụa đu đưa theo gió & khói trầm
   */
  public update(elapsedSec: number) {
    this.ribbonsGroup.children.forEach((c) => {
      const g = c as THREE.Group
      const phase = (g.userData.phase as number) || 0
      const swayX = Math.sin(elapsedSec * 1.8 + phase) * 0.08
      const swayZ = Math.cos(elapsedSec * 1.4 + phase) * 0.06
      g.rotation.set(swayX, 0, swayZ)
    })

    this.incenseSmokeGroup.children.forEach((p, idx) => {
      const speed = (p.userData.speed as number) || 0.3
      const baseY = 1.22 + idx * 0.1
      p.position.y = baseY + ((elapsedSec * speed) % 0.4)
      p.position.x = -10.5 + Math.sin(elapsedSec * 2.0 + idx) * 0.04
    })
  }
}

