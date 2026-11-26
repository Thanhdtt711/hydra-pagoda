import { apiError, assertSameOrigin, requireSession } from '../../../../utils/wallet/auth'
import { rateLimit } from '../../../../utils/wallet/rateLimit'
import { cosignCip68MintTx } from '../../../../utils/cards/cip68Mint'
import { getPendingMint } from '../../../../utils/cards/mintSessionStore'

/**
 * POST /api/mc/cards/mint/cosign
 * Body: { mintId: string, witnessHex: string }
 * Xác minh chữ ký từ ví người chơi, đồng ký thêm Policy Key của server + gắn NativeScript
 * và trả về `signedTxCbor` hoàn chỉnh để ví phát tán lên Cardano L1 (`submitTx`).
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:cards:mint:cosign', 15, 60_000)
  const account = await requireSession(event)
  const body = (await readBody<Record<string, any>>(event).catch(() => null)) || {}

  const mintId = String(body.mintId || '').trim()
  const witnessHex = String(body.witnessHex || '').trim()
  if (!mintId || !witnessHex) {
    apiError(400, 'missing_fields', 'Thiếu mintId hoặc witnessHex chữ ký giao dịch')
  }

  const session = getPendingMint(mintId)
  if (!session || session.accountId !== account.id) {
    apiError(404, 'mint_session_expired', 'Phiên đúc NFT đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.')
  }

  const signed = await cosignCip68MintTx(session.unsignedTxCbor, witnessHex)

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    mintId,
    signedTxCbor: signed.signedTxCbor,
    txHash: signed.txHash,
    policyId: session.policyId,
    refAssetId: session.refAssetId,
    userAssetId: session.userAssetId
  }
})
