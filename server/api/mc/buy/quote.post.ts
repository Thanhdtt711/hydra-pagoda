import { defineEventHandler, readBody } from 'h3'
import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { rateLimit } from '../../../utils/wallet/rateLimit'
import { createMcQuote } from '../../../utils/mc/purchaseService'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const account = await requireSession(event)
  rateLimit(event, `mc:buy:quote:${account.id}`, 30, 60_000)
  const body = (await readBody(event).catch(() => ({}))) || {}
  return createMcQuote(account, body)
})
