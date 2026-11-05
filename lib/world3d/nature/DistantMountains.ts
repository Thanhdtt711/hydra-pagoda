import * as THREE from 'three'
import { SeededPRNG } from '../utils/SeededPRNG'

/**
 * DistantMountains (Dãy Núi Thiêng Xa Xăm Mờ Ảo):
 * Replaces disconnected random ConeGeometry cones with a majestic continuous circular mountain range.
 * Uses fixed-seed deterministic PRNG harmonics so the mountain horizon is 100% stable across reloads.
 * Implements aerial perspective depth fog blending seamlessly with AtmosphereManager.
 */
export class DistantMountains {
  public root: THREE.Group
  private geometries: THREE.BufferGeometry[] = []
  private materials: THREE.Material[] = []

  constructor() {
    this.root = new THREE.Group()
    this.root.name = 'DistantMountains'

    // Layer 1: Dãy đồi trung cảnh (Mid Hills) - Phủ bóng cây rừng trầm mặc
    const midHills = this.createMountainRing({
      radiusInner: 120,
      radiusPeak: 145,
      radiusOuter: 175,
      segments: 96,
      baseHeight: 22,
      peakVariation: 18,
      seed: 889911,
      colorBase: 0x18241c,  // Rừng thông thẫm chân núi
      colorPeak: 0x2c433b,  // Đỉnh đồi xanh rêu trong sương
      roughness: 0.95
    })
    this.root.add(midHills)

    // Layer 2: Dãy núi thiêng viễn cảnh (Distant Majestic Sacred Peaks) - Hùng vĩ trong mây mù
    const farPeaks = this.createMountainRing({
      radiusInner: 180,
      radiusPeak: 225,
      radiusOuter: 280,
      segments: 128,
      baseHeight: 52,
      peakVariation: 42,
      seed: 554433,
      colorBase: 0x1d2936,  // Chân núi ngập trong sương lam
      colorPeak: 0x3d546b,  // Đỉnh núi đá xám lam uy nghi
      roughness: 0.90
    })
    this.root.add(farPeaks)
  }

  /**
   * Tạo dải núi dạng vành khăn tròn liên tục khép kín (Continuous Circular Mountain Ring)
   */
  private createMountainRing(config: {
    radiusInner: number
    radiusPeak: number
    radiusOuter: number
    segments: number
    baseHeight: number
    peakVariation: number
    seed: number
    colorBase: number
    colorPeak: number
    roughness: number
  }): THREE.Mesh {
    const { radiusInner, radiusPeak, radiusOuter, segments, baseHeight, peakVariation, seed } = config
    const prng = new SeededPRNG(seed)

    // Tạo các hệ số sóng Fourier cố định cho đường viền đỉnh núi
    const harmonics = [
      { freq: 2, amp: 0.35, phase: prng.range(0, Math.PI * 2) },
      { freq: 5, amp: 0.28, phase: prng.range(0, Math.PI * 2) },
      { freq: 9, amp: 0.18, phase: prng.range(0, Math.PI * 2) },
      { freq: 17, amp: 0.11, phase: prng.range(0, Math.PI * 2) },
      { freq: 29, amp: 0.08, phase: prng.range(0, Math.PI * 2) }
    ]

    const positions: number[] = []
    const normals: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    const cBase = new THREE.Color(config.colorBase)
    const cPeak = new THREE.Color(config.colorPeak)

    // Mỗi bước góc sinh 3 đỉnh: Inner Base (y=0), Peak Ridge (y=height), Outer Skirt (y=-6)
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)

      // Tính độ cao đỉnh núi theo các hài hòa đa tần số
      let normH = 0
      for (const h of harmonics) {
        normH += Math.sin(theta * h.freq + h.phase) * h.amp
      }
      normH = (normH + 1.0) * 0.5 // Chuẩn hóa về [0, 1]

      const currentPeakHeight = baseHeight + normH * peakVariation
      const peakR = radiusPeak + (normH - 0.5) * 16.0

      // 1. Đỉnh Inner Base (Chân núi phía trong tiếp giáp sân chùa)
      positions.push(cosT * radiusInner, -0.5, sinT * radiusInner)
      normals.push(0, 1, 0)
      colors.push(cBase.r, cBase.g, cBase.b)

      // 2. Đỉnh Peak Ridge (Sống núi nhấp nhô)
      positions.push(cosT * peakR, currentPeakHeight, sinT * peakR)
      normals.push(-sinT * 0.4, 0.8, -cosT * 0.4)
      colors.push(cPeak.r, cPeak.g, cPeak.b)

      // 3. Đỉnh Outer Skirt (Chân núi dốc ra phía ngoài vô cực)
      positions.push(cosT * radiusOuter, -8.0, sinT * radiusOuter)
      normals.push(cosT * 0.6, 0.4, sinT * 0.6)
      colors.push(cBase.r * 0.6, cBase.g * 0.6, cBase.b * 0.6)
    }

    // Kết nối các ô tứ giác thành 2 tam giác
    for (let i = 0; i < segments; i++) {
      const curr = i * 3
      const next = (i + 1) * 3

      // Tam giác dốc mặt trước (Inner Base -> Peak)
      indices.push(curr + 0, curr + 1, next + 0)
      indices.push(next + 0, curr + 1, next + 1)

      // Tam giác dốc mặt sau (Peak -> Outer Skirt)
      indices.push(curr + 1, curr + 2, next + 1)
      indices.push(next + 1, curr + 2, next + 2)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    this.geometries.push(geometry)

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: config.roughness,
      metalness: 0.05,
      fog: true,
      flatShading: false
    })
    this.materials.push(material)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.receiveShadow = false
    mesh.castShadow = false
    return mesh
  }

  public dispose() {
    for (const geo of this.geometries) {
      geo.dispose()
    }
    for (const mat of this.materials) {
      mat.dispose()
    }
    this.geometries = []
    this.materials = []
  }
}

