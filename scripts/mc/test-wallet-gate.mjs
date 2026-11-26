/**
 * Test Wallet Gate (server/utils/wallet/gate.ts) + audit toàn bộ route /api. Chạy:
 *   node --experimental-strip-types scripts/mc/test-wallet-gate.mjs
 *
 * Kiểm tra:
 * 1. Mọi route trong server/api đều bị chặn mặc định (require-session) trừ allowlist tối thiểu.
 * 2. Allowlist chỉ gồm đúng các endpoint đăng nhập/webhook.
 * 3. Biến thể đường dẫn (query, dấu / cuối, chữ hoa, `..`) không né được cổng.
 * 4. Phương thức đổi trạng thái phải qua kiểm tra Origin; webhook máy-máy được miễn.
 * 5. Middleware tồn tại và gọi getSessionAccount + apiError 401.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const gate = await import(new URL('../../server/utils/wallet/gate.ts', import.meta.url).href)

let pass = 0
let fail = 0
function test(name, fn) {
  try { fn(); pass++; console.log(`  PASS  ${name}`) } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`) }
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

/** server/api/mc/incense/offer.post.ts -> { method: 'POST', path: '/api/mc/incense/offer' } */
function routeOf(file) {
  const rel = relative(join(root, 'server', 'api'), file).split(sep).join('/')
  const m = rel.match(/^(.*?)(?:\.(get|post|put|patch|delete))?\.ts$/)
  let p = '/api/' + m[1].replace(/\/index$/, '').replace(/\[([^\]]+)\]/g, 'x')
  return { method: (m[2] || 'any').toUpperCase(), path: p }
}

const routes = walk(join(root, 'server', 'api')).filter((f) => f.endsWith('.ts')).map(routeOf)

console.log(`Audit ${routes.length} route /api`)
test('Có route để kiểm tra', () => assert.ok(routes.length > 40))

const publicRoutes = routes.filter((r) => gate.isPublicApiPath(r.path))
const protectedRoutes = routes.filter((r) => !gate.isPublicApiPath(r.path))

test('Allowlist công khai chỉ gồm endpoint đăng nhập/webhook', () => {
  const allowed = new Set([
    '/api/auth/nonce', '/api/auth/verify', '/api/auth/me', '/api/auth/logout', '/api/shop/webhook/blockfrost'
  ])
  for (const r of publicRoutes) assert.ok(allowed.has(r.path), `route công khai ngoài dự kiến: ${r.path}`)
})
test('Mọi route còn lại (kể cả mc, npc, shop, hydra, cards) đều cần phiên ví', () => {
  for (const r of protectedRoutes) assert.equal(gate.decideGate(r.path), 'require-session', r.path)
  assert.ok(protectedRoutes.length >= routes.length - 6)
})
test('Các điểm bypass cũ đã bị chặn', () => {
  for (const p of [
    '/api/mc/incense/offer', '/api/mc/hau-dong/heartbeat', '/api/npc/abbot/ask', '/api/npc/abbot/greet',
    '/api/mc/cards/mint/status', '/api/hydra/status', '/api/mc/catalog', '/api/mc/streak/status',
    '/api/mc/meditation/status', '/api/shop/orders', '/api/mc/shop/buy', '/api/mc/merit/donate'
  ]) assert.equal(gate.decideGate(p), 'require-session', p)
})

console.log('Né cổng bằng biến thể đường dẫn')
test('Query, dấu / cuối, chữ hoa không biến route bảo vệ thành công khai', () => {
  for (const p of ['/api/mc/shop/buy?x=1', '/api/mc/shop/buy/', '/API/MC/SHOP/BUY', '/api/mc/shop/buy#frag']) {
    assert.equal(gate.decideGate(p), 'require-session', p)
  }
})
test('Không thể giả allowlist bằng tiền tố hoặc hậu tố', () => {
  for (const p of ['/api/auth/me/../mc/shop/buy', '/api/auth/nonce-evil', '/api/auth', '/api/auth/mex', '/api/shop/webhook/blockfrost2']) {
    assert.equal(gate.decideGate(p), 'require-session', p)
  }
})
test('Đường dẫn ngoài /api không bị chặn bởi cổng (trang tĩnh, assets)', () => {
  for (const p of ['/', '/_nuxt/x.js', '/images/a.png', '/_ws']) assert.equal(gate.decideGate(p), 'not-api', p)
})
test('Biến thể mã hóa %2e không khớp allowlist', () => {
  assert.equal(gate.decideGate('/api/auth/me%2f..%2fmc'), 'require-session')
})

console.log('CSRF / Origin')
test('POST/PUT/PATCH/DELETE phải qua kiểm tra Origin; GET/HEAD/OPTIONS thì không', () => {
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) assert.equal(gate.isStateChangingMethod(m), true, m)
  for (const m of ['GET', 'HEAD', 'OPTIONS']) assert.equal(gate.isStateChangingMethod(m), false, m)
})
test('Chỉ webhook máy-máy được miễn kiểm tra Origin', () => {
  assert.equal(gate.isServerToServerPath('/api/shop/webhook/blockfrost'), true)
  assert.equal(gate.isServerToServerPath('/api/mc/shop/buy'), false)
  assert.equal(gate.isServerToServerPath('/api/auth/verify'), false)
})

console.log('Middleware')
const mw = join(root, 'server', 'middleware', '00.wallet-gate.ts')
test('Middleware tồn tại', () => assert.ok(existsSync(mw)))
test('Middleware dùng getSessionAccount và trả 401 wallet_required', () => {
  const src = readFileSync(mw, 'utf8')
  assert.match(src, /getSessionAccount/)
  assert.match(src, /apiError\(401, 'wallet_required'/)
  assert.match(src, /assertSameOrigin/)
})

console.log('WebSocket')
test('_ws.ts từ chối client:join không có vé hợp lệ', () => {
  const src = readFileSync(join(root, 'server', 'routes', '_ws.ts'), 'utf8')
  assert.match(src, /wallet_required/)
  assert.doesNotMatch(src, /Khách \$\{requestedId/)
})

console.log('Handler cũ')
test('incense/offer không còn nhánh khách trả thưởng giả', () => {
  const src = readFileSync(join(root, 'server', 'api', 'mc', 'incense', 'offer.post.ts'), 'utf8')
  assert.match(src, /requireSession/)
  assert.doesNotMatch(src, /authenticated: false/)
})

console.log(`\n${pass} PASS / ${fail} FAIL`)
process.exit(fail ? 1 : 0)
