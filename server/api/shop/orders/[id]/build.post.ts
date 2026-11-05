import { assertSameOrigin, requireSession } from '../../../../utils/wallet/auth'
import { buildOrderTxForAccount } from '../../../../utils/wallet/orders'
import { rateLimit } from '../../../../utils/wallet/rateLimit'

/**
 * POST /api/shop/orders/:id/build  { utxos: string[], changeAddress?: string }
 * Dựng giao dịch Cardano L1 chưa ký bằng `@hydra-sdk/cardano-wasm` & `@hydra-sdk/core`,
 * trả đúng số lovelace tới địa chỉ treasury của server kèm metadata `orderId`.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'shop:orders:build', 20, 60_000)
  const account = requireSession(event)
  const orderId = String(getRouterParam(event, 'id') || '')
  const body = await readBody<{ utxos?: unknown; changeAddress?: unknown }>(event)
  const res = buildOrderTxForAccount(account, orderId, body ?? {})
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return res
})

