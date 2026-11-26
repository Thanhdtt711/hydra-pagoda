import { defineEventHandler, readBody } from 'h3'
import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { rateLimit } from '../../../utils/wallet/rateLimit'
import { cosignWithdrawTx } from '../../../utils/mc/withdrawService'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const account = await requireSession(event)
  rateLimit(event, `mc:withdraw:cosign:${account.id}`, 10, 60_000)
  const body = (await readBody(event).catch(() => ({}))) || {}
  return cosignWithdrawTx(account, body)
})
