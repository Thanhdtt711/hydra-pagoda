import * as THREE from 'three'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import type { PilgrimCountry } from './AvatarModel'
import { AVATAR_PALETTES, buildLod1Geometry, buildLod2Geometry } from './AvatarGeometry'

/**
 * AvatarKit:
 * Kho hình học LOD xa dùng chung cho đám đông, dựng lười theo từng quốc gia.
 * - LOD1: mô hình đứng gộp 1 mảnh (~500 tam giác), vertex color.
 * - LOD2: hình khối rất thô (~100 tam giác), vertex color.
 * Vật liệu dùng chung là FlatMaterialFactory.vertexColor() nên KHÔNG dispose ở đây.
 */
export class AvatarKit {
  private static instance: AvatarKit | null = null

  private lod1Cache = new Map<PilgrimCountry, THREE.BufferGeometry>()
  private lod2Cache = new Map<PilgrimCountry, THREE.BufferGeometry>()

  public static getInstance(): AvatarKit {
    if (!AvatarKit.instance) {
      AvatarKit.instance = new AvatarKit()
    }
    return AvatarKit.instance
  }

  /** Vật liệu vertex color dùng chung toàn cảnh. */
  public get material(): THREE.MeshLambertMaterial {
    return FlatMaterialFactory.getInstance().vertexColor()
  }

  public getLod1Geometry(country: PilgrimCountry): THREE.BufferGeometry {
    let geo = this.lod1Cache.get(country)
    if (!geo) {
      geo = buildLod1Geometry(AVATAR_PALETTES[country] ?? AVATAR_PALETTES.vietnam)
      this.lod1Cache.set(country, geo)
    }
    return geo
  }

  public getLod2Geometry(country: PilgrimCountry): THREE.BufferGeometry {
    let geo = this.lod2Cache.get(country)
    if (!geo) {
      geo = buildLod2Geometry(AVATAR_PALETTES[country] ?? AVATAR_PALETTES.vietnam)
      this.lod2Cache.set(country, geo)
    }
    return geo
  }

  public dispose() {
    this.lod1Cache.forEach((g) => g.dispose())
    this.lod2Cache.forEach((g) => g.dispose())
    this.lod1Cache.clear()
    this.lod2Cache.clear()
    AvatarKit.instance = null
  }
}
