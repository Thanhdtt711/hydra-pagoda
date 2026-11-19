import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { startBoardGame } from '../../../utils/wallet/boardGameService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/** POST /api/mc/games/start  { gameId }: mở ván cờ mới, trả `runToken`. */
export default defineEventHandler(async event => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:games:start', 60, 60_000)
  const account = await requireSession(event)
  const body: { gameId?: unknown } = (await readBody<{ gameId?: unknown }>(event).catch(() => null)) || {}

  const res = await startBoardGame(account.id, body.gameId)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, ...res }
})
