import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { claimHauDongBlessing } from '../../../utils/wallet/hauDongService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  const acc = requireSession(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>

  const res = claimHauDongBlessing(acc.id, {
    isBowing: Boolean(body.isBowing)
  })

  return {
    ...res,
    hydra: res.ledgerId ? await getHydraProof(res.ledgerId).catch(() => null) : null
  }
})

