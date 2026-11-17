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

    // 3. ÁN THƯ GỖ HƯƠNG KẾT DUYÊN (Chi tiết cổ truyền, mọi lễ vật nằm gọn trên mặt bàn)
    const woodTableColor = 0x5a2d18
    const woodDarkTrim = 0x3e1e0f
    const tableTopColor = 0x6e381f
    const bronzeColor = 0xd4a017
    const bronzeBright = 0xf2c14e
    const brocadeRed = 0x9e1b1b
    const cushionColor = 0xb33939
    const cushionTrim = 0xf39c12
    const bambooColor = 0xc89d54

    // Mặt bàn gỗ hương (1.64m x 0.82m, mặt trên tại y = 0.88)
    parts.push({
      geometry: LowPolyBuilder.box(1.64, 0.08, 0.82),
      color: tableTopColor,
      position: [-10.5, 0.84, 16.6]
    })
    // Khung gờ dưới mặt bàn
    parts.push({
      geometry: LowPolyBuilder.box(1.56, 0.05, 0.74),
      color: woodDarkTrim,
      position: [-10.5, 0.78, 16.6]
    })
    // Hai đầu cuốn thư uốn cong nhẹ ở hai mép trái/phải mặt bàn
    for (const sx of [-1, 1]) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.045, 0.045, 0.82, 8),
        color: woodDarkTrim,
        position: [-10.5 + sx * 0.82, 0.895, 16.6],
        rotation: [Math.PI * 0.5, 0, 0]
      })
    }

    // Khăn trải bàn gấm đỏ viền vàng kim ở trung tâm mặt bàn
    parts.push({
      geometry: LowPolyBuilder.box(1.06, 0.012, 0.56),
      color: cushionTrim,
      position: [-10.5, 0.884, 16.6]
    })
    parts.push({
      geometry: LowPolyBuilder.box(1.0, 0.016, 0.5),
      color: brocadeRed,
      position: [-10.5, 0.887, 16.6]
    })
    // Dải khăn gấm rủ trước bàn
    parts.push({
      geometry: LowPolyBuilder.box(0.56, 0.24, 0.02),
      color: brocadeRed,
      position: [-10.5, 0.76, 16.19]
    })
    parts.push({
      geometry: LowPolyBuilder.box(0.58, 0.03, 0.022),
      color: cushionTrim,
      position: [-10.5, 0.64, 16.19]
    })

    // 4 Chân bàn + đá kê chân + thanh giằng ngang
    const legW = 0.11
    const legH = 0.76
    for (const lx of [-11.2, -9.8]) {
      for (const lz of [16.28, 16.92]) {
        parts.push({
          geometry: LowPolyBuilder.box(legW, legH, legW),
          color: woodTableColor,
          position: [lx, 0.41, lz]
        })
        parts.push({
          geometry: LowPolyBuilder.cylinder(0.085, 0.095, 0.05, 8),
          color: 0x7f8c8d,
          position: [lx, 0.025, lz]
        })
      }
      // Thanh giằng bên hông
      parts.push({
        geometry: LowPolyBuilder.box(0.05, 0.05, 0.64),
        color: woodDarkTrim,
        position: [lx, 0.22, 16.6]
      })
    }
    // Diềm bàn trước & sau
    for (const dz of [16.25, 16.95]) {
      parts.push({
        geometry: LowPolyBuilder.box(1.44, 0.11, 0.04),
        color: woodTableColor,
        position: [-10.5, 0.72, dz]
      })
    }

    // --- LỄ VẬT TRÊN BÀN (Tất cả nằm trong [-11.2, -9.8], mặt bàn y = 0.89) ---

    // A. Lư hương đồng tam cấp ở chính giữa (-10.5, z = 16.64)
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.14, 0.16, 0.04, 10),
      color: woodDarkTrim,
      position: [-10.5, 0.91, 16.64]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.11, 0.13, 0.04, 10),
      color: bronzeColor,
      position: [-10.5, 0.95, 16.64]
    })
    parts.push({
      geometry: LowPolyBuilder.sphere(0.135, 1),
      color: bronzeBright,
      position: [-10.5, 1.04, 16.64],
      scale: [1.0, 0.78, 1.0]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.125, 0.11, 0.045, 10),
      color: bronzeColor,
      position: [-10.5, 1.12, 16.64]
    })
    // Tro trầm trong lư
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.105, 0.105, 0.02, 10),
      color: 0xc8c2b8,
      position: [-10.5, 1.135, 16.64]
    })
    // 2 tai lư đồng hai bên
    for (const sx of [-1, 1]) {
      parts.push({
        geometry: LowPolyBuilder.box(0.035, 0.11, 0.03),
        color: bronzeColor,
        position: [-10.5 + sx * 0.145, 1.07, 16.64],
        rotation: [0, 0, sx * -0.25]
      })
    }
    // 3 nén nhang trầm đỏ thắm + đốm lửa đỏ ở đầu nhang
    for (const [ix, tilt] of [[-0.035, 0.06], [0, 0], [0.035, -0.06]] as const) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.009, 0.009, 0.24, 5),
        color: 0xc0392b,
        position: [-10.5 + ix, 1.24, 16.64],
        rotation: [0, 0, tilt]
      })
      parts.push({
        geometry: LowPolyBuilder.sphere(0.014, 0),
        color: 0xff5722,
        position: [-10.5 + ix - Math.sin(tilt) * 0.12, 1.36, 16.64]
      })
    }

    // B. Bên phải người chơi (x = -10.08): Tráp sơn son thếp vàng đựng Cuộn Chỉ Hồng
    parts.push({
      geometry: LowPolyBuilder.box(0.28, 0.08, 0.22),
      color: 0x7a1212,
      position: [-10.08, 0.93, 16.58]
    })
    parts.push({
      geometry: LowPolyBuilder.box(0.29, 0.02, 0.23),
      color: bronzeBright,
      position: [-10.08, 0.975, 16.58]
    })
    // 2 cuộn chỉ hồng Nguyệt Lão nằm trên tráp
    for (const oz of [-0.045, 0.045]) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.038, 0.038, 0.16, 8),
        color: 0xe81e4a,
        position: [-10.08, 1.02, 16.58 + oz],
        rotation: [0, 0, Math.PI * 0.5]
      })
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.041, 0.041, 0.035, 8),
        color: bronzeBright,
        position: [-10.08, 1.02, 16.58 + oz],
        rotation: [0, 0, Math.PI * 0.5]
      })
    }

    // C. Bên trái người chơi (x = -10.92): Ống xăm tre + thẻ xăm + cặp keo xin âm dương (NẰM GỌN TRÊN BÀN)
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.105, 0.12, 0.035, 10),
      color: woodDarkTrim,
      position: [-10.92, 0.908, 16.58]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.095, 0.09, 0.24, 10),
      color: bambooColor,
      position: [-10.92, 1.045, 16.58]
    })
    // Đai đồng quanh ống xăm
    for (const by of [0.96, 1.14]) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.099, 0.099, 0.022, 10),
        color: bronzeBright,
        position: [-10.92, by, 16.58]
      })
    }
    // 6 thẻ xăm đầu sơn đỏ nhô lên khỏi ống xăm
    const stickOffsets: Array<[number, number, number, number]> = [
      [0, 0, 0, 0],
      [-0.03, 0.015, 0.08, -0.05],
      [0.03, -0.015, -0.08, 0.05],
      [-0.015, -0.03, 0.04, 0.09],
      [0.02, 0.028, -0.05, -0.08],
      [0.035, 0.01, -0.1, 0.02]
    ]
    for (const [sx, sz, rx, rz] of stickOffsets) {
      parts.push({
        geometry: LowPolyBuilder.box(0.016, 0.22, 0.008),
        color: 0xf1e4c6,
        position: [-10.92 + sx, 1.19, 16.58 + sz],
        rotation: [rx, 0, rz]
      })
      parts.push({
        geometry: LowPolyBuilder.box(0.018, 0.045, 0.01),
        color: 0xd63031,
        position: [-10.92 + sx * 1.25, 1.29, 16.58 + sz * 1.25],
        rotation: [rx, 0, rz]
      })
    }
    // Cặp keo xin âm dương (2 mảnh gỗ đỏ son hình bán nguyệt đặt cạnh ống xăm)
    for (const [kx, kz, ry] of [[-10.74, 16.46, 0.35], [-10.67, 16.5, -0.45]] as const) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.042, 0.048, 0.022, 7),
        color: 0xb8372b,
        position: [kx, 0.905, kz],
        rotation: [0, ry, 0],
        scale: [1.25, 1.0, 0.65]
      })
    }

    // D. Hai chân nến đồng cổ đặt trên mặt bàn (khớp đúng vị trí nến [-11.14, 16.74] và [-9.86, 16.74])
    for (const cx of [-11.14, -9.86]) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.065, 0.08, 0.03, 8),
        color: bronzeColor,
        position: [cx, 0.905, 16.74]
      })
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.055, 0.04, 0.025, 8),
        color: bronzeBright,
        position: [cx, 0.93, 16.74]
      })
    }

    // 2 Đệm quỳ tròn bằng cói gấm đỏ phía trước bàn
    for (const px of [-10.92, -10.08]) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.36, 0.38, 0.09, 10),
        color: cushionColor,
        position: [px, 0.045, 15.62]
      })
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.38, 0.38, 0.025, 10),
        color: cushionTrim,
        position: [px, 0.085, 15.62]
      })
    }

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

    // 5. Ngọn nến lung linh Pixel Art trên Án Thư Nguyệt Lão (đặt đúng trên 2 chân nến đồng)
    const candleSys = PixelCandleSystem.getInstance()
    candleSys.addCandle({
      parent: this.root,
      position: [-11.14, 0.94, 16.74],
      height: 0.42,
      withLight: true,
      lightIntensity: 0.65,
      lightDistance: 3.5,
      lightColor: 0xffa040,
      timeOffset: 0.5
    })
    candleSys.addCandle({
      parent: this.root,
      position: [-9.86, 0.94, 16.74],
      height: 0.42,
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

      // Thẻ gỗ ước nguyện sơn son treo cạnh nút thắt
      const wishGeo = new THREE.BoxGeometry(0.11, 0.22, 0.025)
      const wishMat = new THREE.MeshLambertMaterial({ color: 0xd9a441, flatShading: true })
      const wishMesh = new THREE.Mesh(wishGeo, wishMat)
      wishMesh.position.set(0.04, -length * 0.65, 0.02)
      wishMesh.rotation.z = 0.08
      g.add(wishMesh)

      this.ribbonsGroup.add(g)
    })

    // 2 Cột Đèn Lồng Tơ Hồng chầu hai bên Án Thư Cầu Duyên
    const mats = FlatMaterialFactory.getInstance()
    const lanternMat = mats.emissive('lantern')
    const woodPostMat = mats.get('woodDark')
    const roofCapMat = mats.get('roofDark')
    const stonePlinthMat = mats.get('stone')
    const goldAccentMat = mats.get('gold')

    for (const lx of [-11.8, -9.2]) {
      const lz = 16.55
      const plinth = new THREE.Mesh(LowPolyBuilder.box(0.36, 0.16, 0.36), stonePlinthMat)
      plinth.position.set(lx, 0.08, lz)
      this.root.add(plinth)

      const post = new THREE.Mesh(LowPolyBuilder.cylinder(0.055, 0.065, 1.55, 6), woodPostMat)
      post.position.set(lx, 0.92, lz)
      this.root.add(post)

      const arm = new THREE.Mesh(LowPolyBuilder.box(0.24, 0.06, 0.06), woodPostMat)
      arm.position.set(lx + (lx < -10.5 ? 0.1 : -0.1), 1.66, lz)
      this.root.add(arm)

      const lanternX = lx + (lx < -10.5 ? 0.18 : -0.18)
      const glow = new THREE.Mesh(LowPolyBuilder.cylinder(0.14, 0.14, 0.28, 6), lanternMat)
      glow.position.set(lanternX, 1.46, lz)
      this.root.add(glow)

      const cap = new THREE.Mesh(LowPolyBuilder.cone(0.24, 0.14, 6), roofCapMat)
      cap.position.set(lanternX, 1.66, lz)
      this.root.add(cap)

      const tassel = new THREE.Mesh(LowPolyBuilder.cylinder(0.03, 0.015, 0.16, 5), goldAccentMat)
      tassel.position.set(lanternX, 1.24, lz)
      this.root.add(tassel)
    }
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

