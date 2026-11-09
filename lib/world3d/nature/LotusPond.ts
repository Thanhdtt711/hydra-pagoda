import * as THREE from 'three'
import { CollisionWorld, BoxCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { SeededPRNG } from '../utils/SeededPRNG'

/**
 * LotusPond (Hồ Sen Bát Nhã low-poly phẳng màu):
 * - Mặt nước là đĩa 24 cạnh bán trong suốt (slot 'water'), bờ đá thấp quanh hồ.
 * - Cầu đá vòm bậc thang bắc dọc trục Z, mỗi nấc <= 0.15 m, khớp collider đi bộ.
 * - Lá sen (đĩa dẹt) và hoa sen (nón) rải bằng SeededPRNG, gộp bằng SlotBatch.
 * - Hoa đăng nổi bằng vật liệu emissive, KHÔNG dùng PointLight.
 */

const BRIDGE_WIDTH = 3.2
const BRIDGE_SEGMENTS = 12
const WATER_Y = 0.06

export class LotusPond {
  public root: THREE.Group = new THREE.Group()
  public floatingLanterns: THREE.Group[] = []
  public pondCenter = new THREE.Vector3(
    MapLayout.LANDMARKS.LOTUS_POND.center.x,
    MapLayout.LANDMARKS.LOTUS_POND.center.y,
    MapLayout.LANDMARKS.LOTUS_POND.center.z
  )
  public pondRadius = MapLayout.LANDMARKS.LOTUS_POND.radius || 6.5

  private waterMesh!: THREE.Mesh
  private plantsGroup!: THREE.Group

  constructor(collision: CollisionWorld) {
    this.root.name = 'LotusPond'
    this.root.position.copy(this.pondCenter)

    this.buildWater()
    this.root.add(this.buildStonework())
    this.plantsGroup = this.buildLotusPlants()
    this.root.add(this.plantsGroup)
    this.buildFloatingLanterns()
    this.registerColliders(collision)
  }

  private bridgeLen(): number {
    return this.pondRadius * 2.0
  }

  /** Độ cao mặt cầu theo phân đoạn s (parabol đỉnh 1.15 m, tối thiểu 0.12 m). */
  private segmentFloorY(s: number): number {
    const t = ((s + 0.5) / BRIDGE_SEGMENTS) * 2.0 - 1.0
    return Math.max(0.12, (1.0 - t * t) * 1.15)
  }

  private buildWater() {
    const mat = FlatMaterialFactory.getInstance().get('water', { transparent: true, opacity: 0.88 })
    const geo = LowPolyBuilder.flat(new THREE.CircleGeometry(this.pondRadius - 0.05, 24))
    this.waterMesh = new THREE.Mesh(geo, mat)
    this.waterMesh.name = 'pond_water'
    this.waterMesh.rotation.x = -Math.PI / 2
    this.waterMesh.position.y = WATER_Y
    this.waterMesh.receiveShadow = true
    this.root.add(this.waterMesh)
  }

  private buildStonework(): THREE.Group {
    const b = new SlotBatch()
    const r = this.pondRadius

    // --- Bờ đá quanh hồ (chừa lối vào hai đầu cầu) ---
    const segments = 24
    const curbDist = r + 0.1
    for (let i = 0; i < segments; i++) {
      const mid = ((i + 0.5) / segments) * Math.PI * 2
      const cx = Math.cos(mid) * curbDist
      const cz = Math.sin(mid) * curbDist
      if (Math.abs(cx) < 2.0 && Math.abs(cz) > r - 1.2) continue
      b.box('stone', 1.9, 0.45, 0.55, cx, 0.2, cz, Math.PI / 2 - mid)
    }

    // --- Cầu đá vòm bậc thang ---
    const bridgeLen = this.bridgeLen()
    const segDepth = bridgeLen / BRIDGE_SEGMENTS
    const edgeX = BRIDGE_WIDTH * 0.5 - 0.15
    for (let s = 0; s < BRIDGE_SEGMENTS; s++) {
      const floorY = this.segmentFloorY(s)
      const z = ((s + 0.5) / BRIDGE_SEGMENTS) * bridgeLen - bridgeLen * 0.5
      b.box('stone', BRIDGE_WIDTH, floorY, segDepth + 0.02, 0, floorY * 0.5, z)

      // Gờ lan can hai bên
      for (const sx of [-1, 1]) {
        b.box('stone', 0.3, 0.5, segDepth + 0.02, sx * edgeX, floorY + 0.25, z)
      }
      // Trụ lan can có búp sen vàng ở mỗi nhịp chẵn
      if (s % 2 === 0) {
        for (const sx of [-1, 1]) {
          b.box('stone', 0.4, 0.4, 0.4, sx * edgeX, floorY + 0.7, z)
          b.cone('gold', 0.13, 0.34, 5, sx * edgeX, floorY + 1.07, z)
        }
      }
    }

    return b.build({ name: 'pond_stonework', castShadow: true, receiveShadow: true })
  }

  private buildLotusPlants(): THREE.Group {
    const b = new SlotBatch()
    const rng = new SeededPRNG(20261106)

    // Rải 32 cụm hoa và lá sen quanh hồ, tránh vùng cầu giữa hồ
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + Math.sin(i * 1.7) * 0.4
      const dist = 3.2 + Math.sin(i * 2.3) * 3.0
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      if (Math.abs(x) < 2.3) continue
      if (dist > this.pondRadius - 0.9) continue

      const leafR = 0.5 + rng.next() * 0.4
      b.cylinder('leaf', leafR, leafR, 0.03, 7, x, WATER_Y + 0.03, z)

      if (i % 2 === 0) {
        // Hoa sen: nhụy vàng + nón cánh hồng
        b.cylinder('gold', 0.07, 0.07, 0.06, 6, x + 0.1, WATER_Y + 0.3, z + 0.05)
        b.cone('lotus', 0.2, 0.32, 6, x + 0.1, WATER_Y + 0.2, z + 0.05)
      }
    }

    return b.build({ name: 'pond_lotus', castShadow: false, receiveShadow: false })
  }

  private buildFloatingLanterns() {
    const mats = FlatMaterialFactory.getInstance()
    const base = mats.get('woodDark')
    const glow = mats.emissive('lantern')
    const baseGeo = LowPolyBuilder.box(0.38, 0.06, 0.38)
    const shadeGeo = LowPolyBuilder.box(0.28, 0.32, 0.28)

    const spots = [
      [-4.5, -2.5],
      [-5.8, 3.2],
      [-2.8, 4.5],
      [-3.5, -4.0],
      [4.2, -3.2],
      [5.0, 2.8]
    ]

    spots.forEach(([lx, lz]) => {
      const lantern = new THREE.Group()
      lantern.position.set(lx, WATER_Y + 0.03, lz)

      const bottom = new THREE.Mesh(baseGeo, base)
      lantern.add(bottom)

      const shade = new THREE.Mesh(shadeGeo, glow)
      shade.position.y = 0.19
      lantern.add(shade)

      this.root.add(lantern)
      this.floatingLanterns.push(lantern)
    })
  }

  private registerColliders(collision: CollisionWorld) {
    const r = this.pondRadius
    const curbDist = r + 0.1

    // Bờ hồ gộp thành 8 cung, chừa hai cung ở đầu cầu Bắc và Nam
    const arcCount = 8
    for (let i = 0; i < arcCount; i++) {
      const angle = (i / arcCount) * Math.PI * 2
      if (Math.abs(Math.sin(angle)) > 0.85) continue
      collision.add(
        new BoxCollider(
          `pond_curb_grouped_${i}`,
          new THREE.Vector3(
            this.pondCenter.x + Math.cos(angle) * curbDist,
            0.25,
            this.pondCenter.z + Math.sin(angle) * curbDist
          ),
          new THREE.Vector3(3.2, 0.65, 3.2),
          false
        )
      )
    }

    // Mặt cầu: 12 phân đoạn giật cấp nhẹ để đi bộ mượt
    const bridgeLen = this.bridgeLen()
    const segDepth = bridgeLen / BRIDGE_SEGMENTS
    for (let s = 0; s < BRIDGE_SEGMENTS; s++) {
      const floorY = this.segmentFloorY(s)
      const relZ = ((s + 0.5) / BRIDGE_SEGMENTS) * bridgeLen - bridgeLen * 0.5
      collision.add(
        new BoxCollider(
          `bridge_step_${s}`,
          new THREE.Vector3(this.pondCenter.x, floorY * 0.5, this.pondCenter.z + relZ),
          new THREE.Vector3(BRIDGE_WIDTH, floorY, segDepth + 0.06),
          false,
          true,
          floorY
        )
      )
    }

    // Lan can chắn hai bên cầu
    for (const [id, sx] of [
      ['bridge_rail_left', -1],
      ['bridge_rail_right', 1]
    ] as const) {
      collision.add(
        new BoxCollider(
          id,
          new THREE.Vector3(this.pondCenter.x + sx * BRIDGE_WIDTH * 0.5, 1.2, this.pondCenter.z),
          new THREE.Vector3(0.4, 1.6, bridgeLen),
          false
        )
      )
    }
  }

  /** Giữ API cũ: mặt nước phẳng không dùng hướng mặt trời. */
  public updateSunDirection(_dir: THREE.Vector3) { }

  public update(delta: number, elapsed: number) {
    // Hoa đăng bập bềnh theo nhịp nước
    this.floatingLanterns.forEach((lantern, i) => {
      lantern.position.y = WATER_Y + 0.03 + Math.sin(elapsed * 1.8 + i * 1.5) * 0.02
      lantern.rotation.y += delta * 0.08
    })
    // Cụm sen đung đưa rất nhẹ
    this.plantsGroup.rotation.y = Math.sin(elapsed * 0.3) * 0.015
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    // Vật liệu Flat dùng chung FlatMaterialFactory nên không dispose ở đây
  }
}
