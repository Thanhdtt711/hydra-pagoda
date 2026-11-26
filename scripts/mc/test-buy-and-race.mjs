/**
 * Test Quote 60s, chống replay txHash, chống hết hạn quote, và đua luồng (race condition) khi quỹ sắp hết.
 * Chạy:
 *   node --experimental-transform-types scripts/mc/test-buy-and-race.mjs
 */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// Stub Nuxt `createError` trong môi trường chạy script Node thuần
globalThis.createError = (opts) => {
  const err = new Error(opts.message || opts.statusMessage || 'API Error')
  err.statusCode = opts.statusCode
  err.data = opts.data
  return err
}

const tmpDir = mkdtempSync(join(tmpdir(), 'pagoda-buy-'))
process.env.NUXT_DB_PATH = join(tmpDir, 'buy.sqlite')
process.env.DATABASE_URL = ''
process.env.NUXT_DATABASE_URL = ''
process.env.NUXT_HYDRA_L2_ENABLED = 'false'

const { getRootDb } = await import('../../server/utils/wallet/db.ts')
const { getWalletConfig } = await import('../../server/utils/wallet/config.ts')
const { createMcQuote, getMcMarketInfo, submitAndSettleMcPurchase } = await import('../../server/utils/mc/purchaseService.ts')
const { MC_SALE_POOL } = await import('../../lib/mc/tokenomics.ts')

const cfg = getWalletConfig()
const db = await getRootDb()
const now0 = Date.now()
await db.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, 0, ?, ?)').run('addr_test1_buyer_a', 'Buyer A', now0, now0)
await db.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, 0, ?, ?)').run('addr_test1_buyer_b', 'Buyer B', now0, now0)

const buyerA = { id: 1, address: 'addr_test1_buyer_a', displayName: 'Buyer A', walletDisplayName: 'Buyer A', fortuneName: null, mcBalance: 0 }
const buyerB = { id: 2, address: 'addr_test1_buyer_b', displayName: 'Buyer B', walletDisplayName: 'Buyer B', fortuneName: null, mcBalance: 0 }

let pass = 0
let fail = 0
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  PASS  ${name}`) } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}
async function expectApiError(fn, code) {
  try { await fn() } catch (e) {
    assert.equal(e?.data?.code, code, `mong đợi mã lỗi ${code}, nhận được ${e?.data?.code || e?.message}`)
    return
  }
  assert.fail(`mong đợi ném lỗi ${code}`)
}

const mkHash = (ch) => ch.repeat(64)

try {
  await test('Tạo quote 5 ADA ở bậc 1 = 5000 MC, hiệu lực 60 giây', async () => {
    const q = await createMcQuote(buyerA, { mode: 'ada', amount: 5 }, now0)
    assert.equal(q.totalMc, '5000')
    assert.equal(q.totalLovelace, '5000000')
    assert.equal(q.expiresAt - q.createdAt, 60_000)
  })

  await test('Quote hết hạn (>60s) bị từ chối với mã quote_expired', async () => {
    const q = await createMcQuote(buyerA, { mode: 'ada', amount: 5 }, now0)
    await expectApiError(
      () => submitAndSettleMcPurchase(
        buyerA,
        { quoteId: q.quoteId, txHash: mkHash('1') },
        {
          now: now0 + 61_000,
          verifiedTx: { senderAddress: buyerA.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: 5_000_000n, confirmations: 1 }
        }
      ),
      'quote_expired'
    )
  })

  await test('Settle hợp lệ cộng đúng 5000 MC; gửi lại cùng quote+txHash idempotent không cộng đúp', async () => {
    const q = await createMcQuote(buyerA, { mode: 'ada', amount: 5 }, now0)
    const txHash = mkHash('a')
    const res1 = await submitAndSettleMcPurchase(
      buyerA,
      { quoteId: q.quoteId, txHash },
      {
        now: now0 + 5_000,
        verifiedTx: { senderAddress: buyerA.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: 5_000_000n, confirmations: 1 }
      }
    )
    assert.equal(res1.status, 'settled')
    assert.equal(res1.newBalance, 5000)
    assert.equal(res1.idempotentReplay, false)

    // Gửi lại đúng cùng quote + txHash => idempotent replay, số dư vẫn 5000
    const res2 = await submitAndSettleMcPurchase(
      buyerA,
      { quoteId: q.quoteId, txHash },
      {
        now: now0 + 6_000,
        verifiedTx: { senderAddress: buyerA.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: 5_000_000n, confirmations: 1 }
      }
    )
    assert.equal(res2.idempotentReplay, true)
    assert.equal(res2.newBalance, 5000)
  })

  await test('Chống replay txHash: dùng lại txHash cũ cho quote mới bị chặn 409', async () => {
    const q2 = await createMcQuote(buyerB, { mode: 'ada', amount: 5 }, now0)
    await expectApiError(
      () => submitAndSettleMcPurchase(
        buyerB,
        { quoteId: q2.quoteId, txHash: mkHash('a') },
        {
          now: now0 + 10_000,
          verifiedTx: { senderAddress: buyerB.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: 5_000_000n, confirmations: 1 }
        }
      ),
      'tx_hash_already_used'
    )
  })

  await test('Từ chối sai ví gửi, sai ví nhận và thiếu ADA', async () => {
    const q = await createMcQuote(buyerB, { mode: 'ada', amount: 5 }, now0)
    await expectApiError(
      () => submitAndSettleMcPurchase(buyerB, { quoteId: q.quoteId, txHash: mkHash('2') }, {
        now: now0 + 5_000,
        verifiedTx: { senderAddress: buyerA.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: 5_000_000n, confirmations: 1 }
      }),
      'sender_mismatch'
    )
    await expectApiError(
      () => submitAndSettleMcPurchase(buyerB, { quoteId: q.quoteId, txHash: mkHash('3') }, {
        now: now0 + 5_000,
        verifiedTx: { senderAddress: buyerB.address, receiverAddress: 'addr_test1_wrong', lovelacePaid: 5_000_000n, confirmations: 1 }
      }),
      'receiver_mismatch'
    )
    await expectApiError(
      () => submitAndSettleMcPurchase(buyerB, { quoteId: q.quoteId, txHash: mkHash('4') }, {
        now: now0 + 5_000,
        verifiedTx: { senderAddress: buyerB.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: 4_000_000n, confirmations: 1 }
      }),
      'underpaid'
    )
  })

  await test('Race condition: 2 người mua đồng thời khi quỹ chỉ còn 2000 MC — chỉ 1 người thành công, quỹ về đúng 0', async () => {
    // Đặt sale_sold cách trần đúng 2000 MC (bậc 10, giá 5160 lovelace/MC => 10.320.000 lovelace)
    const startSold = Number(MC_SALE_POOL - 2000n)
    await db.prepare('UPDATE mc_fund_state SET sale_sold = ? WHERE id = 1').run(startSold)

    const qA = await createMcQuote(buyerA, { mode: 'mc', amount: 2000 }, now0)
    const qB = await createMcQuote(buyerB, { mode: 'mc', amount: 2000 }, now0)

    const [rA, rB] = await Promise.allSettled([
      submitAndSettleMcPurchase(buyerA, { quoteId: qA.quoteId, txHash: mkHash('c') }, {
        now: now0 + 1000,
        verifiedTx: { senderAddress: buyerA.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: BigInt(qA.totalLovelace), confirmations: 1 }
      }),
      submitAndSettleMcPurchase(buyerB, { quoteId: qB.quoteId, txHash: mkHash('d') }, {
        now: now0 + 1000,
        verifiedTx: { senderAddress: buyerB.address, receiverAddress: cfg.treasuryAddress, lovelacePaid: BigInt(qB.totalLovelace), confirmations: 1 }
      })
    ])

    const fulfilled = [rA, rB].filter((r) => r.status === 'fulfilled')
    const rejected = [rA, rB].filter((r) => r.status === 'rejected')
    assert.equal(fulfilled.length, 1, 'chỉ đúng 1 người được mua phần cuối')
    assert.equal(rejected.length, 1, 'người thứ 2 phải bị từ chối')
    assert.equal(rejected[0].reason?.data?.code, 'sale_pool_exhausted')

    const info = await getMcMarketInfo()
    assert.equal(info.soldOut, true)
    assert.equal(info.saleRemaining, '0')
    assert.equal(info.saleSold, MC_SALE_POOL.toString())

    // Quỹ về 0 => tạo quote mới bị từ chối sold_out
    await expectApiError(() => createMcQuote(buyerA, { mode: 'ada', amount: 5 }, now0), 'sold_out')
  })
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail ? 1 : 0)
