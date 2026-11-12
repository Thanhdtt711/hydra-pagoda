import { getSessionAccount } from '../../../utils/wallet/auth'
import { getStreakStatus } from '../../../utils/wallet/streakService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * GET /api/mc/streak/status
 * Trạng thái Sổ Tu Tập: chuỗi hiện tại, việc lành hôm nay, cột mốc đã nhận. Khách chỉ thấy danh sách cột mốc.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'mc:streak:status', 60, 60_000)
  const account = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await getStreakStatus(account?.id ?? null)
})
