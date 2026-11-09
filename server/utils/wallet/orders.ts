/**
 * Dịch vụ Đơn mua MC coin bằng ADA (Bước 3):
 * - Tạo đơn mua MC (tối thiểu 2 ADA = 2.000.000 lovelace = 2.000 MC).
 * - Dựng giao dịch chưa ký & ghép witness chữ ký ví qua `@hydra-sdk/cardano-wasm`.
 * - Theo dõi và xác minh giao dịch trên chuỗi qua Blockfrost (polling & webhook).
 * - Chỉ cộng MC khi giao dịch gửi đúng địa chỉ treasury, đúng metadata `orderId`,
 *   số lovelace >= giá đơn, và đạt >= N xác nhận (1 trên Preprod, 3 trên Mainnet).
 * - Cộng MC và ghi sổ cái (`mc_ledger`) trong MỘT transaction SQLite nguyên tử,
 *   khóa idempotency bằng bảng `chain_deposits (tx_hash PRIMARY KEY)`.
 */
import { randomBytes } from 'node:crypto'
import { apiError, type PublicAccount } from './auth'
import { scheduleHydraRecordByRef } from '../hydra/hydraQueue'
import { getBlockfrostClient, type BlockfrostClient, type BfTxMetadatum } from './blockfrost'
import {
  getWalletConfig,
  LOVELACE_PER_ADA,
  LOVELACE_PER_MC,
  MAX_ORDER_ADA,
  MIN_ORDER_ADA,
  MIN_ORDER_LOVELACE,
  QUICK_ADA_PACKAGES
} from './config'
import { addressNetworkId, decodeBech32Address } from './cose'
import { getDb, withTransaction } from './db'
import { attachOrderWitness, buildOrderUnsignedTx } from './txBuilder'

export type OrderStatus =
  | 'pending'
  | 'signing'
  | 'submitted'
  | 'confirming'
  | 'completed'
  | 'expired'
  | 'underpaid'
  | 'expired_paid'
  | 'failed'

export interface PublicOrder {
  orderId: string
  accountId: number
  address: string
  treasuryAddress: string
  expectedLovelace: number
  expectedAda: number
  expectedMc: number
  receivedLovelace: number | null
  creditedMc: number | null
  txHash: string | null
  unsignedTxHash: string | null
  blockHeight: number | null
  confirmations: number
  confirmationsRequired: number
  status: OrderStatus
  failureReason: string | null
  createdAt: number
  expiresAt: number
  submittedAt: number | null
  completedAt: number | null
  explorerUrl: string | null
}

interface OrderRow {
  order_id: string
  account_id: number
  address: string
  treasury_address: string
  expected_lovelace: number
  expected_mc: number
  received_lovelace: number | null
  credited_mc: number | null
  unsigned_tx_hash: string | null
  unsigned_tx_cbor: string | null
  tx_hash: string | null
  block_height: number | null
  confirmations: number
  status: OrderStatus
  failure_reason: string | null
  created_at: number
  expires_at: number
  submitted_at: number | null
  completed_at: number | null
}

function explorerTxUrl(txHash: string | null, isTestnet: boolean): string | null {
  if (!txHash) return null
  const base = isTestnet ? 'https://preprod.cardanoscan.io' : 'https://cardanoscan.io'
  return `${base}/transaction/${txHash}`
}

function toPublicOrder(row: OrderRow): PublicOrder {
  const cfg = getWalletConfig()
  return {
    orderId: row.order_id,
    accountId: row.account_id,
    address: row.address,
    treasuryAddress: row.treasury_address,
    expectedLovelace: row.expected_lovelace,
    expectedAda: Math.floor(row.expected_lovelace / LOVELACE_PER_ADA),
    expectedMc: row.expected_mc,
    receivedLovelace: row.received_lovelace,
    creditedMc: row.credited_mc,
    txHash: row.tx_hash,
    unsignedTxHash: row.unsigned_tx_hash,
    blockHeight: row.block_height,
    confirmations: row.confirmations,
    confirmationsRequired: cfg.confirmationsRequired,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    explorerUrl: explorerTxUrl(row.tx_hash, cfg.isTestnet)
  }
}

/** Kiểm tra địa chỉ ví nhận (treasury) đã cấu hình và khớp mạng hiện tại. */
export function assertValidTreasuryAddress(): string {
  const cfg = getWalletConfig()
  if (!cfg.treasuryAddress) {
    apiError(500, 'treasury_unconfigured', 'Máy chủ chưa cấu hình địa chỉ ví nhận (TREASURY_ADDRESS)')
  }
  let bytes: Uint8Array
  try {
    bytes = decodeBech32Address(cfg.treasuryAddress)
  } catch {
    apiError(500, 'invalid_treasury_address', 'Địa chỉ TREASURY_ADDRESS trên máy chủ không đúng định dạng bech32')
  }
  if (addressNetworkId(bytes) !== cfg.networkId) {
    apiError(500, 'treasury_network_mismatch', 'Địa chỉ TREASURY_ADDRESS không khớp với mạng Cardano đang chạy')
  }
  return cfg.treasuryAddress
}

/** Đánh dấu các đơn chưa gửi giao dịch đã quá hạn 30 phút sang trạng thái `expired`. */
export function expireStaleOrders(now = Date.now()) {
  getDb()
    .prepare(
      `UPDATE mc_orders
          SET status = 'expired', failure_reason = COALESCE(failure_reason, 'Đơn hàng đã hết thời hạn 30 phút')
        WHERE status IN ('pending', 'signing') AND expires_at <= ?`
    )
    .run(now)
}

/**
 * Tạo đơn mua MC coin mới.
 * Chấp nhận `adaAmount` (số nguyên >= 2) hoặc `lovelace` (bội số của 1.000.000, >= 2.000.000).
 * Không bao giờ tin địa chỉ treasury hay số MC từ client gửi lên.
 */
export function createMcOrder(account: PublicAccount, input: { adaAmount?: unknown; lovelace?: unknown }): PublicOrder {
  const cfg = getWalletConfig()
  const treasuryAddress = assertValidTreasuryAddress()
  expireStaleOrders()

  let expectedLovelace = 0
  if (input.lovelace !== undefined && input.lovelace !== null) {
    const lv = Number(input.lovelace)
    if (!Number.isSafeInteger(lv) || lv < MIN_ORDER_LOVELACE || lv > MAX_ORDER_ADA * LOVELACE_PER_ADA || lv % LOVELACE_PER_ADA !== 0) {
      apiError(400, 'invalid_amount', `Số lượng mua phải là số nguyên từ ${MIN_ORDER_ADA} đến ${MAX_ORDER_ADA} ADA`)
    }
    expectedLovelace = lv
  } else {
    const ada = Number(input.adaAmount)
    if (!Number.isSafeInteger(ada) || ada < MIN_ORDER_ADA || ada > MAX_ORDER_ADA) {
      apiError(400, 'invalid_amount', `Số lượng mua phải là số nguyên từ ${MIN_ORDER_ADA} đến ${MAX_ORDER_ADA} ADA`)
    }
    expectedLovelace = ada * LOVELACE_PER_ADA
  }

  const expectedMc = Math.floor(expectedLovelace / LOVELACE_PER_MC)
  const now = Date.now()
  const expiresAt = now + cfg.orderTtlMs
  const orderId = `ord_${now.toString(36)}_${randomBytes(6).toString('hex')}`

  const db = getDb()
  db.prepare(
    `INSERT INTO mc_orders (
      order_id, account_id, address, treasury_address,
      expected_lovelace, expected_mc, confirmations, status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)`
  ).run(orderId, account.id, account.address, treasuryAddress, expectedLovelace, expectedMc, now, expiresAt)

  const row = db.prepare('SELECT * FROM mc_orders WHERE order_id = ?').get(orderId) as unknown as OrderRow
  return toPublicOrder(row)
}

/** Lấy chi tiết đơn hàng của người chơi (kiểm tra quyền sở hữu). */
export function getAccountOrder(account: PublicAccount, orderId: string): OrderRow {
  expireStaleOrders()
  if (typeof orderId !== 'string' || !/^ord_[a-z0-9_]{6,40}$/.test(orderId)) {
    apiError(404, 'order_not_found', 'Không tìm thấy đơn hàng')
  }
  const row = getDb().prepare('SELECT * FROM mc_orders WHERE order_id = ?').get(orderId) as unknown as OrderRow | undefined
  if (!row || row.account_id !== account.id) {
    apiError(404, 'order_not_found', 'Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập')
  }
  return row
}

/** Danh sách đơn mua MC & lịch sử nạp của tài khoản hiện tại. */
export function listAccountOrders(account: PublicAccount, limit = 25): PublicOrder[] {
  expireStaleOrders()
  const rows = getDb()
    .prepare('SELECT * FROM mc_orders WHERE account_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(account.id, Math.min(100, Math.max(1, limit))) as unknown as OrderRow[]
  return rows.map(toPublicOrder)
}

/**
 * Dựng giao dịch chưa ký cho đơn hàng bằng `@hydra-sdk/cardano-wasm`.
 * Lưu `unsigned_tx_hash` và `unsigned_tx_cbor` vào đơn để đối chiếu khi ví ký xong.
 */
export function buildOrderTxForAccount(
  account: PublicAccount,
  orderId: string,
  body: { utxos?: unknown; changeAddress?: unknown }
) {
  const cfg = getWalletConfig()
  const order = getAccountOrder(account, orderId)

  if (order.status === 'completed') {
    apiError(409, 'order_already_completed', 'Đơn hàng này đã hoàn tất')
  }
  if (order.status === 'expired' || Date.now() >= order.expires_at) {
    expireStaleOrders()
    apiError(410, 'order_expired', 'Đơn hàng đã hết hạn. Vui lòng tạo đơn mới.')
  }
  if (!['pending', 'signing'].includes(order.status)) {
    apiError(409, 'order_invalid_state', `Không thể dựng lại giao dịch khi đơn đang ở trạng thái ${order.status}`)
  }

  const utxosHex = Array.isArray(body?.utxos) ? body.utxos.map(String) : []
  const changeAddress = typeof body?.changeAddress === 'string' && body.changeAddress.trim()
    ? body.changeAddress.trim()
    : account.address

  const built = buildOrderUnsignedTx({
    orderId: order.order_id,
    ownerAddress: account.address,
    treasuryAddress: order.treasury_address,
    changeAddress,
    utxosHex,
    lovelace: order.expected_lovelace,
    metadataLabel: cfg.orderMetadataLabel
  })

  getDb()
    .prepare('UPDATE mc_orders SET status = ?, unsigned_tx_hash = ?, unsigned_tx_cbor = ? WHERE order_id = ?')
    .run('signing', built.txHash, built.unsignedTxCbor, order.order_id)

  const updated = getAccountOrder(account, order.order_id)
  return {
    order: toPublicOrder(updated),
    unsignedTxCbor: built.unsignedTxCbor,
    txHash: built.txHash,
    feeLovelace: built.feeLovelace
  }
}

/**
 * Ghép witness chữ ký từ `wallet.signTx(unsignedTxCbor, true)` vào giao dịch của đơn hàng.
 */
export function attachWitnessForAccountOrder(
  account: PublicAccount,
  orderId: string,
  witnessHex: unknown
): { signedTxCbor: string; txHash: string } {
  const order = getAccountOrder(account, orderId)
  if (!order.unsigned_tx_cbor) {
    apiError(400, 'order_not_built', 'Đơn hàng chưa được dựng giao dịch')
  }
  if (!['pending', 'signing', 'submitted'].includes(order.status)) {
    apiError(409, 'order_invalid_state', `Đơn hàng đang ở trạng thái ${order.status}`)
  }
  return attachOrderWitness(order.unsigned_tx_cbor, String(witnessHex ?? ''))
}

/**
 * Ghi nhận `txHash` sau khi ví đã `submitTx` lên mạng Cardano.
 * Lưu ý: bước này CHỈ chuyển trạng thái sang `'submitted'` (Đang chờ xác nhận),
 * TUYỆT ĐỐI chưa cộng MC cho tới khi kiểm tra trên chuỗi qua Blockfrost đạt đủ xác nhận!
 */
export function submitOrderTxHash(account: PublicAccount, orderId: string, txHashInput: unknown): PublicOrder {
  const order = getAccountOrder(account, orderId)
  if (order.status === 'completed') return toPublicOrder(order)

  const txHash = typeof txHashInput === 'string' ? txHashInput.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{64}$/.test(txHash)) {
    apiError(400, 'invalid_tx_hash', 'Mã giao dịch (txHash) phải gồm 64 ký tự hex')
  }

  if (order.unsigned_tx_hash && order.unsigned_tx_hash.toLowerCase() !== txHash) {
    apiError(400, 'tx_hash_mismatch', 'txHash gửi lên không khớp với giao dịch đã dựng cho đơn hàng này')
  }

  const db = getDb()
  const existing = db
    .prepare('SELECT order_id FROM mc_orders WHERE tx_hash = ? AND order_id != ?')
    .get(txHash, order.order_id) as { order_id: string } | undefined
  if (existing) {
    apiError(409, 'tx_hash_already_used', 'Mã giao dịch này đã được gắn với một đơn hàng khác')
  }

  const now = Date.now()
  db.prepare(
    `UPDATE mc_orders
        SET tx_hash = ?,
            status = CASE WHEN status IN ('pending', 'signing', 'expired') THEN 'submitted' ELSE status END,
            submitted_at = COALESCE(submitted_at, ?)
      WHERE order_id = ?`
  ).run(txHash, now, order.order_id)

  return toPublicOrder(getAccountOrder(account, order.order_id))
}

/** Trích xuất `orderId` từ danh sách metadata của giao dịch trên chuỗi. */
export function extractOrderIdFromMetadata(metadata: BfTxMetadatum[], preferredLabel: number): string | null {
  const labelStr = String(preferredLabel)
  for (const item of metadata) {
    if (item.label === labelStr && item.json && typeof item.json === 'object') {
      const obj = item.json as Record<string, unknown>
      if (typeof obj.orderId === 'string' && obj.orderId.startsWith('ord_')) {
        return obj.orderId
      }
    }
  }
  // Kiểm tra thêm CIP-20 (label 674) nếu có dạng "Order: ord_..."
  for (const item of metadata) {
    if (item.label === '674' && item.json && typeof item.json === 'object') {
      const msg = (item.json as { msg?: unknown }).msg
      if (Array.isArray(msg)) {
        for (const line of msg) {
          if (typeof line === 'string') {
            const m = line.match(/\b(ord_[a-z0-9_]{6,40})\b/)
            if (m) return m[1]!
          }
        }
      }
    }
  }
  return null
}

export interface SettleResult {
  txHash: string
  orderId: string | null
  action: 'not_found_on_chain' | 'ignored_self_spend' | 'unmatched_deposit' | 'confirming' | 'completed' | 'underpaid' | 'expired_paid' | 'already_processed' | 'metadata_mismatch'
  confirmations: number
  creditedMc: number
}

/**
 * Kiểm tra một giao dịch `txHash` trên chuỗi và (nếu đạt điều kiện) quyết toán đơn hàng.
 * Hàm này hoàn toàn idempotent: gọi lặp từ polling hay webhook đều không bao giờ cộng trùng.
 */
export async function inspectAndSettleTx(
  txHashRaw: string,
  opts?: { expectedOrderId?: string; tipHeight?: number; client?: BlockfrostClient }
): Promise<SettleResult> {
  const txHash = txHashRaw.trim().toLowerCase()
  const cfg = getWalletConfig()
  const client = opts?.client ?? getBlockfrostClient()
  const db = getDb()

  // Nếu txHash đã nằm trong bảng chain_deposits => đã xử lý xong trước đó (idempotent)
  const existingDeposit = db
    .prepare('SELECT order_id, mc_credited, confirmations, status FROM chain_deposits WHERE tx_hash = ?')
    .get(txHash) as { order_id: string | null; mc_credited: number; confirmations: number; status: string } | undefined
  if (existingDeposit) {
    return {
      txHash,
      orderId: existingDeposit.order_id,
      action: 'already_processed',
      confirmations: existingDeposit.confirmations,
      creditedMc: existingDeposit.mc_credited
    }
  }

  const info = await client.txInfo(txHash)
  const utxos = info ? await client.txUtxos(txHash) : null

  if (!info || !utxos) {
    // Nếu trước đó đơn từng ở trạng thái 'confirming' mà nay giao dịch biến mất khỏi chuỗi => Rollback (Reorg)
    const trackedOrder = db
      .prepare('SELECT * FROM mc_orders WHERE tx_hash = ?')
      .get(txHash) as unknown as OrderRow | undefined
    if (trackedOrder && trackedOrder.status === 'confirming') {
      console.warn(`[wallet:reorg] Giao dịch ${txHash} của đơn ${trackedOrder.order_id} không còn trên chuỗi (rollback trước khi đủ xác nhận). Đưa về submitted.`)
      db.prepare(
        `UPDATE mc_orders SET status = 'submitted', confirmations = 0, block_height = NULL WHERE order_id = ? AND status = 'confirming'`
      ).run(trackedOrder.order_id)
    }
    return { txHash, orderId: trackedOrder?.order_id ?? opts?.expectedOrderId ?? null, action: 'not_found_on_chain', confirmations: 0, creditedMc: 0 }
  }

  const tip = opts?.tipHeight ?? (await client.latestBlockHeight())
  const confirmations = Math.max(1, tip - info.blockHeight + 1)

  const metadata = await client.txMetadata(txHash)
  const metaOrderId = extractOrderIdFromMetadata(metadata, cfg.orderMetadataLabel)

  // Tìm đơn hàng khớp theo expectedOrderId, metadata orderId, hoặc tx_hash đã gắn
  let order: OrderRow | undefined
  if (opts?.expectedOrderId) {
    order = db.prepare('SELECT * FROM mc_orders WHERE order_id = ?').get(opts.expectedOrderId) as unknown as OrderRow | undefined
  }
  if (!order && metaOrderId) {
    order = db.prepare('SELECT * FROM mc_orders WHERE order_id = ?').get(metaOrderId) as unknown as OrderRow | undefined
  }
  if (!order) {
    order = db.prepare('SELECT * FROM mc_orders WHERE tx_hash = ? OR unsigned_tx_hash = ?').get(txHash, txHash) as unknown as OrderRow | undefined
  }

  const targetTreasury = order ? order.treasury_address : cfg.treasuryAddress
  // Bỏ qua nếu chính ví treasury là người gửi (chi tiêu nội bộ)
  if (utxos.inputs.some(i => i.address === targetTreasury)) {
    return { txHash, orderId: order?.order_id ?? null, action: 'ignored_self_spend', confirmations, creditedMc: 0 }
  }

  // Tổng số lovelace thực tế gửi vào địa chỉ treasury trong giao dịch này
  const receivedLovelace = utxos.outputs
    .filter(o => o.address === targetTreasury)
    .reduce((sum, o) => sum + Math.floor(o.lovelace), 0)

  // Nếu không khớp đơn hàng nào nhưng có tiền gửi vào treasury và đã đủ xác nhận -> ghi nhận unmatched để đối soát
  if (!order) {
    if (receivedLovelace > 0 && confirmations >= cfg.confirmationsRequired) {
      db.prepare(
        `INSERT INTO chain_deposits (tx_hash, order_id, account_id, lovelace, mc_credited, block_height, confirmations, status, note, created_at)
         VALUES (?, NULL, NULL, ?, 0, ?, ?, 'unmatched', 'Giao dịch tới treasury không có orderId hợp lệ', ?)
         ON CONFLICT(tx_hash) DO NOTHING`
      ).run(txHash, receivedLovelace, info.blockHeight, confirmations, Date.now())
      console.warn(`[wallet:unmatched] Phát hiện giao dịch ${txHash} gửi ${receivedLovelace} lovelace vào treasury nhưng không khớp đơn hàng nào`)
    }
    return { txHash, orderId: null, action: 'unmatched_deposit', confirmations, creditedMc: 0 }
  }

  // Bắt buộc kiểm tra metadata chứa đúng orderId của đơn hàng (chống lấy txHash của người khác / đơn khác gắn vào)
  if (!metaOrderId || metaOrderId !== order.order_id) {
    console.warn(`[wallet:metadata_mismatch] Giao dịch ${txHash} có metadata orderId=${metaOrderId ?? 'null'} không khớp với đơn ${order.order_id}`)
    return { txHash, orderId: order.order_id, action: 'metadata_mismatch', confirmations, creditedMc: 0 }
  }

  // Nếu chưa nhận được đồng nào tới địa chỉ treasury trong giao dịch này
  if (receivedLovelace <= 0) {
    return { txHash, orderId: order.order_id, action: 'unmatched_deposit', confirmations, creditedMc: 0 }
  }

  // Chưa đủ số xác nhận trên chuỗi -> chỉ cập nhật tiến độ 'confirming', CHƯA cộng MC
  if (confirmations < cfg.confirmationsRequired) {
    db.prepare(
      `UPDATE mc_orders
          SET tx_hash = ?,
              received_lovelace = ?,
              block_height = ?,
              confirmations = ?,
              status = CASE WHEN status IN ('pending', 'signing', 'submitted') THEN 'confirming' ELSE status END
        WHERE order_id = ?`
    ).run(txHash, receivedLovelace, info.blockHeight, confirmations, order.order_id)
    return { txHash, orderId: order.order_id, action: 'confirming', confirmations, creditedMc: 0 }
  }

  // ĐÃ ĐỦ SỐ XÁC NHẬN (>= confirmationsRequired): Quyết toán nguyên tử trong 1 transaction SQLite
  const now = Date.now()
  const blockTimeMs = info.blockTime > 0 ? info.blockTime * 1000 : now

  const settled = withTransaction((conn): SettleResult => {
    const freshOrder = conn.prepare('SELECT * FROM mc_orders WHERE order_id = ?').get(order!.order_id) as unknown as OrderRow
    if (freshOrder.status === 'completed') {
      return {
        txHash,
        orderId: freshOrder.order_id,
        action: 'already_processed',
        confirmations,
        creditedMc: freshOrder.credited_mc ?? 0
      }
    }

    // Trường hợp 1: Trả thiếu tiền (receivedLovelace < expected_lovelace)
    if (receivedLovelace < freshOrder.expected_lovelace) {
      const claim = conn.prepare(
        `INSERT INTO chain_deposits (tx_hash, order_id, account_id, lovelace, mc_credited, block_height, confirmations, status, note, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, 'underpaid', ?, ?)
         ON CONFLICT(tx_hash) DO NOTHING`
      ).run(
        txHash,
        freshOrder.order_id,
        freshOrder.account_id,
        receivedLovelace,
        info.blockHeight,
        confirmations,
        `Trả thiếu: nhận ${receivedLovelace} lovelace < yêu cầu ${freshOrder.expected_lovelace} lovelace`,
        now
      )
      if (Number(claim.changes) === 0) {
        return { txHash, orderId: freshOrder.order_id, action: 'already_processed', confirmations, creditedMc: 0 }
      }
      conn.prepare(
        `UPDATE mc_orders
            SET tx_hash = ?, received_lovelace = ?, credited_mc = 0, block_height = ?, confirmations = ?,
                status = 'underpaid', failure_reason = ?
          WHERE order_id = ?`
      ).run(
        txHash,
        receivedLovelace,
        info.blockHeight,
        confirmations,
        `Giao dịch chỉ gửi ${(receivedLovelace / LOVELACE_PER_ADA).toFixed(2)} ADA, thấp hơn mức yêu cầu ${(freshOrder.expected_lovelace / LOVELACE_PER_ADA).toFixed(0)} ADA. Đã ghi nhận chờ đối soát.`,
        freshOrder.order_id
      )
      console.warn(`[wallet:underpaid] Đơn ${freshOrder.order_id} trả thiếu: nhận ${receivedLovelace} < ${freshOrder.expected_lovelace} lovelace (tx=${txHash})`)
      return { txHash, orderId: freshOrder.order_id, action: 'underpaid', confirmations, creditedMc: 0 }
    }

    // Trường hợp 2: Đơn đã hết hạn TRƯỚC KHI thanh toán nhưng vẫn có tiền về -> ghi vào danh sách đối soát thủ công
    const paidAfterExpiry = freshOrder.status === 'expired' || (!freshOrder.submitted_at && blockTimeMs > freshOrder.expires_at)
    if (paidAfterExpiry) {
      const claim = conn.prepare(
        `INSERT INTO chain_deposits (tx_hash, order_id, account_id, lovelace, mc_credited, block_height, confirmations, status, note, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, 'expired_paid', 'Đơn hết hạn nhưng vẫn nhận được ADA - chờ đối soát thủ công', ?)
         ON CONFLICT(tx_hash) DO NOTHING`
      ).run(txHash, freshOrder.order_id, freshOrder.account_id, receivedLovelace, info.blockHeight, confirmations, now)
      if (Number(claim.changes) === 0) {
        return { txHash, orderId: freshOrder.order_id, action: 'already_processed', confirmations, creditedMc: 0 }
      }
      conn.prepare(
        `UPDATE mc_orders
            SET tx_hash = ?, received_lovelace = ?, credited_mc = 0, block_height = ?, confirmations = ?,
                status = 'expired_paid', failure_reason = ?
          WHERE order_id = ?`
      ).run(
        txHash,
        receivedLovelace,
        info.blockHeight,
        confirmations,
        'Đơn hàng đã hết hạn trước khi giao dịch được gửi nhưng vẫn có ADA về ví chùa. Đã đưa vào danh sách đối soát thủ công.',
        freshOrder.order_id
      )
      console.warn(`[wallet:expired_paid] Đơn ${freshOrder.order_id} đã hết hạn nhưng nhận ${receivedLovelace} lovelace (tx=${txHash}) -> chờ đối soát thủ công`)
      return { txHash, orderId: freshOrder.order_id, action: 'expired_paid', confirmations, creditedMc: 0 }
    }

    // Trường hợp 3: Hợp lệ (đúng hoặc thừa ADA) -> tính MC theo số lovelace thực nhận (1 MC = 1.000 lovelace)
    const creditedMc = Math.floor(receivedLovelace / LOVELACE_PER_MC)

    // Bước 3.1: Claim tx_hash trong chain_deposits (PRIMARY KEY chống cộng trùng tuyệt đối)
    const claim = conn.prepare(
      `INSERT INTO chain_deposits (tx_hash, order_id, account_id, lovelace, mc_credited, block_height, confirmations, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'credited', ?, ?)
       ON CONFLICT(tx_hash) DO NOTHING`
    ).run(
      txHash,
      freshOrder.order_id,
      freshOrder.account_id,
      receivedLovelace,
      creditedMc,
      info.blockHeight,
      confirmations,
      receivedLovelace > freshOrder.expected_lovelace ? 'Trả thừa: cộng theo số lovelace thực nhận' : null,
      now
    )
    if (Number(claim.changes) === 0) {
      return { txHash, orderId: freshOrder.order_id, action: 'already_processed', confirmations, creditedMc: 0 }
    }

    // Bước 3.2: Cộng số dư MC vào tài khoản
    conn.prepare('UPDATE accounts SET mc_balance = mc_balance + ? WHERE id = ?').run(creditedMc, freshOrder.account_id)
    const accRow = conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(freshOrder.account_id) as { mc_balance: number }

    // Bước 3.3: Ghi sổ cái bất biến (mc_ledger)
    conn.prepare(
      `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
       VALUES (?, ?, ?, 'deposit_ada', 'order', ?, ?, ?, ?)`
    ).run(
      freshOrder.account_id,
      creditedMc,
      accRow.mc_balance,
      freshOrder.order_id,
      txHash,
      JSON.stringify({
        orderId: freshOrder.order_id,
        expectedLovelace: freshOrder.expected_lovelace,
        receivedLovelace,
        blockHeight: info.blockHeight,
        confirmations
      }),
      now
    )

    // Bước 3.4: Đánh dấu đơn hàng hoàn tất
    conn.prepare(
      `UPDATE mc_orders
          SET tx_hash = ?, received_lovelace = ?, credited_mc = ?, block_height = ?,
              confirmations = ?, status = 'completed', failure_reason = NULL, completed_at = ?
        WHERE order_id = ?`
    ).run(txHash, receivedLovelace, creditedMc, info.blockHeight, confirmations, now, freshOrder.order_id)

    console.log(`[wallet:completed] Đơn ${freshOrder.order_id} hoàn tất: +${creditedMc} MC từ ${receivedLovelace} lovelace (tx=${txHash})`)
    return { txHash, orderId: freshOrder.order_id, action: 'completed', confirmations, creditedMc }
  })

  // Hybrid Hydra L2: sau khi SQLite commit bút toán deposit_ada, phản chiếu lên Hydra Head (không chặn, không ném lỗi).
  if (settled.action === 'completed' && settled.orderId) {
    void scheduleHydraRecordByRef('deposit_ada', settled.orderId)
  }
  return settled
}

let isPollingChain = false
let lastChainSyncAt = 0
const MIN_CHAIN_SYNC_INTERVAL_MS = 8_000 // Tối đa 1 lần quét chuỗi mỗi 8 giây

/**
 * Quét đồng bộ tất cả các đơn đang chờ xác nhận (`submitted`, `confirming`) và các giao dịch mới
 * tại địa chỉ `treasuryAddress` qua Blockfrost/Koios.
 * Hỗ trợ trường hợp người chơi đóng tab ngay sau khi ví submitTx (thậm chí trước khi gửi txHash về server):
 * chỉ cần giao dịch lên chuỗi có metadata `orderId`, hàm quét địa chỉ treasury sẽ tự tìm thấy và cộng MC!
 */
export async function syncPendingOrdersFromChain(opts?: { client?: BlockfrostClient; force?: boolean }): Promise<SettleResult[]> {
  if (isPollingChain) return []
  const now = Date.now()
  if (!opts?.force && now - lastChainSyncAt < MIN_CHAIN_SYNC_INTERVAL_MS) {
    return []
  }
  isPollingChain = true
  lastChainSyncAt = now
  try {
    expireStaleOrders()
    const cfg = getWalletConfig()
    const client = opts?.client ?? getBlockfrostClient()

    const tip = await client.latestBlockHeight()
    if (tip <= 0) {
      // Không đọc được block height từ tip (hoặc đang tạm ngưng do rate limit), bỏ qua nhịp này
      return []
    }
    const results: SettleResult[] = []
    const checkedHashes = new Set<string>()

    // 1. Kiểm tra các đơn đã có tx_hash hoặc unsigned_tx_hash đang ở trạng thái chờ
    const pendingRows = getDb()
      .prepare(
        `SELECT order_id, tx_hash, unsigned_tx_hash FROM mc_orders
          WHERE status IN ('signing', 'submitted', 'confirming')
            AND (tx_hash IS NOT NULL OR unsigned_tx_hash IS NOT NULL)`
      )
      .all() as Array<{ order_id: string; tx_hash: string | null; unsigned_tx_hash: string | null }>

    for (const r of pendingRows) {
      const hash = (r.tx_hash || r.unsigned_tx_hash || '').toLowerCase()
      if (!hash || checkedHashes.has(hash)) continue
      checkedHashes.add(hash)
      const res = await inspectAndSettleTx(hash, { expectedOrderId: r.order_id, tipHeight: tip, client })
      results.push(res)
    }

    // 2. Quét danh sách giao dịch gần nhất tới địa chỉ treasury (bắt cả đơn đóng tab giữa chừng hoặc đơn hết hạn vẫn trả tiền)
    if (cfg.treasuryAddress) {
      const addrTxs = await client.addressTransactions(cfg.treasuryAddress, { count: 30, order: 'desc' })
      for (const t of [...addrTxs].reverse()) {
        const hash = t.txHash.toLowerCase()
        if (checkedHashes.has(hash)) continue
        checkedHashes.add(hash)
        const res = await inspectAndSettleTx(hash, { tipHeight: tip, client })
        results.push(res)
      }
    }

    return results
  } catch (e: any) {
    const msg = e?.message || String(e)
    if (msg.includes('429')) {
      console.warn('[wallet:poll] Tạm dừng quét chuỗi: Nhà cung cấp đang giới hạn tần suất (HTTP 429). Hệ thống sẽ tự hạ nhiệt và thử lại sau.')
    } else {
      console.warn('[wallet:poll] Lỗi khi đồng bộ giao dịch từ nhà cung cấp chuỗi:', msg)
    }
    return []
  } finally {
    isPollingChain = false
  }
}

/** Lấy thông tin cấu hình gói nạp để hiển thị trên UI. */
export function getShopOrderPackagesInfo() {
  const cfg = getWalletConfig()
  return {
    network: cfg.network,
    isTestnet: cfg.isTestnet,
    treasuryAddress: cfg.treasuryAddress,
    isDefaultTestnetTreasury: cfg.isDefaultTestnetTreasury,
    confirmationsRequired: cfg.confirmationsRequired,
    lovelacePerAda: LOVELACE_PER_ADA,
    mcPerAda: 1_000,
    lovelacePerMc: LOVELACE_PER_MC,
    minAda: MIN_ORDER_ADA,
    maxAda: MAX_ORDER_ADA,
    quickPackagesAda: [...QUICK_ADA_PACKAGES],
    estimatedNetworkFeeAda: 0.2
  }
}

