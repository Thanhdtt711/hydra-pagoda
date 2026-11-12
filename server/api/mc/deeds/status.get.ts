import { getSessionAccount } from '../../../utils/wallet/auth'
import { getDailyDeedsStatus } from '../../../utils/wallet/deedService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * GET /api/mc/deeds/status
 * Ba Việc Lành hôm nay và tiến độ của chính tài khoản. Khách chưa đăng nhập chỉ nhận khung rỗng.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'mc:deeds:status', 60, 60_000)
  const account = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await getDailyDeedsStatus(account?.id ?? null)
})
