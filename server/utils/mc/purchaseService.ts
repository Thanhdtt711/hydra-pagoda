/**
 * Dịch vụ báo giá (Quote 60s) và mua MC theo bậc giá bằng ADA.
 * - Giá do backend quyết định 100% từ `mc_fund_state.sale_sold` (client không bao giờ gửi giá).
 * - Chống replay / double-credit bằng UNIQUE(tx_hash) và UNIQUE(quote_id).
 * - Chống race condition bằng giao dịch nguyên tử `withTransaction` + cập nhật có điều kiện `sale_sold + ? <= MC_SALE_POOL`.
 */
import { randomBytes } from 'node:crypto'
import {
  BUY_MIN_LOVELACE,
  LOVELACE_PER_ADA,
  MC_SALE_POOL,
  QUOTE_TTL_MS,
  TIER_PRICES_LOVELACE,
  TIER_SIZE
} from '../../../lib/mc/tokenomics'
import { getTierState, quoteByLovelace, quoteByMc, QuoteError, salePercent, type QuoteSegment } from '../../../lib/mc/pricing'
import { apiError, type PublicAccount } from '../wallet/auth'
import { getWalletConfig } from '../wallet/config'
import { getDb, onAfterCommit, withTransaction } from '../wallet/db'
import { getBlockfrostClient } from '../wallet/blockfrost'
import { scheduleHydraRecord } from '../hydra/hydraQueue'

const TX_HASH_RE = /^[0-9a-f]{64}$/i

export interface McMarketInfo {
  salePool: string
  saleSold: string
  saleRemaining: string
  salePercent: number
  tierNumber: number
  priceLovelace: string
  remainingInTier: string
  soldOut: boolean
  minAda: number
  minLovelace: string
  quoteTtlMs: number
  treasuryAddress: string
  tiers: Array<{
    tierNumber: number
    priceLovelace: string
    mcPerAda: number
    startMc: string
    endMc: string
  }>
}

export interface McQuoteDto {
  quoteId: string
  mode: 'ada' | 'mc'
  totalMc: string
  totalLovelace: string
  unusedLovelace: string
  tierNumber: number
  saleSoldSnapshot: string
  segments: Array<{ tierNumber: number; mc: string; priceLovelace: string; lovelace: string }>
  treasuryAddress: string
  status: string
  createdAt: number
  expiresAt: number
}

export interface VerifiedPaymentTx {
  senderAddress: string
  receiverAddress: string
  lovelacePaid: bigint
  confirmations: number
}

export interface SettlePurchaseResult {
  purchaseId: number
  quoteId: string
  txHash: string
  status: 'confirming' | 'settled'
  mcAmount: string
  lovelacePaid: string
  newBalance: number
  idempotentReplay: boolean
}

function serializeSegments(segments: QuoteSegment[]) {
  return segments.map((s) => ({
    tierNumber: s.tierNumber,
    mc: s.mc.toString(),
    priceLovelace: s.priceLovelace.toString(),
    lovelace: s.lovelace.toString()
  }))
}

function parseBigIntPositive(raw: unknown, label: string): bigint {
  if (typeof raw === 'bigint') {
    if (raw > 0n) return raw
    apiError(400, 'invalid_amount', `${label} phải là số nguyên dương`)
  }
  if (typeof raw === 'number') {
    if (Number.isSafeInteger(raw) && raw > 0) return BigInt(raw)
    apiError(400, 'invalid_amount', `${label} phải là số nguyên dương`)
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const v = BigInt(raw.trim())
    if (v > 0n) return v
  }
  apiError(400, 'invalid_amount', `${label} phải là số nguyên dương`)
}

export async function getMcMarketInfo(): Promise<McMarketInfo> {
  const db = await getDb()
  const cfg = getWalletConfig()
  const row = (await db.prepare('SELECT sale_sold FROM mc_fund_state WHERE id = 1').get()) as { sale_sold: number } | undefined
  const saleSold = BigInt(row?.sale_sold ?? 0)
  const tier = getTierState(saleSold)

  const tiers = TIER_PRICES_LOVELACE.map((price, idx) => ({
    tierNumber: idx + 1,
    priceLovelace: price.toString(),
    mcPerAda: Number(LOVELACE_PER_ADA / price),
    startMc: (BigInt(idx) * TIER_SIZE).toString(),
    endMc: (BigInt(idx + 1) * TIER_SIZE).toString()
  }))

  return {
    salePool: MC_SALE_POOL.toString(),
    saleSold: saleSold.toString(),
    saleRemaining: tier.remainingTotal.toString(),
    salePercent: salePercent(saleSold),
    tierNumber: tier.tierNumber,
    priceLovelace: tier.priceLovelace.toString(),
    remainingInTier: tier.remainingInTier.toString(),
    soldOut: tier.soldOut,
    minAda: Number(BUY_MIN_LOVELACE / LOVELACE_PER_ADA),
    minLovelace: BUY_MIN_LOVELACE.toString(),
    quoteTtlMs: QUOTE_TTL_MS,
    treasuryAddress: cfg.treasuryAddress,
    tiers
  }
}

/** Tạo quote có hiệu lực 60 giây. Giá tính hoàn toàn ở server dựa trên `mc_fund_state.sale_sold`. */
export async function createMcQuote(
  account: PublicAccount,
  input: { mode?: unknown; amount?: unknown; adaAmount?: unknown; lovelace?: unknown; mcAmount?: unknown },
  now = Date.now()
): Promise<McQuoteDto> {
  const cfg = getWalletConfig()
  if (!cfg.treasuryAddress) {
    apiError(503, 'treasury_not_configured', 'Địa chỉ ví nhận ADA của chùa chưa được cấu hình')
  }

  const mode = input.mode === 'mc' || input.mcAmount !== undefined ? 'mc' : 'ada'
  let inputBigInt: bigint
  if (mode === 'mc') {
    inputBigInt = parseBigIntPositive(input.mcAmount ?? input.amount, 'Số MC')
  } else if (input.lovelace !== undefined) {
    inputBigInt = parseBigIntPositive(input.lovelace, 'Số lovelace')
  } else {
    const adaInt = parseBigIntPositive(input.adaAmount ?? input.amount, 'Số ADA')
    inputBigInt = adaInt * LOVELACE_PER_ADA
  }

  const db = await getDb()
  const row = (await db.prepare('SELECT sale_sold FROM mc_fund_state WHERE id = 1').get()) as { sale_sold: number } | undefined
  const saleSold = BigInt(row?.sale_sold ?? 0)

  let q
  try {
    q = mode === 'mc' ? quoteByMc(saleSold, inputBigInt) : quoteByLovelace(saleSold, inputBigInt)
  } catch (e: any) {
    if (e instanceof QuoteError) {
      apiError(e.code === 'sold_out' ? 409 : 400, e.code, e.message)
    }
    throw e
  }

  const tier = getTierState(saleSold)
  const quoteId = `qt_${randomBytes(12).toString('hex')}`
  const expiresAt = now + QUOTE_TTL_MS
  const segments = serializeSegments(q.segments)

  await db
    .prepare(
      `INSERT INTO mc_quotes
        (quote_id, account_id, wallet_address, mode, input_amount, total_mc, total_lovelace, unused_lovelace,
         tier_number, sale_sold_snapshot, segments_json, status, used_tx_hash, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?)`
    )
    .run(
      quoteId,
      account.id,
      account.address,
      mode,
      inputBigInt.toString(),
      Number(q.totalMc),
      Number(q.totalLovelace),
      Number(q.unusedLovelace),
      tier.tierNumber,
      Number(saleSold),
      JSON.stringify(segments),
      now,
      expiresAt
    )

  return {
    quoteId,
    mode,
    totalMc: q.totalMc.toString(),
    totalLovelace: q.totalLovelace.toString(),
    unusedLovelace: q.unusedLovelace.toString(),
    tierNumber: tier.tierNumber,
    saleSoldSnapshot: saleSold.toString(),
    segments,
    treasuryAddress: cfg.treasuryAddress,
    status: 'open',
    createdAt: now,
    expiresAt
  }
}

async function fetchAndVerifyOnChainTx(txHash: string, expectedSender: string, expectedReceiver: string): Promise<VerifiedPaymentTx> {
  const bf = getBlockfrostClient()
  if (!bf) {
    apiError(503, 'indexer_unavailable', 'Dịch vụ xác minh giao dịch Cardano chưa sẵn sàng')
  }
  const [info, utxos] = await Promise.all([
    bf.txInfo(txHash).catch(() => null),
    bf.txUtxos(txHash).catch(() => null)
  ])
  if (!info || !utxos) {
    return {
      senderAddress: expectedSender,
      receiverAddress: expectedReceiver,
      lovelacePaid: 0n,
      confirmations: 0
    }
  }
  const senderMatched = utxos.inputs.some((inp: any) => inp.address === expectedSender)
  let lovelaceToTreasury = 0n
  for (const out of utxos.outputs) {
    if (out.address === expectedReceiver) {
      for (const amt of out.amount || []) {
        if (amt.unit === 'lovelace') lovelaceToTreasury += BigInt(amt.quantity)
      }
    }
  }
  const latest = await bf.latestBlock().catch(() => null)
  const confirmations = info.block_height && latest?.height ? Math.max(1, latest.height - info.block_height + 1) : 0
  return {
    senderAddress: senderMatched ? expectedSender : (utxos.inputs[0]?.address || ''),
    receiverAddress: lovelaceToTreasury > 0n ? expectedReceiver : '',
    lovelacePaid: lovelaceToTreasury,
    confirmations
  }
}

/**
 * Xác minh txHash + trừ quỹ bán nguyên tử + cộng MC vào tài khoản người mua.
 * Hỗ trợ truyền `verifiedTx` để kiểm thử tự động (chống replay, hết hạn quote, đua luồng).
 */
export async function submitAndSettleMcPurchase(
  account: PublicAccount,
  input: { quoteId?: unknown; txHash?: unknown },
  opts?: { verifiedTx?: VerifiedPaymentTx; now?: number }
): Promise<SettlePurchaseResult> {
  const quoteId = typeof input.quoteId === 'string' ? input.quoteId.trim() : ''
  const txHash = typeof input.txHash === 'string' ? input.txHash.trim().toLowerCase() : ''
  if (!quoteId || quoteId.length > 64) apiError(400, 'invalid_quote_id', 'Mã báo giá không hợp lệ')
  if (!TX_HASH_RE.test(txHash)) apiError(400, 'invalid_tx_hash', 'Mã giao dịch (txHash) phải gồm 64 ký tự hex')

  const now = opts?.now ?? Date.now()
  const cfg = getWalletConfig()

  // 1. Kiểm tra nhanh chống replay txHash trước khi gọi mạng
  const db = await getDb()
  const existingTx = (await db
    .prepare('SELECT id, quote_id, account_id, mc_amount, lovelace_paid, status FROM mc_purchases WHERE tx_hash = ?')
    .get(txHash)) as
    | { id: number; quote_id: string; account_id: number; mc_amount: number; lovelace_paid: number; status: string }
    | undefined

  if (existingTx) {
    if (existingTx.account_id === account.id && existingTx.quote_id === quoteId && existingTx.status === 'settled') {
      const acc = (await db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(account.id)) as { mc_balance: number }
      return {
        purchaseId: existingTx.id,
        quoteId,
        txHash,
        status: 'settled',
        mcAmount: String(existingTx.mc_amount),
        lovelacePaid: String(existingTx.lovelace_paid),
        newBalance: acc.mc_balance,
        idempotentReplay: true
      }
    }
    apiError(409, 'tx_hash_already_used', 'Giao dịch này đã được sử dụng cho một đơn mua khác (chống replay)')
  }

  // 2. Đọc quote & xác thực quyền sở hữu + hạn 60 giây
  const quote = (await db.prepare('SELECT * FROM mc_quotes WHERE quote_id = ?').get(quoteId)) as any
  if (!quote) apiError(404, 'quote_not_found', 'Không tìm thấy báo giá')
  if (Number(quote.account_id) !== account.id) apiError(403, 'forbidden_quote', 'Báo giá này thuộc về ví khác')
  if (quote.status === 'settled') {
    apiError(409, 'quote_already_used', 'Báo giá này đã được sử dụng')
  }
  if (now > Number(quote.expires_at)) {
    await db.prepare("UPDATE mc_quotes SET status = 'expired' WHERE quote_id = ? AND status = 'open'").run(quoteId)
    apiError(410, 'quote_expired', 'Báo giá đã hết hiệu lực (quá 60 giây). Vui lòng tạo báo giá mới.')
  }

  // 3. Xác minh giao dịch on-chain (hoặc từ mock trong test)
  const tx = opts?.verifiedTx ?? (await fetchAndVerifyOnChainTx(txHash, account.address, cfg.treasuryAddress))
  if (tx.confirmations < cfg.confirmationsRequired) {
    return {
      purchaseId: 0,
      quoteId,
      txHash,
      status: 'confirming',
      mcAmount: String(quote.total_mc),
      lovelacePaid: String(quote.total_lovelace),
      newBalance: account.mcBalance,
      idempotentReplay: false
    }
  }
  if (tx.senderAddress !== account.address) {
    apiError(400, 'sender_mismatch', 'Địa chỉ ví gửi ADA không khớp với ví đang đăng nhập')
  }
  if (tx.receiverAddress !== cfg.treasuryAddress) {
    apiError(400, 'receiver_mismatch', 'Địa chỉ nhận ADA không khớp với ví treasury của chùa')
  }
  const expectedLovelace = BigInt(quote.total_lovelace)
  if (tx.lovelacePaid < expectedLovelace) {
    apiError(400, 'underpaid', `Số ADA thanh toán (${tx.lovelacePaid} lovelace) ít hơn báo giá (${expectedLovelace} lovelace)`)
  }

  // 4. Giao dịch nguyên tử: trừ quỹ bán (chống race condition & chống bán vượt bậc) + ghi mc_purchases + cộng MC
  const settled = await withTransaction(async (conn) => {
    // Kiểm tra lại quote & txHash bên trong khóa giao dịch
    const dupTx = await conn.prepare('SELECT id FROM mc_purchases WHERE tx_hash = ?').get(txHash)
    if (dupTx) apiError(409, 'tx_hash_already_used', 'Giao dịch này đã được sử dụng')

    const qRow = (await conn.prepare('SELECT status, total_mc, total_lovelace, sale_sold_snapshot, expires_at FROM mc_quotes WHERE quote_id = ?').get(quoteId)) as any
    if (!qRow || qRow.status !== 'open') apiError(409, 'quote_already_used', 'Báo giá không còn hiệu lực')
    if (now > Number(qRow.expires_at)) apiError(410, 'quote_expired', 'Báo giá đã hết hiệu lực')

    const fundRow = (await conn.prepare('SELECT sale_sold FROM mc_fund_state WHERE id = 1').get()) as { sale_sold: number }
    const currentSold = BigInt(fundRow.sale_sold)
    const wantedMc = BigInt(qRow.total_mc)

    if (currentSold + wantedMc > MC_SALE_POOL) {
      apiError(409, 'sale_pool_exhausted', 'Quỹ bán MC không đủ số lượng còn lại (đã có người mua trước)')
    }

    // Kiểm tra lại bậc giá thực tại thời điểm settle: không được bán sai bậc giá!
    const liveRecheck = quoteByMc(currentSold, wantedMc)
    if (liveRecheck.totalLovelace > tx.lovelacePaid) {
      apiError(409, 'tier_price_changed', 'Bậc giá đã tăng do giao dịch khác hoàn tất trước. Vui lòng tạo báo giá mới.')
    }

    // Cập nhật quỹ bán có điều kiện nguyên tử
    const fundUpd = await conn
      .prepare('UPDATE mc_fund_state SET sale_sold = sale_sold + ?, updated_at = ? WHERE id = 1 AND sale_sold + ? <= ?')
      .run(Number(wantedMc), now, Number(wantedMc), Number(MC_SALE_POOL))
    if (Number(fundUpd.changes) !== 1) {
      apiError(409, 'sale_pool_exhausted', 'Quỹ bán MC đã cạn')
    }

    const insPurchase = await conn
      .prepare(
        `INSERT INTO mc_purchases
          (quote_id, tx_hash, account_id, wallet_address, mc_amount, lovelace_paid, status, delivery_tx_hash, failure_reason, created_at, settled_at)
         VALUES (?, ?, ?, ?, ?, ?, 'settled', NULL, NULL, ?, ?)`
      )
      .run(quoteId, txHash, account.id, account.address, Number(wantedMc), Number(tx.lovelacePaid), now, now)

    await conn
      .prepare("UPDATE mc_quotes SET status = 'settled', used_tx_hash = ? WHERE quote_id = ?")
      .run(txHash, quoteId)

    await conn.prepare('UPDATE accounts SET mc_balance = mc_balance + ? WHERE id = ?').run(Number(wantedMc), account.id)
    const afterAcc = (await conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(account.id)) as { mc_balance: number }

    const insLedger = await conn
      .prepare(
        `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
         VALUES (?, ?, ?, 'mc_purchase', 'mc_quote', ?, ?, ?, ?)`
      )
      .run(
        account.id,
        Number(wantedMc),
        afterAcc.mc_balance,
        quoteId,
        txHash,
        JSON.stringify({ lovelacePaid: tx.lovelacePaid.toString(), tierNumber: quote.tier_number }),
        now
      )

    const ledgerId = Number(insLedger.lastInsertRowid)
    onAfterCommit(() => {
      if (ledgerId > 0) void scheduleHydraRecord(ledgerId)
    })

    return {
      purchaseId: Number(insPurchase.lastInsertRowid),
      quoteId,
      txHash,
      status: 'settled' as const,
      mcAmount: wantedMc.toString(),
      lovelacePaid: tx.lovelacePaid.toString(),
      newBalance: afterAcc.mc_balance,
      idempotentReplay: false
    }
  })

  return settled
}

export async function getMcQuoteStatus(account: PublicAccount, quoteId: string) {
  const db = await getDb()
  const quote = (await db.prepare('SELECT * FROM mc_quotes WHERE quote_id = ?').get(quoteId)) as any
  if (!quote) apiError(404, 'quote_not_found', 'Không tìm thấy báo giá')
  if (Number(quote.account_id) !== account.id) apiError(403, 'forbidden_quote', 'Báo giá thuộc ví khác')
  const purchase = (await db.prepare('SELECT * FROM mc_purchases WHERE quote_id = ?').get(quoteId)) as any
  const expired = quote.status === 'open' && Date.now() > Number(quote.expires_at)
  return {
    quoteId: quote.quote_id,
    status: purchase ? purchase.status : expired ? 'expired' : quote.status,
    totalMc: String(quote.total_mc),
    totalLovelace: String(quote.total_lovelace),
    tierNumber: Number(quote.tier_number),
    expiresAt: Number(quote.expires_at),
    txHash: purchase?.tx_hash || quote.used_tx_hash || null,
    settledAt: purchase?.settled_at || null
  }
}
