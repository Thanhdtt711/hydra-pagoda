import { randomBytes } from 'node:crypto'
import { apiError, assertSameOrigin, requireSession } from '../../../../utils/wallet/auth'
import { getWalletConfig } from '../../../../utils/wallet/config'
import { getDb } from '../../../../utils/wallet/db'
import { rateLimit } from '../../../../utils/wallet/rateLimit'
import { getCardById } from '../../../../utils/cards/catalog'
import { buildCip68MintUnsignedTx } from '../../../../utils/cards/cip68Mint'
import { savePendingMint } from '../../../../utils/cards/mintSessionStore'

/**
 * POST /api/mc/cards/mint/build
 * Body: { cardId: string, utxos: Array<string | DecodedUtxo>, changeAddress?: string }
 * Kiểm tra người chơi thực sự sở hữu Thẻ Bài Di Sản này trong `card_inventory` (hoặc thẻ khởi đầu),
 * chưa mint NFT CIP-68, rồi dựng giao dịch Cardano L1 Mint CIP-68 (Reference 100 + User 222).
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:cards:mint:build', 12, 60_000)
  const account = await requireSession(event)
  const body = (await readBody<Record<string, any>>(event).catch(() => null)) || {}

  const cardId = String(body.cardId || '').trim()
  const card = getCardById(cardId)
  if (!card) {
    apiError(404, 'card_not_found', 'Thẻ Bài Di Sản không tồn tại trong danh mục')
  }

  const utxos = Array.isArray(body.utxos) ? body.utxos : []
  if (utxos.length === 0) {
    apiError(400, 'empty_utxos', 'Ví của bạn chưa có UTxO tADA/ADA để thực hiện đúc NFT CIP-68')
  }

  const db = await getDb()

  // Kiểm tra người chơi đã sở hữu bản sao chưa mint của thẻ này trong card_inventory chưa
  let row = await db.prepare(`
    SELECT id, is_nft_minted, nft_asset_id
    FROM card_inventory
    WHERE account_id = ? AND card_id = ?
    ORDER BY is_nft_minted ASC, id ASC
    LIMIT 1
  `).get(account.id, cardId) as { id: number; is_nft_minted: number; nft_asset_id: string | null } | undefined

  // Nếu người chơi sở hữu thẻ qua account_inventory (ví dụ thẻ mặc định / quà streak) mà chưa có dòng trong card_inventory, đồng bộ sang
  if (!row) {
    const starterCards = new Set(['card_vn_motcot', 'card_vn_truclam', 'card_jp_ichigo'])
    const invRow = await db.prepare(`
      SELECT id FROM account_inventory WHERE account_id = ? AND item_id = ? AND quantity > 0
    `).get(account.id, cardId) as { id: number } | undefined

    if (invRow || starterCards.has(cardId)) {
      const now = Date.now()
      const inserted = await db.prepare(`
        INSERT INTO card_inventory (account_id, card_id, rarity, unlocked_at, is_nft_minted, nft_asset_id)
        VALUES (?, ?, ?, ?, 0, NULL)
      `).run(account.id, card.id, card.rarity, now)
      row = { id: inserted.lastInsertRowid, is_nft_minted: 0, nft_asset_id: null }
    }
  }

  if (!row) {
    apiError(403, 'card_not_owned', 'Bạn cần sở hữu (khai quang) thẻ bài này trước khi đúc NFT CIP-68.')
  }

  if (row.is_nft_minted === 1 && row.nft_asset_id) {
    apiError(409, 'already_minted', 'Thẻ Bài Di Sản này đã được đúc thành NFT CIP-68 trên Cardano.')
  }

  const cfg = getWalletConfig()
  const referenceAddress = cfg.treasuryAddress
  if (!referenceAddress) {
    apiError(500, 'treasury_unconfigured', 'Chưa cấu hình địa chỉ lưu trữ Reference Token (NUXT_TREASURY_ADDRESS)')
  }

  const reqHost = getRequestHeader(event, 'host') || 'hydra-pagoda.onrender.com'
  const reqProto = getRequestHeader(event, 'x-forwarded-proto') || (reqHost.includes('localhost') || reqHost.includes('127.0.0.1') ? 'http' : 'https')
  const imageBaseUrl = reqHost.includes('localhost') || reqHost.includes('127.0.0.1')
    ? 'https://hydra-pagoda.onrender.com'
    : `${reqProto}://${reqHost}`

  const built = await buildCip68MintUnsignedTx({
    card,
    serialNo: row.id,
    ownerAddress: account.address,
    changeAddress: typeof body.changeAddress === 'string' && body.changeAddress.trim() ? body.changeAddress.trim() : account.address,
    referenceAddress,
    imageBaseUrl,
    utxos
  })

  const mintId = `mint_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
  savePendingMint({
    mintId,
    accountId: account.id,
    cardInventoryId: row.id,
    cardId: card.id,
    serialNo: row.id,
    unsignedTxCbor: built.unsignedTxCbor,
    txHash: built.txHash,
    policyId: built.policyId,
    refAssetId: built.refAssetId,
    userAssetId: built.userAssetId,
    createdAt: Date.now()
  })

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    mintId,
    cardId: card.id,
    serialNo: row.id,
    unsignedTxCbor: built.unsignedTxCbor,
    txHash: built.txHash,
    feeLovelace: built.feeLovelace,
    policyId: built.policyId,
    refAssetId: built.refAssetId,
    userAssetId: built.userAssetId,
    network: cfg.network
  }
})
