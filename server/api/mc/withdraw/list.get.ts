import { defineEventHandler } from 'h3'
import { requireSession } from '../../../utils/wallet/auth'
import { listAccountWithdrawals } from '../../../utils/mc/withdrawService'

/** GET /api/mc/withdraw/list — Lịch sử rút MC (L2 -> L1) của ví đang đăng nhập. */
export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  return { withdrawals: await listAccountWithdrawals(account) }
})
