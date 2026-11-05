import { assertSameOrigin, requireSession } from '../../../../utils/wallet/auth'
import { attachWitnessForAccountOrder } from '../../../../utils/wallet/orders'
import { rateLimit } from '../../../../utils/wallet/rateLimit'

/**
 * POST /api/shop/orders/:id/witness  { witnessHex: string } -> { signedTxCbor, txHash }
 * Ghép witness chữ ký từ `wallet.signTx(unsignedTxCbor, true)` vào giao dịch của đơn hàng
 * bằng `@hydra-sdk/cardano-wasm` và kiểm tra tính toàn vẹn của `txHash`.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'shop:orders:witness', 20, 60_000)
  const account = requireSession(event)
  const orderId = String(getRouterParam(event, 'id') || '')
  const body = await readBody<{ witnessHex?: unknown }>(event)
  const res = attachWitnessForAccountOrder(account, orderId, body?.witnessHex)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return res
})

