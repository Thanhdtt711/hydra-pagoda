import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { renameKoi } from '../../../utils/wallet/koiService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/koi/rename: đặt tên riêng cho 1 chú cá Koi (miễn phí 1 lần / con). */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:koi:rename', 20, 60_000)
  const account = await requireSession(event)
  const body = await readBody<{ koiIndex?: number; name?: string }>(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await renameKoi(account.id, body?.koiIndex, body?.name)
})

