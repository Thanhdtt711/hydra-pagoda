import { getSessionAccount } from '../../../utils/wallet/auth'
import { getKoiStatus } from '../../../utils/wallet/koiService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** GET /api/mc/koi/status: trạng thái 5 cá Koi tại Hồ Sen Bát Nhã. */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'mc:koi:status', 60, 60_000)
  const account = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await getKoiStatus(account?.id ?? null)
})

