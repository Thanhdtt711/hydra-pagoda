// Kiểm thử Onboarding qua API thật: khách không nhận quà, quà chào mừng chỉ nhận một lần, không sinh MC.
// Yêu cầu đã build: npm run build. Chạy: node --experimental-strip-types scripts/wallet/test-onboarding.mjs
import { DatabaseSync } from 'node:sqlite'
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { CardanoWASM as C } from '@hydra-sdk/cardano-wasm'
import { startTestServer } from './_server.mjs'

const PORT = Number(process.env.PORT || 3019)
const DB_PATH = process.env.DB_PATH || './.data/test-onboarding.sqlite'
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

function withDb(fn) {
  const db = new DatabaseSync(DB_PATH, { readOnly: true })
  try { return fn(db) } finally { db.close() }
}
const accountIdOf = address => withDb(db => Number(db.prepare('SELECT id FROM accounts WHERE address = ?').get(address).id))
const lanterns = id => withDb(db => Number(db.prepare("SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = 'lotus_lantern'").get(id)?.quantity ?? 0))
const balance = id => withDb(db => Number(db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(id).mc_balance))

try {
  const guest = await api('/api/mc/onboarding/status')
  log('1. Khách xem được trạng thái, chưa nhận quà', guest.status === 200 && guest.json?.authenticated === false && guest.json?.rewardClaimed === false)

  const unauth = await api('/api/mc/onboarding/complete', { method: 'POST' })
  log('2. Từ chối nhận quà khi chưa đăng nhập (401)', unauth.status === 401, `status=${unauth.status}`)

  const alice = await createAccount()
  const aid = accountIdOf(alice.address)
  const st0 = await api('/api/mc/onboarding/status', { cookie: alice.cookie })
  log('3. Người chơi mới chưa nhận quà', st0.json?.authenticated === true && st0.json?.rewardClaimed === false)

  const balBefore = balance(aid)
  const r1 = await api('/api/mc/onboarding/complete', { method: 'POST', cookie: alice.cookie })
  log('4. Lần đầu nhận 1 Hoa Đăng Cầu An', r1.status === 200 && r1.json?.granted === true && lanterns(aid) === 1, `qty=${lanterns(aid)}`)

  const r2 = await api('/api/mc/onboarding/complete', { method: 'POST', cookie: alice.cookie })
  log('5. Gọi lại không nhận thêm (idempotent)', r2.status === 200 && r2.json?.granted === false && lanterns(aid) === 1, `qty=${lanterns(aid)}`)

  const st1 = await api('/api/mc/onboarding/status', { cookie: alice.cookie })
  log('6. Trạng thái báo đã nhận quà', st1.json?.rewardClaimed === true)

  log('7. Quà không sinh MC', balance(aid) === balBefore, `balance=${balance(aid)}`)
} catch (e) {
  console.error('Lỗi test:', e)
  log('Test chạy không phát sinh ngoại lệ', false, String(e?.message || e))
} finally {
  await server.stop?.()
}

const passed = results.filter(r => r.ok).length
console.log(`\nTổng kết Onboarding: ${passed}/${results.length} test cases PASS`)
process.exit(passed === results.length ? 0 : 1)

