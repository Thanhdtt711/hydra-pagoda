import { defineEventHandler, readBody } from 'h3'
import { requireSession } from '../../../../utils/wallet/auth'
import { joinPvpMatch } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const body = (await readBody<{ matchId?: string; roomCode?: string }>(event)) || {}
  const match = await joinPvpMatch(account, {
    matchId: body.matchId,
    roomCode: body.roomCode
  })
  return { ok: true, match }
})
