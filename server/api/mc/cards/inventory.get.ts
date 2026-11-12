import { getSessionAccount } from '../../../utils/wallet/auth'
import { getUserCardInventory } from '../../../utils/wallet/mcService'
import { getCardPacks, getCardsCatalog } from '../../../utils/cards/catalog'

/**
 * GET /api/mc/cards/inventory
 * Trả về danh mục thẻ, các gói Gacha và danh sách thẻ người chơi đã sở hữu.
 * Hỗ trợ cả khách chưa kết nối ví.
 */
export default defineEventHandler(async (event) => {
  const account = await getSessionAccount(event)
  const userInventory = account ? await getUserCardInventory(account.id) : []
  const packs = getCardPacks()
  const catalog = getCardsCatalog()

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    accountId: account?.id ?? null,
    userInventory,
    packs,
    catalog
  }
})

