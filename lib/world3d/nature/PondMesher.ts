import * as THREE from 'three'

export type V3 = [number, number, number]
export type FlowerKind = 'pink' | 'white' | 'bud'

/** Trộn hai màu hex (nội suy tuyến tính trong không gian màu làm việc của three). */
export function mixHex(a: number, b: number, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t)
}

interface FlowerLayer {
  count: number
  tilt: number
  len: number
  width: number
  curl: number
  base: number
  tip: number
  offset: number
}

const FLOWER_LAYERS: Record<FlowerKind, FlowerLayer[]> = {
  pink: [
    { count: 8, tilt: 1.15, len: 0.36, width: 0.22, curl: 0.25, base: 0xfff1ee, tip: 0xf19ab8, offset: 0 },
    { count: 7, tilt: 0.74, len: 0.32, width: 0.2, curl: 0.1, base: 0xffe8ee, tip: 0xec7aa2, offset: 0.4 },
    { count: 6, tilt: 0.35, len: 0.26, width: 0.16, curl: -0.2, base: 0xfff0f0, tip: 0xe45f90, offset: 0.2 }
  ],
  white: [
    { count: 8, tilt: 1.12, len: 0.36, width: 0.22, curl: 0.25, base: 0xffffff, tip: 0xf6ead8, offset: 0 },
    { count: 7, tilt: 0.72, len: 0.32, width: 0.2, curl: 0.1, base: 0xfffaf4, tip: 0xf9dfe3, offset: 0.4 },
    { count: 6, tilt: 0.34, len: 0.26, width: 0.16, curl: -0.2, base: 0xfffaf0, tip: 0xf5c9d6, offset: 0.2 }
  ],
  bud: [{ count: 10, tilt: 0.12, len: 0.42, width: 0.17, curl: -0.3, base: 0xcfe0b4, tip: 0xe86c9a, offset: 0 }]
}

/**
 * PondMesher: bộ dựng lưới thủ công cho hồ sen. Mỗi đỉnh có màu riêng (vertex color),
 * mọi tam giác tách rời nên normal phẳng (đúng phong cách low-poly) và gộp thành 1 geometry duy nhất.
 * Dùng chung ma trận biến đổi hiện hành (setTransform) cho từng nhóm hình.
 */
export class PondMesher {
  private pos: number[] = []
  private col: number[] = []
  private m = new THREE.Matrix4()
  private p = new THREE.Vector3()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private s = new THREE.Vector3(1, 1, 1)
  private v = new THREE.Vector3()

  public get triangleCount(): number {
    return this.pos.length / 9
  }

  public setTransform(
    position: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
    scale: number | V3 = 1,
    order: THREE.EulerOrder = 'YXZ'
  ): this {
    this.p.set(position[0], position[1], position[2])
    this.e.set(rotation[0], rotation[1], rotation[2], order)
    this.q.setFromEuler(this.e)
    if (typeof scale === 'number') this.s.set(scale, scale, scale)
    else this.s.set(scale[0], scale[1], scale[2])
    this.m.compose(this.p, this.q, this.s)
    return this
  }

  public resetTransform(): this {
    return this.setTransform()
  }

  private push(x: number, y: number, z: number, c: THREE.Color) {
    this.v.set(x, y, z).applyMatrix4(this.m)
    this.pos.push(this.v.x, this.v.y, this.v.z)
    this.col.push(c.r, c.g, c.b)
  }

  public tri(a: V3, b: V3, c: V3, ca: THREE.Color, cb: THREE.Color = ca, cc: THREE.Color = ca): this {
    this.push(a[0], a[1], a[2], ca)
    this.push(b[0], b[1], b[2], cb)
    this.push(c[0], c[1], c[2], cc)
    return this
  }

  public quad(a: V3, b: V3, c: V3, d: V3, ca: THREE.Color, cb: THREE.Color = ca, cc: THREE.Color = ca, cd: THREE.Color = ca): this {
    this.tri(a, b, c, ca, cb, cc)
    return this.tri(a, c, d, ca, cc, cd)
  }

  /** Thêm một geometry có sẵn (flat, non-indexed) với một màu, có thêm chênh sáng ngẫu nhiên theo từng mặt (đá). */
  public addGeo(geo: THREE.BufferGeometry, color: number, shadeJitter = 0, rnd: () => number = Math.random): this {
    const g = geo.index ? geo.toNonIndexed() : geo
    const pa = g.attributes.position as THREE.BufferAttribute
    const base = new THREE.Color(color)
    const c = new THREE.Color()
    for (let i = 0; i < pa.count; i += 3) {
      const shade = 1 + (rnd() - 0.5) * 2 * shadeJitter
      c.copy(base).multiplyScalar(shade)
      for (let k = 0; k < 3; k++) {
        this.v.fromBufferAttribute(pa, i + k).applyMatrix4(this.m)
        this.pos.push(this.v.x, this.v.y, this.v.z)
        this.col.push(c.r, c.g, c.b)
      }
    }
    if (g !== geo) g.dispose()
    return this
  }

  /** Đĩa tròn phẳng nằm ngang (y = 0 cục bộ), tô màu từ tâm ra mép. */
  public disc(radius: number, segments: number, centerColor: THREE.Color, edgeColor: THREE.Color): this {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2
      const a1 = ((i + 1) / segments) * Math.PI * 2
      this.tri(
        [0, 0, 0],
        [Math.cos(a1) * radius, 0, Math.sin(a1) * radius],
        [Math.cos(a0) * radius, 0, Math.sin(a0) * radius],
        centerColor,
        edgeColor,
        edgeColor
      )
    }
    return this
  }

  /**
   * Lá sen tròn có khuyết một nhát (như lá thật), mép gợn sóng, gân tỏa từ tâm bằng xen kẽ sắc độ.
   * cup > 0: mép cong lên (lá dựng/ lá úp), cup nhỏ: lá nổi trên mặt nước.
   */
  public leaf(radius: number, cup: number, centerCol: THREE.Color, edgeCol: THREE.Color, rnd: () => number, notch = 0.34): this {
    const seg = 16
    const start = rnd() * Math.PI * 2
    const len = Math.PI * 2 - notch
    const rings = [0, 0.5, 1]
    const phase = rnd() * 6
    const pt = (ri: number, i: number): V3 => {
      if (ri === 0) return [0, -0.02 * radius, 0]
      const a = start + (i / seg) * len
      const r = rings[ri]! * radius
      const ruffle = ri === 2 ? Math.sin(i * 2.1 + phase) * 0.035 * radius : 0
      return [Math.cos(a) * r, cup * radius * rings[ri]! * rings[ri]! * 0.45 + ruffle, Math.sin(a) * r]
    }
    const colAt = (ri: number, i: number): THREE.Color => {
      const c = centerCol.clone().lerp(edgeCol, rings[ri]!)
      if (ri === 1 && i % 2 === 0) c.multiplyScalar(0.86)
      if (ri === 2 && i % 2 === 1) c.multiplyScalar(0.94)
      return c
    }
    for (let i = 0; i < seg; i++) {
      this.tri(pt(0, 0), pt(1, i + 1), pt(1, i), colAt(0, i), colAt(1, i + 1), colAt(1, i))
      this.quad(pt(1, i), pt(1, i + 1), pt(2, i + 1), pt(2, i), colAt(1, i), colAt(1, i + 1), colAt(2, i + 1), colAt(2, i))
    }
    return this
  }

  /**
   * Cánh hoa / phiến lá thon: kéo dài theo +Y, cong về +Z (curl), mép khum vào trong, đầu nhọn.
   */
  public petal(len: number, width: number, curl: number, baseCol: THREE.Color, tipCol: THREE.Color): this {
    const rows = 4
    const hw = (t: number) => width * 0.5 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.16 + 0.84 * t))), 0.7)
    const colors: THREE.Color[] = []
    for (let j = 0; j <= rows; j++) colors.push(baseCol.clone().lerp(tipCol, Math.pow(j / rows, 1.1)))
    const vert = (j: number, k: number): V3 => {
      const t = j / rows
      const w = hw(t)
      return [k * w, t * len, curl * len * t * t + Math.abs(k) * w * 0.35]
    }
    for (let j = 0; j < rows; j++) {
      for (const [k0, k1] of [[-1, 0], [0, 1]] as const) {
        this.quad(vert(j, k0), vert(j, k1), vert(j + 1, k1), vert(j + 1, k0), colors[j]!, colors[j]!, colors[j + 1]!, colors[j + 1]!)
      }
    }
    return this
  }

  /** Thân/cuống: lăng trụ thon, uốn cong dần về hướng bend. Trả về tọa độ đỉnh cuống. */
  public stem(
    x: number,
    z: number,
    y0: number,
    y1: number,
    r0: number,
    r1: number,
    bend: [number, number],
    c0: THREE.Color,
    c1: THREE.Color,
    sides = 5
  ): V3 {
    const rings = 3
    const pts: V3[][] = []
    const cols: THREE.Color[] = []
    for (let j = 0; j < rings; j++) {
      const t = j / (rings - 1)
      const cy = y0 + (y1 - y0) * t
      const cx = x + bend[0] * t * t
      const cz = z + bend[1] * t * t
      const r = r0 + (r1 - r0) * t
      const ring: V3[] = []
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        ring.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r])
      }
      pts.push(ring)
      cols.push(c0.clone().lerp(c1, t))
    }
    for (let j = 0; j < rings - 1; j++) {
      for (let i = 0; i < sides; i++) {
        const n = (i + 1) % sides
        this.quad(pts[j]![i]!, pts[j]![n]!, pts[j + 1]![n]!, pts[j + 1]![i]!, cols[j]!, cols[j]!, cols[j + 1]!, cols[j + 1]!)
      }
    }
    return [x + bend[0], y1, z + bend[1]]
  }

  /** Gương sen (đài sen) hình nón ngược, mặt trên có hạt. Đỉnh ở y = 0 cục bộ. */
  public pod(r: number): this {
    const sides = 7
    const side = new THREE.Color(0x9aa84a)
    const sideLow = new THREE.Color(0x7b8c3c)
    const cap = new THREE.Color(0xc4bb52)
    const seed = new THREE.Color(0x6b5a2e)
    const top: V3[] = []
    const bot: V3[] = []
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2
      top.push([Math.cos(a) * r, 0, Math.sin(a) * r])
      bot.push([Math.cos(a) * r * 0.45, -r * 1.1, Math.sin(a) * r * 0.45])
    }
    for (let i = 0; i < sides; i++) {
      const n = (i + 1) % sides
      this.quad(top[i]!, top[n]!, bot[n]!, bot[i]!, side, side, sideLow, sideLow)
      this.tri([0, 0.004, 0], top[n]!, top[i]!, cap, side, side)
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const sr = r * 0.55
      const cx = Math.cos(a) * sr
      const cz = Math.sin(a) * sr
      this.tri([cx - 0.012, 0.007, cz], [cx + 0.012, 0.007, cz], [cx, 0.007, cz + 0.018], seed)
    }
    return this
  }

  /** Vòng nhị vàng quanh gương sen (y = 0 cục bộ). */
  public stamens(rIn: number, len: number, count: number, rnd: () => number): this {
    const base = new THREE.Color(0xe6a91c)
    const tip = new THREE.Color(0xffe27a)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.2
      const cx = Math.cos(a)
      const cz = Math.sin(a)
      const out = 0.04 + rnd() * 0.05
      const h = len * (0.75 + rnd() * 0.5)
      const tx = -cz * 0.01
      const tz = cx * 0.01
      this.tri(
        [cx * rIn - tx, -0.03, cz * rIn - tz],
        [cx * rIn + tx, -0.03, cz * rIn + tz],
        [cx * (rIn + out), h, cz * (rIn + out)],
        base,
        base,
        tip
      )
    }
    return this
  }

  /** Một bông sen đầy đủ (3 lớp cánh + đài + nhị) hoặc nụ sen, đặt gốc tại (x, y, z). */
  public flower(x: number, y: number, z: number, size: number, kind: FlowerKind, rnd: () => number): this {
    const spin = rnd() * Math.PI * 2
    for (const layer of FLOWER_LAYERS[kind]) {
      const base = new THREE.Color(layer.base)
      const tip = new THREE.Color(layer.tip)
      for (let i = 0; i < layer.count; i++) {
        const phi = spin + layer.offset + (i / layer.count) * Math.PI * 2 + (rnd() - 0.5) * 0.12
        const tilt = layer.tilt + (rnd() - 0.5) * 0.12
        this.setTransform([x, y, z], [tilt, phi, 0], size, 'YXZ')
        this.petal(layer.len, layer.width, layer.curl, base, tip)
      }
    }
    if (kind !== 'bud') {
      this.setTransform([x, y + 0.05 * size, z], [0, spin, 0], size, 'YXZ')
      this.pod(0.07)
      this.stamens(0.085, 0.13, 16, rnd)
    }
    return this.resetTransform()
  }

  public build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    this.pos = []
    this.col = []
    return g
  }
}

