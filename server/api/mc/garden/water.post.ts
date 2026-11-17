import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { waterGardenPlot } from '../../../utils/wallet/gardenService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/garden/water: tưới nước cho 1 ô đất Vườn Thiền (1 lần/ngày/ô). */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:garden:water', 30, 60_000)
  const account = await requireSession(event)
  const body = await readBody<{ plotIndex?: number }>(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await waterGardenPlot(account.id, body?.plotIndex)
})

