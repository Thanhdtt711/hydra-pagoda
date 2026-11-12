import { assertSameOrigin, getSessionAccount, requireSession } from '../../../../utils/wallet/auth'
import { getWalletConfig } from '../../../../utils/wallet/config'
import { inspectAndSettleTx, submitOrderTxHash } from '../../../../utils/wallet/orders'
import { rateLimit } from '../../../../utils/wallet/rateLimit'

/**
 * POST /api/shop/orders/:id/submit  { txHash: string } -> { order, account }
 * Ghi nhận `txHash` sau khi ví đã `submitTx` lên chuỗi; kiểm tra ngay trên chuỗi nếu đã có.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'shop:orders:submit', 20, 60_000)
  const account = await requireSession(event)
  const orderId = String(getRouterParam(event, 'id') || '')
  const body = await readBody<{ txHash?: unknown }>(event)
  let order = await submitOrderTxHash(account, orderId, body?.txHash)

  if (order.txHash && getWalletConfig().blockfrostApiKey) {
    try {
      await inspectAndSettleTx(order.txHash, { expectedOrderId: order.orderId })
      order = await submitOrderTxHash(account, orderId, order.txHash)
    } catch { /* giao dịch vừa gửi có thể chưa lên block ngay, sẽ được poller cập nhật */ }
  }

  const freshAccount = (await getSessionAccount(event)) ?? account
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { order, account: freshAccount }
})

