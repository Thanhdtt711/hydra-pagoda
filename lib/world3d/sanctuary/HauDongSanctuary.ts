import * as THREE from 'three'
import { CollisionWorld, BoxCollider } from '../collision'
import { LowPolyBuilder, type ColoredPart } from '../style/LowPolyBuilder'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { SlotBatch } from '../style/SlotBatch'
import { createCurvedHipRoof } from '../style/RoofBuilder'
import { createPlaqueTexture } from '../utils/PlaqueTexture'
import { buildPartGeometries, AVATAR_DIMS, type AvatarPalette, type AvatarPartGeometries } from '../characters/AvatarGeometry'

export type HauDongDeityId =
  | 'quan_de_tam'
  | 'chau_doi'
  | 'ong_hoang_muoi'
  | 'co_doi'
  | 'cau_be'
  | 'duc_ong_tran_trieu'
  | 'ong_hoang_bay'

export type HauDongStepId =
  | 'idle'
  | 'countdown'
  | 'costume'
  | 'incense'
  | 'descent'
  | 'dance'
  | 'blessing'
  | 'ascent'
  | 'completed'

export interface HauDongVisualState {
  active: boolean
  sessionType?: string
  sponsorName?: string | null
  stageIndex: number
  totalStages: number
  deityId: HauDongDeityId
  deityName: string
  palaceName: string
  palaceColorHex: number
  stepId: HauDongStepId
  stepLabel: string
  stageElapsedSec: number
}

const XC = 35.0
const ZC = -9.5
const FLOOR_Y = 0.90
const WALL_H = 5.4
const WALL_T = 0.5
const HALF_W = 10.0 // Điện rộng 20m
const HALF_D = 9.0  // Điện sâu 18m

const DEITY_THEME: Record<
  HauDongDeityId,
  {
    robeColor: number
    trimColor: number
    auraColor: number
    headgear: 'quan' | 'chau' | 'hoang' | 'co' | 'cau'
    prop: 'sword' | 'torch' | 'fan' | 'staff'
  }
> = {
  quan_de_tam: {
    robeColor: 0xf4f6f8,
    trimColor: 0xfcd535,
    auraColor: 0xdbeafe,
    headgear: 'quan',
    prop: 'sword'
  },
  chau_doi: {
    robeColor: 0x1f8a5b,
    trimColor: 0xfcd535,
    auraColor: 0x34d399,
    headgear: 'chau',
    prop: 'torch'
  },
  ong_hoang_muoi: {
    robeColor: 0xeab308,
    trimColor: 0xd97706,
    auraColor: 0xfde047,
    headgear: 'hoang',
    prop: 'fan'
  },
  co_doi: {
    robeColor: 0x2eb872,
    trimColor: 0xfef08a,
    auraColor: 0x6ee7b7,
    headgear: 'co',
    prop: 'torch'
  },
  cau_be: {
    robeColor: 0xdc2626,
    trimColor: 0xfcd535,
    auraColor: 0xfbbf24,
    headgear: 'cau',
    prop: 'staff'
  },
  duc_ong_tran_trieu: {
    robeColor: 0xb91c1c,
    trimColor: 0xfcd535,
    auraColor: 0xf87171,
    headgear: 'quan',
    prop: 'sword'
  },
  ong_hoang_bay: {
    robeColor: 0x4c1d95,
    trimColor: 0xfcd535,
    auraColor: 0xa78bfa,
    headgear: 'hoang',
    prop: 'fan'
  }
}

interface DongThayRig {
  root: THREE.Group
  upperPivot: THREE.Group
  skirtPivot: THREE.Group
  skirtBackPivot: THREE.Group
  upperMesh: THREE.Mesh
  skirtMesh: THREE.Mesh
  skirtBackMesh: THREE.Mesh
  leftArmMesh: THREE.Mesh
  rightArmMesh: THREE.Mesh
  leftLegMesh: THREE.Mesh
  rightLegMesh: THREE.Mesh
  mangConGroup: THREE.Group
  mangConMeshes: Record<HauDongDeityId, THREE.Mesh>
  partGeoCache: Record<HauDongDeityId, AvatarPartGeometries>
  headGroup: THREE.Group
  leftArm: THREE.Group
  rightArm: THREE.Group
  leftLeg: THREE.Group
  rightLeg: THREE.Group
  coverScarf: THREE.Group
  headgearGroups: Record<HauDongDeityId, THREE.Group>
  leftProps: Record<'sword' | 'torch' | 'fan' | 'staff' | 'incense', THREE.Group>
  rightProps: Record<'sword' | 'torch' | 'fan' | 'staff' | 'incense', THREE.Group>
}

export class HauDongSanctuary {
  public group: THREE.Group
  public centerWorldPos = new THREE.Vector3(XC, FLOOR_Y, ZC + 1.0)
  public meritBoxWorldPos = new THREE.Vector3(XC + 7.35, FLOOR_Y, ZC + 9.75)
  public proximityRadius = 14.0

  private dongThay!: DongThayRig
  private hauDangList: Array<{ root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group }> = []
  private cungVanList: Array<{ root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group }> = []

  private auraRing!: THREE.Mesh
  private auraMat!: THREE.MeshBasicMaterial
  private spotlightMesh!: THREE.Mesh
  private spotlightMat!: THREE.MeshBasicMaterial
  private blessingOrbs: THREE.Mesh[] = []

  private scrollCanvas!: HTMLCanvasElement
  private scrollTexture!: THREE.CanvasTexture
  private lastBannerKey = ''
  private currentDeity: HauDongDeityId = 'quan_de_tam'

  constructor(collisionWorld?: CollisionWorld) {
    this.group = new THREE.Group()
    this.group.name = 'HauDongSanctuary'
    this.group.position.set(XC, 0, ZC)

    this.group.add(this.buildArchitecture())
    this.buildSignboards()
    this.buildRitualStageEffects()
    this.buildNpcCast()

    if (collisionWorld) {
      this.registerColliders(collisionWorld)
    }
  }

  private buildArchitecture(): THREE.Group {
    const b = new SlotBatch()

    // 1. Thềm Điện Thờ Tứ Phủ (22m x 20.8m, có hiên trước rộng rãi tới z = +10.8, cao 0.90m)
    b.box('stone', 22.0, FLOOR_Y, 20.8, 0, FLOOR_Y * 0.5, 0.4)
    b.box('woodDark', 19.2, 0.04, 17.2, 0, FLOOR_Y + 0.02, 0)

    // 2. 5 Bậc thang đá mặt Nam cân đối chính giữa mặt tiền (từ z = +10.8 đến z = +13.05)
    const steps = 5
    const stepH = FLOOR_Y / steps // 0.18m
    const stepD = 0.45
    for (let i = 0; i < steps; i++) {
      const h = stepH * (steps - i)
      const z = 10.8 + stepD * (i + 0.5)
      b.box('stone', 8.4, h, stepD, 0, h * 0.5, z)
    }
    // Lan can rồng đá hai bên bậc thang
    for (const sx of [-4.4, 4.4]) {
      b.box('stone', 0.4, FLOOR_Y + 0.35, 2.3, sx, (FLOOR_Y + 0.35) * 0.5, 11.95)
      b.sphere('gold', 0.18, 0, sx, FLOOR_Y + 0.48, 12.95)
    }

    // 3. Hệ thống Tường & Cột góc (tách mặt phẳng hoàn toàn để KHÔNG Z-fighting)
    const wallH = WALL_H - 0.36
    const wallMidY = FLOOR_Y + wallH * 0.5
    const backZ = -(HALF_D - WALL_T * 0.5)  // -8.75
    const frontZ = HALF_D - WALL_T * 0.5   // +8.75
    const sideX = HALF_W - WALL_T * 0.5    // 9.75

    // Tường hậu (Bắc) và 2 tường hông (Đông - Tây), dừng cách cột góc 0.45m
    b.box('wall', (HALF_W - 0.45) * 2, wallH, WALL_T, 0, wallMidY, backZ)
    b.box('wall', WALL_T, wallH, (HALF_D - 0.45) * 2, -sideX, wallMidY, 0)
    b.box('wall', WALL_T, wallH, (HALF_D - 0.45) * 2, sideX, wallMidY, 0)

    // Tường mặt tiền (Nam): Mở rộng 3 cửa võng lớn ở giữa (-5.6 .. +5.6), chỉ xây 2 cánh tường hai bên
    b.box('wall', 3.6, wallH, WALL_T, -7.4, wallMidY, frontZ)
    b.box('wall', 3.6, wallH, WALL_T, 7.4, wallMidY, frontZ)
    // Xà ngang khung cửa & Lanh tô phía trên 3 gian cửa chính
    b.box('woodDark', 11.4, 0.28, 0.62, 0, FLOOR_Y + 3.68, frontZ)
    b.box('wall', 11.2, 1.18, WALL_T, 0, FLOOR_Y + 4.41, frontZ)
    // Khung gỗ lim đỡ biển hoành phi mặt tiền và cuốn thư trong điện
    b.box('woodDark', 5.36, 1.38, 0.14, 0, FLOOR_Y + 4.35, frontZ + 0.30)
    b.box('woodDark', 4.76, 1.25, 0.12, 0, FLOOR_Y + 3.65, -3.47)

    // 4 Cột góc gỗ lim (0.64m x 0.64m, nhô ra ngoài mặt tường 7cm để không trùng mặt phẳng)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box('woodDark', 0.64, wallH, 0.64, sx * 9.75, wallMidY, sz * 8.75)
      }
    }
    // 4 Trụ cửa mặt tiền sơn son thếp vàng
    for (const cx of [-5.4, -1.9, 1.9, 5.4]) {
      b.cylinder('stone', 0.34, 0.40, 0.24, 8, cx, FLOOR_Y + 0.12, frontZ)
      b.cylinder('wood', 0.24, 0.27, 3.30, 8, cx, FLOOR_Y + 0.24 + 1.65, frontZ)
      // Cửa võng vàng treo trên đầu cột
      b.box('gold', 0.22, 0.42, 0.64, cx, FLOOR_Y + 3.35, frontZ)
    }
    // Dầm cổ diềm đỉnh tường
    b.box('woodDark', HALF_W * 2 + 0.2, 0.36, 0.66, 0, FLOOR_Y + WALL_H - 0.18, frontZ)
    b.box('woodDark', HALF_W * 2 + 0.2, 0.36, 0.66, 0, FLOOR_Y + WALL_H - 0.18, backZ)
    b.box('woodDark', 0.66, 0.36, HALF_D * 2 - 1.2, -sideX, FLOOR_Y + WALL_H - 0.18, 0)
    b.box('woodDark', 0.66, 0.36, HALF_D * 2 - 1.2, sideX, FLOOR_Y + WALL_H - 0.18, 0)

    // 5. Mái chồng diêm 2 tầng cong đao cổ truyền
    const lowerRoof = createCurvedHipRoof({
      eaveW: 23.2,
      eaveD: 21.0,
      height: 2.0,
      ridgeW: 13.5,
      ridgeD: 10.0,
      lift: 0.75,
      capTop: false
    })
    b.add('roof', lowerRoof, { position: [0, FLOOR_Y + WALL_H - 0.05, 0] }, true)

    // Cổ diềm giữa 2 tầng mái (tách mặt phẳng)
    b.box('wall', 13.2, 1.1, 9.6, 0, FLOOR_Y + WALL_H + 2.1, 0)
    b.box('woodDark', 13.6, 0.24, 10.0, 0, FLOOR_Y + WALL_H + 2.75, 0)

    const upperRoof = createCurvedHipRoof({
      eaveW: 17.2,
      eaveD: 14.0,
      height: 1.9,
      ridgeW: 8.8,
      ridgeD: 2.4,
      lift: 0.68,
      capTop: true
    })
    b.add('roof', upperRoof, { position: [0, FLOOR_Y + WALL_H + 2.7, 0] }, true)

    // Chóp hồ lô & đao vàng trên nóc điện
    for (const sx of [-1, 1]) {
      b.cone('gold', 0.24, 0.75, 6, sx * 4.4, FLOOR_Y + WALL_H + 4.85, 0)
    }

    // 6. CUNG CẤM & BAN CÔNG ĐỒNG TỨ PHỦ (Phía Bắc hậu cung: z = -6.2)
    b.box('stone', 8.4, 0.55, 3.2, 0, FLOOR_Y + 0.275, -6.4)
    b.box('woodDark', 7.8, 0.45, 2.4, 0, FLOOR_Y + 0.55 + 0.225, -6.6)
    b.box('gold', 7.9, 0.08, 2.5, 0, FLOOR_Y + 1.04, -6.6)
    // Đôi lộc bình & chân nến đồng trên Ban Tam Tòa
    for (const sx of [-3.3, 3.3]) {
      b.cylinder('gold', 0.14, 0.22, 0.65, 8, sx, FLOOR_Y + 1.40, -6.2)
      b.sphere('roof', 0.22, 1, sx, FLOOR_Y + 1.82, -6.2)
    }

    // Bàn thờ Công Đồng & Lư hương đồng trước Cung Cấm (z = -4.2)
    b.box('woodDark', 4.2, 0.85, 1.1, 0, FLOOR_Y + 0.425, -4.2)
    b.box('gold', 4.3, 0.08, 1.18, 0, FLOOR_Y + 0.88, -4.2)
    b.cylinder('gold', 0.26, 0.32, 0.38, 8, 0, FLOOR_Y + 1.1, -4.2)
    for (const sx of [-1.45, 1.45]) {
      b.cylinder('gold', 0.08, 0.14, 0.42, 6, sx, FLOOR_Y + 1.12, -4.2)
    }
    // Khám thờ Ngũ Hổ dưới hạ ban
    b.box('gold', 1.2, 0.42, 0.3, 0, FLOOR_Y + 0.24, -3.62)

    // 7. BAN ĐỨC THÁNH TRẦN (Gian Tả / Bên Trái: x = -6.6, z = -5.6)
    b.box('stone', 3.4, 0.45, 2.2, -6.6, FLOOR_Y + 0.225, -5.6)
    b.box('woodDark', 3.0, 0.45, 1.8, -6.6, FLOOR_Y + 0.675, -5.6)
    b.box('gold', 3.1, 0.06, 1.88, -6.6, FLOOR_Y + 0.92, -5.6)
    b.cylinder('gold', 0.18, 0.22, 0.28, 8, -6.6, FLOOR_Y + 1.08, -4.95)

    // 8. BAN SƠN TRANG / CHẦU BÀ (Gian Hữu / Bên Phải: x = +6.6, z = -5.6)
    b.box('stone', 3.4, 0.45, 2.2, 6.6, FLOOR_Y + 0.225, -5.6)
    b.box('woodDark', 3.0, 0.45, 1.8, 6.6, FLOOR_Y + 0.675, -5.6)
    b.box('gold', 3.1, 0.06, 1.88, 6.6, FLOOR_Y + 0.92, -5.6)
    b.cylinder('gold', 0.18, 0.22, 0.28, 8, 6.6, FLOOR_Y + 1.08, -4.95)

    // 9. CHIẾU HẦU TRUNG TÂM (5.0m x 3.8m tại tâm (0, FLOOR_Y, 0.4))
    b.box('gold', 5.2, 0.04, 4.0, 0, FLOOR_Y + 0.04, 0.4)
    b.box('roof', 4.8, 0.05, 3.6, 0, FLOOR_Y + 0.065, 0.4)

    // 10. KHU CUNG VĂN (Bên Tả Chiếu Hầu: x = -4.6, z = 0.4) & KHU TRÁP LỘC (Bên Hữu: x = +4.6, z = 0.4)
    b.box('wood', 2.4, 0.05, 3.4, -4.5, FLOOR_Y + 0.05, 0.4)
    b.box('wood', 2.4, 0.05, 3.4, 4.5, FLOOR_Y + 0.05, 0.4)
    // Tráp đựng khăn áo & mâm lộc bên hữu
    b.box('woodDark', 0.9, 0.55, 0.6, 5.2, FLOOR_Y + 0.32, -0.5)
    b.box('gold', 0.7, 0.25, 0.5, 5.2, FLOOR_Y + 0.72, -0.5)

    // 11. HÒM CÔNG ĐỨC MỞ ĐÀN (Đặt độc lập ngoài hiên phải mặt tiền: local x = +7.35, z = +9.75, tách hoàn toàn khỏi tường & cột)
    b.box('woodDark', 1.45, 1.15, 1.0, 7.35, FLOOR_Y + 0.58, 9.75)
    b.box('gold', 1.52, 0.08, 1.06, 7.35, FLOOR_Y + 1.20, 9.75)
    b.box('gold', 0.46, 0.05, 0.04, 7.35, FLOOR_Y + 0.95, 10.27)

    // 12. Đèn lồng Tứ Phủ treo trong điện
    for (const lx of [-6.2, -2.8, 2.8, 6.2]) {
      for (const lz of [-2.2, 3.2]) {
        b.cylinder('woodDark', 0.02, 0.02, 1.1, 4, lx, FLOOR_Y + 4.6, lz)
        b.addEmissive('lantern', LowPolyBuilder.box(0.45, 0.65, 0.45), { position: [lx, FLOOR_Y + 3.8, lz] })
      }
    }

    return b.build({ name: 'hau_dong_static', castShadow: true, receiveShadow: true })
  }

  private buildSignboards() {
    const frontZ = HALF_D - WALL_T * 0.5 // +8.75

    // 1. Hoành phi chính mặt tiền: "NHÀ HẦU ĐỒNG · ĐIỆN TỨ PHỦ" (đặt trên khung gỗ dưới diềm mái hiên, chuẩn như Đại Hùng Bảo Điện)
    const mainTex = createPlaqueTexture({
      text: 'NHÀ HẦU ĐỒNG · ĐIỆN TỨ PHỦ',
      background: '#1a0f0a',
      border: '#d9a441',
      textColor: '#f6cf74',
      width: 1024,
      height: 256
    })
    const mainMat = new THREE.MeshBasicMaterial({ map: mainTex })
    const mainPlaque = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), mainMat)
    mainPlaque.position.set(0, FLOOR_Y + 4.35, frontZ + 0.38)
    mainPlaque.name = 'hau_dong_main_plaque'
    this.group.add(mainPlaque)

    // 2. Bảng gắn trên Hòm Công Đức Mở Đàn (hiên phải mặt tiền)
    const boxTex = createPlaqueTexture({
      text: 'MỞ ĐÀN HẦU ĐỒNG',
      background: '#1a0f0a',
      border: '#d9a441',
      textColor: '#f6cf74',
      width: 512,
      height: 160
    })
    const boxMat = new THREE.MeshBasicMaterial({ map: boxTex })
    const boxPlaque = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.36), boxMat)
    boxPlaque.position.set(7.35, FLOOR_Y + 0.65, 10.28)
    this.group.add(boxPlaque)

    // 3. Cuốn Thư Vàng Động phía trên Chiếu Hầu (hiển thị Giá Đồng đang ngự & Tên Thí Chủ, tự co chữ vừa khung)
    this.scrollCanvas = document.createElement('canvas')
    this.scrollCanvas.width = 1024
    this.scrollCanvas.height = 256
    this.scrollTexture = new THREE.CanvasTexture(this.scrollCanvas)
    this.scrollTexture.colorSpace = THREE.SRGBColorSpace
    this.scrollTexture.generateMipmaps = true
    this.scrollTexture.minFilter = THREE.LinearMipmapLinearFilter
    this.scrollTexture.magFilter = THREE.LinearFilter
    this.scrollTexture.anisotropy = 8

    const scrollMat = new THREE.MeshBasicMaterial({ map: this.scrollTexture })
    const scrollMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), scrollMat)
    scrollMesh.position.set(0, FLOOR_Y + 3.65, -3.4)
    this.group.add(scrollMesh)

    this.renderScrollBanner(
      'ĐIỆN THỜ TỨ PHỦ & ĐỨC THÁNH TRẦN',
      'Lịch hầu: Mồng 1 & Rằm Âm lịch · Mở đàn đặc cách: 2,500 MC',
      'Đứng xem & Chắp tay dự lễ để thỉnh lộc MC'
    )
  }

  private renderScrollBanner(line1: string, line2: string, line3: string) {
    const key = `${line1}|${line2}|${line3}`
    if (key === this.lastBannerKey) return
    this.lastBannerKey = key

    const ctx = this.scrollCanvas.getContext('2d')
    if (!ctx) return

    const W = 1024
    const H = 256
    ctx.fillStyle = '#1a0f0a'
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = '#d9a441'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, W - 20, H - 20)
    ctx.lineWidth = 3
    ctx.strokeRect(22, 22, W - 44, H - 44)

    const drawFittedLine = (text: string, y: number, maxFontPx: number, color: string, serif = false) => {
      const family = serif ? '"Noto Serif", "Times New Roman", serif' : '"Inter", system-ui, sans-serif'
      const maxW = W - 96 // chừa 48px mỗi bên để không bao giờ tràn viền
      let size = maxFontPx
      ctx.font = `bold ${size}px ${family}`
      const measured = ctx.measureText(text).width
      if (measured > maxW && measured > 0) {
        size = Math.max(15, Math.floor(size * (maxW / measured)))
        ctx.font = `bold ${size}px ${family}`
      }
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = 4
      ctx.fillText(text, W / 2, y, maxW)
    }

    drawFittedLine(line1, 70, 42, '#f6cf74', true)
    drawFittedLine(line2, 136, 32, '#fef08a', false)
    drawFittedLine(line3, 196, 26, '#e5e7eb', false)

    this.scrollTexture.needsUpdate = true
  }

  private buildRitualStageEffects() {
    // Vòng hào quang Tứ Phủ trên mặt Chiếu Hầu
    const ringGeo = new THREE.RingGeometry(1.35, 1.85, 32)
    ringGeo.rotateX(-Math.PI / 2)
    this.auraMat = new THREE.MeshBasicMaterial({
      color: 0xfcd535,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    })
    this.auraRing = new THREE.Mesh(ringGeo, this.auraMat)
    this.auraRing.position.set(0, FLOOR_Y + 0.11, 0.4)
    this.group.add(this.auraRing)

    // Cột sáng Spotlight mờ chiếu xuống Chiếu Hầu khi Thánh giáng
    const coneGeo = new THREE.ConeGeometry(2.1, 4.2, 16, 1, true)
    this.spotlightMat = new THREE.MeshBasicMaterial({
      color: 0xfcd535,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    this.spotlightMesh = new THREE.Mesh(coneGeo, this.spotlightMat)
    this.spotlightMesh.position.set(0, FLOOR_Y + 2.2, 0.4)
    this.group.add(this.spotlightMesh)

    // 8 Túi Lộc Vàng (Orbs) bay ra ở Bước 5 (Ban lộc)
    const orbGeo = new THREE.OctahedronGeometry(0.14, 0)
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xfcd535 })
    for (let i = 0; i < 8; i++) {
      const orb = new THREE.Mesh(orbGeo, orbMat)
      orb.visible = false
      this.group.add(orb)
      this.blessingOrbs.push(orb)
    }
  }

  private buildNpcCast() {
    // 0. 5 Pho Tượng Thánh Chibi Low-Poly trên Ban Tam Tòa, Ban Trần Triều & Ban Sơn Trang
    this.buildAltarStatues()

    // 1. NPC Đồng Thầy chính giữa Chiếu Hầu (0, FLOOR_Y + 0.09, 0.4)
    this.dongThay = this.createDongThayRig()
    this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.4)
    this.group.add(this.dongThay.root)
    this.applyDeityCostume('quan_de_tam')

    // 2. 4 NPC Tứ Trụ Hầu Dâng ngồi 4 góc Chiếu Hầu (2 Nam Hầu Dâng áo ngũ thân lam sẫm & 2 Nữ Hầu Dâng áo ngũ thân nâu đỏ trầm)
    const hauDangConfigs: Array<{
      x: number
      z: number
      rotY: number
      robeHex: number
      trimHex: number
      gender: 'male' | 'female'
    }> = [
      { x: -1.85, z: -0.7, rotY: Math.PI * 0.25, robeHex: 0x1e3a5f, trimHex: 0xe5ae38, gender: 'male' },
      { x: 1.85, z: -0.7, rotY: -Math.PI * 0.25, robeHex: 0x1e3a5f, trimHex: 0xe5ae38, gender: 'male' },
      { x: -1.85, z: 1.4, rotY: Math.PI * 0.75, robeHex: 0x5c2323, trimHex: 0xe5ae38, gender: 'female' },
      { x: 1.85, z: 1.4, rotY: -Math.PI * 0.75, robeHex: 0x5c2323, trimHex: 0xe5ae38, gender: 'female' }
    ]
    for (const cfg of hauDangConfigs) {
      const npc = this.createSeatedHelperNpc(cfg.robeHex, cfg.trimHex, 'tray', cfg.gender)
      npc.root.position.set(cfg.x, FLOOR_Y + 0.09, cfg.z)
      npc.root.rotation.y = cfg.rotY
      this.group.add(npc.root)
      this.hauDangList.push(npc)
    }

    // 3. 3 NPC Cung Văn Nam giới ngồi bên Tả Chiếu Hầu (mặc áo dài the đen truyền thống, quần trắng, khăn xếp đen)
    const cungVanConfigs: Array<{ z: number; role: 'lute' | 'clapper' | 'drum' }> = [
      { z: -0.65, role: 'lute' },
      { z: 0.40, role: 'clapper' },
      { z: 1.45, role: 'drum' }
    ]
    for (const cfg of cungVanConfigs) {
      const npc = this.createSeatedHelperNpc(0x222730, 0xd4a017, cfg.role, 'male')
      npc.root.position.set(-4.35, FLOOR_Y + 0.09, cfg.z)
      npc.root.rotation.y = Math.PI * 0.5
      this.group.add(npc.root)
      this.cungVanList.push(npc)
    }
  }

  private buildAltarStatues() {
    const mauY = FLOOR_Y + 1.08
    // Tam Tòa Thánh Mẫu trong Cung Cấm (3 vị Nữ Thần tối cao):
    // 1. Mẫu Đệ Nhất Thượng Thiên (Chính giữa - Áo Đỏ, Mão Phượng Vàng)
    const mauDeNhat = this.createSacredStatue({
      robeHex: 0xc81e1e,
      trimHex: 0xfcd535,
      pantsHex: 0xfef08a,
      crownType: 'mau_phoenix',
      gender: 'female',
      scale: 1.24
    })
    mauDeNhat.position.set(0, mauY, -6.62)
    this.group.add(mauDeNhat)

    // 2. Mẫu Đệ Nhị Thượng Ngàn (Bên Tả - Áo Xanh Lục Bảo, Mão Phượng / Khăn Chầu Xanh)
    const mauDeNhi = this.createSacredStatue({
      robeHex: 0x15803d,
      trimHex: 0xfcd535,
      pantsHex: 0xdcfce7,
      crownType: 'mau_phoenix',
      gender: 'female',
      scale: 1.14
    })
    mauDeNhi.position.set(-2.15, mauY, -6.62)
    this.group.add(mauDeNhi)

    // 3. Mẫu Đệ Tam Thoải Phủ (Bên Hữu - Áo Trắng Tinh Khôi, Mão Phượng Kim Tuyến)
    const mauDeTam = this.createSacredStatue({
      robeHex: 0xf8fafc,
      trimHex: 0xfcd535,
      pantsHex: 0xe0f2fe,
      crownType: 'mau_phoenix',
      gender: 'female',
      scale: 1.14
    })
    mauDeTam.position.set(2.15, mauY, -6.62)
    this.group.add(mauDeTam)

    // 4. Đức Thánh Trần Hưng Đạo Đại Vương (Gian Tả: x = -6.6, z = -5.65 - Nam Thần Vương Gia uy vũ có râu dài, Áo Bào Đỏ Thẫm, Mũ Vương Gia)
    const ducThanhTran = this.createSacredStatue({
      robeHex: 0x991b1b,
      trimHex: 0xfcd535,
      pantsHex: 0xfef08a,
      crownType: 'vuong_crown',
      gender: 'male',
      beard: true,
      scale: 1.16
    })
    ducThanhTran.position.set(-6.6, FLOOR_Y + 0.94, -5.65)
    this.group.add(ducThanhTran)

    // 5. Chầu Bà Sơn Trang (Gian Hữu: x = +6.6, z = -5.65 - Nữ Thần Sơn Trang, Áo Lam Rừng, Khăn Chầu Sơn Trang)
    const chauSonTrang = this.createSacredStatue({
      robeHex: 0x0f766e,
      trimHex: 0xfcd535,
      pantsHex: 0xccfbf1,
      crownType: 'chau_turban',
      gender: 'female',
      scale: 1.16
    })
    chauSonTrang.position.set(6.6, FLOOR_Y + 0.94, -5.65)
    this.group.add(chauSonTrang)
  }

  private createSacredStatue(opts: {
    robeHex: number
    trimHex: number
    pantsHex: number
    crownType: 'mau_phoenix' | 'vuong_crown' | 'chau_turban'
    gender: 'male' | 'female'
    beard?: boolean
    scale: number
  }): THREE.Group {
    const root = new THREE.Group()
    const mat = FlatMaterialFactory.getInstance().vertexColor()

    // 1. Đài Sen Vàng 2 lớp cánh (Golden Lotus Throne)
    const lotusParts: ColoredPart[] = [
      { geometry: LowPolyBuilder.cylinder(0.46, 0.54, 0.14, 12), color: 0xd97706, position: [0, 0.07, 0] },
      { geometry: LowPolyBuilder.cylinder(0.52, 0.44, 0.12, 12), color: 0xfcd535, position: [0, 0.18, 0] },
      { geometry: LowPolyBuilder.cylinder(0.42, 0.46, 0.06, 12), color: 0xfef08a, position: [0, 0.26, 0] }
    ]
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      lotusParts.push({
        geometry: LowPolyBuilder.cone(0.14, 0.22, 5),
        color: i % 2 === 0 ? 0xfcd535 : 0xf59e0b,
        position: [Math.cos(a) * 0.44, 0.20, Math.sin(a) * 0.44],
        rotation: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]
      })
    }
    const lotusMesh = new THREE.Mesh(LowPolyBuilder.mergeColored(lotusParts), mat)
    lotusMesh.castShadow = true
    lotusMesh.receiveShadow = true
    root.add(lotusMesh)

    // 2. Thân & Gương mặt Chibi Low-Poly đúng giới tính và màu da sáng hồng hào trang nghiêm
    const palette: AvatarPalette = {
      style: opts.gender === 'male' ? 'ao_duong' : 'ao_nhat_binh',
      robeColor: opts.robeHex,
      trimColor: opts.trimHex,
      innerColor: opts.pantsHex,
      sashColor: opts.trimHex,
      skinColor: opts.gender === 'male' ? 0xf7d6ba : 0xfbe0c8,
      hatKind: 'none',
      hatColor: opts.trimHex,
      hairKind: opts.gender === 'male' ? 'short' : 'bun',
      hairColor: 0x18181e,
      shoesColor: 0x2a2321,
      blushColor: 0xf4929c,
      gender: opts.gender,
      beard: opts.beard
    }
    const geos = buildPartGeometries(palette)
    const figure = new THREE.Group()
    figure.position.y = 0.26

    const upperPivot = new THREE.Group()
    upperPivot.position.y = 0.16
    const upperMesh = new THREE.Mesh(geos.upper, mat)
    upperMesh.castShadow = true
    upperPivot.add(upperMesh)

    // Mạng Cồn (Vân Kiên) & Hào quang lưng tượng (AVATAR_DIMS.headCenterY đã là tọa độ trong upperPivot!)
    const adornParts = this.buildMangConParts(opts.robeHex, opts.trimHex)
    const haloCenterY = AVATAR_DIMS.headCenterY + 0.04
    adornParts.push(
      {
        geometry: LowPolyBuilder.cylinder(0.42, 0.42, 0.03, 16),
        color: 0xfcd535,
        position: [0, haloCenterY, -0.26],
        rotation: [Math.PI * 0.5, 0, 0]
      },
      {
        geometry: LowPolyBuilder.cylinder(0.34, 0.34, 0.035, 16),
        color: 0xfef08a,
        position: [0, haloCenterY, -0.255],
        rotation: [Math.PI * 0.5, 0, 0]
      },
      // Lệnh bài / Hốt ngọc cầm trước ngực
      {
        geometry: LowPolyBuilder.box(0.08, 0.24, 0.03),
        color: 0xfef08a,
        position: [0, 0.26, 0.22],
        rotation: [-0.25, 0, 0]
      }
    )
    const adornMesh = new THREE.Mesh(LowPolyBuilder.mergeColored(adornParts), mat)
    upperPivot.add(adornMesh)

    // Mão Thánh Mẫu / Mũ Vương Gia / Khăn Chầu đặt đúng trên đỉnh đầu tượng (y = AVATAR_DIMS.headCenterY)
    const headY = AVATAR_DIMS.headCenterY
    const crownGroup = this.buildHeadgearMesh(
      opts.crownType === 'vuong_crown' ? 'quan' : opts.crownType === 'chau_turban' ? 'chau' : 'mau',
      opts.robeHex,
      opts.trimHex,
      mat
    )
    crownGroup.position.set(0, headY, 0)
    upperPivot.add(crownGroup)

    // Vạt áo trải trên đài sen
    const skirtPivot = new THREE.Group()
    skirtPivot.rotation.x = -0.35
    skirtPivot.add(new THREE.Mesh(geos.skirt, mat))
    upperPivot.add(skirtPivot)

    // Hai tay chắp ấn / cầm hốt trước ngực
    const armL = new THREE.Group()
    armL.position.set(-AVATAR_DIMS.shoulderX, AVATAR_DIMS.shoulderY, 0)
    armL.rotation.set(-0.68, 0, -0.35)
    armL.add(new THREE.Mesh(geos.armL, mat))
    upperPivot.add(armL)

    const armR = new THREE.Group()
    armR.position.set(AVATAR_DIMS.shoulderX, AVATAR_DIMS.shoulderY, 0)
    armR.rotation.set(-0.68, 0, 0.35)
    armR.add(new THREE.Mesh(geos.armR, mat))
    upperPivot.add(armR)

    figure.add(upperPivot)

    // Hai chân xếp bằng kiết già trên đài sen
    const legL = new THREE.Group()
    legL.position.set(-AVATAR_DIMS.legX, 0.16, 0.08)
    legL.rotation.set(-1.35, 0, 0.55)
    legL.add(new THREE.Mesh(geos.legL, mat))
    figure.add(legL)

    const legR = new THREE.Group()
    legR.position.set(AVATAR_DIMS.legX, 0.16, 0.08)
    legR.rotation.set(-1.35, 0, -0.55)
    legR.add(new THREE.Mesh(geos.legR, mat))
    figure.add(legR)

    root.add(figure)
    root.scale.setScalar(opts.scale)
    return root
  }

  private buildMangConParts(robeHex: number, trimHex: number): ColoredPart[] {
    const sy = AVATAR_DIMS.shoulderY // ~0.473m trong không gian upperPivot
    return [
      // Mạng Cồn (Vân Kiên 4 cánh thêu kim tuyến vàng khoác quanh cổ & vai)
      {
        geometry: LowPolyBuilder.cylinder(0.20, 0.28, 0.08, 12),
        color: trimHex,
        position: [0, sy - 0.02, 0],
        scale: [1.05, 1, 0.85]
      },
      {
        geometry: LowPolyBuilder.cylinder(0.17, 0.24, 0.09, 12),
        color: robeHex,
        position: [0, sy - 0.015, 0],
        scale: [1.02, 1, 0.82]
      },
      // Múi vân kiên trước ngực & sau lưng
      {
        geometry: LowPolyBuilder.cone(0.14, 0.18, 4),
        color: trimHex,
        position: [0, sy - 0.10, 0.17],
        rotation: [Math.PI, Math.PI * 0.25, 0],
        scale: [1.2, 1, 0.4]
      },
      {
        geometry: LowPolyBuilder.cone(0.14, 0.18, 4),
        color: trimHex,
        position: [0, sy - 0.10, -0.17],
        rotation: [Math.PI, Math.PI * 0.25, 0],
        scale: [1.2, 1, 0.4]
      },
      // Đai nhung bản lớn ngang eo đính mặt ngọc vàng chính giữa
      {
        geometry: LowPolyBuilder.cylinder(0.22, 0.23, 0.09, 12),
        color: trimHex,
        position: [0, 0.12, 0],
        scale: [1.04, 1, 0.78]
      },
      {
        geometry: LowPolyBuilder.octahedron(0.055, 0),
        color: 0xdc2626,
        position: [0, 0.12, 0.18],
        scale: [1.1, 1.1, 0.5]
      },
      // 2 Vạt mạng sườn thêu kim tuyến hai bên hông
      {
        geometry: LowPolyBuilder.box(0.05, 0.28, 0.14),
        color: trimHex,
        position: [-0.21, -0.06, 0],
        rotation: [0, 0, 0.12]
      },
      {
        geometry: LowPolyBuilder.box(0.05, 0.28, 0.14),
        color: trimHex,
        position: [0.21, -0.06, 0],
        rotation: [0, 0, -0.12]
      }
    ]
  }

  private buildHeadgearMesh(
    type: 'quan' | 'chau' | 'hoang' | 'co' | 'cau' | 'mau',
    robeHex: number,
    trimHex: number,
    mat: THREE.Material
  ): THREE.Group {
    const g = new THREE.Group()
    const parts: ColoredPart[] = []

    if (type === 'quan') {
      // Mũ Cánh Chuồn Quan Lớn / Đức Ông Trần Triều:
      // Vòng đai kim cô vàng ôm trán + thân mũ 2 tầng sơn son thếp vàng + 2 cánh chuồn cong vươn ngang
      parts.push(
        { geometry: LowPolyBuilder.cylinder(0.28, 0.29, 0.08, 12), color: trimHex, position: [0, 0.18, 0] },
        { geometry: LowPolyBuilder.cylinder(0.24, 0.27, 0.16, 12), color: robeHex, position: [0, 0.27, 0] },
        { geometry: LowPolyBuilder.cylinder(0.18, 0.22, 0.14, 10), color: trimHex, position: [0, 0.38, -0.02] },
        { geometry: LowPolyBuilder.sphere(0.06, 1), color: 0xdc2626, position: [0, 0.48, -0.02] },
        // Ngọc bội đỏ đính chính giữa trán
        { geometry: LowPolyBuilder.octahedron(0.055, 0), color: 0xdc2626, position: [0, 0.20, 0.29] },
        { geometry: LowPolyBuilder.sphere(0.035, 1), color: trimHex, position: [0, 0.27, 0.27] },
        // Hai cánh chuồn vươn ngang hai bên thái dương
        {
          geometry: LowPolyBuilder.box(0.28, 0.06, 0.03),
          color: trimHex,
          position: [-0.36, 0.26, -0.06],
          rotation: [0, 0, 0.18]
        },
        {
          geometry: LowPolyBuilder.box(0.28, 0.06, 0.03),
          color: trimHex,
          position: [0.36, 0.26, -0.06],
          rotation: [0, 0, -0.18]
        },
        {
          geometry: LowPolyBuilder.sphere(0.04, 1),
          color: robeHex,
          position: [-0.49, 0.29, -0.06]
        },
        {
          geometry: LowPolyBuilder.sphere(0.04, 1),
          color: robeHex,
          position: [0.49, 0.29, -0.06]
        }
      )
    } else if (type === 'chau' || type === 'co' || type === 'mau') {
      // Khăn Chầu / Khăn Cô / Mão Thánh Mẫu:
      // Khăn vấn nhiều vòng + Cầu Đầu vàng tua hạt ngọc trước trán + Hoa mẫu đơn & Trâm cài hai bên thái dương
      parts.push(
        { geometry: LowPolyBuilder.cylinder(0.30, 0.29, 0.12, 12), color: robeHex, position: [0, 0.19, 0] },
        { geometry: LowPolyBuilder.cylinder(0.27, 0.30, 0.10, 12), color: trimHex, position: [0, 0.27, 0] },
        { geometry: LowPolyBuilder.cylinder(0.23, 0.26, 0.10, 10), color: robeHex, position: [0, 0.34, 0] },
        // Đóa hoa mẫu đơn kết trên đỉnh khăn
        { geometry: LowPolyBuilder.sphere(0.09, 1), color: 0xf43f5e, position: [0, 0.36, 0.22] },
        { geometry: LowPolyBuilder.sphere(0.05, 1), color: trimHex, position: [0, 0.37, 0.29] }
      )
      // Cầu Đầu vàng & 7 hạt ngọc rủ ngang trán
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.22
        parts.push({
          geometry: LowPolyBuilder.sphere(0.026, 0),
          color: i === 0 ? 0xdc2626 : 0xfef08a,
          position: [Math.sin(a) * 0.29, 0.14, Math.cos(a) * 0.29]
        })
      }
      // Trâm hoa & tua ngọc cài hai bên tai
      for (const sx of [-1, 1]) {
        parts.push(
          { geometry: LowPolyBuilder.sphere(0.075, 1), color: type === 'co' ? 0xfb7185 : 0xfcd535, position: [sx * 0.30, 0.22, 0.06] },
          { geometry: LowPolyBuilder.cylinder(0.015, 0.015, 0.20, 5), color: trimHex, position: [sx * 0.31, 0.08, 0.08] },
          { geometry: LowPolyBuilder.sphere(0.025, 0), color: 0xfef08a, position: [sx * 0.31, -0.02, 0.08] }
        )
      }
      if (type === 'mau') {
        // Đỉnh Kim Phượng cho Tam Tòa Thánh Mẫu
        parts.push({
          geometry: LowPolyBuilder.cone(0.14, 0.22, 6),
          color: trimHex,
          position: [0, 0.46, 0]
        })
      }
    } else if (type === 'hoang') {
      // Khăn Xếp chữ Nhân Ông Hoàng Mười / Ông Hoàng Bảy + Kim Hoa ngọc bội + 2 dải lụa sau gáy
      parts.push(
        { geometry: LowPolyBuilder.cylinder(0.29, 0.28, 0.08, 12), color: trimHex, position: [0, 0.17, 0] },
        { geometry: LowPolyBuilder.cylinder(0.31, 0.29, 0.14, 12), color: robeHex, position: [0, 0.25, 0] },
        { geometry: LowPolyBuilder.cylinder(0.27, 0.30, 0.08, 12), color: robeHex, position: [0, 0.33, 0] },
        // Kim Hoa vàng nạm ngọc đỏ chính giữa trán
        { geometry: LowPolyBuilder.octahedron(0.065, 0), color: trimHex, position: [0, 0.25, 0.30] },
        { geometry: LowPolyBuilder.sphere(0.035, 1), color: 0xdc2626, position: [0, 0.25, 0.34] },
        // 2 dải khăn lụa vàng buông sau gáy
        {
          geometry: LowPolyBuilder.box(0.06, 0.34, 0.02),
          color: trimHex,
          position: [-0.08, 0.02, -0.30],
          rotation: [0.18, 0, -0.08]
        },
        {
          geometry: LowPolyBuilder.box(0.06, 0.34, 0.02),
          color: trimHex,
          position: [0.08, 0.02, -0.30],
          rotation: [0.18, 0, 0.08]
        }
      )
    } else {
      // Khăn Rìu Đỏ 2 Chỏm Cao của Cậu Bé Hoàng Tử
      parts.push(
        { geometry: LowPolyBuilder.cylinder(0.29, 0.28, 0.14, 12), color: robeHex, position: [0, 0.21, 0] },
        { geometry: LowPolyBuilder.cylinder(0.30, 0.29, 0.05, 12), color: trimHex, position: [0, 0.16, 0] },
        { geometry: LowPolyBuilder.octahedron(0.055, 0), color: trimHex, position: [0, 0.21, 0.29] }
      )
      for (const sx of [-1, 1]) {
        parts.push(
          {
            geometry: LowPolyBuilder.cone(0.09, 0.28, 6),
            color: robeHex,
            position: [sx * 0.28, 0.36, 0],
            rotation: [0, 0, -sx * 0.42]
          },
          {
            geometry: LowPolyBuilder.sphere(0.04, 1),
            color: trimHex,
            position: [sx * 0.34, 0.48, 0]
          }
        )
      }
    }

    const mesh = new THREE.Mesh(LowPolyBuilder.mergeColored(parts), mat)
    mesh.castShadow = true
    g.add(mesh)
    return g
  }

  private createDongThayRig(): DongThayRig {
    const root = new THREE.Group()
    const mat = FlatMaterialFactory.getInstance().vertexColor()

    const deityIds: HauDongDeityId[] = [
      'quan_de_tam',
      'chau_doi',
      'ong_hoang_muoi',
      'co_doi',
      'cau_be',
      'duc_ong_tran_trieu',
      'ong_hoang_bay'
    ]

    const partGeoCache = {} as Record<HauDongDeityId, AvatarPartGeometries>
    const mangConGroup = new THREE.Group()
    const mangConMeshes = {} as Record<HauDongDeityId, THREE.Mesh>
    const headgearGroups = {} as Record<HauDongDeityId, THREE.Group>

    // Dựng sẵn bộ Geometry Chibi Low-Poly, Mạng Cồn và Mũ/Khăn chuẩn ngoài đời cho từng Giá Đồng
    for (const id of deityIds) {
      const cfg = DEITY_THEME[id]
      const isFemaleDeity = cfg.headgear === 'chau' || cfg.headgear === 'co'
      const palette: AvatarPalette = {
        style: isFemaleDeity ? 'ao_nhat_binh' : 'ao_duong',
        robeColor: cfg.robeColor,
        trimColor: cfg.trimColor,
        innerColor: id === 'quan_de_tam' || id === 'ong_hoang_muoi' || id === 'ong_hoang_bay' ? 0xf8fafc : 0xfef3c7,
        sashColor: cfg.trimColor,
        skinColor: isFemaleDeity ? 0xfbe0c8 : 0xf7d6ba,
        hatKind: 'none',
        hatColor: cfg.trimColor,
        hairKind: isFemaleDeity ? 'bun' : 'short',
        hairColor: 0x18181e,
        shoesColor: 0x2a2321,
        blushColor: 0xf4929c,
        gender: isFemaleDeity ? 'female' : 'male'
      }
      partGeoCache[id] = buildPartGeometries(palette)

      const mcMesh = new THREE.Mesh(
        LowPolyBuilder.mergeColored(this.buildMangConParts(cfg.robeColor, cfg.trimColor)),
        mat
      )
      mcMesh.castShadow = true
      mcMesh.visible = false
      mangConMeshes[id] = mcMesh
      mangConGroup.add(mcMesh)

      const hg = this.buildHeadgearMesh(cfg.headgear, cfg.robeColor, cfg.trimColor, mat)
      hg.visible = false
      headgearGroups[id] = hg
    }

    const initGeo = partGeoCache.quan_de_tam

    // 1. Thân trên + Đầu Chibi Low-Poly (upperPivot đặt tại hipY giống hệt PilgrimAvatar)
    const upperPivot = new THREE.Group()
    upperPivot.position.y = AVATAR_DIMS.hipY
    const upperMesh = new THREE.Mesh(initGeo.upper, mat)
    upperMesh.castShadow = true
    upperMesh.receiveShadow = true
    upperPivot.add(upperMesh)
    upperPivot.add(mangConGroup)

    // 2. Hai tà áo dài uốn cong 3D trước & sau
    const skirtPivot = new THREE.Group()
    const skirtMesh = new THREE.Mesh(initGeo.skirt, mat)
    skirtMesh.castShadow = true
    skirtPivot.add(skirtMesh)
    upperPivot.add(skirtPivot)

    const skirtBackPivot = new THREE.Group()
    const skirtBackMesh = new THREE.Mesh(initGeo.skirtBack, mat)
    skirtBackMesh.castShadow = true
    skirtBackPivot.add(skirtBackMesh)
    upperPivot.add(skirtBackPivot)

    // 3. Nhóm phụ kiện trên đầu (AVATAR_DIMS.headCenterY đã là tọa độ tâm đầu tương đối so với upperPivot!)
    const headGroup = new THREE.Group()
    headGroup.position.set(0, AVATAR_DIMS.headCenterY, 0)
    for (const id of deityIds) {
      headGroup.add(headgearGroups[id])
    }

    // Khăn Phủ Diện đỏ thêu tua vàng (trùm kín đầu ở Bước 1, đầu Bước 3 và Bước 6)
    const coverScarf = new THREE.Group()
    const scarfParts: ColoredPart[] = [
      { geometry: LowPolyBuilder.cylinder(0.28, 0.38, 0.44, 10), color: 0xdc2626, position: [0, 0.08, 0.02] },
      { geometry: LowPolyBuilder.sphere(0.29, 1), color: 0xb91c1c, position: [0, 0.24, 0.01], scale: [1.0, 0.65, 1.0] },
      { geometry: LowPolyBuilder.cylinder(0.38, 0.40, 0.05, 10), color: 0xfcd535, position: [0, -0.14, 0.02] }
    ]
    const coverMesh = new THREE.Mesh(LowPolyBuilder.mergeColored(scarfParts), mat)
    coverMesh.castShadow = true
    coverScarf.add(coverMesh)
    coverScarf.visible = false
    headGroup.add(coverScarf)

    upperPivot.add(headGroup)

    // 4. Hai cánh tay Chibi + 5 Bộ Đạo Cụ Hầu Đồng ngoài đời thật
    const makeArmWithProps = (side: -1 | 1, armGeo: THREE.BufferGeometry) => {
      const arm = new THREE.Group()
      arm.position.set(side * AVATAR_DIMS.shoulderX, AVATAR_DIMS.shoulderY, 0)
      const armMesh = new THREE.Mesh(armGeo, mat)
      armMesh.castShadow = true
      arm.add(armMesh)

      const handY = -0.31
      const handZ = 0.06

      // (a) Kiếm Tam Phủ (Lưỡi kiếm bạc sáng, chắn kiếm đồng vàng, chuôi đỏ đính tua lụa đỏ)
      const sword = new THREE.Group()
      sword.position.set(0, handY, handZ)
      const swordParts: ColoredPart[] = [
        { geometry: LowPolyBuilder.cylinder(0.018, 0.018, 0.14, 6), color: 0xb91c1c, position: [0, -0.02, 0] },
        { geometry: LowPolyBuilder.box(0.03, 0.14, 0.02), color: 0xef4444, position: [0, -0.12, -0.02], rotation: [0.25, 0, 0] },
        { geometry: LowPolyBuilder.box(0.04, 0.03, 0.14), color: 0xfcd535, position: [0, 0.06, 0] },
        { geometry: LowPolyBuilder.box(0.018, 0.56, 0.055), color: 0xe2e8f0, position: [0, 0.35, 0] },
        { geometry: LowPolyBuilder.cone(0.028, 0.10, 4), color: 0xf8fafc, position: [0, 0.68, 0], scale: [0.5, 1, 1] }
      ]
      sword.add(new THREE.Mesh(LowPolyBuilder.mergeColored(swordParts), mat))
      sword.rotation.x = Math.PI * 0.38
      sword.visible = false
      arm.add(sword)

      // (b) Đôi Mồi Nến Bông Sen (Ống mồi đỏ, đài sen giấy hồng xòe cánh chắn sáp, ngọn lửa rực sáng)
      const torch = new THREE.Group()
      torch.position.set(0, handY, handZ)
      const torchParts: ColoredPart[] = [
        { geometry: LowPolyBuilder.cylinder(0.018, 0.022, 0.34, 6), color: 0xdc2626, position: [0, 0.12, 0] },
        { geometry: LowPolyBuilder.cylinder(0.08, 0.03, 0.06, 8), color: 0xf43f5e, position: [0, 0.12, 0] },
        { geometry: LowPolyBuilder.cylinder(0.06, 0.08, 0.04, 8), color: 0xfcd535, position: [0, 0.16, 0] },
        { geometry: LowPolyBuilder.octahedron(0.065, 0), color: 0xffaa00, position: [0, 0.34, 0], scale: [0.85, 1.4, 0.85] },
        { geometry: LowPolyBuilder.octahedron(0.04, 0), color: 0xfef08a, position: [0, 0.36, 0] }
      ]
      torch.add(new THREE.Mesh(LowPolyBuilder.mergeColored(torchParts), mat))
      torch.rotation.x = Math.PI * 0.32
      torch.visible = false
      arm.add(torch)

      // (c) Quạt Lụa Xòe Lớn (Nan quạt vàng + mặt quạt lụa bán nguyệt thêu kim tuyến)
      const fan = new THREE.Group()
      fan.position.set(0, handY, handZ)
      const fanParts: ColoredPart[] = []
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.24
        fanParts.push({
          geometry: LowPolyBuilder.box(0.045, 0.24, 0.012),
          color: i % 2 === 0 ? 0xfcd535 : 0xdc2626,
          position: [Math.sin(a) * 0.11, Math.cos(a) * 0.11 + 0.04, 0],
          rotation: [0, 0, -a]
        })
      }
      fan.add(new THREE.Mesh(LowPolyBuilder.mergeColored(fanParts), mat))
      fan.rotation.x = Math.PI * 0.22
      fan.visible = false
      arm.add(fan)

      // (d) Đôi Hèo Lộc Cậu Bé (Gậy hèo vàng bóng buộc nơ lụa đỏ & quả nhạc đồng)
      const staff = new THREE.Group()
      staff.position.set(0, handY, handZ)
      const staffParts: ColoredPart[] = [
        { geometry: LowPolyBuilder.cylinder(0.02, 0.02, 0.56, 6), color: 0xfcd535, position: [0, 0.22, 0] },
        { geometry: LowPolyBuilder.sphere(0.045, 1), color: 0xdc2626, position: [0, 0.44, 0] },
        { geometry: LowPolyBuilder.box(0.14, 0.035, 0.02), color: 0xef4444, position: [0, 0.43, 0.02], rotation: [0, 0, 0.25] },
        { geometry: LowPolyBuilder.sphere(0.032, 1), color: 0xfef08a, position: [0, 0.52, 0] }
      ]
      staff.add(new THREE.Mesh(LowPolyBuilder.mergeColored(staffParts), mat))
      staff.rotation.x = Math.PI * 0.35
      staff.visible = false
      arm.add(staff)

      // (e) Bó Nén Hương Trầm Lễ Mẫu (5 nén hương chân đỏ đầu cháy hồng)
      const incense = new THREE.Group()
      incense.position.set(0, handY, handZ + 0.03)
      const incParts: ColoredPart[] = []
      for (const ox of [-0.015, 0, 0.015]) {
        incParts.push(
          { geometry: LowPolyBuilder.cylinder(0.008, 0.008, 0.32, 5), color: 0xdc2626, position: [ox, 0.14, 0] },
          { geometry: LowPolyBuilder.sphere(0.018, 0), color: 0xffaa00, position: [ox, 0.31, 0] }
        )
      }
      incense.add(new THREE.Mesh(LowPolyBuilder.mergeColored(incParts), mat))
      incense.visible = false
      arm.add(incense)

      upperPivot.add(arm)
      return {
        arm,
        armMesh,
        props: { sword, torch, fan, staff, incense }
      }
    }

    const left = makeArmWithProps(-1, initGeo.armL)
    const right = makeArmWithProps(1, initGeo.armR)
    root.add(upperPivot)

    // 5. Hai chân quần lụa ống rộng + hài thêu giống nhân vật chính
    const leftLeg = new THREE.Group()
    leftLeg.position.set(-AVATAR_DIMS.legX, AVATAR_DIMS.hipY, 0)
    const leftLegMesh = new THREE.Mesh(initGeo.legL, mat)
    leftLegMesh.castShadow = true
    leftLeg.add(leftLegMesh)
    root.add(leftLeg)

    const rightLeg = new THREE.Group()
    rightLeg.position.set(AVATAR_DIMS.legX, AVATAR_DIMS.hipY, 0)
    const rightLegMesh = new THREE.Mesh(initGeo.legR, mat)
    rightLegMesh.castShadow = true
    rightLeg.add(rightLegMesh)
    root.add(rightLeg)

    return {
      root,
      upperPivot,
      skirtPivot,
      skirtBackPivot,
      upperMesh,
      skirtMesh,
      skirtBackMesh,
      leftArmMesh: left.armMesh,
      rightArmMesh: right.armMesh,
      leftLegMesh,
      rightLegMesh,
      mangConGroup,
      mangConMeshes,
      partGeoCache,
      headGroup,
      leftArm: left.arm,
      rightArm: right.arm,
      leftLeg,
      rightLeg,
      coverScarf,
      headgearGroups,
      leftProps: left.props,
      rightProps: right.props
    }
  }

  private createSeatedHelperNpc(
    robeHex: number,
    trimHex: number,
    role?: 'lute' | 'clapper' | 'drum' | 'tray',
    gender: 'male' | 'female' = 'male'
  ) {
    const root = new THREE.Group()
    const mat = FlatMaterialFactory.getInstance().vertexColor()

    const isMusician = role === 'lute' || role === 'clapper' || role === 'drum'
    const palette: AvatarPalette = {
      style: 'ao_duong',
      countryKey: 'taiwan', // Áo dài ngũ thân cổ đứng + dải lụa ngực + Khăn xếp tròn truyền thống
      robeColor: robeHex,
      trimColor: trimHex,
      innerColor: isMusician ? 0xf8fafc : 0xf4eee1,
      sashColor: trimHex,
      skinColor: gender === 'male' ? 0xf7d6ba : 0xf9d8be,
      hatKind: 'man_velvet',
      hatColor: 0x18181e, // Khăn xếp đen truyền thống trang nghiêm
      hairKind: gender === 'male' ? 'short' : 'bun',
      hairColor: 0x18181e,
      shoesColor: 0x262220,
      blushColor: 0xf28d95,
      gender
    }
    const geos = buildPartGeometries(palette)

    // Tư thế ngồi chiếu truyền thống (hạ trọng tâm giống poseMeditate của nhân vật chính)
    const seatY = 0.22
    const upperPivot = new THREE.Group()
    upperPivot.position.y = seatY
    const upperMesh = new THREE.Mesh(geos.upper, mat)
    upperMesh.castShadow = true
    upperPivot.add(upperMesh)

    const skirtPivot = new THREE.Group()
    skirtPivot.rotation.x = -0.38
    skirtPivot.add(new THREE.Mesh(geos.skirt, mat))
    upperPivot.add(skirtPivot)

    const skirtBackPivot = new THREE.Group()
    skirtBackPivot.rotation.x = 0.15
    skirtBackPivot.add(new THREE.Mesh(geos.skirtBack, mat))
    upperPivot.add(skirtBackPivot)

    const leftArm = new THREE.Group()
    leftArm.position.set(-AVATAR_DIMS.shoulderX, AVATAR_DIMS.shoulderY, 0)
    const lMesh = new THREE.Mesh(geos.armL, mat)
    lMesh.castShadow = true
    leftArm.add(lMesh)
    upperPivot.add(leftArm)

    const rightArm = new THREE.Group()
    rightArm.position.set(AVATAR_DIMS.shoulderX, AVATAR_DIMS.shoulderY, 0)
    const rMesh = new THREE.Mesh(geos.armR, mat)
    rMesh.castShadow = true
    rightArm.add(rMesh)
    upperPivot.add(rightArm)

    root.add(upperPivot)

    // Hai chân xếp bằng trên chiếu
    const leftLeg = new THREE.Group()
    leftLeg.position.set(-AVATAR_DIMS.legX, seatY, 0.08)
    leftLeg.rotation.set(-1.35, 0, 0.52)
    leftLeg.add(new THREE.Mesh(geos.legL, mat))
    root.add(leftLeg)

    const rightLeg = new THREE.Group()
    rightLeg.position.set(AVATAR_DIMS.legX, seatY, 0.08)
    rightLeg.rotation.set(-1.35, 0, -0.52)
    rightLeg.add(new THREE.Mesh(geos.legR, mat))
    root.add(rightLeg)

    // Nhạc cụ Cung Văn & Mâm lễ Hầu Dâng
    if (role === 'lute') {
      // Đàn Nguyệt (Đàn Kìm): Thùng đàn gỗ tròn mặt trăng + cần đàn dài gắn phím vươn chéo lên vai trái
      const luteParts: ColoredPart[] = [
        {
          geometry: LowPolyBuilder.cylinder(0.19, 0.19, 0.06, 12),
          color: 0xb45309,
          position: [0.04, 0.44, 0.22],
          rotation: [Math.PI * 0.5, 0, 0]
        },
        {
          geometry: LowPolyBuilder.cylinder(0.15, 0.15, 0.065, 12),
          color: 0xfde68a,
          position: [0.04, 0.44, 0.222],
          rotation: [Math.PI * 0.5, 0, 0]
        },
        // Cần đàn dài vươn chéo lên bên trái
        {
          geometry: LowPolyBuilder.box(0.035, 0.62, 0.025),
          color: 0x78350f,
          position: [-0.18, 0.64, 0.21],
          rotation: [0, 0, 0.72]
        },
        // Đầu cần đàn & trục vặn dây
        {
          geometry: LowPolyBuilder.box(0.06, 0.12, 0.04),
          color: 0xfcd535,
          position: [-0.38, 0.86, 0.21],
          rotation: [0, 0, 0.72]
        }
      ]
      root.add(new THREE.Mesh(LowPolyBuilder.mergeColored(luteParts), mat))
    } else if (role === 'clapper') {
      // Bộ Phách tre sơn son & Thanh la đồng (Cảnh) đặt trên bàn gỗ thấp trước mặt
      const clapperParts: ColoredPart[] = [
        { geometry: LowPolyBuilder.box(0.42, 0.12, 0.24), color: 0x5c2d16, position: [0, 0.06, 0.42] },
        { geometry: LowPolyBuilder.box(0.22, 0.04, 0.08), color: 0xdc2626, position: [-0.08, 0.14, 0.42] },
        { geometry: LowPolyBuilder.cylinder(0.11, 0.11, 0.025, 10), color: 0xfcd535, position: [0.11, 0.14, 0.42] }
      ]
      root.add(new THREE.Mesh(LowPolyBuilder.mergeColored(clapperParts), mat))
    } else if (role === 'drum') {
      // Trống Chầu sơn đỏ mặt da trắng đặt trên giá gỗ trước mặt
      const drumParts: ColoredPart[] = [
        { geometry: LowPolyBuilder.box(0.32, 0.10, 0.24), color: 0x5c2d16, position: [0, 0.05, 0.44] },
        { geometry: LowPolyBuilder.cylinder(0.16, 0.18, 0.24, 12), color: 0xb91c1c, position: [0, 0.21, 0.44] },
        { geometry: LowPolyBuilder.cylinder(0.15, 0.15, 0.25, 12), color: 0xf8fafc, position: [0, 0.21, 0.44] },
        { geometry: LowPolyBuilder.cylinder(0.165, 0.165, 0.03, 12), color: 0xfcd535, position: [0, 0.31, 0.44] }
      ]
      root.add(new THREE.Mesh(LowPolyBuilder.mergeColored(drumParts), mat))
    } else if (role === 'tray') {
      // Mâm đồng vàng đựng lễ vật / khăn trầu đặt bên cạnh Tứ Trụ Hầu Dâng
      const trayParts: ColoredPart[] = [
        { geometry: LowPolyBuilder.cylinder(0.14, 0.18, 0.08, 10), color: 0xd97706, position: [0, 0.04, 0.42] },
        { geometry: LowPolyBuilder.cylinder(0.22, 0.20, 0.03, 12), color: 0xfcd535, position: [0, 0.09, 0.42] },
        { geometry: LowPolyBuilder.octahedron(0.08, 0), color: 0xdc2626, position: [0, 0.15, 0.42], scale: [1.1, 0.8, 1.1] }
      ]
      root.add(new THREE.Mesh(LowPolyBuilder.mergeColored(trayParts), mat))
    }

    return { root, leftArm, rightArm }
  }

  public applyDeityCostume(deityId: HauDongDeityId) {
    this.currentDeity = deityId
    const cfg = DEITY_THEME[deityId] || DEITY_THEME.quan_de_tam
    const geos = this.dongThay.partGeoCache[deityId] || this.dongThay.partGeoCache.quan_de_tam

    // Thay toàn bộ 7 phần Geometry Chibi Low-Poly đã bake màu áo ngự, viền kim tuyến & quần lụa
    this.dongThay.upperMesh.geometry = geos.upper
    this.dongThay.skirtMesh.geometry = geos.skirt
    this.dongThay.skirtBackMesh.geometry = geos.skirtBack
    this.dongThay.leftArmMesh.geometry = geos.armL
    this.dongThay.rightArmMesh.geometry = geos.armR
    this.dongThay.leftLegMesh.geometry = geos.legL
    this.dongThay.rightLegMesh.geometry = geos.legR

    for (const k of Object.keys(this.dongThay.mangConMeshes) as HauDongDeityId[]) {
      this.dongThay.mangConMeshes[k].visible = k === deityId
    }
    for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
      this.dongThay.headgearGroups[k].visible = k === deityId
    }

    this.auraMat.color.setHex(cfg.auraColor)
    this.spotlightMat.color.setHex(cfg.auraColor)
  }

  private setActiveProps(propKey: 'sword' | 'torch' | 'fan' | 'staff' | 'incense' | 'none') {
    for (const k of ['sword', 'torch', 'fan', 'staff', 'incense'] as const) {
      // Mồi nến, kiếm, hèo cầm cả 2 tay; quạt và bó hương cầm tay phải trang nghiêm
      this.dongThay.leftProps[k].visible = k === propKey && k !== 'incense' && k !== 'fan'
      this.dongThay.rightProps[k].visible = k === propKey
    }
  }

  public update(delta: number, elapsed: number, state?: HauDongVisualState | null) {
    if (!state || !state.active) {
      // Trạng thái tĩnh trang nghiêm khi chưa vào lễ
      this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.4)
      this.dongThay.root.rotation.y = 0
      this.dongThay.upperPivot.rotation.set(0, 0, 0)
      this.dongThay.skirtPivot.rotation.x = 0
      this.dongThay.skirtBackPivot.rotation.x = 0
      this.dongThay.coverScarf.visible = false
      this.dongThay.headgearGroups[this.currentDeity].visible = true
      this.setActiveProps('none')
      this.dongThay.leftArm.rotation.set(-0.55, 0, -0.32)
      this.dongThay.rightArm.rotation.set(-0.55, 0, 0.32)
      this.dongThay.leftLeg.rotation.set(0, 0, 0)
      this.dongThay.rightLeg.rotation.set(0, 0, 0)
      this.dongThay.headGroup.rotation.set(0, 0, 0)
      this.auraMat.opacity = 0.14 + Math.sin(elapsed * 2.0) * 0.04
      this.spotlightMat.opacity = 0.0
      for (const orb of this.blessingOrbs) orb.visible = false
      return
    }

    const rawAny = state as any
    const deityAlias: Record<string, HauDongDeityId> = {
      quan_lon_de_tam: 'quan_de_tam',
      quan_de_tam: 'quan_de_tam',
      chau_doi_thuong_ngan: 'chau_doi',
      chau_doi: 'chau_doi',
      ong_hoang_muoi: 'ong_hoang_muoi',
      co_doi_thuong_ngan: 'co_doi',
      co_doi: 'co_doi',
      cau_be_hoang_tu: 'cau_be',
      cau_be: 'cau_be',
      duc_ong_tran_trieu: 'duc_ong_tran_trieu',
      ong_hoang_bay: 'ong_hoang_bay'
    }
    const stepAlias: Record<string | number, HauDongStepId> = {
      1: 'costume',
      2: 'incense',
      3: 'descent',
      4: 'dance',
      5: 'blessing',
      6: 'ascent',
      costume: 'costume',
      incense: 'incense',
      descent: 'descent',
      dance: 'dance',
      blessing: 'blessing',
      ascent: 'ascent',
      countdown: 'countdown',
      idle: 'idle',
      completed: 'completed'
    }

    const resolvedDeityId = deityAlias[state.deityId] || 'quan_de_tam'
    if (resolvedDeityId !== this.currentDeity) {
      this.applyDeityCostume(resolvedDeityId)
    }

    // Cập nhật Cuốn Thư Vàng trên Chiếu Hầu (chống NaN / undefined tuyệt đối với cả DTO cũ lẫn mới)
    const stageNum =
      typeof state.stageIndex === 'number' && !Number.isNaN(state.stageIndex)
        ? state.stageIndex + 1
        : typeof rawAny.giaIndex === 'number' && !Number.isNaN(rawAny.giaIndex)
          ? rawAny.giaIndex
          : 1
    const totalStages =
      typeof state.totalStages === 'number' && !Number.isNaN(state.totalStages) ? state.totalStages : 5
    const deityName = state.deityName || 'Quan Lớn Đệ Tam'
    const stepLabel =
      state.stepLabel ||
      (rawAny.stepName ? `Bước ${rawAny.stepId || 1}/6: ${rawAny.stepName}` : 'Nghi lễ Hầu Đồng Tứ Phủ')
    const palaceName = state.palaceName || rawAny.palace || 'Tam Tòa Tứ Phủ'

    const line1 = `GIÁ ${stageNum}/${totalStages}: ${deityName.toUpperCase()}`
    const line2 = `${stepLabel} · ${palaceName}`
    const line3 = state.sponsorName
      ? `Thí chủ Mở Đàn: ${state.sponsorName} · Đứng xem & Chắp tay để nhận lộc MC`
      : 'Lễ Sóc Vọng Định Kỳ · Đứng xem & Chắp tay để nhận lộc MC'
    this.renderScrollBanner(line1, line2, line3)

    const theme = DEITY_THEME[resolvedDeityId] || DEITY_THEME.quan_de_tam
    const step = stepAlias[state.stepId] || 'dance'

    // Diễn hoạt Cung Văn gảy đàn nguyệt, gõ phách & đánh trống chầu
    for (let i = 0; i < this.cungVanList.length; i++) {
      const cv = this.cungVanList[i]!
      if (i === 0) {
        // Văn đàn nguyệt: tay trái bấm phím trên cần đàn, tay phải khảy dây
        cv.leftArm.rotation.set(-0.75, 0.2, -0.35 + Math.sin(elapsed * 5) * 0.08)
        cv.rightArm.rotation.set(-0.65 + Math.sin(elapsed * 10) * 0.22, -0.2, 0.25)
      } else {
        // Văn phách & Văn trống chầu
        cv.leftArm.rotation.set(-0.55 + Math.sin(elapsed * 8 + i) * 0.25, 0, -0.15)
        cv.rightArm.rotation.set(-0.55 + Math.cos(elapsed * 8 + i) * 0.25, 0, 0.15)
      }
    }

    // Diễn hoạt Tứ Trụ Hầu Dâng
    for (let i = 0; i < this.hauDangList.length; i++) {
      const hd = this.hauDangList[i]!
      const wave =
        step === 'costume' || step === 'blessing'
          ? Math.sin(elapsed * 6 + i) * 0.32
          : Math.sin(elapsed * 2.2 + i) * 0.08
      hd.leftArm.rotation.set(-0.50 + wave, 0, -0.2)
      hd.rightArm.rotation.set(-0.50 - wave, 0, 0.2)
    }

    // Diễn hoạt 6 Bước của NPC Đồng Thầy (kết hợp lắc đồng, vạt áo bay và bộ chân Chibi)
    if (step === 'costume' || step === 'countdown') {
      // Bước 1: Trùm khăn phủ diện đỏ & Thay lễ phục
      this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.4)
      this.dongThay.root.rotation.y = 0
      this.dongThay.coverScarf.visible = true
      for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
        this.dongThay.headgearGroups[k].visible = false
      }
      this.setActiveProps('none')
      this.dongThay.upperPivot.rotation.set(0, Math.sin(elapsed * 2.5) * 0.08, Math.sin(elapsed * 3.0) * 0.04)
      this.dongThay.leftArm.rotation.set(-0.55, 0, -0.3)
      this.dongThay.rightArm.rotation.set(-0.55, 0, 0.3)
      this.dongThay.leftLeg.rotation.set(0, 0, 0)
      this.dongThay.rightLeg.rotation.set(0, 0, 0)
      this.dongThay.skirtPivot.rotation.x = 0
      this.dongThay.skirtBackPivot.rotation.x = 0
      this.auraMat.opacity = 0.25
      this.spotlightMat.opacity = 0.06
      for (const orb of this.blessingOrbs) orb.visible = false
    } else if (step === 'incense') {
      // Bước 2: Quay vào Ban Công Đồng dâng hương lễ bái
      this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.0)
      this.dongThay.root.rotation.y = Math.PI
      this.dongThay.coverScarf.visible = false
      for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
        this.dongThay.headgearGroups[k].visible = k === resolvedDeityId
      }
      this.setActiveProps('incense')
      const bow = Math.sin(elapsed * 4.0) * 0.30
      this.dongThay.upperPivot.rotation.set(Math.max(0, bow * 0.45), 0, 0)
      this.dongThay.leftArm.rotation.set(-0.95 + bow, 0, -0.25)
      this.dongThay.rightArm.rotation.set(-0.95 + bow, 0, 0.25)
      this.dongThay.leftLeg.rotation.set(0, 0, 0)
      this.dongThay.rightLeg.rotation.set(0, 0, 0)
      this.auraMat.opacity = 0.4
      this.spotlightMat.opacity = 0.10
      for (const orb of this.blessingOrbs) orb.visible = false
    } else if (step === 'descent') {
      // Bước 3: Lễ Thánh Giáng (Lắc đồng đảo đầu & Tung khăn mở diện, hào quang bừng sáng)
      this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.4)
      this.dongThay.root.rotation.y = 0
      const isRevealed = state.stageElapsedSec > 24
      this.dongThay.coverScarf.visible = !isRevealed
      for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
        this.dongThay.headgearGroups[k].visible = isRevealed && k === resolvedDeityId
      }
      this.setActiveProps('none')
      const sway = Math.sin(elapsed * 7.5) * 0.12
      this.dongThay.upperPivot.rotation.set(Math.cos(elapsed * 7.5) * 0.06, sway, sway * 0.6)
      this.dongThay.headGroup.rotation.z = Math.sin(elapsed * 10.0) * 0.12
      this.dongThay.leftArm.rotation.set(-0.6, 0, -0.38)
      this.dongThay.rightArm.rotation.set(-0.6, 0, 0.38)
      this.auraMat.opacity = 0.65 + Math.sin(elapsed * 8.0) * 0.2
      this.auraRing.scale.setScalar(1.0 + Math.sin(elapsed * 6.0) * 0.08)
      this.spotlightMat.opacity = 0.16
      for (const orb of this.blessingOrbs) orb.visible = false
    } else if (step === 'dance') {
      // Bước 4: Múa đồng kết hợp hát Chầu văn (lướt hình số 8 trên Chiếu Hầu cùng kiếm/mồi/quạt/hèo, tà áo dài tung bay)
      this.dongThay.coverScarf.visible = false
      for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
        this.dongThay.headgearGroups[k].visible = k === resolvedDeityId
      }
      this.setActiveProps(theme.prop)

      const t = elapsed * 2.4
      const dx = Math.sin(t) * 1.15
      const dz = 0.4 + Math.sin(t * 2) * 0.55
      const bounce = Math.abs(Math.sin(t * 3)) * 0.055
      this.dongThay.root.position.set(dx, FLOOR_Y + 0.09 + bounce, dz)
      this.dongThay.root.rotation.y = Math.sin(t) * 0.68

      const legSwing = Math.sin(t * 3) * 0.48
      this.dongThay.leftLeg.rotation.x = legSwing
      this.dongThay.rightLeg.rotation.x = -legSwing

      const legMax = Math.abs(legSwing)
      this.dongThay.skirtPivot.rotation.x = -(0.10 + legMax * 0.38)
      this.dongThay.skirtBackPivot.rotation.x = 0.10 + legMax * 0.38

      this.dongThay.upperPivot.rotation.set(0.06, Math.cos(t * 2) * 0.12, Math.sin(t * 2) * 0.06)
      this.dongThay.leftArm.rotation.set(-0.85 + Math.sin(t * 3) * 0.62, 0, -0.35 - Math.cos(t * 2) * 0.25)
      this.dongThay.rightArm.rotation.set(-0.85 - Math.sin(t * 3) * 0.62, 0, 0.35 + Math.cos(t * 2) * 0.25)
      this.dongThay.headGroup.rotation.z = Math.sin(t * 2) * 0.05

      this.auraMat.opacity = 0.55
      this.spotlightMat.opacity = 0.14
      for (const orb of this.blessingOrbs) orb.visible = false
    } else if (step === 'blessing') {
      // Bước 5: Ban lộc cho người tham dự (Túi lộc vàng bay tỏa ra xung quanh)
      this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.8)
      this.dongThay.root.rotation.y = 0
      this.dongThay.coverScarf.visible = false
      for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
        this.dongThay.headgearGroups[k].visible = k === resolvedDeityId
      }
      this.setActiveProps('none')

      this.dongThay.upperPivot.rotation.set(0, Math.sin(elapsed * 3) * 0.12, 0)
      this.dongThay.leftArm.rotation.set(-0.75 + Math.sin(elapsed * 5) * 0.35, 0, -0.42)
      this.dongThay.rightArm.rotation.set(-0.75 + Math.cos(elapsed * 5) * 0.35, 0, 0.42)
      this.dongThay.leftLeg.rotation.x = 0
      this.dongThay.rightLeg.rotation.x = 0
      this.dongThay.skirtPivot.rotation.x = -0.06
      this.dongThay.skirtBackPivot.rotation.x = 0.06

      this.auraMat.opacity = 0.75
      this.spotlightMat.opacity = 0.18

      // Hiệu ứng 8 túi lộc vàng bay ra theo hình vòng cung về phía khán giả
      for (let i = 0; i < this.blessingOrbs.length; i++) {
        const orb = this.blessingOrbs[i]!
        orb.visible = true
        const phase = (elapsed * 0.85 + i * 0.125) % 1.0
        const angle = -0.9 + (i / (this.blessingOrbs.length - 1)) * 1.8
        const r = 0.6 + phase * 6.5
        orb.position.set(
          Math.sin(angle) * r,
          FLOOR_Y + 0.9 + Math.sin(phase * Math.PI) * 1.6,
          0.8 + Math.cos(angle) * r
        )
        orb.rotation.y = elapsed * 4.0 + i
      }
    } else {
      // Bước 6: Thánh Thăng (Xe giá hồi cung)
      this.dongThay.root.position.set(0, FLOOR_Y + 0.09, 0.4)
      this.dongThay.root.rotation.y = 0
      this.dongThay.upperPivot.rotation.set(0, 0, 0)
      this.dongThay.coverScarf.visible = true
      for (const k of Object.keys(this.dongThay.headgearGroups) as HauDongDeityId[]) {
        this.dongThay.headgearGroups[k].visible = false
      }
      this.setActiveProps('none')
      this.dongThay.leftArm.rotation.set(-0.55, 0, -0.3)
      this.dongThay.rightArm.rotation.set(-0.55, 0, 0.3)
      this.dongThay.leftLeg.rotation.x = 0
      this.dongThay.rightLeg.rotation.x = 0
      this.dongThay.skirtPivot.rotation.x = 0
      this.dongThay.skirtBackPivot.rotation.x = 0
      this.auraMat.opacity = 0.2
      this.spotlightMat.opacity = 0.05
      for (const orb of this.blessingOrbs) orb.visible = false
    }
  }

  public registerColliders(collisionWorld: CollisionWorld) {
    if (collisionWorld.has('hau_dong_terrace')) return

    // 1. Thềm Điện Thờ Tứ Phủ (walkable floor y = 0.90)
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_terrace',
        new THREE.Vector3(XC, FLOOR_Y * 0.5, ZC + 0.4),
        new THREE.Vector3(22.0, FLOOR_Y, 20.8),
        false,
        true,
        FLOOR_Y
      )
    )

    // 2. 5 Bậc thang đá mặt Nam (walkable steps) & 2 Lan can rồng đá
    const steps = 5
    const stepH = FLOOR_Y / steps
    const stepD = 0.45
    for (let i = 0; i < steps; i++) {
      const h = stepH * (steps - i)
      const z = ZC + 10.8 + stepD * (i + 0.5)
      collisionWorld.add(
        new BoxCollider(
          `hau_dong_step_${i}`,
          new THREE.Vector3(XC, h * 0.5, z),
          new THREE.Vector3(8.4, h, stepD + 0.08),
          false,
          true,
          h
        )
      )
    }
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_stair_rail_left',
        new THREE.Vector3(XC - 4.4, 0.75, ZC + 11.95),
        new THREE.Vector3(0.55, 1.5, 2.35),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_stair_rail_right',
        new THREE.Vector3(XC + 4.4, 0.75, ZC + 11.95),
        new THREE.Vector3(0.55, 1.5, 2.35),
        false
      )
    )

    // 3. Hệ thống Tường Bốn Phía (Bắc, Tây, Đông, và 2 cánh Tường Mặt Tiền Nam) + Cột Cửa
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_wall_north',
        new THREE.Vector3(XC, 3.2, ZC - 8.75),
        new THREE.Vector3(20.4, 6.4, 0.85),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_wall_west',
        new THREE.Vector3(XC - 9.75, 3.2, ZC),
        new THREE.Vector3(0.85, 6.4, 18.4),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_wall_east',
        new THREE.Vector3(XC + 9.75, 3.2, ZC),
        new THREE.Vector3(0.85, 6.4, 18.4),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_wall_south_left',
        new THREE.Vector3(XC - 7.55, 3.2, ZC + 8.75),
        new THREE.Vector3(4.9, 6.4, 0.85),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_wall_south_right',
        new THREE.Vector3(XC + 7.55, 3.2, ZC + 8.75),
        new THREE.Vector3(4.9, 6.4, 0.85),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_col_inner_left',
        new THREE.Vector3(XC - 1.9, 3.2, ZC + 8.75),
        new THREE.Vector3(0.65, 6.4, 0.65),
        false
      )
    )
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_col_inner_right',
        new THREE.Vector3(XC + 1.9, 3.2, ZC + 8.75),
        new THREE.Vector3(0.65, 6.4, 0.65),
        false
      )
    )

    // 4. Chặn Cung Cấm & Ban Thờ Hậu Cung
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_cung_cam',
        new THREE.Vector3(XC, FLOOR_Y + 1.8, ZC - 5.6),
        new THREE.Vector3(18.8, 3.6, 4.4),
        false
      )
    )

    // 5. Hòm Công Đức Mở Đàn (hiên phải mặt tiền)
    collisionWorld.add(
      new BoxCollider(
        'hau_dong_merit_box',
        new THREE.Vector3(XC + 7.35, FLOOR_Y + 0.6, ZC + 9.75),
        new THREE.Vector3(1.55, 1.25, 1.1),
        false
      )
    )
  }
}

