import { defineEventHandler } from 'h3'
import { requireSession } from '../../utils/wallet/auth'
import { getMcMarketInfo } from '../../utils/mc/purchaseService'
import { getQuestFundStatus } from '../../utils/mc/questRewards'

export default defineEventHandler(async (event) => {
  await requireSession(event)
  const [sale, quest] = await Promise.all([getMcMarketInfo(), getQuestFundStatus()])
  return { sale, quest }
})
