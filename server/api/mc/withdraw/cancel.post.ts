import { defineEventHandler, readBody } from 'h3'
import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { cancelAndRefundWithdraw } from '../../../utils/mc/withdrawService'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const account = await requireSession(event)
  const body = (await readBody(event).catch(() => ({}))) || {}
  return cancelAndRefundWithdraw(account, String(body.withdrawId || ''), 'user_cancelled')
})
