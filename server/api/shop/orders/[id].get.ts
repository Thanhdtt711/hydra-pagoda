import { getSessionAccount, requireSession } from '../../../utils/wallet/auth'
import { getAccountOrder, inspectAndSettleTx, listAccountOrders, syncPendingOrdersFromChain } from '../../../utils/wallet/orders'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * GET /api/shop/orders/:id -> { order, account }
 * Kiểm tra trạng thái đơn hàng cụ thể và đồng bộ trạng thái xác nhận từ chuỗi.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'shop:orders:get', 60, 60_000)
  const account = await requireSession(event)
  const orderId = String(getRouterParam(event, 'id') || '')
  const row = await getAccountOrder(account, orderId)

  if (['signing', 'submitted', 'confirming'].includes(row.status)) {
    const hash = row.tx_hash || row.unsigned_tx_hash
    if (hash) {
      try {
        await inspectAndSettleTx(hash, { expectedOrderId: row.order_id })
      } catch { /* thử lại ở lần poll kế tiếp */ }
    } else {
      await syncPendingOrdersFromChain()
    }
  }

  const freshAccount = (await getSessionAccount(event)) ?? account
  const orders = await listAccountOrders(freshAccount, 50)
  const order = orders.find(o => o.orderId === orderId)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { order, account: freshAccount }
})

