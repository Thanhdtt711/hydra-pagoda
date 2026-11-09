// Kiểm thử Tọa Thiền Nhận MC (Meditate-to-Earn): đồng hồ phía server, chống tua giờ, idempotency,
// trần 200 MC/ngày, chống hai người ngồi trùng một bồ đoàn và đối soát sổ cái.
// Yêu cầu đã build: npm run build. Chạy: node scripts/wallet/test-meditation.mjs
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'

const PORT = Number(process.env.PORT || 3015)
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`
const DB_PATH = process.env.DB_PATH || './.data/test-meditation.sqlite'
const TREASURY_TEST_ADDR =
  'addr_test1qqn4u45fks9kd0jk7tgqrwcnkcds8cqyyzcuqkzp73yh84fcrse0mymwzap6e9vvwt9yv3wddg28lft4p7hszvpyucjstn9ug9'
const results = []
const hex = b => Buffer.from(b).toString('hex')
const log = (name, ok, info = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${info ? ' — ' + info : ''}`)
}

for (const ext of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(DB_PATH + ext) } catch {}
}

const serverProc = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    NUXT_DB_PATH: DB_PATH,
    NUXT_TREASURY_ADDRESS: TREASURY_TEST_ADDR,
    NUXT_BLOCKFROST_API_KEY: 'preprod_mock_key_meditation',
    NUXT_BLOCKFROST_BASE_URL: 'http://127.0.0.1:3097',
    NUXT_HYDRA_L2_ENABLED: 'false'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${BASE}/api/auth/me`)
    if (r.status === 200) break
  } catch {}
  await new Promise(r => setTimeout(r, 150))
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'content-type': 'application/json', origin: BASE }
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch {}
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
  const verifyRes = await api('/api/auth/verify', {
    method: 'POST',
    body: { address, nonce: nonceRes.json.nonce, ...signed }
  })
  return { address, cookie: verifyRes.setCookie.split(';')[0], login: verifyRes }
}

/** Lùi mốc started_at để mô phỏng đã ngồi đủ lâu (không có cờ bỏ qua kiểm tra ở server). */
function backdate(token, ms) {
  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA busy_timeout = 5000')
  db.prepare('UPDATE meditation_sessions SET started_at = started_at - ? WHERE session_token = ?').run(ms, token)
  db.close()
}

function readDb(fn) {
  const db = new DatabaseSync(DB_PATH, { readOnly: true })
  try { return fn(db) } finally { db.close() }
}

try {
  const alice = await createAccount()
  log(
    '1. Đăng nhập ví Cardano Preprod CIP-8 (mcBalance khởi tạo = 0)',
    alice.login.status === 200 && alice.login.json?.account?.mcBalance === 0,
    `addr=${alice.login.json?.account?.addressShort}`
  )

  // 2. Trạng thái thiền
  const st0 = await api('/api/mc/meditation/status', { cookie: alice.cookie })
  log(
    '2. GET /api/mc/meditation/status trả 4 gói thiền, trần 200 MC/ngày, hạn mức còn đủ, chưa có chỗ bị chiếm',
    st0.status === 200 &&
      st0.json?.plans?.length === 4 &&
      st0.json?.dailyCapMc === 200 &&
      st0.json?.dailyEarnedMc === 0 &&
      st0.json?.totalSlots >= 230 &&
      Array.isArray(st0.json?.occupiedSlotIds) &&
      st0.json.occupiedSlotIds.length === 0,
    `slots=${st0.json?.totalSlots}, plans=${st0.json?.plans?.map(p => p.rewardMc).join('/')}`
  )

  // 3. Chưa đăng nhập
  const unauth = await api('/api/mc/meditation/start', { method: 'POST', body: { durationMin: 5, slotId: 1 } })
  log('3. Từ chối bắt đầu tọa thiền khi chưa đăng nhập (401)', unauth.status === 401, `status=${unauth.status}`)

  // 4. Tham số sai
  const badDur = await api('/api/mc/meditation/start', { method: 'POST', cookie: alice.cookie, body: { durationMin: 7 } })
  const badSlot = await api('/api/mc/meditation/start', {
    method: 'POST',
    cookie: alice.cookie,
    body: { durationMin: 5, slotId: 99999 }
  })
  log(
    '4. Từ chối thời lượng ngoài danh sách và mã bồ đoàn không tồn tại (400)',
    badDur.status === 400 && badDur.json?.data?.code === 'invalid_duration' &&
      badSlot.status === 400 && badSlot.json?.data?.code === 'invalid_slot',
    `dur=${badDur.json?.data?.code}, slot=${badSlot.json?.data?.code}`
  )

  // 5. Bắt đầu phiên 5 phút trên bồ đoàn #10
  const s1 = await api('/api/mc/meditation/start', { method: 'POST', cookie: alice.cookie, body: { durationMin: 5, slotId: 10 } })
  log(
    '5. Bắt đầu thiền 5 phút: server cấp sessionToken, thưởng dự kiến +30 MC, hạn mức còn 200 MC',
    s1.status === 200 &&
      /^med_[0-9a-f]{24}$/.test(s1.json?.sessionToken || '') &&
      s1.json?.rewardMc === 30 &&
      s1.json?.durationSec === 300 &&
      s1.json?.remainingDailyMc === 200 &&
      s1.json?.slotId === 10,
    `token=${s1.json?.sessionToken}`
  )
  const token1 = s1.json?.sessionToken

  // 6. Tấn công gọi hoàn thành sớm
  await new Promise(r => setTimeout(r, 1000))
  const early = await api('/api/mc/meditation/complete', { method: 'POST', cookie: alice.cookie, body: { sessionToken: token1 } })
  const balAfterEarly = readDb(db => db.prepare('SELECT mc_balance FROM accounts WHERE address = ?').get(alice.address).mc_balance)
  log(
    '6. Chống gian lận: gọi complete sau 1 giây bị từ chối 400 meditation_incomplete, không cộng MC',
    early.status === 400 && early.json?.data?.code === 'meditation_incomplete' && Number(balAfterEarly) === 0,
    `code=${early.json?.data?.code}, balance=${balAfterEarly}`
  )

  // 7. Chống ngồi trùng chỗ
  const bob = await createAccount()
  const status1 = await api('/api/mc/meditation/status')
  const clash = await api('/api/mc/meditation/start', { method: 'POST', cookie: bob.cookie, body: { durationMin: 3, slotId: 10 } })
  log(
    '7. Chống ngồi trùng: bồ đoàn #10 đang có người thì người khác nhận 409 slot_taken, status liệt kê chỗ đã chiếm',
    clash.status === 409 && clash.json?.data?.code === 'slot_taken' && status1.json?.occupiedSlotIds?.includes(10),
    `code=${clash.json?.data?.code}, occupied=${JSON.stringify(status1.json?.occupiedSlotIds)}`
  )

  // 8. Hoàn thành hợp lệ
  backdate(token1, 301_000)
  const done1 = await api('/api/mc/meditation/complete', { method: 'POST', cookie: alice.cookie, body: { sessionToken: token1 } })
  const ledgerRows = readDb(db =>
    db.prepare("SELECT delta_mc, balance_after FROM mc_ledger WHERE reason = 'meditation_reward'").all()
  )
  log(
    '8. Ngồi đủ thời gian: +30 MC, có bút toán meditation_reward trong mc_ledger',
    done1.status === 200 &&
      done1.json?.creditedMc === 30 &&
      done1.json?.mcBalance === 30 &&
      done1.json?.dailyCapReached === false &&
      done1.json?.idempotentReplay === false &&
      ledgerRows.length === 1 &&
      Number(ledgerRows[0].delta_mc) === 30,
    `credited=${done1.json?.creditedMc}, balance=${done1.json?.mcBalance}`
  )

  // 9. Idempotent
  const replay = await api('/api/mc/meditation/complete', { method: 'POST', cookie: alice.cookie, body: { sessionToken: token1 } })
  const ledgerCount = readDb(db => db.prepare("SELECT COUNT(*) AS n FROM mc_ledger WHERE reason = 'meditation_reward'").get().n)
  log(
    '9. Idempotent: gửi lại cùng sessionToken không cộng trùng (vẫn 30 MC, 1 bút toán)',
    replay.status === 200 && replay.json?.idempotentReplay === true && replay.json?.mcBalance === 30 && Number(ledgerCount) === 1,
    `replay=${replay.json?.idempotentReplay}, ledger=${ledgerCount}`
  )

  // 10. Chỗ được nhả sau khi hoàn thành
  const reuse = await api('/api/mc/meditation/start', { method: 'POST', cookie: bob.cookie, body: { durationMin: 3, slotId: 10 } })
  log(
    '10. Sau khi hoàn thành, bồ đoàn #10 được nhả và đồng tu khác ngồi được',
    reuse.status === 200 && reuse.json?.slotId === 10,
    `status=${reuse.status}`
  )

  // 11. Trần 200 MC/ngày: 30 + 150 = 180, phiên kế tiếp chỉ nhận 20, rồi 0
  const big1 = await api('/api/mc/meditation/start', { method: 'POST', cookie: alice.cookie, body: { durationMin: 30, slotId: 20 } })
  backdate(big1.json.sessionToken, 1_801_000)
  const bigDone1 = await api('/api/mc/meditation/complete', { method: 'POST', cookie: alice.cookie, body: { sessionToken: big1.json.sessionToken } })

  const big2 = await api('/api/mc/meditation/start', { method: 'POST', cookie: alice.cookie, body: { durationMin: 30, slotId: 20 } })
  const remainingBeforeBig2 = big2.json?.remainingDailyMc
  backdate(big2.json.sessionToken, 1_801_000)
  const bigDone2 = await api('/api/mc/meditation/complete', { method: 'POST', cookie: alice.cookie, body: { sessionToken: big2.json.sessionToken } })

  const big3 = await api('/api/mc/meditation/start', { method: 'POST', cookie: alice.cookie, body: { durationMin: 15, slotId: 20 } })
  backdate(big3.json.sessionToken, 901_000)
  const bigDone3 = await api('/api/mc/meditation/complete', { method: 'POST', cookie: alice.cookie, body: { sessionToken: big3.json.sessionToken } })
  log(
    '11. Trần 200 MC/ngày: 30 + 150 = 180, phiên sau chỉ nhận 20 (dailyCapReached), phiên kế tiếp nhận 0 và không có bút toán',
    bigDone1.json?.creditedMc === 150 && bigDone1.json?.mcBalance === 180 &&
      remainingBeforeBig2 === 20 &&
      bigDone2.json?.creditedMc === 20 && bigDone2.json?.dailyCapReached === true && bigDone2.json?.mcBalance === 200 &&
      bigDone3.status === 200 && bigDone3.json?.creditedMc === 0 && bigDone3.json?.dailyCapReached === true &&
      bigDone3.json?.ledgerId === null && bigDone3.json?.mcBalance === 200,
    `c1=${bigDone1.json?.creditedMc}, c2=${bigDone2.json?.creditedMc}, c3=${bigDone3.json?.creditedMc}, balance=${bigDone3.json?.mcBalance}`
  )

  // 12. Xả thiền sớm
  const s4 = await api('/api/mc/meditation/start', { method: 'POST', cookie: bob.cookie, body: { durationMin: 5, slotId: 30 } })
  const cancel = await api('/api/mc/meditation/cancel', { method: 'POST', cookie: bob.cookie, body: { sessionToken: s4.json?.sessionToken } })
  backdate(s4.json.sessionToken, 301_000)
  const afterCancel = await api('/api/mc/meditation/complete', { method: 'POST', cookie: bob.cookie, body: { sessionToken: s4.json?.sessionToken } })
  const st4 = await api('/api/mc/meditation/status')
  log(
    '12. Xả thiền sớm: phiên bị hủy, không thể nhận thưởng (409 session_cancelled) và bồ đoàn được nhả',
    cancel.json?.cancelled === true &&
      afterCancel.status === 409 && afterCancel.json?.data?.code === 'session_cancelled' &&
      !st4.json?.occupiedSlotIds?.includes(30),
    `cancel=${cancel.json?.cancelled}, after=${afterCancel.json?.data?.code}`
  )

  // 13. Mở phiên mới sẽ hủy phiên cũ chưa xong của cùng tài khoản
  const a = await api('/api/mc/meditation/start', { method: 'POST', cookie: bob.cookie, body: { durationMin: 3, slotId: 40 } })
  const b = await api('/api/mc/meditation/start', { method: 'POST', cookie: bob.cookie, body: { durationMin: 3, slotId: 41 } })
  const statuses = readDb(db =>
    db.prepare('SELECT session_token, status FROM meditation_sessions WHERE session_token IN (?, ?)').all(a.json?.sessionToken, b.json?.sessionToken)
  )
  const sa = statuses.find(r => r.session_token === a.json?.sessionToken)?.status
  const sb = statuses.find(r => r.session_token === b.json?.sessionToken)?.status
  log(
    '13. Một tài khoản chỉ có một phiên đang chạy: mở phiên mới hủy phiên cũ',
    sa === 'cancelled' && sb === 'active',
    `old=${sa}, new=${sb}`
  )

  // 14. Đối soát sổ cái
  const recon = readDb(db => {
    const acc = db.prepare('SELECT id, mc_balance FROM accounts WHERE address = ?').get(alice.address)
    const agg = db.prepare('SELECT COALESCE(SUM(delta_mc), 0) AS s, COUNT(*) AS n FROM mc_ledger WHERE account_id = ?').get(acc.id)
    return { balance: Number(acc.mc_balance), sum: Number(agg.s), n: Number(agg.n) }
  })
  log(
    '14. Đối soát sổ cái: SUM(mc_ledger.delta_mc) === accounts.mc_balance === 200 MC (3 bút toán thưởng)',
    recon.balance === 200 && recon.sum === 200 && recon.n === 3,
    `balance=${recon.balance}, sum=${recon.sum}, entries=${recon.n}`
  )
} finally {
  serverProc.kill()
  await new Promise(r => setTimeout(r, 300))
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(DB_PATH + ext) } catch {}
  }
}

const failed = results.filter(r => !r.ok)
console.log(`\n📊 Tổng kết Tọa Thiền Nhận MC: ${results.length - failed.length}/${results.length} test cases PASS`)
if (failed.length > 0) process.exit(1)

