import { defineEventHandler, readBody } from 'h3'
import { requireSession } from '../../../../utils/wallet/auth'
import { cancelPvpMatch } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const body = (await readBody<{ matchId?: string }>(event)) || {}
  const match = await cancelPvpMatch(account, String(body.matchId || ''))
  return { ok: true, match }
})
