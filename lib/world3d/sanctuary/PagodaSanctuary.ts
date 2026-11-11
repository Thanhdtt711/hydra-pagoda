import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { HallLayout, type SanctuaryDoor } from '../world/HallLayout'
import { MapLayout } from '../world/MapLayout'
import { SacredBuddhaStatue } from './SacredBuddhaStatue'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { createCurvedHipRoof } from '../style/RoofBuilder'
import { createPlaqueTexture } from '../utils/PlaqueTexture'
import { PixelCandleSystem } from '../fx/PixelCandleSystem'

/**
 * PagodaSanctuaryHall (Chánh Điện low-poly phẳng màu 28 x 22 m):
 * - Toàn bộ kiến trúc tĩnh gộp bằng SlotBatch (mỗi slot màu một Mesh) nên tự đổi màu theo ngày / hoàng hôn / đêm.
 * - 3 cửa chính mặt Nam + 2 cửa phụ hông (cánh cửa xoay mở vào trong, có collider động).
 * - Mái hai tầng chồng diêm, đầu đao vểnh (createCurvedHipRoof).
 * - ~256 đệm thiền = đúng 1 InstancedMesh theo HallLayout.getMeditationSlots().
 * - Một tôn tượng Phật duy nhất trên bệ Tam Bảo; tối đa 3 PointLight nội thất, không đổ bóng.
 *
 * Hệ tọa độ: group đặt tại (0, 0, HallLayout.BOUNDS.center.z); vị trí con là tọa độ cục bộ,
 * collider luôn đăng ký theo tọa độ thế giới (z thế giới = ZC + z cục bộ).
 */

const FLOOR_Y = HallLayout.DIMENSIONS.floorY // 1.35
const WALL_H = 6.6
const WALL_T = HallLayout.DIMENSIONS.wallThickness // 0.6
const WALL_TOP = FLOOR_Y + WALL_H // 7.95
const HALF_W = HallLayout.DIMENSIONS.width / 2 // 14
const HALF_D = HallLayout.DIMENSIONS.depth / 2 // 11
const ZC = HallLayout.BOUNDS.center.z // -10.5

const FRONT_Z = HALF_D - WALL_T / 2 // 10.7 (tường mặt tiền, cục bộ)
const BACK_Z = -(HALF_D - WALL_T / 2) // -10.7 (tường hậu)
const SIDE_X = HALF_W - WALL_T / 2 // 13.7 (tường hông)

const ALTAR_LOCAL_Z = -8.4 // world z = -18.9
const ALTAR_TOP_Y = 2.1
const PORCH_Z = 12.0
const PORCH_XS = [-13.5, -8.25, -2.75, 2.75, 8.25, 13.5]

export interface SanctuaryDoorInstance {
  data: SanctuaryDoor
  pivotLeft: THREE.Group
  pivotRight: THREE.Group
  collider: BoxCollider
  isOpen: boolean
  currentAngle: number
}

interface LocalBox {
  id: string
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

interface WallGap {
  c: number // tâm khe cửa dọc theo trục tường
  w: number
  h: number
}

export class PagodaSanctuaryHall {
  public group: THREE.Group
  public buddhaStatue: SacredBuddhaStatue

  // Hệ thống cửa tương tác
  public doors: Map<string, SanctuaryDoorInstance> = new Map()
  public doorAngle = 0 // Tương thích API cũ
  public doorTargetAngle = 0
  public isDoorManual = false

  // Điểm sáng nội thất (tối đa 3, không đổ bóng)
  public interiorLights: THREE.PointLight[] = []
  public interiorFactor = 0

  // Đệm thiền: 1 InstancedMesh
  public meditationMatsMesh: THREE.InstancedMesh

  private colliderBoxes: LocalBox[] = []
  private ownedMaterials: THREE.Material[] = []
  private ownedTextures: THREE.Texture[] = []

  public get buddhaGroup(): THREE.Group {
    return this.buddhaStatue.root
  }

  public get mandalaHalo(): THREE.Mesh {
    return this.buddhaStatue.haloMesh
  }

  constructor(collisionWorld?: CollisionWorld) {
    this.group = new THREE.Group()
    this.group.name = 'PagodaSanctuaryHall'
    this.group.position.set(HallLayout.BOUNDS.center.x, 0, ZC)

    // 1. Kiến trúc tĩnh (bệ, sàn, cột, tường, mái, bàn thờ, đèn lồng)
    const staticGroup = this.buildStructure()
    this.group.add(staticGroup)

    // 2. 5 cánh cửa xoay + biển hiệu
    this.buildDoors()
    this.buildPlaque()

    // 3. Tôn tượng Phật duy nhất trên bệ
    this.buddhaStatue = new SacredBuddhaStatue()
    this.buddhaStatue.root.position.set(0, ALTAR_TOP_Y, ALTAR_LOCAL_Z)
    this.group.add(this.buddhaStatue.root)

    // 4. Đệm thiền
    this.meditationMatsMesh = this.buildMeditationMats()
    this.group.add(this.meditationMatsMesh)

    // 5. Ánh sáng nội thất
    this.setupInteriorLighting()

    // 6. Ngọn nến lung linh Pixel Art (Bệ Tam Bảo & Bàn Lễ)
    this.initPixelCandles()

    if (collisionWorld) {
      this.registerColliders(collisionWorld)
      this.registerStructureColliders(collisionWorld)
    }
  }

  // ---------------------------------------------------------------------------
  // Colliders
  // ---------------------------------------------------------------------------

  /** Sàn thềm + 8 bậc thang mặt Nam (mỗi bậc <= 0.17m). Gọi nhiều lần vẫn an toàn. */
  public registerColliders(collisionWorld: CollisionWorld) {
    if (collisionWorld.has('hall_terrace_floor')) return

    const t = HallLayout.TERRACE
    collisionWorld.add(
      new BoxCollider(
        'hall_terrace_floor',
        new THREE.Vector3(0, t.height * 0.5, t.centerZ),
        new THREE.Vector3(t.width, t.height, t.depth),
        false,
        true,
        t.height
      )
    )

    const st = MapLayout.SANCTUARY_STAIRS
    const stepH = st.stepRiser
    const stepD = st.stepTread
    for (let i = 0; i < st.stepsCount; i++) {
      const floorY = (i + 1) * stepH
      const worldZ = st.startZ + (st.stepsCount - 1 - i + 0.5) * stepD
      collisionWorld.add(
        new BoxCollider(
          `hall_front_step_${i}`,
          new THREE.Vector3(0, floorY * 0.5, worldZ),
          new THREE.Vector3(st.width, floorY, stepD + 0.04),
          false,
          true,
          floorY
        )
      )
    }
  }

  /** Tường, cột, hiên, bàn thờ và collider cửa. */
  private registerStructureColliders(collisionWorld: CollisionWorld) {
    if (collisionWorld.has('hall_wall_north')) return

    for (const b of this.colliderBoxes) {
      collisionWorld.add(
        new BoxCollider(b.id, new THREE.Vector3(b.x, b.y, b.z + ZC), new THREE.Vector3(b.w, b.h, b.d), false)
      )
    }

    HallLayout.COLUMNS.forEach((c, i) => {
      collisionWorld.add(
        new CylinderCollider(`hall_col_${i}`, new THREE.Vector3(c.x, FLOOR_Y + 3.15, c.z), c.r + 0.05, 6.3, false)
      )
    })

    PORCH_XS.forEach((x, i) => {
      collisionWorld.add(
        new CylinderCollider(`hall_porch_${i}`, new THREE.Vector3(x, FLOOR_Y + 2.95, PORCH_Z + ZC), 0.34, 5.9, false)
      )
    })

    for (const door of this.doors.values()) {
      collisionWorld.add(door.collider)
    }
  }

  // ---------------------------------------------------------------------------
  // Kiến trúc tĩnh
  // ---------------------------------------------------------------------------

  private buildStructure(): THREE.Group {
    const b = new SlotBatch()
    const T = HallLayout.TERRACE
    const ST = MapLayout.SANCTUARY_STAIRS

    // --- Thềm đá & bậc thang ---
    b.box('stone', T.width, T.height, T.depth, 0, T.height * 0.5, T.centerZ - ZC)
    for (let i = 0; i < ST.stepsCount; i++) {
      const floorY = (i + 1) * ST.stepRiser
      const localZ = ST.startZ + (ST.stepsCount - 1 - i + 0.5) * ST.stepTread - ZC
      b.box('stone', ST.width, floorY, ST.stepTread, 0, floorY * 0.5, localZ)
    }
    // Lan can đá hai bên bậc thang
    for (const sx of [-1, 1]) {
      b.box('stone', 0.4, 0.7, ST.totalDepth + 0.4, sx * (ST.width * 0.5 + 0.2), 0.45, ST.startZ + ST.totalDepth * 0.5 - ZC)
    }

    // --- Sàn gỗ trong lòng điện + thảm ngự đạo ---
    const interiorW = HALF_W * 2 - WALL_T * 2
    const interiorD = HALF_D * 2 - WALL_T * 2
    b.box('wood', interiorW, 0.025, interiorD, 0, FLOOR_Y + 0.0125, 0)
    const runnerFrontZ = HALF_D - WALL_T - 0.1
    const runnerBackZ = ALTAR_LOCAL_Z + 1.9 + 0.3
    b.box('cloth', HallLayout.AISLES.centralWidth, 0.02, runnerFrontZ - runnerBackZ, 0, FLOOR_Y + 0.035, (runnerFrontZ + runnerBackZ) * 0.5)

    // --- Tường có khe cửa ---
    const mainGaps: WallGap[] = HallLayout.DOORS.filter((d) => d.isMain).map((d) => ({ c: d.position.x, w: d.width, h: d.height }))
    const sideGaps = (isWest: boolean): WallGap[] =>
      HallLayout.DOORS.filter((d) => !d.isMain && d.position.x < 0 === isWest).map((d) => ({
        c: d.position.z - ZC,
        w: d.width,
        h: d.height
      }))

    this.addWallRun(b, 'hall_wall_front', 'x', FRONT_Z, -(HALF_W - 0.85), HALF_W - 0.85, mainGaps)
    this.addWallRun(b, 'hall_wall_north', 'x', BACK_Z, -(HALF_W - 0.85), HALF_W - 0.85, [])
    this.addWallRun(b, 'hall_wall_west', 'z', -SIDE_X, -(HALF_D - 0.85), HALF_D - 0.85, sideGaps(true))
    this.addWallRun(b, 'hall_wall_east', 'z', SIDE_X, -(HALF_D - 0.85), HALF_D - 0.85, sideGaps(false))

    // Cột góc (nhô ra ngoài mặt tường 6cm và tách khỏi tường để triệt tiêu hoàn toàn Z-fighting) và dầm đỉnh tường
    const colH = WALL_H - 0.4
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box('woodDark', 0.98, colH, 0.98, sx * (HALF_W - 0.43), FLOOR_Y + colH * 0.5, sz * (HALF_D - 0.43))
      }
    }
    b.box('woodDark', HALF_W * 2 + 0.24, 0.42, 0.96, 0, WALL_TOP - 0.19, FRONT_Z)
    b.box('woodDark', HALF_W * 2 + 0.24, 0.42, 0.96, 0, WALL_TOP - 0.19, BACK_Z)
    b.box('woodDark', 0.96, 0.42, HALF_D * 2 - 1.6, -SIDE_X, WALL_TOP - 0.19, 0)
    b.box('woodDark', 0.96, 0.42, HALF_D * 2 - 1.6, SIDE_X, WALL_TOP - 0.19, 0)

    // --- 4 cột cái trong lòng điện ---
    HallLayout.COLUMNS.forEach((c) => {
      const lz = c.z - ZC
      b.cylinder('stone', 0.55, 0.62, 0.3, 8, c.x, FLOOR_Y + 0.15, lz)
      b.cylinder('wood', c.r * 0.88, c.r, 6.0, 8, c.x, FLOOR_Y + 0.3 + 3.0, lz)
      b.box('woodDark', 1.0, 0.3, 1.0, c.x, 7.4, lz)
    })

    // --- Trần & xà ---
    b.box('wood', interiorW, 0.1, interiorD, 0, 7.85, 0)
    for (const z of [-6, 0, 6]) b.box('woodDark', interiorW, 0.3, 0.45, 0, 7.55, z)
    for (const x of [-8, 8]) b.box('woodDark', 0.45, 0.35, interiorD, x, 7.5, 0)

    // --- Hiên trước: 6 cột + xà ---
    PORCH_XS.forEach((x) => {
      b.cylinder('stone', 0.42, 0.48, 0.25, 8, x, FLOOR_Y + 0.125, PORCH_Z)
      b.cylinder('wood', 0.27, 0.32, 5.9, 8, x, FLOOR_Y + 0.25 + 2.95, PORCH_Z)
    })
    b.box('woodDark', 28.0, 0.3, 0.5, 0, 7.45, PORCH_Z)

    // --- Mái hai tầng ---
    const lowerRoof = createCurvedHipRoof({
      eaveW: 31.2,
      eaveD: 25.2,
      height: 2.4,
      ridgeW: 19,
      ridgeD: 12,
      lift: 0.9,
      capTop: false
    })
    b.add('roof', lowerRoof, { position: [0, 7.7, 0] }, true)

    // Tầng gác mái (clerestory) giữa hai mái (tách mặt phẳng giữa tường và khung gỗ để không Z-fighting)
    b.box('wall', 18.8, 1.5, 11.8, 0, 10.55, 0)
    b.box('woodDark', 19.3, 0.32, 12.3, 0, 11.46, 0)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box('woodDark', 0.48, 1.5, 0.48, sx * 9.45, 10.55, sz * 5.95)
      }
    }

    const upperRoof = createCurvedHipRoof({
      eaveW: 23.4,
      eaveD: 16.4,
      height: 2.4,
      ridgeW: 12.5,
      ridgeD: 3,
      lift: 0.8,
      capTop: true
    })
    b.add('roof', upperRoof, { position: [0, 11.4, 0] }, true)

    // Đầu đao & chóp nóc mạ vàng
    for (const sx of [-1, 1]) {
      b.cone('gold', 0.3, 0.9, 6, sx * 6.25, 11.4 + 2.4 + 0.45, 0)
      for (const sz of [-1, 1]) {
        b.cone('gold', 0.17, 0.7, 5, sx * 15.6, 7.7 + 0.9 + 0.35, sz * 12.6)
        b.cone('gold', 0.14, 0.6, 5, sx * 11.7, 11.4 + 0.8 + 0.3, sz * 8.2)
      }
    }

    // --- Bệ Tam Bảo ---
    const alt = HallLayout.ALTAR_BOUNDS
    const altarW = alt.maxX - alt.minX
    const altarD = alt.maxZ - alt.minZ
    b.box('stone', altarW, 0.45, altarD, 0, FLOOR_Y + 0.225, ALTAR_LOCAL_Z)
    b.box('woodDark', altarW * 0.76, 0.3, altarD * 0.78, 0, FLOOR_Y + 0.45 + 0.15, ALTAR_LOCAL_Z)
    // Đài sen nhỏ dưới chân tượng
    b.cylinder('lotus', 1.7, 1.9, 0.0001, 8, 0, ALTAR_TOP_Y, ALTAR_LOCAL_Z) // giữ slot lotus hiện diện trong batch

    // =========================================================================
    // 1. ĐỒ THỜ TRÊN BỆ TAM BẢO (Chân nến đồng đúc & Bình gốm cắm hoa sen)
    // =========================================================================
    for (const sx of [-1, 1]) {
      // --- Chân nến đồng đại cổ truyền (sx * 3.7) ---
      const nx = sx * 3.7
      const nz = ALTAR_LOCAL_Z + 0.9
      b.cylinder('gold', 0.16, 0.28, 0.12, 12, nx, ALTAR_TOP_Y + 0.06, nz) // Đế chuông đồng loe rộng
      b.cylinder('gold', 0.09, 0.14, 0.18, 12, nx, ALTAR_TOP_Y + 0.21, nz) // Cột tiện thắt eo
      b.cylinder('gold', 0.18, 0.18, 0.08, 12, nx, ALTAR_TOP_Y + 0.34, nz) // Bầu tròn giữa cột
      b.cylinder('gold', 0.09, 0.12, 0.12, 12, nx, ALTAR_TOP_Y + 0.44, nz) // Cổ vuốt thon
      b.cylinder('gold', 0.22, 0.14, 0.04, 14, nx, ALTAR_TOP_Y + 0.50, nz) // Đĩa sen đồng hứng sáp loe tròn
      b.cylinder('gold', 0.08, 0.08, 0.04, 10, nx, ALTAR_TOP_Y + 0.53, nz) // Cốc nến đúc đứng

      // --- Bình gốm sứ men lam cắm hoa sen dâng Phật (sx * 2.85) ---
      const vx = sx * 2.85
      const vz = ALTAR_LOCAL_Z + 1.0
      b.cylinder('gold', 0.18, 0.22, 0.06, 12, vx, ALTAR_TOP_Y + 0.03, vz) // Đế đôn đồng viền bình
      b.cylinder('wall', 0.24, 0.17, 0.18, 14, vx, ALTAR_TOP_Y + 0.15, vz) // Đáy bụng bình gốm
      b.cylinder('wall', 0.26, 0.24, 0.18, 14, vx, ALTAR_TOP_Y + 0.33, vz) // Thân bình phình bầu bĩnh
      b.cylinder('wall', 0.16, 0.26, 0.14, 14, vx, ALTAR_TOP_Y + 0.49, vz) // Vai bình thắt nhẹ
      b.cylinder('wall', 0.12, 0.15, 0.16, 12, vx, ALTAR_TOP_Y + 0.64, vz) // Cổ bình vuốt thon
      b.cylinder('gold', 0.19, 0.12, 0.05, 14, vx, ALTAR_TOP_Y + 0.74, vz) // Miệng bình loe viền kim

      // Bó hoa sen thanh khiết vươn lên từ miệng bình:
      // Cành 1: Cành sen cao ở giữa với búp sen hồng
      b.cylinder('leaf', 0.016, 0.016, 0.52, 6, vx, ALTAR_TOP_Y + 0.98, vz)
      b.cone('leaf', 0.06, 0.08, 8, vx, ALTAR_TOP_Y + 1.24, vz) // Đài sen xanh
      b.cone('lotus', 0.075, 0.18, 10, vx, ALTAR_TOP_Y + 1.34, vz) // Búp sen hồng vươn đỉnh

      // Cành 2: Đóa sen hồng hé nở nghiêng về phía tượng Phật
      const sxOff = sx * -0.09
      b.cylinder('leaf', 0.014, 0.014, 0.42, 6, vx + sxOff, ALTAR_TOP_Y + 0.92, vz + 0.04, 0, 0, sx * 0.22)
      b.cylinder('lotus', 0.11, 0.05, 0.08, 10, vx + sxOff * 1.3, ALTAR_TOP_Y + 1.13, vz + 0.04) // Đài cánh sen xòe
      b.cylinder('gold', 0.04, 0.04, 0.03, 8, vx + sxOff * 1.3, ALTAR_TOP_Y + 1.17, vz + 0.04) // Nhụy hoa vàng

      // Cành 3: Lá sen tròn xanh ngọc vươn nghiêng sang bên
      const lxOff = sx * 0.10
      b.cylinder('leaf', 0.014, 0.014, 0.38, 6, vx + lxOff, ALTAR_TOP_Y + 0.90, vz - 0.04, 0, 0, -sx * 0.25)
      b.cylinder('leaf', 0.13, 0.13, 0.018, 10, vx + lxOff * 1.4, ALTAR_TOP_Y + 1.07, vz - 0.04, 0.2, 0, -sx * 0.3)
    }

    // =========================================================================
    // 2. BÀN LỄ DÂNG HƯƠNG (Bát hương đồng Tam Bảo, Ngũ Quả, Kỷ Nước, Chuông Mõ)
    // =========================================================================
    const tableZ = ALTAR_LOCAL_Z + 3.0
    // Thân bàn gỗ hương cổ truyền chạm khắc
    b.box('woodDark', 3.3, 0.78, 1.05, 0, FLOOR_Y + 0.39, tableZ)
    // Mặt bàn gỗ mít / gỗ hương màu nâu ấm (top tại FLOOR_Y + 0.82)
    b.box('wood', 3.42, 0.04, 1.14, 0, FLOOR_Y + 0.80, tableZ)
    // Nẹp chỉ vàng chạy viền mép bàn (chỉ dày 2cm viền quanh cạnh bàn)
    b.box('gold', 3.46, 0.02, 0.04, 0, FLOOR_Y + 0.80, tableZ + 0.56)
    b.box('gold', 3.46, 0.02, 0.04, 0, FLOOR_Y + 0.80, tableZ - 0.56)
    b.box('gold', 0.04, 0.02, 1.14, 1.72, FLOOR_Y + 0.80, tableZ)
    b.box('gold', 0.04, 0.02, 1.14, -1.72, FLOOR_Y + 0.80, tableZ)

    // Khăn trải thêu nhung đỏ sẫm ở giữa bàn (dày 1.6cm, top tại FLOOR_Y + 0.836, cao hơn mặt gỗ 1.6cm, triệt tiêu hoàn toàn z-fighting)
    b.box('roofDark', 1.45, 0.016, 1.12, 0, FLOOR_Y + 0.828, tableZ)
    b.box('gold', 1.47, 0.018, 0.03, 0, FLOOR_Y + 0.828, tableZ + 0.55) // Tua rua gấm vàng viền trước
    b.box('gold', 1.47, 0.018, 0.03, 0, FLOOR_Y + 0.828, tableZ - 0.55) // Tua rua gấm vàng viền sau

    // --- Bát Hương Đồng Tam Bảo uy nghi ở trung tâm ---
    const ihX = 0
    const ihZ = tableZ + 0.05
    b.cylinder('gold', 0.28, 0.34, 0.07, 14, ihX, FLOOR_Y + 0.871, ihZ) // Đế chân quỳ tam tinh đặt trên khăn
    b.cylinder('gold', 0.35, 0.26, 0.19, 14, ihX, FLOOR_Y + 0.99, ihZ) // Thân bát hương phình tròn
    b.cylinder('gold', 0.37, 0.32, 0.06, 14, ihX, FLOOR_Y + 1.11, ihZ) // Miệng loe gờ chỉ nổi
    b.cylinder('wall', 0.31, 0.31, 0.02, 12, ihX, FLOOR_Y + 1.11, ihZ) // Lòng tro cát vàng mịn
    // Quai rồng / tai mây cong hai bên bát hương
    b.cylinder('gold', 0.035, 0.035, 0.24, 6, -0.40, FLOOR_Y + 1.05, ihZ, 0, 0, 0.35)
    b.cylinder('gold', 0.035, 0.035, 0.24, 6, 0.40, FLOOR_Y + 1.05, ihZ, 0, 0, -0.35)

    // 3 nén nhang trầm đỏ thắm (Tam Bảo Hương) vươn cao với tàn than hồng
    b.cylinder('roofDark', 0.012, 0.012, 0.46, 6, 0, FLOOR_Y + 1.33, ihZ)
    b.cylinder('roofDark', 0.012, 0.012, 0.42, 6, -0.06, FLOOR_Y + 1.31, ihZ)
    b.cylinder('roofDark', 0.012, 0.012, 0.42, 6, 0.06, FLOOR_Y + 1.31, ihZ)
    b.addEmissive('lantern', LowPolyBuilder.sphere(0.018, 0), { position: [0, FLOOR_Y + 1.57, ihZ] })
    b.addEmissive('lantern', LowPolyBuilder.sphere(0.016, 0), { position: [-0.06, FLOOR_Y + 1.53, ihZ] })
    b.addEmissive('lantern', LowPolyBuilder.sphere(0.016, 0), { position: [0.06, FLOOR_Y + 1.53, ihZ] })

    // --- Hai Chân Nến Đồng Cung Đình trên bàn lễ (sx * 1.1, đứng trên mặt gỗ ngoài khăn) ---
    for (const sx of [-1, 1]) {
      const cx = sx * 1.1
      b.cylinder('gold', 0.12, 0.18, 0.08, 12, cx, FLOOR_Y + 0.86, tableZ) // Đáy đế tiếp xúc mặt gỗ 0.82
      b.cylinder('gold', 0.07, 0.10, 0.15, 10, cx, FLOOR_Y + 0.97, tableZ)
      b.cylinder('gold', 0.13, 0.13, 0.06, 12, cx, FLOOR_Y + 1.07, tableZ)
      b.cylinder('gold', 0.07, 0.09, 0.10, 10, cx, FLOOR_Y + 1.15, tableZ)
      b.cylinder('gold', 0.17, 0.11, 0.03, 14, cx, FLOOR_Y + 1.21, tableZ) // Đĩa sen hứng sáp nến
      b.cylinder('gold', 0.07, 0.07, 0.03, 8, cx, FLOOR_Y + 1.23, tableZ) // Cốc nến đúc
    }

    // --- Mâm Bồng Ngũ Quả dâng Phật (phía trước bát hương, trên khăn) ---
    const fruitZ = tableZ + 0.35
    b.cylinder('gold', 0.09, 0.15, 0.07, 10, 0, FLOOR_Y + 0.871, fruitZ) // Chân đế đĩa bồng
    b.cylinder('gold', 0.28, 0.16, 0.04, 14, 0, FLOOR_Y + 0.92, fruitZ) // Đĩa bồng chân cao loe tròn
    b.sphere('leaf', 0.10, 1, 0, FLOOR_Y + 1.01, fruitZ) // Quả bưởi xanh tròn phúc hậu
    b.sphere('gold', 0.062, 1, -0.09, FLOOR_Y + 0.98, fruitZ + 0.02) // Quýt vàng óng
    b.sphere('gold', 0.062, 1, 0.09, FLOOR_Y + 0.98, fruitZ + 0.02)
    b.sphere('gold', 0.062, 1, 0, FLOOR_Y + 0.98, fruitZ + 0.10)
    b.sphere('gold', 0.062, 1, 0, FLOOR_Y + 0.98, fruitZ - 0.08)

    // --- Bộ Kỷ Tam Chén Nước Thanh Tịnh (phía sau bát hương, trên khăn) ---
    const waterZ = tableZ - 0.25
    b.box('woodDark', 0.52, 0.03, 0.16, 0, FLOOR_Y + 0.851, waterZ) // Khay gỗ hương chạm hoa sen
    for (const cx of [-0.15, 0, 0.15]) {
      b.cylinder('wall', 0.042, 0.028, 0.05, 10, cx, FLOOR_Y + 0.885, waterZ) // Chén ngọc trắng
      b.cylinder('water', 0.036, 0.036, 0.005, 8, cx, FLOOR_Y + 0.905, waterZ) // Nước thanh tịnh
    }

    // --- Mõ Gỗ Tụng Kinh hình cá hóa long (bên phải bàn lễ, trên khăn) ---
    const moX = 0.58
    const moZ = tableZ + 0.15
    b.cylinder('lotus', 0.14, 0.15, 0.03, 10, moX, FLOOR_Y + 0.851, moZ) // Đệm gấm đỏ thêu hoa sen
    b.cylinder('woodDark', 0.11, 0.13, 0.10, 12, moX, FLOOR_Y + 0.91, moZ) // Thân mõ gỗ mít
    b.box('woodDark', 0.05, 0.04, 0.10, moX, FLOOR_Y + 0.96, moZ - 0.06) // Quai mõ chạm khắc
    b.cylinder('roofDark', 0.012, 0.012, 0.16, 6, moX + 0.09, FLOOR_Y + 0.89, moZ + 0.05, 0.3, 0, 0.4) // Dùi gõ mõ

    // --- Chuông Đồng Gia Trì nhỏ (bên trái bàn lễ, trên khăn) ---
    const bellX = -0.58
    const bellZ = tableZ + 0.15
    b.cylinder('lotus', 0.14, 0.15, 0.03, 10, bellX, FLOOR_Y + 0.851, bellZ) // Đệm gấm đỏ đỡ chuông
    b.cylinder('gold', 0.11, 0.06, 0.13, 12, bellX, FLOOR_Y + 0.92, bellZ) // Thân chuông đồng gia trì
    b.cylinder('gold', 0.12, 0.10, 0.03, 12, bellX, FLOOR_Y + 0.865, bellZ) // Miệng chuông loe viền
    b.cylinder('wood', 0.012, 0.012, 0.16, 6, bellX - 0.09, FLOOR_Y + 0.89, bellZ + 0.05, -0.3, 0, 0.4) // Dùi thỉnh chuông

    this.colliderBoxes.push({
      id: 'hall_altar_collider',
      x: 0,
      y: FLOOR_Y + 0.375,
      z: ALTAR_LOCAL_Z,
      w: altarW,
      h: 0.75,
      d: altarD
    })
    this.colliderBoxes.push({
      id: 'hall_altar_table',
      x: 0,
      y: FLOOR_Y + 0.4,
      z: tableZ,
      w: 3.0,
      h: 0.8,
      d: 0.9
    })

    // --- Đèn lồng treo trong điện (phát sáng, không PointLight) ---
    for (const sx of [-10.8, 10.8]) {
      for (const lz of [-8, -2.7, 2.6, 8]) {
        b.cylinder('woodDark', 0.02, 0.02, 1.3, 4, sx, 7.2, lz)
        b.addEmissive('lantern', LowPolyBuilder.box(0.55, 0.75, 0.55), { position: [sx, 6.2, lz] })
        b.box('gold', 0.7, 0.08, 0.7, sx, 6.62, lz)
        b.box('gold', 0.7, 0.08, 0.7, sx, 5.78, lz)
      }
    }

    return b.build({ name: 'hall_static', castShadow: true, receiveShadow: true })
  }

  /** Dựng một đoạn tường dọc trục, chừa khe cửa, thêm lanh tô và khung cửa. */
  private addWallRun(
    b: SlotBatch,
    prefix: string,
    axis: 'x' | 'z',
    fixed: number,
    from: number,
    to: number,
    gaps: WallGap[]
  ) {
    const sorted = [...gaps].sort((p, q) => p.c - q.c)
    const wallH = WALL_H - 0.4
    const midY = FLOOR_Y + wallH * 0.5
    let idx = 0

    const put = (slot: 'wall' | 'woodDark', along: number, h: number, thick: number, pos: number, y: number) => {
      if (axis === 'x') b.box(slot, along, h, thick, pos, y, fixed)
      else b.box(slot, thick, h, along, fixed, y, pos)
    }

    const solid = (a: number, e: number) => {
      const len = e - a
      if (len < 0.05) return
      const mid = (a + e) * 0.5
      put('wall', len, wallH, WALL_T, mid, midY)
      this.colliderBoxes.push(
        axis === 'x'
          ? { id: `${prefix}_${idx++}`, x: mid, y: midY, z: fixed, w: len, h: WALL_H, d: WALL_T }
          : { id: `${prefix}_${idx++}`, x: fixed, y: midY, z: mid, w: WALL_T, h: WALL_H, d: len }
      )
    }

    let cursor = from
    const jambW = 0.35
    const lintelBeamH = 0.30
    for (const g of sorted) {
      const s = g.c - g.w * 0.5
      const e = g.c + g.w * 0.5
      // Dừng khối tường ngay mép ngoài của trụ khung cửa gỗ (s - jambW) để không trùng mặt phẳng tại s
      solid(cursor, s - jambW)

      // Lanh tô tường phía trên xà ngang khung cửa (tách hoàn toàn khỏi khung cửa gỗ)
      const lintelBottom = FLOOR_Y + g.h + lintelBeamH
      const lintelH = Math.max(0.1, FLOOR_Y + wallH - lintelBottom)
      put('wall', g.w + jambW * 2, lintelH, WALL_T, g.c, lintelBottom + lintelH * 0.5)

      // Khung cửa gỗ: 2 trụ đứng + 1 xà ngang (nhô dày hơn tường 8cm mỗi bên)
      put('woodDark', jambW, g.h, WALL_T + 0.16, s - jambW * 0.5, FLOOR_Y + g.h * 0.5)
      put('woodDark', jambW, g.h, WALL_T + 0.16, e + jambW * 0.5, FLOOR_Y + g.h * 0.5)
      put('woodDark', g.w + jambW * 2, lintelBeamH, WALL_T + 0.18, g.c, FLOOR_Y + g.h + lintelBeamH * 0.5)

      cursor = e + jambW
    }
    solid(cursor, to)
  }

  // ---------------------------------------------------------------------------
  // Cửa
  // ---------------------------------------------------------------------------

  private makeLeaf(leafW: number, h: number, dir: 1 | -1): THREE.Group {
    const lb = new SlotBatch()
    lb.box('woodDark', leafW, h, 0.12, dir * leafW * 0.5, h * 0.5, 0)
    lb.box('wood', Math.max(leafW - 0.32, 0.2), Math.max(h - 0.52, 0.2), 0.16, dir * leafW * 0.5, h * 0.5, 0)
    return lb.build({ name: 'door_leaf', castShadow: true, receiveShadow: false })
  }

  private buildDoors() {
    for (const d of HallLayout.DOORS) {
      const frame = new THREE.Group()
      frame.name = `door_frame_${d.id}`
      const west = d.position.x < 0

      if (d.isMain) {
        frame.position.set(d.position.x, 0, FRONT_Z)
      } else {
        frame.position.set(west ? -SIDE_X : SIDE_X, 0, d.position.z - ZC)
        frame.rotation.y = west ? -Math.PI / 2 : Math.PI / 2
      }

      const halfW = d.width * 0.5
      const leafW = (halfW - 0.03) * 0.98
      const leafH = d.height - 0.02

      const pivotLeft = new THREE.Group()
      pivotLeft.position.set(-halfW + 0.02, FLOOR_Y + 0.01, 0)
      pivotLeft.add(this.makeLeaf(leafW, leafH, 1))

      const pivotRight = new THREE.Group()
      pivotRight.position.set(halfW - 0.02, FLOOR_Y + 0.01, 0)
      pivotRight.add(this.makeLeaf(leafW, leafH, -1))

      frame.add(pivotLeft)
      frame.add(pivotRight)
      this.group.add(frame)

      const collider = d.isMain
        ? new BoxCollider(
          `door_collider_${d.id}`,
          new THREE.Vector3(d.position.x, FLOOR_Y + d.height * 0.5, FRONT_Z + ZC),
          new THREE.Vector3(d.width, d.height, WALL_T),
          false
        )
        : new BoxCollider(
          `door_collider_${d.id}`,
          new THREE.Vector3(west ? -SIDE_X : SIDE_X, FLOOR_Y + d.height * 0.5, d.position.z),
          new THREE.Vector3(WALL_T, d.height, d.width),
          false
        )

      this.doors.set(d.id, {
        data: d,
        pivotLeft,
        pivotRight,
        collider,
        isOpen: false,
        currentAngle: 0
      })
    }
  }

  /**
     * Biển "ĐẠI HÙNG BẢO ĐIỆN" (hoành phi): treo ngay trước xà hiên, ở giữa hai cột hiên trung tâm.
     * Canvas 1024x256 (tỷ lệ 4:1 khớp mặt phẳng 6.4 x 1.6 m); chữ tự co vừa khung nên không bao giờ bị cắt.
     */
  private buildPlaque() {
    const tex = createPlaqueTexture({
      text: 'ĐẠI HÙNG BẢO ĐIỆN',
      background: '#1a0f0a',
      border: '#d9a441',
      textColor: '#f6cf74',
      width: 1024,
      height: 256
    })
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), mat)
    plaque.position.set(0, 6.55, PORCH_Z + 0.42)
    plaque.name = 'hall_plaque'
    this.group.add(plaque)
    this.ownedMaterials.push(mat)
    this.ownedTextures.push(tex)
  }

  // ---------------------------------------------------------------------------
  // Đệm thiền
  // ---------------------------------------------------------------------------

  private buildMeditationMats(): THREE.InstancedMesh {
    const slots = HallLayout.getMeditationSlots()
    const r = HallLayout.MAT_RADIUS
    const geo = LowPolyBuilder.cylinder(r * 0.92, r, 0.1, 10)
    const mat = FlatMaterialFactory.getInstance().get('cloth')
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length)
    mesh.name = 'meditation_mats'
    mesh.castShadow = false
    mesh.receiveShadow = true

    const dummy = new THREE.Object3D()
    slots.forEach((s, i) => {
      dummy.position.set(s.x - HallLayout.BOUNDS.center.x, FLOOR_Y + 0.06, s.z - ZC)
      dummy.rotation.set(0, s.yaw, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    return mesh
  }

  // ---------------------------------------------------------------------------
  // Ánh sáng nội thất
  // ---------------------------------------------------------------------------

  private setupInteriorLighting() {
    const buddhaLight = new THREE.PointLight(0xffb040, 1.6, 22, 1.6)
    buddhaLight.position.set(0, FLOOR_Y + 4.6, -6.5)
    buddhaLight.castShadow = false
    this.group.add(buddhaLight)
    this.interiorLights.push(buddhaLight)

    for (const sx of [-1, 1]) {
      const l = new THREE.PointLight(0xff9838, 0.9, 20, 1.8)
      l.position.set(sx * 9.0, FLOOR_Y + 5.2, 2.0)
      l.castShadow = false
      this.group.add(l)
      this.interiorLights.push(l)
    }
  }

  // ---------------------------------------------------------------------------
  // Tương tác & cập nhật
  // ---------------------------------------------------------------------------

  /** Đóng/mở cửa thủ công. */
  public toggleDoor(doorId = 'door_main_center'): boolean {
    const door = this.doors.get(doorId)
    if (!door) return false
    this.isDoorManual = true
    door.isOpen = !door.isOpen
    door.collider.enabled = !door.isOpen
    return door.isOpen
  }

  /** Tự mở cửa khi người chơi đến gần (cửa chính < 4.5m, cửa hông < 3.0m). */
  public checkDoorProximity(playerPos: THREE.Vector3) {
    if (this.isDoorManual) return

    for (const door of this.doors.values()) {
      const dist = Math.hypot(playerPos.x - door.data.position.x, playerPos.z - door.data.position.z)
      const shouldOpen = dist < (door.data.isMain ? 4.5 : 3.0)
      if (door.isOpen !== shouldOpen) {
        door.isOpen = shouldOpen
        door.collider.enabled = !shouldOpen
      }
    }
  }

  /** Người chơi có đang ở trong lòng Chánh Điện không. */
  public isInside(playerPos: THREE.Vector3): boolean {
    const b = HallLayout.BOUNDS.interior
    return (
      playerPos.x >= b.minX &&
      playerPos.x <= b.maxX &&
      playerPos.z >= b.minZ &&
      playerPos.z <= b.maxZ &&
      playerPos.y >= 1.2
    )
  }

  public update(delta: number, arg2?: number | THREE.Vector3, arg3?: THREE.Vector3) {
    const playerPos = arg3 instanceof THREE.Vector3 ? arg3 : arg2 instanceof THREE.Vector3 ? arg2 : undefined
    if (playerPos) {
      this.checkDoorProximity(playerPos)
      const targetFactor = this.isInside(playerPos) ? 1.0 : 0.0
      this.interiorFactor = THREE.MathUtils.lerp(this.interiorFactor, targetFactor, delta * 3.5)
    }

    // Cánh cửa mở vào trong ~81 độ
    for (const door of this.doors.values()) {
      const target = door.isOpen ? 1.42 : 0.0
      door.currentAngle = THREE.MathUtils.lerp(door.currentAngle, target, delta * 6.0)
      door.pivotLeft.rotation.y = door.currentAngle
      door.pivotRight.rotation.y = -door.currentAngle
    }

    this.buddhaStatue.update(delta)

    const elapsed = typeof arg2 === 'number' ? arg2 : undefined
    PixelCandleSystem.getInstance().update(delta, elapsed)
  }

  private initPixelCandles() {
    const candleSys = PixelCandleSystem.getInstance()

    // 2 ngọn nến trên Bệ Tam Bảo hai bên Tôn tượng Phật Thích Ca Mâu Ni
    for (const sx of [-1, 1]) {
      candleSys.addCandle({
        parent: this.group,
        position: [sx * 3.7, ALTAR_TOP_Y + 0.52, ALTAR_LOCAL_Z + 0.9],
        height: 0.65,
        withLight: true,
        lightIntensity: 0.85,
        lightDistance: 5.5,
        lightColor: 0xffa83e,
        timeOffset: sx > 0 ? 0.0 : 1.8
      })
    }

    // 2 ngọn nến trên Bàn Lễ phía trước hai bên lư hương đồng
    const tableZ = ALTAR_LOCAL_Z + 3.0
    for (const sx of [-1, 1]) {
      candleSys.addCandle({
        parent: this.group,
        position: [sx * 1.1, FLOOR_Y + 1.22, tableZ],
        height: 0.52,
        withLight: true,
        lightIntensity: 0.7,
        lightDistance: 4.2,
        lightColor: 0xff9832,
        timeOffset: sx > 0 ? 0.9 : 2.7
      })
    }
  }

  public dispose() {
    this.buddhaStatue.dispose()
    PixelCandleSystem.getInstance().dispose()
    this.group.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    // Vật liệu Flat dùng chung FlatMaterialFactory nên không dispose ở đây
    this.ownedMaterials.forEach((m) => m.dispose())
    this.ownedTextures.forEach((t) => t.dispose())
    this.ownedMaterials = []
    this.ownedTextures = []
    this.doors.clear()
    this.interiorLights = []
    this.colliderBoxes = []
  }
}
