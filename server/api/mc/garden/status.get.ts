import { getSessionAccount } from '../../../utils/wallet/auth'
import { getGardenStatus } from '../../../utils/wallet/gardenService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** GET /api/mc/garden/status: trạng thái 6 ô đất Vườn Thiền cá nhân. */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'mc:garden:status', 60, 60_000)
  const account = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await getGardenStatus(account?.id ?? null)
})

