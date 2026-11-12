import { assertSameOrigin, startSession, verifyLogin } from '../../utils/wallet/auth'
import { rateLimit } from '../../utils/wallet/rateLimit'
import { getHydraConfig } from '../../utils/hydra/config'
import { ensureAccountSession } from '../../utils/hydra/sessionKey'

/**
 * POST /api/auth/verify  { address, nonce, signature, key } -> { account }
 * Xác minh chữ ký CIP-8; thành công thì đặt cookie phiên httpOnly.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'auth:verify', 10, 60_000)
  const body = await readBody(event)
  const account = await verifyLogin(event, body ?? {})
  const sessionToken = await startSession(event, account.id)

  // Hydra L2: chữ ký CIP-8 vừa xác minh ủy quyền cho Session Ephemeral Key của tài khoản (không cần popup ví khi tiêu MC).
  let l2: { sessionVkey: string; l2Address: string } | null = null
  if (getHydraConfig().enabled) {
    try {
      l2 = await ensureAccountSession(account.id)
    } catch (e: any) {
      console.warn('[hydra:l2] Không tạo được Session Key (bỏ qua, dùng SQLite):', e?.message || e)
    }
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { account, sessionToken, l2 }
})

