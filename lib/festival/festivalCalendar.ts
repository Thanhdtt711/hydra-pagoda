import { convertSolarToLunar, type LunarDate } from '../boi/VietnameseLunarCalendar.ts'
import { getVietnamDayKey } from '../time/vietnamDay.ts'

export type FestivalId = 'mung_1' | 'ram'

export interface ActiveFestival {
  id: FestivalId
  name: string
  /** Nhãn ngắn cho badge HUD, không vượt ngân sách chữ. */
  badgeLabel: string
  /** Nhãn việc lành ghi nhận trong Sổ Tu Tập. */
  deedLabel: string
  lunarDay: number
  lunarMonth: number
  lunarYear: number
  dayKey: string
}

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Chuyển khóa ngày dương lịch (`YYYY-MM-DD`, giờ VN) sang ngày âm lịch Việt Nam.
 * Trả về `null` nếu `dayKey` không hợp lệ.
 */
export function getLunarDateFromDayKey(dayKey: string): LunarDate | null {
  const match = DAY_KEY_RE.exec(dayKey)
  if (!match) return null
  const yy = Number(match[1])
  const mm = Number(match[2])
  const dd = Number(match[3])
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return convertSolarToLunar(dd, mm, yy)
}

function buildFestival(id: FestivalId, lunarMonth: number, lunarYear: number, dayKey: string): ActiveFestival {
  if (id === 'mung_1') {
    return {
      id: 'mung_1',
      name: 'Mùng 1 Âm Lịch',
      badgeLabel: `Mùng 1 · 1/${lunarMonth} ÂL`,
      deedLabel: 'Dâng hương ngày mùng 1',
      lunarDay: 1,
      lunarMonth,
      lunarYear,
      dayKey
    }
  }
  return {
    id: 'ram',
    name: 'Ngày Rằm Âm Lịch',
    badgeLabel: `Rằm · 15/${lunarMonth} ÂL`,
    deedLabel: 'Dâng hương ngày rằm',
    lunarDay: 15,
    lunarMonth,
    lunarYear,
    dayKey
  }
}

/**
 * Tạo dữ liệu xem trước lễ hội (`?festival=ram` hoặc `?festival=mung_1`) cho client test.
 */
export function getFestivalPreview(id: FestivalId, dayKey = getVietnamDayKey()): ActiveFestival {
  const lunar = getLunarDateFromDayKey(dayKey)
  return buildFestival(id, lunar?.month ?? 1, lunar?.year ?? 2026, dayKey)
}

/**
 * Trả về lễ hội âm lịch đang diễn ra trong `dayKey` (mặc định là hôm nay theo giờ VN),
 * hoặc `null` nếu không phải ngày lễ.
 *
 * Bỏ qua tháng nhuận (`isLeap === true`) để không lặp lễ hai lần trong cùng năm âm lịch.
 */
export function getActiveFestival(dayKey = getVietnamDayKey()): ActiveFestival | null {
  const lunar = getLunarDateFromDayKey(dayKey)
  if (!lunar || lunar.isLeap) return null

  if (lunar.day === 1) return buildFestival('mung_1', lunar.month, lunar.year, dayKey)
  if (lunar.day === 15) return buildFestival('ram', lunar.month, lunar.year, dayKey)

  return null
}
