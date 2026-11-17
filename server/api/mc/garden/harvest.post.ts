import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { harvestGardenPlot } from '../../../utils/wallet/gardenService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/garden/harvest: thu hoạch cây đã viên mãn (stage 4) nhận lễ phẩm vào túi đồ. */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:garden:harvest', 30, 60_000)
  const account = await requireSession(event)
  const body = await readBody<{ plotIndex?: number }>(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await harvestGardenPlot(account.id, body?.plotIndex)
})

