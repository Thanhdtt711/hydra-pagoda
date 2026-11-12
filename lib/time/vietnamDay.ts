/**
 * Helper ngày theo giờ Việt Nam (UTC+7), dùng chung cho server và client.
 * Mọi hạn mức "mỗi ngày" (thiền, hầu đồng, parkour, bói, dâng hương) phải dùng chung mốc 00:00 giờ Việt Nam
 * để không bị lệch khóa ngày giữa các dịch vụ.
 */
const VN_OFFSET_MS = 7 * 3600 * 1000
const DAY_MS = 86_400_000

/** Khóa ngày dạng `YYYY-MM-DD` theo giờ Việt Nam. */
export function getVietnamDayKey(now = Date.now()): string {
  return new Date(now + VN_OFFSET_MS).toISOString().slice(0, 10)
}

/** Mốc 00:00:00.000 giờ Việt Nam của ngày chứa `now`, tính bằng epoch ms (UTC). */
export function getStartOfVietnamDayMs(now = Date.now()): number {
  const vnNow = now + VN_OFFSET_MS
  return Math.floor(vnNow / DAY_MS) * DAY_MS - VN_OFFSET_MS
}

/** Cộng (hoặc trừ) `days` ngày vào khóa ngày `YYYY-MM-DD`, trả về khóa ngày mới. */
export function addDaysToDayKey(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Số ngày từ khóa ngày `fromKey` đến `toKey` (dương nếu `toKey` muộn hơn). */
export function daysBetweenDayKeys(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS)
}

/** Khóa tuần = khóa ngày của thứ Hai đầu tuần chứa `dayKey` (tuần bắt đầu từ thứ Hai). */
export function getWeekKeyOfDayKey(dayKey: string): string {
  const dow = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDaysToDayKey(dayKey, -dow)
}

/** Khóa tuần theo giờ Việt Nam (thứ Hai 00:00 giờ VN là đầu tuần). */
export function getVietnamWeekKey(now = Date.now()): string {
  return getWeekKeyOfDayKey(getVietnamDayKey(now))
}
