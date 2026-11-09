import * as THREE from 'three'
import { SeededPRNG } from '../utils/SeededPRNG'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { Palette, type PaletteSlot, type TimeOfDayMode } from '../style/Palette'

interface MountainLayer {
  mesh: THREE.Mesh
  slot: PaletteSlot
  /** Mỗi đỉnh: [t (0 chân .. 1 đỉnh), jitter mặt]. */
  params: Float32Array
}

interface RingConfig {
  radiusInner: number
  radiusPeak: number
  radiusOuter: number
  segments: number
  baseHeight: number
  peakVariation: number
  seed: number
  slot: PaletteSlot
  /** Độ nhọn của đỉnh (răng cưa giữa các đỉnh liền kề). */
  jaggedness: number
}

/**
 * DistantMountains (Dãy núi phẳng nhiều lớp – Low-poly Minimalist):
 * - 3 lớp núi (gần / giữa / xa) dạng vòng liên tục quanh bản đồ, mặt tam giác phẳng (non-indexed)
 * - Đường viền đỉnh dùng điều hòa Fourier cố định theo seed -> ổn định giữa các lần tải
 * - Màu theo slot Palette (mountainNear/Mid/Far), lớp càng xa càng nhạt để hòa vào sương
 * - setPalette(mode) tô lại màu đỉnh tại chỗ khi đổi ngày / hoàng hôn / đêm
 */
export class DistantMountains {
  public root: THREE.Group
  private layers: MountainLayer[] = []
  private material: THREE.Material

  constructor() {
    this.root = new THREE.Group()
    this.root.name = 'DistantMountains'
    this.material = FlatMaterialFactory.getInstance().vertexColor()

    // Lớp gần: đồi thấp bao quanh khuôn viên
    this.addRing({
      radiusInner: 120,
      radiusPeak: 150,
      radiusOuter: 185,
      segments: 56,
      baseHeight: 20,
      peakVariation: 14,
      seed: 889911,
      slot: 'mountainNear',
      jaggedness: 0.35
    })

    // Lớp giữa: núi vừa, đỉnh nhọn hơn
    this.addRing({
      radiusInner: 170,
      radiusPeak: 215,
      radiusOuter: 260,
      segments: 48,
      baseHeight: 38,
      peakVariation: 26,
      seed: 554433,
      slot: 'mountainMid',
      jaggedness: 0.5
    })

    // Lớp xa: dãy núi thiêng hùng vĩ, nhạt hòa vào sương
    this.addRing({
      radiusInner: 230,
      radiusPeak: 290,
      radiusOuter: 340,
      segments: 40,
      baseHeight: 62,
      peakVariation: 40,
      seed: 771155,
      slot: 'mountainFar',
      jaggedness: 0.6
    })

    this.setPalette(FlatMaterialFactory.getInstance().currentMode)
  }

  private addRing(config: RingConfig) {
    const { radiusInner, radiusPeak, radiusOuter, segments, baseHeight, peakVariation, seed, jaggedness } = config
    const prng = new SeededPRNG(seed)

    // Điều hòa cố định cho đường viền
    const harmonics = [
      { freq: 2, amp: 0.34, phase: prng.range(0, Math.PI * 2) },
      { freq: 4, amp: 0.26, phase: prng.range(0, Math.PI * 2) },
      { freq: 7, amp: 0.2, phase: prng.range(0, Math.PI * 2) },
      { freq: 13, amp: 0.12, phase: prng.range(0, Math.PI * 2) }
    ]

    // Điểm dọc theo vòng: chân trong (inner), sống núi (peak), chân ngoài (skirt)
    const ring: Array<{ inner: THREE.Vector3; peak: THREE.Vector3; outer: THREE.Vector3 }> = []
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)

      let normH = 0
      for (const h of harmonics) normH += Math.sin(theta * h.freq + h.phase) * h.amp
      normH = Math.min(1, Math.max(0, normH * 0.5 + 0.5))

      // Răng cưa: đỉnh chẵn cao, đỉnh lẻ thấp để tạo silhouette nhọn
      const zig = i % 2 === 0 ? 1 : 1 - jaggedness
      const jitter = 0.85 + prng.next() * 0.3
      const peakH = (baseHeight + normH * peakVariation) * zig * jitter

      const peakR = radiusPeak + (prng.next() - 0.5) * 6
      ring.push({
        inner: new THREE.Vector3(cosT * radiusInner, -0.5, sinT * radiusInner),
        peak: new THREE.Vector3(cosT * peakR, peakH, sinT * peakR),
        outer: new THREE.Vector3(cosT * radiusOuter, -8.0, sinT * radiusOuter)
      })
    }

    const triCount = segments * 4
    const positions = new Float32Array(triCount * 9)
    const params = new Float32Array(triCount * 6)
    const colors = new Float32Array(triCount * 9)
    let p = 0
    let q = 0

    const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ta: number, tb: number, tc: number) => {
      const jitter = prng.next() - 0.5
      for (const [v, t] of [[a, ta], [b, tb], [c, tc]] as Array<[THREE.Vector3, number]>) {
        positions[p++] = v.x
        positions[p++] = v.y
        positions[p++] = v.z
        params[q++] = t
        params[q++] = jitter
      }
    }

    for (let i = 0; i < segments; i++) {
      const cur = ring[i]!
      const nxt = ring[(i + 1) % segments]!

      // Sườn trong (hướng về chùa): chân trong -> sống núi
      pushTri(cur.inner, cur.peak, nxt.inner, 0, 1, 0)
      pushTri(nxt.inner, cur.peak, nxt.peak, 0, 1, 1)
      // Sườn ngoài: sống núi -> chân ngoài (mặt sau, che khoảng hở khi nhìn từ xa)
      pushTri(cur.peak, cur.outer, nxt.peak, 1, 0, 1)
      pushTri(nxt.peak, cur.outer, nxt.outer, 1, 0, 0)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.name = `MountainRing_${config.slot}`
    mesh.castShadow = false
    mesh.receiveShadow = false
    this.root.add(mesh)
    this.layers.push({ mesh, slot: config.slot, params })
  }

  /** Tô lại màu núi theo bảng màu thời điểm trong ngày. */
  public setPalette(mode: TimeOfDayMode) {
    const pal = Palette.get(mode)
    const fogColor = new THREE.Color(pal.fog.color)
    const grassDark = new THREE.Color(pal.slots.grassDark)
    const base = new THREE.Color()
    const peak = new THREE.Color()
    const tmp = new THREE.Color()

    for (const layer of this.layers) {
      const slotColor = new THREE.Color(pal.slots[layer.slot])
      // Chân núi pha chút xanh cỏ tối + sương, đỉnh sáng hơn
      base.copy(slotColor).lerp(grassDark, layer.slot === 'mountainNear' ? 0.55 : 0.25).lerp(fogColor, 0.1)
      peak.copy(slotColor).multiplyScalar(1.08)

      const colorAttr = layer.mesh.geometry.getAttribute('color') as THREE.BufferAttribute
      const arr = colorAttr.array as Float32Array
      const n = colorAttr.count
      for (let i = 0; i < n; i++) {
        const t = layer.params[i * 2]!
        const jitter = layer.params[i * 2 + 1]!
        tmp.copy(base).lerp(peak, t)
        const k = 1.0 + jitter * 0.16
        arr[i * 3] = tmp.r * k
        arr[i * 3 + 1] = tmp.g * k
        arr[i * 3 + 2] = tmp.b * k
      }
      colorAttr.needsUpdate = true
    }
  }

  public dispose() {
    for (const layer of this.layers) {
      layer.mesh.geometry.dispose()
    }
    this.layers = []
    // Vật liệu vertexColor dùng chung từ FlatMaterialFactory: không dispose ở đây.
  }
}
