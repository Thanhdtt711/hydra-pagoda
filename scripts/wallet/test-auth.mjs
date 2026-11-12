// Kiểm thử đăng nhập ví + tấn công giả mạo. Yêu cầu đã build: npm run build.
// Chạy: node scripts/wallet/test-auth.mjs
// Mặc định test tự dựng server (cổng 3017) với DB thử. Đặt BASE_URL (và DB_PATH) để chạy với server có sẵn.
// Giả lập ví CIP-30: dựng COSE_Sign1/COSE_Key đúng chuẩn CIP-8 bằng khóa ed25519 ngẫu nhiên.
// Không dùng khóa/seed thật nào. Biến DB_PATH (tùy chọn khi dùng server có sẵn) để test nonce hết hạn.
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
import { bech32 } from '@scure/base'
import { encode as cborEncode } from 'cbor2'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { startTestServer } from './_server.mjs'

const SPAWN = !process.env.BASE_URL
const PORT = Number(process.env.PORT || 3017)
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`
const DB_PATH = process.env.DB_PATH || (SPAWN ? './.data/test-auth.sqlite' : undefined)
const HOST = new URL(BASE).host
const testServer = SPAWN ? await startTestServer({ port: PORT, dbPath: DB_PATH }) : null
const results = []
const hex = b => Buffer.from(b).toString('hex')
const log = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${info ? ' — ' + info : ''}`) }

function makeWallet(networkId = 0) {
  const sk = ed25519.utils.randomPrivateKey()
  const pk = ed25519.getPublicKey(sk)
  const keyHash = blake2b(pk, { dkLen: 28 })
  // địa chỉ enterprise (loại 6) = header 0x60|net + payment key hash
  const addr = new Uint8Array(29); addr[0] = 0x60 | networkId; addr.set(keyHash, 1)
  const bech = bech32.encode(networkId === 1 ? 'addr' : 'addr_test', bech32.toWords(addr), 1023)
  return { sk, pk, addr, bech }
}

/** Mô phỏng CIP-30 signData: COSE_Sign1 [protected{1:-8,address}, {}, payload, sig] + COSE_Key */
function signData(signer, addrBytes, payloadBytes) {
  const protectedBytes = cborEncode(new Map([[1, -8], ['address', addrBytes]]))
  const sigStructure = cborEncode(['Signature1', protectedBytes, new Uint8Array(0), payloadBytes])
  const sig = ed25519.sign(sigStructure, signer.sk)
  const signature = cborEncode([protectedBytes, new Map([['hashed', false]]), payloadBytes, sig])
  const key = cborEncode(new Map([[1, 1], [3, -8], [-1, 6], [-2, signer.pk]]))
  return { signature: hex(signature), key: hex(key) }
}

async function api(path, { method = 'GET', body, cookie, origin } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  if (origin !== null) headers.origin = origin ?? BASE
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
}

async function login(wallet, { mutate } = {}) {
  const n = await api('/api/auth/nonce', { method: 'POST', body: { address: wallet.bech } })
  if (n.status !== 200) return { n }
  const payload = new TextEncoder().encode(n.json.message)
  const signed = signData(wallet, wallet.addr, payload)
  const body = { address: wallet.bech, nonce: n.json.nonce, ...signed, ...(mutate ? mutate(n.json, signed) : {}) }
  const v = await api('/api/auth/verify', { method: 'POST', body })
  return { n, v, body }
}

const A = makeWallet(0)

// 1. Đăng nhập hợp lệ
const ok = await login(A)
log('Đăng nhập hợp lệ (nonce → ký CIP-8 → verify)', ok.v?.status === 200 && ok.v.json?.account?.address === A.bech, `status=${ok.v?.status}`)
const cookieHeader = ok.v?.setCookie || ''
// Server đặt SameSite theo giao thức (auth.ts startSession): HTTP -> Lax, HTTPS -> None + Secure (hỗ trợ iframe cross-site).
const isHttpsBase = BASE.startsWith('https:')
const sameSiteOk = isHttpsBase
  ? /SameSite=None/i.test(cookieHeader) && /;\s*Secure/i.test(cookieHeader)
  : /SameSite=Lax/i.test(cookieHeader) && !/;\s*Secure/i.test(cookieHeader)
log(
  `Cookie phiên httpOnly + SameSite đúng giao thức (${isHttpsBase ? 'None+Secure' : 'Lax'})`,
  /HttpOnly/i.test(cookieHeader) && sameSiteOk,
  cookieHeader.replace(/pagoda_session=[^;]+/, 'pagoda_session=<ẩn>')
)
const cookie = cookieHeader.split(';')[0]
const me = await api('/api/auth/me', { cookie })
log('Tải lại trang: /api/auth/me giữ phiên + số dư MC', me.json?.authenticated === true && me.json.account.mcBalance === 0, `mc=${me.json?.account?.mcBalance}`)
log('Message ký có tên game/domain/nonce/thời gian', ['Vạn Cảnh Thiền Tự', 'Domain:', 'Nonce:', 'Phát hành:', 'Hết hạn:'].every(s => ok.n.json.message.includes(s)))
log('Domain trong message = host server', ok.n.json.message.includes(`Domain: ${HOST}`))

// 2. Replay nonce cũ
const replay = await api('/api/auth/verify', { method: 'POST', body: ok.body })
log('Chặn replay: dùng lại nonce đã dùng', replay.status === 401, `status=${replay.status}`)

// 3. Ký bằng ví khác (kẻ tấn công B tuyên bố địa chỉ của A)
const B = makeWallet(0)
const forged = await login(A, {
  mutate: (n) => signData(B, A.addr, new TextEncoder().encode(n.message)) // khóa B, header address A
})
log('Chặn ký bằng ví khác (key B, địa chỉ A)', forged.v?.status === 401, `status=${forged.v?.status}`)

// 4. Chữ ký trên thông điệp khác
const altered = await login(A, {
  mutate: () => signData(A, A.addr, new TextEncoder().encode('Chuyển hết MC cho tôi'))
})
log('Chặn chữ ký trên thông điệp khác', altered.v?.status === 401, `status=${altered.v?.status}`)

// 5. Nonce hết hạn (chỉnh DB thử)
if (DB_PATH) {
  const n = await api('/api/auth/nonce', { method: 'POST', body: { address: A.bech } })
  const db = new DatabaseSync(DB_PATH)
  db.prepare('UPDATE auth_nonces SET expires_at = ? WHERE nonce = ?').run(Date.now() - 1000, n.json.nonce)
  db.close()
  const signed = signData(A, A.addr, new TextEncoder().encode(n.json.message))
  const v = await api('/api/auth/verify', { method: 'POST', body: { address: A.bech, nonce: n.json.nonce, ...signed } })
  log('Chặn nonce hết hạn (>5 phút)', v.status === 401, `status=${v.status}`)
} else {
  log('Chặn nonce hết hạn (bỏ qua: thiếu DB_PATH)', true, 'SKIPPED')
}

// 6. Địa chỉ khai báo khác địa chỉ trong chữ ký/nonce
const C = makeWallet(0)
const mism = await login(A, { mutate: () => ({ address: C.bech }) })
log('Chặn địa chỉ khai báo ≠ địa chỉ đã xin nonce', mism.v?.status === 401, `status=${mism.v?.status}`)

// 7. Sai mạng (địa chỉ mainnet khi server chạy preprod)
const M = makeWallet(1)
const wrongNet = await api('/api/auth/nonce', { method: 'POST', body: { address: M.bech } })
log('Từ chối địa chỉ sai mạng (mainnet vs preprod)', wrongNet.status === 400 && wrongNet.json?.data?.code === 'wrong_network', `status=${wrongNet.status}`)

// 8. Origin giả (CSRF)
const csrf = await api('/api/auth/nonce', { method: 'POST', body: { address: A.bech }, origin: 'https://evil.example' })
log('Chặn Origin lạ (CSRF)', csrf.status === 403, `status=${csrf.status}`)

// 9. Vé WebSocket
const noSession = await api('/api/auth/ws-ticket', { method: 'POST' })
log('ws-ticket yêu cầu đăng nhập', noSession.status === 401)
const t1 = await api('/api/auth/ws-ticket', { method: 'POST', cookie })
log('ws-ticket cấp được khi có phiên', t1.status === 200 && typeof t1.json?.ticket === 'string')

function wsJoin(extra) {
  return new Promise((resolve) => {
    const ws = new WebSocket(BASE.replace('http', 'ws') + '/_ws')
    const events = []
    ws.onmessage = (e) => { try { events.push(JSON.parse(e.data)) } catch {} }
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'client:join', id: 'p_' + hex(randomBytes(3)), name: 'Hacker<Admin>', title: 't', country: 'vietnam', position: [0, 0, 10], yaw: 0, ...extra }))
      setTimeout(() => ws.send(JSON.stringify({ type: 'client:chat', name: 'FakeName', text: 'xin chào' })), 150)
      setTimeout(() => { ws.close(); resolve(events) }, 700)
    }
  })
}
const guest = await wsJoin({})
const guestAck = guest.find(e => e.type === 'server:ack_join')
log('WS khách: tên giả bị ghi đè "Khách xxxx"', !!guestAck && guest.some(e => e.type === 'server:chat' && /^Khách /.test(e.name)), guest.find(e => e.type === 'server:chat')?.name)
const authed = await wsJoin({ ticket: t1.json.ticket })
const authedChat = authed.find(e => e.type === 'server:chat')
log('WS đã xác thực: tên do server đặt theo tài khoản', authedChat?.name === ok.v.json.account.displayName, authedChat?.name)
const reuse = await wsJoin({ ticket: t1.json.ticket })
log('WS: vé dùng lại bị từ chối', reuse.some(e => e.type === 'server:error' && e.code === 'bad_ticket'))

// 10. Đăng xuất hủy phiên
const out = await api('/api/auth/logout', { method: 'POST', cookie })
const me2 = await api('/api/auth/me', { cookie })
log('Đăng xuất hủy phiên phía server (cookie cũ vô hiệu)', out.status === 200 && me2.json?.authenticated === false)

// 11. Rate limit
let limited = false
for (let i = 0; i < 15 && !limited; i++) {
  const r = await api('/api/auth/nonce', { method: 'POST', body: { address: A.bech } })
  if (r.status === 429) limited = true
}
log('Rate limit /api/auth/nonce trả 429', limited)

const failed = results.filter(r => !r.ok).length
console.log(`\nKẾT QUẢ: ${results.length - failed}/${results.length} đạt`)
await testServer?.stop()
process.exit(failed ? 1 : 0)

