import { getBlockfrostClient } from '../../../../utils/wallet/blockfrost'

/**
 * GET /api/mc/cards/mint/status?txHash=...
 * Kiểm tra giao dịch đúc NFT CIP-68 đã được đưa vào block trên Cardano L1 (Blockfrost / Koios) hay chưa.
 * Giúp UI hiển thị trạng thái xoay chờ (đang lên chuỗi) rồi mới mở khóa nút "Xem NFT CIP-68" trên Cardanoscan.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event)
  const txHash = String(q.txHash || '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(txHash)) {
    return { ok: false, confirmed: false, blockHeight: null }
  }

  try {
    const bf = getBlockfrostClient()
    const info = await bf.txInfo(txHash)
    if (info && info.blockHeight > 0) {
      return {
        ok: true,
        confirmed: true,
        blockHeight: info.blockHeight,
        blockTime: info.blockTime
      }
    }
    return { ok: true, confirmed: false, blockHeight: null }
  } catch {
    return { ok: true, confirmed: false, blockHeight: null }
  }
})
