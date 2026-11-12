// server/api/mc/fortune/draw-couple.post.ts
// API Thỉnh Quẻ Đài Tơ Duyên Nguyệt Lão (Bói Duyên Cặp Đôi)

import { assertSameOrigin, requireSession, setAccountFortuneName } from '../../../utils/wallet/auth'
import { drawCoupleFortune } from '../../../utils/wallet/coupleFortuneService'
import { rateLimit } from '../../../utils/wallet/rateLimit'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:fortune:draw-couple', 20, 60_000)
  const account = await requireSession(event)
  const body: Record<string, any> = (await readBody<Record<string, any>>(event).catch(() => null)) || {}

  const profile = body.profile
  const partnerProfile = body.partnerProfile

  if (!profile?.fullName?.trim() || !profile?.birthDate?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Vui lòng cung cấp đầy đủ thông tin bản thân (Họ tên, Ngày sinh).'
    })
  }

  if (!partnerProfile?.fullName?.trim() || !partnerProfile?.birthDate?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Vui lòng cung cấp đầy đủ thông tin người thương (Họ tên, Ngày sinh).'
    })
  }

  const paymentMode = body.paymentMode === 'mc' ? 'mc' : 'free_daily'
  const requestId = body.requestId ? String(body.requestId) : ''

  await setAccountFortuneName(account.id, String(profile.fullName).trim())

  const res = await drawCoupleFortune(
    account.id,
    {
      fullName: String(profile.fullName).trim(),
      birthDate: String(profile.birthDate).trim(),
      gender: profile.gender === 'nu' ? 'nu' : 'nam',
      birthHour: profile.birthHour ? String(profile.birthHour) : undefined
    },
    {
      fullName: String(partnerProfile.fullName).trim(),
      birthDate: String(partnerProfile.birthDate).trim(),
      gender: partnerProfile.gender === 'nam' ? 'nam' : 'nu',
      birthHour: partnerProfile.birthHour ? String(partnerProfile.birthHour) : undefined
    },
    paymentMode,
    requestId
  )

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return res
})

