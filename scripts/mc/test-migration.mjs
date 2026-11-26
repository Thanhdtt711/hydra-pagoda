/**
 * Test Migration 16 (xóa số dư MC cũ kèm backup, chỉ chạy một lần) và Migration 17 (quỹ/quote/quest).
 * Chạy trên DB tạm trong thư mục scratch (KHÔNG đụng DB thật):
 *   node --experimental-strip-types scripts/mc/test-migration.mjs
 */
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmpDir = mkdtempSync(join(tmpdir(), 'pagoda-mig16-'))
const dbPath = join(tmpDir, 'test.sqlite')
process.env.NUXT_DB_PATH = dbPath
process.env.DATABASE_URL = ''
process.env.NUXT_DATABASE_URL = ''

const { MIGRATIONS } = await import('../../server/db/migrations.ts')
const { getRootDb } = await import('../../server/utils/wallet/db.ts')

let pass = 0
let fail = 0
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  PASS  ${name}`) } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}

try {
  // 1. Tạo DB giả lập ở trạng thái trước migration 16 (version 1..15) có 2 tài khoản mang số dư MC cũ
  const seed = new DatabaseSync(dbPath)
  seed.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)')
  for (const m of MIGRATIONS.filter(x => x.version <= 15)) {
    seed.exec(m.sql)
    seed.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now())
  }
  const now = Date.now()
  seed.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').run('addr_test1_user_a', 'User A', 2500, now, now)
  seed.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').run('addr_test1_user_b', 'User B', 0, now, now)
  seed.prepare('INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, created_at) VALUES (1, 2500, 2500, ?, ?, ?, ?)').run('deposit', 'order', 'ord_old_1', now)
  seed.close()

  // 2. Mở qua getRootDb() => tự động chạy migration 16 + 17 kèm backup file
  const db = await getRootDb()

  await test('Tạo file backup vật lý trước migration 16', () => {
    const backups = readdirSync(join(tmpDir, 'backups'))
    assert.ok(backups.some(f => f.includes('pre-v16')))
  })

  await test('Sao lưu số dư cũ vào bảng accounts_mc_backup_v16 và mc_ledger_backup_v16', async () => {
    const accBk = await db.prepare('SELECT * FROM accounts_mc_backup_v16').all()
    assert.equal(accBk.length, 1)
    assert.equal(accBk[0].mc_balance, 2500)
    const ledBk = await db.prepare('SELECT * FROM mc_ledger_backup_v16').all()
    assert.equal(ledBk.length, 1)
  })

  await test('Toàn bộ tài khoản có mc_balance = 0 sau migration 16', async () => {
    const rows = await db.prepare('SELECT mc_balance FROM accounts').all()
    assert.equal(rows.length, 2)
    for (const r of rows) assert.equal(r.mc_balance, 0)
  })

  await test('Sổ cái mc_ledger đối soát khớp 0 (có bút toán legacy_reset)', async () => {
    const sum = await db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS s FROM mc_ledger WHERE account_id = 1').get()
    assert.equal(sum.s, 0)
    const resetRow = await db.prepare("SELECT * FROM mc_ledger WHERE reason = 'legacy_reset'").get()
    assert.ok(resetRow)
    assert.equal(resetRow.delta_mc, -2500)
  })

  await test('Migration 16 chỉ chạy một lần (không ghi đè số dư mới sau này)', async () => {
    await db.prepare('UPDATE accounts SET mc_balance = 100 WHERE id = 1').run()
    await getRootDb() // gọi lại
    const row = await db.prepare('SELECT mc_balance FROM accounts WHERE id = 1').get()
    assert.equal(row.mc_balance, 100)
  })

  await test('Migration 17 khởi tạo bảng mc_fund_state với 0 đã bán và 0 đã phát', async () => {
    const fund = await db.prepare('SELECT * FROM mc_fund_state WHERE id = 1').get()
    assert.equal(fund.sale_sold, 0)
    assert.equal(fund.quest_paid, 0)
  })
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* Windows SQLite handle may hold lock until exit */ }
}

console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail ? 1 : 0)
