import { apiError } from '../../../utils/wallet/auth'
import { getWalletConfig } from '../../../utils/wallet/config'
import { inspectAndSettleTx, type SettleResult } from '../../../utils/wallet/orders'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/shop/webhook/blockfrost
 * Nhận thông báo giao dịch mới từ Blockfrost Webhook (hoặc bộ đồng bộ nội bộ).
 * Hoàn toàn idempotent: gửi lại cùng một txHash nhiều lần không bao giờ cộng trùng MC.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'shop:webhook', 120, 60_000)
  const cfg = getWalletConfig()

  if (cfg.webhookSecret) {
    const token = getRequestHeader(event, 'x-webhook-secret') || getRequestHeader(event, 'signature') || ''
    if (token !== cfg.webhookSecret) {
      apiError(401, 'bad_webhook_secret', 'Webhook secret không hợp lệ')
    }
  }

  const body = await readBody<{
    txHash?: unknown
    orderId?: unknown
    payload?: Array<{ tx?: { hash?: string }; hash?: string }>
  }>(event)

  const txHashes = new Set<string>()
  if (typeof body?.txHash === 'string' && /^[0-9a-fA-F]{64}$/.test(body.txHash.trim())) {
    txHashes.add(body.txHash.trim().toLowerCase())
  }
  if (Array.isArray(body?.payload)) {
    for (const item of body.payload) {
      const h = item?.tx?.hash || item?.hash
      if (typeof h === 'string' && /^[0-9a-fA-F]{64}$/.test(h.trim())) {
        txHashes.add(h.trim().toLowerCase())
      }
    }
  }

  if (txHashes.size === 0) {
    apiError(400, 'missing_tx_hash', 'Không có txHash hợp lệ trong payload webhook')
  }

  const expectedOrderId = typeof body?.orderId === 'string' ? body.orderId : undefined
  const results: SettleResult[] = []
  for (const hash of txHashes) {
    results.push(await inspectAndSettleTx(hash, { expectedOrderId }))
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, results }
})

