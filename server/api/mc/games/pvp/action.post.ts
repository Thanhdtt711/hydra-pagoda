import { defineEventHandler, readBody } from 'h3'
import { requireSession } from '../../../../utils/wallet/auth'
import { performPvpAction } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  const body = (await readBody<{
    matchId?: string
    action?: 'resign' | 'offer_draw' | 'accept_draw' | 'reject_draw' | 'claim_timeout'
  }>(event)) || {}
  const match = await performPvpAction(account, String(body.matchId || ''), body.action as any)
  return { ok: true, match }
})
