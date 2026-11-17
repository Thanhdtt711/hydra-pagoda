import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { createCurvedHipRoof } from '../style/RoofBuilder'

/**
 * BellTower (Lầu Đại Hồng Chung):
 * - Bệ đá xanh 2 tầng, cầu thang hướng Tây có thành bậc đá và trụ đèn/sen đầu cầu thang.
 * - Sàn gỗ lim (floorY 0.70) có bệ cộng hưởng đá tròn dưới tâm chuông.
 * - 4 cột gỗ lim 12 cạnh + chân tảng đá 2 cấp + đấu củng đỡ mái + xà thượng/hạ + giá treo chuông.
 * - Lan can 3 hướng (Bắc, Nam, Đông) với trụ góc búp sen vàng.
 * - Mái chồng diêm 2 tầng cong đầu đao, cổ diêm có ô cửa gỗ song thưa, nóc tháp búp sen vàng.
 * - Đại Hồng Chung đúc bằng LatheGeometry (24 múi) đồng cổ + đai nổi + núm gõ hoa sen + quai Bồ Lao,
 *   cùng Dùi Kình (chày gỗ) có đầu bọc đồng và vòng sóng âm lan tỏa khi gõ chuông.
 */

const COLS: Array<[number, number]> = [
  [-2.2, -2.2],
  [2.2, -2.2],
  [-2.2, 2.2],
  [2.2, 2.2]
]
const COL_H = 4.2
const COL_Y = 2.75
const FLOOR_Y = 0.7
const STEP_COUNT = 4
const STEP_H = FLOOR_Y / STEP_COUNT
const STEP_TREAD = 0.35
const STEP_WIDTH = 2.4

const RAILINGS = [
  { pos: [0, 1.22, -2.2], size: [4.4, 0.76, 0.12] }, // Bắc
  { pos: [0, 1.22, 2.2], size: [4.4, 0.76, 0.12] }, // Nam
  { pos: [2.2, 1.22, 0], size: [0.12, 0.76, 4.4] } // Đông
]

export class BellTower {
  public root: THREE.Group = new THREE.Group()
  public bellMesh!: THREE.Mesh
  public strikerGroup!: THREE.Group
  public bellGroup!: THREE.Group
  private shockwaveRing!: THREE.Mesh
  private shockwaveMat!: THREE.MeshBasicMaterial
  private bronzeMat!: THREE.MeshStandardMaterial
  private bellGoldMat!: THREE.MeshStandardMaterial

  private strikeElapsed = -1
  private readonly strikeDuration = 3.4

  public position = new THREE.Vector3(
    MapLayout.LANDMARKS.BELL_TOWER.center.x,
    MapLayout.LANDMARKS.BELL_TOWER.center.y,
    MapLayout.LANDMARKS.BELL_TOWER.center.z
  )

  constructor(collision: CollisionWorld) {
    this.root.name = 'BellTower'
    this.root.position.copy(this.position)

    this.root.add(this.buildStructure())
    this.buildBell()
    this.registerColliders(collision)
  }

  private stepRelX(i: number): number {
    return -3.1 - (STEP_COUNT - 1 - i + 0.5) * STEP_TREAD
  }

  private buildStructure(): THREE.Group {
    const b = new SlotBatch()

    // --- 1. Bệ đá xanh 2 tầng + sàn gỗ + bệ cộng hưởng dưới chuông ---
    b.box('stone', 7.35, 0.35, 7.35, 0, 0.175, 0)
    b.box('stone', 6.3, 0.35, 6.3, 0, 0.525, 0)
    b.box('woodDark', 6.0, 0.05, 6.0, 0, FLOOR_Y + 0.005, 0)
    b.box('wood', 5.65, 0.05, 5.65, 0, FLOOR_Y + 0.03, 0)

    // Bệ cộng hưởng tròn bằng đá khắc viền vàng ngay dưới Đại Hồng Chung
    b.cylinder('stone', 1.15, 1.25, 0.08, 12, 0, FLOOR_Y + 0.06, 0)
    b.cylinder('gold', 0.92, 0.96, 0.025, 12, 0, FLOOR_Y + 0.105, 0)

    // --- 2. Bậc thềm hướng Tây + thành bậc đá 2 bên ---
    for (let i = 0; i < STEP_COUNT; i++) {
      const h = (i + 1) * STEP_H
      b.box('stone', STEP_TREAD + 0.02, h, STEP_WIDTH, this.stepRelX(i), h * 0.5, 0)
    }
    for (const sz of [-1.32, 1.32]) {
      b.box('stone', STEP_COUNT * STEP_TREAD + 0.2, 0.52, 0.22, -3.1 - (STEP_COUNT * STEP_TREAD) * 0.5, 0.26, sz)
      b.box('stone', 0.32, 0.72, 0.32, -3.1 - STEP_COUNT * STEP_TREAD - 0.08, 0.36, sz)
      b.sphere('gold', 0.12, 0, -3.1 - STEP_COUNT * STEP_TREAD - 0.08, 0.8, sz)
    }

    // --- 3. 4 cột gỗ lim 12 cạnh + chân tảng đá 2 cấp + đấu củng ---
    COLS.forEach(([cx, cz]) => {
      // Chân tảng đá
      b.cylinder('stone', 0.38, 0.44, 0.16, 8, cx, FLOOR_Y + 0.08, cz)
      b.cylinder('stone', 0.31, 0.36, 0.12, 8, cx, FLOOR_Y + 0.21, cz)
      // Thân cột tròn 12 cạnh
      b.cylinder('woodDark', 0.23, 0.27, COL_H, 12, cx, COL_Y, cz)
      // Vòng cổ cột & đấu củng đỡ mái
      b.box('wood', 0.62, 0.14, 0.62, cx, 4.48, cz)
      b.box('woodDark', 0.78, 0.14, 0.78, cx, 4.65, cz)
    })

    // --- 4. Hệ xà thượng, xà hạ & giá treo Đại Hồng Chung ---
    for (const cz of [-2.2, 2.2]) {
      b.box('woodDark', 4.9, 0.24, 0.24, 0, 4.58, cz)
      b.box('wood', 4.6, 0.14, 0.16, 0, 4.25, cz)
    }
    for (const cx of [-2.2, 2.2]) {
      b.box('woodDark', 0.24, 0.24, 4.9, cx, 4.58, 0)
      b.box('wood', 0.16, 0.14, 4.6, cx, 4.25, 0)
    }
    // Xà chính giữa (giá treo chuông lớn)
    b.box('woodDark', 0.28, 0.3, 4.65, 0, 4.66, 0)
    b.box('gold', 0.34, 0.12, 0.44, 0, 4.56, 0)

    // --- 5. Lan can 3 hướng + trụ góc búp sen ---
    RAILINGS.forEach((r) => {
      const [px, py, pz] = r.pos as [number, number, number]
      const [sx, , sz] = r.size as [number, number, number]
      const alongX = sx > sz
      const len = alongX ? sx : sz
      b.box('woodDark', sx, 0.1, sz, px, py + 0.35, pz)
      b.box('woodDark', sx, 0.08, sz, px, py - 0.32, pz)
      for (let k = 0; k <= 10; k++) {
        const o = -len * 0.5 + 0.12 + (k * (len - 0.24)) / 10
        b.box('wood', alongX ? 0.065 : sx * 0.75, 0.62, alongX ? sz * 0.75 : 0.065, alongX ? px + o : px, py, alongX ? pz : pz + o)
      }
    })
    // Hai trụ búp sen bên lối lên phía Tây
    for (const sz of [-1.25, 1.25]) {
      b.box('woodDark', 0.2, 0.92, 0.2, -2.2, FLOOR_Y + 0.46, sz)
      b.sphere('gold', 0.1, 0, -2.2, FLOOR_Y + 1.0, sz)
    }

    // --- 6. Mái tầng dưới (cong đầu đao) ---
    const lowerRoof = createCurvedHipRoof({
      eaveW: 6.9,
      eaveD: 6.9,
      height: 1.65,
      ridgeW: 2.2,
      ridgeD: 2.2,
      lift: 0.95
    })
    b.add('roof', lowerRoof, { position: [0, 4.78, 0] }, true)

    // --- 7. Cổ diêm giữa hai tầng (khung gỗ + ô cửa song thưa) ---
    b.box('woodDark', 3.05, 0.14, 3.05, 0, 5.42, 0)
    b.box('wall', 2.68, 0.76, 2.68, 0, 5.82, 0)
    // Nan gỗ trang trí trên cổ diêm 4 mặt
    for (const s of [-1, 1]) {
      for (const offset of [-0.7, 0, 0.7]) {
        b.box('woodDark', 0.08, 0.68, 0.08, offset, 5.82, s * 1.36)
        b.box('woodDark', 0.08, 0.68, 0.08, s * 1.36, 5.82, offset)
      }
    }
    b.box('woodDark', 3.12, 0.14, 3.12, 0, 6.22, 0)

    // --- 8. Mái tầng trên + Bờ nóc + Tháp búp sen vàng ---
    const upperRoof = createCurvedHipRoof({
      eaveW: 5.0,
      eaveD: 5.0,
      height: 1.55,
      ridgeW: 0.55,
      ridgeD: 0.55,
      lift: 1.15
    })
    b.add('roof', upperRoof, { position: [0, 6.22, 0] }, true)

    // Đế bát giác + búp sen đỉnh nóc
    b.cylinder('gold', 0.34, 0.42, 0.2, 8, 0, 7.62, 0)
    b.sphere('gold', 0.24, 0, 0, 7.86, 0)
    b.cone('gold', 0.18, 0.82, 8, 0, 8.32, 0)

    // 8 đầu đao mạ vàng ở 2 tầng mái
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cone('gold', 0.13, 0.48, 6, sx * 3.28, 4.78 + 0.95 + 0.2, sz * 3.28)
        b.cone('gold', 0.1, 0.38, 6, sx * 2.38, 6.22 + 1.15 + 0.16, sz * 2.38)
      }
    }

    return b.build({ name: 'bell_tower_static', castShadow: true, receiveShadow: true })
  }

  /** Đại Hồng Chung đúc LatheGeometry 24 múi + Chày gỗ Dùi Kình + Sóng âm cộng hưởng. */
  private buildBell() {
    const mats = FlatMaterialFactory.getInstance()
    const wood = mats.get('woodDark')
    const woodLight = mats.get('wood')

    this.bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x4b3a28,
      metalness: 0.58,
      roughness: 0.38
    })
    this.bellGoldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a843,
      metalness: 0.72,
      roughness: 0.28
    })

    // Điểm treo chuông trên xà chính (y = 4.50) để chuông đung đưa tự nhiên quanh trục treo
    this.bellGroup = new THREE.Group()
    this.bellGroup.name = 'bell_group'
    this.bellGroup.position.set(0, 4.5, 0)

    // Quai chuông Bồ Lao (vòng kép trên đỉnh)
    const hangerStem = new THREE.Mesh(LowPolyBuilder.cylinder(0.08, 0.11, 0.36, 8), this.bronzeMat)
    hangerStem.position.y = -0.18
    this.bellGroup.add(hangerStem)

    const crownLoop = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 8, 16), this.bellGoldMat)
    crownLoop.position.y = -0.26
    this.bellGroup.add(crownLoop)

    // Biên dạng Đại Hồng Chung truyền thống (LatheGeometry 24 múi)
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0.02, 0.0),    // Đỉnh vai
      new THREE.Vector2(0.32, -0.04),
      new THREE.Vector2(0.50, -0.16),  // Vai chuông tròn
      new THREE.Vector2(0.56, -0.35),
      new THREE.Vector2(0.60, -0.68),  // Thân trên
      new THREE.Vector2(0.66, -1.05),  // Thân giữa (chỗ gõ)
      new THREE.Vector2(0.76, -1.35),  // Hơi thắt nhẹ rồi loe
      new THREE.Vector2(0.92, -1.62),  // Miệng chuông loe
      new THREE.Vector2(0.84, -1.65),  // Độ dày vành miệng
      new THREE.Vector2(0.56, -1.10),  // Lòng trong
      new THREE.Vector2(0.42, -0.25),
      new THREE.Vector2(0.02, -0.15)
    ]
    const bellGeo = new THREE.LatheGeometry(profile, 24)
    this.bellMesh = new THREE.Mesh(bellGeo, this.bronzeMat)
    this.bellMesh.name = 'great_bell'
    this.bellMesh.position.y = -0.34
    this.bellMesh.castShadow = true
    this.bellMesh.receiveShadow = true
    this.bellGroup.add(this.bellMesh)

    // 2 vành đai nổi bằng đồng vàng quanh thân chuông
    for (const [ry, r] of [
      [-0.72, 0.575],
      [-1.36, 0.675],
      [-1.92, 0.905]
    ] as const) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.032, 8, 24), this.bellGoldMat)
      band.rotation.x = Math.PI / 2
      band.position.y = ry
      this.bellGroup.add(band)
    }

    // 4 núm gõ hoa sen (tại 4 hướng Đông/Tây/Nam/Bắc, đúng tầm chày gỗ gõ)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const boss = new THREE.Mesh(LowPolyBuilder.cylinder(0.11, 0.13, 0.06, 8), this.bellGoldMat)
      boss.position.set(Math.cos(a) * 0.665, -1.38, Math.sin(a) * 0.665)
      boss.rotation.z = -Math.cos(a) * (Math.PI / 2)
      boss.rotation.x = Math.sin(a) * (Math.PI / 2)
      this.bellGroup.add(boss)
    }

    this.root.add(this.bellGroup)

    // --- Dùi Kình (Chày gỗ lớn treo ngang phía Đông) ---
    // Đặt điểm xoay (pivot) tại vị trí xà ngang phía trên (x = 1.65, y = 4.48, z = 0)
    this.strikerGroup = new THREE.Group()
    this.strikerGroup.name = 'bell_striker_group'
    this.strikerGroup.position.set(1.65, 4.48, 0)

    const strikerLog = new THREE.Mesh(LowPolyBuilder.cylinder(0.105, 0.135, 1.75, 10), wood)
    strikerLog.rotation.z = Math.PI / 2
    strikerLog.position.set(-0.08, -1.36, 0)
    strikerLog.castShadow = true
    this.strikerGroup.add(strikerLog)

    // Đầu chày bọc đồng (nơi va chạm vào núm chuông)
    const strikerCap = new THREE.Mesh(LowPolyBuilder.cylinder(0.11, 0.13, 0.16, 10), this.bellGoldMat)
    strikerCap.rotation.z = Math.PI / 2
    strikerCap.position.set(-0.96, -1.36, 0)
    this.strikerGroup.add(strikerCap)

    // Tay nắm sơn son phía đuôi + dây kéo
    const strikerGrip = new THREE.Mesh(LowPolyBuilder.cylinder(0.095, 0.11, 0.24, 8), woodLight)
    strikerGrip.rotation.z = Math.PI / 2
    strikerGrip.position.set(0.84, -1.36, 0)
    this.strikerGroup.add(strikerGrip)

    const pullCord = new THREE.Mesh(LowPolyBuilder.cylinder(0.015, 0.015, 1.05, 6), woodLight)
    pullCord.position.set(0.86, -1.9, 0)
    this.strikerGroup.add(pullCord)

    // Hai dây treo chày lên xà
    for (const rx of [-0.55, 0.45]) {
      const rope = new THREE.Mesh(LowPolyBuilder.cylinder(0.018, 0.018, 1.36, 6), wood)
      rope.position.set(rx, -0.68, 0)
      this.strikerGroup.add(rope)
    }

    this.root.add(this.strikerGroup)

    // Vòng sóng âm lan tỏa khi gõ chuông
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xfcd535,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    this.shockwaveRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.04, 32), this.shockwaveMat)
    this.shockwaveRing.rotation.x = -Math.PI / 2
    this.shockwaveRing.position.set(0, 2.55, 0)
    this.shockwaveRing.visible = false
    this.root.add(this.shockwaveRing)
  }

  private registerColliders(collision: CollisionWorld) {
    // Bệ lầu chuông là SÀN ĐI LẠI ĐƯỢC (isFloor: true, floorY: 0.70)
    collision.add(
      new BoxCollider(
        'bell_tower_base_floor',
        new THREE.Vector3(this.position.x, 0.35, this.position.z),
        new THREE.Vector3(6.2, 0.7, 6.2),
        false,
        true,
        FLOOR_Y
      )
    )

    // 4 bậc thềm phía Tây (leo bằng WASD không cần nhảy)
    for (let i = 0; i < STEP_COUNT; i++) {
      const floorY = (i + 1) * STEP_H
      collision.add(
        new BoxCollider(
          `bell_tower_step_${i}`,
          new THREE.Vector3(this.position.x + this.stepRelX(i), floorY * 0.5, this.position.z),
          new THREE.Vector3(STEP_TREAD + 0.04, floorY, STEP_WIDTH),
          false,
          true,
          floorY
        )
      )
    }

    COLS.forEach(([cx, cz], i) => {
      collision.add(
        new CylinderCollider(
          `bell_col_${i}`,
          new THREE.Vector3(this.position.x + cx, COL_Y, this.position.z + cz),
          0.32,
          COL_H,
          false
        )
      )
    })

    RAILINGS.forEach((r, i) => {
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

  /** Kích hoạt hoạt ảnh gõ Đại Hồng Chung (vung chày, chuông rung, sóng âm lan tỏa). */
  public ringBell() {
    this.strikeElapsed = 0
    this.shockwaveRing.visible = true
    this.shockwaveRing.scale.setScalar(1)
    this.shockwaveMat.opacity = 0.85
  }

  public swingBell(delta: number, elapsed: number) {
    if (this.strikeElapsed >= 0) {
      this.strikeElapsed += delta
      const t = this.strikeElapsed
      if (t >= this.strikeDuration) {
        this.strikeElapsed = -1
        this.shockwaveRing.visible = false
        this.shockwaveMat.opacity = 0
      } else {
        // 0.0 -> 0.22s: vung chày ra sau; 0.22 -> 0.36s: đánh mạnh vào chuông; sau 0.36s: hồi về êm
        let strikerSwing = 0
        if (t < 0.22) {
          strikerSwing = (t / 0.22) * 0.36
        } else if (t < 0.36) {
          const p = (t - 0.22) / 0.14
          strikerSwing = 0.36 - p * 0.56 // chạm mạnh vào núm chuông ở góc -0.20 rad
        } else {
          const damp = Math.exp(-(t - 0.36) * 2.2)
          strikerSwing = -0.20 * Math.cos((t - 0.36) * 5.2) * damp
        }
        this.strikerGroup.rotation.z = strikerSwing

        // Chuông rung lắc mạnh ngay sau điểm va chạm (t >= 0.34s)
        if (t >= 0.34) {
          const bt = t - 0.34
          const damp = Math.exp(-bt * 1.15)
          this.bellGroup.rotation.z = -Math.sin(bt * 7.5) * 0.12 * damp
          // Sóng âm lan tỏa
          const waveP = Math.min(1, bt / 2.4)
          this.shockwaveRing.scale.setScalar(1 + waveP * 3.6)
          this.shockwaveMat.opacity = Math.max(0, (1 - waveP) * 0.72)
          if (waveP >= 1) this.shockwaveRing.visible = false
        } else {
          this.bellGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.02
        }
        return
      }
    }

    // Trạng thái tĩnh lặng: chuông và chày đung đưa rất nhẹ trong gió
    this.bellGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.022
    this.strikerGroup.rotation.z = Math.sin(elapsed * 1.2 + 0.5) * 0.02
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    this.bronzeMat?.dispose()
    this.bellGoldMat?.dispose()
    this.shockwaveMat?.dispose()
  }
}
