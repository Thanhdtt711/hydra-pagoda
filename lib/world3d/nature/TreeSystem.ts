import * as THREE from 'three'
import { WindSystem } from './WindSystem'
import { MapLayout } from '../world/MapLayout'
import {
  TREE_SPECIES_LIST,
  TREE_SPECIES_PROFILES,
  getMapleLeafColor,
  type TreeSpawnData,
  type TreeSpeciesType
} from './TreeSpecies'
import { CylinderCollider } from '../collision/Collider'
import { CollisionWorld } from '../collision/CollisionWorld'
import { TerrainSystem } from '../world/TerrainSystem'
import { LowPolyBuilder, type ColoredPart } from '../style/LowPolyBuilder'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { Palette, type TimeOfDayMode } from '../style/Palette'

/**
 * TreeSystem (Low-poly Minimalist):
 * - 6 loài cây dựng bằng khối facet (trụ, nón, cầu ít mặt có jitter), màu "nướng" dạng sắc độ xám vào vertex color.
 * - Màu thật = màu loài (TREE_SPECIES_PROFILES) nhân tỉ lệ Palette(mode)/Palette(day) nên tự tối/ấm theo giờ.
 * - Mỗi loài 2 InstancedMesh (thân + tán) => tối đa 12 draw call cho toàn bộ cây.
 * - Gió từ WindSystem qua onBeforeCompile (nhún ngọn, rung nhẹ tán), pha riêng theo vị trí từng cây.
 * - Collider thân cây sinh từ MapLayout.getTreeSpawns() nên hình ảnh và va chạm luôn khớp nhau.
 */

// ---------- Sắc độ xám nướng vào vertex color ----------
const LIGHT = 0xffffff
const MID = 0xe4e4e4
const DARK = 0xc4c4c4

type Vec3 = [number, number, number]

const _up = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()
const _eu = new THREE.Euler()
const _d = new THREE.Vector3()

function orient(dir: THREE.Vector3): Vec3 {
  _q.setFromUnitVectors(_up, dir)
  _eu.setFromQuaternion(_q, 'XYZ')
  return [_eu.x, _eu.y, _eu.z]
}

/** Khối trụ đi từ điểm `from` đến `to` (bán kính rFrom ở đầu `from`, rTo ở đầu `to`). */
function limb(parts: ColoredPart[], from: Vec3, to: Vec3, rFrom: number, rTo: number, seg: number, shade: number) {
  _d.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = _d.length()
  if (len < 1e-4) return
  _d.normalize()
  parts.push({
    geometry: LowPolyBuilder.cylinder(rTo, rFrom, len, seg),
    color: shade,
    transform: {
      position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      rotation: orient(_d)
    }
  })
}

/** Nón mọc từ `base` theo hướng `dir` (đơn vị), dùng cho tán thông, tàu cau, lá trúc. */
function coneDir(
  parts: ColoredPart[],
  base: Vec3,
  dir: Vec3,
  r: number,
  len: number,
  seg: number,
  shade: number,
  flat = 1
) {
  _d.set(dir[0], dir[1], dir[2]).normalize()
  parts.push({
    geometry: LowPolyBuilder.cone(r, len, seg),
    color: shade,
    transform: {
      position: [base[0] + _d.x * len * 0.5, base[1] + _d.y * len * 0.5, base[2] + _d.z * len * 0.5],
      rotation: orient(_d),
      scale: [1, 1, flat]
    }
  })
}

/** Cụm tán dạng cầu dẹt facet có làm lệch đỉnh nhẹ. */
function blob(
  parts: ColoredPart[],
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  shade: number,
  seed: number
) {
  parts.push({
    geometry: LowPolyBuilder.jitter(LowPolyBuilder.sphere(1, 1), 0.14, seed),
    color: shade,
    transform: { position: [x, y, z], scale: [rx, ry, rz] }
  })
}

interface SpeciesGeometry {
  trunk: THREE.BufferGeometry
  foliage: THREE.BufferGeometry
}

function buildSpeciesGeometry(species: TreeSpeciesType): SpeciesGeometry {
  const trunk: ColoredPart[] = []
  const foliage: ColoredPart[] = []

  switch (species) {
    case 'bodhi': {
      limb(trunk, [0, 0, 0], [0.1, 7.2, 0], 1.05, 0.62, 7, LIGHT)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.3
        limb(trunk, [Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5], [Math.cos(a) * 0.5, 2.0, Math.sin(a) * 0.5], 0.32, 0.12, 5, DARK)
      }
      for (const a of [0.4, 2.5, 4.6]) {
        limb(trunk, [0, 5.6, 0], [Math.cos(a) * 2.8, 7.4, Math.sin(a) * 2.8], 0.42, 0.2, 6, MID)
      }
      blob(foliage, 0, 8.7, 0, 3.8, 1.9, 3.8, LIGHT, 11)
      blob(foliage, 2.7, 7.6, 1.2, 2.7, 1.4, 2.7, MID, 12)
      blob(foliage, -2.5, 7.4, 1.6, 2.6, 1.3, 2.6, DARK, 13)
      blob(foliage, 0.4, 7.2, -2.7, 2.8, 1.4, 2.8, MID, 14)
      blob(foliage, 0, 10.2, 0, 2.2, 1.2, 2.2, LIGHT, 15)
      break
    }
    case 'banyan': {
      limb(trunk, [0, 0, 0], [0, 8.0, 0], 1.5, 0.95, 7, LIGHT)
      for (const a of [0.2, 1.7, 3.3, 4.9]) {
        limb(trunk, [0, 6.0, 0], [Math.cos(a) * 4.0, 7.6, Math.sin(a) * 4.0], 0.62, 0.3, 6, MID)
      }
      // Rễ phụ rủ từ cành xuống đất
      const roots: Array<[number, number]> = [
        [2.9, 1.2],
        [-2.7, 1.6],
        [0.8, -3.1],
        [-1.4, -2.9],
        [3.4, -1.4],
        [-3.2, -0.9]
      ]
      for (const [rx, rz] of roots) {
        limb(trunk, [rx, 6.8, rz], [rx * 1.02, 0, rz * 1.02], 0.1, 0.17, 4, DARK)
      }
      blob(foliage, 0, 8.4, 0, 4.8, 1.8, 4.8, LIGHT, 21)
      blob(foliage, 3.0, 7.4, 1.6, 3.3, 1.5, 3.3, MID, 22)
      blob(foliage, -3.1, 7.2, 1.7, 3.1, 1.4, 3.1, DARK, 23)
      blob(foliage, 1.1, 7.1, -3.2, 3.4, 1.5, 3.4, MID, 24)
      blob(foliage, -1.6, 7.0, -3.0, 3.1, 1.4, 3.1, DARK, 25)
      blob(foliage, 0, 9.8, 0, 2.5, 1.2, 2.5, LIGHT, 26)
      break
    }
    case 'bamboo': {
      const culms: Array<[number, number, number, number, number]> = [
        [0.0, 0.0, 7.4, 0.04, -0.05],
        [0.4, 0.3, 7.0, 0.1, 0.08],
        [-0.38, 0.32, 7.2, -0.08, 0.1],
        [0.46, -0.34, 6.7, 0.12, -0.08],
        [-0.42, -0.36, 6.9, -0.1, -0.06]
      ]
      culms.forEach(([x, z, h, tx, tz], i) => {
        const top: Vec3 = [x + tx * h, h, z + tz * h]
        limb(trunk, [x, 0, z], top, 0.1, 0.06, 5, i % 2 ? MID : LIGHT)
        // Vài chùm lá nón nhọn tỏa ra ở phần ngọn
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1 + i
          const y = h - 0.4 - k * 0.7
          const base: Vec3 = [x + tx * y, y, z + tz * y]
          coneDir(foliage, base, [Math.cos(a) * 0.9, 0.35, Math.sin(a) * 0.9], 0.28, 1.5, 4, k === 0 ? LIGHT : MID, 0.45)
        }
      })
      break
    }
    case 'pine': {
      limb(trunk, [0, 0, 0], [-0.2, 3.0, 0.1], 0.65, 0.46, 6, LIGHT)
      limb(trunk, [-0.2, 3.0, 0.1], [0.12, 5.8, 0], 0.46, 0.32, 6, MID)
      limb(trunk, [0.12, 5.8, 0], [0, 8.0, 0], 0.32, 0.16, 6, LIGHT)
      const tiers: Array<[number, number, number, number, number]> = [
        [0.6, 3.2, 0.2, 3.0, 2.3],
        [-0.4, 4.7, 0.2, 2.5, 2.2],
        [0.3, 6.1, -0.2, 1.9, 2.0],
        [-0.1, 7.4, 0, 1.3, 1.8],
        [0, 8.6, 0, 0.75, 1.5]
      ]
      tiers.forEach(([x, y, z, r, h], i) => {
        foliage.push({
          geometry: LowPolyBuilder.cone(r, h, 7),
          color: i % 2 ? MID : LIGHT,
          transform: { position: [x, y, z], rotation: [0, i * 0.5, 0] }
        })
      })
      break
    }
    case 'cherry_maple': {
      limb(trunk, [0, 0, 0], [-0.2, 3.6, 0], 0.46, 0.32, 6, LIGHT)
      limb(trunk, [-0.2, 3.6, 0], [-1.5, 5.4, 0.3], 0.3, 0.16, 5, MID)
      limb(trunk, [-0.2, 3.6, 0], [1.3, 5.6, -0.3], 0.28, 0.15, 5, MID)
      blob(foliage, -1.7, 5.9, 0.4, 1.9, 1.3, 1.9, MID, 31)
      blob(foliage, 1.6, 6.1, -0.3, 1.8, 1.2, 1.8, DARK, 32)
      blob(foliage, 0, 7.1, 0, 2.1, 1.4, 2.1, LIGHT, 33)
      blob(foliage, -0.5, 5.3, -0.9, 1.5, 1.0, 1.5, DARK, 34)
      break
    }
    case 'palm': {
      const crown: Vec3 = [0.4, 7.2, 0]
      limb(trunk, [0, 0, 0], crown, 0.3, 0.2, 6, LIGHT)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2
        coneDir(foliage, crown, [Math.cos(a) * 0.85, 0.5 - (i % 2) * 0.18, Math.sin(a) * 0.85], 0.42, 3.0, 4, i % 2 ? MID : LIGHT, 0.4)
      }
      break
    }
  }

  return {
    trunk: LowPolyBuilder.mergeColored(trunk),
    foliage: LowPolyBuilder.mergeColored(foliage)
  }
}

export class TreeSystem {
  public root: THREE.Group
  private windSystem: WindSystem
  private mode: TimeOfDayMode
  private trunkMeshes = new Map<TreeSpeciesType, THREE.InstancedMesh>()
  private foliageMeshes = new Map<TreeSpeciesType, THREE.InstancedMesh>()
  private trunkMats = new Map<TreeSpeciesType, THREE.MeshLambertMaterial>()
  private foliageMats = new Map<TreeSpeciesType, THREE.MeshLambertMaterial>()
  private leafBase = {} as Record<TreeSpeciesType, number>
  private geometries: THREE.BufferGeometry[] = []

  constructor(scene?: THREE.Scene, windSystem?: WindSystem) {
    this.root = new THREE.Group()
    this.root.name = 'TreeSystem'
    this.windSystem = windSystem || WindSystem.getInstance()
    this.mode = FlatMaterialFactory.getInstance().currentMode

    for (const sp of TREE_SPECIES_LIST) {
      this.leafBase[sp] = TREE_SPECIES_PROFILES[sp].leafColor
    }

    this.buildAllSpecies()
    this.applyColors()

    if (scene) scene.add(this.root)
  }

  /**
   * Tự động đăng ký CylinderCollider cho toàn bộ thân cây từ MapLayout.getTreeSpawns().
   * Hình ảnh và vùng va chạm lấy chung một nguồn nên không bao giờ lệch vị trí.
   */
  public registerColliders(collisionWorld: CollisionWorld): number {
    const spawns = MapLayout.getTreeSpawns()
    let registeredCount = 0

    for (const spawn of spawns) {
      const profile = TREE_SPECIES_PROFILES[spawn.species]
      const scale = spawn.scale || 1.0
      const radius = profile.colliderRadius * scale
      const height = profile.trunkHeight * scale
      const elev = TerrainSystem.computeElevation(spawn.x, spawn.z)
      const centerY = elev + height * 0.5

      collisionWorld.add(
        new CylinderCollider(
          `tree_trunk_${spawn.id}`,
          new THREE.Vector3(spawn.x, centerY, spawn.z),
          radius,
          height,
          false
        )
      )
      registeredCount++
    }

    return registeredCount
  }

  private buildAllSpecies() {
    const spawns = MapLayout.getTreeSpawns()
    const bySpecies = new Map<TreeSpeciesType, TreeSpawnData[]>()
    for (const sp of TREE_SPECIES_LIST) bySpecies.set(sp, [])
    for (const s of spawns) bySpecies.get(s.species)?.push(s)

    const dummy = new THREE.Object3D()
    const tone = new THREE.Color()

    for (const sp of TREE_SPECIES_LIST) {
      const list = bySpecies.get(sp) ?? []
      if (list.length === 0) continue

      const profile = TREE_SPECIES_PROFILES[sp]
      const geo = buildSpeciesGeometry(sp)
      this.geometries.push(geo.trunk, geo.foliage)

      const trunkMat = this.createWindMaterial(false, profile.sway * 0.45)
      const foliageMat = this.createWindMaterial(true, profile.sway)
      this.trunkMats.set(sp, trunkMat)
      this.foliageMats.set(sp, foliageMat)

      const trunkMesh = new THREE.InstancedMesh(geo.trunk, trunkMat, list.length)
      const foliageMesh = new THREE.InstancedMesh(geo.foliage, foliageMat, list.length)
      trunkMesh.name = `trees_${sp}_trunk`
      foliageMesh.name = `trees_${sp}_foliage`
      for (const m of [trunkMesh, foliageMesh]) {
        m.castShadow = true
        m.receiveShadow = true
      }

      list.forEach((item, i) => {
        const s = item.scale || 1.0
        const elev = TerrainSystem.computeElevation(item.x, item.z)
        dummy.position.set(item.x, elev, item.z)
        dummy.rotation.set(0, item.rotY ?? 0, 0)
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        trunkMesh.setMatrixAt(i, dummy.matrix)
        foliageMesh.setMatrixAt(i, dummy.matrix)

        // Biến thiên sắc độ nhẹ giữa các cây cùng loài (không tạo vật liệu mới)
        const seed = item.seed ?? i
        const v = 0.9 + (((seed * 9301 + 49297) % 233280) / 233280) * 0.2
        tone.setRGB(v, v, v)
        trunkMesh.setColorAt(i, tone)
        foliageMesh.setColorAt(i, tone)
      })
      trunkMesh.instanceMatrix.needsUpdate = true
      foliageMesh.instanceMatrix.needsUpdate = true
      if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true
      if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true

      this.trunkMeshes.set(sp, trunkMesh)
      this.foliageMeshes.set(sp, foliageMesh)
      this.root.add(trunkMesh)
      this.root.add(foliageMesh)
    }
  }

  /** Vật liệu Lambert phẳng + gió từ WindSystem. Hai chương trình shader (thân / tán) dùng chung cho mọi loài. */
  private createWindMaterial(isFoliage: boolean, sway: number): THREE.MeshLambertMaterial {
    const mat = new THREE.MeshLambertMaterial({
      flatShading: true,
      vertexColors: true,
      side: isFoliage ? THREE.DoubleSide : THREE.FrontSide
    })
    const uTreeSway = { value: sway }

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.windSystem.uniforms.uWindTime
      shader.uniforms.uWindDirection = this.windSystem.uniforms.uWindDirection
      shader.uniforms.uWindStrength = this.windSystem.uniforms.uWindStrength
      shader.uniforms.uWindGust = this.windSystem.uniforms.uWindGust
      shader.uniforms.uTreeSway = uTreeSway

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWindTime;
uniform vec2 uWindDirection;
uniform float uWindStrength;
uniform float uWindGust;
uniform float uTreeSway;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  vec2 treeP = instanceMatrix[3].xz;
  #else
  vec2 treeP = vec2(0.0);
  #endif
  float hf = clamp(transformed.y / 8.0, 0.0, 1.6);
  float hs = hf * hf;
  float ph = dot(treeP, vec2(0.23, 0.19));
  float gust = 1.0 + uWindGust * 0.8;
  float sw = sin(uWindTime * 1.7 + ph) * 0.65 + sin(uWindTime * 2.9 + ph * 1.7) * 0.35 + 0.35;
  float disp = sw * uWindStrength * gust * uTreeSway * hs * 1.6;
  transformed.x += uWindDirection.x * disp;
  transformed.z += uWindDirection.y * disp;
  ${isFoliage ? 'transformed.y += sin(uWindTime * 3.2 + transformed.x * 1.3 + ph) * 0.05 * hf * uWindStrength * uTreeSway;' : ''}
}`
        )
    }
    mat.customProgramCacheKey = () => (isFoliage ? 'tree-wind-foliage' : 'tree-wind-trunk')
    return mat
  }

  /** Màu loài nhân tỉ lệ Palette(mode)/Palette(day) theo từng kênh. */
  private tint(base: number, slot: 'leaf' | 'trunk'): THREE.Color {
    const c = new THREE.Color(base)
    const cur = new THREE.Color(Palette.slot(this.mode, slot))
    const ref = new THREE.Color(Palette.slot('day', slot))
    c.r *= cur.r / Math.max(ref.r, 0.001)
    c.g *= cur.g / Math.max(ref.g, 0.001)
    c.b *= cur.b / Math.max(ref.b, 0.001)
    return c
  }

  private applyColors() {
    for (const sp of TREE_SPECIES_LIST) {
      const profile = TREE_SPECIES_PROFILES[sp]
      this.trunkMats.get(sp)?.color.copy(this.tint(profile.trunkColor, 'trunk'))
      this.foliageMats.get(sp)?.color.copy(this.tint(this.leafBase[sp], 'leaf'))
    }
  }

  /** Đổi bảng màu theo thời điểm trong ngày (không tạo lại vật liệu). */
  public setPalette(mode: TimeOfDayMode) {
    this.mode = mode
    this.applyColors()
  }

  /** Nhật/Hàn = anh đào hồng phấn, còn lại = phong đỏ. */
  public setCountry(countryCode: string) {
    this.leafBase.cherry_maple = getMapleLeafColor(countryCode)
    this.applyColors()
  }

  public update(_delta: number) {
    // Uniform gió được WindSystem cập nhật dùng chung
  }

  public dispose() {
    for (const geo of this.geometries) geo.dispose()
    this.trunkMats.forEach((m) => m.dispose())
    this.foliageMats.forEach((m) => m.dispose())
    this.trunkMeshes.forEach((m) => m.dispose())
    this.foliageMeshes.forEach((m) => m.dispose())
    this.geometries = []
    this.trunkMats.clear()
    this.foliageMats.clear()
    this.trunkMeshes.clear()
    this.foliageMeshes.clear()
    this.root.parent?.remove(this.root)
  }
}
