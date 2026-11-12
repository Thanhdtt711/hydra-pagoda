import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { claimStreakMark, getStreakStatus } from '../../../utils/wallet/streakService'
import { getAccountInventory } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/streak/claim
 * Ghi dấu hôm nay vào Sổ Tu Tập nếu đã có việc lành. Server tự kiểm tra việc lành từ dữ liệu sẵn có, client không
 * gửi gì. Idempotent theo ngày. Quà cột mốc là vật phẩm, thẻ hoặc danh hiệu, không cộng MC.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:streak:claim', 20, 60_000)
  const account = await requireSession(event)

  const res = await claimStreakMark(account.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    outcome: res.outcome,
    rewards: res.rewards,
    status: await getStreakStatus(account.id),
    inventory: await getAccountInventory(account.id)
  }
})
