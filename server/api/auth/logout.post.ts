import { assertSameOrigin, destroySession } from '../../utils/wallet/auth'
import { rateLimit } from '../../utils/wallet/rateLimit'

/** POST /api/auth/logout -> { ok } ; hủy phiên ở DB và xóa cookie. */
export default defineEventHandler((event) => {
  assertSameOrigin(event)
  rateLimit(event, 'auth:logout', 30, 60_000)
  destroySession(event)
  return { ok: true }
})

