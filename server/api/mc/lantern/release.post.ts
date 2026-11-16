import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { releaseLantern } from '../../../utils/wallet/lanternService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/lantern/release
 * Tiêu 1 Hoa Đăng Cầu An trong túi đồ để thả trên hồ sen (0 MC). Lỗi 400 `no_lantern` nếu không còn đèn.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:lantern:release', 30, 60_000)
  const account = await requireSession(event)

  const res = await releaseLantern(account.id)

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    remaining: res.remaining,
    inventory: res.inventory
  }
})

