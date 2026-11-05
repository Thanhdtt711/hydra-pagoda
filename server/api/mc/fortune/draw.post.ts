import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { drawFortuneWithMc } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/fortune/draw
 * Body: { category: string, tier: string, requestId: string }
 * Tiêu MC nguyên tử và sinh kết quả Bói Quẻ & Cầu An ở server (client không quyết định kết quả).
 * Idempotent theo requestId.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:fortune:draw', 20, 60_000)
  const account = requireSession(event)
  const body = (await readBody<{ category?: unknown; tier?: unknown; requestId?: unknown }>(event).catch(() => ({}))) || {}

  const res = drawFortuneWithMc(
    account.id,
    String(body.category ?? 'stick'),
    String(body.tier ?? 'auspicious'),
    String(body.requestId ?? '')
  )

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    idempotentReplay: res.idempotentReplay,
    ledgerId: res.ledgerId,
    spentMc: res.spentMc,
    mcBalance: res.balanceAfter,
    fortune: res.extra.fortune,
    receiptHash: res.extra.receiptHash
  }
})

