import { assertSameOrigin, getSessionAccount } from '../../../utils/wallet/auth'
import { getHauDongStatus, recordHauDongHeartbeat } from '../../../utils/wallet/hauDongService'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  const acc = getSessionAccount(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>

  if (!acc) {
    return getHauDongStatus(null)
  }

  return recordHauDongHeartbeat(acc.id, {
    insideZone: Boolean(body.insideZone),
    isBowing: Boolean(body.isBowing),
    deltaSec: Number(body.deltaSec) || 5
  })
})

