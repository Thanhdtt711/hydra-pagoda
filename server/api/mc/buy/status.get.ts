import { defineEventHandler, getQuery } from 'h3'
import { apiError, requireSession } from '../../../utils/wallet/auth'
import { getMcQuoteStatus } from '../../../utils/mc/purchaseService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const q = getQuery(event)
  const quoteId = typeof q.quoteId === 'string' ? q.quoteId.trim() : ''
  if (!quoteId) apiError(400, 'missing_quote_id', 'Thiếu quoteId')
  return getMcQuoteStatus(account, quoteId)
})
