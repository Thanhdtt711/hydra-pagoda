/**
 * Test cổng thưởng nhiệm vụ (server/utils/mc/questRewards.ts):
 * - Chống nhận trùng lặp (duplicate)
 * - Cooldown chống spam
 * - Trần 1.000 MC/ví/ngày
 * - Cảnh báo khi quỹ nhiệm vụ còn dưới 10%
 * - Khi quỹ nhiệm vụ cạn -> trả grantedMc = 0 và poolExhausted = true ("hết thưởng")
 * Chạy:
 *   node --experimental-transform-types scripts/mc/test-quest-rewards.mjs
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

globalThis.createError = (opts) => {
  const err = new Error(opts.message || opts.statusMessage || 'API Error')
  err.statusCode = opts.statusCode
  err.data = opts.data
  return err
}

const tmpDir = mkdtempSync(join(tmpdir(), 'pagoda-quest-'))
process.env.NUXT_DB_PATH = join(tmpDir, 'quest.sqlite')
process.env.DATABASE_URL = ''
process.env.NUXT_DATABASE_URL = ''
process.env.NUXT_HYDRA_L2_ENABLED = 'false'

const { getRootDb } = await import('../../server/utils/wallet/db.ts')
const { grantQuestReward, getQuestFundStatus } = await import('../../server/utils/mc/questRewards.ts')
const { MC_QUEST_POOL } = await import('../../lib/mc/tokenomics.ts')

const db = await getRootDb()
const now0 = Date.now()
await db.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, 0, ?, ?)').run('addr_test1_pilgrim_1', 'Pilgrim 1', now0, now0)

let pass = 0
let fail = 0
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  PASS  ${name}`) } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}

try {
  await test('Nhận thưởng nhiệm vụ lần đầu thành công + cộng MC đúng ví', async () => {
    const r = await grantQuestReward(1, 300, {
      questKey: 'meditation',
      periodKey: '2026-11-26-s1',
      reason: 'meditation_reward',
      refId: 'med_1_s1',
      now: now0
    })
    assert.equal(r.grantedMc, 300)
    assert.equal(r.balanceAfter, 300)
    assert.equal(r.duplicate, false)
    assert.equal(r.capReached, false)
  })

  await test('Nhận thưởng trùng lặp cùng quest_key + period_key bị chặn (duplicate=true, grantedMc=0)', async () => {
    const r = await grantQuestReward(1, 300, {
      questKey: 'meditation',
      periodKey: '2026-11-26-s1',
      reason: 'meditation_reward',
      refId: 'med_1_s1_retry',
      now: now0 + 5_000
    })
    assert.equal(r.duplicate, true)
    assert.equal(r.grantedMc, 0)
    assert.equal(r.balanceAfter, 300)
  })

  await test('Cooldown chống spam cùng quest_key', async () => {
    let errCode = ''
    try {
      await grantQuestReward(1, 100, {
        questKey: 'meditation',
        periodKey: '2026-11-26-s2',
        reason: 'meditation_reward',
        refId: 'med_1_s2',
        cooldownMs: 60_000,
        now: now0 + 10_000
      })
    } catch (e) {
      errCode = e?.data?.code
    }
    assert.equal(errCode, 'quest_cooldown')
  })

  await test('Trần 1.000 MC/ví/ngày: cắt đúng phần còn lại rồi khóa thưởng trong ngày', async () => {
    // Đã nhận 300, xin thêm 800 => chỉ nhận 700 (đủ trần 1.000)
    const r1 = await grantQuestReward(1, 800, {
      questKey: 'parkour',
      periodKey: '2026-11-26-p1',
      reason: 'parkour_reward',
      refId: 'pk_1_p1',
      now: now0 + 120_000
    })
    assert.equal(r1.grantedMc, 700)
    assert.equal(r1.dailyUsedAfter, 1000)
    assert.equal(r1.capReached, true)

    // Xin thêm 50 trong cùng ngày => 0 MC
    const r2 = await grantQuestReward(1, 50, {
      questKey: 'incense',
      periodKey: '2026-11-26',
      reason: 'incense_daily',
      refId: 'inc_1',
      now: now0 + 180_000
    })
    assert.equal(r2.grantedMc, 0)
    assert.equal(r2.capReached, true)
  })

  await test('Cảnh báo khi quỹ nhiệm vụ còn dưới 10% và báo hết thưởng khi quỹ cạn', async () => {
    // Đưa quỹ nhiệm vụ về còn 5% (7.500.000 MC) và sang ngày mới
    const nextDay = now0 + 86_400_000
    await db.prepare('UPDATE mc_fund_state SET quest_paid = ? WHERE id = 1').run(Number(MC_QUEST_POOL - 7_500_000n))
    const rLow = await grantQuestReward(1, 100, {
      questKey: 'streak',
      periodKey: '2026-11-27',
      reason: 'streak_daily',
      refId: 'str_1_d2',
      now: nextDay
    })
    assert.equal(rLow.grantedMc, 100)
    assert.equal(rLow.lowPoolAlert, true)

    // Làm cạn quỹ nhiệm vụ
    await db.prepare('UPDATE mc_fund_state SET quest_paid = ? WHERE id = 1').run(Number(MC_QUEST_POOL))
    const rEmpty = await grantQuestReward(1, 100, {
      questKey: 'deeds',
      periodKey: '2026-11-27',
      reason: 'deeds_daily',
      refId: 'deed_1_d2',
      now: nextDay + 5_000
    })
    assert.equal(rEmpty.grantedMc, 0)
    assert.equal(rEmpty.poolExhausted, true)
    assert.match(rEmpty.message, /hết/i)

    const status = await getQuestFundStatus()
    assert.equal(status.exhausted, true)
    assert.equal(status.questRemaining, '0')
  })
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail ? 1 : 0)
