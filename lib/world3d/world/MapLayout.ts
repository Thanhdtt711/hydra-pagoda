import { type TreeSpawnData, type TreeSpeciesType, TREE_SPECIES_PROFILES } from '../nature/TreeSpecies'
import { SeededPRNG } from '../utils/SeededPRNG'

/**
 * MapLayout (Nguồn dữ liệu chân lý duy nhất cho Bản đồ Thế giới):
 * Single Source of Truth for all landmarks, exclusion zones, spawn points, colliders, and tree placements.
 */

export type FootprintShape =
  | { type: 'box'; width: number; depth: number }
  | { type: 'circle'; radius: number }

export interface LandmarkDefinition {
  id: string
  name: string
  category: 'building' | 'water' | 'prop' | 'tree' | 'path' | 'gate'
  center: { x: number; y: number; z: number }
  footprint: FootprintShape
  elevation: number
  rotationY: number
  clearance: number
  isWalkable: boolean
  isExclusion: boolean
  // Optional extra geometry details
  size?: { width: number; height: number; depth: number }
  radius?: number
  doorCenter?: { x: number; y: number; z: number }
}

export interface SpawnPoint {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  yaw: number
}

export interface LayoutValidationReport {
  valid: boolean
  errors: string[]
  warnings: string[]
  landmarkCount: number
  treeCount: number
  spawnPointCount: number
}

export class MapLayout {
  // Current Playable bounds
  public static readonly CURRENT_BOUNDS = {
    minX: -44,
    maxX: 44,
    minZ: -44,
    maxZ: 44
  }

  // Expanded Bounds (Phase 6 target: 400x400m world, playable radius ~85m)
  public static readonly EXPANDED_BOUNDS = {
    minX: -85,
    maxX: 85,
    minZ: -85,
    maxZ: 75
  }

  // Safe Walkable Bounds (Mở rộng toàn bộ thung lũng & đồi thiền tới sát chân núi r = 120m)
  public static readonly WALKABLE_BOUNDARY = {
    maxRadius: 115.0, // Chân núi tại r = 120m, cho phép đi lại tự do khắp thung lũng ngoại vi
    respawnThresholdY: -3.0,
    safeSpawn: { x: 0, y: 0.08, z: 14.0 }
  }

  /**
   * BẢNG LANDMARKS CHÍNH (Single Source of Truth)
   * Tuyệt đối không hard-code tọa độ ở các module khác!
   */
  public static readonly LANDMARKS: Record<string, LandmarkDefinition> = {
    // 1. CỔNG TAM QUAN (Mặt Nam bản đồ)
    TAM_QUAN_GATE: {
      id: 'tam_quan',
      name: 'Cổng Tam Quan',
      category: 'gate',
      center: { x: 0, y: 0, z: 24.5 },
      footprint: { type: 'box', width: 14.0, depth: 3.5 },
      elevation: 0.0,
      rotationY: 0,
      clearance: 1.5,
      isWalkable: true,
      isExclusion: true,
      size: { width: 14.0, height: 8.5, depth: 3.5 }
    },

    // 2. ĐẠI HÙNG BẢO ĐIỆN (Chánh Điện 40x30m, Thềm tam cấp 46x36m)
    SANCTUARY_HALL: {
      id: 'sanctuary_hall',
      name: 'Đại Hùng Bảo Điện',
      category: 'building',
      center: { x: 0, y: 0, z: -14.5 },
      footprint: { type: 'box', width: 46.0, depth: 36.0 }, // Bao trọn thềm x in [-23, 23], z in [-32.5, 3.5]
      elevation: 1.35,
      rotationY: 0,
      clearance: 2.0,
      isWalkable: true,
      isExclusion: true,
      size: { width: 40.0, height: 15.5, depth: 30.0 },
      doorCenter: { x: 0, y: 1.35, z: 0.5 }
    },

    // 3. KIM THÂN ĐỨC PHẬT BỔN SƯ (Trong lòng Chánh Điện)
    BUDDHA_STATUE: {
      id: 'buddha_statue',
      name: 'Kim Thân Đức Phật Bổn Sư',
      category: 'prop',
      center: { x: 0, y: 1.35, z: -23.5 },
      footprint: { type: 'box', width: 4.5, depth: 4.0 },
      elevation: 1.35,
      rotationY: 0,
      clearance: 1.0,
      isWalkable: false,
      isExclusion: true,
      size: { width: 3.5, height: 5.5, depth: 3.5 }
    },

    // 4. HỒ SEN BÁT NHÃ (Phía Tây Nam sân chùa, cách thềm Chánh Điện 3.5m)
    LOTUS_POND: {
      id: 'lotus_pond',
      name: 'Hồ Sen Bát Nhã',
      category: 'water',
      center: { x: -17.5, y: 0, z: 13.5 },
      footprint: { type: 'circle', radius: 6.5 },
      radius: 6.5,
      elevation: 0.0,
      rotationY: 0,
      clearance: 1.5,
      isWalkable: true,
      isExclusion: true
    },

    // 5. ĐẠI HỒNG CHUNG CỔ CÁC (Lầu Chuông phía Đông Nam sân chùa, cách thềm Chánh Điện 6.4m)
    BELL_TOWER: {
      id: 'bell_tower',
      name: 'Đại Hồng Chung Cổ Các',
      category: 'building',
      center: { x: 17.5, y: 0, z: 13.5 },
      footprint: { type: 'box', width: 7.2, depth: 7.2 },
      radius: 4.2,
      elevation: 0.70,
      rotationY: 0,
      clearance: 1.5,
      isWalkable: true,
      isExclusion: true,
      size: { width: 7.2, height: 8.8, depth: 7.2 }
    },

    // 6. CÂY BỒ ĐỀ CỔ THỤ (Phía Tây sân ngự đạo)
    BODHI_TREE: {
      id: 'bodhi_tree',
      name: 'Cây Bồ Đề Cổ Thụ',
      category: 'tree',
      center: { x: -9.0, y: 0, z: 7.5 },
      footprint: { type: 'circle', radius: 2.2 },
      radius: 2.2,
      elevation: 0.0,
      rotationY: 0.45,
      clearance: 0.8,
      isWalkable: false,
      isExclusion: true
    },

    // 7. CÂY ĐA CỔ THỤ (Phía Đông sân ngự đạo đối xứng)
    BANYAN_TREE: {
      id: 'banyan_tree',
      name: 'Cây Đa Cổ Thụ',
      category: 'tree',
      center: { x: 9.0, y: 0, z: 7.5 },
      footprint: { type: 'circle', radius: 2.2 },
      radius: 2.2,
      elevation: 0.0,
      rotationY: 1.82,
      clearance: 0.8,
      isWalkable: false,
      isExclusion: true
    },

    // 8. ĐẠI LƯ HƯƠNG SÂN CHÙA (Phương án A: cách chân bậc thang Chánh Điện 3.3m về phía Nam)
    INCENSE_BURNER: {
      id: 'incense_burner',
      name: 'Đại Lư Hương Sân Chánh Điện',
      category: 'prop',
      center: { x: 0, y: 0.08, z: 10.0 },
      footprint: { type: 'circle', radius: 1.3 },
      radius: 1.3,
      elevation: 0.08,
      rotationY: 0,
      clearance: 0.8,
      isWalkable: false,
      isExclusion: true
    },

    // 9. HÒM CÔNG ĐỨC (Đứng bên phải ngự đạo cạnh lư hương)
    MERIT_BOX: {
      id: 'merit_box',
      name: 'Hòm Công Đức',
      category: 'prop',
      center: { x: 4.0, y: 0.08, z: 10.0 },
      footprint: { type: 'box', width: 1.5, depth: 1.1 },
      elevation: 0.08,
      rotationY: 0,
      clearance: 0.8,
      isWalkable: false,
      isExclusion: true,
      size: { width: 1.5, height: 1.2, depth: 1.1 }
    },

    // 10. BÀN XIN XĂM & PHÁP BẢO (Đứng bên trái ngự đạo cạnh lư hương)
    FORTUNE_TABLE: {
      id: 'fortune_table',
      name: 'Bàn Xin Xăm & Pháp Bảo',
      category: 'prop',
      center: { x: -4.0, y: 0.08, z: 10.0 },
      footprint: { type: 'box', width: 1.6, depth: 1.1 },
      elevation: 0.08,
      rotationY: 0,
      clearance: 0.8,
      isWalkable: false,
      isExclusion: true,
      size: { width: 1.6, height: 1.15, depth: 1.1 }
    }
  }

  // 8 ĐÈN ĐÁ TŌRŌ DỌC NGỰ ĐẠO (Được bố trí song song 2 bên trục ngự đạo x = ±3.8)
  public static readonly LANTERN_COORDINATES: Array<[number, number]> = [
    [-3.8, 4.5],  [3.8, 4.5],   // Cặp 1: Chân bậc thang Chánh Điện
    [-3.8, 9.5],  [3.8, 9.5],   // Cặp 2: Sân lư hương đại đỉnh
    [-3.8, 15.0], [3.8, 15.0],  // Cặp 3: Giữa sân chùa (ngang hồ sen & lầu chuông)
    [-3.8, 20.5], [3.8, 20.5]   // Cặp 4: Trước Cổng Tam Quan
  ]

  // Bậc thang Chánh Điện mặt Nam (Tam cấp chuẩn hóa <= 0.18m mỗi bậc)
  public static readonly SANCTUARY_STAIRS = {
    stepsCount: 8,
    totalHeight: 1.35,
    stepRiser: 1.35 / 8, // ~0.16875m <= 0.18m
    totalDepth: 3.2,
    stepTread: 3.2 / 8,  // 0.40m >= 0.30m
    width: 14.0,
    startZ: 3.5,
    endZ: 6.7
  }

  // Bậc thang Lầu Chuông mặt Tây
  public static readonly BELL_TOWER_STAIRS = {
    stepsCount: 4,
    totalHeight: 0.70,
    stepRiser: 0.70 / 4, // 0.175m <= 0.18m
    totalDepth: 1.4,
    stepTread: 0.35,     // 0.35m >= 0.30m
    width: 2.4,
    centerX: 14.1,       // 17.5 - 3.4
    centerZ: 13.5
  }

  // Cầu đá vòm Hồ Sen
  public static readonly LOTUS_BRIDGE = {
    length: 13.0,
    width: 3.2,
    archMaxHeight: 1.15,
    segments: 10,
    maxSegmentStep: 0.15 // Độ lệch cao độ tối đa giữa 2 phân đoạn <= 0.15m
  }

  // Distributed Spawn Points (Được định vị ở các vùng an toàn)
  public static readonly SPAWN_POINTS: SpawnPoint[] = [
    { id: 'courtyard_mid', name: 'Sân Chùa Trung Tâm', position: { x: 0, y: 0.08, z: 14.0 }, yaw: Math.PI },
    { id: 'sanctuary_steps', name: 'Trước Sân Bát Nhang', position: { x: 0, y: 0.08, z: 7.5 }, yaw: Math.PI },
    { id: 'gate_center', name: 'Trước Tam Quan', position: { x: 0, y: 0, z: 28.5 }, yaw: Math.PI },
    { id: 'gate_left', name: 'Tam Quan Tả', position: { x: -4.5, y: 0, z: 27.5 }, yaw: Math.PI },
    { id: 'gate_right', name: 'Tam Quan Hữu', position: { x: 4.5, y: 0, z: 27.5 }, yaw: Math.PI },
    { id: 'bodhi_path', name: 'Đường Bồ Đề', position: { x: -6.5, y: 0.08, z: 11.5 }, yaw: Math.PI * 0.9 },
    { id: 'pond_promenade', name: 'Bến Hồ Sen', position: { x: -10.0, y: 0.08, z: 13.5 }, yaw: Math.PI * 0.5 },
    { id: 'bell_terrace', name: 'Sân Lầu Chuông', position: { x: 10.0, y: 0.08, z: 13.5 }, yaw: -Math.PI * 0.5 },
    { id: 'sanctuary_interior', name: 'Lòng Chánh Điện', position: { x: 0, y: 1.35, z: -12.0 }, yaw: Math.PI }
  ]

  /**
   * Danh sách Cây Cối Toàn Cảnh (Single Source of Truth cho TreeSystem & Colliders)
   * Đã thanh lọc 100% cây mọc trong lòng Chánh Điện, thềm Chánh Điện và vách Cổng Tam Quan!
   */
  public static getTreeSpawns(): TreeSpawnData[] {
    const list: TreeSpawnData[] = [
      // 1. Cây Bồ Đề Bát Nhã Chủ Đề (Vị trí chính xác -9.0, 0, 7.5)
      { id: 'tree_bodhi_main', species: 'bodhi', x: -9.0, z: 7.5, scale: 1.15, rotY: 0.45, seed: 1001 },

      // 2. Cây Đa Cổ Thụ (Phía Đông đối xứng sân chùa: 9.0, 0, 7.5)
      { id: 'tree_banyan_east', species: 'banyan', x: 9.0, z: 7.5, scale: 1.10, rotY: 1.82, seed: 1002 },

      // 3. Thông Cổ Tự Ngoại Vi & Hậu Viện (Đặt an toàn ngoài thềm Chánh Điện z < -35 và hai bên đồi x > 25, x < -25)
      { id: 'tree_pine_bell_1', species: 'pine', x: 26.0, z: 13.5, scale: 1.05, rotY: 0.2, seed: 1003 },
      { id: 'tree_pine_bell_2', species: 'pine', x: 27.5, z: 3.5, scale: 0.95, rotY: 1.1, seed: 1004 },
      { id: 'tree_pine_back_1', species: 'pine', x: -18.0, z: -36.0, scale: 1.10, rotY: 2.3, seed: 1005 },
      { id: 'tree_pine_back_2', species: 'pine', x: 18.0, z: -36.0, scale: 1.05, rotY: 0.8, seed: 1006 },
      { id: 'tree_pine_back_3', species: 'pine', x: 0.0, z: -37.5, scale: 1.15, rotY: 1.4, seed: 1007 },
      { id: 'tree_pine_corner_1', species: 'pine', x: -28.0, z: 24.0, scale: 1.0, rotY: 1.5, seed: 1008 },
      { id: 'tree_pine_corner_2', species: 'pine', x: 28.0, z: 24.0, scale: 1.0, rotY: 2.1, seed: 1009 },

      // 4. Phong Đỏ / Anh Đào (Bốn góc hoa viên ngoại vi)
      { id: 'tree_sakura_sw', species: 'cherry_maple', x: -26.0, z: 2.0, scale: 0.95, rotY: 1.2, seed: 1010 },
      { id: 'tree_sakura_nw', species: 'cherry_maple', x: -26.5, z: -14.0, scale: 1.05, rotY: 0.5, seed: 1011 },
      { id: 'tree_sakura_se', species: 'cherry_maple', x: 26.0, z: 2.0, scale: 0.95, rotY: 2.1, seed: 1012 },
      { id: 'tree_sakura_ne', species: 'cherry_maple', x: 26.5, z: -14.0, scale: 1.05, rotY: 1.7, seed: 1013 },

      // 5. Cau Cảnh / Cọ Nam Á (Lối đi ven hoa viên Tây và Đông)
      { id: 'tree_palm_pond_1', species: 'palm', x: -26.0, z: 12.0, scale: 1.0, rotY: 0.3, seed: 1014 },
      { id: 'tree_palm_pond_2', species: 'palm', x: -26.0, z: 16.0, scale: 0.95, rotY: 1.4, seed: 1015 },
      { id: 'tree_palm_bell_1', species: 'palm', x: 26.0, z: 12.0, scale: 1.0, rotY: 2.2, seed: 1016 },
      { id: 'tree_palm_bell_2', species: 'palm', x: 26.0, z: 16.0, scale: 0.95, rotY: 0.9, seed: 1017 },

      // 6. Rặng Trúc Thiền Tông (Dọc vách hoa viên Tây và Đông)
      { id: 'tree_bamboo_w1', species: 'bamboo', x: -28.0, z: 6.0, scale: 1.05, rotY: 0.0, seed: 1018 },
      { id: 'tree_bamboo_w2', species: 'bamboo', x: -28.5, z: 8.5, scale: 0.95, rotY: 0.8, seed: 1019 },
      { id: 'tree_bamboo_e1', species: 'bamboo', x: 28.0, z: 6.0, scale: 1.05, rotY: 0.4, seed: 1020 },
      { id: 'tree_bamboo_e2', species: 'bamboo', x: 28.5, z: 8.5, scale: 0.95, rotY: 1.2, seed: 1021 }
    ]

    // Sinh thêm rặng cây rừng bao quanh ngoại vi thung lũng (R = 32m tới 108m) bằng Poisson-disk
    const prng = new SeededPRNG(456789)
    const speciesCycle: TreeSpeciesType[] = ['pine', 'bamboo', 'banyan', 'cherry_maple', 'palm']
    let count = 0

    for (let i = 0; i < 280; i++) {
      const angle = prng.range(0, Math.PI * 2)
      const dist = prng.range(32, 108)
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist

      // Không đặt cây trên trục ngự đạo Nam đi ra thế giới (x in [-6.5, 6.5], z in [22, 115])
      if (Math.abs(x) < 6.5 && z >= 22.0) continue

      if (!this.isInExclusionZone(x, z, 3.0)) {
        // Kiểm tra khoảng cách với cây đã sinh (Poisson spacing >= 4.0m)
        let tooClose = false
        for (const existing of list) {
          if (Math.hypot(x - existing.x, z - existing.z) < 4.0) {
            tooClose = true
            break
          }
        }

        if (!tooClose) {
          const sp = speciesCycle[count % speciesCycle.length]
          list.push({
            id: `tree_perimeter_${count}`,
            species: sp,
            x: Number(x.toFixed(2)),
            z: Number(z.toFixed(2)),
            scale: Number(prng.range(0.85, 1.25).toFixed(2)),
            rotY: Number(prng.range(0, Math.PI * 2).toFixed(2)),
            seed: 2000 + count
          })
          count++
        }
      }
    }

    return list
  }

  /**
   * Kiểm tra tọa độ (x, z) có nằm trong vùng cấm đặt cỏ/cây hay không
   * Đọc trực tiếp từ footprint + clearance của LANDMARKS
   */
  public static isInExclusionZone(x: number, z: number, extraMargin = 0): boolean {
    // 1. Kiểm tra toàn bộ LANDMARKS
    for (const key in this.LANDMARKS) {
      const lm = this.LANDMARKS[key]
      if (!lm.isExclusion) continue

      const clearance = lm.clearance + extraMargin

      if (lm.footprint.type === 'circle') {
        const dist = Math.hypot(x - lm.center.x, z - lm.center.z)
        if (dist <= lm.footprint.radius + clearance) {
          return true
        }
      } else if (lm.footprint.type === 'box') {
        const halfW = lm.footprint.width * 0.5 + clearance
        const halfD = lm.footprint.depth * 0.5 + clearance
        if (
          x >= lm.center.x - halfW &&
          x <= lm.center.x + halfW &&
          z >= lm.center.z - halfD &&
          z <= lm.center.z + halfD
        ) {
          return true
        }
      }
    }

    // 2. Sân gạch trung tâm & ngự đạo chính
    // Ngự đạo chính: x in [-3.5, 3.5], z in [3.5, 27.0]
    if (Math.abs(x) < 3.5 + extraMargin && z >= 3.5 && z <= 27.0) {
      return true
    }

    // Trục đường dẫn Nam ra ngoài: x in [-5.0, 5.0], z in [24.0, 80.0]
    if (Math.abs(x) < 5.0 + extraMargin && z >= 24.0 && z <= 80.0) {
      return true
    }

    // 3. Đèn đá Tōrō
    for (const [lx, lz] of this.LANTERN_COORDINATES) {
      if (Math.hypot(x - lx, z - lz) < 1.0 + extraMargin) {
        return true
      }
    }

    return false
  }

  /**
   * Lấy điểm hồi sinh (spawn point) theo chỉ số index hoặc tuần tự
   */
  public static getSpawnPoint(index = 0): SpawnPoint {
    const list = this.SPAWN_POINTS
    const idx = Math.abs(index) % list.length
    return list[idx]
  }

  /**
   * VALIDATE TOÀN DIỆN MẶT BẰNG THẾ GIỚI
   * Chạy kiểm tra tự động trước khi build cảnh:
   * 1. Không có 2 landmark nào bị chồng footprint (đã cộng clearance).
   * 2. Không có landmark nào vượt ra ngoài EXPANDED_BOUNDS.
   * 3. Không có SpawnPoint nào rơi vào lòng collider hoặc vùng cấm.
   * 4. Không có TreeSpawn nào mọc trong công trình hoặc hồ nước.
   */
  public static validateLayout(): LayoutValidationReport {
    const errors: string[] = []
    const warnings: string[] = []
    const landmarks = Object.values(this.LANDMARKS)

    // 1. Kiểm tra va chạm footprint giữa các cặp Landmarks
    for (let i = 0; i < landmarks.length; i++) {
      for (let j = i + 1; j < landmarks.length; j++) {
        const a = landmarks[i]
        const b = landmarks[j]

        // Kim thân Phật nằm trong Chánh Điện là thiết kế có chủ đích
        if (
          (a.id === 'buddha_statue' && b.id === 'sanctuary_hall') ||
          (b.id === 'buddha_statue' && a.id === 'sanctuary_hall')
        ) {
          continue
        }

        const isOverlap = this.testFootprintOverlap(a, b)
        if (isOverlap) {
          errors.push(
            `[CLASH_FOOTPRINT] Landmark "${a.name}" (${a.id}) xung đột footprint với "${b.name}" (${b.id})!`
          )
        }
      }
    }

    // 2. Kiểm tra biên bản đồ
    const bounds = this.EXPANDED_BOUNDS
    for (const lm of landmarks) {
      let minX = lm.center.x
      let maxX = lm.center.x
      let minZ = lm.center.z
      let maxZ = lm.center.z

      if (lm.footprint.type === 'box') {
        minX -= lm.footprint.width * 0.5
        maxX += lm.footprint.width * 0.5
        minZ -= lm.footprint.depth * 0.5
        maxZ += lm.footprint.depth * 0.5
      } else {
        minX -= lm.footprint.radius
        maxX += lm.footprint.radius
        minZ -= lm.footprint.radius
        maxZ += lm.footprint.radius
      }

      if (minX < bounds.minX || maxX > bounds.maxX || minZ < bounds.minZ || maxZ > bounds.maxZ) {
        errors.push(`[OUT_OF_BOUNDS] Landmark "${lm.name}" nằm ngoài vùng EXPANDED_BOUNDS!`)
      }
    }

    // 3. Kiểm tra Spawn Points
    for (const sp of this.SPAWN_POINTS) {
      // Ngoại trừ điểm spawn bên trong Chánh Điện
      if (sp.id === 'sanctuary_interior') continue

      for (const lm of landmarks) {
        if (!lm.isWalkable) {
          if (this.isPointInsideLandmark(sp.position.x, sp.position.z, lm, 0.4)) {
            errors.push(
              `[SPAWN_INSIDE_COLLIDER] Điểm spawn "${sp.name}" (${sp.id}) rơi vào lòng vật cản "${lm.name}"!`
            )
          }
        }
      }
    }

    // 4. Kiểm tra Tree Spawns
    const trees = this.getTreeSpawns()
    for (const tree of trees) {
      // Ngoại trừ cây Bồ Đề và Đa là chính các landmark cây
      if (tree.id === 'tree_bodhi_main' || tree.id === 'tree_banyan_east') continue

      for (const lm of landmarks) {
        if (this.isPointInsideLandmark(tree.x, tree.z, lm, 0.2)) {
          errors.push(
            `[TREE_INSIDE_BUILDING] Cây "${tree.id}" (${tree.species}) mọc xuyên vào công trình "${lm.name}" tại (${tree.x}, ${tree.z})!`
          )
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      landmarkCount: landmarks.length,
      treeCount: trees.length,
      spawnPointCount: this.SPAWN_POINTS.length
    }
  }

  private static testFootprintOverlap(a: LandmarkDefinition, b: LandmarkDefinition): boolean {
    const totalClearance = (a.clearance + b.clearance) * 0.5

    // Circle vs Circle
    if (a.footprint.type === 'circle' && b.footprint.type === 'circle') {
      const dist = Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z)
      return dist < a.footprint.radius + b.footprint.radius + totalClearance
    }

    // Box vs Box
    if (a.footprint.type === 'box' && b.footprint.type === 'box') {
      const aMinX = a.center.x - a.footprint.width * 0.5 - totalClearance
      const aMaxX = a.center.x + a.footprint.width * 0.5 + totalClearance
      const aMinZ = a.center.z - a.footprint.depth * 0.5 - totalClearance
      const aMaxZ = a.center.z + a.footprint.depth * 0.5 + totalClearance

      const bMinX = b.center.x - b.footprint.width * 0.5
      const bMaxX = b.center.x + b.footprint.width * 0.5
      const bMinZ = b.center.z - b.footprint.depth * 0.5
      const bMaxZ = b.center.z + b.footprint.depth * 0.5

      return aMinX <= bMaxX && aMaxX >= bMinX && aMinZ <= bMaxZ && aMaxZ >= bMinZ
    }

    // Box vs Circle (Hoặc Circle vs Box)
    const box = a.footprint.type === 'box' ? a : b
    const circle = a.footprint.type === 'circle' ? a : b
    const boxFp = box.footprint as { type: 'box'; width: number; depth: number }
    const circleFp = circle.footprint as { type: 'circle'; radius: number }

    const closestX = Math.max(
      box.center.x - boxFp.width * 0.5,
      Math.min(circle.center.x, box.center.x + boxFp.width * 0.5)
    )
    const closestZ = Math.max(
      box.center.z - boxFp.depth * 0.5,
      Math.min(circle.center.z, box.center.z + boxFp.depth * 0.5)
    )

    const distSq = (circle.center.x - closestX) ** 2 + (circle.center.z - closestZ) ** 2
    const minSafeDist = circleFp.radius + totalClearance
    return distSq < minSafeDist * minSafeDist
  }

  private static isPointInsideLandmark(
    x: number,
    z: number,
    lm: LandmarkDefinition,
    margin = 0
  ): boolean {
    if (lm.footprint.type === 'circle') {
      const dist = Math.hypot(x - lm.center.x, z - lm.center.z)
      return dist <= lm.footprint.radius + margin
    } else {
      const halfW = lm.footprint.width * 0.5 + margin
      const halfD = lm.footprint.depth * 0.5 + margin
      return (
        x >= lm.center.x - halfW &&
        x <= lm.center.x + halfW &&
        z >= lm.center.z - halfD &&
        z <= lm.center.z + halfD
      )
    }
  }
}
