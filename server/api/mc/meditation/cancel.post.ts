import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { cancelMeditationSession } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/meditation/cancel
 * Body: { sessionToken: string }
 * Xả thiền sớm: hủy phiên đang chạy, nhả bồ đoàn cho đồng tu khác và không nhận MC.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:meditation:cancel', 30, 60_000)
  const account = requireSession(event)
  const body = (await readBody<{ sessionToken?: unknown }>(event).catch(() => ({}))) || {}

  const res = cancelMeditationSession(account.id, body.sessionToken)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, ...res }
})

