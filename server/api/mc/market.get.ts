import { defineEventHandler } from 'h3'
import { requireSession } from '../../utils/wallet/auth'
import { getMcMarketInfo } from '../../utils/mc/purchaseService'

export default defineEventHandler(async (event) => {
  await requireSession(event)
  return getMcMarketInfo()
})
