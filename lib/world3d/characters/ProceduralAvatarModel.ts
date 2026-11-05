import * as THREE from 'three'
import {
  type AvatarModel,
  type AvatarExpression,
  type AvatarAnimation,
  type AvatarBodyShape,
  type PilgrimCountry
} from './AvatarModel'
import { FaceAtlas } from './FaceAtlas'
import { ToonShaderUtils } from './ToonShaderUtils'
import { AvatarKit } from './AvatarKit'

export interface ChibiPalette {
  robeColor: number
  trimColor: number
  innerColor: number
  sashColor: number
  skinColor: number
  hatKind: 'non_la' | 'kasa_japan' | 'gat_korea' | 'man_velvet' | 'shaved_monk' | 'tibet_cowl'
  hatColor: number
  shoesColor: number
}

export const CHIBI_PALETTES: Record<PilgrimCountry, ChibiPalette> = {
  vietnam: {
    robeColor: 0x4a7c9f, // Lam chàm dịu mát thanh thoát, tươi sáng vừa phải
    trimColor: 0xf4c430, // Chỉ thêu vàng kim
    innerColor: 0xf6f3ea, // Quần lụa bạch ngà ấm áp
    sashColor: 0x6ca3c2,
    skinColor: 0xfde3cf, // Da be hồng ấm tươi tắn
    hatKind: 'non_la',
    hatColor: 0xf3e5ab, // Màu nón lá nan vàng nhạt
    shoesColor: 0x3d3028
  },
  japan: {
    robeColor: 0x384152, // Samue chàm đen Zen dịu
    trimColor: 0x93a3b0,
    innerColor: 0xedeae1,
    sashColor: 0x5e6e82,
    skinColor: 0xfde1cb,
    hatKind: 'kasa_japan',
    hatColor: 0xd9be8f,
    shoesColor: 0x282828
  },
  thailand: {
    robeColor: 0xf08000, // Cà sa vàng nghệ saffron rực rỡ
    trimColor: 0xfdc54c,
    innerColor: 0xfbf2cf,
    sashColor: 0xd63434,
    skinColor: 0xf4bda7,
    hatKind: 'shaved_monk',
    hatColor: 0x000000,
    shoesColor: 0x6e2c14
  },
  korea: {
    robeColor: 0x7e8d9e, // Hanbok xám khói
    trimColor: 0xd0dbe5,
    innerColor: 0xf7f4ec,
    sashColor: 0x415063,
    skinColor: 0xffe5d9,
    hatKind: 'gat_korea',
    hatColor: 0x181818,
    shoesColor: 0x323548
  },
  taiwan: {
    robeColor: 0x3d6875,
    trimColor: 0xdfa543,
    innerColor: 0xfdf7dc,
    sashColor: 0xa83b3d,
    skinColor: 0xfde3cf,
    hatKind: 'man_velvet',
    hatColor: 0x243b55,
    shoesColor: 0x383838
  },
  singapore: {
    robeColor: 0x33a395,
    trimColor: 0xe8785c,
    innerColor: 0xfaf5ec,
    sashColor: 0x2d5261,
    skinColor: 0xfde3cf,
    hatKind: 'man_velvet',
    hatColor: 0x284956,
    shoesColor: 0x2c2c2c
  },
  india: {
    robeColor: 0xb8202d, // Đỏ đất Bồ Đề Đạo Tràng
    trimColor: 0xfef3dc,
    innerColor: 0xf5b072,
    sashColor: 0x7a0808,
    skinColor: 0xdcae83,
    hatKind: 'shaved_monk',
    hatColor: 0x000000,
    shoesColor: 0x542310
  },
  tibet: {
    robeColor: 0x731aae, // Đỏ tía bordeaux Mật Tông
    trimColor: 0xffc412,
    innerColor: 0x9e0b12,
    sashColor: 0xf7388f,
    skinColor: 0xdda378,
    hatKind: 'tibet_cowl',
    hatColor: 0xffc412,
    shoesColor: 0x400c73
  },
  western: {
    robeColor: 0x73523b, // Áo nâu sồng thanh bình Làng Mai
    trimColor: 0xa87e5e,
    innerColor: 0xf6eee5,
    sashColor: 0x4a3728,
    skinColor: 0xffebe6,
    hatKind: 'shaved_monk',
    hatColor: 0x000000,
    shoesColor: 0x3d2922
  }
}

/**
 * ProceduralAvatarModel:
 * Nhân vật Chibi hoạt hình dễ thương (Cozy Asian Anime Chibi),
 * tỷ lệ 3.8 đầu (~1.38m), bo tròn mềm mại 100%, không dùng BoxGeometry hay Cone nhọn.
 */
export class ProceduralAvatarModel implements AvatarModel {
  public root: THREE.Group = new THREE.Group()

  // Thông số hình học đầu (Ellipsoid chuẩn mực Chibi má phính dễ thương)
  private readonly headRadius = 0.185
  private readonly headScale = new THREE.Vector3(1.04, 0.98, 1.02)

  // Phân cấp xương cử động (Hierarchy)
  private bodyPivot: THREE.Group = new THREE.Group()
  private torsoGroup: THREE.Group = new THREE.Group()
  private headPivot: THREE.Group = new THREE.Group()
  private hatGroup: THREE.Group = new THREE.Group()
  private faceGroup: THREE.Group = new THREE.Group()
  private hairGroup: THREE.Group = new THREE.Group()

  // Mặt & chi tiết 3D
  private faceMesh!: THREE.Mesh
  private faceMaterial!: THREE.MeshBasicMaterial
  private noseMesh!: THREE.Mesh

  // Tay & Chân đối xứng
  private leftArmGroup: THREE.Group = new THREE.Group()
  private rightArmGroup: THREE.Group = new THREE.Group()
  private leftForearmGroup: THREE.Group = new THREE.Group()
  private rightForearmGroup: THREE.Group = new THREE.Group()
  private lotusFlower: THREE.Group = new THREE.Group()

  private skirtPivot: THREE.Group = new THREE.Group()
  private leftLeg: THREE.Group = new THREE.Group()
  private rightLeg: THREE.Group = new THREE.Group()
  private haloGroup: THREE.Group = new THREE.Group()

  // Vật liệu toon cel-shaded dùng chung
  private matSkin!: THREE.MeshToonMaterial
  private matNose!: THREE.MeshToonMaterial
  private matRobe!: THREE.MeshToonMaterial
  private matTrim!: THREE.MeshToonMaterial
  private matInner!: THREE.MeshToonMaterial
  private matSash!: THREE.MeshToonMaterial
  private matHat!: THREE.MeshToonMaterial
  private matHair!: THREE.MeshToonMaterial
  private matShoes!: THREE.MeshToonMaterial

  // Trạng thái
  private currentCountry: PilgrimCountry = 'vietnam'
  private currentExpression: AvatarExpression = 'serene'
  private currentAnimation: AvatarAnimation = 'idle'
  private currentBodyShape: AvatarBodyShape = 'regular'

  private animTime = 0
  private bowProgress = 0
  private isBowing = false

  constructor(country: PilgrimCountry = 'vietnam') {
    this.createMaterials()
    this.buildChibiSkeleton()
    this.setCountry(country)
    this.setExpression('serene')
  }

  private createMaterials() {
    const fabricTex = AvatarKit.getInstance().fabricNormalMap

    this.matSkin = ToonShaderUtils.createToonMaterial({ color: 0xfde3cf })
    this.matNose = ToonShaderUtils.createToonMaterial({ color: 0xebb49e })

    this.matRobe = ToonShaderUtils.createToonMaterial({
      color: 0x4a7c9f,
      normalMap: fabricTex,
      normalScale: new THREE.Vector2(0.12, 0.12),
      side: THREE.DoubleSide
    })
    this.matTrim = ToonShaderUtils.createToonMaterial({ color: 0xf4c430, side: THREE.DoubleSide })
    this.matInner = ToonShaderUtils.createToonMaterial({ color: 0xf6f3ea })
    this.matSash = ToonShaderUtils.createToonMaterial({ color: 0x6ca3c2, side: THREE.DoubleSide })
    this.matHat = ToonShaderUtils.createToonMaterial({ color: 0xf3e5ab, side: THREE.DoubleSide })
    // Mũ tóc màu nâu đen chàm ấm phong cách anime
    this.matHair = ToonShaderUtils.createToonMaterial({ color: 0x22242b, side: THREE.DoubleSide })
    this.matShoes = ToonShaderUtils.createToonMaterial({ color: 0x3d3028 })
  }

  /**
   * Dựng khung nhân vật Chibi tỷ lệ chuẩn 3.8 đầu (~1.38m)
   */
  private buildChibiSkeleton() {
    this.root.add(this.bodyPivot)

    // 1. CHÂN & BÀN CHÂN (Khớp háng tại y = 0.44m, chân lộ rõ dưới gấu váy)
    this.buildChibiLegs()

    // 2. VÁY / TÀ ÁO DÀI (Từ thắt lưng y = 0.52m rủ xuống y = 0.26m, chừa 26cm lộ rõ chân & giày)
    this.skirtPivot.position.set(0, 0.52, 0)
    this.bodyPivot.add(this.skirtPivot)
    this.buildChibiSkirt()

    // 3. THÂN TRÊN (Nối từ thắt lưng y = 0.52m tới vai y = 0.84m)
    this.torsoGroup.position.set(0, 0.52, 0)
    this.bodyPivot.add(this.torsoGroup)
    this.buildChibiTorso()

    // 4. HAI TAY ĐỐI XỨNG (Cánh tay áo thụng liền mạch, mitten hand chắp trước bụng)
    this.buildChibiArms()

    // 5. CỔ LỘ RÕ & ĐẦU TO TRÒN CHIBI (Khớp cổ tại y = 0.35m của torsoGroup, tức y = 0.87m)
    this.headPivot.position.set(0, 0.35, 0)
    this.torsoGroup.add(this.headPivot)
    this.buildChibiHead()

    // 6. HÀO QUANG THIỀN ĐỊNH
    this.buildChibiHalo()
  }

  /**
   * Chân capsule bo tròn + Giày ellipsoid dẹt mũi vểnh, lộ rõ dưới gấu váy
   */
  private buildChibiLegs() {
    // Quần lụa bạch ngà ấm bo tròn
    const legGeo = new THREE.CapsuleGeometry(0.038, 0.24, 16, 20)
    legGeo.computeVertexNormals()

    // Bàn chân dẹt xinh xắn (ellipsoid) mũi hơi vểnh nhẹ
    const footGeo = new THREE.SphereGeometry(0.046, 20, 16)
    footGeo.scale(0.75, 0.55, 1.35)
    footGeo.rotateX(-0.08)
    footGeo.computeVertexNormals()

    // Chân trái
    this.leftLeg.position.set(-0.065, 0.44, 0)
    const lLegMesh = new THREE.Mesh(legGeo, this.matInner)
    lLegMesh.position.y = -0.15
    lLegMesh.castShadow = true
    this.leftLeg.add(lLegMesh)

    const lFootMesh = new THREE.Mesh(footGeo, this.matShoes)
    lFootMesh.position.set(0, -0.28, 0.02)
    lFootMesh.castShadow = true
    this.leftLeg.add(lFootMesh)
    this.bodyPivot.add(this.leftLeg)

    // Chân phải
    this.rightLeg.position.set(0.065, 0.44, 0)
    const rLegMesh = new THREE.Mesh(legGeo, this.matInner)
    rLegMesh.position.y = -0.15
    rLegMesh.castShadow = true
    this.rightLeg.add(rLegMesh)

    const rFootMesh = new THREE.Mesh(footGeo, this.matShoes)
    rFootMesh.position.set(0, -0.28, 0.02)
    rFootMesh.castShadow = true
    this.rightLeg.add(rFootMesh)
    this.bodyPivot.add(this.rightLeg)
  }

  /**
   * Tà áo dài hai đoạn bằng LatheGeometry, rủ xuống đầu gối (cao 0.26m), lộ rõ chân & giày, DoubleSide
   */
  private buildChibiSkirt() {
    const pts: THREE.Vector2[] = []
    const segs = 20
    const skirtHeight = 0.26 // Cao 26cm, kết thúc tại y = 0.26m cách đất -> Lộ chân rõ ràng!
    for (let i = 0; i <= segs; i++) {
      const t = i / segs // 0 tại gấu váy, 1 tại eo
      const y = -skirtHeight * (1 - t)
      // Bán kính từ gấu (0.20m) thon dần về eo (0.13m) chữ A duyên dáng
      const r = 0.20 - 0.07 * t + 0.006 * Math.sin(t * Math.PI)
      pts.push(new THREE.Vector2(r, y))
    }

    const skirtGeo = new THREE.LatheGeometry(pts, 36)

    // Tạo 8 nếp vải dợn sóng nhẹ tự nhiên quanh gấu
    const pos = skirtGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i)
      const py = pos.getY(i)
      const pz = pos.getZ(i)
      const angle = Math.atan2(pz, px)
      const t = (py + skirtHeight) / skirtHeight
      const ripple = Math.sin(angle * 8) * 0.006 * (1 - t)
      pos.setX(i, px + Math.cos(angle) * ripple)
      pos.setZ(i, pz + Math.sin(angle) * ripple)
    }
    skirtGeo.computeVertexNormals()

    const skirtMesh = new THREE.Mesh(skirtGeo, this.matRobe)
    skirtMesh.castShadow = true
    skirtMesh.receiveShadow = true
    this.skirtPivot.add(skirtMesh)

    // Viền gấu váy vàng mỏng
    const hemTrimGeo = new THREE.TorusGeometry(0.20, 0.005, 8, 36)
    hemTrimGeo.rotateX(Math.PI / 2)
    const hemMesh = new THREE.Mesh(hemTrimGeo, this.matTrim)
    hemMesh.position.y = -skirtHeight
    this.skirtPivot.add(hemMesh)
  }

  /**
   * Thân trên: bụng tròn bo mềm, cổ áo Áo Tràng / Áo Lam Phật giáo thanh nhã
   */
  private buildChibiTorso() {
    // 1. Thân áo giao lĩnh chibi bo tròn mềm mại bằng CapsuleGeometry
    const torsoGeo = new THREE.CapsuleGeometry(0.14, 0.18, 20, 24)
    torsoGeo.scale(1.06, 1.0, 0.90) // Vai rộng hơn hông một chút
    torsoGeo.computeVertexNormals()
    const torsoMesh = new THREE.Mesh(torsoGeo, this.matRobe)
    torsoMesh.position.y = 0.16
    torsoMesh.castShadow = true
    this.torsoGroup.add(torsoMesh)

    // 2. Cổ áo Áo Tràng truyền thống: Vành cổ tròn đứng thấp viền vàng
    const collarBandGeo = new THREE.TorusGeometry(0.062, 0.005, 8, 28)
    collarBandGeo.rotateX(Math.PI / 2)
    const collarBand = new THREE.Mesh(collarBandGeo, this.matTrim)
    collarBand.position.set(0, 0.28, 0.02)
    this.torsoGroup.add(collarBand)

    // Đường khuy cài chéo Áo Tràng: từ cổ chéo sang nách phải thanh thoát
    const lapelCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.0, 0.28, 0.09),
      new THREE.Vector3(0.04, 0.23, 0.11),
      new THREE.Vector3(0.08, 0.17, 0.11),
      new THREE.Vector3(0.10, 0.10, 0.09)
    )
    const lapelGeo = new THREE.TubeGeometry(lapelCurve, 12, 0.005, 6, false)
    const lapelMesh = new THREE.Mesh(lapelGeo, this.matTrim)
    this.torsoGroup.add(lapelMesh)

    // 3 cúc áo ngọc kim nhỏ cài dọc theo vạt áo
    const buttonGeo = new THREE.SphereGeometry(0.006, 8, 8)
    for (const [bx, by, bz] of [
      [0.025, 0.25, 0.10],
      [0.065, 0.19, 0.11],
      [0.095, 0.13, 0.10]
    ]) {
      const btn = new THREE.Mesh(buttonGeo, this.matTrim)
      btn.position.set(bx, by, bz)
      this.torsoGroup.add(btn)
    }

    // 3. Đai thắt lưng lụa bo tròn ôm lấy eo
    const sashGeo = new THREE.TorusGeometry(0.140, 0.015, 10, 32)
    sashGeo.rotateX(Math.PI / 2)
    const sashMesh = new THREE.Mesh(sashGeo, this.matSash)
    sashMesh.position.y = 0.02
    this.torsoGroup.add(sashMesh)

    // Nơ thắt lụa buông rủ
    const bowGeo = new THREE.SphereGeometry(0.022, 10, 10)
    bowGeo.scale(1.4, 0.8, 0.7)
    const bowMesh = new THREE.Mesh(bowGeo, this.matSash)
    bowMesh.position.set(0, 0.02, 0.145)
    this.torsoGroup.add(bowMesh)

    // Dải lụa thêu buông rủ phía trước
    const ribbonGeo = new THREE.PlaneGeometry(0.028, 0.16, 4, 8)
    const rpos = ribbonGeo.attributes.position
    for (let i = 0; i < rpos.count; i++) {
      const py = rpos.getY(i)
      rpos.setZ(i, Math.sin(py * 16) * 0.006)
    }
    ribbonGeo.computeVertexNormals()
    const ribbon = new THREE.Mesh(ribbonGeo, this.matSash)
    ribbon.position.set(0, -0.06, 0.15)
    this.torsoGroup.add(ribbon)
  }

  /**
   * Cánh tay đối xứng liền mạch:
   * Ống tay áo thụng (Bell Sleeve) mềm mại từ vai xuôi xuống cổ tay, không có các khối u bướu tách rời.
   * Bàn tay mitten nhỏ da đào chắp trước bụng nâng hoa sen vàng.
   */
  private buildChibiArms() {
    // Ống cánh tay trên bo tròn mềm mại
    const upperArmGeo = new THREE.CapsuleGeometry(0.040, 0.10, 14, 16)
    upperArmGeo.computeVertexNormals()

    // Ống tay áo thụng rộng dần ở cổ tay (Bell Sleeve)
    const sleeveGeo = new THREE.CylinderGeometry(0.042, 0.065, 0.13, 20, 1, false)
    sleeveGeo.computeVertexNormals()
    const sleeveTrimGeo = new THREE.TorusGeometry(0.065, 0.004, 6, 20)
    sleeveTrimGeo.rotateX(Math.PI / 2)

    // Bàn tay mitten tròn trịa có ngón cái
    const handGeo = new THREE.SphereGeometry(0.024, 16, 12)
    handGeo.scale(1.0, 1.15, 0.75)
    handGeo.computeVertexNormals()
    const thumbGeo = new THREE.SphereGeometry(0.010, 10, 10)

    // --- TAY TRÁI (Đối xứng) ---
    this.leftArmGroup.position.set(-0.15, 0.25, 0.0)

    const lUpperArm = new THREE.Mesh(upperArmGeo, this.matRobe)
    lUpperArm.position.set(0.02, -0.05, 0.03)
    lUpperArm.rotation.set(0.50, 0.1, -0.30)
    this.leftArmGroup.add(lUpperArm)

    this.leftForearmGroup.position.set(0.035, -0.10, 0.07)

    const lSleeve = new THREE.Mesh(sleeveGeo, this.matRobe)
    lSleeve.position.set(0.03, -0.03, 0.04)
    lSleeve.rotation.set(0.2, 0.45, -0.85)
    this.leftForearmGroup.add(lSleeve)

    const lSleeveTrim = new THREE.Mesh(sleeveTrimGeo, this.matTrim)
    lSleeveTrim.position.set(0.03, -0.03, 0.04)
    lSleeveTrim.rotation.set(0.2, 0.45, -0.85)
    lSleeveTrim.position.y -= 0.065
    this.leftForearmGroup.add(lSleeveTrim)

    // Bàn tay mitten da hồng đào
    const lHand = new THREE.Mesh(handGeo, this.matSkin)
    lHand.position.set(0.07, -0.06, 0.08)
    this.leftForearmGroup.add(lHand)

    const lThumb = new THREE.Mesh(thumbGeo, this.matSkin)
    lThumb.position.set(0.08, -0.05, 0.09)
    this.leftForearmGroup.add(lThumb)

    this.leftArmGroup.add(this.leftForearmGroup)
    this.torsoGroup.add(this.leftArmGroup)

    // --- TAY PHẢI (Đối xứng hoàn hảo) ---
    this.rightArmGroup.position.set(0.15, 0.25, 0.0)

    const rUpperArm = new THREE.Mesh(upperArmGeo, this.matRobe)
    rUpperArm.position.set(-0.02, -0.05, 0.03)
    rUpperArm.rotation.set(0.50, -0.1, 0.30)
    this.rightArmGroup.add(rUpperArm)

    this.rightForearmGroup.position.set(-0.035, -0.10, 0.07)

    const rSleeve = new THREE.Mesh(sleeveGeo, this.matRobe)
    rSleeve.position.set(-0.03, -0.03, 0.04)
    rSleeve.rotation.set(0.2, -0.45, 0.85)
    this.rightForearmGroup.add(rSleeve)

    const rSleeveTrim = new THREE.Mesh(sleeveTrimGeo, this.matTrim)
    rSleeveTrim.position.set(-0.03, -0.03, 0.04)
    rSleeveTrim.rotation.set(0.2, -0.45, 0.85)
    rSleeveTrim.position.y -= 0.065
    this.rightForearmGroup.add(rSleeveTrim)

    // Bàn tay mitten da hồng đào
    const rHand = new THREE.Mesh(handGeo, this.matSkin)
    rHand.position.set(-0.07, -0.06, 0.08)
    this.rightForearmGroup.add(rHand)

    const rThumb = new THREE.Mesh(thumbGeo, this.matSkin)
    rThumb.position.set(-0.08, -0.05, 0.09)
    this.rightForearmGroup.add(rThumb)

    this.rightArmGroup.add(this.rightForearmGroup)
    this.torsoGroup.add(this.rightArmGroup)

    // Đóa Sen Vàng thanh tịnh nâng niu giữa hai tay
    this.lotusFlower.position.set(0, 0.12, 0.19)
    const lotusPetalGeo = new THREE.SphereGeometry(0.022, 12, 10)
    lotusPetalGeo.scale(0.6, 1.4, 0.3)
    const lotusMat = ToonShaderUtils.createToonMaterial({ color: 0xffd166 })

    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2
      const petal = new THREE.Mesh(lotusPetalGeo, lotusMat)
      petal.position.set(Math.cos(angle) * 0.016, 0, Math.sin(angle) * 0.016)
      petal.rotation.y = -angle
      petal.rotation.x = 0.32
      this.lotusFlower.add(petal)
    }

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      ToonShaderUtils.createToonMaterial({ color: 0xffe6a7 })
    )
    this.lotusFlower.add(core)
    this.torsoGroup.add(this.lotusFlower)
  }

  /**
   * Đầu to tròn Chibi:
   * - Cổ ngắn lộ rõ nối liền thân.
   * - Đầu mịn màng 48x36 segments, smooth normals.
   * - Mũ tóc ôm trọn nửa sau hộp sọ, chừa trán 100% tự do + Búi tóc thiền gia có trâm ngọc.
   * - Mặt cong áp sát da đầu, không z-fighting. Mũi nhô 3D rõ ở góc nghiêng.
   */
  private buildChibiHead() {
    // 1. Cổ ngắn capsule lộ rõ nối đầu với thân
    const neckGeo = new THREE.CapsuleGeometry(0.052, 0.06, 16, 16)
    neckGeo.computeVertexNormals()
    const neckMesh = new THREE.Mesh(neckGeo, this.matSkin)
    neckMesh.position.y = 0.01
    this.headPivot.add(neckMesh)

    // 2. Đầu to tròn Chibi (Ellipsoid mịn màng 48x36 segments, smooth normals)
    const headGeo = new THREE.SphereGeometry(this.headRadius, 48, 36)
    headGeo.scale(this.headScale.x, this.headScale.y, this.headScale.z)
    headGeo.computeVertexNormals()
    const headMesh = new THREE.Mesh(headGeo, this.matSkin)
    headMesh.position.y = 0.17
    headMesh.castShadow = true
    this.headPivot.add(headMesh)

    // 3. Khối Mặt & Mũi 3D
    this.faceGroup.position.set(0, 0.17, 0)
    this.headPivot.add(this.faceGroup)

    const rx = this.headRadius * this.headScale.x
    const ry = this.headRadius * this.headScale.y
    const rz = this.headRadius * this.headScale.z

    // Mũi nhô ra 3D rõ ràng (+0.012m so với bề mặt đầu để thấy rõ khi nhìn góc nghiêng)
    const noseGeo = new THREE.SphereGeometry(0.014, 16, 14)
    noseGeo.scale(0.85, 0.75, 1.3)
    noseGeo.computeVertexNormals()
    this.noseMesh = new THREE.Mesh(noseGeo, this.matNose)
    this.noseMesh.position.set(0, -0.012, rz + 0.010)
    this.faceGroup.add(this.noseMesh)

    // Mặt vẽ Texture Atlas biểu cảm: Plane cong ôm sát mặt trước, polygonOffset chống z-fighting
    const faceTex = FaceAtlas.getInstance().texture.clone()
    this.faceMaterial = new THREE.MeshBasicMaterial({
      map: faceTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.FrontSide
    })

    const faceW = 0.22
    const faceH = 0.20
    const faceGeo = new THREE.PlaneGeometry(faceW, faceH, 20, 16)
    const pos = faceGeo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const term = 1 - (x / rx) * (x / rx) - (y / ry) * (y / ry)
      const zCurv = rz * Math.sqrt(Math.max(0, term)) + 0.004
      pos.setZ(i, zCurv)
    }
    faceGeo.computeVertexNormals()

    this.faceMesh = new THREE.Mesh(faceGeo, this.faceMaterial)
    this.faceMesh.renderOrder = 5
    this.faceGroup.add(this.faceMesh)

    // 4. Tai nhỏ nhắn xinh xắn 2 bên
    const earGeo = new THREE.SphereGeometry(0.034, 16, 16)
    earGeo.scale(0.4, 1.1, 0.8)
    earGeo.computeVertexNormals()

    const lEar = new THREE.Mesh(earGeo, this.matSkin)
    lEar.position.set(-rx * 1.01, 0.17, 0.01)
    lEar.rotation.y = -0.2
    this.headPivot.add(lEar)

    const rEar = new THREE.Mesh(earGeo, this.matSkin)
    rEar.position.set(rx * 1.01, 0.17, 0.01)
    rEar.rotation.y = 0.2
    this.headPivot.add(rEar)

    // 5. Tóc Chibi: Mũ tóc sau gáy ôm sát hộp sọ + Búi tóc thiền gia
    this.buildChibiHair()

    // 6. Nón mũ truyền thống
    this.hatGroup.position.set(0, 0.25, -0.01)
    this.headPivot.add(this.hatGroup)
  }

  /**
   * Tóc mới:
   * - Một lớp "mũ tóc" ôm sát hộp sọ (ellipsoid lớn hơn đầu 2.5%), cắt bỏ hoàn toàn mặt trước, chừa trán.
   * - Búi tóc tròn thiền gia phía sau có trâm ngọc bích, nằm trọn trong nón lá, không bao giờ thò ra ngoài.
   */
  private buildChibiHair() {
    this.hairGroup.clear()

    // 1. Mũ tóc sau gáy: ôm trọn nửa sau hộp sọ (phi từ 0.98*PI đến 2.02*PI, tuyệt đối ở phía sau z <= 0)
    // Không thò ra phía trước má hay trán
    const rHair = this.headRadius * 1.025
    const hairCapGeo = new THREE.SphereGeometry(
      rHair,
      48,
      32,
      Math.PI * 0.98,
      Math.PI * 1.04,
      0,
      Math.PI * 0.65
    )
    hairCapGeo.scale(this.headScale.x, this.headScale.y, this.headScale.z)
    hairCapGeo.computeVertexNormals()

    const hairCapMesh = new THREE.Mesh(hairCapGeo, this.matHair)
    hairCapMesh.position.set(0, 0.17, 0)
    hairCapMesh.castShadow = true
    this.hairGroup.add(hairCapMesh)

    // 2. Búi tóc thiền gia tròn gọn phía sau
    const bunGeo = new THREE.SphereGeometry(0.056, 24, 20)
    bunGeo.computeVertexNormals()
    const bun = new THREE.Mesh(bunGeo, this.matHair)
    bun.position.set(0, 0.28, -0.09)
    this.hairGroup.add(bun)

    // Trâm cài tóc ngọc bích xuyên ngang qua búi tóc
    const pinGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.16, 10)
    pinGeo.rotateZ(Math.PI / 2)
    const pin = new THREE.Mesh(
      pinGeo,
      ToonShaderUtils.createToonMaterial({ color: 0x52b788 })
    )
    pin.position.set(0, 0.28, -0.09)
    this.hairGroup.add(pin)

    this.headPivot.add(this.hairGroup)
  }

  /**
   * Cập nhật nón mũ: LatheGeometry cong nhẹ ôm đúng vòng đầu, nghiêng nhẹ 3.5 độ ra sau, quai nón mảnh ôm cằm
   */
  private updateHeadwear(kind: ChibiPalette['hatKind']) {
    this.hatGroup.clear()

    if (kind === 'non_la') {
      // Nón Lá Việt Nam: LatheGeometry độ cong nhẹ tự nhiên, đáy ôm vừa vặn vòng đầu
      const pts: THREE.Vector2[] = []
      const segs = 24
      const nonHeight = 0.15
      for (let i = 0; i <= segs; i++) {
        const t = i / segs
        const y = t * nonHeight
        const r = 0.30 * Math.pow(1 - t, 0.88) + 0.015
        pts.push(new THREE.Vector2(r, y))
      }
      const nonGeo = new THREE.LatheGeometry(pts, 40)
      nonGeo.computeVertexNormals()

      const nonMesh = new THREE.Mesh(nonGeo, this.matHat)
      nonMesh.position.set(0, 0.02, 0)
      nonMesh.rotation.x = -0.06
      nonMesh.castShadow = true
      this.hatGroup.add(nonMesh)

      // Núm vàng chóp nón
      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 10),
        this.matTrim
      )
      finial.position.set(0, 0.17, -0.01)
      this.hatGroup.add(finial)

      // Quai nón mảnh bằng lụa lam ôm dưới cằm
      const strapCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-0.16, 0.02, 0.0),
        new THREE.Vector3(-0.10, -0.12, 0.04),
        new THREE.Vector3(0.10, -0.12, 0.04),
        new THREE.Vector3(0.16, 0.02, 0.0)
      )
      const strapGeo = new THREE.TubeGeometry(strapCurve, 16, 0.004, 6, false)
      const strapMesh = new THREE.Mesh(
        strapGeo,
        ToonShaderUtils.createToonMaterial({ color: 0x6ca3c2 })
      )
      this.hatGroup.add(strapMesh)

      this.hairGroup.visible = true
    } else if (kind === 'kasa_japan') {
      // Nón Kasa Nhật: Vành tròn dẹt cong vòm
      const pts: THREE.Vector2[] = []
      for (let i = 0; i <= 16; i++) {
        const t = i / 16
        const y = Math.cos(t * Math.PI * 0.5) * 0.09
        const r = t * 0.35
        pts.push(new THREE.Vector2(r, y))
      }
      const kasaGeo = new THREE.LatheGeometry(pts, 36)
      kasaGeo.computeVertexNormals()
      const kasa = new THREE.Mesh(kasaGeo, this.matHat)
      kasa.position.set(0, 0.04, 0)
      kasa.castShadow = true
      this.hatGroup.add(kasa)

      this.hairGroup.visible = true
    } else if (kind === 'gat_korea') {
      // Mũ Gat Joseon: Vành dẹt tròn mỏng bán trong suốt + chóp mũ trụ cao bo tròn
      const brimGeo = new THREE.RingGeometry(0.11, 0.34, 36)
      brimGeo.rotateX(-Math.PI / 2)
      const gatMat = new THREE.MeshStandardMaterial({
        color: 0x181818,
        transparent: true,
        opacity: 0.90,
        roughness: 0.5
      })
      const brim = new THREE.Mesh(brimGeo, gatMat)
      brim.position.y = 0.04
      this.hatGroup.add(brim)

      const crownGeo = new THREE.CylinderGeometry(0.09, 0.10, 0.14, 28)
      crownGeo.computeVertexNormals()
      const crown = new THREE.Mesh(crownGeo, gatMat)
      crown.position.y = 0.11
      this.hatGroup.add(crown)

      this.hairGroup.visible = true
    } else if (kind === 'man_velvet') {
      // Mấn Đội Đầu Cổ Phục / Khăn Đóng Nhung
      const manGeo = new THREE.TorusGeometry(0.14, 0.032, 12, 32)
      manGeo.rotateX(Math.PI / 2)
      const man = new THREE.Mesh(manGeo, this.matHat)
      man.position.set(0, 0.04, 0)
      man.scale.set(1.0, 1.12, 0.85)
      this.hatGroup.add(man)

      this.hairGroup.visible = true
    } else if (kind === 'shaved_monk') {
      // Đầu cạo thanh tịnh nhà sư: ẩn tóc, gắn 6 chấm giới hương Jieba trực tiếp trên đỉnh sọ
      this.hairGroup.visible = false
      const dotGeo = new THREE.SphereGeometry(0.006, 8, 8)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      // Đỉnh đầu ở y = 0.17 + 0.18 = 0.35m trong headPivot, hatGroup ở y = 0.25 -> y tương đối = 0.098m
      const positions = [
        [-0.026, 0.098, 0.035],
        [0.026, 0.098, 0.035],
        [-0.026, 0.102, 0.00],
        [0.026, 0.102, 0.00],
        [-0.026, 0.098, -0.035],
        [0.026, 0.098, -0.035]
      ]
      positions.forEach(([x, y, z]) => {
        const dot = new THREE.Mesh(dotGeo, dotMat)
        dot.position.set(x, y, z)
        this.hatGroup.add(dot)
      })
    } else if (kind === 'tibet_cowl') {
      // Mũ Pandita tăng chóp nhọn uốn cong vàng nghệ
      const pts: THREE.Vector2[] = []
      for (let i = 0; i <= 14; i++) {
        const t = i / 14
        const y = (1 - t) * 0.24
        const r = Math.pow(t, 0.8) * 0.16
        pts.push(new THREE.Vector2(r, y))
      }
      const cowlGeo = new THREE.LatheGeometry(pts, 28)
      cowlGeo.computeVertexNormals()
      const cowl = new THREE.Mesh(cowlGeo, this.matTrim)
      cowl.position.set(0, 0.07, -0.02)
      this.hatGroup.add(cowl)

      this.hairGroup.visible = false
    }
  }

  private buildChibiHalo() {
    const haloGeo = new THREE.RingGeometry(0.20, 0.30, 36)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    })
    const haloMesh = new THREE.Mesh(haloGeo, haloMat)
    haloMesh.position.set(0, 0.18, -0.08)
    this.haloGroup.add(haloMesh)
    this.haloGroup.visible = false
    this.headPivot.add(this.haloGroup)
  }

  // ==========================================
  // PUBLIC AVATAR MODEL CONTRACT
  // ==========================================

  public setCountry(country: PilgrimCountry) {
    this.currentCountry = country
    const p = CHIBI_PALETTES[country] || CHIBI_PALETTES.vietnam

    this.matRobe.color.setHex(p.robeColor)
    this.matTrim.color.setHex(p.trimColor)
    this.matInner.color.setHex(p.innerColor)
    this.matSash.color.setHex(p.sashColor)
    this.matSkin.color.setHex(p.skinColor)
    this.matHat.color.setHex(p.hatColor)
    this.matShoes.color.setHex(p.shoesColor)

    this.updateHeadwear(p.hatKind)
  }

  public setOutfitColor(colorHex: number) {
    this.matRobe.color.setHex(colorHex)
  }

  public setExpression(expression: AvatarExpression) {
    this.currentExpression = expression
    if (this.faceMaterial && this.faceMaterial.map) {
      FaceAtlas.getInstance().applyExpressionOffset(this.faceMaterial.map, expression)
    }
  }

  public setBodyShape(shape: AvatarBodyShape) {
    this.currentBodyShape = shape
    if (shape === 'chubby') {
      this.bodyPivot.scale.set(1.15, 0.95, 1.15)
    } else if (shape === 'tall') {
      this.bodyPivot.scale.set(0.92, 1.08, 0.92)
    } else {
      this.bodyPivot.scale.set(1.0, 1.0, 1.0)
    }
  }

  public play(anim: AvatarAnimation) {
    this.currentAnimation = anim
    if (anim === 'bow') {
      this.isBowing = true
      this.bowProgress = 0
    } else if (anim === 'meditate') {
      this.setExpression('meditating')
    } else {
      if (this.currentExpression === 'meditating') {
        this.setExpression('serene')
      }
    }
  }

  /**
   * Cập nhật animation cường điệu phong cách Chibi mềm mại
   */
  public update(delta: number, isMoving = false, moveSpeed = 4.8, worldPos?: THREE.Vector3) {
    this.animTime += delta

    if (this.isBowing) {
      // 1. Cúi lạy Anjali Bow
      this.bowProgress += delta * 1.8
      const angle = Math.sin(Math.min(this.bowProgress, Math.PI)) * 0.45
      this.torsoGroup.rotation.x = angle
      this.headPivot.rotation.x = angle * 0.35
      this.bodyPivot.position.y = -angle * 0.08
      if (this.bowProgress >= Math.PI) {
        this.isBowing = false
        this.torsoGroup.rotation.x = 0
        this.headPivot.rotation.x = 0
        this.bodyPivot.position.y = 0
      }
      return
    }

    if (this.currentAnimation === 'meditate') {
      // 2. Tọa thiền kiết già
      this.haloGroup.visible = true
      this.bodyPivot.position.y = THREE.MathUtils.lerp(this.bodyPivot.position.y, -0.25, delta * 6)
      this.skirtPivot.scale.set(1.22, 0.65, 1.22)
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 1.35, delta * 6)
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 1.35, delta * 6)
      this.headPivot.rotation.z = Math.sin(this.animTime * 1.5) * 0.02
      return
    }

    this.haloGroup.visible = false
    this.skirtPivot.scale.set(1.0, 1.0, 1.0)

    if (isMoving || this.currentAnimation === 'walk') {
      // 3. Waddle Walk (Chibi lắc lư đáng yêu)
      const strideFreq = Math.max(3.8, moveSpeed * 1.8)
      const cycle = this.animTime * strideFreq

      // Chân bước so le
      const stepL = Math.sin(cycle)
      const stepR = -stepL
      this.leftLeg.rotation.x = stepL * 0.62
      this.rightLeg.rotation.x = stepR * 0.62

      // Nhún người và lắc hông (Chibi waddle roll)
      const bob = Math.abs(Math.sin(cycle)) * 0.04
      this.bodyPivot.position.y = -bob
      const roll = Math.sin(cycle) * 0.07
      this.bodyPivot.rotation.z = roll
      this.headPivot.rotation.z = -roll * 0.6

      // Tay đánh nhịp đối xứng
      this.leftArmGroup.rotation.x = stepR * 0.35
      this.rightArmGroup.rotation.x = stepL * 0.35

      // Tà áo đung đưa theo quán tính
      this.skirtPivot.rotation.z = -roll * 0.5
      this.skirtPivot.rotation.x = -Math.abs(stepL) * 0.08
    } else if (this.currentAnimation === 'wave') {
      // 4. Vẫy tay chào vui vẻ
      this.bodyPivot.position.y = Math.sin(this.animTime * 3.0) * 0.02
      this.rightArmGroup.rotation.x = -1.1
      this.rightArmGroup.rotation.z = 0.5 + Math.sin(this.animTime * 8.0) * 0.30
      this.leftArmGroup.rotation.set(0, 0, 0)
      this.leftLeg.rotation.x = 0
      this.rightLeg.rotation.x = 0
      this.headPivot.rotation.z = 0.08
    } else {
      // 5. Idle: Thở nhịp nhàng, đầu lắc nhẹ, hai tay đối xứng nâng hoa sen vàng trước bụng
      const breath = Math.sin(this.animTime * 2.2) * 0.010
      this.torsoGroup.position.y = 0.52 + breath
      this.headPivot.rotation.z = Math.sin(this.animTime * 1.2) * 0.02
      this.headPivot.rotation.y = Math.sin(this.animTime * 0.8) * 0.03
      this.bodyPivot.position.y = THREE.MathUtils.lerp(this.bodyPivot.position.y, 0, delta * 8)
      this.bodyPivot.rotation.z = THREE.MathUtils.lerp(this.bodyPivot.rotation.z, 0, delta * 8)
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8)
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8)
      this.leftArmGroup.rotation.set(0, 0, 0)
      this.rightArmGroup.rotation.set(0, 0, 0)
      this.skirtPivot.rotation.set(0, 0, 0)
    }
  }

  public dispose() {
    this.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.geometry?.dispose()
      }
    })
    if (this.faceMaterial && this.faceMaterial.map) {
      this.faceMaterial.map.dispose()
      this.faceMaterial.dispose()
    }
  }
}
