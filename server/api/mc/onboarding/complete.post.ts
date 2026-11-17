import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { getAccountInventory } from '../../../utils/wallet/mcService'
import { completeOnboarding } from '../../../utils/wallet/onboardingService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/onboarding/complete: nhận 1 Hoa Đăng Cầu An chào mừng, tối đa một lần mỗi tài khoản. */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:onboarding:complete', 10, 60_000)
  const account = await requireSession(event)
  const res = await completeOnboarding(account.id)
  const inventory = await getAccountInventory(account.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, granted: res.granted, reward: res.reward, inventory }
})

