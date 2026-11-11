import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { startParkourRun } from '../../../utils/wallet/parkourService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:parkour:start', 30, 60_000)
  const account = requireSession(event)
  const res = startParkourRun(account.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, ...res }
})

