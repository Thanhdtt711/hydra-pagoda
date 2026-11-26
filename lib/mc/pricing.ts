/**
 * Tính giá MC theo bậc (tier). Module thuần, toàn bộ bằng BigInt, không phụ thuộc server.
 *
 * Quy tắc làm tròn (có lợi cho hệ thống):
 * - Mua theo ngân sách ADA: số MC nhận được làm tròn XUỐNG ở từng bậc; phần lovelace dư không đủ mua 1 MC không bị thu.
 * - Tổng lovelace phải trả luôn bằng đúng tổng (số MC từng bậc x giá bậc đó), là số nguyên tuyệt đối.
 * - Mua vượt ranh giới bậc: tính TỪNG PHẦN theo giá của mỗi bậc đã đi qua, không áp một giá cho cả đơn.
 */
import {
  BUY_MAX_LOVELACE,
  BUY_MIN_LOVELACE,
  MC_SALE_POOL,
  PAYMENT_MIN_UTXO_LOVELACE,
  TIER_PRICES_LOVELACE,
  TIER_SIZE
} from './tokenomics'

export interface TierState {
  /** Chỉ số bậc hiện tại (0..9). Bằng số bậc khi quỹ bán đã hết. */
  tierIndex: number
  /** Số thứ tự bậc hiển thị (1..10). */
  tierNumber: number
  /** Giá lovelace/MC của bậc hiện tại (0n khi hết quỹ). */
  priceLovelace: bigint
  /** MC còn lại trong bậc hiện tại. */
  remainingInTier: bigint
  /** MC còn lại trong toàn bộ quỹ bán. */
  remainingTotal: bigint
  soldOut: boolean
}

export interface QuoteSegment {
  tierNumber: number
  mc: bigint
  priceLovelace: bigint
  lovelace: bigint
}

export interface PriceQuote {
  segments: QuoteSegment[]
  totalMc: bigint
  /** Số lovelace thực phải trả (<= ngân sách khi tính theo ADA). */
  totalLovelace: bigint
  /** Số lovelace ngân sách không dùng tới (dư lẻ, không thu). */
  unusedLovelace: bigint
}

export type QuoteErrorCode = 'invalid_amount' | 'sold_out' | 'below_minimum' | 'above_maximum'

export class QuoteError extends Error {
  public readonly code: QuoteErrorCode
  constructor(code: QuoteErrorCode, message: string) {
    super(message)
    this.name = 'QuoteError'
    this.code = code
  }
}

function assertSold(saleSold: bigint) {
  if (typeof saleSold !== 'bigint' || saleSold < 0n || saleSold > MC_SALE_POOL) {
    throw new QuoteError('invalid_amount', 'Tổng MC đã bán không hợp lệ')
  }
}

export function getTierState(saleSold: bigint): TierState {
  assertSold(saleSold)
  const remainingTotal = MC_SALE_POOL - saleSold
  if (remainingTotal === 0n) {
    return {
      tierIndex: TIER_PRICES_LOVELACE.length,
      tierNumber: TIER_PRICES_LOVELACE.length,
      priceLovelace: 0n,
      remainingInTier: 0n,
      remainingTotal: 0n,
      soldOut: true
    }
  }
  const tierIndex = Number(saleSold / TIER_SIZE)
  const remainingInTier = (BigInt(tierIndex) + 1n) * TIER_SIZE - saleSold
  return {
    tierIndex,
    tierNumber: tierIndex + 1,
    priceLovelace: TIER_PRICES_LOVELACE[tierIndex]!,
    remainingInTier,
    remainingTotal,
    soldOut: false
  }
}

function emptyQuote(): PriceQuote {
  return { segments: [], totalMc: 0n, totalLovelace: 0n, unusedLovelace: 0n }
}

/** Mua theo ngân sách ADA (lovelace). Trả về lượng MC nhận được, tổng lovelace thực trả. */
export function quoteByLovelace(saleSold: bigint, lovelaceBudget: bigint): PriceQuote {
  assertSold(saleSold)
  if (typeof lovelaceBudget !== 'bigint' || lovelaceBudget <= 0n) {
    throw new QuoteError('invalid_amount', 'Số ADA phải là số nguyên dương')
  }
  // Mức tối thiểu 5 ADA tính trên NGÂN SÁCH người dùng nhập (không phạt phần dư do làm tròn xuống).
  if (lovelaceBudget < BUY_MIN_LOVELACE) {
    throw new QuoteError('below_minimum', 'Mua tối thiểu 5 ADA mỗi lần')
  }
  if (lovelaceBudget > BUY_MAX_LOVELACE) {
    throw new QuoteError('above_maximum', 'Số ADA vượt mức tối đa cho một lần mua')
  }
  if (saleSold >= MC_SALE_POOL) {
    throw new QuoteError('sold_out', 'Hết MC trong quỹ bán')
  }

  const out = emptyQuote()
  let sold = saleSold
  let budget = lovelaceBudget

  while (budget > 0n && sold < MC_SALE_POOL) {
    const tier = getTierState(sold)
    if (tier.soldOut) break
    const affordable = budget / tier.priceLovelace
    const take = affordable < tier.remainingInTier ? affordable : tier.remainingInTier
    if (take <= 0n) break
    const cost = take * tier.priceLovelace
    out.segments.push({ tierNumber: tier.tierNumber, mc: take, priceLovelace: tier.priceLovelace, lovelace: cost })
    out.totalMc += take
    out.totalLovelace += cost
    budget -= cost
    sold += take
  }

  out.unusedLovelace = lovelaceBudget - out.totalLovelace
  if (out.totalMc === 0n) {
    throw new QuoteError('below_minimum', 'Số ADA quá nhỏ để mua được MC')
  }
  // Khoản thanh toán thực tế phải đủ lớn để làm một UTxO hợp lệ (xảy ra khi quỹ bán chỉ còn rất ít).
  if (out.totalLovelace < PAYMENT_MIN_UTXO_LOVELACE) {
    throw new QuoteError('below_minimum', 'Quỹ bán còn quá ít, không đủ tạo giao dịch thanh toán tối thiểu')
  }
  return out
}

/** Mua theo số MC mong muốn. Nếu vượt phần còn lại của quỹ bán thì bị từ chối (không âm thầm cắt). */
export function quoteByMc(saleSold: bigint, mcWanted: bigint): PriceQuote {
  assertSold(saleSold)
  if (typeof mcWanted !== 'bigint' || mcWanted <= 0n) {
    throw new QuoteError('invalid_amount', 'Số MC phải là số nguyên dương')
  }
  if (saleSold >= MC_SALE_POOL) {
    throw new QuoteError('sold_out', 'Hết MC trong quỹ bán')
  }
  if (mcWanted > MC_SALE_POOL - saleSold) {
    throw new QuoteError('sold_out', 'Số MC muốn mua vượt quá phần còn lại của quỹ bán')
  }

  const out = emptyQuote()
  let sold = saleSold
  let need = mcWanted
  while (need > 0n) {
    const tier = getTierState(sold)
    const take = need < tier.remainingInTier ? need : tier.remainingInTier
    const cost = take * tier.priceLovelace
    out.segments.push({ tierNumber: tier.tierNumber, mc: take, priceLovelace: tier.priceLovelace, lovelace: cost })
    out.totalMc += take
    out.totalLovelace += cost
    need -= take
    sold += take
  }

  if (out.totalLovelace > BUY_MAX_LOVELACE) {
    throw new QuoteError('above_maximum', 'Giá trị đơn vượt mức tối đa cho một lần mua')
  }
  if (out.totalLovelace < BUY_MIN_LOVELACE) {
    throw new QuoteError('below_minimum', 'Mua tối thiểu 5 ADA mỗi lần')
  }
  return out
}

/** Tiến độ bán ra theo phần trăm nguyên (0..100), làm tròn xuống. */
export function salePercent(saleSold: bigint): number {
  assertSold(saleSold)
  return Number((saleSold * 100n) / MC_SALE_POOL)
}
