import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { getAccountInventory, purchaseShopItem } from '../../../utils/wallet/mcService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/shop/buy
 * Body: { itemId: string, requestId: string }
 * Tiêu MC nguyên tử để mua Cổ phục 9 nước, Lễ vật & Nhang trầm hoặc mở khóa Thẻ bài Di sản.
 * Giá luôn lấy từ cấu hình server; idempotent theo requestId.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:shop:buy', 20, 60_000)
  const account = await requireSession(event)
  const body: { itemId?: unknown; requestId?: unknown } = (await readBody<{ itemId?: unknown; requestId?: unknown }>(event).catch(() => null)) || {}

  const res = await purchaseShopItem(
    account.id,
    String(body.itemId ?? ''),
    String(body.requestId ?? '')
  )

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    idempotentReplay: res.idempotentReplay,
    ledgerId: res.ledgerId,
    spentMc: res.spentMc,
    mcBalance: res.balanceAfter,
    hydra: await getHydraProof(res.ledgerId),
    item: res.extra.item,
    quantity: res.extra.quantity,
    unlockedAt: res.extra.unlockedAt,
    inventory: await getAccountInventory(account.id)
  }
})

