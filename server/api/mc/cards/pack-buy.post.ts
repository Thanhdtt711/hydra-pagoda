import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { buyAndOpenCardPack, getUserCardInventory, getAccountInventory } from '../../../utils/wallet/mcService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/cards/pack-buy
 * Body: { packId: string, requestId: string }
 * Tiêu MC để mở gói thẻ bài di sản Gacha (Hộp Mù).
 * Idempotent theo requestId, tích hợp Hydra L2 Proof.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:cards:pack-buy', 20, 60_000)
  const account = await requireSession(event)
  const body: { packId?: unknown; requestId?: unknown } = (await readBody<{ packId?: unknown; requestId?: unknown }>(event).catch(() => null)) || {}

  const packId = String(body.packId ?? '').trim()
  const requestId = String(body.requestId ?? '').trim()

  const res = await buyAndOpenCardPack(account.id, packId, requestId)

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    idempotentReplay: res.idempotentReplay,
    ledgerId: res.ledgerId,
    spentMc: res.spentMc,
    mcBalance: res.balanceAfter,
    hydra: await getHydraProof(res.ledgerId),
    pack: res.extra.pack,
    cards: res.extra.cards,
    receiptHash: res.extra.receiptHash,
    openedAt: res.extra.openedAt,
    userCardInventory: await getUserCardInventory(account.id),
    inventory: await getAccountInventory(account.id)
  }
})

