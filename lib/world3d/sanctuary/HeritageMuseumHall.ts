import * as THREE from 'three'
import { CollisionWorld, BoxCollider } from '../collision'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { createCurvedHipRoof } from '../style/RoofBuilder'
import { createPlaqueTexture } from '../utils/PlaqueTexture'

/**
 * HeritageMuseumHall (Bảo Tàng Di Sản Cổ Tự — CIP-68 NFT Gallery):
 * - Đặt tại phía Tây Đại Hùng Bảo Điện (x = -35.0, z = -9.5), đối xứng hoàn hảo với Nhà Hầu Đồng (x = +35.0, z = -9.5).
 * - Kiến trúc sơn mài & vàng thếp 2 tầng mái cong đầu đao, mở mặt tiền Nam rộng rãi để người chơi đi bộ thẳng vào bên trong.
 * - Trưng bày 8 tác phẩm Thẻ Bài Di Sản Sơn mài & Vàng thếp thật (`/images/cards/*.png`) trên các giá trưng bày 3D
 *   + Bệ trung tâm có Thẻ Bài Di Sản 3D xoay lơ lửng phát ánh sáng vàng thếp/ngọc bích.
 * - Đứng gần bệ trung tâm hoặc bước vào bảo tàng -> bấm [E] mở thẳng Bộ Sưu Tập Thẻ Bài Di Sản & Đúc NFT CIP-68.
 */
const XC = -35.0
const ZC = -9.5
const FLOOR_Y = 0.90
const WALL_H = 5.4
const WALL_T = 0.5
const HALF_W = 9.0 // Rộng 18m
const HALF_D = 8.0 // Sâu 16m

interface FeaturedCardExhibit {
  id: string
  title: string
  country: string
  pos: [number, number] // tọa độ cục bộ (x, z)
  rotY: number
}

const EXHIBITS: FeaturedCardExhibit[] = [
  // Hàng hậu điện (4 kiệt tác Legendary)
  { id: 'card_vn_motcot', title: 'Chùa Một Cột', country: 'VN', pos: [-5.1, -5.8], rotY: 0 },
  { id: 'card_vn_truclam', title: 'Trúc Lâm Yên Tử', country: 'VN', pos: [-1.7, -5.8], rotY: 0 },
  { id: 'card_jp_todaiji', title: 'Đông Đại Tự Todai-ji', country: 'JP', pos: [1.7, -5.8], rotY: 0 },
  { id: 'card_th_watphra', title: 'Chùa Phật Ngọc', country: 'TH', pos: [5.1, -5.8], rotY: 0 },
  // Tường Tây (2 tác phẩm)
  { id: 'card_jp_kinkaku', title: 'Chùa Vàng Kinkaku-ji', country: 'JP', pos: [-7.2, -1.8], rotY: Math.PI / 2 },
  { id: 'card_kr_haeinsa', title: 'Hải Ấn Tự Haeinsa', country: 'KR', pos: [-7.2, 2.2], rotY: Math.PI / 2 },
  // Tường Đông (2 tác phẩm)
  { id: 'card_vn_keo', title: 'Chùa Keo Thái Bình', country: 'VN', pos: [7.2, -1.8], rotY: -Math.PI / 2 },
  { id: 'card_kr_bulguk', title: 'Phật Quốc Tự Bulguksa', country: 'KR', pos: [7.2, 2.2], rotY: -Math.PI / 2 }
]

export class HeritageMuseumHall {
  public group: THREE.Group
  public centerWorldPos = new THREE.Vector3(XC, FLOOR_Y, ZC + 0.5)
  public podiumWorldPos = new THREE.Vector3(XC, FLOOR_Y, ZC + 1.0)
  public proximityRadius = 12.5

  private floatingCardGroup: THREE.Group
  private haloRingMesh: THREE.Mesh
  private ownedMaterials: THREE.Material[] = []
  private ownedTextures: THREE.Texture[] = []
  private ownedGeometries: THREE.BufferGeometry[] = []
  private exhibitNftNodes = new Map<string, { glow: THREE.Mesh; badge: THREE.Mesh }>()

  constructor(collisionWorld?: CollisionWorld) {
    this.group = new THREE.Group()
    this.group.name = 'HeritageMuseumHall'
    this.group.position.set(XC, 0, ZC)

    // 1. Kết cấu kiến trúc tĩnh (nền đá, bậc tam cấp, cột son, tường hậu/hông, mái 2 tầng, lối đá nối sân chính)
    this.group.add(this.buildArchitecture())

    // 2. Hoành phi mặt tiền "BẢO TÀNG DI SẢN CỔ TỰ" + bảng phụ "CARDANO CIP-68 NFT"
    this.buildSignage()

    // 3. 8 Giá trưng bày tranh Sơn mài thật từ /images/cards/*.png
    this.buildExhibits()

    // 4. Bệ trung tâm với Thẻ Bài Di Sản 3D xoay lơ lửng
    const { floatingCard, haloRing } = this.buildCenterPodium()
    this.floatingCardGroup = floatingCard
    this.haloRingMesh = haloRing

    // 5. Đèn nội thất ấm áp (2 PointLight, không đổ bóng để tối ưu FPS)
    const light1 = new THREE.PointLight(0xffcf77, 1.35, 22, 1.6)
    light1.position.set(0, FLOOR_Y + 4.4, -2.0)
    this.group.add(light1)

    const light2 = new THREE.PointLight(0x4ade80, 0.55, 11, 1.8)
    light2.position.set(0, FLOOR_Y + 2.2, 1.2)
    this.group.add(light2)

    if (collisionWorld) {
      this.registerColliders(collisionWorld)
    }
  }

  private buildArchitecture(): THREE.Group {
    const batch = new SlotBatch()
    const stone = (g: THREE.BufferGeometry) => batch.add('stone', g)
    const darkWood = (g: THREE.BufferGeometry) => batch.add('woodDark', g)
    const wood = (g: THREE.BufferGeometry) => batch.add('wood', g)
    const wall = (g: THREE.BufferGeometry) => batch.add('wall', g)
    const gold = (g: THREE.BufferGeometry) => batch.add('gold', g)
    const roof = (g: THREE.BufferGeometry) => batch.add('roof', g)
    const roofDark = (g: THREE.BufferGeometry) => batch.add('roofDark', g)
    const floor = (g: THREE.BufferGeometry) => batch.add('ground', g)
    const lantern = (g: THREE.BufferGeometry) => batch.add('lantern', g)

    // Nền đá 2 cấp
    stone(LowPolyBuilder.box(21.6, 0.45, 19.6).translate(0, 0.225, 0))
    stone(LowPolyBuilder.box(20.0, 0.45, 18.0).translate(0, 0.675, 0))
    // Mặt sàn sơn mài lát gạch
    floor(LowPolyBuilder.box(18.6, 0.06, 16.6).translate(0, FLOOR_Y + 0.02, 0))

    // Bậc tam cấp mặt Nam (5 bậc, mỗi bậc cao 0.18m để nhân vật bước lên mượt mà)
    const steps = 5
    const stepH = FLOOR_Y / steps
    for (let i = 0; i < steps; i++) {
      const y = (i + 1) * stepH - stepH / 2
      const z = HALF_D + 1.1 + (steps - 1 - i) * 0.44
      stone(LowPolyBuilder.box(6.4, stepH, 0.48).translate(0, y, z))
    }
    // Lan can đá hai bên bậc thang
    stone(LowPolyBuilder.box(0.38, 0.72, 2.3).translate(-3.4, 0.42, HALF_D + 1.9))
    stone(LowPolyBuilder.box(0.38, 0.72, 2.3).translate(3.4, 0.42, HALF_D + 1.9))

    // Tường hậu (Bắc) & Tường 2 bên (Đông, Tây) — chừa mặt Nam mở thoáng
    wall(LowPolyBuilder.box(HALF_W * 2, WALL_H, WALL_T).translate(0, FLOOR_Y + WALL_H / 2, -HALF_D + WALL_T / 2))
    wall(LowPolyBuilder.box(WALL_T, WALL_H, HALF_D * 2).translate(-HALF_W + WALL_T / 2, FLOOR_Y + WALL_H / 2, 0))
    wall(LowPolyBuilder.box(WALL_T, WALL_H, HALF_D * 2).translate(HALF_W - WALL_T / 2, FLOOR_Y + WALL_H / 2, 0))

    // Cánh tường mặt tiền 2 bên cửa (chừa cửa chính giữa rộng 7.2m)
    wall(LowPolyBuilder.box(5.2, WALL_H, WALL_T).translate(-6.4, FLOOR_Y + WALL_H / 2, HALF_D - WALL_T / 2))
    wall(LowPolyBuilder.box(5.2, WALL_H, WALL_T).translate(6.4, FLOOR_Y + WALL_H / 2, HALF_D - WALL_T / 2))
    // Xà ngang cửa chính
    darkWood(LowPolyBuilder.box(8.0, 0.55, 0.65).translate(0, FLOOR_Y + WALL_H - 0.35, HALF_D - WALL_T / 2))

    // Hàng cột gỗ son viền chỉ vàng mặt tiền & hiên
    const colXs = [-8.4, -3.7, 3.7, 8.4]
    for (const cx of colXs) {
      wood(LowPolyBuilder.cylinder(0.24, 0.28, WALL_H, 10).translate(cx, FLOOR_Y + WALL_H / 2, HALF_D + 0.35))
      stone(LowPolyBuilder.cylinder(0.34, 0.38, 0.32, 10).translate(cx, FLOOR_Y + 0.16, HALF_D + 0.35))
      gold(LowPolyBuilder.cylinder(0.27, 0.27, 0.14, 10).translate(cx, FLOOR_Y + WALL_H - 0.35, HALF_D + 0.35))
    }

    // 2 Đèn lồng đỏ son treo trước cửa Bảo Tàng (dùng slot 'lantern' chuẩn Palette)
    for (const lx of [-4.2, 4.2]) {
      darkWood(LowPolyBuilder.box(0.06, 0.65, 0.06).translate(lx, FLOOR_Y + WALL_H - 0.5, HALF_D + 0.7))
      lantern(LowPolyBuilder.cylinder(0.28, 0.28, 0.55, 8).translate(lx, FLOOR_Y + WALL_H - 1.05, HALF_D + 0.7))
      gold(LowPolyBuilder.cylinder(0.22, 0.22, 0.08, 8).translate(lx, FLOOR_Y + WALL_H - 0.75, HALF_D + 0.7))
      gold(LowPolyBuilder.cylinder(0.22, 0.22, 0.08, 8).translate(lx, FLOOR_Y + WALL_H - 1.35, HALF_D + 0.7))
    }

    // Helper đảo chiều tam giác để tạo mặt dưới mái (soffit), chống nhìn xuyên từ dưới lên
    const createUnderside = (src: THREE.BufferGeometry, yOffset = -0.02): THREE.BufferGeometry => {
      const dst = src.clone()
      const pos = dst.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i += 3) {
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1)
        const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2)
        pos.setXYZ(i + 1, x2, y2, z2)
        pos.setXYZ(i + 2, x1, y1, z1)
      }
      pos.needsUpdate = true
      dst.translate(0, yOffset, 0)
      dst.computeVertexNormals()
      return dst
    }

    // Mái chồng diêm 2 tầng cong đầu đao chuẩn RoofBuilder (có cả mặt trên & mặt dưới chống nhìn xuyên)
    const roofBaseY = FLOOR_Y + WALL_H
    const lowerRoof = createCurvedHipRoof({
      eaveW: 22.4,
      eaveD: 20.4,
      height: 2.4,
      ridgeW: 13.6,
      ridgeD: 11.8,
      lift: 0.75,
      fascia: 0.32,
      capTop: false
    })
    lowerRoof.translate(0, roofBaseY + 0.1, 0)
    roof(lowerRoof)
    roofDark(createUnderside(lowerRoof, -0.02))
    // Trần gỗ tối che kín lòng nhà phía dưới mái tầng 1
    darkWood(LowPolyBuilder.box(19.6, 0.24, 17.6).translate(0, roofBaseY + 0.04, 0))

    // Cổ diêm tầng trên
    darkWood(LowPolyBuilder.box(13.2, 1.3, 11.4).translate(0, roofBaseY + 2.85, 0))
    gold(LowPolyBuilder.box(13.45, 0.14, 11.65).translate(0, roofBaseY + 3.45, 0))

    const upperRoof = createCurvedHipRoof({
      eaveW: 16.4,
      eaveD: 14.4,
      height: 2.35,
      ridgeW: 6.2,
      ridgeD: 1.4,
      lift: 0.72,
      fascia: 0.28,
      capTop: true
    })
    upperRoof.translate(0, roofBaseY + 3.55, 0)
    roof(upperRoof)
    roofDark(createUnderside(upperRoof, -0.02))

    // Đỉnh nóc hồ lô vàng thếp
    gold(LowPolyBuilder.box(6.0, 0.26, 0.28).translate(0, roofBaseY + 5.95, 0))
    gold(LowPolyBuilder.sphere(0.34, 10, 8).translate(0, roofBaseY + 6.4, 0))

    return batch.build()
  }

  private buildSignage() {
    // Hoành phi chính phía trên cửa Bảo Tàng
    const mainTex = createPlaqueTexture({
      text: 'BẢO TÀNG DI SẢN CỔ TỰ',
      background: '#1a0f0a',
      border: '#d9a441',
      textColor: '#f6cf74',
      width: 1024,
      height: 224,
      resolutionScale: 2,
      maxAnisotropy: 16
    })
    this.ownedTextures.push(mainTex)
    const mainMat = new THREE.MeshBasicMaterial({ map: mainTex })
    this.ownedMaterials.push(mainMat)
    const mainGeo = new THREE.PlaneGeometry(5.8, 1.22)
    this.ownedGeometries.push(mainGeo)
    // Hoành phi chính phía trên cửa Bảo Tàng (đưa ra trước mái hiên một chút để không bị che)
    const mainPlaque = new THREE.Mesh(mainGeo, mainMat)
    mainPlaque.position.set(0, FLOOR_Y + WALL_H - 0.65, HALF_D + 0.75)
    this.group.add(mainPlaque)
  }

  private buildExhibits() {
    const loader = new THREE.TextureLoader()
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.7, metalness: 0.15 })
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.35, metalness: 0.65 })
    const standMat = new THREE.MeshStandardMaterial({ color: 0x26221d, roughness: 0.8 })
    this.ownedMaterials.push(frameMat, goldMat, standMat)

    const backGeo = new THREE.BoxGeometry(2.48, 1.66, 0.12)
    const trimTopGeo = new THREE.BoxGeometry(2.56, 0.08, 0.15)
    const trimSideGeo = new THREE.BoxGeometry(0.08, 1.72, 0.15)
    const artGeo = new THREE.PlaneGeometry(2.28, 1.44)
    const pedestalGeo = new THREE.BoxGeometry(2.3, 0.95, 0.55)
    const labelGeo = new THREE.PlaneGeometry(1.9, 0.34)
    this.ownedGeometries.push(backGeo, trimTopGeo, trimSideGeo, artGeo, pedestalGeo, labelGeo)

    // Tài nguyên dùng chung cho hiệu ứng NFT ON-CHAIN
    const glowGeo = new THREE.BoxGeometry(2.92, 2.08, 0.05)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xf6cf74,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })
    const badgeTex = createPlaqueTexture({
      text: 'NFT ON-CHAIN',
      background: '#100e0c',
      border: '#0ecb81',
      textColor: '#6ee7b7',
      width: 512,
      height: 96,
      resolutionScale: 1.5,
      maxAnisotropy: 8
    })
    this.ownedTextures.push(badgeTex)
    const badgeMat = new THREE.MeshBasicMaterial({ map: badgeTex })
    const badgeGeo = new THREE.PlaneGeometry(1.5, 0.28)
    this.ownedGeometries.push(glowGeo, badgeGeo)
    this.ownedMaterials.push(glowMat, badgeMat)

    for (const ex of EXHIBITS) {
      const stand = new THREE.Group()
      stand.position.set(ex.pos[0], FLOOR_Y, ex.pos[1])
      stand.rotation.y = ex.rotY

      // Bệ gỗ sơn mài dưới tranh
      const ped = new THREE.Mesh(pedestalGeo, standMat)
      ped.position.set(0, 0.475, 0)
      stand.add(ped)

      // Khung tranh sơn mài + viền vàng thếp
      const back = new THREE.Mesh(backGeo, frameMat)
      back.position.set(0, 1.95, 0)
      stand.add(back)

      const tTop = new THREE.Mesh(trimTopGeo, goldMat)
      tTop.position.set(0, 2.79, 0)
      stand.add(tTop)

      const tBot = new THREE.Mesh(trimTopGeo, goldMat)
      tBot.position.set(0, 1.11, 0)
      stand.add(tBot)

      const tLeft = new THREE.Mesh(trimSideGeo, goldMat)
      tLeft.position.set(-1.26, 1.95, 0)
      stand.add(tLeft)

      const tRight = new THREE.Mesh(trimSideGeo, goldMat)
      tRight.position.set(1.26, 1.95, 0)
      stand.add(tRight)

      // Mặt tranh tải trực tiếp ảnh Sơn mài & Vàng thếp thật từ /images/cards/<id>.png
      const tex = loader.load(`/images/cards/${ex.id}.png`)
      tex.colorSpace = THREE.SRGBColorSpace
      this.ownedTextures.push(tex)
      const artMat = new THREE.MeshBasicMaterial({ map: tex })
      this.ownedMaterials.push(artMat)
      const artMesh = new THREE.Mesh(artGeo, artMat)
      artMesh.position.set(0, 1.95, 0.07)
      stand.add(artMesh)

      // Biển tên tác phẩm gắn trên bệ
      const labelTex = createPlaqueTexture({
        text: `${ex.title} (${ex.country})`,
        background: '#100e0c',
        border: '#c9a24b',
        textColor: '#ede4d3',
        width: 512,
        height: 96,
        resolutionScale: 1.5,
        maxAnisotropy: 8
      })
      this.ownedTextures.push(labelTex)
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex })
      this.ownedMaterials.push(labelMat)
      const labelMesh = new THREE.Mesh(labelGeo, labelMat)
      labelMesh.position.set(0, 0.56, 0.29)
      stand.add(labelMesh)

      // Viền sáng vàng kim + huy hiệu "NFT ON-CHAIN" (mặc định ẩn, chỉ bật khi ví đang đăng nhập đã đúc thẻ này thành NFT CIP-68 thật)
      const glow = new THREE.Mesh(glowGeo, glowMat.clone())
      this.ownedMaterials.push(glow.material as THREE.Material)
      glow.position.set(0, 1.95, -0.02)
      glow.visible = false
      stand.add(glow)

      const badge = new THREE.Mesh(badgeGeo, badgeMat)
      badge.position.set(0, 3.12, 0.1)
      badge.visible = false
      stand.add(badge)

      this.exhibitNftNodes.set(ex.id, { glow, badge })

      this.group.add(stand)
    }
  }

  /** Bật viền sáng + huy hiệu NFT cho các khung tranh mà ví đang đăng nhập đã đúc thành NFT CIP-68 thật trên Cardano. */
  public setMintedExhibits(mintedCardIds: Iterable<string>) {
    const minted = new Set(mintedCardIds)
    for (const [cardId, nodes] of this.exhibitNftNodes.entries()) {
      const on = minted.has(cardId)
      nodes.glow.visible = on
      nodes.badge.visible = on
    }
  }

  private buildCenterPodium(): { floatingCard: THREE.Group; haloRing: THREE.Mesh } {
    const podium = new THREE.Group()
    podium.position.set(0, FLOOR_Y, 1.0)

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.65, metalness: 0.2 })
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.3, metalness: 0.7 })
    const emeraldMat = new THREE.MeshBasicMaterial({
      color: 0x0ecb81,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    })
    this.ownedMaterials.push(baseMat, goldMat, emeraldMat)

    // Bệ bát giác trưng bày trung tâm
    const b1Geo = new THREE.CylinderGeometry(1.45, 1.65, 0.28, 8)
    const b2Geo = new THREE.CylinderGeometry(0.95, 1.1, 0.72, 8)
    const rimGeo = new THREE.TorusGeometry(1.02, 0.045, 8, 24)
    const ringGeo = new THREE.RingGeometry(1.75, 2.05, 32)
    this.ownedGeometries.push(b1Geo, b2Geo, rimGeo, ringGeo)

    const b1 = new THREE.Mesh(b1Geo, baseMat)
    b1.position.y = 0.14
    podium.add(b1)

    const b2 = new THREE.Mesh(b2Geo, baseMat)
    b2.position.y = 0.64
    podium.add(b2)

    const rim = new THREE.Mesh(rimGeo, goldMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.01
    podium.add(rim)

    const haloRing = new THREE.Mesh(ringGeo, emeraldMat)
    haloRing.rotation.x = -Math.PI / 2
    haloRing.position.y = 0.085
    podium.add(haloRing)

    // Thẻ Bài Di Sản 3D xoay lơ lửng phía trên bệ (2 mặt ảnh Chùa Một Cột & Trúc Lâm Yên Tử)
    const floatingCard = new THREE.Group()
    floatingCard.position.y = 2.05

    const loader = new THREE.TextureLoader()
    const frontTex = loader.load('/images/cards/card_vn_motcot.png')
    frontTex.colorSpace = THREE.SRGBColorSpace
    const backTex = loader.load('/images/cards/card_vn_truclam.png')
    backTex.colorSpace = THREE.SRGBColorSpace
    this.ownedTextures.push(frontTex, backTex)

    const cardBodyGeo = new THREE.BoxGeometry(1.68, 1.12, 0.08)
    const cardFaceGeo = new THREE.PlaneGeometry(1.56, 1.0)
    this.ownedGeometries.push(cardBodyGeo, cardFaceGeo)

    const frontMat = new THREE.MeshBasicMaterial({ map: frontTex })
    const backMat = new THREE.MeshBasicMaterial({ map: backTex })
    this.ownedMaterials.push(frontMat, backMat)

    const cardBody = new THREE.Mesh(cardBodyGeo, goldMat)
    floatingCard.add(cardBody)

    const frontFace = new THREE.Mesh(cardFaceGeo, frontMat)
    frontFace.position.z = 0.045
    floatingCard.add(frontFace)

    const backFace = new THREE.Mesh(cardFaceGeo, backMat)
    backFace.position.z = -0.045
    backFace.rotation.y = Math.PI
    floatingCard.add(backFace)

    podium.add(floatingCard)
    this.group.add(podium)

    return { floatingCard, haloRing }
  }

  private registerColliders(collisionWorld: CollisionWorld) {
    if (collisionWorld.has('heritage_museum_terrace')) return

    // 1. Mặt sàn Bảo Tàng (walkable floor y = 0.90 — BoxCollider nhận center, size)
    collisionWorld.add(
      new BoxCollider(
        'heritage_museum_terrace',
        new THREE.Vector3(XC, FLOOR_Y * 0.5, ZC),
        new THREE.Vector3(20.4, FLOOR_Y, 18.4),
        false,
        true,
        FLOOR_Y
      )
    )

    // 2. 5 Bậc thang đá mặt Nam (walkable steps)
    const steps = 5
    const stepH = FLOOR_Y / steps
    for (let i = 0; i < steps; i++) {
      const h = (i + 1) * stepH
      const z = ZC + HALF_D + 1.1 + (steps - 1 - i) * 0.44
      collisionWorld.add(
        new BoxCollider(
          `heritage_museum_step_${i}`,
          new THREE.Vector3(XC, h * 0.5, z),
          new THREE.Vector3(6.6, h, 0.52),
          false,
          true,
          h
        )
      )
    }

    // 3. Tường hậu (Bắc)
    collisionWorld.add(
      new BoxCollider(
        'museum_wall_north',
        new THREE.Vector3(XC, FLOOR_Y + WALL_H * 0.5, ZC - HALF_D + 0.3),
        new THREE.Vector3(HALF_W * 2, WALL_H, 0.8),
        false
      )
    )
    // 4. Tường Tây
    collisionWorld.add(
      new BoxCollider(
        'museum_wall_west',
        new THREE.Vector3(XC - HALF_W + 0.3, FLOOR_Y + WALL_H * 0.5, ZC),
        new THREE.Vector3(0.8, WALL_H, HALF_D * 2),
        false
      )
    )
    // 5. Tường Đông
    collisionWorld.add(
      new BoxCollider(
        'museum_wall_east',
        new THREE.Vector3(XC + HALF_W - 0.3, FLOOR_Y + WALL_H * 0.5, ZC),
        new THREE.Vector3(0.8, WALL_H, HALF_D * 2),
        false
      )
    )
    // 6. Hai cánh tường mặt tiền Nam (chừa cửa chính rộng 7.2m)
    collisionWorld.add(
      new BoxCollider(
        'museum_wall_south_w',
        new THREE.Vector3(XC - 6.4, FLOOR_Y + WALL_H * 0.5, ZC + HALF_D - 0.25),
        new THREE.Vector3(5.3, WALL_H, 0.7),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'museum_wall_south_e',
        new THREE.Vector3(XC + 6.4, FLOOR_Y + WALL_H * 0.5, ZC + HALF_D - 0.25),
        new THREE.Vector3(5.3, WALL_H, 0.7),
        false
      )
    )
    // 7. Bệ trưng bày trung tâm
    collisionWorld.add(
      new BoxCollider(
        'museum_center_podium',
        new THREE.Vector3(XC, FLOOR_Y + 1.1, ZC + 1.0),
        new THREE.Vector3(2.4, 2.2, 2.4),
        false
      )
    )
  }

  /** Tính cao độ sàn cho CharacterController khi nhân vật bước lên bậc thang hoặc vào trong Bảo Tàng. */
  public getFloorHeightAt(worldX: number, worldZ: number): number | null {
    const lx = worldX - XC
    const lz = worldZ - ZC
    // Trong lòng sàn Bảo Tàng
    if (lx >= -HALF_W - 0.5 && lx <= HALF_W + 0.5 && lz >= -HALF_D - 0.5 && lz <= HALF_D + 0.9) {
      return FLOOR_Y
    }
    // Trên bậc tam cấp mặt Nam (lz từ HALF_D + 0.9 tới HALF_D + 3.1)
    if (Math.abs(lx) <= 3.3 && lz > HALF_D + 0.9 && lz <= HALF_D + 3.2) {
      const t = 1 - (lz - (HALF_D + 0.9)) / 2.3
      return Math.max(0, Math.min(FLOOR_Y, t * FLOOR_Y))
    }
    return null
  }

  public isPointInside(worldX: number, worldZ: number): boolean {
    const lx = worldX - XC
    const lz = worldZ - ZC
    return Math.abs(lx) <= HALF_W + 1.0 && Math.abs(lz) <= HALF_D + 2.5
  }

  public update(elapsedSec: number) {
    // Xoay nhẹ & nâng hạ Thẻ Bài Di Sản 3D trung tâm
    this.floatingCardGroup.rotation.y = elapsedSec * 0.65
    this.floatingCardGroup.position.y = 2.05 + Math.sin(elapsedSec * 2.0) * 0.12

    // Nhịp thở vòng sáng CIP-68 quanh bệ
    const pulse = 1 + Math.sin(elapsedSec * 2.4) * 0.04
    this.haloRingMesh.scale.set(pulse, pulse, 1)

    // Nhịp thở viền vàng kim của các tác phẩm đã đúc NFT CIP-68
    const glowOpacity = 0.4 + Math.sin(elapsedSec * 3.0) * 0.18
    for (const nodes of this.exhibitNftNodes.values()) {
      if (nodes.glow.visible) {
        ;(nodes.glow.material as THREE.MeshBasicMaterial).opacity = glowOpacity
      }
    }
  }

  public dispose() {
    for (const g of this.ownedGeometries) g.dispose()
    for (const m of this.ownedMaterials) m.dispose()
    for (const t of this.ownedTextures) t.dispose()
  }
}
