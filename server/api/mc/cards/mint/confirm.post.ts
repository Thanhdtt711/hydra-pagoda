import { apiError, assertSameOrigin, requireSession } from '../../../../utils/wallet/auth'
import { getWalletConfig } from '../../../../utils/wallet/config'
import { getDb } from '../../../../utils/wallet/db'
import { rateLimit } from '../../../../utils/wallet/rateLimit'
import { getUserCardInventory } from '../../../../utils/wallet/mcService'
import { deletePendingMint, getPendingMint } from '../../../../utils/cards/mintSessionStore'

/**
 * POST /api/mc/cards/mint/confirm
 * Body: { mintId: string, txHash: string }
 * Ghi nhận giao dịch Mint CIP-68 đã phát tán lên Cardano L1, cập nhật `card_inventory.is_nft_minted = 1`
 * và lưu `nft_asset_id` (định dạng `<userAssetId>|<txHash>` để dễ tra cứu trên Cardanoscan).
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:cards:mint:confirm', 15, 60_000)
  const account = await requireSession(event)
  const body = (await readBody<Record<string, any>>(event).catch(() => null)) || {}

  const mintId = String(body.mintId || '').trim()
  const txHash = String(body.txHash || '').trim().toLowerCase()
  if (!mintId || !/^[0-9a-f]{64}$/.test(txHash)) {
    apiError(400, 'invalid_tx_hash', 'Mã giao dịch txHash không hợp lệ')
  }

  const session = getPendingMint(mintId)
  if (!session || session.accountId !== account.id) {
    apiError(404, 'mint_session_expired', 'Phiên đúc NFT đã hết hạn hoặc không tìm thấy')
  }

  if (session.txHash.toLowerCase() !== txHash) {
    apiError(400, 'tx_hash_mismatch', 'txHash gửi lên không khớp với giao dịch đúc NFT đã tạo')
  }

  const db = await getDb()
  const storedAssetValue = `${session.userAssetId}|${txHash}`
  await db.prepare(`
    UPDATE card_inventory
    SET is_nft_minted = 1, nft_asset_id = ?
    WHERE id = ? AND account_id = ?
  `).run(storedAssetValue, session.cardInventoryId, account.id)

  deletePendingMint(mintId)

  const cfg = getWalletConfig()
  const userCardInventory = await getUserCardInventory(account.id)
  const explorerBase = cfg.network === 'mainnet' ? 'https://cardanoscan.io' : 'https://preprod.cardanoscan.io'

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    cardId: session.cardId,
    txHash,
    policyId: session.policyId,
    refAssetId: session.refAssetId,
    userAssetId: session.userAssetId,
    txUrl: `${explorerBase}/transaction/${txHash}`,
    tokenUrl: `${explorerBase}/token/${session.userAssetId}`,
    userCardInventory
  }
})
