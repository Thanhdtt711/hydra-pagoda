import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { completeParkourRun } from '../../../utils/wallet/parkourService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:parkour:complete', 30, 60_000)
  const account = requireSession(event)
  const body = (await readBody<{ runToken?: unknown }>(event).catch(() => ({}))) || {}

  if (!body.runToken || typeof body.runToken !== 'string') {
    throw createError({ statusCode: 400, message: 'Thiếu mã lượt chơi runToken.' })
  }

  const res = completeParkourRun(account.id, body.runToken)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    ...res,
    hydra: res.ledgerId ? await getHydraProof(res.ledgerId).catch(() => null) : null
  }
})

