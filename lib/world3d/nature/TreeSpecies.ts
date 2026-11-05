import * as THREE from 'three'

export type TreeSpeciesType =
  | 'bodhi'        // Cây Bồ Đề Bát Nhã (Cây đại thụ trung tâm)
  | 'banyan'       // Cây Đa / Đề cổ thụ rễ phụ sum suê
  | 'bamboo'       // Cụm Trúc / Tre thiền tông thanh tịnh
  | 'pine'         // Thông cổ tự uốn lượn phong cách Zen
  | 'cherry_maple' // Phong đỏ / Hoa anh đào theo quốc gia
  | 'palm'         // Hàng Cau cảnh / Cọ thiền Nam Á

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
  trunkRadiusBase: number
  trunkRadiusTop: number
  trunkHeight: number
  barkColor: number
  leafColor: number
  leafColorVariant: number
  canopyRadius: number
  canopyHeight: number
  foliageStyle: 'umbrella' | 'layered_pine' | 'bamboo_spray' | 'palm_crown' | 'gnarled_spreading'
  colliderRadius: number
}

export const TREE_SPECIES_PROFILES: Record<TreeSpeciesType, SpeciesVisualProfile> = {
  bodhi: {
    name: 'Cây Bồ Đề Đại Thụ',
    species: 'bodhi',
    trunkRadiusBase: 0.95,
    trunkRadiusTop: 0.65,
    trunkHeight: 8.5,
    barkColor: 0x3a281c,
    leafColor: 0x2d6a3f,
    leafColorVariant: 0x70a040,
    canopyRadius: 5.8,
    canopyHeight: 5.5,
    foliageStyle: 'umbrella',
    colliderRadius: 1.1
  },
  banyan: {
    name: 'Cây Đa Cổ Thụ Rễ Phụ',
    species: 'banyan',
    trunkRadiusBase: 1.25,
    trunkRadiusTop: 0.85,
    trunkHeight: 9.0,
    barkColor: 0x32241b,
    leafColor: 0x1e4a2a,
    leafColorVariant: 0x2e6b3c,
    canopyRadius: 6.8,
    canopyHeight: 6.2,
    foliageStyle: 'gnarled_spreading',
    colliderRadius: 1.4
  },
  bamboo: {
    name: 'Cụm Trúc Thiền Tông',
    species: 'bamboo',
    trunkRadiusBase: 0.08,
    trunkRadiusTop: 0.05,
    trunkHeight: 7.2,
    barkColor: 0x608038,
    leafColor: 0x558b2f,
    leafColorVariant: 0x8bc34a,
    canopyRadius: 1.8,
    canopyHeight: 4.8,
    foliageStyle: 'bamboo_spray',
    colliderRadius: 0.35
  },
  pine: {
    name: 'Thông Cổ Tự',
    species: 'pine',
    trunkRadiusBase: 0.55,
    trunkRadiusTop: 0.28,
    trunkHeight: 8.0,
    barkColor: 0x42261d,
    leafColor: 0x1b3b22,
    leafColorVariant: 0x285934,
    canopyRadius: 3.8,
    canopyHeight: 6.0,
    foliageStyle: 'layered_pine',
    colliderRadius: 0.65
  },
  cherry_maple: {
    name: 'Phong Đỏ / Anh Đào Cổ Thụ',
    species: 'cherry_maple',
    trunkRadiusBase: 0.42,
    trunkRadiusTop: 0.24,
    trunkHeight: 6.8,
    barkColor: 0x3d2c29,
    leafColor: 0xa8201a, // Đỏ phong rực rỡ (tự điều chỉnh sang hồng anh đào nếu là Nhật)
    leafColorVariant: 0xe05638,
    canopyRadius: 4.2,
    canopyHeight: 4.5,
    foliageStyle: 'umbrella',
    colliderRadius: 0.50
  },
  palm: {
    name: 'Hàng Cau Cảnh Nam Á',
    species: 'palm',
    trunkRadiusBase: 0.22,
    trunkRadiusTop: 0.16,
    trunkHeight: 7.5,
    barkColor: 0x6e6357,
    leafColor: 0x386641,
    leafColorVariant: 0x588157,
    canopyRadius: 2.8,
    canopyHeight: 2.2,
    foliageStyle: 'palm_crown',
    colliderRadius: 0.30
  }
}

