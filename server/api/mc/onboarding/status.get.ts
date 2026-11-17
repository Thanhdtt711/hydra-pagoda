import { getSessionAccount } from '../../../utils/wallet/auth'
import { getOnboardingStatus } from '../../../utils/wallet/onboardingService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** GET /api/mc/onboarding/status: đã nhận quà chào mừng chưa. Khách nhận khung rỗng. */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'mc:onboarding:status', 60, 60_000)
  const account = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await getOnboardingStatus(account?.id ?? null)
})

