import * as THREE from 'three'
import { CollisionWorld, BoxCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { createCurvedHipRoof } from '../style/RoofBuilder'
import { createPlaqueTexture, createVerticalCoupletTexture } from '../utils/PlaqueTexture'

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

    // --- Đèn lồng treo ở hai gian bên & gian giữa ---
    for (const lx of [-4.2, 4.2]) {
      b.cylinder('woodDark', 0.02, 0.02, 0.35, 4, lx, OUTER_H - 0.7, 0)
      b.addEmissive('lantern', LowPolyBuilder.box(0.3, 0.42, 0.3), { position: [lx, OUTER_H - 1.05, 0] })
      b.box('gold', 0.38, 0.05, 0.38, lx, OUTER_H - 0.82, 0)
      b.box('gold', 0.38, 0.05, 0.38, lx, OUTER_H - 1.28, 0)
    }
    for (const lx of [-1.35, 1.35]) {
      b.cylinder('woodDark', 0.02, 0.02, 0.32, 4, lx, INNER_H - 0.82, 0.25)
      b.addEmissive('lantern', LowPolyBuilder.cylinder(0.16, 0.16, 0.34, 6), { position: [lx, INNER_H - 1.12, 0.25] })
      b.cylinder('gold', 0.19, 0.19, 0.05, 6, lx, INNER_H - 0.94, 0.25)
      b.cylinder('gold', 0.19, 0.19, 0.05, 6, lx, INNER_H - 1.30, 0.25)
    }

    // --- Đôi Sư Tử Đá Chầu Cổng (Đá xanh nguyên khối chạm khắc, dáng ngồi uy nghi) ---
    for (const sx of [-1, 1]) {
      const gx = sx * 2.95
      const gz = 1.35
      const yaw = -sx * 0.24 // Xoay nhẹ hướng mặt đón khách hành hương

      const place = (
        geo: THREE.BufferGeometry,
        lx: number,
        ly: number,
        lz: number,
        rx = 0,
        ry = 0,
        rz = 0,
        slot: 'stone' | 'ground' | 'roofDark' = 'stone'
      ) => {
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        const wx = gx + lx * cosY + lz * sinY
        const wz = gz - lx * sinY + lz * cosY
        b.add(slot, geo, { position: [wx, ly, wz], rotation: [rx, ry + yaw, rz] })
      }

      // 1. Bệ đá xanh tam cấp chạm gờ chỉ
      b.box('stone', 1.24, 0.16, 1.32, gx, 0.08, gz, 0, yaw, 0)
      b.box('ground', 1.08, 0.10, 1.16, gx, 0.21, gz, 0, yaw, 0)
      b.box('stone', 1.00, 0.14, 1.08, gx, 0.33, gz, 0, yaw, 0)

      const baseY = 0.40
      // 2. Thân sau, đùi sau ngồi gập và lưng vươn chéo lên ngực
      place(LowPolyBuilder.sphere(0.32, 1), 0, baseY + 0.24, -0.18)
      for (const side of [-1, 1]) {
        place(LowPolyBuilder.sphere(0.19, 1), side * 0.24, baseY + 0.16, -0.14)
        place(LowPolyBuilder.box(0.16, 0.09, 0.28), side * 0.25, baseY + 0.045, -0.04)
      }
      // Ngực & vai ưỡn cao
      place(LowPolyBuilder.cylinder(0.27, 0.31, 0.52, 10), 0, baseY + 0.48, 0.02, 0.24, 0, 0)
      place(LowPolyBuilder.sphere(0.28, 1), 0, baseY + 0.68, 0.09)

      // 3. Hai chân trước cơ bắp chống thẳng + bàn chân vuốt đá
      for (const side of [-1, 1]) {
        const fx = side * 0.20
        place(LowPolyBuilder.cylinder(0.095, 0.085, 0.30, 8), fx, baseY + 0.52, 0.23, 0.15, 0, 0)
        place(LowPolyBuilder.cylinder(0.08, 0.09, 0.36, 8), fx, baseY + 0.21, 0.28)
        place(LowPolyBuilder.box(0.16, 0.09, 0.22), fx, baseY + 0.045, 0.32)
      }
      // Quả tú cầu đá chạm khắc dưới chân phía trong
      place(LowPolyBuilder.sphere(0.14, 1), -sx * 0.20, baseY + 0.14, 0.38, 0, 0, 0, 'ground')

      // 4. Đầu Sư Tử Đá uy mãnh (chỉ dùng đá đồng bộ, không tô màu lòe loẹt)
      const headY = baseY + 0.96
      const headZ = 0.16
      place(LowPolyBuilder.sphere(0.27, 1), 0, headY, headZ) // Khối sọ
      // Mõm sư tử vuông rộng chia 2 khối hàm trên / dưới
      place(LowPolyBuilder.box(0.28, 0.13, 0.20), 0, headY - 0.03, headZ + 0.18)
      place(LowPolyBuilder.box(0.22, 0.07, 0.16), 0, headY - 0.14, headZ + 0.16, 0.12, 0, 0)
      // Sống mũi gồ & hốc mắt sâu
      place(LowPolyBuilder.box(0.11, 0.09, 0.10), 0, headY + 0.04, headZ + 0.25)
      // Hàng lông mày xếch uy nghi (hướng vào giữa \/)
      for (const side of [-1, 1]) {
        place(LowPolyBuilder.box(0.13, 0.055, 0.08), side * 0.11, headY + 0.11, headZ + 0.21, 0, 0, side * 0.28)
        place(LowPolyBuilder.sphere(0.045, 1), side * 0.10, headY + 0.06, headZ + 0.21, 0, 0, 0, 'ground')
        // Tai cụp vểnh đặc trưng của sư tử đá
        place(LowPolyBuilder.cone(0.08, 0.16, 5), side * 0.23, headY + 0.21, headZ - 0.02, -0.25, 0, -side * 0.45)
      }
      // Bờm xoắn 2 tầng ôm quanh đầu và gáy
      for (let m = 0; m < 9; m++) {
        const ang = -Math.PI * 0.8 + (m / 8) * Math.PI * 1.6
        place(
          LowPolyBuilder.sphere(0.095, 1),
          Math.sin(ang) * 0.25,
          headY + Math.cos(ang) * 0.24,
          headZ - 0.07
        )
      }
      for (let m = 0; m < 7; m++) {
        const ang = -Math.PI * 0.65 + (m / 6) * Math.PI * 1.3
        place(
          LowPolyBuilder.sphere(0.085, 1),
          Math.sin(ang) * 0.24,
          baseY + 0.72 + Math.cos(ang) * 0.12,
          0.02 - Math.abs(Math.sin(ang)) * 0.08
        )
      }

      // 5. Đuôi đá uốn cong ôm dọc sống lưng
      place(LowPolyBuilder.cylinder(0.05, 0.065, 0.36, 6), 0, baseY + 0.34, -0.44, -0.55, 0, 0)
      place(LowPolyBuilder.sphere(0.10, 1), 0, baseY + 0.52, -0.49)
    }

    return b.build({ name: 'tam_quan_static', castShadow: true, receiveShadow: true })
  }

  /** Bảng "VẠN CẢNH THIỀN TỰ" & Cặp Câu Đối sơn son thếp vàng trên 2 cột chính. */
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

    // Cặp Câu Đối dọc gắn mặt trước 2 cột chính (x = ±2.1), dùng chung referenceWords để cỡ chữ 2 bên đồng nhất
    const couplets: Array<{ x: number; words: string[] }> = [
      { x: -2.1, words: ['TỪ', 'BI', 'HỶ', 'XẢ'] },
      { x: 2.1, words: ['PHÁP', 'VŨ', 'LƯU', 'HƯƠNG'] }
    ]
    const allCoupletWords = couplets.flatMap(c => c.words)
    for (const c of couplets) {
      const cTex = createVerticalCoupletTexture(c.words, {
        width: 192,
        height: 640,
        referenceWords: allCoupletWords
      })
      const cMat = new THREE.MeshBasicMaterial({ map: cTex })
      const cMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 1.85), cMat)
      cMesh.position.set(c.x, 2.25, 0.44)
      this.root.add(cMesh)
    }
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
