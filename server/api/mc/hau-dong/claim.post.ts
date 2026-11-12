import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { claimHauDongBlessing } from '../../../utils/wallet/hauDongService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:hau-dong:claim', 30, 60_000)
  const acc = await requireSession(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>

  const res = await claimHauDongBlessing(acc.id, {
    isBowing: Boolean(body.isBowing)
  })

  return {
    ...res,
    hydra: res.ledgerId ? await getHydraProof(res.ledgerId).catch(() => null) : null
  }
})

