// Kiểm thử Sổ Tu Tập (chuỗi ngày an lạc) qua API thật: server tự kiểm việc lành, idempotent theo ngày,
// ngày nghỉ, chuỗi về nửa, quà cột mốc chỉ phát một lần, đối soát sổ cái.
// Yêu cầu đã build: npm run build. Chạy: node scripts/wallet/test-streak.mjs
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { startTestServer } from './_server.mjs'

const PORT = Number(process.env.PORT || 3017)
const DB_PATH = process.env.DB_PATH || './.data/test-streak.sqlite'
const results = []
const hex = b => Buffer.from(b).toString('hex')
const log = (name, ok, info = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' - ' + info : ''}`)
}

const server = await startTestServer({ port: PORT, dbPath: DB_PATH })
const BASE = server.base

async function api(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'content-type': 'application/json', origin: BASE }
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
}

async function createAccount() {
  const skBytes = ed25519.utils.randomPrivateKey()
  const wasmPrivKey = C.PrivateKey.from_normal_bytes(skBytes)
  const pkBytes = wasmPrivKey.to_public().as_bytes()
  const keyHash = blake2b(pkBytes, { dkLen: 28 })
  const addrBytes = new Uint8Array(29)
  addrBytes[0] = 0x60
  addrBytes.set(keyHash, 1)
  const address = bech32.encode('addr_test', bech32.toWords(addrBytes), 1023)
  const signCip8 = payloadBytes => {
    const protectedBytes = cborEncode(new Map([[1, -8], ['address', addrBytes]]))
    const sigStructure = cborEncode(['Signature1', protectedBytes, new Uint8Array(0), payloadBytes])
    const sig = ed25519.sign(sigStructure, skBytes)
    const signature = cborEncode([protectedBytes, new Map([['hashed', false]]), payloadBytes, sig])
    const key = cborEncode(new Map([[1, 1], [3, -8], [-1, 6], [-2, pkBytes]]))
    return { signature: hex(signature), key: hex(key) }
  }
  const nonceRes = await api('/api/auth/nonce', { method: 'POST', body: { address } })
  const signed = signCip8(new TextEncoder().encode(nonceRes.json.message))
  const verifyRes = await api('/api/auth/verify', { method: 'POST', body: { address, nonce: nonceRes.json.nonce, ...signed } })
  return { address, cookie: verifyRes.setCookie.split(';')[0] }
}

function withDb(fn, readOnly = false) {
  const db = new DatabaseSync(DB_PATH, { readOnly })
  if (!readOnly) db.exec('PRAGMA busy_timeout = 5000')
  try { return fn(db) } finally { db.close() }
}

/** Khóa ngày giờ Việt Nam lệch `offset` ngày so với hôm nay. */
function vnDayKey(offset = 0) {
  return new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10)
}

/** Đặt thẳng trạng thái chuỗi trong DB để mô phỏng nhiều ngày đã qua (không có cờ bỏ qua kiểm tra ở server). */
function setStreak(accountId, { current, best, last, restWeek = null }) {
  withDb(db => {
    db.prepare('DELETE FROM account_streaks WHERE account_id = ?').run(accountId)
    db.prepare(
      'INSERT INTO account_streaks (account_id, current_streak, best_streak, last_day_key, rest_week_key, title, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)'
    ).run(accountId, current, best ?? current, last, restWeek, Date.now())
  })
}

const accountIdOf = address => withDb(db => Number(db.prepare('SELECT id FROM accounts WHERE address = ?').get(address).id), true)
const qty = (accountId, itemId) =>
  withDb(db => Number(db.prepare('SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = ?').get(accountId, itemId)?.quantity ?? 0), true)
const claim = cookie => api('/api/mc/streak/claim', { method: 'POST', cookie })
const cardCount = accountId =>
  withDb(db => Number(db.prepare('SELECT COUNT(*) AS n FROM card_inventory WHERE account_id = ?').get(accountId).n), true)

try {
  const alice = await createAccount()
  const aid = accountIdOf(alice.address)

  const guest = await api('/api/mc/streak/status')
  log(
    '1. Khách xem được 5 cột mốc, chuỗi 0, không ghi dấu được',
    guest.status === 200 && guest.json?.authenticated === false && guest.json?.milestones?.length === 5 && guest.json?.canClaim === false
  )

  const unauth = await api('/api/mc/streak/claim', { method: 'POST' })
  log('2. Từ chối ghi dấu khi chưa đăng nhập (401)', unauth.status === 401, `status=${unauth.status}`)

  const noDeed = await claim(alice.cookie)
  log('3. Chưa có việc lành hôm nay: từ chối 400 no_good_deed', noDeed.status === 400 && noDeed.json?.data?.code === 'no_good_deed', `code=${noDeed.json?.data?.code}`)

  const incense = await api('/api/mc/incense/offer', { method: 'POST', cookie: alice.cookie, body: { location: 'hall' } })
  const st1 = await api('/api/mc/streak/status', { cookie: alice.cookie })
  log(
    '4. Thắp hương xong: deeds.incense = true, canClaim = true',
    incense.json?.firstToday === true && st1.json?.deeds?.incense === true && st1.json?.canClaim === true
  )

  const c1 = await claim(alice.cookie)
  log(
    '5. Ghi dấu lần đầu: outcome first, chuỗi 1, todayDone',
    c1.status === 200 && c1.json?.outcome === 'first' && c1.json?.status?.currentStreak === 1 && c1.json?.status?.todayDone === true,
    `outcome=${c1.json?.outcome}`
  )

  const c2 = await claim(alice.cookie)
  log('6. Ghi dấu lần hai cùng ngày: already, chuỗi vẫn 1', c2.status === 200 && c2.json?.outcome === 'already' && c2.json?.status?.currentStreak === 1)

  setStreak(aid, { current: 2, last: vnDayKey(-1) })
  const c3 = await claim(alice.cookie)
  log(
    '7. Chuỗi 3: tặng Đàn Hương Kyoto (incense_japan) vào kho',
    c3.json?.status?.currentStreak === 3 && c3.json?.rewards?.[0]?.milestone === 3 && qty(aid, 'incense_japan') === 1,
    `rewards=${c3.json?.rewards?.map(r => r.milestone)}`
  )

  setStreak(aid, { current: 6, last: vnDayKey(-1) })
  const c7 = await claim(alice.cookie)
  log('8. Chuỗi 7: tặng Hoa Đăng Cầu An (lotus_lantern)', c7.json?.rewards?.some(r => r.milestone === 7) && qty(aid, 'lotus_lantern') === 1)

  const cardsBefore = cardCount(aid)
  setStreak(aid, { current: 20, last: vnDayKey(-1) })
  const c21 = await claim(alice.cookie)
  const cardReward = c21.json?.rewards?.find(r => r.milestone === 21)
  log(
    '9. Chuỗi 21: tặng 1 thẻ di sản hạng Rare vào kho thẻ',
    Boolean(cardReward?.cardId) && cardCount(aid) === cardsBefore + 1 && qty(aid, cardReward.cardId) >= 1,
    `card=${cardReward?.cardId}`
  )

  setStreak(aid, { current: 48, last: vnDayKey(-1) })
  const c49 = await claim(alice.cookie)
  log('10. Chuỗi 49: tặng Pháp Phục Nâu Làng Mai (western)', c49.json?.rewards?.some(r => r.milestone === 49) && qty(aid, 'western') === 1)

  setStreak(aid, { current: 107, last: vnDayKey(-1) })
  const c108 = await claim(alice.cookie)
  log(
    '11. Chuỗi 108: mở danh hiệu Hành Giả Bền Tâm',
    c108.json?.status?.title === 'Hành Giả Bền Tâm' && c108.json?.rewards?.some(r => r.kind === 'title')
  )

  setStreak(aid, { current: 2, last: vnDayKey(-1) })
  const again = await claim(alice.cookie)
  log(
    '12. Lên lại cột mốc 3: không phát lại quà, kho vẫn 1 Đàn Hương Kyoto',
    again.json?.status?.currentStreak === 3 && again.json?.rewards?.length === 0 && qty(aid, 'incense_japan') === 1
  )

  setStreak(aid, { current: 5, last: vnDayKey(-2) })
  const rested = await claim(alice.cookie)
  log('13. Lỡ 1 ngày, ngày nghỉ còn: outcome rested, chuỗi 5 thành 6', rested.json?.outcome === 'rested' && rested.json?.status?.currentStreak === 6, `outcome=${rested.json?.outcome}`)

  setStreak(aid, { current: 10, last: vnDayKey(-10) })
  const halved = await claim(alice.cookie)
  log('14. Bỏ 9 ngày: outcome halved, chuỗi 10 thành 6 (nửa + dấu hôm nay)', halved.json?.outcome === 'halved' && halved.json?.status?.currentStreak === 6, `streak=${halved.json?.status?.currentStreak}`)

  const bob = await createAccount()
  const bobSt = await api('/api/mc/streak/status', { cookie: bob.cookie })
  log('15. Tài khoản khác bắt đầu từ chuỗi 0, không lẫn dữ liệu', bobSt.json?.currentStreak === 0 && bobSt.json?.title === null)

  const recon = withDb(db => {
    const acc = db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(aid)
    const agg = db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS s, COUNT(*) AS n FROM mc_ledger WHERE account_id = ?').get(aid)
    return { balance: Number(acc.mc_balance), sum: Number(agg.s), n: Number(agg.n) }
  }, true)
  log(
    '16. Đối soát sổ cái: Sổ Tu Tập không sinh MC (số dư = tổng sổ cái = 15 MC thắp hương)',
    recon.balance === 15 && recon.sum === 15 && recon.n === 1,
    `balance=${recon.balance}, sum=${recon.sum}, entries=${recon.n}`
  )
} finally {
  await server.stop()
}

const failed = results.filter(r => !r.ok)
console.log(`\nTổng kết Sổ Tu Tập: ${results.length - failed.length}/${results.length} test cases PASS`)
if (failed.length > 0) process.exit(1)

