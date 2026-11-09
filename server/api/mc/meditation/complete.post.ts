import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { completeMeditationSession } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/meditation/complete
 * Body: { sessionToken: string }
 * Server tự kiểm tra đã đủ thời gian kể từ `started_at` (400 `meditation_incomplete` nếu gọi sớm), áp dụng trần
 * MC mỗi ngày rồi cộng MC nguyên tử + ghi `mc_ledger` (`meditation_reward`). Gọi lặp trả kết quả idempotent.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:meditation:complete', 30, 60_000)
  const account = requireSession(event)
  const body = (await readBody<{ sessionToken?: unknown }>(event).catch(() => ({}))) || {}

  const res = completeMeditationSession(account.id, body.sessionToken)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    ...res,
    hydra: res.ledgerId ? await getHydraProof(res.ledgerId) : null
  }
})

