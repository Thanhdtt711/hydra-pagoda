import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { claimGroupMeditationBonus } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/meditation/group-bonus: nhận Lộc Cộng Hưởng Đồng Tu (+15 MC) khi có >= 2 hành giả cùng tọa thiền. */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:meditation:group-bonus', 20, 60_000)
  const account = await requireSession(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await claimGroupMeditationBonus(account.id)
})

