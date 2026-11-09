import { assertSameOrigin, getSessionAccount, requireSession } from '../../../utils/wallet/auth'
import { sponsorHauDongSession, startFreeRitualIfIdle } from '../../../utils/wallet/hauDongService'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>

  // Cho phép khai đàn Lễ Thường Nhật miễn phí khi Điện đang nghỉ giữa giờ (không bắt buộc trừ MC)
  if (body.mode === 'free_ritual') {
    const acc = getSessionAccount(event)
    return {
      freeRitualStarted: true,
      status: startFreeRitualIfIdle(acc ? acc.id : null)
    }
  }

  const acc = requireSession(event)
  return sponsorHauDongSession(acc.id, {
    requestId: body.requestId,
    mode: body.mode,
    amountMc: body.amountMc,
    customDeityId: body.customDeityId,
    prayerText: body.prayerText
  })
})

