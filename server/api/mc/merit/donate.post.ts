import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { donateMeritWithMc, getAccountInventory, getMcOverviewAndHistory } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/merit/donate
 * Body: { amountMc: number, prayer?: string, requestId: string }
 * Tiêu MC nguyên tử để cúng dường Hòm Công Đức, cộng vào tổng công đức toàn chùa,
 * ghi nhận bảng công đức và tặng vật phẩm tri ân nếu đạt mốc.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:merit:donate', 20, 60_000)
  const account = requireSession(event)
  const body = (await readBody<{ amountMc?: unknown; prayer?: unknown; requestId?: unknown }>(event).catch(() => ({}))) || {}

  const amountMc = typeof body.amountMc === 'number' ? body.amountMc : Number(body.amountMc)
  const res = donateMeritWithMc(
    account.id,
    amountMc,
    String(body.prayer ?? ''),
    String(body.requestId ?? '')
  )

  const overview = getMcOverviewAndHistory(account.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    idempotentReplay: res.idempotentReplay,
    ledgerId: res.ledgerId,
    spentMc: res.spentMc,
    mcBalance: res.balanceAfter,
    donation: res.extra,
    globalMeritTotal: overview.globalMeritTotal,
    leaderboard: overview.leaderboard,
    recentDonations: overview.recentDonations,
    inventory: getAccountInventory(account.id)
  }
})

