import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { feedKoi } from '../../../utils/wallet/koiService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/koi/feed: cho cá Koi ăn (ưu tiên 1 lượt miễn phí mỗi ngày, sau đó tiêu 1 Thức Ăn Cá Koi). */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:koi:feed', 30, 60_000)
  const account = await requireSession(event)
  const body = await readBody<{ koiIndex?: number }>(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await feedKoi(account.id, body?.koiIndex)
})

