import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { SlotBatch } from '../style/SlotBatch'

export interface ParkourPlatformDef {
  id: string
  type: 'stone' | 'wood' | 'lotus' | 'pillar'
  pos: [number, number, number]
  size: [number, number, number]
  rotationY?: number
}

/**
 * MountainParkourSystem:
 * Hệ thống Parkour Leo Núi "Đường Lên Đỉnh Phù Vân" - Đỉnh Cao 70M.
 * Xuất phát từ chân núi phía sau Chánh Điện (z = -33.5m) vươn lên tới Thiên Đỉnh Phù Vân (y = 70.0m, z = -78.0m).
 * Thời gian chinh phục trung bình: 3 - 6 phút.
 * Gồm 4 chặng thử thách khốc liệt, 2 trạm nghỉ chân (Đình Vọng Mây, Cầu Treo Vách Núi) và Thiên Đỉnh ngắm toàn cảnh 360 độ.
 */
export class MountainParkourSystem {
  public root = new THREE.Group()

  // Vị trí Hòm Đăng Ký Parkour chân núi
  public readonly startChestPos = new THREE.Vector3(0, 0.45, -33.5)
  // Vị trí Chuông & Rương Báu Thiên Đỉnh Phù Vân (y = 70.0m)
  public readonly summitPos = new THREE.Vector3(0, 70.8, -78.0)

  /**
   * Danh sách 66 bệ nhảy phân bổ qua 4 chặng thử thách.
   * Chênh lệch độ cao mỗi bậc: 0.85m - 1.15m (tối ưu cho jumpStrength 8.8m/s).
   * Cự ly nhảy xa: 2.4m - 4.2m (đòi hỏi Sprint lấy đà ở các chặng trên cao).
   */
  public static readonly PLATFORMS: ParkourPlatformDef[] = [
    // =========================================================================
    // CHẶNG 1: THỀM ĐÁ CHÂN NÚI (y: 0.50m -> 13.90m | 14 bậc)
    // Làm quen nhịp nhảy, bệ đá rộng 2.0m - 2.4m men theo sườn Tây
    // =========================================================================
    { id: 's1_01', type: 'stone', pos: [0.0, 0.50, -36.2], size: [2.4, 0.45, 2.0] },
    { id: 's1_02', type: 'stone', pos: [-2.2, 1.45, -38.0], size: [2.2, 0.45, 1.8] },
    { id: 's1_03', type: 'stone', pos: [-4.4, 2.40, -39.8], size: [2.2, 0.45, 1.8] },
    { id: 's1_04', type: 'stone', pos: [-6.8, 3.40, -41.5], size: [2.0, 0.45, 1.8] },
    { id: 's1_05', type: 'wood',  pos: [-9.2, 4.45, -43.0], size: [2.0, 0.30, 1.8] },
    { id: 's1_06', type: 'wood',  pos: [-11.5, 5.50, -44.8], size: [2.0, 0.30, 1.8] },
    { id: 's1_07', type: 'stone', pos: [-13.2, 6.55, -47.0], size: [2.0, 0.45, 1.8] },
    { id: 's1_08', type: 'stone', pos: [-14.0, 7.60, -49.8], size: [2.0, 0.45, 1.8] },
    { id: 's1_09', type: 'wood',  pos: [-13.5, 8.65, -52.6], size: [2.0, 0.30, 1.8] },
    { id: 's1_10', type: 'wood',  pos: [-12.0, 9.70, -55.2], size: [2.0, 0.30, 1.8] },
    { id: 's1_11', type: 'stone', pos: [-9.8, 10.75, -57.2], size: [2.0, 0.45, 1.8] },
    { id: 's1_12', type: 'wood',  pos: [-7.4, 11.80, -58.8], size: [2.0, 0.30, 1.8] },
    { id: 's1_13', type: 'wood',  pos: [-5.0, 12.85, -59.8], size: [2.0, 0.30, 1.8] },
    { id: 's1_14', type: 'stone', pos: [-2.5, 13.90, -60.0], size: [2.0, 0.45, 1.8] },

    // =========================================================================
    // CHẶNG 2: VÁN GỖ VÁCH NÚI (y: 14.95m -> 28.60m | 14 bậc)
    // Các tấm ván gỗ lớn (1.9m x 1.7m), khoảng cách gần, bước nhảy êm
    // =========================================================================
    { id: 's2_01', type: 'wood',  pos: [0.0, 14.95, -59.5], size: [1.9, 0.30, 1.7] },
    { id: 's2_02', type: 'wood',  pos: [2.2, 16.00, -58.5], size: [1.9, 0.30, 1.7] },
    { id: 's2_03', type: 'wood',  pos: [4.4, 17.05, -57.0], size: [1.9, 0.30, 1.7] },
    { id: 's2_04', type: 'wood',  pos: [6.4, 18.10, -55.0], size: [1.9, 0.30, 1.7] },
    { id: 's2_05', type: 'wood',  pos: [8.2, 19.15, -52.6], size: [1.9, 0.30, 1.7] },
    { id: 's2_06', type: 'wood',  pos: [9.6, 20.20, -50.0], size: [1.9, 0.30, 1.7] },
    { id: 's2_07', type: 'wood',  pos: [10.4, 21.25, -47.2], size: [1.9, 0.30, 1.7] },
    { id: 's2_08', type: 'wood',  pos: [10.2, 22.30, -44.4], size: [1.9, 0.30, 1.7] },
    { id: 's2_09', type: 'wood',  pos: [9.0, 23.35, -41.8], size: [1.9, 0.30, 1.7] },
    { id: 's2_10', type: 'wood',  pos: [7.2, 24.40, -39.6], size: [1.9, 0.30, 1.7] },
    { id: 's2_11', type: 'wood',  pos: [5.0, 25.45, -38.2], size: [1.9, 0.30, 1.7] },
    { id: 's2_12', type: 'wood',  pos: [2.6, 26.50, -37.5], size: [1.9, 0.30, 1.7] },
    { id: 's2_13', type: 'wood',  pos: [0.0, 27.55, -37.8], size: [1.9, 0.30, 1.7] },
    { id: 's2_14', type: 'wood',  pos: [-2.6, 28.60, -39.2], size: [2.0, 0.30, 1.8] },

    // --- CHECKPOINT 1: ĐÌNH VỌNG MÂY (y = 29.5m) ---
    { id: 'cp1_pavilion', type: 'wood', pos: [-6.5, 29.50, -42.0], size: [5.6, 0.5, 5.6] },

    // =========================================================================
    // CHẶNG 3: ĐƯỜNG VÁN GỖ BIỂN MÂY (y: 30.65m -> 47.40m | 16 bậc)
    // Toàn bộ là tấm ván gỗ lim to (1.9m x 1.7m), cự ly ngắn 2.3m - 2.6m cực kỳ dễ nhảy
    // =========================================================================
    { id: 's3_01', type: 'wood', pos: [-6.5, 30.65, -46.0], size: [2.0, 0.30, 1.8] },
    { id: 's3_02', type: 'wood', pos: [-5.2, 31.80, -48.2], size: [1.9, 0.30, 1.7] },
    { id: 's3_03', type: 'wood', pos: [-3.6, 32.95, -50.4], size: [1.9, 0.30, 1.7] },
    { id: 's3_04', type: 'wood', pos: [-1.8, 34.10, -52.4], size: [1.9, 0.30, 1.7] },
    { id: 's3_05', type: 'wood', pos: [0.2, 35.25, -54.0],  size: [1.9, 0.30, 1.7] },
    { id: 's3_06', type: 'wood', pos: [2.4, 36.40, -55.2],  size: [1.9, 0.30, 1.7] },
    { id: 's3_07', type: 'wood', pos: [4.8, 37.55, -55.8],  size: [1.9, 0.30, 1.7] },
    { id: 's3_08', type: 'wood', pos: [7.2, 38.70, -55.6],  size: [1.9, 0.30, 1.7] },
    { id: 's3_09', type: 'wood', pos: [9.5, 39.85, -54.6],  size: [1.9, 0.30, 1.7] },
    { id: 's3_10', type: 'wood', pos: [11.4, 41.00, -52.8], size: [1.9, 0.30, 1.7] },
    { id: 's3_11', type: 'wood', pos: [12.6, 42.15, -50.4], size: [1.9, 0.30, 1.7] },
    { id: 's3_12', type: 'wood', pos: [13.0, 43.30, -47.8], size: [1.9, 0.30, 1.7] },
    { id: 's3_13', type: 'wood', pos: [12.2, 44.45, -45.2], size: [1.9, 0.30, 1.7] },
    { id: 's3_14', type: 'wood', pos: [10.4, 45.60, -43.0], size: [1.9, 0.30, 1.7] },
    { id: 's3_15', type: 'wood', pos: [8.0, 46.75, -41.4],  size: [1.9, 0.30, 1.7] },
    { id: 's3_16', type: 'wood', pos: [5.6, 47.40, -40.6],  size: [2.0, 0.30, 1.8] },

    // --- CHECKPOINT 2: CẦU TREO VÁCH NÚI (y = 48.0m) ---
    { id: 'cp2_bridge_a', type: 'wood', pos: [3.2, 48.00, -40.5], size: [3.0, 0.3, 2.2] },
    { id: 'cp2_bridge_b', type: 'wood', pos: [0.0, 48.20, -41.5], size: [3.4, 0.3, 2.2] },
    { id: 'cp2_bridge_c', type: 'wood', pos: [-3.2, 48.40, -43.0], size: [3.2, 0.4, 2.4] },

    // =========================================================================
    // CHẶNG 4: ĐƯỜNG VÁN GỖ THIÊN ĐỈNH (y: 49.50m -> 69.20m | 19 bậc)
    // Bậc ván gỗ to dày (1.9m - 2.4m) dẫn thẳng lên Thiên Đỉnh ngắm toàn cảnh 360 độ
    // =========================================================================
    { id: 's4_01', type: 'wood', pos: [-5.4, 49.50, -45.0], size: [2.0, 0.30, 1.8] },
    { id: 's4_02', type: 'wood', pos: [-7.2, 50.60, -47.2], size: [1.9, 0.30, 1.7] },
    { id: 's4_03', type: 'wood', pos: [-8.8, 51.70, -49.6], size: [1.9, 0.30, 1.7] },
    { id: 's4_04', type: 'wood', pos: [-10.0, 52.80, -52.2], size: [1.9, 0.30, 1.7] },
    { id: 's4_05', type: 'wood', pos: [-10.4, 53.90, -55.0], size: [1.9, 0.30, 1.7] },
    { id: 's4_06', type: 'wood', pos: [-9.8, 55.00, -57.8], size: [1.9, 0.30, 1.7] },
    { id: 's4_07', type: 'wood', pos: [-8.4, 56.10, -60.4], size: [1.9, 0.30, 1.7] },
    { id: 's4_08', type: 'wood', pos: [-6.4, 57.20, -62.6], size: [1.9, 0.30, 1.7] },
    { id: 's4_09', type: 'wood', pos: [-4.0, 58.30, -64.4], size: [1.9, 0.30, 1.7] },
    { id: 's4_10', type: 'wood', pos: [-1.4, 59.40, -65.6], size: [1.9, 0.30, 1.7] },
    { id: 's4_11', type: 'wood', pos: [1.2, 60.50, -66.0],  size: [1.9, 0.30, 1.7] },
    { id: 's4_12', type: 'wood', pos: [3.8, 61.60, -65.6],  size: [1.9, 0.30, 1.7] },
    { id: 's4_13', type: 'wood', pos: [6.2, 62.70, -64.4],  size: [1.9, 0.30, 1.7] },
    { id: 's4_14', type: 'wood', pos: [8.0, 63.80, -62.4],  size: [1.9, 0.30, 1.7] },
    { id: 's4_15', type: 'wood', pos: [8.8, 64.90, -65.0],  size: [1.9, 0.30, 1.7] },
    { id: 's4_16', type: 'wood', pos: [7.8, 66.00, -67.8],  size: [2.0, 0.30, 1.8] },
    { id: 's4_17', type: 'wood', pos: [5.4, 67.20, -70.4],  size: [2.0, 0.30, 1.8] },
    { id: 's4_18', type: 'wood', pos: [2.8, 68.30, -72.6],  size: [2.2, 0.35, 1.9] },
    { id: 's4_19', type: 'wood', pos: [0.0, 69.20, -74.4],  size: [2.4, 0.40, 2.0] },

    // =========================================================================
    // THIÊN ĐỈNH PHÙ VÂN (y = 70.0m | Sàn Cẩm Thạch 10m x 10m)
    // Đài thưởng ngoạn toàn cảnh 360 độ, Đại Hồng Chung & Rương Báu Đỉnh Núi
    // =========================================================================
    { id: 'summit_sanctuary', type: 'stone', pos: [0.0, 70.00, -78.0], size: [10.0, 0.8, 10.0] }
  ]

  constructor(private collisionWorld: CollisionWorld) {
    this.root.name = 'MountainParkourSystem'
    this.buildLevel()
    this.registerColliders()
  }

  private buildLevel() {
    const b = new SlotBatch()

    // -------------------------------------------------------------------------
    // 1. CỔNG XUẤT PHÁT & HÒM ĐĂNG KÝ CHÂN NÚI (z = -33.5m, y = 0.45m)
    // -------------------------------------------------------------------------
    b.cylinder('woodDark', 0.18, 0.20, 3.4, 8, -2.0, 1.7, -33.5)
    b.cylinder('woodDark', 0.18, 0.20, 3.4, 8, 2.0, 1.7, -33.5)
    b.box('woodDark', 4.6, 0.32, 0.40, 0, 3.3, -33.5)
    b.box('roofDark', 5.0, 0.18, 0.9, 0, 3.5, -33.5)
    // Hòm Đăng Ký Parkour
    b.box('woodDark', 1.2, 0.9, 0.85, 0, 0.45, -33.5)
    b.box('gold', 1.28, 0.08, 0.92, 0, 0.92, -33.5)
    b.box('gold', 0.38, 0.05, 0.04, 0, 0.74, -33.05)
    // Bia đá chỉ dẫn
    b.box('stone', 1.4, 1.5, 0.4, -2.8, 0.75, -33.5)

    // -------------------------------------------------------------------------
    // 2. DỰNG TỪNG BẬC NHẢY TRONG 66 PLATFORMS
    // -------------------------------------------------------------------------
    for (const p of MountainParkourSystem.PLATFORMS) {
      if (p.id === 'cp1_pavilion' || p.id === 'summit_sanctuary') continue // dựng riêng bên dưới

      const [x, y, z] = p.pos
      const [w, h, d] = p.size

      if (p.type === 'stone') {
        b.box('stone', w, h, d, x, y, z)
        b.box('ground', w * 0.92, 0.04, d * 0.92, x, y + h * 0.5 + 0.02, z)
      } else if (p.type === 'wood') {
        // Tấm ván gỗ lim to dày dặn dễ nhảy
        b.box('wood', w, h, d, x, y, z)
        // Nẹp viền gỗ sẫm màu chống trượt
        b.box('woodDark', w * 1.04, 0.04, d * 1.04, x, y + h * 0.5 - 0.02, z)
        // Mặt phẳng sáng ở giữa giúp căn điểm rơi từ xa
        b.box('ground', w * 0.88, 0.02, d * 0.88, x, y + h * 0.5 + 0.01, z)
        // Cọc trụ sắt đỡ bên dưới
        b.cylinder('roofDark', 0.06, 0.06, 2.6, 6, x, y - 1.2, z)
      } else if (p.type === 'lotus') {
        // Fallback nếu có
        b.cylinder('gold', w * 0.5, w * 0.32, h, 8, x, y, z)
        b.sphere('roofDark', w * 0.38, 0, x, y + h * 0.45, z)
      } else if (p.type === 'pillar') {
        // Fallback nếu có
        const topY = y + 0.20
        const pillarH = Math.max(h, 1.6)
        const pillarCenterY = topY - pillarH * 0.5
        b.cylinder('stone', w * 0.52, w * 0.52, pillarH, 12, x, pillarCenterY, z)
        b.cylinder('gold', w * 0.50, w * 0.50, 0.08, 12, x, topY - 0.04, z)
        b.cylinder('ground', w * 0.42, w * 0.42, 0.02, 12, x, topY + 0.01, z)
      }
    }

    // -------------------------------------------------------------------------
    // 3. CHECKPOINT 1: ĐÌNH VỌNG MÂY (y = 29.5m, x = -6.5m, z = -42.0m)
    // -------------------------------------------------------------------------
    const [c1x, c1y, c1z] = [-6.5, 29.5, -42.0]
    // Sàn gỗ bát giác
    b.box('woodDark', 5.6, 0.5, 5.6, c1x, c1y, c1z)
    b.box('wood', 5.2, 0.05, 5.2, c1x, c1y + 0.28, c1z)
    // 4 Cột đình
    b.cylinder('woodDark', 0.16, 0.16, 3.6, 8, c1x - 2.2, c1y + 1.8, c1z - 2.2)
    b.cylinder('woodDark', 0.16, 0.16, 3.6, 8, c1x + 2.2, c1y + 1.8, c1z - 2.2)
    b.cylinder('woodDark', 0.16, 0.16, 3.6, 8, c1x - 2.2, c1y + 1.8, c1z + 2.2)
    b.cylinder('woodDark', 0.16, 0.16, 3.6, 8, c1x + 2.2, c1y + 1.8, c1z + 2.2)
    // Mái ngói cong cổ tự
    b.box('roofDark', 6.4, 0.3, 6.4, c1x, c1y + 3.6, c1z)
    b.box('roofDark', 4.4, 0.4, 4.4, c1x, c1y + 4.0, c1z)
    b.sphere('gold', 0.4, 0, c1x, c1y + 4.5, c1z)
    // Băng ghế nghỉ chân
    b.box('wood', 3.6, 0.4, 0.5, c1x, c1y + 0.5, c1z - 2.2)

    // -------------------------------------------------------------------------
    // 4. CHECKPOINT 2: CẦU TREO VÁCH NÚI (y = 48.0m)
    // -------------------------------------------------------------------------
    // Dây cáp treo hai bên mạn cầu
    b.cylinder('roofDark', 0.04, 0.04, 8.5, 6, 0, 49.2, -41.5, 0, 0, 1.57)
    b.cylinder('roofDark', 0.04, 0.04, 8.5, 6, 0, 50.0, -41.5, 0, 0, 1.57)

    // -------------------------------------------------------------------------
    // 5. THIÊN ĐỈNH PHÙ VÂN (y = 70.0m, x = 0.0m, z = -78.0m)
    // -------------------------------------------------------------------------
    const [sx, sy, sz] = [0.0, 70.0, -78.0]

    // Nền đá hoa cương đài thưởng ngoạn 10m x 10m
    b.box('stone', 10.0, 0.8, 10.0, sx, sy, sz)
    b.box('ground', 9.4, 0.04, 9.4, sx, sy + 0.42, sz)

    // Lan can đá bảo vệ 4 cạnh
    b.box('stone', 9.6, 0.85, 0.3, sx, sy + 0.85, sz - 4.7)
    b.box('stone', 9.6, 0.85, 0.3, sx, sy + 0.85, sz + 4.7)
    b.box('stone', 0.3, 0.85, 9.0, sx - 4.7, sy + 0.85, sz)
    b.box('stone', 0.3, 0.85, 9.0, sx + 4.7, sy + 0.85, sz)

    // Trụ hoa sen 4 góc lan can
    b.cylinder('gold', 0.25, 0.25, 1.2, 8, sx - 4.7, sy + 0.9, sz - 4.7)
    b.cylinder('gold', 0.25, 0.25, 1.2, 8, sx + 4.7, sy + 0.9, sz - 4.7)
    b.cylinder('gold', 0.25, 0.25, 1.2, 8, sx - 4.7, sy + 0.9, sz + 4.7)
    b.cylinder('gold', 0.25, 0.25, 1.2, 8, sx + 4.7, sy + 0.9, sz + 4.7)

    // Khung Lầu Chuông Thiên Đỉnh
    b.cylinder('woodDark', 0.22, 0.24, 4.6, 8, sx - 1.8, sy + 2.7, sz)
    b.cylinder('woodDark', 0.22, 0.24, 4.6, 8, sx + 1.8, sy + 2.7, sz)
    b.box('woodDark', 4.4, 0.4, 0.45, sx, sy + 4.8, sz)
    b.box('roofDark', 5.0, 0.3, 1.8, sx, sy + 5.1, sz)
    b.sphere('gold', 0.45, 0, sx, sy + 5.5, sz)

    // ĐẠI HỒNG CHUNG KHỔNG LỒ MẠ VÀNG
    b.cylinder('gold', 0.55, 0.85, 1.6, 12, sx, sy + 3.6, sz)
    b.sphere('gold', 0.45, 0, sx, sy + 4.4, sz)

    // RƯƠNG BÁU THIÊN ĐỈNH (Phần thưởng +100 MC)
    b.box('woodDark', 1.4, 0.9, 0.9, sx, sy + 0.85, sz + 2.2)
    b.box('gold', 1.48, 0.1, 0.98, sx, sy + 1.35, sz + 2.2)
    b.box('gold', 0.4, 0.08, 0.06, sx, sy + 1.1, sz + 1.72)

    this.root.add(b.build({ name: 'mountain_parkour_epic' }))
  }

  private registerColliders() {
    // 1. Collider Hòm khởi hành chân núi
    this.collisionWorld.add(
      new BoxCollider(
        'parkour_chest_start',
        new THREE.Vector3(0, 0.45, -33.5),
        new THREE.Vector3(1.4, 1.0, 1.0),
        false
      )
    )

    // 2. Collider cho toàn bộ bệ nhảy & trạm dừng chân
    for (const p of MountainParkourSystem.PLATFORMS) {
      const [x, y, z] = p.pos
      const [w, h, d] = p.size

      // Toàn bộ bệ dùng BoxCollider chuẩn với mặt sàn bám chân vững chãi
      // Mở rộng nhẹ collider biên độ +0.25m để người chơi nhảy dễ trúng, không bị trượt mép
      const colW = w + 0.25
      const colD = d + 0.25

      this.collisionWorld.add(
        new BoxCollider(
          `parkour_${p.id}`,
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(colW, h, colD),
          false,
          true,
          y + h * 0.5
        )
      )
    }

    // 3. Collider Chuông & Rương Thiên Đỉnh Phù Vân (y = 70.0m, z = -78.0m)
    const [sx, sy, sz] = [0.0, 70.0, -78.0]

    this.collisionWorld.add(
      new CylinderCollider(
        'parkour_summit_bell',
        new THREE.Vector3(sx, sy + 3.6, sz),
        1.1,
        3.0,
        false
      )
    )

    this.collisionWorld.add(
      new BoxCollider(
        'parkour_summit_chest',
        new THREE.Vector3(sx, sy + 0.85, sz + 2.2),
        new THREE.Vector3(1.6, 1.1, 1.1),
        false
      )
    )
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
  }
}
