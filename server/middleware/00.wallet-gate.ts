/**
 * Server middleware: Wallet Gate. Chạy TRƯỚC mọi handler /api/**.
 * - Không có phiên ví hợp lệ => 401 `wallet_required` (trừ allowlist trong utils/wallet/gate.ts).
 * - Mọi phương thức đổi trạng thái (POST/PUT/PATCH/DELETE) phải cùng Origin (chống CSRF).
 * - Gắn `event.context.account` để handler dùng lại, tránh truy vấn phiên hai lần.
 */
import { defineEventHandler, getRequestURL, getMethod } from 'h3'
import { apiError, assertSameOrigin, getSessionAccount } from '../utils/wallet/auth'
import { decideGate, isServerToServerPath, isStateChangingMethod } from '../utils/wallet/gate'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname
  const decision = decideGate(path)
  if (decision === 'not-api') return

  const method = getMethod(event)
  if (isStateChangingMethod(method) && !isServerToServerPath(path)) {
    assertSameOrigin(event)
  }

  if (decision === 'public') return

  const account = await getSessionAccount(event)
  if (!account) {
    apiError(401, 'wallet_required', 'Cần kết nối ví Cardano để sử dụng tính năng này')
  }
  event.context.account = account
})
