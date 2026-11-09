import * as THREE from 'three'
import { CollisionWorld, BoxCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { createCurvedHipRoof } from '../style/RoofBuilder'
import { createPlaqueTexture } from '../utils/PlaqueTexture'

/**
 * TamQuanGate (Cổng Tam Quan low-poly phẳng màu):
 * - 3 gian: Trung Quan (giữa, cao nhất), Giả Quan và Không Quan (hai bên, thấp hơn).
 * - 4 trụ đá, xà gỗ, 3 mái cong đầu đao (createCurvedHipRoof), tường hai cánh nối ra hàng rào biên.
 * - Toàn bộ gộp bằng SlotBatch (mỗi slot màu một Mesh), tự đổi màu theo ngày / hoàng hôn / đêm.
 * - Đèn lồng phát sáng bằng vật liệu emissive, KHÔNG dùng PointLight.
 */

const PILLAR_XS = [-6.2, -2.2, 2.2, 6.2]
const INNER_H = 4.5
const OUTER_H = 3.6
const WALL_H = 3.4
const WALL_LEN = 17.6
const WALL_T = 0.65

export class TamQuanGate {
  public root: THREE.Group = new THREE.Group()
  public position = new THREE.Vector3(
    MapLayout.LANDMARKS.TAM_QUAN_GATE.center.x,
    MapLayout.LANDMARKS.TAM_QUAN_GATE.center.y,
    MapLayout.LANDMARKS.TAM_QUAN_GATE.center.z
  )

  private plaqueMaterial: THREE.MeshBasicMaterial | null = null
  private plaqueTexture: THREE.CanvasTexture | null = null

  constructor(collision: CollisionWorld) {
    this.root.name = 'TamQuanGate'
    this.root.position.copy(this.position)

    this.root.add(this.buildStructure())
    this.buildPlaque()
    this.registerColliders(collision)
  }

  private buildStructure(): THREE.Group {
    const b = new SlotBatch()

    // --- 4 trụ biểu: chân tảng, thân, đầu trụ ---
    PILLAR_XS.forEach((px, i) => {
      const isInner = i === 1 || i === 2
      const h = isInner ? INNER_H : OUTER_H
      const w = isInner ? 0.85 : 0.72
      b.box('stone', w + 0.35, 0.45, w + 0.35, px, 0.225, 0)
      b.box('stone', w, h - 0.45, w, px, 0.45 + (h - 0.45) * 0.5, 0)
      b.box('woodDark', w + 0.2, 0.22, w + 0.2, px, h - 0.11, 0)
    })

    // --- Xà ngang ---
    b.box('woodDark', 4.6, 0.4, 0.55, 0, INNER_H - 0.45, 0)
    b.box('woodDark', 4.2, 0.34, 0.48, -4.2, OUTER_H - 0.4, 0)
    b.box('woodDark', 4.2, 0.34, 0.48, 4.2, OUTER_H - 0.4, 0)
    // Hoành phi nền gỗ sẫm dưới xà giữa (bảng chữ nằm phía trước)
    b.box('woodDark', 3.3, 0.8, 0.1, 0, 3.75, 0.28)

    // --- Mái 3 gian ---
    const centerRoof = createCurvedHipRoof({
      eaveW: 6.6,
      eaveD: 3.9,
      height: 1.7,
      ridgeW: 3.4,
      ridgeD: 0.5,
      lift: 0.7
    })
    b.add('roof', centerRoof, { position: [0, INNER_H, 0] }, true)

    const sideRoofGeo = createCurvedHipRoof({
      eaveW: 4.9,
      eaveD: 3.2,
      height: 1.3,
      ridgeW: 2.2,
      ridgeD: 0.4,
      lift: 0.55
    })
    b.add('roof', sideRoofGeo, { position: [-4.2, OUTER_H, 0] }, true)
    b.add('roof', sideRoofGeo.clone(), { position: [4.2, OUTER_H, 0] }, true)

    // Chóp nóc và đầu đao mạ vàng
    b.cone('gold', 0.26, 0.8, 6, 0, INNER_H + 1.7 + 0.4, 0)
    b.cone('gold', 0.18, 0.55, 6, -4.2, OUTER_H + 1.3 + 0.28, 0)
    b.cone('gold', 0.18, 0.55, 6, 4.2, OUTER_H + 1.3 + 0.28, 0)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cone('gold', 0.12, 0.5, 5, sx * 3.3, INNER_H + 0.7 + 0.22, sz * 1.95)
      }
    }

    // --- Hai cánh tường ---
    for (const sx of [-1, 1]) {
      const cx = sx * 15.0
      b.box('wall', WALL_LEN, WALL_H, WALL_T, cx, WALL_H * 0.5, 0)
      b.box('roofDark', WALL_LEN + 0.3, 0.22, WALL_T + 0.35, cx, WALL_H + 0.11, 0)
      b.box('stone', WALL_LEN, 0.5, WALL_T + 0.12, cx, 0.25, 0)
      // Trụ chia ô trên tường
      for (let k = -3; k <= 3; k++) {
        b.box('woodDark', 0.3, WALL_H, WALL_T + 0.1, cx + k * 2.4, WALL_H * 0.5, 0)
      }
    }

    // --- Đèn lồng treo ở hai gian bên ---
    for (const lx of [-4.2, 4.2]) {
      b.cylinder('woodDark', 0.02, 0.02, 0.35, 4, lx, OUTER_H - 0.7, 0)
      b.addEmissive('lantern', LowPolyBuilder.box(0.3, 0.42, 0.3), { position: [lx, OUTER_H - 1.05, 0] })
      b.box('gold', 0.38, 0.05, 0.38, lx, OUTER_H - 0.82, 0)
      b.box('gold', 0.38, 0.05, 0.38, lx, OUTER_H - 1.28, 0)
    }

    return b.build({ name: 'tam_quan_static', castShadow: true, receiveShadow: true })
  }

  /** Bảng "VẠN CẢNH THIỀN TỰ" phía trước xà giữa. */
  private buildPlaque() {
    // Canvas 1024x240 (tỷ lệ ~4.27:1) khớp mặt phẳng 3.1 x 0.726 m; chữ tự co vừa khung.
    const tex = createPlaqueTexture({
      text: 'VẠN CẢNH THIỀN TỰ',
      background: '#6e1a16',
      border: '#e0b04a',
      textColor: '#f6cf74',
      width: 1024,
      height: 240
    })
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.726), mat)
    plate.position.set(0, 3.75, 0.34)
    plate.name = 'tam_quan_plaque'
    this.root.add(plate)
    this.plaqueTexture = tex
    this.plaqueMaterial = mat
  }

  private registerColliders(collision: CollisionWorld) {
    PILLAR_XS.forEach((px, i) => {
      const isInner = i === 1 || i === 2
      const h = isInner ? INNER_H : OUTER_H
      const w = isInner ? 0.85 : 0.72
      collision.add(
        new BoxCollider(
          `tam_quan_pillar_${i}`,
          new THREE.Vector3(this.position.x + px, h * 0.5, this.position.z),
          new THREE.Vector3(w + 0.1, h, w + 0.1),
          false
        )
      )
    })

    collision.add(
      new BoxCollider(
        'tam_quan_wall_west',
        new THREE.Vector3(this.position.x - 15.0, WALL_H * 0.5, this.position.z),
        new THREE.Vector3(WALL_LEN, WALL_H, WALL_T + 0.05),
        false
      )
    )
    collision.add(
      new BoxCollider(
        'tam_quan_wall_east',
        new THREE.Vector3(this.position.x + 15.0, WALL_H * 0.5, this.position.z),
        new THREE.Vector3(WALL_LEN, WALL_H, WALL_T + 0.05),
        false
      )
    )
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    // Vật liệu Flat dùng chung FlatMaterialFactory nên không dispose ở đây
    this.plaqueMaterial?.dispose()
    this.plaqueTexture?.dispose()
    this.plaqueMaterial = null
    this.plaqueTexture = null
  }
}
