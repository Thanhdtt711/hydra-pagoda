import { getSessionAccount, requireSession } from '../../../utils/wallet/auth'
import { getShopOrderPackagesInfo, listAccountOrders, syncPendingOrdersFromChain } from '../../../utils/wallet/orders'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * GET /api/shop/orders -> { orders, packages, account }
 * Trả về danh sách đơn mua MC và cấu hình gói nạp; tự động đồng bộ các đơn đang chờ trên chuỗi
 * (kể cả khi người chơi đóng trang giữa chừng rồi mở lại).
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'shop:orders:list', 60, 60_000)
  const account = await requireSession(event)
  const initialOrders = await listAccountOrders(account, 30)
  if (initialOrders.some(o => ['signing', 'submitted', 'confirming'].includes(o.status))) {
    await syncPendingOrdersFromChain()
  }
  const freshAccount = (await getSessionAccount(event)) ?? account
  const orders = await listAccountOrders(freshAccount, 30)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    orders,
    packages: getShopOrderPackagesInfo(),
    account: freshAccount
  }
})

