import { defineEventHandler } from 'h3'
import { requireSession } from '../../../../utils/wallet/auth'
import { listPvpLobby } from '../../../../utils/games/pvpService'

export default defineEventHandler(async (event) => {
  const account = await requireSession(event)
  return listPvpLobby(account)
})
