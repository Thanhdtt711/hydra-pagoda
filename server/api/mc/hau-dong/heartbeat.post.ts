import { assertSameOrigin, getSessionAccount } from '../../../utils/wallet/auth'
import { getHauDongStatus, recordHauDongHeartbeat } from '../../../utils/wallet/hauDongService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  // Client gửi mỗi 2 giây (30 lần/phút); 120 lần/phút chừa chỗ cho nhiều tab cùng một IP.
  rateLimit(event, 'mc:hau-dong:heartbeat', 120, 60_000)
  const acc = await getSessionAccount(event)
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

