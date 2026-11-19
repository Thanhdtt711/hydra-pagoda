import { getSessionAccount } from '../../../utils/wallet/auth'
import { getBoardGameStatus } from '../../../utils/wallet/boardGameService'

/** GET /api/mc/games/status: tiến độ thắng cờ hôm nay (khách chưa đăng nhập thấy khung rỗng). */
export default defineEventHandler(async event => {
  const acc = await getSessionAccount(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, status: await getBoardGameStatus(acc ? acc.id : null) }
})
