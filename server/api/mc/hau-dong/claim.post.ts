import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { claimHauDongBlessing } from '../../../utils/wallet/hauDongService'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  const acc = requireSession(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>

  return claimHauDongBlessing(acc.id, {
    isBowing: Boolean(body.isBowing)
  })
})

