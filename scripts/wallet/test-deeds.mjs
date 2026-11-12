// Kiểm thử Ba Việc Lành mỗi ngày qua API thật: bộ ba việc theo tài khoản, việc tự tính từ dữ liệu sẵn có,
// việc "đến điểm" do client báo, chỉ nhận quà khi đủ ba việc, nhận đúng một lần mỗi ngày, quà không sinh MC.
// Yêu cầu đã build: npm run build. Chạy: node --experimental-strip-types scripts/wallet/test-deeds.mjs
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { startTestServer } from './_server.mjs'
import { DEED_CATALOG, DAILY_DEED_REWARD, pickDailyDeeds } from '../../lib/streak/deedCatalog.ts'

const PORT = Number(process.env.PORT || 3018)
const DB_PATH = process.env.DB_PATH || './.data/test-deeds.sqlite'
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

const vnDayKey = (offset = 0) => new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10)
const accountIdOf = address => withDb(db => Number(db.prepare('SELECT id FROM accounts WHERE address = ?').get(address).id), true)
const qty = (accountId, itemId) =>
  withDb(db => Number(db.prepare('SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = ?').get(accountId, itemId)?.quantity ?? 0), true)
const balanceOf = accountId => withDb(db => Number(db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId).mc_balance), true)
const status = cookie => api('/api/mc/deeds/status', { cookie })
const visit = (cookie, landmark) => api('/api/mc/deeds/visit', { method: 'POST', cookie, body: { landmark } })
const claim = cookie => api('/api/mc/deeds/claim', { method: 'POST', cookie })

/** Dựng thẳng dữ liệu cho việc tự tính (thiền xong, gieo quẻ) và gọi API thật cho thắp hương. */
async function completeAutoDeed(account, accountId, autoKey) {
  if (autoKey === 'incense') {
    return (await api('/api/mc/incense/offer', { method: 'POST', cookie: account.cookie, body: { location: 'hall' } })).json?.firstToday === true
  }
  withDb(db => {
    if (autoKey === 'meditation') {
      db.prepare(
        `INSERT INTO meditation_sessions (session_token, account_id, slot_id, duration_min, duration_sec, expected_reward_mc, credited_mc, status, day_key, started_at, completed_at)
         VALUES (?, ?, NULL, 5, 300, 0, 0, 'completed', ?, ?, ?)`
      ).run(`tok-${accountId}-${Date.now()}`, accountId, vnDayKey(), Date.now(), Date.now())
    } else {
      db.prepare(
        `INSERT INTO fortune_records (account_id, request_id, category, tier, cost_mc, fortune_json, receipt_hash, created_at)
         VALUES (?, ?, 'stick', 'free_daily', 0, '{}', 'h', ?)`
      ).run(accountId, `req-${accountId}-${Date.now()}`, Date.now())
    }
  })
  return true
}

/** Làm xong một việc bất kỳ trong bộ ba (việc đến điểm thì gọi API báo điểm). */
async function doDeed(account, accountId, d) {
  if (d.kind === 'visit') return visit(account.cookie, d.landmark)
  return completeAutoDeed(account, accountId, d.autoKey)
}

try {
  const alice = await createAccount()
  const aid = accountIdOf(alice.address)
  const aliceSet = pickDailyDeeds(aid, vnDayKey())

  const guest = await api('/api/mc/deeds/status')
  log('1. Khách xem được khung rỗng, không thể nhận quà', guest.status === 200 && guest.json?.authenticated === false && guest.json?.deeds?.length === 0 && guest.json?.canClaim === false)

  const unauthVisit = await api('/api/mc/deeds/visit', { method: 'POST', body: { landmark: 'lotus_pond' } })
  const unauthClaim = await api('/api/mc/deeds/claim', { method: 'POST' })
  log('2. Từ chối báo điểm và nhận quà khi chưa đăng nhập (401)', unauthVisit.status === 401 && unauthClaim.status === 401, `visit=${unauthVisit.status}, claim=${unauthClaim.status}`)

  const st0 = await status(alice.cookie)
  const serverIds = st0.json?.deeds?.map(d => d.id).join(',')
  log(
    '3. Server trả đúng bộ ba việc theo hạt giống tài khoản và ngày, chưa việc nào xong',
    st0.json?.deeds?.length === 3 && serverIds === aliceSet.map(d => d.id).join(',') && st0.json?.doneCount === 0 && st0.json?.canClaim === false,
    serverIds
  )

  const notSet = DEED_CATALOG.find(d => d.kind === 'visit' && !aliceSet.some(s => s.id === d.id))
  const bad = await visit(alice.cookie, 'khong_co_diem_nay')
  log('4. Điểm lạ bị từ chối 400 invalid_landmark', bad.status === 400 && bad.json?.data?.code === 'invalid_landmark', `code=${bad.json?.data?.code}`)

  const wrongDay = await visit(alice.cookie, notSet.landmark)
  log('5. Điểm có thật nhưng không nằm trong ba việc hôm nay bị từ chối 400 deed_not_today', wrongDay.status === 400 && wrongDay.json?.data?.code === 'deed_not_today', `code=${wrongDay.json?.data?.code}`)

  const early = await claim(alice.cookie)
  log('6. Chưa làm việc nào mà nhận quà: 400 deeds_incomplete, kho không tăng', early.status === 400 && early.json?.data?.code === 'deeds_incomplete' && qty(aid, DAILY_DEED_REWARD.itemId) === 0, `code=${early.json?.data?.code}`)

  const first = aliceSet[0]
  await doDeed(alice, aid, first)
  const stAfterFirst = await status(alice.cookie)
  log('7. Làm xong việc đầu tiên: tiến độ 1/3, vẫn chưa nhận được quà', stAfterFirst.json?.doneCount === 1 && stAfterFirst.json?.canClaim === false, `kind=${first.kind}, done=${stAfterFirst.json?.doneCount}`)

  if (first.kind === 'visit') {
    const dup = await visit(alice.cookie, first.landmark)
    const rows = withDb(db => Number(db.prepare('SELECT COUNT(*) AS n FROM daily_deeds WHERE account_id = ? AND day_key = ?').get(aid, vnDayKey()).n), true)
    log('8. Báo cùng một điểm hai lần: idempotent, chỉ một dòng, tiến độ vẫn 1', dup.status === 200 && dup.json?.status?.doneCount === 1 && rows === 1, `rows=${rows}`)
  } else {
    log('8. Việc tự tính không cần báo thêm, hiện done ngay trong trạng thái', stAfterFirst.json?.deeds?.[0]?.done === true)
  }

  for (const d of aliceSet.slice(1)) await doDeed(alice, aid, d)
  const stFull = await status(alice.cookie)
  log('9. Đủ ba việc: tiến độ 3/3, canClaim = true', stFull.json?.doneCount === 3 && stFull.json?.canClaim === true && stFull.json?.rewardClaimed === false)

  const balBefore = balanceOf(aid)
  const got = await claim(alice.cookie)
  log(
    '10. Nhận quà: granted, kho có 1 Trầm Hương Xứ Quảng, trạng thái rewardClaimed',
    got.status === 200 && got.json?.granted === true && qty(aid, DAILY_DEED_REWARD.itemId) === 1 && got.json?.status?.rewardClaimed === true && got.json?.status?.canClaim === false,
    `qty=${qty(aid, DAILY_DEED_REWARD.itemId)}`
  )

  const again = await claim(alice.cookie)
  log('11. Nhận lần hai cùng ngày: granted false, kho vẫn 1', again.status === 200 && again.json?.granted === false && qty(aid, DAILY_DEED_REWARD.itemId) === 1)

  log('12. Nhận quà không đổi số dư MC (quà là vật phẩm)', balanceOf(aid) === balBefore, `before=${balBefore}, after=${balanceOf(aid)}`)

  const bob = await createAccount()
  const bid = accountIdOf(bob.address)
  const bobSt = await status(bob.cookie)
  const bobClaim = await claim(bob.cookie)
  log(
    '13. Tài khoản khác có bộ việc riêng, không thấy tiến độ của Alice, không nhận được quà',
    bobSt.json?.doneCount === 0 && bobSt.json?.rewardClaimed === false && bobClaim.status === 400 && qty(bid, DAILY_DEED_REWARD.itemId) === 0 &&
      bobSt.json?.deeds?.map(d => d.id).join(',') === pickDailyDeeds(bid, vnDayKey()).map(d => d.id).join(',')
  )

  // Quà ngày hôm qua không chặn nhận quà hôm nay.
  const carol = await createAccount()
  const cid = accountIdOf(carol.address)
  withDb(db => db.prepare('INSERT INTO daily_deed_rewards (account_id, day_key, item_id, claimed_at) VALUES (?, ?, ?, ?)').run(cid, vnDayKey(-1), DAILY_DEED_REWARD.itemId, Date.now()))
  for (const d of pickDailyDeeds(cid, vnDayKey())) await doDeed(carol, cid, d)
  const carolClaim = await claim(carol.cookie)
  log('14. Đã nhận quà hôm qua vẫn nhận được quà hôm nay (khóa theo ngày)', carolClaim.status === 200 && carolClaim.json?.granted === true && qty(cid, DAILY_DEED_REWARD.itemId) === 1)

  const recon = withDb(db => {
    const acc = db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(aid)
    const agg = db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS s FROM mc_ledger WHERE account_id = ?').get(aid)
    return { balance: Number(acc.mc_balance), sum: Number(agg.s) }
  }, true)
  log('15. Đối soát sổ cái: số dư bằng tổng sổ cái, Ba Việc Lành không tự sinh MC', recon.balance === recon.sum, `balance=${recon.balance}, sum=${recon.sum}`)

  // Mỗi loại việc tự tính (thiền, thắp hương, gieo quẻ) phải được server nhận ra từ dữ liệu thật.
  const covered = new Set()
  for (let i = 0; i < 30 && covered.size < 3; i++) {
    const acc = await createAccount()
    const id = accountIdOf(acc.address)
    const target = pickDailyDeeds(id, vnDayKey()).find(d => d.kind === 'auto' && !covered.has(d.autoKey))
    if (!target) continue
    const before = await status(acc.cookie)
    await completeAutoDeed(acc, id, target.autoKey)
    const after = await status(acc.cookie)
    const ok = before.json?.deeds?.find(d => d.id === target.id)?.done === false && after.json?.deeds?.find(d => d.id === target.id)?.done === true
    log(`16. Việc tự tính "${target.autoKey}" chuyển từ chưa xong sang xong khi có dữ liệu thật`, ok)
    covered.add(target.autoKey)
  }
  log('17. Đã kiểm đủ cả ba loại việc tự tính (thiền, thắp hương, gieo quẻ)', covered.size === 3, [...covered].join(','))
} finally {
  await server.stop()
}

const failed = results.filter(r => !r.ok)
console.log(`\nTổng kết Ba Việc Lành: ${results.length - failed.length}/${results.length} test cases PASS`)
if (failed.length > 0) process.exit(1)
