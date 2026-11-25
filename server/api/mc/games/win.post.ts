import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { winBoardGame } from '../../../utils/wallet/boardGameService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'
import { getDb } from '../../../utils/wallet/db'

/** POST /api/mc/games/win  { runToken }: báo thắng một ván, server tự quyết định số MC thưởng. */
export default defineEventHandler(async event => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:games:win', 30, 60_000)
  const account = await requireSession(event)
  const body: { runToken?: unknown } = (await readBody<{ runToken?: unknown }>(event).catch(() => null)) || {}

  const res = await winBoardGame(account.id, body.runToken)
  const db = await getDb()
  const bal = await db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get<{ mc_balance: number }>(account.id)
  const hydra = res.ledgerId ? await getHydraProof(res.ledgerId).catch(() => null) : null
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, ...res, currentBalanceMc: bal ? Number(bal.mc_balance) : null, hydra }
})
