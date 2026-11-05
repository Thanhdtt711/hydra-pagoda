import * as THREE from 'three'
import type { PilgrimCountry } from '../PilgrimAvatar'

export type GenderKind = 'monk' | 'layman' | 'laywoman'
export type BodyTypeKind = 'slender' | 'regular' | 'athletic' | 'stout'
export type HairStyleKind = 'bun' | 'topknot' | 'shaved' | 'short' | 'braid'

export interface AvatarDescriptor {
  peerId: string
  country: PilgrimCountry
  gender: GenderKind
  bodyType: BodyTypeKind
  heightScale: number // 0.94 - 1.06 (Human ~1.65m - 1.82m)
  skinTone: number
  hairStyle: HairStyleKind
  robeColor: number
  trimColor: number
  innerColor: number
  sashColor: number
  hatKind: string
  hatColor: number
}

/**
 * Deterministic PRNG for generating consistent avatar appearance per peerId.
 */
function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SKIN_TONES = [
  0xfde2e4, // Trắng hồng Á Đông
  0xfcd5b5, // Vàng sáng thanh tú
  0xf2c9a1, // Màu ngọc ngà
  0xe5b88f, // Tông da bánh mật khoẻ khoắn
  0xd4a373, // Sạm nắng đất Phật
  0xb5835a  // Nắng gió cao nguyên Tây Tạng
]

/**
 * Tạo AvatarDescriptor tất định từ peerId và quốc gia.
 * Đảm bảo cùng một người chơi luôn có cùng ngoại hình chuẩn xác trên mọi client.
 */
export function createAvatarDescriptor(peerId: string, country: PilgrimCountry = 'vietnam'): AvatarDescriptor {
  const seed = hashString(peerId || 'pilgrim-local')
  const rng = mulberry32(seed)

  const heightScale = 0.95 + rng() * 0.10 // 0.95 - 1.05
  const skinTone = SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)]

  const bodyTypes: BodyTypeKind[] = ['slender', 'regular', 'athletic', 'regular']
  const bodyType = bodyTypes[Math.floor(rng() * bodyTypes.length)]

  let gender: GenderKind = 'layman'
  const gVal = rng()
  if (gVal < 0.35) gender = 'monk'
  else if (gVal < 0.70) gender = 'layman'
  else gender = 'laywoman'

  let hairStyle: HairStyleKind = 'bun'
  if (gender === 'monk' || country === 'thailand' || country === 'india') {
    hairStyle = 'shaved'
  } else if (gender === 'laywoman') {
    hairStyle = rng() > 0.5 ? 'bun' : 'braid'
  } else {
    hairStyle = rng() > 0.5 ? 'topknot' : 'short'
  }

  return {
    peerId,
    country,
    gender,
    bodyType,
    heightScale,
    skinTone,
    hairStyle,
    robeColor: 0x3d5a80,
    trimColor: 0xd4af37,
    innerColor: 0xdedac8,
    sashColor: 0x98c1d9,
    hatKind: 'non_la',
    hatColor: 0xe6cf96
  }
}

