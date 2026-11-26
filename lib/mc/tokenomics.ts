/**
 * Tokenomics của MC (Merit Coin) - NGUỒN DUY NHẤT cho server và client.
 * Mọi con số là số nguyên (BigInt). Tuyệt đối không dùng số thực trong tính tiền.
 */

/** Tổng cung cố định, mint đúng một lần rồi khóa policy. */
export const MC_TOTAL_SUPPLY = 1_000_000_000n
/** Quỹ bán 85%: người dùng mua bằng ADA. */
export const MC_SALE_POOL = 850_000_000n
/** Quỹ nhiệm vụ 15%: thưởng nhiệm vụ, không ảnh hưởng giá. */
export const MC_QUEST_POOL = 150_000_000n
/** MC không có số thập phân. */
export const MC_DECIMALS = 0
/** Tên asset "MC" dạng hex (UTF-8). */
export const MC_ASSET_NAME_HEX = '4d43'

export const LOVELACE_PER_ADA = 1_000_000n

/** Mua tối thiểu 5 ADA mỗi lần (tránh vướng min UTxO). */
export const BUY_MIN_LOVELACE = 5n * LOVELACE_PER_ADA
/** Khoản thanh toán thực tế tối thiểu để tạo UTxO hợp lệ (áp dụng khi quỹ bán gần cạn). */
export const PAYMENT_MIN_UTXO_LOVELACE = 1n * LOVELACE_PER_ADA
/** Mua tối đa mỗi lần (chống nhập nhầm số quá lớn). */
export const BUY_MAX_LOVELACE = 100_000n * LOVELACE_PER_ADA
/** Hiệu lực quote: 60 giây. */
export const QUOTE_TTL_MS = 60_000

/** Mỗi bậc bán 85.000.000 MC từ quỹ bán, 10 bậc = 850.000.000 MC. */
export const TIER_SIZE = 85_000_000n

/**
 * Giá lovelace trên 1 MC theo từng bậc (tăng xấp xỉ x1,2 mỗi bậc).
 * Ghi cứng từng giá trị theo bảng chốt, KHÔNG tính bằng 1000 * 1.2^n để tránh sai số làm tròn.
 */
export const TIER_PRICES_LOVELACE: readonly bigint[] = [
  1000n, 1200n, 1440n, 1728n, 2074n, 2488n, 2986n, 3583n, 4300n, 5160n
]

/** Trần thưởng nhiệm vụ mỗi ví mỗi ngày (giờ Việt Nam). */
export const QUEST_DAILY_CAP_PER_WALLET = 1_000n
/** Cảnh báo khi quỹ nhiệm vụ còn dưới ngưỡng này (phần trăm). */
export const QUEST_POOL_LOW_WATERMARK_PCT = 10n

/** Phân bổ MC khi người chơi tiêu trong chùa (tổng = 100%): 55% tái cấp thưởng, 5% đốt khan hiếm, 40% vận hành. */
export const SPEND_SPLIT_QUEST_PCT = 55
export const SPEND_SPLIT_BURN_PCT = 5
export const SPEND_SPLIT_OPS_PCT = 40

export function splitSpentMc(amount: number): { toQuest: number; toBurn: number; toOps: number } {
  const toQuest = Math.floor((amount * SPEND_SPLIT_QUEST_PCT) / 100)
  const toBurn = Math.floor((amount * SPEND_SPLIT_BURN_PCT) / 100)
  const toOps = amount - toQuest - toBurn
  return { toQuest, toBurn, toOps }
}
