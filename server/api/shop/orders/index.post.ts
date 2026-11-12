import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { createMcOrder } from '../../../utils/wallet/orders'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/shop/orders  { adaAmount } hoặc { lovelace } -> { order }
 * Tạo đơn mua MC coin bằng ADA (tối thiểu 2 ADA = 2.000 MC).
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'shop:orders:create', 15, 60_000)
  const account = await requireSession(event)
  const body = await readBody<{ adaAmount?: unknown; lovelace?: unknown }>(event)
  const order = await createMcOrder(account, body ?? {})
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { order }
})

