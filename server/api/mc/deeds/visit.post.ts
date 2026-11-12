import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { recordVisitDeed } from '../../../utils/wallet/deedService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/deeds/visit  { landmark }
 * Client báo đã đến một điểm trong chùa. Server chỉ nhận điểm nằm trong ba việc hôm nay của tài khoản.
 * Quà chỉ là vật phẩm tượng trưng nên chấp nhận tin lời báo của client.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:deeds:visit', 30, 60_000)
  const account = await requireSession(event)
  const body = (await readBody(event).catch(() => ({}))) || {}

  const status = await recordVisitDeed(account.id, body.landmark)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, status }
})
