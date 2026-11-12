/**
 * Đăng nhập bằng ví Cardano (CIP-30 / CIP-8): nonce -> ký -> verify -> session cookie.
 *
 * Nguyên tắc: server KHÔNG bao giờ tin địa chỉ client khai báo. Danh tính (`address`) chỉ
 * được cấp sau khi chữ ký ed25519 trên đúng thông điệp server đã phát hành được xác minh.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { blake2b224, bytesEqual, decodeBech32Address, encodeBech32Address, addressNetworkId,
  paymentKeyHashFromAddress, verifyCoseSign1 } from './cose'
import { getWalletConfig } from './config'
import { getDb, withTransaction } from './db'

export const SESSION_COOKIE = 'pagoda_session'
const NONCE_TTL_MS = 5 * 60_000 // nonce hết hạn sau 5 phút
const WS_TICKET_TTL_MS = 60_000 // vé WS sống 60 giây, dùng một lần
const GAME_NAME = 'Vạn Cảnh Thiền Tự'

export interface PublicAccount {
  id: number
  address: string
  displayName: string
  walletDisplayName: string
  fortuneName: string | null
  mcBalance: number
}

interface AccountRow {
  id: number
  address: string
  display_name: string
  fortune_name?: string | null
  mc_balance: number
}

/** Ném lỗi HTTP có mã máy-đọc-được (`data.code`) để client hiển thị đúng thông báo. */
export function apiError(statusCode: number, code: string, message: string): never {
  throw createError({ statusCode, message, statusMessage: message.length > 64 ? code : message, data: { code, message } })
}

const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex')
const toPublic = (r: AccountRow): PublicAccount => {
  const fortuneName = r.fortune_name && r.fortune_name.trim() ? r.fortune_name.trim() : null
  return {
    id: r.id,
    address: r.address,
    displayName: fortuneName || r.display_name,
    walletDisplayName: r.display_name,
    fortuneName,
    mcBalance: r.mc_balance
  }
}
const shortAddress = (a: string) => `${a.slice(0, 10)}…${a.slice(-4)}`

export function requestHost(event: H3Event): string {
  return getRequestHost(event, { xForwardedHost: getWalletConfig().trustProxy })
}

/**
 * Chống CSRF cho endpoint đổi trạng thái: trình duyệt luôn gửi Origin trên POST chéo trang.
 * Cookie SameSite=Strict đã chặn phần lớn; đây là lớp thứ hai.
 */
export function assertSameOrigin(event: H3Event) {
  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    let host = ''
    try { host = new URL(origin).host } catch { /* bỏ qua, xử lý bên dưới */ }
    if (host !== requestHost(event)) apiError(403, 'bad_origin', 'Nguồn yêu cầu không hợp lệ')
    return
  }
  const site = getRequestHeader(event, 'sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') apiError(403, 'bad_origin', 'Nguồn yêu cầu không hợp lệ')
}

/** Dựng thông điệp người dùng đọc được và sẽ ký. Nội dung rõ ràng: game, domain, nonce, thời gian. */
function buildLoginMessage(p: { domain: string; address: string; network: string; nonce: string; issuedAt: number; expiresAt: number }) {
  return [
    `${GAME_NAME} - Đăng nhập bằng ví Cardano`,
    `Domain: ${p.domain}`,
    `Địa chỉ: ${p.address}`,
    `Mạng: ${p.network === 'mainnet' ? 'Mainnet' : 'Preprod (Testnet)'}`,
    `Nonce: ${p.nonce}`,
    `Phát hành: ${new Date(p.issuedAt).toISOString()}`,
    `Hết hạn: ${new Date(p.expiresAt).toISOString()}`,
    'Chữ ký này chỉ xác minh quyền sở hữu ví. Không tốn phí và không gửi giao dịch.'
  ].join('\n')
}

/** Kiểm tra chuỗi bech32 hợp lệ + đúng mạng đang cấu hình. Trả về byte địa chỉ. */
function parseAddressForNetwork(address: unknown): { bytes: Uint8Array; bech32: string } {
  if (typeof address !== 'string' || address.length < 20 || address.length > 130) {
    apiError(400, 'bad_address', 'Địa chỉ không hợp lệ')
  }
  let bytes: Uint8Array
  try { bytes = decodeBech32Address(address) } catch { apiError(400, 'bad_address', 'Địa chỉ không hợp lệ') }
  if (addressNetworkId(bytes) !== getWalletConfig().networkId) {
    apiError(400, 'wrong_network', 'Ví đang ở sai mạng so với game')
  }
  try { paymentKeyHashFromAddress(bytes) } catch { apiError(400, 'unsupported_address', 'Loại địa chỉ ví không được hỗ trợ') }
  return { bytes, bech32: encodeBech32Address(bytes) }
}

/**
 * Phát hành nonce dùng một lần (hết hạn 5 phút) cho một địa chỉ. Lưu cả thông điệp đã phát
 * hành để lúc verify so khớp từng byte với thứ ví thực sự ký.
 */
export async function issueNonce(event: H3Event, addressInput: unknown) {
  const cfg = getWalletConfig()
  const { bech32 } = parseAddressForNetwork(addressInput)
  const now = Date.now()
  const nonce = randomBytes(16).toString('hex')
  const domain = requestHost(event)
  const message = buildLoginMessage({ domain, address: bech32, network: cfg.network, nonce, issuedAt: now, expiresAt: now + NONCE_TTL_MS })
  const db = await getDb()
  // Dọn dữ liệu hết hạn cơ hội (rẻ, tránh cần cron riêng).
  await db.prepare('DELETE FROM auth_nonces WHERE expires_at < ?').run(now - 3600_000)
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
  await db.prepare('DELETE FROM ws_tickets WHERE expires_at < ?').run(now - 3600_000)
  await db.prepare('INSERT INTO auth_nonces (nonce, address, domain, message, issued_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nonce, bech32, domain, message, now, now + NONCE_TTL_MS)
  return { nonce, message, address: bech32, expiresAt: now + NONCE_TTL_MS, network: cfg.network }
}

export interface LoginInput {
  address: unknown
  nonce: unknown
  signature: unknown
  key: unknown
}

const isHex = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max && /^[0-9a-fA-F]+$/.test(v)

/**
 * Xác minh đăng nhập. Mọi nhánh lỗi đều trả 401 chung chung (không lộ bước nào sai) và
 * nonce bị "đốt" ngay từ đầu nên không thể thử lại/replay.
 */
export async function verifyLogin(event: H3Event, input: LoginInput): Promise<PublicAccount> {
  if (typeof input.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(input.nonce)) apiError(400, 'bad_request', 'Thiếu hoặc sai nonce')
  if (!isHex(input.signature, 8192) || !isHex(input.key, 2048)) apiError(400, 'bad_request', 'Thiếu chữ ký')
  const { bech32: claimedAddress } = parseAddressForNetwork(input.address)
  const cfg = getWalletConfig()
  const now = Date.now()
  const fail = (): never => apiError(401, 'auth_failed', 'Xác thực chữ ký thất bại')

  // 1) Đốt nonce nguyên tử: chỉ một yêu cầu thắng, nonce hết hạn/đã dùng đều bị từ chối.
  const row = await withTransaction(async conn => {
    const r = await conn.prepare('SELECT * FROM auth_nonces WHERE nonce = ?').get(input.nonce as string) as
      | { address: string; domain: string; message: string; expires_at: number; used_at: number | null } | undefined
    if (!r) return null
    const upd = await conn.prepare('UPDATE auth_nonces SET used_at = ? WHERE nonce = ? AND used_at IS NULL AND expires_at > ?')
      .run(now, input.nonce as string, now)
    return Number(upd.changes) === 1 ? r : null
  })
  if (!row) return fail()

  // 2) Nonce phát hành cho đúng địa chỉ này, đúng domain này.
  if (row.address !== claimedAddress) return fail()
  if (row.domain !== requestHost(event)) return fail()

  // 3) Xác minh COSE: chữ ký hợp lệ, đúng mạng, khóa công khai khớp địa chỉ.
  let res
  try { res = verifyCoseSign1(input.signature as string, input.key as string) } catch { return fail() }
  if (!res.valid) return fail()
  if (addressNetworkId(res.addressBytes) !== cfg.networkId) return fail()
  let keyHash: Uint8Array
  try { keyHash = paymentKeyHashFromAddress(res.addressBytes) } catch { return fail() }
  if (!bytesEqual(blake2b224(res.publicKey), keyHash)) return fail()
  // Địa chỉ trong chữ ký phải đúng là địa chỉ đã xin nonce (chặn ký bằng ví khác).
  if (encodeBech32Address(res.addressBytes) !== row.address) return fail()

  // 4) Chữ ký phải phủ ĐÚNG thông điệp đã phát hành (không phải thông điệp tùy ý).
  const expected = new TextEncoder().encode(row.message)
  const signedPayload = res.hashed ? blake2b224(expected) : expected
  if (!bytesEqual(signedPayload, res.payload)) return fail()

  // 5) Tạo/nạp tài khoản theo địa chỉ ĐÃ XÁC THỰC.
  return withTransaction(async conn => {
    await conn.prepare(
      `INSERT INTO accounts (address, display_name, created_at, last_login_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(address) DO UPDATE SET last_login_at = excluded.last_login_at`
    ).run(row.address, shortAddress(row.address), now, now)
    const acc = await conn.prepare('SELECT id, address, display_name, fortune_name, mc_balance FROM accounts WHERE address = ?').get(row.address) as unknown as AccountRow
    return toPublic(acc)
  })
}

function isRequestHttps(event: H3Event): boolean {
  return getRequestProtocol(event, { xForwardedProto: true }) === 'https'
}

function extractSessionToken(event: H3Event): string | null {
  const auth = getRequestHeader(event, 'authorization')
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim()
    if (t && t.length <= 200) return t
  }
  const cookieToken = getCookie(event, SESSION_COOKIE)
  if (cookieToken && cookieToken.length <= 200) return cookieToken
  return null
}

/** Tạo phiên mới và đặt cookie httpOnly (hỗ trợ cả iframe cross-site SameSite=None). Token ngẫu nhiên 256-bit; DB chỉ giữ hash. */
export async function startSession(event: H3Event, accountId: number): Promise<string> {
  const cfg = getWalletConfig()
  const now = Date.now()
  // Xoay phiên: hủy phiên cũ của trình duyệt này (chống session fixation).
  await destroySession(event)
  const token = randomBytes(32).toString('base64url')
  const db = await getDb()
  await db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256Hex(token), accountId, now, now + cfg.sessionTtlMs)
  const isHttps = isRequestHttps(event)
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: Math.floor(cfg.sessionTtlMs / 1000)
  })
  return token
}

/** Trả tài khoản của phiên hiện tại, hoặc null nếu không có/hết hạn. */
export async function getSessionAccount(event: H3Event): Promise<PublicAccount | null> {
  const token = extractSessionToken(event)
  if (!token) return null
  const db = await getDb()
  const row = await db.prepare(
    `SELECT a.id, a.address, a.display_name, a.fortune_name, a.mc_balance, s.expires_at
       FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?`
  ).get(sha256Hex(token)) as unknown as (AccountRow & { expires_at: number }) | undefined
  if (!row || row.expires_at <= Date.now()) return null
  return toPublic(row)
}

/** Bắt buộc đăng nhập; ném 401 nếu không có phiên hợp lệ. */
export async function requireSession(event: H3Event): Promise<PublicAccount> {
  const acc = await getSessionAccount(event)
  if (!acc) apiError(401, 'unauthenticated', 'Chưa đăng nhập hoặc phiên đã hết hạn')
  return acc
}

/** Xóa phiên hiện tại ở DB và cookie (đăng xuất an toàn). */
export async function destroySession(event: H3Event) {
  const token = extractSessionToken(event)
  if (token) {
    const db = await getDb()
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256Hex(token))
  }
  const isHttps = isRequestHttps(event)
  deleteCookie(event, SESSION_COOKIE, { path: '/', sameSite: isHttps ? 'none' : 'lax', secure: isHttps })
}

/** Phát vé WS một lần (60s) cho tài khoản đã đăng nhập. */
export async function issueWsTicket(accountId: number): Promise<string> {
  const ticket = randomBytes(24).toString('base64url')
  const db = await getDb()
  await db.prepare('INSERT INTO ws_tickets (ticket_hash, account_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256Hex(ticket), accountId, Date.now() + WS_TICKET_TTL_MS)
  return ticket
}

/**
 * Đổi vé WS lấy tài khoản (dùng trong `_ws.ts`). Dùng một lần: UPDATE có điều kiện đảm bảo
 * vé bị lấy trộm/phát lại không dùng được lần hai.
 */
export async function consumeWsTicket(ticket: unknown): Promise<PublicAccount | null> {
  if (typeof ticket !== 'string' || ticket.length > 100) return null
  const now = Date.now()
  const h = sha256Hex(ticket)
  return withTransaction(async conn => {
    const upd = await conn.prepare('UPDATE ws_tickets SET used_at = ? WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?').run(now, h, now)
    if (Number(upd.changes) !== 1) return null
    const row = await conn.prepare(
      `SELECT a.id, a.address, a.display_name, a.fortune_name, a.mc_balance FROM ws_tickets t JOIN accounts a ON a.id = t.account_id WHERE t.ticket_hash = ?`
    ).get(h) as unknown as AccountRow | undefined
    return row ? toPublic(row) : null
  })
}

/** Chuẩn hóa & lưu họ tên từ hồ sơ Bói Quẻ cho tài khoản (null -> xóa về tên mặc định ví). */
export async function setAccountFortuneName(accountId: number, rawFullName: string | null): Promise<PublicAccount | null> {
  const cleaned = typeof rawFullName === 'string'
    ? rawFullName.replace(/[\x00-\x1F\x7F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
    : ''
  const nextValue = cleaned && !cleaned.startsWith('addr_') ? cleaned : null
  const db = await getDb()
  await db.prepare('UPDATE accounts SET fortune_name = ? WHERE id = ?').run(nextValue, accountId)
  const row = await db.prepare('SELECT id, address, display_name, fortune_name, mc_balance FROM accounts WHERE id = ?').get(accountId) as unknown as AccountRow | undefined
  return row ? toPublic(row) : null
}

