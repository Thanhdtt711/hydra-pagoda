import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'

/**
 * CourtyardMonuments:
 * Cụm công trình đối xứng cho 2 khoảng sân trước cánh Tây & cánh Đông:
 * 1. Sân Tây (trước Bảo Tàng Di Sản Cổ Tự, x = -35, z = 14.5):
 *    - Bia Đá Rùa Đội "BIA CÔNG ĐỨC ON-CHAIN" (tương tác mở Sổ Cái / Hydra L2)
 *    - Cặp Đèn Đá Tōrō đối xứng hai bên
 * 2. Sân Đông (trước Nhà Hầu Đồng, x = +35, z = 14.5):
 *    - Cột Cờ Ngũ Sắc Tứ Phủ (cờ 5 màu chuẩn truyền thống bay nhẹ theo gió)
 *    - Lư Hương Đồng Tứ Phủ phía trước cột cờ
 *    - Cặp Đèn Đá Tōrō đối xứng hai bên
 */

const COURTYARD_Y = 0.14
const WEST_X = -35.0
const EAST_X = 35.0
const MONUMENT_Z = 14.5

function createSteleTexture(): THREE.CanvasTexture {
  const w = 512
  const h = 768
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // Nền đá sơn mài sẫm
  ctx.fillStyle = '#171411'
  ctx.fillRect(0, 0, w, h)

  // Khung viền kép vàng thếp
  ctx.strokeStyle = '#c9a24b'
  ctx.lineWidth = 10
  ctx.strokeRect(22, 22, w - 44, h - 44)
  ctx.lineWidth = 3
  ctx.strokeRect(38, 38, w - 76, h - 76)

  // Góc hồi văn đơn giản
  ctx.fillStyle = '#c9a24b'
  const corners = [
    [38, 38],
    [w - 62, 38],
    [38, h - 62],
    [w - 62, h - 62]
  ]
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx, cy, 24, 6)
    ctx.fillRect(cx, cy, 6, 24)
  }

  // Họa tiết vầng sáng hoa sen trên trán bia
  ctx.save()
  ctx.translate(w / 2, 108)
  ctx.strokeStyle = '#c9a24b'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(0, 0, 28, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#c9a24b'
  ctx.beginPath()
  ctx.arc(0, 0, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Tiêu đề chính
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f6cf74'
  ctx.font = 'bold 38px "Be Vietnam Pro", sans-serif'
  ctx.fillText('BIA CÔNG ĐỨC', w / 2, 200)
  ctx.fillText('ON-CHAIN', w / 2, 250)

  // Đường kẻ ngang phân cách
  ctx.fillStyle = '#c9a24b'
  ctx.fillRect(96, 280, w - 192, 3)

  // Phụ đề Blockchain
  ctx.fillStyle = '#6ee7b7'
  ctx.font = 'bold 22px "Be Vietnam Pro", sans-serif'
  ctx.fillText('CARDANO HYDRA L2 • CIP-68', w / 2, 326)

  // Nội dung văn bia
  ctx.fillStyle = '#e8dcc0'
  ctx.font = '500 22px "Be Vietnam Pro", sans-serif'
  const lines = [
    'Ghi danh thiện tâm thập phương',
    'Minh bạch trên sổ cái chuỗi khối',
    'Phí giao dịch bằng không (0 ADA)',
    'Chứng thực tức thì qua Hydra Head',
    'Lưu giữ di sản cổ tự ngàn năm'
  ]
  lines.forEach((line, idx) => {
    ctx.fillText(line, w / 2, 396 + idx * 46)
  })

  // Dấu ấn đỏ son ở cuối bia
  ctx.fillStyle = '#b8372b'
  ctx.fillRect(w / 2 - 32, 628, 64, 64)
  ctx.strokeStyle = '#f6ecd8'
  ctx.lineWidth = 3
  ctx.strokeRect(w / 2 - 26, 634, 52, 52)
  ctx.fillStyle = '#f6ecd8'
  ctx.font = 'bold 20px "Be Vietnam Pro", sans-serif'
  ctx.fillText('CÔNG', w / 2, 658)
  ctx.fillText('ĐỨC', w / 2, 682)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function createFiveColorFlagTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // 5 khung vuông đồng tâm chuẩn Cờ Ngũ Sắc lễ hội Tứ Phủ Việt Nam
  // Ngoài vào trong: Đỏ -> Vàng -> Xanh lá -> Trắng -> Xanh lam -> Tâm Đỏ vàng
  const bands = [
    { inset: 0, color: '#b8372b' },
    { inset: 40, color: '#e6b43c' },
    { inset: 82, color: '#2e8b57' },
    { inset: 124, color: '#f4efe6' },
    { inset: 166, color: '#2b6cb0' },
    { inset: 204, color: '#b8372b' }
  ]
  for (const band of bands) {
    ctx.fillStyle = band.color
    ctx.fillRect(band.inset, band.inset, size - band.inset * 2, size - band.inset * 2)
  }

  // Viền chỉ vàng nổi bật giữa các lớp
  ctx.strokeStyle = '#f6cf74'
  ctx.lineWidth = 4
  ctx.strokeRect(166, 166, size - 332, size - 332)

  // Họa tiết chữ "TỨ PHỦ" mạ vàng ở tâm cờ
  ctx.fillStyle = '#f6cf74'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 34px "Be Vietnam Pro", sans-serif'
  ctx.fillText('TỨ', size / 2, size / 2 - 18)
  ctx.fillText('PHỦ', size / 2, size / 2 + 20)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function addStoneLantern(b: SlotBatch, x: number, z: number) {
  const y = COURTYARD_Y
  b.cylinder('stone', 0.42, 0.52, 0.14, 8, x, y + 0.07, z)
  b.cylinder('stone', 0.32, 0.40, 0.12, 8, x, y + 0.20, z)
  b.cylinder('roofDark', 0.22, 0.27, 0.06, 8, x, y + 0.29, z)
  b.cylinder('stone', 0.16, 0.18, 0.92, 8, x, y + 0.78, z)
  b.cylinder('stone', 0.36, 0.21, 0.12, 8, x, y + 1.30, z)
  b.cylinder('stone', 0.44, 0.36, 0.10, 6, x, y + 1.41, z)
  b.addEmissive('lantern', LowPolyBuilder.cylinder(0.22, 0.22, 0.38, 6), { position: [x, y + 1.65, z] })
  b.cylinder('stone', 0.36, 0.32, 0.06, 6, x, y + 1.87, z)
  b.cone('roofDark', 0.64, 0.25, 6, x, y + 2.02, z)
  b.cone('roofDark', 0.40, 0.16, 6, x, y + 2.15, z)
  b.sphere('gold', 0.075, 0, x, y + 2.28, z)
}

export class CourtyardMonuments {
  public root: THREE.Group = new THREE.Group()
  public readonly steleInteractPos = new THREE.Vector3(WEST_X, COURTYARD_Y, MONUMENT_Z + 1.4)

  private flagPivot: THREE.Group | null = null
  private flagMesh: THREE.Mesh | null = null
  private ownedMaterials: THREE.Material[] = []
  private ownedGeometries: THREE.BufferGeometry[] = []
  private ownedTextures: THREE.Texture[] = []

  constructor(collisionWorld?: CollisionWorld) {
    this.root.name = 'CourtyardMonuments'
    this.buildStaticStructures()
    this.buildStelePlaques()
    this.buildAnimatedFlag()

    if (collisionWorld) {
      this.registerColliders(collisionWorld)
    }
  }

  private buildStaticStructures() {
    const b = new SlotBatch()
    const y = COURTYARD_Y

    // =========================================================
    // 1. SÂN TÂY: BIA ĐÁ RÙA ĐỘI "BIA CÔNG ĐỨC ON-CHAIN"
    // =========================================================
    // Bệ đá 2 tầng
    b.box('stone', 3.4, 0.24, 2.5, WEST_X, y + 0.12, MONUMENT_Z)
    b.box('stone', 2.7, 0.22, 1.9, WEST_X, y + 0.35, MONUMENT_Z)
    b.box('roofDark', 2.8, 0.04, 2.0, WEST_X, y + 0.46, MONUMENT_Z)

    // Thần Quy (Rùa đá low-poly hướng mặt về Nam +z)
    const turtleY = y + 0.48
    // 4 chân rùa
    for (const sx of [-0.62, 0.62]) {
      for (const sz of [-0.52, 0.52]) {
        b.cylinder('stone', 0.18, 0.22, 0.26, 6, WEST_X + sx, turtleY + 0.13, MONUMENT_Z + sz)
      }
    }
    // Mai rùa bát giác vòm nhẹ
    b.cylinder('stone', 0.88, 1.05, 0.36, 8, WEST_X, turtleY + 0.34, MONUMENT_Z)
    b.cylinder('roofDark', 0.72, 0.88, 0.12, 8, WEST_X, turtleY + 0.56, MONUMENT_Z)
    // Đầu rùa vươn ra mặt Nam (+z) & đuôi ngắn phía Bắc (-z)
    b.box('stone', 0.34, 0.28, 0.52, WEST_X, turtleY + 0.34, MONUMENT_Z + 1.02)
    b.sphere('stone', 0.22, 0, WEST_X, turtleY + 0.40, MONUMENT_Z + 1.28)
    b.cone('stone', 0.12, 0.32, 5, WEST_X, turtleY + 0.24, MONUMENT_Z - 1.05, -Math.PI / 2, 0, 0)

    // Thân Bia Đá dựng trên lưng rùa
    const steleBaseY = turtleY + 0.60
    b.box('roofDark', 1.56, 0.16, 0.48, WEST_X, steleBaseY + 0.08, MONUMENT_Z)
    b.box('stone', 1.44, 2.38, 0.34, WEST_X, steleBaseY + 1.35, MONUMENT_Z)
    // Trán bia cong tam cấp + viền vàng thếp + búp sen đỉnh
    b.box('roofDark', 1.62, 0.20, 0.44, WEST_X, steleBaseY + 2.60, MONUMENT_Z)
    b.box('gold', 1.66, 0.06, 0.48, WEST_X, steleBaseY + 2.72, MONUMENT_Z)
    b.box('roofDark', 1.12, 0.22, 0.38, WEST_X, steleBaseY + 2.86, MONUMENT_Z)
    b.cone('gold', 0.22, 0.42, 6, WEST_X, steleBaseY + 3.16, MONUMENT_Z)

    // 2 Đèn Đá Tōrō chầu hai bên Bia Công Đức
    addStoneLantern(b, WEST_X - 3.6, MONUMENT_Z)
    addStoneLantern(b, WEST_X + 3.6, MONUMENT_Z)

    // =========================================================
    // 2. SÂN ĐÔNG: CỘT CỜ NGŨ SẮC TỨ PHỦ + LƯ HƯƠNG ĐỒNG
    // =========================================================
    const flagZ = MONUMENT_Z + 1.8
    // Bệ đá bát giác 2 cấp cho Cột Cờ
    b.cylinder('stone', 1.35, 1.55, 0.30, 8, EAST_X, y + 0.15, flagZ)
    b.cylinder('stone', 0.92, 1.10, 0.34, 8, EAST_X, y + 0.47, flagZ)
    b.cylinder('gold', 0.96, 0.96, 0.06, 8, EAST_X, y + 0.66, flagZ)
    // Trụ cờ sơn son cao 7.6m + vòng đai vàng + đỉnh búp sen vàng
    b.cylinder('wood', 0.11, 0.16, 7.6, 8, EAST_X, y + 4.46, flagZ)
    b.cylinder('gold', 0.17, 0.17, 0.12, 8, EAST_X, y + 1.8, flagZ)
    b.cylinder('gold', 0.15, 0.15, 0.12, 8, EAST_X, y + 4.4, flagZ)
    b.cylinder('gold', 0.14, 0.14, 0.12, 8, EAST_X, y + 7.8, flagZ)
    b.sphere('gold', 0.22, 0, EAST_X, y + 8.38, flagZ)
    b.cone('gold', 0.14, 0.38, 6, EAST_X, y + 8.70, flagZ)
    // Thanh xà ngang treo lá cờ ngũ sắc (vươn sang hướng Tây -x)
    b.box('woodDark', 2.4, 0.09, 0.09, EAST_X - 1.25, y + 7.95, flagZ)
    b.sphere('gold', 0.10, 0, EAST_X - 2.48, y + 7.95, flagZ)

    // Lư Hương Đồng Tứ Phủ phía trước cột cờ (z = MONUMENT_Z - 2.6)
    const burnerZ = MONUMENT_Z - 2.6
    b.cylinder('stone', 1.15, 1.32, 0.24, 8, EAST_X, y + 0.12, burnerZ)
    b.cylinder('stone', 0.85, 0.98, 0.22, 8, EAST_X, y + 0.35, burnerZ)
    // 3 chân đỉnh đồng
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + Math.PI / 6
      b.cylinder('woodDark', 0.10, 0.13, 0.42, 6, EAST_X + Math.cos(ang) * 0.46, y + 0.66, burnerZ + Math.sin(ang) * 0.46)
    }
    // Bầu lư đồng + cổ thắt + miệng lư viền vàng + 2 tai rồng
    b.cylinder('woodDark', 0.62, 0.48, 0.56, 10, EAST_X, y + 1.08, burnerZ)
    b.cylinder('gold', 0.66, 0.66, 0.08, 10, EAST_X, y + 1.38, burnerZ)
    b.box('gold', 0.14, 0.42, 0.12, EAST_X - 0.68, y + 1.44, burnerZ)
    b.box('gold', 0.14, 0.42, 0.12, EAST_X + 0.68, y + 1.44, burnerZ)
    // Lõi than hồng + 3 nén nhang vàng
    b.addEmissive('lantern', LowPolyBuilder.cylinder(0.46, 0.46, 0.08, 10), { position: [EAST_X, y + 1.40, burnerZ] })
    for (const ix of [-0.14, 0, 0.14]) {
      b.cylinder('gold', 0.015, 0.015, 0.42, 4, EAST_X + ix, y + 1.62, burnerZ)
      b.addEmissive('lantern', LowPolyBuilder.sphere(0.025, 0), { position: [EAST_X + ix, y + 1.84, burnerZ] })
    }

    // 2 Đèn Đá Tōrō đối xứng hai bên sân Đông
    addStoneLantern(b, EAST_X - 3.6, MONUMENT_Z)
    addStoneLantern(b, EAST_X + 3.6, MONUMENT_Z)

    const built = b.build({ name: 'courtyard_monuments_static' })
    this.root.add(built)
  }

  private buildStelePlaques() {
    const tex = createSteleTexture()
    this.ownedTextures.push(tex)
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    this.ownedMaterials.push(mat)
    const geo = new THREE.PlaneGeometry(1.26, 2.16)
    this.ownedGeometries.push(geo)

    const steleCenterY = COURTYARD_Y + 0.48 + 0.60 + 1.35

    // Mặt Nam (hướng ra ngoài sân)
    const front = new THREE.Mesh(geo, mat)
    front.position.set(WEST_X, steleCenterY, MONUMENT_Z + 0.185)
    this.root.add(front)

    // Mặt Bắc (hướng về Bảo Tàng)
    const back = new THREE.Mesh(geo, mat)
    back.position.set(WEST_X, steleCenterY, MONUMENT_Z - 0.185)
    back.rotation.y = Math.PI
    this.root.add(back)
  }

  private buildAnimatedFlag() {
    const flagTex = createFiveColorFlagTexture()
    this.ownedTextures.push(flagTex)
    const flagMat = new THREE.MeshLambertMaterial({
      map: flagTex,
      side: THREE.DoubleSide
    })
    this.ownedMaterials.push(flagMat)

    const flagGeo = new THREE.PlaneGeometry(2.2, 2.2, 6, 4)
    this.ownedGeometries.push(flagGeo)

    const flagPivot = new THREE.Group()
    flagPivot.position.set(EAST_X - 1.25, COURTYARD_Y + 7.90, MONUMENT_Z + 1.8)

    const flagMesh = new THREE.Mesh(flagGeo, flagMat)
    flagMesh.position.set(0, -1.15, 0)
    flagPivot.add(flagMesh)

    // 3 dải tua rua vàng dưới chân cờ
    const tasselGeo = new THREE.BoxGeometry(0.14, 0.55, 0.03)
    const tasselMat = new THREE.MeshLambertMaterial({ color: 0xe6b43c })
    this.ownedGeometries.push(tasselGeo)
    this.ownedMaterials.push(tasselMat)
    for (const tx of [-0.75, 0, 0.75]) {
      const tassel = new THREE.Mesh(tasselGeo, tasselMat)
      tassel.position.set(tx, -2.48, 0)
      flagPivot.add(tassel)
    }

    this.root.add(flagPivot)
    this.flagPivot = flagPivot
    this.flagMesh = flagMesh
  }

  public update(elapsed: number) {
    if (this.flagPivot) {
      // Cờ ngũ sắc đung đưa mềm mại theo gió
      this.flagPivot.rotation.z = Math.sin(elapsed * 1.6) * 0.06
      this.flagPivot.rotation.x = Math.cos(elapsed * 1.2) * 0.07
    }
    if (this.flagMesh) {
      const pos = this.flagMesh.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        // Đỉnh cờ (y = +1.1) cố định vào xà ngang, đáy cờ (y = -1.1) phất phơ nhiều nhất
        const dropFactor = Math.max(0, (1.1 - y) / 2.2)
        const wave = Math.sin(elapsed * 3.2 + x * 2.1 + y * 1.4) * 0.14 * dropFactor
        pos.setZ(i, wave)
      }
      pos.needsUpdate = true
    }
  }

  private registerColliders(collisionWorld: CollisionWorld) {
    // Bia Đá Rùa Đội (Sân Tây)
    collisionWorld.add(
      new BoxCollider(
        'courtyard_merit_stele',
        new THREE.Vector3(WEST_X, COURTYARD_Y + 1.8, MONUMENT_Z),
        new THREE.Vector3(3.2, 3.6, 2.3),
        false
      )
    )
    // 2 Đèn Đá Sân Tây
    collisionWorld.add(new CylinderCollider('west_monument_lantern_l', new THREE.Vector3(WEST_X - 3.6, 1.2, MONUMENT_Z), 0.5, 2.4, false))
    collisionWorld.add(new CylinderCollider('west_monument_lantern_r', new THREE.Vector3(WEST_X + 3.6, 1.2, MONUMENT_Z), 0.5, 2.4, false))

    // Cột Cờ Ngũ Sắc & Lư Hương Đồng (Sân Đông)
    collisionWorld.add(new CylinderCollider('east_flagpole', new THREE.Vector3(EAST_X, 2.0, MONUMENT_Z + 1.8), 1.4, 4.0, false))
    collisionWorld.add(new CylinderCollider('east_burner', new THREE.Vector3(EAST_X, 1.0, MONUMENT_Z - 2.6), 1.2, 2.0, false))
    // 2 Đèn Đá Sân Đông
    collisionWorld.add(new CylinderCollider('east_monument_lantern_l', new THREE.Vector3(EAST_X - 3.6, 1.2, MONUMENT_Z), 0.5, 2.4, false))
    collisionWorld.add(new CylinderCollider('east_monument_lantern_r', new THREE.Vector3(EAST_X + 3.6, 1.2, MONUMENT_Z), 0.5, 2.4, false))
  }

  public dispose() {
    this.ownedGeometries.forEach((g) => g.dispose())
    this.ownedMaterials.forEach((m) => m.dispose())
    this.ownedTextures.forEach((t) => t.dispose())
  }
}
