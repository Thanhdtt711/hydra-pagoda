import { getSessionAccount } from '../../utils/wallet/auth'
import { getWalletConfig } from '../../utils/wallet/config'
import { rateLimit } from '../../utils/wallet/rateLimit'

/** GET /api/auth/me -> { authenticated, account?, network } (số dư MC thật từ server) */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'auth:me', 60, 60_000)
  const cfg = getWalletConfig()
  const account = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    authenticated: !!account,
    account: account ?? undefined,
    network: cfg.network,
    networkId: cfg.networkId,
    isTestnet: cfg.isTestnet
  }
})

