/**
 * Test module giá MC theo bậc (lib/mc/pricing.ts). Chạy:
 *   node --experimental-strip-types scripts/mc/test-pricing.mjs
 */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !/\.(ts|js|mjs|json)$/.test(specifier) &&
      context.parentURL
    ) {
      const parentDir = dirname(fileURLToPath(context.parentURL))
      const candidate = resolve(parentDir, `${specifier}.ts`)
      if (existsSync(candidate)) return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  }
})

const { getTierState, quoteByLovelace, quoteByMc, salePercent, QuoteError } = await import('../../lib/mc/pricing.ts')
const T = await import('../../lib/mc/tokenomics.ts')

let pass = 0
let fail = 0
function test(name, fn) {
  try {
    fn()
    pass++
    console.log(`  PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`  FAIL  ${name}\n        ${e.message}`)
  }
}
const ADA = 1_000_000n
const throwsCode = (fn, code) => {
  try { fn() } catch (e) {
    assert.ok(e instanceof QuoteError, 'phải là QuoteError')
    assert.equal(e.code, code)
    return
  }
  assert.fail(`mong đợi lỗi ${code}`)
}

console.log('Tokenomics')
test('Tổng cung = quỹ bán + quỹ nhiệm vụ = 1 tỷ', () => {
  assert.equal(T.MC_SALE_POOL + T.MC_QUEST_POOL, T.MC_TOTAL_SUPPLY)
  assert.equal(T.MC_TOTAL_SUPPLY, 1_000_000_000n)
})
test('10 bậc x 85M = quỹ bán 850M', () => {
  assert.equal(BigInt(T.TIER_PRICES_LOVELACE.length) * T.TIER_SIZE, T.MC_SALE_POOL)
})
test('Giá tăng dần theo bậc', () => {
  for (let i = 1; i < T.TIER_PRICES_LOVELACE.length; i++) {
    assert.ok(T.TIER_PRICES_LOVELACE[i] > T.TIER_PRICES_LOVELACE[i - 1])
  }
})

console.log('Trạng thái bậc')
test('Bắt đầu ở bậc 1, giá 1000', () => {
  const s = getTierState(0n)
  assert.equal(s.tierNumber, 1)
  assert.equal(s.priceLovelace, 1000n)
  assert.equal(s.remainingInTier, 85_000_000n)
})
test('Đúng ranh giới: bán đủ 85M thì sang bậc 2', () => {
  const s = getTierState(85_000_000n)
  assert.equal(s.tierNumber, 2)
  assert.equal(s.priceLovelace, 1200n)
  assert.equal(s.remainingInTier, 85_000_000n)
})
test('Còn 1 MC cuối bậc 1', () => {
  const s = getTierState(84_999_999n)
  assert.equal(s.tierNumber, 1)
  assert.equal(s.remainingInTier, 1n)
})
test('Bán hết quỹ => soldOut', () => {
  const s = getTierState(T.MC_SALE_POOL)
  assert.equal(s.soldOut, true)
  assert.equal(s.remainingTotal, 0n)
})

console.log('Mua theo ADA')
test('5 ADA ở bậc 1 = 5000 MC', () => {
  const q = quoteByLovelace(0n, 5n * ADA)
  assert.equal(q.totalMc, 5000n)
  assert.equal(q.totalLovelace, 5n * ADA)
  assert.equal(q.unusedLovelace, 0n)
  assert.equal(q.segments.length, 1)
})
test('Làm tròn xuống ở bậc 2: 6 ADA = 5000 MC (giá 1200)', () => {
  const q = quoteByLovelace(85_000_000n, 6n * ADA)
  assert.equal(q.totalMc, 5000n)
  assert.equal(q.totalLovelace, 6_000_000n)
})
test('Dư lẻ không thu: ngân sách 5.000.999 lovelace ở bậc 2', () => {
  const q = quoteByLovelace(85_000_000n, 5_000_999n)
  assert.equal(q.totalMc, 4167n) // floor(5000999/1200)
  assert.equal(q.totalLovelace, 4167n * 1200n)
  assert.equal(q.unusedLovelace, 5_000_999n - 4167n * 1200n)
})
test('Vượt ranh giới 2 bậc: tính từng phần theo giá mỗi bậc', () => {
  // còn 2000 MC ở bậc 1 (giá 1000), phần còn lại ở bậc 2 (giá 1200)
  const sold = 85_000_000n - 2000n
  const budget = 6n * ADA
  const q = quoteByLovelace(sold, budget)
  assert.equal(q.segments.length, 2)
  assert.equal(q.segments[0].mc, 2000n)
  assert.equal(q.segments[0].lovelace, 2_000_000n)
  assert.equal(q.segments[1].priceLovelace, 1200n)
  assert.equal(q.segments[1].mc, 3333n) // floor(4_000_000/1200)
  assert.equal(q.totalMc, 5333n)
  assert.equal(q.totalLovelace, 2_000_000n + 3333n * 1200n)
})
test('Mua xuyên nhiều bậc bằng ngân sách lớn', () => {
  // đứng đầu bậc 1, mua đủ bậc 1 (85M MC = 85.000 ADA) + một phần bậc 2
  const budget = 90_000n * ADA
  const q = quoteByLovelace(0n, budget)
  assert.equal(q.segments[0].mc, 85_000_000n)
  assert.equal(q.segments[0].lovelace, 85_000n * ADA)
  assert.equal(q.segments[1].priceLovelace, 1200n)
  assert.equal(q.segments[1].mc, (5_000n * ADA) / 1200n)
  assert.ok(q.totalLovelace <= budget)
})
test('Tổng lovelace luôn bằng tổng các phân đoạn (số nguyên tuyệt đối)', () => {
  const q = quoteByLovelace(170_000_000n - 777n, 12_345_678n)
  const sum = q.segments.reduce((a, s) => a + s.lovelace, 0n)
  const mc = q.segments.reduce((a, s) => a + s.mc, 0n)
  assert.equal(sum, q.totalLovelace)
  assert.equal(mc, q.totalMc)
  assert.equal(q.totalLovelace + q.unusedLovelace, 12_345_678n)
})
test('Dưới 5 ADA bị từ chối', () => {
  throwsCode(() => quoteByLovelace(0n, 4_999_999n), 'below_minimum')
})
test('Ngân sách không dương bị từ chối', () => {
  throwsCode(() => quoteByLovelace(0n, 0n), 'invalid_amount')
  throwsCode(() => quoteByLovelace(0n, -5n), 'invalid_amount')
})
test('Vượt mức tối đa bị từ chối', () => {
  throwsCode(() => quoteByLovelace(0n, T.BUY_MAX_LOVELACE + 1n), 'above_maximum')
})
test('Quỹ bán hết => sold_out', () => {
  throwsCode(() => quoteByLovelace(T.MC_SALE_POOL, 5n * ADA), 'sold_out')
})
test('Quỹ gần cạn: khoản thanh toán thực tế dưới 1 ADA bị từ chối', () => {
  // chỉ còn 100 MC ở bậc 10 (giá 5160) => 516.000 lovelace < 1 ADA
  const sold = T.MC_SALE_POOL - 100n
  throwsCode(() => quoteByLovelace(sold, 5n * ADA), 'below_minimum')
})
test('Mua đúng 5 ADA ở bậc 10: ngân sách đạt mức tối thiểu dù tổng trả hơi dưới 5 ADA do làm tròn', () => {
  const q = quoteByLovelace(9n * T.TIER_SIZE, 5n * ADA)
  assert.equal(q.totalMc, 968n) // floor(5_000_000 / 5160)
  assert.equal(q.totalLovelace, 968n * 5160n)
})
test('Mua hết quỹ còn lại khi đủ tối thiểu 5 ADA, không bán vượt quỹ', () => {
  const sold = T.MC_SALE_POOL - 2000n // 2000 MC x 5160 = 10.320.000 lovelace
  const q = quoteByLovelace(sold, 20n * ADA)
  assert.equal(q.totalMc, 2000n)
  assert.equal(q.totalLovelace, 2000n * 5160n)
  assert.ok(sold + q.totalMc <= T.MC_SALE_POOL)
})
test('Số 1 ADA mua được MC theo bảng chốt (làm tròn xuống)', () => {
  const expected = [1000n, 833n, 694n, 578n, 482n, 401n, 334n, 279n, 232n, 193n]
  expected.forEach((mc, i) => {
    const sold = BigInt(i) * T.TIER_SIZE
    // dùng 5 ADA rồi chia 5 để kiểm tra đơn vị 1 ADA mà vẫn qua mức tối thiểu
    const q = quoteByLovelace(sold, 5n * ADA)
    assert.equal(q.totalMc / 5n >= mc - 1n, true, `bậc ${i + 1}`)
    assert.equal((1n * ADA) / T.TIER_PRICES_LOVELACE[i], mc, `bậc ${i + 1}`)
  })
})

console.log('Mua theo MC')
test('1000 MC ở bậc 1 = 1.000.000 lovelace nhưng dưới 5 ADA bị từ chối', () => {
  throwsCode(() => quoteByMc(0n, 1000n), 'below_minimum')
})
test('5000 MC ở bậc 1 = 5 ADA', () => {
  const q = quoteByMc(0n, 5000n)
  assert.equal(q.totalLovelace, 5n * ADA)
})
test('Vượt ranh giới bậc khi mua theo MC', () => {
  const sold = 85_000_000n - 3000n
  const q = quoteByMc(sold, 5000n)
  assert.equal(q.segments.length, 2)
  assert.equal(q.totalLovelace, 3000n * 1000n + 2000n * 1200n)
})
test('Mua vượt phần còn lại của quỹ bị từ chối, không cắt âm thầm', () => {
  throwsCode(() => quoteByMc(T.MC_SALE_POOL - 10n, 11n), 'sold_out')
})

console.log('Tiến độ')
test('Phần trăm đã bán', () => {
  assert.equal(salePercent(0n), 0)
  assert.equal(salePercent(T.MC_SALE_POOL / 2n), 50)
  assert.equal(salePercent(T.MC_SALE_POOL), 100)
})

console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail ? 1 : 0)
