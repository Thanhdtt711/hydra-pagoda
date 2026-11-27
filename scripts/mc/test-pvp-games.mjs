/**
 * Bộ kiểm thử Đấu Cờ PvP Cược MC (Cờ Tướng, Cờ Vua, Cờ Caro, Cờ Vây):
 * 1. Tạo bàn + khóa escrow MC + chặn tự vào bàn mình
 * 2. Vào bàn bằng mã phòng + chống race condition 2 người vào cùng lúc
 * 3. Đánh Cờ Caro 5 quân thắng -> người thắng nhận 95% pot, 5% rake chảy vào rổ 55/5/40
 * 4. Đề nghị hòa & chấp nhận hòa -> hoàn trả 100% cược cho cả hai, rake = 0
 * 5. Hủy bàn chờ -> hoàn 100% cược cho chủ bàn
 * 6. Xác thực nước đi hợp lệ & đầu hàng trên Cờ Tướng, Cờ Vua, Cờ Vây (tính đất sau 2 pass)
 *
 * Chạy: node --experimental-transform-types scripts/mc/test-pvp-games.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmpDir = mkdtempSync(join(tmpdir(), 'pagoda-pvp-'))
process.env.DATABASE_URL = ''
process.env.NUXT_DATABASE_URL = ''
process.env.NUXT_DB_PATH = join(tmpDir, 'pvp.sqlite')
process.env.HYDRA_L2_ENABLED = 'false'
process.env.MC_TEST_MODE = '1'

const { getDb } = await import('../../server/utils/wallet/db.ts')
const {
  createPvpMatch,
  joinPvpMatch,
  cancelPvpMatch,
  submitPvpMove,
  performPvpAction,
  listPvpLobby
} = await import('../../server/utils/games/pvpService.ts')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  PASS  ${name}`)
    passed++
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err?.message || err}`)
    failed++
  }
}

const db = await getDb()
const now = Date.now()
await db.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').run('addr_test1pvp_host', 'Kỳ Thủ A', 5000, now, now)
await db.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').run('addr_test1pvp_guest', 'Kỳ Thủ B', 5000, now, now)
await db.prepare('INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').run('addr_test1pvp_third', 'Kỳ Thủ C', 5000, now, now)

const host = { id: 1, address: 'addr_test1pvp_host', stakeAddress: 'stake_1', displayName: 'Kỳ Thủ A', mcBalance: 5000 }
const guest = { id: 2, address: 'addr_test1pvp_guest', stakeAddress: 'stake_2', displayName: 'Kỳ Thủ B', mcBalance: 5000 }
const third = { id: 3, address: 'addr_test1pvp_third', stakeAddress: 'stake_3', displayName: 'Kỳ Thủ C', mcBalance: 5000 }

async function getBal(id) {
  const r = await db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(id)
  return Number(r.mc_balance)
}

async function getFund() {
  return await db.prepare('SELECT quest_recycled, burned_mc, ops_mc FROM mc_fund_state WHERE id = 1').get()
}

try {
  await test('Từ chối môn không hỗ trợ (o_an_quan) và mức cược sai', async () => {
    await assert.rejects(() => createPvpMatch(host, 'o_an_quan', 100), (e) => e?.statusCode === 400)
    await assert.rejects(() => createPvpMatch(host, 'caro', 77), (e) => e?.statusCode === 400)
  })

  await test('Tạo bàn Cờ Caro cược 200 MC, hủy bàn -> hoàn 100% cược', async () => {
    const m = await createPvpMatch(host, 'caro', 200)
    assert.equal(m.status, 'waiting')
    assert.equal(await getBal(1), 4800)
    await assert.rejects(() => joinPvpMatch(host, { matchId: m.matchId }), (e) => e?.statusCode === 400)
    await cancelPvpMatch(host, m.matchId)
    assert.equal(await getBal(1), 5000)
  })

  await test('Đấu Caro 5 quân thắng: người thắng ăn 95% (380 MC), 5% rake (20 MC) chảy vào rổ 55/5/40', async () => {
    const m = await createPvpMatch(host, 'caro', 200)
    assert.equal(await getBal(1), 4800)

    // Race condition: guest và third cùng join bằng roomCode -> chỉ 1 người thành công
    const results = await Promise.allSettled([
      joinPvpMatch(guest, { roomCode: m.roomCode }),
      joinPvpMatch(third, { roomCode: m.roomCode })
    ])
    const okCount = results.filter(r => r.status === 'fulfilled').length
    assert.equal(okCount, 1)
    const winnerJoin = results[0].status === 'fulfilled' ? guest : third
    const otherJoin = results[0].status === 'fulfilled' ? third : guest
    assert.equal(await getBal(winnerJoin.id), 4800)
    assert.equal(await getBal(otherJoin.id), 5000)

    // Chặn đi sai lượt
    await assert.rejects(() => submitPvpMove(winnerJoin, m.matchId, { r: 7, c: 7 }), (e) => e?.statusCode === 409)

    // Host đi hàng 7: (7,3)..(7,7), Guest đi hàng 8: (8,3)..(8,6)
    await submitPvpMove(host, m.matchId, { r: 7, c: 3 })
    await submitPvpMove(winnerJoin, m.matchId, { r: 8, c: 3 })
    await submitPvpMove(host, m.matchId, { r: 7, c: 4 })
    await submitPvpMove(winnerJoin, m.matchId, { r: 8, c: 4 })
    await submitPvpMove(host, m.matchId, { r: 7, c: 5 })
    await submitPvpMove(winnerJoin, m.matchId, { r: 8, c: 5 })
    await submitPvpMove(host, m.matchId, { r: 7, c: 6 })
    await submitPvpMove(winnerJoin, m.matchId, { r: 8, c: 6 })
    const fin = await submitPvpMove(host, m.matchId, { r: 7, c: 7 })

    assert.equal(fin.status, 'finished')
    assert.equal(fin.winnerSide, 'p1')
    assert.equal(fin.endReason, 'five_in_row')
    assert.equal(fin.payoutMc, 380)
    assert.equal(fin.rakeMc, 20)
    // Host: 5000 - 200 + 380 = 5180; Opponent: 4800
    assert.equal(await getBal(1), 5180)
    assert.equal(await getBal(winnerJoin.id), 4800)

    const fund = await getFund()
    assert.equal(Number(fund.quest_recycled) + Number(fund.burned_mc) + Number(fund.ops_mc), 20)
    assert.equal(Number(fund.quest_recycled), 11) // 55% của 20
    assert.equal(Number(fund.burned_mc), 1)       // 5% của 20
    assert.equal(Number(fund.ops_mc), 8)          // 40% của 20
  })

  await test('Cờ Tướng PvP: kiểm tra nước đi hợp lệ + Cầu hòa & Đồng ý hòa hoàn 100%', async () => {
    const hBalBefore = await getBal(1)
    const gBalBefore = await getBal(2)
    const m = await createPvpMatch(host, 'xiangqi', 100)
    await joinPvpMatch(guest, { matchId: m.matchId })

    // Nước đi hợp lệ: Pháo đỏ (7,1) sang trung tâm (7,4)
    const s1 = await submitPvpMove(host, m.matchId, { from: { r: 7, c: 1 }, to: { r: 7, c: 4 } })
    assert.equal(s1.turnSide, 'p2')
    // Nước đi sai luật cho Đen
    await assert.rejects(() => submitPvpMove(guest, m.matchId, { from: { r: 0, c: 0 }, to: { r: 5, c: 5 } }), (e) => e?.statusCode === 400)

    await performPvpAction(host, m.matchId, 'offer_draw')
    const drawn = await performPvpAction(guest, m.matchId, 'accept_draw')
    assert.equal(drawn.status, 'finished')
    assert.equal(drawn.winnerSide, 'draw')
    assert.equal(drawn.rakeMc, 0)
    assert.equal(await getBal(1), hBalBefore)
    assert.equal(await getBal(2), gBalBefore)
  })

  await test('Cờ Vua PvP: nước đi hợp lệ (e2->e4) + Đầu hàng trả 95% cho đối thủ', async () => {
    const hBalBefore = await getBal(1)
    const gBalBefore = await getBal(2)
    const m = await createPvpMatch(host, 'chess', 100)
    await joinPvpMatch(guest, { matchId: m.matchId })
    // Tốt trắng (6,4) -> (4,4)
    const s1 = await submitPvpMove(host, m.matchId, { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } })
    assert.equal(s1.turnSide, 'p2')
    const fin = await performPvpAction(host, m.matchId, 'resign')
    assert.equal(fin.winnerSide, 'p2')
    assert.equal(fin.payoutMc, 190)
    assert.equal(await getBal(1), hBalBefore - 100)
    assert.equal(await getBal(2), gBalBefore + 90)
  })

  await test('Cờ Vây PvP (9x9): đặt quân + 2 lần Pass tính đất kết thúc ván & Lobby trả lịch sử', async () => {
    const m = await createPvpMatch(host, 'go', 50)
    await joinPvpMatch(guest, { matchId: m.matchId })
    await submitPvpMove(host, m.matchId, { r: 4, c: 4 })
    await submitPvpMove(guest, m.matchId, { pass: true })
    const fin = await submitPvpMove(host, m.matchId, { pass: true })
    assert.equal(fin.status, 'finished')
    assert.equal(fin.endReason, 'area_score')
    assert.equal(fin.winnerSide, 'p1') // Đen chiếm toàn bộ bàn 81 > 6.5 komi
    const lobby = await listPvpLobby(host)
    assert.equal(lobby.activeMatch, null)
    assert.ok(lobby.recentMatches.length >= 3)
  })
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* Windows SQLite lock */ }
}

console.log(`\n${passed} PASS / ${failed} FAIL`)
if (failed > 0) process.exit(1)
