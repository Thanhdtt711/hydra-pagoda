import { assertSameOrigin, requireSession } from '../../../utils/wallet/auth'
import { sponsorHauDongSession } from '../../../utils/wallet/hauDongService'

export default defineEventHandler(async event => {
  assertSameOrigin(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>

  // Chặn yêu cầu mở đàn miễn phí tùy tiện (chỉ cho phép mở đàn lúc 11h00 hoặc Mở Đàn Đặc Cách / Góp Bách Gia)
  if (body.mode === 'free_ritual') {
    throw createError({
      statusCode: 400,
      message: 'Nghi lễ Khai Đàn định kỳ diễn ra vào đúng 11h00 Trưa (Giờ Ngọ) hằng ngày. Quý đạo hữu có thể hoan hỷ chờ hoặc Phát Tâm Mở Đàn Đặc Cách / Góp Bách Gia.'
    })
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

