import * as THREE from 'three'
import { WindSystem } from './WindSystem'
import { SeededPRNG } from '../utils/SeededPRNG'
import { MapLayout } from '../world/MapLayout'
import { TerrainSystem } from '../world/TerrainSystem'
import { LowPolyBuilder, type ColoredPart } from '../style/LowPolyBuilder'
import { Palette, type TimeOfDayMode } from '../style/Palette'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'

/**
 * WindGrass (Low-poly Minimalist):
 * - Cỏ = các khóm gồm vài lưỡi nón 3 mặt nghiêng nhẹ, gộp thành 1 geometry, 1 InstancedMesh.
 * - Hoa = đài hoa nón ngược 5 mặt trên cuống mảnh, 1 InstancedMesh, màu từng bông qua instanceColor.
 * - Màu cỏ lấy từ Palette slot 'grass' theo thời điểm trong ngày, không tạo lại vật liệu.
 * - Gió từ WindSystem (onBeforeCompile), pha riêng theo vị trí từng khóm.
 * - Tổng cộng 2 draw call.
 *
 * API tương thích bản cũ: `mesh`, `update(delta, elapsed)`, `dispose()`; thêm `root` và `setPalette(mode)`.
 */

const FLOWER_COLORS = [0xf4f0e6, 0xf4a7b9, 0xf5d36a, 0xb9a7f0]

const GRASS_SEED = 888123
const FLOWER_SEED = 777331

function buildClumpGeometry(): THREE.BufferGeometry {
  const rng = new SeededPRNG(4242)
  const parts: ColoredPart[] = []
  const bladeCount = 5

  for (let i = 0; i < bladeCount; i++) {
    const h = 0.45 + rng.next() * 0.4
    const r = 0.055 + rng.next() * 0.025
    const a = (i / bladeCount) * Math.PI * 2 + rng.next() * 0.8
    const off = i === 0 ? 0 : 0.07 + rng.next() * 0.07
    const tilt = i === 0 ? (rng.next() - 0.5) * 0.15 : 0.15 + rng.next() * 0.3

    const geo = LowPolyBuilder.flat(new THREE.ConeGeometry(r, h, 3, 1, true))
    geo.translate(0, h / 2, 0)

    const shade = [0xffffff, 0xe6e6e6, 0xf2f2f2][i % 3]
    parts.push({
      geometry: geo,
      color: shade,
      transform: {
        position: [Math.cos(a) * off, 0, Math.sin(a) * off],
        // Nghiêng lưỡi ra ngoài tâm khóm
        rotation: [Math.sin(a) * tilt, a, -Math.cos(a) * tilt]
      }
    })
  }

  const merged = LowPolyBuilder.mergeColored(parts)

  // Gradient gốc tối - ngọn sáng nướng vào vertex color
  const pos = merged.attributes.position as THREE.BufferAttribute
  const col = merged.attributes.color as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const k = 0.7 + 0.3 * Math.min(Math.max(pos.getY(i) / 0.8, 0), 1)
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k)
  }
  col.needsUpdate = true
  return merged
}

function buildFlowerGeometry(): THREE.BufferGeometry {
  const stem = LowPolyBuilder.flat(new THREE.CylinderGeometry(0.012, 0.016, 0.3, 3))
  stem.translate(0, 0.15, 0)

  const cup = LowPolyBuilder.flat(new THREE.ConeGeometry(0.1, 0.13, 5, 1, false))
  cup.rotateX(Math.PI) // đỉnh nón hướng xuống, miệng hoa hướng lên
  cup.translate(0, 0.37, 0)

  const core = LowPolyBuilder.flat(new THREE.IcosahedronGeometry(0.04, 0))
  core.translate(0, 0.42, 0)

  return LowPolyBuilder.mergeColored([
    { geometry: stem, color: 0x6a6a6a },
    { geometry: cup, color: 0xffffff },
    { geometry: core, color: 0xdcdcdc }
  ])
}

export class WindGrass {
  public root: THREE.Group
  public mesh: THREE.InstancedMesh
  public flowers: THREE.InstancedMesh

  private grassGeo: THREE.BufferGeometry
  private flowerGeo: THREE.BufferGeometry
  private grassMat: THREE.MeshLambertMaterial
  private flowerMat: THREE.MeshLambertMaterial
  private windSystem: WindSystem
  private mode: TimeOfDayMode

  private grassCount = 1800
  private flowerCount = 240

  constructor(windSystem?: WindSystem) {
    this.windSystem = windSystem || WindSystem.getInstance()
    this.mode = FlatMaterialFactory.getInstance().currentMode
    this.root = new THREE.Group()
    this.root.name = 'WindGrass'

    this.grassGeo = buildClumpGeometry()
    this.flowerGeo = buildFlowerGeometry()
    this.grassMat = this.createWindMaterial(0.85, 1.4)
    this.flowerMat = this.createWindMaterial(0.45, 0.9)

    this.mesh = new THREE.InstancedMesh(this.grassGeo, this.grassMat, this.grassCount)
    this.mesh.name = 'wind_grass'
    this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false

    this.flowers = new THREE.InstancedMesh(this.flowerGeo, this.flowerMat, this.flowerCount)
    this.flowers.name = 'wind_flowers'
    this.flowers.frustumCulled = false

    this.populateGrass()
    this.populateFlowers()
    this.applyColors()

    this.root.add(this.mesh)
    this.root.add(this.flowers)
  }

  private createWindMaterial(heightRef: number, swayK: number): THREE.MeshLambertMaterial {
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide
    })
    const uHeight = { value: heightRef }
    const uSwayK = { value: swayK }

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.windSystem.uniforms.uWindTime
      shader.uniforms.uWindDirection = this.windSystem.uniforms.uWindDirection
      shader.uniforms.uWindStrength = this.windSystem.uniforms.uWindStrength
      shader.uniforms.uWindGust = this.windSystem.uniforms.uWindGust
      shader.uniforms.uGrassHeight = uHeight
      shader.uniforms.uGrassSway = uSwayK

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWindTime;
uniform vec2 uWindDirection;
uniform float uWindStrength;
uniform float uWindGust;
uniform float uGrassHeight;
uniform float uGrassSway;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  vec2 gp = instanceMatrix[3].xz;
  #else
  vec2 gp = vec2(0.0);
  #endif
  float hf = clamp(transformed.y / uGrassHeight, 0.0, 1.4);
  float hs = hf * hf;
  float ph = dot(gp, vec2(0.35, 0.28));
  float gust = 1.0 + uWindGust * 0.8;
  float sw = sin(uWindTime * 2.4 + ph) * 0.7 + sin(uWindTime * 4.2 + ph * 1.5) * 0.3 + 0.3;
  float disp = sw * uWindStrength * gust * uGrassSway * hs;
  transformed.x += uWindDirection.x * disp;
  transformed.z += uWindDirection.y * disp;
}`
        )
    }
    mat.customProgramCacheKey = () => 'grass-wind'
    return mat
  }

  private populateGrass() {
    const dummy = new THREE.Object3D()
    const prng = new SeededPRNG(GRASS_SEED)
    const tone = new THREE.Color()
    let idx = 0
    let attempts = 0
    const maxAttempts = this.grassCount * 8

    while (idx < this.grassCount && attempts < maxAttempts) {
      attempts++
      const x = prng.range(-65, 65)
      const z = prng.range(-65, 65)
      if (MapLayout.isInExclusionZone(x, z, 0.5)) continue

      const elev = TerrainSystem.computeElevation(x, z)
      const s = prng.range(0.7, 1.3)
      dummy.position.set(x, elev + 0.02, z)
      dummy.rotation.set(0, prng.range(0, Math.PI * 2), 0)
      dummy.scale.set(s, prng.range(0.8, 1.3), s)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(idx, dummy.matrix)

      const v = prng.range(0.82, 1.06)
      tone.setRGB(v, v, v)
      this.mesh.setColorAt(idx, tone)
      idx++
    }

    this.mesh.count = idx
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  private populateFlowers() {
    const dummy = new THREE.Object3D()
    const prng = new SeededPRNG(FLOWER_SEED)
    const c = new THREE.Color()
    let idx = 0
    let attempts = 0
    const maxAttempts = this.flowerCount * 10

    while (idx < this.flowerCount && attempts < maxAttempts) {
      attempts++
      const x = prng.range(-60, 60)
      const z = prng.range(-60, 60)
      if (MapLayout.isInExclusionZone(x, z, 1.0)) continue

      const elev = TerrainSystem.computeElevation(x, z)
      const s = prng.range(0.8, 1.35)
      dummy.position.set(x, elev + 0.02, z)
      dummy.rotation.set(0, prng.range(0, Math.PI * 2), 0)
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      this.flowers.setMatrixAt(idx, dummy.matrix)

      c.setHex(FLOWER_COLORS[Math.floor(prng.range(0, FLOWER_COLORS.length)) % FLOWER_COLORS.length])
      this.flowers.setColorAt(idx, c)
      idx++
    }

    this.flowers.count = idx
    this.flowers.instanceMatrix.needsUpdate = true
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true
  }

  /** Tỉ lệ sáng/tối của palette hiện tại so với ban ngày (theo slot lá). */
  private brightnessRatio(): THREE.Color {
    const cur = new THREE.Color(Palette.slot(this.mode, 'leaf'))
    const ref = new THREE.Color(Palette.slot('day', 'leaf'))
    return new THREE.Color(
      Math.min(cur.r / Math.max(ref.r, 0.001), 1.2),
      Math.min(cur.g / Math.max(ref.g, 0.001), 1.2),
      Math.min(cur.b / Math.max(ref.b, 0.001), 1.2)
    )
  }

  private applyColors() {
    this.grassMat.color.set(Palette.slot(this.mode, 'grass'))
    this.flowerMat.color.copy(this.brightnessRatio())
  }

  /** Đổi bảng màu theo thời điểm trong ngày. */
  public setPalette(mode: TimeOfDayMode) {
    this.mode = mode
    this.applyColors()
  }

  public update(_delta: number, _elapsed: number) {
    // Uniform gió được WindSystem cập nhật dùng chung
  }

  public dispose() {
    this.grassGeo.dispose()
    this.flowerGeo.dispose()
    this.grassMat.dispose()
    this.flowerMat.dispose()
    this.mesh.dispose()
    this.flowers.dispose()
    this.root.parent?.remove(this.root)
  }
}
