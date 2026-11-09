/**
 * HallLayout (Nguồn dữ liệu chân lý duy nhất cho Chánh Điện & chỗ thiền):
 * Single Source of Truth cho Chánh Điện low-poly 28x22m (616 m²), cửa, bàn thờ và ~256 chỗ thiền.
 *
 * Quy ước: mặt tiền (cửa chính) nằm ở z = +0.5 (hướng Nam, về phía Tam Quan), bàn thờ Phật ở phía Bắc (z âm).
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
  // Kích thước Chánh Điện low-poly (thu nhỏ từ 40x30 để chi tiết hơn, gần gũi hơn)
  public static readonly DIMENSIONS = {
    width: 28.0, // Chiều ngang 28m
    depth: 22.0, // Chiều sâu 22m
    area: 616.0, // Diện tích sàn 616 m²
    height: 11.5, // Chiều cao nóc điện
    wallThickness: 0.6,
    floorY: 1.35 // Cao độ nền điện (thềm tôn cao)
  }

  // Tọa độ bounding box trong không gian thế giới
  public static readonly BOUNDS = {
    center: { x: 0, y: 1.35, z: -10.5 },
    minX: -14.0,
    maxX: 14.0,
    minZ: -21.5,
    maxZ: 0.5,
    // Lòng điện thông thủy (trừ độ dày tường 0.6)
    interior: {
      minX: -13.4,
      maxX: 13.4,
      minZ: -20.9,
      maxZ: -0.1
    }
  }

  // Thềm nền (terrace) bao quanh điện: lộ thiên 3m phía trước, 1m ba phía còn lại
  public static readonly TERRACE = {
    width: 32.0,
    depth: 26.0,
    centerZ: -9.5, // Phủ z từ -22.5 đến +3.5 (đúng với đỉnh cầu thang MapLayout.SANCTUARY_STAIRS.startZ)
    height: 1.35
  }

  public static readonly DOORS: SanctuaryDoor[] = [
    // 3 Cửa chính mặt tiền (hướng Nam)
    { id: 'door_main_center', name: 'Chính Môn (Cửa Giữa)', position: { x: 0, y: 1.35, z: 0.5 }, width: 3.6, height: 4.2, isMain: true },
    { id: 'door_main_left', name: 'Tả Môn (Cửa Trái)', position: { x: -5.5, y: 1.35, z: 0.5 }, width: 3.0, height: 3.8, isMain: true },
    { id: 'door_main_right', name: 'Hữu Môn (Cửa Phải)', position: { x: 5.5, y: 1.35, z: 0.5 }, width: 3.0, height: 3.8, isMain: true },
    // 2 Cửa phụ bên hông nối lối đi ngang
    { id: 'door_side_west', name: 'Tây Dịch Môn (Hông Trái)', position: { x: -14.0, y: 1.35, z: -10.5 }, width: 2.4, height: 3.2, isMain: false },
    { id: 'door_side_east', name: 'Đông Dịch Môn (Hông Phải)', position: { x: 14.0, y: 1.35, z: -10.5 }, width: 2.4, height: 3.2, isMain: false }
  ]

  // Lối đi thông thủy trong điện
  public static readonly AISLES = {
    centralWidth: 3.2, // Ngự đạo chính giữa (từ cửa chính vào ban Phật)
    crossWidth: 1.4, // Lối đi ngang cắt giữa điện (nối 2 cửa phụ)
    crossZ: -10.5, // Trục z của lối đi ngang
    perimeterWidth: 1.5 // Lối đi sát vách
  }

  // Bệ bàn thờ Phật (sát vách phía Bắc)
  public static readonly ALTAR_BOUNDS = {
    minX: -5.0,
    maxX: 5.0,
    minZ: -20.7,
    maxZ: -17.1,
    // Vùng đệm cấm đặt chỗ thiền quanh bệ
    clearanceMinX: -5.95,
    clearanceMaxX: 5.95,
    clearanceMinZ: -20.9,
    clearanceMaxZ: -16.1
  }

  // Cột chính trong lòng điện (4 cột lim)
  public static readonly COLUMNS = [
    { x: -8.0, z: -16.5, r: 0.42 },
    { x: -8.0, z: -4.5, r: 0.42 },
    { x: 8.0, z: -16.5, r: 0.42 },
    { x: 8.0, z: -4.5, r: 0.42 }
  ]

  // Tâm tôn tượng Phật Bổn Sư (khớp MapLayout.LANDMARKS.BUDDHA_STATUE.center): mọi chỗ thiền quay mặt về điểm này
  public static readonly ALTAR_FOCUS = { x: 0, z: -19.0 }

  // Bán kính đệm thiền bồ đoàn chuẩn
  public static readonly MAT_RADIUS = 0.44

  // Số chỗ thiền chấp nhận (thiết kế ~256, đủ cột và lối đi)
  public static readonly MIN_SLOTS = 230
  public static readonly MAX_SLOTS = 270

  // Bộ nhớ cache chỗ thiền
  private static cachedSlots: MeditationSlot[] | null = null

  /**
   * Sinh ma trận ~256 chỗ thiền đối xứng, thông thoáng mọi lối đi và không đè bàn thờ/cột.
   */
  public static getMeditationSlots(): MeditationSlot[] {
    if (this.cachedSlots) return this.cachedSlots

    const slots: MeditationSlot[] = []
    let id = 0

    // Lưới 4 phân khu (11 cột mỗi bên ngự đạo):
    // Tiền Tả (Q0) & Tiền Hữu (Q1): 11 cột x 8 hàng (z từ -9.0 đến -1.6)
    // Hậu Tả (Q2) & Hậu Hữu (Q3): 11 cột x 4 hàng (z từ -15.0 đến -12.0)
    const QUADRANTS = [
      { q: 0, minX: -12.6, maxX: -2.2, cols: 11, minZ: -9.0, maxZ: -1.6, rows: 8 },
      { q: 1, minX: 2.2, maxX: 12.6, cols: 11, minZ: -9.0, maxZ: -1.6, rows: 8 },
      { q: 2, minX: -12.6, maxX: -2.2, cols: 11, minZ: -15.0, maxZ: -12.0, rows: 4 },
      { q: 3, minX: 2.2, maxX: 12.6, cols: 11, minZ: -15.0, maxZ: -12.0, rows: 4 }
    ]

    const isSlotClear = (x: number, z: number): boolean => {
      // 1. Không đè bệ bàn thờ Phật
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
              yaw: this.getYawToAltar(x, z), // Mặt quay thẳng về tôn tượng Phật (đúng tâm tượng, không chỉ hướng z âm)
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
   * Kiểm tra tính hợp lệ của toàn bộ ma trận chỗ thiền.
   */
  public static assertHallLayout(slots: MeditationSlot[]): boolean {
    if (slots.length < this.MIN_SLOTS || slots.length > this.MAX_SLOTS) {
      throw new Error(
        `[HallLayout Assert Error] Số chỗ thiền ngoài khoảng ${this.MIN_SLOTS}-${this.MAX_SLOTS}: hiện có ${slots.length}`
      )
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
      if (Math.abs(s.z - this.AISLES.crossZ) < this.AISLES.crossWidth * 0.5) {
        throw new Error(`[HallLayout Assert Error] Chỗ ${s.id} đè lên Lối đi ngang: Z=${s.z}`)
      }

      // 4. Khoảng cách an toàn giữa các chỗ thiền >= 0.85m
      for (let j = i + 1; j < slots.length; j++) {
        const s2 = slots[j]
        const dist = Math.hypot(s.x - s2.x, s.z - s2.z)
        if (dist < 0.85) {
          throw new Error(
            `[HallLayout Assert Error] Hai chỗ thiền quá gần nhau: #${s.id} & #${s2.id} (dist=${dist.toFixed(2)}m)`
          )
        }
      }

      // 5. Tuyệt đối không đè bệ bàn thờ (cách bệ >= MAT_RADIUS + 0.5)
      const nearestX = Math.max(this.ALTAR_BOUNDS.minX, Math.min(s.x, this.ALTAR_BOUNDS.maxX))
      const nearestZ = Math.max(this.ALTAR_BOUNDS.minZ, Math.min(s.z, this.ALTAR_BOUNDS.maxZ))
      const distToAltar = Math.hypot(s.x - nearestX, s.z - nearestZ)
      if (distToAltar < this.MAT_RADIUS + 0.5) {
        throw new Error(
          `[HallLayout Assert Error] Chỗ #${s.id} (${s.x}, ${s.z}) quá sát bàn thờ, dist=${distToAltar.toFixed(3)}m`
        )
      }

      // 6. Không đè cột lim
      for (const col of this.COLUMNS) {
        const distToCol = Math.hypot(s.x - col.x, s.z - col.z)
        if (distToCol < this.MAT_RADIUS + col.r + 0.1) {
          throw new Error(
            `[HallLayout Assert Error] Chỗ #${s.id} đè lên Cột lim: (${s.x}, ${s.z}) vs Cột (${col.x}, ${col.z}), dist=${distToCol.toFixed(3)}m`
          )
        }
      }
    }

    return true
  }

  /**
   * Góc xoay quanh trục Y của nhân vật để mặt hướng về tôn tượng từ vị trí (x, z).
   * Quy ước giống TempleStage: nhân vật quay mặt về +Z khi rotation.y = 0, nên hướng (dx, dz) ứng với atan2(dx, dz).
   */
  public static getYawToAltar(x: number, z: number): number {
    return Math.atan2(this.ALTAR_FOCUS.x - x, this.ALTAR_FOCUS.z - z)
  }

  /**
   * Tọa độ (x, z) có nằm trong lòng Chánh Điện (thông thủy, trừ độ dày tường) hay không.
   * `margin` > 0 để thu hẹp vùng (ví dụ yêu cầu đứng sâu hơn vào trong, không sát ngưỡng cửa).
   */
  public static isInsideSanctuary(x: number, z: number, margin = 0): boolean {
    const b = this.BOUNDS.interior
    return x >= b.minX + margin && x <= b.maxX - margin && z >= b.minZ + margin && z <= b.maxZ - margin
  }

  /** Tổng số chỗ thiền & số chỗ còn trống (phục vụ thông báo "còn N đệm" / "hết chỗ ngồi"). */
  public static getTotalSlotCount(): number {
    return this.getMeditationSlots().length
  }

  public static getAvailableSlotCount(): number {
    return this.getMeditationSlots().filter(s => !s.isOccupied).length
  }

  /** Đánh dấu một chỗ đã có người ngồi. Trả về false nếu chỗ không tồn tại hoặc đã bị chiếm. */
  public static occupySlot(slotId: number, userId: string): boolean {
    const slot = this.getMeditationSlots().find(s => s.id === slotId)
    if (!slot || slot.isOccupied) return false
    slot.isOccupied = true
    slot.occupiedBy = userId
    return true
  }

  public static releaseSlot(slotId: number): void {
    const slot = this.getMeditationSlots().find(s => s.id === slotId)
    if (!slot) return
    slot.isOccupied = false
    slot.occupiedBy = undefined
  }

  /**
   * Đồng bộ chỗ đã có đồng tu khác ngồi (danh sách do server trả về theo các phiên thiền đang diễn ra).
   * Chỗ do chính người chơi này giữ (`occupiedBy === localUserId`) luôn được giữ nguyên.
   */
  public static syncRemoteOccupancy(occupiedSlotIds: number[], localUserId: string): void {
    const taken = new Set(occupiedSlotIds)
    for (const slot of this.getMeditationSlots()) {
      if (slot.occupiedBy === localUserId) continue
      if (taken.has(slot.id)) {
        slot.isOccupied = true
        slot.occupiedBy = 'remote'
      } else {
        slot.isOccupied = false
        slot.occupiedBy = undefined
      }
    }
  }

  /**
   * Lộ trình đi bộ từ (fromX, fromZ) đến (toX, toZ) trong điện, tự vòng qua các cột lim nằm chắn đường.
   * Trả về danh sách waypoint (luôn kết thúc bằng điểm đích).
   */
  public static computeWalkPath(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number
  ): Array<{ x: number; z: number }> {
    const PLAYER_RADIUS = 0.38
    const SAFETY = 0.55
    const path: Array<{ x: number; z: number }> = []
    const detoured = new Set<number>()
    let cx = fromX
    let cz = fromZ

    for (let guard = 0; guard < this.COLUMNS.length; guard++) {
      const dx = toX - cx
      const dz = toZ - cz
      const len = Math.hypot(dx, dz)
      if (len < 1e-3) break
      const ux = dx / len
      const uz = dz / len

      let blockIdx = -1
      let blockT = Infinity
      for (let i = 0; i < this.COLUMNS.length; i++) {
        if (detoured.has(i)) continue
        const col = this.COLUMNS[i]
        const t = (col.x - cx) * ux + (col.z - cz) * uz
        if (t <= 0 || t >= len) continue
        const px = cx + ux * t
        const pz = cz + uz * t
        if (Math.hypot(px - col.x, pz - col.z) < col.r + PLAYER_RADIUS + SAFETY && t < blockT) {
          blockIdx = i
          blockT = t
        }
      }
      if (blockIdx < 0) break

      const col = this.COLUMNS[blockIdx]
      detoured.add(blockIdx)
      // Lách sang phía lệch của đường thẳng so với tâm cột
      let nx = cx + ux * blockT - col.x
      let nz = cz + uz * blockT - col.z
      let nLen = Math.hypot(nx, nz)
      if (nLen < 1e-3) {
        nx = -uz
        nz = ux
        nLen = 1
      }
      const clearance = col.r + PLAYER_RADIUS + SAFETY + 0.15
      cx = col.x + (nx / nLen) * clearance
      cz = col.z + (nz / nLen) * clearance
      path.push({ x: cx, z: cz })
    }

    path.push({ x: toX, z: toZ })
    return path
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
