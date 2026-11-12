import { assertSameOrigin, issueNonce } from '../../utils/wallet/auth'
import { rateLimit } from '../../utils/wallet/rateLimit'
import { getWalletConfig } from '../../utils/wallet/config'

/** POST /api/auth/nonce  { address } -> { nonce, message, expiresAt, network } */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'auth:nonce', 10, 60_000)
  const body = await readBody<{ address?: unknown }>(event)
  const r = await issueNonce(event, body?.address)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ...r, networkId: getWalletConfig().networkId }
})

