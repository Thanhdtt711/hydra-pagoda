import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { startMeditationSession } from '../../../utils/wallet/mcService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/meditation/start
 * Body: { durationMin: 3 | 5 | 15 | 30, slotId?: number }
 * Mở phiên tọa thiền: server ghi `started_at` làm mốc đồng hồ chống tua giờ, giữ bồ đoàn (`slotId`) cho người chơi
 * và trả trước phần thưởng dự kiến cùng hạn mức MC còn lại trong ngày.
 * Lỗi 409 `slot_taken` khi bồ đoàn vừa có đồng tu khác ngồi.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:meditation:start', 20, 60_000)
  const account = await requireSession(event)
  const body: { durationMin?: unknown; slotId?: unknown } = (await readBody<{ durationMin?: unknown; slotId?: unknown }>(event).catch(() => null)) || {}

  const session = await startMeditationSession(account.id, body.durationMin, body.slotId)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, ...session }
})

