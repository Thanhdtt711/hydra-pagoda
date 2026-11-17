import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { plantGardenSeed } from '../../../utils/wallet/gardenService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/garden/plant: gieo hạt giống vào 1 trong 6 ô đất Vườn Thiền. */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:garden:plant', 30, 60_000)
  const account = await requireSession(event)
  const body = await readBody<{ plotIndex?: number; seedId?: string }>(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await plantGardenSeed(account.id, body?.plotIndex, body?.seedId)
})

