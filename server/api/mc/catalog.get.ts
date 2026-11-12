import { getSessionAccount } from '../../utils/wallet/auth'
import { getMcOverviewAndHistory } from '../../utils/wallet/mcService'
import { rateLimit } from '../../utils/wallet/rateLimit'

/**
 * GET /api/mc/catalog
 * Trả về cấu hình dịch vụ tiêu MC, danh mục Cửa Hàng/Di Sản, giá các cấp độ Bói Quẻ,
 * mức gợi ý Hòm Công Đức, bảng vàng công đức và kho đồ/lịch sử của tài khoản đang đăng nhập.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'mc:catalog', 60, 60_000)
  const account = await getSessionAccount(event)
  const data = await getMcOverviewAndHistory(account?.id ?? null)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    authenticated: Boolean(account),
    account,
    ...data
  }
})

