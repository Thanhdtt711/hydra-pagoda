import { defineEventHandler, readBody } from 'h3'
import { requireSession } from '../../../../utils/wallet/auth'
import { submitPvpMove, type PvpMovePayload } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const body = (await readBody<{ matchId?: string; move?: PvpMovePayload }>(event)) || {}
  const match = await submitPvpMove(account, String(body.matchId || ''), body.move || {})
  return { ok: true, match }
})
