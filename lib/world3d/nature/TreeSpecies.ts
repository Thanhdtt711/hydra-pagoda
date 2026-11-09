/**
 * TreeSpecies (Low-poly Minimalist):
 * Định nghĩa 6 loài cây cổ tự và hồ sơ hình dáng. Không còn thông số PBR hay texture:
 * màu thật lấy từ Palette (slot 'trunk' và 'leaf') nhân với màu "tint" của từng loài.
 */

export type TreeSpeciesType =
  | 'bodhi' // Cây Bồ Đề Bát Nhã (đại thụ trung tâm)
  | 'banyan' // Cây Đa / Đề cổ thụ rễ phụ
  | 'bamboo' // Cụm Trúc thiền tông
  | 'pine' // Thông cổ tự tầng tầng
  | 'cherry_maple' // Phong đỏ / Anh đào theo quốc gia
  | 'palm' // Hàng Cau cảnh / Cọ Nam Á

export const TREE_SPECIES_LIST: TreeSpeciesType[] = ['bodhi', 'banyan', 'bamboo', 'pine', 'cherry_maple', 'palm']

export interface TreeSpawnData {
  id: string
  species: TreeSpeciesType
  x: number
  z: number
  scale?: number
  rotY?: number
  seed?: number
}

export interface SpeciesVisualProfile {
  name: string
  species: TreeSpeciesType
  /** Chiều cao thân (m) – dùng cho collider hình trụ. */
  trunkHeight: number
  /** Bán kính tán (m), để tham chiếu bố cục. */
  canopyRadius: number
  /** Bán kính collider thân (m). */
  colliderRadius: number
  /** Màu tán lá mong muốn ở bảng màu ban ngày (sRGB hex). Khi đổi giờ, màu tự tối/sáng theo Palette. */
  leafColor: number
  /** Màu thân mong muốn ở bảng màu ban ngày (sRGB hex). */
  trunkColor: number
  /** Biên độ nghiêng theo gió (hệ số). */
  sway: number
}

export const TREE_SPECIES_PROFILES: Record<TreeSpeciesType, SpeciesVisualProfile> = {
  bodhi: {
    name: 'Cây Bồ Đề Đại Thụ',
    species: 'bodhi',
    trunkHeight: 8.5,
    canopyRadius: 5.8,
    colliderRadius: 1.1,
    leafColor: 0x5da35a,
    trunkColor: 0x7a5a42,
    sway: 0.6
  },
  banyan: {
    name: 'Cây Đa Cổ Thụ',
    species: 'banyan',
    trunkHeight: 9.0,
    canopyRadius: 6.8,
    colliderRadius: 1.4,
    leafColor: 0x4c8f55,
    trunkColor: 0x6e5240,
    sway: 0.5
  },
  bamboo: {
    name: 'Trúc Thiền Tông',
    species: 'bamboo',
    trunkHeight: 7.2,
    canopyRadius: 1.8,
    colliderRadius: 0.35,
    leafColor: 0x9cc65a,
    trunkColor: 0x8fae5a,
    sway: 1.6
  },
  pine: {
    name: 'Thông Cổ Tự',
    species: 'pine',
    trunkHeight: 8.0,
    canopyRadius: 3.8,
    colliderRadius: 0.65,
    leafColor: 0x3f7d5a,
    trunkColor: 0x6a4a3a,
    sway: 0.7
  },
  cherry_maple: {
    name: 'Phong Đỏ / Anh Đào Cổ Thụ',
    species: 'cherry_maple',
    trunkHeight: 6.8,
    canopyRadius: 4.2,
    colliderRadius: 0.5,
    leafColor: 0xc8452f,
    trunkColor: 0x6b4a42,
    sway: 1.0
  },
  palm: {
    name: 'Hàng Cau Cảnh Nam Á',
    species: 'palm',
    trunkHeight: 7.5,
    canopyRadius: 2.8,
    colliderRadius: 0.3,
    leafColor: 0x58b068,
    trunkColor: 0x9a8566,
    sway: 1.3
  }
}

/** Màu tán của loài phong/anh đào theo quốc gia (Nhật/Hàn = anh đào hồng, còn lại = phong đỏ). */
export function getMapleLeafColor(countryCode: string): number {
  return countryCode === 'japan' || countryCode === 'korea' ? 0xf4a9c0 : 0xc8452f
}
