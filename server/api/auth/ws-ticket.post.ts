import { assertSameOrigin, issueWsTicket, requireSession } from '../../utils/wallet/auth'
import { rateLimit } from '../../utils/wallet/rateLimit'

/**
 * POST /api/auth/ws-ticket -> { ticket }
 * Vé WS dùng một lần (60s) để gắn kết nối đa người chơi với tài khoản đã xác thực
 * mà không đưa token phiên (httpOnly) vào JavaScript.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'auth:ws-ticket', 30, 60_000)
  const account = await requireSession(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ticket: await issueWsTicket(account.id) }
})

