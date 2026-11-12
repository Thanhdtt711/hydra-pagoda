import { assertSameOrigin, requireSession, setAccountFortuneName } from '../../../utils/wallet/auth'
import { drawFortuneWithMc } from '../../../utils/wallet/mcService'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { rateLimit } from '../../../utils/wallet/rateLimit'

/**
 * POST /api/mc/fortune/draw
 * Body: {
 *   category: string,
 *   tier: string,
 *   requestId: string,
 *   mode?: 'quick' | 'preset' | 'profile' | 'custom',
 *   questionId?: string,
 *   customQuestion?: string,
 *   profile?: { fullName: string, birthDate: string, birthHour?: string, gender: 'nam'|'nu'|'khac' } | null,
 *   partnerProfile?: { fullName: string, birthDate: string, birthHour?: string, gender: 'nam'|'nu'|'khac' } | null
 * }
 * Tiêu MC nguyên tử và sinh kết quả Bói Quẻ 6 Môn Cầu An ở server (nhất quán theo seed + chống trùng 3 lần gần nhất).
 * Idempotent theo requestId.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:fortune:draw', 20, 60_000)
  const account = await requireSession(event)
  const body: Record<string, any> = (await readBody<Record<string, any>>(event).catch(() => null)) || {}

  if (body.profile && typeof body.profile === 'object' && typeof body.profile.fullName === 'string' && body.profile.fullName.trim()) {
    await setAccountFortuneName(account.id, body.profile.fullName)
  }

  const res = await drawFortuneWithMc(
    account.id,
    String(body.category ?? body.mon ?? 'stick'),
    String(body.tier ?? 'auspicious'),
    String(body.requestId ?? ''),
    {
      mode: body.mode,
      questionId: body.questionId ? String(body.questionId) : undefined,
      customQuestion: body.customQuestion ? String(body.customQuestion) : undefined,
      profile: body.profile && typeof body.profile === 'object' ? body.profile : null,
      partnerProfile: body.partnerProfile && typeof body.partnerProfile === 'object' ? body.partnerProfile : null,
      dateStr: body.dateStr ? String(body.dateStr) : undefined,
      paymentMode:
        body.paymentMode === 'free_daily' || body.paymentMode === 'offering_item'
          ? body.paymentMode
          : 'mc',
      offeringItemId: body.offeringItemId ? String(body.offeringItemId) : undefined
    }
  )

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    idempotentReplay: res.idempotentReplay,
    ledgerId: res.ledgerId,
    spentMc: res.spentMc,
    mcBalance: res.balanceAfter,
    paymentMode: res.extra.paymentMode || 'mc',
    fortune: res.extra.fortune,
    receiptHash: res.extra.receiptHash,
    // Chỉ lần tiêu MC mới có bút toán sổ cái (lượt miễn phí/lễ phẩm không có) -> huy hiệu Hydra L2
    hydra: res.spentMc > 0 ? await getHydraProof(res.ledgerId) : null,
    inventory: res.extra.inventory,
    dailyFreeUsedByCategory: res.extra.dailyFreeUsedByCategory
  }
})

