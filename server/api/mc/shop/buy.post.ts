import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { releaseLantern } from '../../../utils/wallet/lanternService'
import { getAccountInventory, purchaseShopItem } from '../../../utils/wallet/mcService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/shop/buy
 * Body: { itemId: string, requestId: string, action?: 'release_lantern' }
 * Tiêu MC nguyên tử để mua Cổ phục 9 nước, Lễ vật & Nhang trầm hoặc mở khóa Thẻ bài Di sản.
 * Giá luôn lấy từ cấu hình server; idempotent theo requestId.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:shop:buy', 20, 60_000)
  const account = await requireSession(event)
  const body: { itemId?: unknown; requestId?: unknown; action?: unknown } =
    (await readBody<{ itemId?: unknown; requestId?: unknown; action?: unknown }>(event).catch(() => null)) || {}

  if (body.action === 'release_lantern') {
    const rel = await releaseLantern(account.id)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return {
      ok: true,
      remaining: rel.remaining,
      inventory: rel.inventory
    }
  }

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

