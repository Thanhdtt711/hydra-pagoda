import { defineEventHandler, readBody } from 'h3'
import { requireSession } from '../../../../utils/wallet/auth'
import { createPvpMatch } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const body = (await readBody<{ gameId?: string; wagerMc?: number }>(event)) || {}
  const match = await createPvpMatch(account, String(body.gameId || ''), Number(body.wagerMc || 0))
  return { ok: true, match }
})
