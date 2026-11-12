import { assertSameOrigin, requireSession, setAccountFortuneName } from '../../utils/wallet/auth'
import { rateLimit } from '../../utils/wallet/rateLimit'

/**
 * POST /api/auth/profile-name
 * Đồng bộ họ tên từ hồ sơ Bói Quẻ của tài khoản đã đăng nhập ví lên SQLite (`fortune_name`).
 * Truyền `fullName: null | ""` để xóa tên hồ sơ và khôi phục tên mặc định theo địa chỉ ví.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'auth:profile-name', 30, 60_000)
  const account = await requireSession(event)
  const body: { fullName?: string | null } = (await readBody<{ fullName?: string | null }>(event).catch(() => null)) || {}
  const updated = await setAccountFortuneName(
    account.id,
    typeof body.fullName === 'string' ? body.fullName : null
  )
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    account: updated ?? account
  }
})

