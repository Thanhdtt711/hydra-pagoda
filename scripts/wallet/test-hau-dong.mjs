// Kiểm thử Nhà Hầu Đồng: claim đồng thời chỉ cộng một lần, trần 250 MC/ngày (kể cả cắt phần dư),
// chặn bơm watch_seconds bằng heartbeat dồn, quỹ Ban Lộc trừ đúng và đối soát sổ cái.
// Yêu cầu đã build: npm run build. Chạy: node scripts/wallet/test-hau-dong.mjs
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { startTestServer } from './_server.mjs'

const PORT = Number(process.env.PORT || 3018)
const DB_PATH = process.env.DB_PATH || './.data/test-hau-dong.sqlite'
const DEITIES = ['quan_lon_de_tam', 'chau_doi_thuong_ngan', 'ong_hoang_muoi', 'co_doi_thuong_ngan', 'cau_be_hoang_tu']
const results = []
const hex = b => Buffer.from(b).toString('hex')
const log = (name, ok, info = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${info ? ' — ' + info : ''}`)
}

const server = await startTestServer({ port: PORT, dbPath: DB_PATH })
const BASE = server.base

async function api(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'content-type': 'application/json', origin: BASE }
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch { /* không có JSON */ }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
}

/** Tạo ví Cardano test mới và đăng nhập bằng chữ ký CIP-8. */
async function createAccount() {
  const skBytes = ed25519.utils.randomPrivateKey()
  const wasmPrivKey = C.PrivateKey.from_normal_bytes(skBytes)
  const pkBytes = wasmPrivKey.to_public().as_bytes()
  const keyHash = blake2b(pkBytes, { dkLen: 28 })
  const addrBytes = new Uint8Array(29)
  addrBytes[0] = 0x60
  addrBytes.set(keyHash, 1)
  const address = bech32.encode('addr_test', bech32.toWords(addrBytes), 1023)

  const protectedBytes = cborEncode(new Map([[1, -8], ['address', addrBytes]]))
  const nonceRes = await api('/api/auth/nonce', { method: 'POST', body: { address } })
  const payload = new TextEncoder().encode(nonceRes.json.message)
  const sigStructure = cborEncode(['Signature1', protectedBytes, new Uint8Array(0), payload])
  const sig = ed25519.sign(sigStructure, skBytes)
  const signature = cborEncode([protectedBytes, new Map([['hashed', false]]), payload, sig])
  const key = cborEncode(new Map([[1, 1], [3, -8], [-1, 6], [-2, pkBytes]]))
  const verifyRes = await api('/api/auth/verify', {
    method: 'POST',
    body: { address, nonce: nonceRes.json.nonce, signature: hex(signature), key: hex(key) }
  })
  return {
    address,
    id: verifyRes.json?.account?.id,
    cookie: verifyRes.setCookie.split(';')[0],
    login: verifyRes
  }
}

function writeDb(fn) {
  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA busy_timeout = 5000')
  try { return fn(db) } finally { db.close() }
}

/** Đã nhận `claimedMc` trong hôm nay ở một phiên cũ (dựng trần ngày mà không phải chạy nhiều giá). */
function prefillTodayClaim(accountId, claimedMc) {
  writeDb(db => {
    const now = Date.now()
    db.prepare(
      `INSERT OR IGNORE INTO hau_dong_sessions (session_id, trigger_type, sponsor_display_name, prayer_text, deities_json,
         total_pool_mc, remaining_pool_mc, status, started_at, ends_at, created_at)
       VALUES ('hd_old_test', 'scheduled_lunar', 'test', 'test', ?, 900, 900, 'completed', ?, ?, ?)`
    ).run(JSON.stringify(DEITIES), now - 3600_000, now - 3000_000, now - 3600_000)
    db.prepare(
      `INSERT INTO hau_dong_attendance (session_id, gia_index, account_id, watch_seconds, is_bowing, claimed_mc, last_heartbeat_at, claimed_at)
       VALUES ('hd_old_test', 1, ?, 20, 0, ?, ?, ?)`
    ).run(accountId, claimedMc, now, now)
  })
}

/** Dựng phiên đang chạy ở Bước 5 (Ban Lộc, giây thứ 71 của Giá 1) với quỹ 900 MC. */
function seedActiveSession() {
  writeDb(db => {
    const now = Date.now()
    const startedAt = now - 71_000
    db.prepare(
      `INSERT INTO hau_dong_sessions (session_id, trigger_type, sponsor_display_name, prayer_text, deities_json,
         total_pool_mc, remaining_pool_mc, status, started_at, ends_at, created_at)
       VALUES ('hd_test_active', 'scheduled_lunar', 'test', 'test', ?, 900, 900, 'active', ?, ?, ?)`
    ).run(JSON.stringify(DEITIES), startedAt, startedAt + 480_000, startedAt)
  })
}

try {
  const alice = await createAccount()
  const bob = await createAccount()
  const carol = await createAccount()
  log(
    '1. Đăng nhập 3 ví test (mcBalance khởi tạo = 0)',
    [alice, bob, carol].every(a => a.login.status === 200 && a.login.json?.account?.mcBalance === 0)
  )

  // Bob đã nhận đủ 250 MC hôm nay, Carol đã nhận 240 MC (còn dư 10 MC).
  prefillTodayClaim(bob.id, 250)
  prefillTodayClaim(carol.id, 240)
  seedActiveSession()

  // 2. Heartbeat dồn: gửi 30 lần liên tiếp với deltaSec = 15 không được cộng 450 giây xem.
  const t0 = Date.now()
  let hbOk = 0
  for (let i = 0; i < 30; i++) {
    const r = await api('/api/mc/hau-dong/heartbeat', {
      method: 'POST',
      cookie: alice.cookie,
      body: { insideZone: true, isBowing: false, deltaSec: 15 }
    })
    if (r.status === 200) hbOk++
  }
  const elapsedSec = Math.ceil((Date.now() - t0) / 1000)
  const watch = writeDb(db =>
    db.prepare('SELECT watch_seconds FROM hau_dong_attendance WHERE session_id = ? AND account_id = ?')
      .get('hd_test_active', alice.id)?.watch_seconds
  )
  log(
    '2. Heartbeat dồn 30 lần x deltaSec=15: watch_seconds bị chặn theo thời gian thực',
    hbOk === 30 && typeof watch === 'number' && watch <= 15 + elapsedSec,
    `watch_seconds=${watch}, elapsed=${elapsedSec}s, ngưỡng=${15 + elapsedSec} (không chặn sẽ là 96)`
  )

  // 3. Claim đồng thời 10 lần trên cùng giá: chỉ một lần được cộng.
  const burst = await Promise.all(
    Array.from({ length: 10 }, () =>
      api('/api/mc/hau-dong/claim', { method: 'POST', cookie: alice.cookie, body: { isBowing: false } })
    )
  )
  const wins = burst.filter(r => r.status === 200)
  const dup = burst.filter(r => r.status === 400 && r.json?.data?.code === 'already_claimed_this_gia')
  log(
    '3. Claim đồng thời 10 lần cùng Giá: đúng 1 lần thành công, 9 lần bị chặn',
    wins.length === 1 && dup.length === 9,
    `ok=${wins.length}, already_claimed=${dup.length}, khác=${burst.length - wins.length - dup.length}`
  )
  log(
    '4. Phần thưởng cơ bản đúng 25 MC (không chắp tay, không phải thanh đồng)',
    wins[0]?.json?.creditedMc === 25,
    `creditedMc=${wins[0]?.json?.creditedMc}`
  )

  // 5. Đã đủ trần ngày: bị từ chối.
  const capped = await api('/api/mc/hau-dong/claim', { method: 'POST', cookie: bob.cookie, body: { isBowing: false } })
  log(
    '5. Đã nhận đủ 250 MC hôm nay: claim bị từ chối daily_cap_reached',
    capped.status === 400 && capped.json?.data?.code === 'daily_cap_reached',
    `status=${capped.status}, code=${capped.json?.data?.code}`
  )

  // 6. Còn dư 10 MC: phần thưởng bị cắt xuống đúng 10 MC.
  const partial = await api('/api/mc/hau-dong/claim', { method: 'POST', cookie: carol.cookie, body: { isBowing: true } })
  log(
    '6. Còn dư 10 MC dưới trần ngày: phần thưởng 30 MC bị cắt còn đúng 10 MC',
    partial.status === 200 && partial.json?.creditedMc === 10,
    `status=${partial.status}, creditedMc=${partial.json?.creditedMc}`
  )

  // 7. Quỹ Ban Lộc trừ đúng tổng đã phát (25 + 10), không trừ trùng qua các lần claim lặp.
  const pool = writeDb(db =>
    db.prepare('SELECT remaining_pool_mc FROM hau_dong_sessions WHERE session_id = ?').get('hd_test_active')?.remaining_pool_mc
  )
  log('7. Quỹ Ban Lộc còn 865 MC (900 - 25 - 10)', pool === 865, `remaining_pool_mc=${pool}`)

  // 8. Đối soát sổ cái từng tài khoản.
  const recon = writeDb(db => {
    const q = id => ({
      balance: db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(id).mc_balance,
      sum: db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS s FROM mc_ledger WHERE account_id = ?').get(id).s,
      n: db.prepare("SELECT COUNT(*) AS n FROM mc_ledger WHERE account_id = ? AND reason = 'hau_dong_blessing'").get(id).n
    })
    return { alice: q(alice.id), bob: q(bob.id), carol: q(carol.id) }
  })
  log(
    '8. Sổ cái khớp số dư: Alice 25 MC/1 bút toán, Bob 0, Carol 10 MC/1 bút toán',
    recon.alice.balance === 25 && recon.alice.sum === 25 && recon.alice.n === 1 &&
      recon.bob.balance === 0 && recon.bob.sum === 0 && recon.bob.n === 0 &&
      recon.carol.balance === 10 && recon.carol.sum === 10 && recon.carol.n === 1,
    JSON.stringify(recon)
  )
} finally {
  await server.stop()
}

const failed = results.filter(r => !r.ok)
console.log(`\n📊 Tổng kết Nhà Hầu Đồng: ${results.length - failed.length}/${results.length} test cases PASS`)
if (failed.length > 0) process.exit(1)
