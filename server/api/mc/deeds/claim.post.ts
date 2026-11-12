import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { claimDailyDeedReward, getDailyDeedsStatus } from '../../../utils/wallet/deedService'
import { getAccountInventory } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/deeds/claim
 * Nhận quà khi đủ ba việc lành hôm nay. Idempotent theo ngày. Quà là vật phẩm, không cộng MC.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:deeds:claim', 20, 60_000)
  const account = await requireSession(event)

  const res = await claimDailyDeedReward(account.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    granted: res.granted,
    reward: { itemId: res.itemId, label: res.label },
    status: await getDailyDeedsStatus(account.id),
    inventory: await getAccountInventory(account.id)
  }
})
