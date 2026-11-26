/**
 * Wallet Gate (cổng ví) - quyết định API nào được gọi khi CHƯA đăng nhập ví.
 * Hàm thuần để kiểm thử độc lập (scripts/mc/test-wallet-gate.mjs).
 *
 * Nguyên tắc: mặc định TỪ CHỐI. Chỉ những đường dẫn trong allowlist dưới đây được qua mà không cần phiên ví.
 */

/** Đường dẫn công khai khớp CHÍNH XÁC (không cần phiên ví). */
export const PUBLIC_API_EXACT: ReadonlySet<string> = new Set([
  '/api/auth/nonce', // xin nonce để ký đăng nhập
  '/api/auth/verify', // nộp chữ ký CIP-8 để lấy phiên
  '/api/auth/me', // trả authenticated:false khi chưa đăng nhập (không kèm dữ liệu)
  '/api/auth/logout', // đăng xuất luôn được phép
  '/api/shop/webhook/blockfrost' // máy chủ Blockfrost gọi vào, tự xác thực bằng webhookSecret
])

/** Đường dẫn công khai khớp theo tiền tố. */
export const PUBLIC_API_PREFIXES: readonly string[] = []

/** Đường dẫn gọi từ máy chủ sang máy chủ: không áp kiểm tra Origin (CSRF) vì không đến từ trình duyệt. */
export const SERVER_TO_SERVER_EXACT: ReadonlySet<string> = new Set(['/api/shop/webhook/blockfrost'])

/** Chuẩn hóa path: bỏ query, bỏ dấu `/` cuối, chữ thường. */
export function normalizeApiPath(rawPath: string): string {
  const noQuery = rawPath.split('?')[0]!.split('#')[0]!
  const trimmed = noQuery.length > 1 ? noQuery.replace(/\/+$/, '') : noQuery
  return trimmed.toLowerCase()
}

/** Có phải route API nội bộ cần được bảo vệ hay không. */
export function isApiPath(rawPath: string): boolean {
  const p = normalizeApiPath(rawPath)
  return p === '/api' || p.startsWith('/api/')
}

/** true nếu đường dẫn được gọi KHÔNG cần phiên ví. */
export function isPublicApiPath(rawPath: string): boolean {
  const p = normalizeApiPath(rawPath)
  if (PUBLIC_API_EXACT.has(p)) return true
  return PUBLIC_API_PREFIXES.some((prefix) => p.startsWith(prefix))
}

export function isServerToServerPath(rawPath: string): boolean {
  return SERVER_TO_SERVER_EXACT.has(normalizeApiPath(rawPath))
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Phương thức làm thay đổi trạng thái -> phải qua kiểm tra Origin chống CSRF. */
export function isStateChangingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
}

export type GateDecision = 'public' | 'require-session' | 'not-api'

export function decideGate(rawPath: string): GateDecision {
  if (!isApiPath(rawPath)) return 'not-api'
  return isPublicApiPath(rawPath) ? 'public' : 'require-session'
}
