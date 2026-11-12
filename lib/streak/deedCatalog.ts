/**
 * Danh mục và cách chọn "Ba Việc Lành mỗi ngày" (đề xuất 3.2 trong docs/co_che_hoat_dong/DE_XUAT_TRO_CHOI_GIU_CHAN.md).
 * Thuần hàm, không đụng DB hay đồng hồ, dùng chung cho server, client và test.
 *
 * - Bộ ba việc của một ngày chỉ phụ thuộc `accountId` và khóa ngày giờ Việt Nam, nên không phải lưu danh sách việc.
 *   Mỗi người một bộ khác nhau; cùng một người cùng một ngày thì luôn giống nhau.
 * - Việc `auto`: server tự kiểm từ dữ liệu sẵn có (thiền xong, thắp hương, gieo quẻ).
 * - Việc `visit`: đến một điểm trong chùa. Server không biết vị trí người chơi nên tin lời client báo
 *   (chấp nhận được vì quà là vật phẩm tượng trưng, không có MC).
 * - Không đưa việc tốn MC (cúng dường) vào bộ ba để người mới không bị chặn.
 */
import { createSeededRng, hashSeedString } from '../boi/SeedService.ts'

export const DAILY_DEED_COUNT = 3

export type AutoDeedKey = 'meditation' | 'incense' | 'fortune'

export interface DeedDef {
  id: string
  /** Câu hiển thị cho người chơi. */
  label: string
  kind: 'auto' | 'visit'
  /** Việc `auto`: khóa trong dữ liệu việc lành server đọc được. */
  autoKey?: AutoDeedKey
  /** Việc `visit`: mã điểm đến gửi lên server. */
  landmark?: string
  /** Việc `visit`: khóa trong `MapLayout.LANDMARKS` để client lấy tọa độ (không lặp tọa độ ở đây). */
  mapKey?: string
}

export const DEED_CATALOG: readonly DeedDef[] = [
  { id: 'meditation', label: 'Ngồi thiền trọn một thời', kind: 'auto', autoKey: 'meditation' },
  { id: 'incense', label: 'Thắp hương đầu ngày', kind: 'auto', autoKey: 'incense' },
  { id: 'fortune', label: 'Gieo một quẻ cầu an', kind: 'auto', autoKey: 'fortune' },
  { id: 'visit_lotus_pond', label: 'Ngắm Hồ Sen Bát Nhã', kind: 'visit', landmark: 'lotus_pond', mapKey: 'LOTUS_POND' },
  { id: 'visit_bell_tower', label: 'Đến Lầu Chuông', kind: 'visit', landmark: 'bell_tower', mapKey: 'BELL_TOWER' },
  { id: 'visit_love_tree_shrine', label: 'Đến Đài Tơ Duyên', kind: 'visit', landmark: 'love_tree_shrine', mapKey: 'LOVE_TREE_SHRINE' },
  { id: 'visit_bodhi_tree', label: 'Đứng dưới Cây Bồ Đề', kind: 'visit', landmark: 'bodhi_tree', mapKey: 'BODHI_TREE' },
  { id: 'visit_banyan_tree', label: 'Đứng dưới Cây Đa', kind: 'visit', landmark: 'banyan_tree', mapKey: 'BANYAN_TREE' }
]

/** Quà khi đủ ba việc: một vật phẩm tiêu hao nhẹ, không cộng MC. */
export const DAILY_DEED_REWARD = {
  itemId: 'incense_quang',
  category: 'offering' as const,
  label: 'Trầm Hương Xứ Quảng'
}

export function findVisitDeed(landmark: string): DeedDef | null {
  return DEED_CATALOG.find(d => d.kind === 'visit' && d.landmark === landmark) ?? null
}

/** Ba việc của một tài khoản trong một ngày. Không trùng việc trong cùng một bộ. */
export function pickDailyDeeds(accountId: number, dayKey: string): DeedDef[] {
  const rng = createSeededRng(hashSeedString(`daily-deeds|${accountId}|${dayKey}`))
  const pool = [...DEED_CATALOG]
  // Xáo Fisher-Yates theo hạt giống rồi lấy đầu danh sách.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1)
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
  }
  return pool.slice(0, DAILY_DEED_COUNT)
}
