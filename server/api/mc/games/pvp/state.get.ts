import { defineEventHandler, getQuery } from 'h3'
import { requireSession, apiError } from '../../../../utils/wallet/auth'
import { getPvpMatchState } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const q = getQuery(event)
  const matchId = String(q.matchId || '').trim()
  if (!matchId) throw apiError(400, 'invalid_match', 'Thiếu matchId.')
  const match = await getPvpMatchState(account, matchId)
  return { ok: true, match }
})
