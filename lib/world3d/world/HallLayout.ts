/**
 * HallLayout (Nguồn dữ liệu chân lý duy nhất cho Chánh Điện & 500 Chỗ Thiền):
 * Single Source of Truth for Sanctuary Hall 40x30m (1.200 m²), doors, and 500 meditation spots.
 */

export interface MeditationSlot {
  id: number
  x: number
  z: number
  yaw: number // Hướng quay mặt về bàn thờ Phật
  quadrant: number // 0: Tiền Tả, 1: Tiền Hữu, 2: Hậu Tả, 3: Hậu Hữu
  isOccupied: boolean
  occupiedBy?: string
}

export interface SanctuaryDoor {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  width: number
  height: number
  isMain: boolean
}

export class HallLayout {
  // Kích thước Đại Hùng Bảo Điện chuẩn kiến trúc cổ truyền Việt Nam
  public static readonly DIMENSIONS = {
    width: 40.0,  // Chiều ngang 40m
    depth: 30.0,  // Chiều sâu 30m
    area: 1200.0, // Diện tích sàn 1.200 m²
    height: 15.5, // Chiều cao nóc điện
    wallThickness: 0.6,
    floorY: 1.35  // Cao độ nền điện (bậc tam cấp tôn cao)
  }

  // Tọa độ bounding box trong không gian thế giới
  public static readonly BOUNDS = {
    center: { x: 0, y: 1.35, z: -14.5 },
    minX: -20.0,
    maxX: 20.0,
    minZ: -29.5,
    maxZ: 0.5,
    // Lòng Chánh điện thực tế bên trong tường
    interior: {
      minX: -19.4,
      maxX: 19.4,
      minZ: -28.9,
      maxZ: -0.1
    }
  }

  // Hệ thống 3 Cửa Chính mặt trước và 2 Cửa Phụ bên hông
  public static readonly DOORS: SanctuaryDoor[] = [
    // 3 Cửa chính mặt tiền (hướng Nam)
    { id: 'door_main_center', name: 'Chính Môn (Cửa Giữa)', position: { x: 0, y: 1.35, z: 0.5 }, width: 3.8, height: 4.4, isMain: true },
    { id: 'door_main_left', name: 'Tả Môn (Cửa Trái)', position: { x: -6.5, y: 1.35, z: 0.5 }, width: 3.2, height: 4.0, isMain: true },
    { id: 'door_main_right', name: 'Hữu Môn (Cửa Phải)', position: { x: 6.5, y: 1.35, z: 0.5 }, width: 3.2, height: 4.0, isMain: true },
    // 2 Cửa phụ bên hông nối lối đi ngang
    { id: 'door_side_west', name: 'Tây Dịch Môn (Hông Trái)', position: { x: -20.0, y: 1.35, z: -14.5 }, width: 2.4, height: 3.2, isMain: false },
    { id: 'door_side_east', name: 'Đông Dịch Môn (Hông Phải)', position: { x: 20.0, y: 1.35, z: -14.5 }, width: 2.4, height: 3.2, isMain: false }
  ]

  // Lối đi thông thủy trong điện
  public static readonly AISLES = {
    centralWidth: 3.2,   // Ngự đạo chính giữa (từ cửa chính vào ban Phật)
    crossWidth: 2.0,     // Lối đi ngang cắt giữa điện (nối 2 cửa phụ)
    perimeterWidth: 1.5  // Lối đi sát vách và cột
  }

  // Bàn thờ Tam Bảo & Tôn tượng Phật Thích Ca Mâu Ni
  public static readonly ALTAR_BOUNDS = {
    // Kích thước bệ bàng thờ tầng 1: rộng 12m (X: -6.0 -> 6.0), sâu 4.2m (Z: -27.1 -> -22.9)
    minX: -6.0,
    maxX: 6.0,
    minZ: -27.1,
    maxZ: -22.9,
    // Vùng an toàn cấm đặt đệm (bao gồm clearance >= 0.6m để đi lại quanh bệ)
    clearanceMinX: -6.95,
    clearanceMaxX: 6.95,
    clearanceMinZ: -28.0,
    clearanceMaxZ: -21.9
  }

  // Hệ cột lim chính trong Chánh Điện
  public static readonly COLUMNS = [
    { x: -11.5, z: -20.5, r: 0.42 },
    { x: -11.5, z: -12.5, r: 0.42 },
    { x: -11.5, z: -4.5,  r: 0.42 },
    { x: 11.5,  z: -20.5, r: 0.42 },
    { x: 11.5,  z: -12.5, r: 0.42 },
    { x: 11.5,  z: -4.5,  r: 0.42 }
  ]

  // Bán kính đệm thiền bồ đoàn chuẩn
  public static readonly MAT_RADIUS = 0.44

  // Bộ nhớ cache 500 chỗ thiền
  private static cachedSlots: MeditationSlot[] | null = null

  /**
   * Sinh ma trận chính xác 500 chỗ thiền đối xứng hoàn hảo, thông thoáng mọi lối đi và không đè bàn thờ/cột
   */
  public static getMeditationSlots(): MeditationSlot[] {
    if (this.cachedSlots) return this.cachedSlots

    const slots: MeditationSlot[] = []
    let id = 0

    // Cấu hình lưới 4 phân khu:
    // Tiền Tả (Q0) & Tiền Hữu (Q1): 13 cột x 10 hàng -> 122 chỗ mỗi bên (tổng 244)
    // Hậu Tả (Q2) & Hậu Hữu (Q3): 13 cột x 12 hàng -> 128 chỗ mỗi bên (tổng 256)
    // Tổng cộng: 244 + 256 = 500 chỗ, các cột đệm thẳng hàng từ trước ra sau (cols = 13)
    const QUADRANTS = [
      { q: 0, name: 'Tiền Tả (Front-Left)',  minX: -17.2, maxX: -2.0, cols: 13, minZ: -13.2, maxZ: -2.8,  rows: 10 },
      { q: 1, name: 'Tiền Hữu (Front-Right)', minX: 2.0,   maxX: 17.2, cols: 13, minZ: -13.2, maxZ: -2.8,  rows: 10 },
      { q: 2, name: 'Hậu Tả (Back-Left)',    minX: -17.2, maxX: -2.0, cols: 13, minZ: -27.2, maxZ: -15.8, rows: 12 },
      { q: 3, name: 'Hậu Hữu (Back-Right)',  minX: 2.0,   maxX: 17.2, cols: 13, minZ: -27.2, maxZ: -15.8, rows: 12 }
    ]

    const isSlotClear = (x: number, z: number): boolean => {
      // 1. Không đè lên vùng bệ bàn thờ Phật (clearance >= 0.6m)
      if (
        x >= this.ALTAR_BOUNDS.clearanceMinX &&
        x <= this.ALTAR_BOUNDS.clearanceMaxX &&
        z >= this.ALTAR_BOUNDS.clearanceMinZ &&
        z <= this.ALTAR_BOUNDS.clearanceMaxZ
      ) {
        return false
      }

      // 2. Không đè lên cột lim
      for (const c of this.COLUMNS) {
        if (Math.hypot(x - c.x, z - c.z) < c.r + this.MAT_RADIUS + 0.15) {
          return false
        }
      }

      return true
    }

    for (const quad of QUADRANTS) {
      const dx = (quad.maxX - quad.minX) / (quad.cols - 1)
      const dz = (quad.maxZ - quad.minZ) / (quad.rows - 1)

      for (let r = 0; r < quad.rows; r++) {
        const z = Number((quad.minZ + r * dz).toFixed(2))
        for (let c = 0; c < quad.cols; c++) {
          const x = Number((quad.minX + c * dx).toFixed(2))
          if (isSlotClear(x, z)) {
            slots.push({
              id: id++,
              x,
              z,
              yaw: Math.PI, // Hướng nhìn trang nghiêm về tôn tượng Phật
              quadrant: quad.q,
              isOccupied: false
            })
          }
        }
      }
    }

    // Tự động kiểm tra assertions nghiêm ngặt trước khi trả về
    this.assertHallLayout(slots)
    this.cachedSlots = slots
    return slots
  }

  /**
   * Hàm kiểm định bắt buộc (Assert Test): đảm bảo đúng 500 chỗ, không vi phạm lối đi, không đè bàn thờ hay cột
   */
  public static assertHallLayout(slots: MeditationSlot[]): boolean {
    if (slots.length !== 500) {
      throw new Error(`[HallLayout Assert Error] Chỗ thiền không đúng 500: hiện có ${slots.length}`)
    }

    const bounds = this.BOUNDS.interior
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      // 1. Kiểm tra nằm trong lòng Chánh điện
      if (s.x < bounds.minX || s.x > bounds.maxX || s.z < bounds.minZ || s.z > bounds.maxZ) {
        throw new Error(`[HallLayout Assert Error] Chỗ ${s.id} nằm ngoài tường: (${s.x}, ${s.z})`)
      }

      // 2. Không nằm trong Ngự đạo chính giữa (|x| < 1.6m)
      if (Math.abs(s.x) < 1.6) {
        throw new Error(`[HallLayout Assert Error] Chỗ ${s.id} đè lên Ngự đạo trung tâm: X=${s.x}`)
      }

      // 3. Không nằm trong Lối đi ngang cắt giữa điện
      if (s.z > -15.2 && s.z < -13.8) {
        throw new Error(`[HallLayout Assert Error] Chỗ ${s.id} đè lên Lối đi ngang: Z=${s.z}`)
      }

      // 4. Khoảng cách an toàn giữa các chỗ thiền >= 0.85m
      for (let j = i + 1; j < slots.length; j++) {
        const s2 = slots[j]
        const dist = Math.hypot(s.x - s2.x, s.z - s2.z)
        if (dist < 0.85) {
          throw new Error(`[HallLayout Assert Error] Hai chỗ thiền quá gần nhau: #${s.id} & #${s2.id} (dist=${dist.toFixed(2)}m)`)
        }
      }

      // 5. Tuyệt đối không đè lên Bàn thờ Phật (khoảng cách mép đệm đến mép bệ >= 0.5m)
      const altarCx = Math.max(this.ALTAR_BOUNDS.minX, Math.min(s.x, this.ALTAR_BOUNDS.maxX))
      const altarCz = Math.max(this.ALTAR_BOUNDS.minZ, Math.min(s.z, this.ALTAR_BOUNDS.maxZ))
      const distToAltar = Math.hypot(s.x - altarCx, s.z - altarCz)
      if (distToAltar < this.MAT_RADIUS + 0.5) {
        throw new Error(`[HallLayout Assert Error] Chỗ #${s.id} đè lên hoặc quá gần Bàn thờ Phật: (${s.x}, ${s.z}), dist=${distToAltar.toFixed(3)}m`)
      }

      // 6. Tuyệt đối không đè lên cột lim (khoảng cách mép đệm đến mép cột >= 0.1m)
      for (const col of this.COLUMNS) {
        const distToCol = Math.hypot(s.x - col.x, s.z - col.z)
        if (distToCol < this.MAT_RADIUS + col.r + 0.1) {
          throw new Error(`[HallLayout Assert Error] Chỗ #${s.id} đè lên Cột lim: (${s.x}, ${s.z}) vs Cột (${col.x}, ${col.z}), dist=${distToCol.toFixed(3)}m`)
        }
      }
    }

    return true
  }

  /**
   * Tìm chỗ thiền trống gần nhất cho người hành hương
   */
  public static findNearestAvailableSlot(targetX: number, targetZ: number): MeditationSlot | null {
    const slots = this.getMeditationSlots()
    let nearest: MeditationSlot | null = null
    let minDist = Infinity

    for (const slot of slots) {
      if (!slot.isOccupied) {
        const d = Math.hypot(slot.x - targetX, slot.z - targetZ)
        if (d < minDist) {
          minDist = d
          nearest = slot
        }
      }
    }

    return nearest
  }
}

