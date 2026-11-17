// Kiểm thử tích hợp cho Mục 13 (Chăm sóc Koi), Mục 14 (Vườn Thiền), và Mục 4 (Hội Thiền Nhóm Đồng Bộ).
// Yêu cầu đã build: npm run build. Chạy: node --experimental-strip-types scripts/wallet/test-upgrades.mjs
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { startTestServer } from './_server.mjs'

const PORT = Number(process.env.PORT || 3021)
const DB_PATH = process.env.DB_PATH || './.data/test-upgrades.sqlite'
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
  const nonceRes = await api('/api/auth/nonce', { method: 'POST', body: { address } })
  const payloadBytes = new TextEncoder().encode(nonceRes.json.message)
  const protectedBytes = cborEncode(new Map([[1, -8], ['address', addrBytes]]))
  const sigStructure = cborEncode(['Signature1', protectedBytes, new Uint8Array(0), payloadBytes])
  const sig = ed25519.sign(sigStructure, skBytes)
  const signature = cborEncode([protectedBytes, new Map([['hashed', false]]), payloadBytes, sig])
  const key = cborEncode(new Map([[1, 1], [3, -8], [-1, 6], [-2, pkBytes]]))
  const verifyRes = await api('/api/auth/verify', {
    method: 'POST',
    body: { address, nonce: nonceRes.json.nonce, signature: hex(signature), key: hex(key) }
  })
  return { address, cookie: verifyRes.setCookie.split(';')[0] }
}

function withDb(fn, readOnly = false) {
  const db = new DatabaseSync(DB_PATH, { readOnly })
  if (!readOnly) db.exec('PRAGMA busy_timeout = 5000')
  try { return fn(db) } finally { db.close() }
}

const accountIdOf = address => withDb(db => Number(db.prepare('SELECT id FROM accounts WHERE address = ?').get(address).id), true)
const invQty = (aid, itemId) =>
  withDb(db => Number(db.prepare('SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = ?').get(aid, itemId)?.quantity ?? 0), true)

try {
  const alice = await createAccount()
  const bob = await createAccount()
  const aid = accountIdOf(alice.address)

  // === MỤC 13: ĐÀN CÁ KOI ===
  const k0 = await api('/api/mc/koi/status', { cookie: alice.cookie })
  log('1. Koi status trả 5 chú cá Koi mặc định và 1 lượt ăn miễn phí', k0.status === 200 && k0.json?.koiList?.length === 5 && k0.json?.freeFeedAvailable === true)

  const f1 = await api('/api/mc/koi/feed', { method: 'POST', cookie: alice.cookie, body: { koiIndex: 0 } })
  log('2. Lượt cho ăn đầu tiên trong ngày miễn phí, tăng fedToday=1', f1.status === 200 && f1.json?.usedFree === true && f1.json?.status?.koiList?.[0]?.fedToday === 1)

  const fNoFood = await api('/api/mc/koi/feed', { method: 'POST', cookie: alice.cookie, body: { koiIndex: 0 } })
  log('3. Hết lượt miễn phí mà chưa có cám cá thì từ chối 400 no_koi_food', fNoFood.status === 400 && fNoFood.json?.data?.code === 'no_koi_food')

  // Cấp 2 túi thức ăn cá Koi và 1 hạt giống sen vào kho đồ để test
  withDb(db => {
    const now = Date.now()
    db.prepare(`INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at) VALUES (?, 'koi_food', 'offering', 2, ?, ?)`).run(aid, now, now)
    db.prepare(`INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at) VALUES (?, 'seed_lotus', 'offering', 1, ?, ?)`).run(aid, now, now)
  })

  const f2 = await api('/api/mc/koi/feed', { method: 'POST', cookie: alice.cookie, body: { koiIndex: 0 } })
  log('4. Lượt cho ăn thứ 2 trừ 1 túi cám (còn 1), fedToday=2', f2.status === 200 && f2.json?.usedFree === false && invQty(aid, 'koi_food') === 1 && f2.json?.status?.koiList?.[0]?.fedToday === 2)

  const fFull = await api('/api/mc/koi/feed', { method: 'POST', cookie: alice.cookie, body: { koiIndex: 0 } })
  log('5. Cá đã ăn đủ 2 lần/ngày thì từ chối 400 koi_full_today', fFull.status === 400 && fFull.json?.data?.code === 'koi_full_today')

  const rn1 = await api('/api/mc/koi/rename', { method: 'POST', cookie: alice.cookie, body: { koiIndex: 0, name: 'Kim Long' } })
  const rn2 = await api('/api/mc/koi/rename', { method: 'POST', cookie: alice.cookie, body: { koiIndex: 0, name: 'Ngọc Long' } })
  log('6. Đổi tên cá Koi miễn phí 1 lần và chặn đổi lần 2 (400 rename_already_used)', rn1.status === 200 && rn1.json?.status?.koiList?.[0]?.displayName === 'Kim Long' && rn2.status === 400 && rn2.json?.data?.code === 'rename_already_used')

  // === MỤC 14: VƯỜN THIỀN ===
  const p1 = await api('/api/mc/garden/plant', { method: 'POST', cookie: alice.cookie, body: { plotIndex: 0, seedId: 'seed_lotus' } })
  log('7. Gieo Hạt Giống Sen Hồng vào ô #0 trừ hạt trong kho và đặt stage=1', p1.status === 200 && invQty(aid, 'seed_lotus') === 0 && p1.json?.status?.plots?.[0]?.stage === 1)

  const wSameDay = await api('/api/mc/garden/water', { method: 'POST', cookie: alice.cookie, body: { plotIndex: 0 } })
  log('8. Không thể tưới cùng ngày vừa gieo (400 already_watered_today)', wSameDay.status === 400 && wSameDay.json?.data?.code === 'already_watered_today')

  // Giả lập chuỗi tu tập 3 ngày (streak boost x2) và lùi ngày tưới để tưới lên stage 4 rồi thu hoạch
  withDb(db => {
    db.prepare(`INSERT INTO account_streaks (account_id, current_streak, best_streak, last_day_key, rest_week_key, title, updated_at) VALUES (?, 3, 3, '2026-11-16', NULL, NULL, ?)`).run(aid, Date.now())
    db.prepare(`UPDATE garden_plots SET stage = 3, last_watered_day = '2000-01-01' WHERE account_id = ? AND plot_index = 0`).run(aid)
  })

  const wMature = await api('/api/mc/garden/water', { method: 'POST', cookie: alice.cookie, body: { plotIndex: 0 } })
  log('9. Tưới nước sang ngày mới đưa cây lên stage=4 (canHarvest=true)', wMature.status === 200 && wMature.json?.status?.plots?.[0]?.stage === 4 && wMature.json?.status?.plots?.[0]?.canHarvest === true)

  const h1 = await api('/api/mc/garden/harvest', { method: 'POST', cookie: alice.cookie, body: { plotIndex: 0 } })
  log('10. Thu hoạch Sen Hồng nhận 1 Hoa Đăng Cầu An và giải phóng ô đất', h1.status === 200 && h1.json?.reward?.itemId === 'lotus_lantern' && invQty(aid, 'lotus_lantern') === 1 && h1.json?.status?.plots?.[0]?.seedId === null)

  // === MỤC 4: HỘI THIỀN NHÓM ĐỒNG BỘ ===
  await api('/api/mc/meditation/start', { method: 'POST', cookie: alice.cookie, body: { durationMin: 5, slotId: 1 } })
  const gSolo = await api('/api/mc/meditation/group-bonus', { method: 'POST', cookie: alice.cookie })
  log('11. Ngồi thiền 1 mình chưa đủ điều kiện nhận Lộc Cộng Hưởng (400 need_more_pilgrims)', gSolo.status === 400 && gSolo.json?.data?.code === 'need_more_pilgrims')

  await api('/api/mc/meditation/start', { method: 'POST', cookie: bob.cookie, body: { durationMin: 5, slotId: 2 } })
  const stGroup = await api('/api/mc/meditation/status', { cookie: alice.cookie })
  const gClaim1 = await api('/api/mc/meditation/group-bonus', { method: 'POST', cookie: alice.cookie })
  const gClaim2 = await api('/api/mc/meditation/group-bonus', { method: 'POST', cookie: alice.cookie })
  log(
    '12. Khi >= 2 đồng tu cùng tọa thiền: groupResonanceActive=true, nhận +15 MC Lộc Cộng Hưởng và idempotent khi gọi lại',
    stGroup.json?.groupResonanceActive === true &&
      gClaim1.status === 200 && gClaim1.json?.creditedMc === 15 && gClaim1.json?.mcBalance === 15 &&
      gClaim2.status === 200 && gClaim2.json?.idempotentReplay === true && gClaim2.json?.mcBalance === 15
  )
} catch (e) {
  console.error('Lỗi test:', e)
  log('Test chạy không phát sinh ngoại lệ', false, String(e?.message || e))
} finally {
  await server.stop?.()
}

const passed = results.filter(r => r.ok).length
console.log(`\nTổng kết Upgrades (13, 14, 4): ${passed}/${results.length} test cases PASS`)
process.exit(passed === results.length ? 0 : 1)

