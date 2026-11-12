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
