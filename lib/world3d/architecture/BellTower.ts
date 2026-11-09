import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { createCurvedHipRoof } from '../style/RoofBuilder'

/**
 * BellTower (Lầu Chuông low-poly phẳng màu):
 * - Bệ đá 2 tầng (7.2 m / 6.2 m), 4 bậc lên từ hướng Tây, sàn đi lại được (floorY 0.70).
 * - 4 cột gỗ, xà ngang, lan can 3 hướng (Bắc, Nam, Đông), mái 2 tầng cong đầu đao + cổ mái + chóp vàng.
 * - Đại Hồng Chung (bellGroup) và chày gỗ (strikerMesh) lắc nhẹ theo thời gian.
 * - Phần tĩnh gộp bằng SlotBatch, vật liệu dùng chung FlatMaterialFactory, không PointLight.
 */

const COLS: Array<[number, number]> = [
  [-2.2, -2.2],
  [2.2, -2.2],
  [-2.2, 2.2],
  [2.2, 2.2]
]
const COL_H = 4.2
const COL_Y = 2.7
const FLOOR_Y = 0.7
const STEP_COUNT = 4
const STEP_H = FLOOR_Y / STEP_COUNT
const STEP_TREAD = 0.35
const STEP_WIDTH = 2.4

const RAILINGS = [
  { pos: [0, 1.25, -2.2], size: [4.4, 0.8, 0.12] }, // Bắc
  { pos: [0, 1.25, 2.2], size: [4.4, 0.8, 0.12] }, // Nam
  { pos: [2.2, 1.25, 0], size: [0.12, 0.8, 4.4] } // Đông
]

export class BellTower {
  public root: THREE.Group = new THREE.Group()
  public bellMesh!: THREE.Mesh
  public strikerMesh!: THREE.Mesh
  public bellGroup!: THREE.Group
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

    // --- Bệ đá 2 tầng + sàn gỗ ---
    b.box('stone', 7.2, 0.35, 7.2, 0, 0.175, 0)
    b.box('stone', 6.2, 0.35, 6.2, 0, 0.525, 0)
    b.box('wood', 5.8, 0.06, 5.8, 0, FLOOR_Y + 0.01, 0)

    // --- Bậc thềm hướng Tây ---
    for (let i = 0; i < STEP_COUNT; i++) {
      const h = (i + 1) * STEP_H
      b.box('stone', STEP_TREAD + 0.02, h, STEP_WIDTH, this.stepRelX(i), h * 0.5, 0)
    }

    // --- 4 cột gỗ + chân tảng ---
    COLS.forEach(([cx, cz]) => {
      b.cylinder('stone', 0.34, 0.42, 0.25, 8, cx, 0.82, cz)
      b.cylinder('woodDark', 0.24, 0.28, COL_H, 8, cx, COL_Y, cz)
    })

    // --- Xà ngang liên kết 4 cột ---
    for (const cz of [-2.2, 2.2]) b.box('woodDark', 4.8, 0.24, 0.24, 0, 4.6, cz)
    for (const cx of [-2.2, 2.2]) b.box('woodDark', 0.24, 0.24, 4.8, cx, 4.6, 0)

    // --- Lan can: thanh ngang trên, dưới và con tiện ---
    RAILINGS.forEach((r) => {
      const [px, py, pz] = r.pos as [number, number, number]
      const [sx, , sz] = r.size as [number, number, number]
      const alongX = sx > sz
      const len = alongX ? sx : sz
      b.box('woodDark', sx, 0.1, sz, px, py + 0.38, pz)
      b.box('woodDark', sx, 0.08, sz, px, py - 0.34, pz)
      for (let k = 0; k <= 8; k++) {
        const o = -len * 0.5 + 0.1 + (k * (len - 0.2)) / 8
        b.box('wood', alongX ? 0.07 : sx, 0.7, alongX ? sz : 0.07, alongX ? px + o : px, py, alongX ? pz : pz + o)
      }
    })

    // --- Mái tầng dưới ---
    const lowerRoof = createCurvedHipRoof({
      eaveW: 6.6,
      eaveD: 6.6,
      height: 1.6,
      ridgeW: 2.0,
      ridgeD: 2.0,
      lift: 0.9
    })
    b.add('roof', lowerRoof, { position: [0, 4.8, 0] }, true)

    // --- Cổ mái giữa hai tầng (khung gỗ + tường nhỏ) ---
    b.box('wall', 2.8, 0.8, 2.8, 0, 5.8, 0)
    b.box('woodDark', 3.0, 0.12, 3.0, 0, 5.4, 0)
    b.box('woodDark', 3.0, 0.12, 3.0, 0, 6.2, 0)

    // --- Mái tầng trên ---
    const upperRoof = createCurvedHipRoof({
      eaveW: 4.8,
      eaveD: 4.8,
      height: 1.5,
      ridgeW: 0.5,
      ridgeD: 0.5,
      lift: 1.1
    })
    b.add('roof', upperRoof, { position: [0, 6.2, 0] }, true)

    // --- Chóp nóc và đầu đao mạ vàng ---
    b.cone('gold', 0.22, 0.9, 6, 0, 7.8 + 0.1, 0)
    b.sphere('gold', 0.2, 0, 0, 7.55, 0)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cone('gold', 0.13, 0.5, 5, sx * 3.15, 4.8 + 0.9 + 0.22, sz * 3.15)
      }
    }

    return b.build({ name: 'bell_tower_static', castShadow: true, receiveShadow: true })
  }

  /** Đại Hồng Chung và chày gỗ: hai phần động nên tách khỏi batch tĩnh. */
  private buildBell() {
    const mats = FlatMaterialFactory.getInstance()
    const gold = mats.get('gold')
    const wood = mats.get('woodDark')

    this.bellGroup = new THREE.Group()
    this.bellGroup.name = 'bell_group'
    this.bellGroup.position.set(0, 3.4, 0)

    // Thân chuông: hình nón cụt 8 mặt, hơi loe ở miệng
    this.bellMesh = new THREE.Mesh(LowPolyBuilder.cylinder(0.52, 0.88, 1.5, 8), gold)
    this.bellMesh.name = 'great_bell'
    this.bellMesh.position.y = -0.1
    this.bellMesh.castShadow = true
    this.bellGroup.add(this.bellMesh)

    // Vai chuông (vòm) và quai treo
    const shoulder = new THREE.Mesh(LowPolyBuilder.cylinder(0.3, 0.52, 0.2, 8), gold)
    shoulder.position.y = 0.75
    this.bellGroup.add(shoulder)
    const hanger = new THREE.Mesh(LowPolyBuilder.cylinder(0.09, 0.09, 0.4, 6), wood)
    hanger.position.y = 1.05
    this.bellGroup.add(hanger)

    // Đai chuông và núm
    const band = new THREE.Mesh(LowPolyBuilder.cylinder(0.84, 0.9, 0.12, 8), wood)
    band.position.y = -0.74
    this.bellGroup.add(band)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const boss = new THREE.Mesh(LowPolyBuilder.sphere(0.09, 0), gold)
      boss.position.set(Math.cos(a) * 0.68, 0.25, Math.sin(a) * 0.68)
      this.bellGroup.add(boss)
    }
    this.root.add(this.bellGroup)

    // Chày gỗ treo ngang phía Đông, hai dây treo từ xà
    this.strikerMesh = new THREE.Mesh(LowPolyBuilder.cylinder(0.1, 0.12, 1.6, 6), wood)
    this.strikerMesh.name = 'bell_striker'
    this.strikerMesh.rotation.z = Math.PI / 2
    this.strikerMesh.position.set(1.5, 3.1, 0)
    this.strikerMesh.castShadow = true
    this.root.add(this.strikerMesh)

    for (const rx of [1.1, 1.9]) {
      const rope = new THREE.Mesh(LowPolyBuilder.cylinder(0.02, 0.02, 1.4, 4), wood)
      rope.position.set(rx, 3.85, 0)
      this.root.add(rope)
    }
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

  public swingBell(_delta: number, elapsed: number) {
    this.bellGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.03
    this.strikerMesh.rotation.y = Math.sin(elapsed * 1.5 + 0.5) * 0.05
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    // Vật liệu Flat dùng chung FlatMaterialFactory nên không dispose ở đây
  }
}
