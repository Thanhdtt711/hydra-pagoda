import { getSessionAccount } from '../../../utils/wallet/auth'
import { getMeditationStatus } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * GET /api/mc/meditation/status
 * Trả về gói thiền, hạn mức MC trong ngày của tài khoản (nếu đã đăng nhập) và danh sách mã bồ đoàn đang có
 * đồng tu ngồi thiền để client chọn chỗ trống gần nhất / báo "hết chỗ ngồi".
 */
export default defineEventHandler((event) => {
  rateLimit(event, 'mc:meditation:status', 60, 60_000)
  const account = getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { authenticated: Boolean(account), ...getMeditationStatus(account?.id ?? null) }
})

