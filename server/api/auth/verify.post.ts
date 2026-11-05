import { assertSameOrigin, startSession, verifyLogin } from '../../utils/wallet/auth'
import { rateLimit } from '../../utils/wallet/rateLimit'

/**
 * POST /api/auth/verify  { address, nonce, signature, key } -> { account }
 * Xác minh chữ ký CIP-8; thành công thì đặt cookie phiên httpOnly.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'auth:verify', 10, 60_000)
  const body = await readBody(event)
  const account = verifyLogin(event, body ?? {})
  startSession(event, account.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { account }
})

