import { defineEventHandler, readBody } from 'h3'
import { assertSameOrigin, getSessionAccount } from '../../../utils/wallet/auth'
import { credit } from '../../../utils/wallet/mcService'
import { getDb } from '../../../utils/wallet/db'
import { getHydraProof } from '../../../utils/hydra/hydraQueue'
import { getVietnamDayKey } from '../../../../lib/time/vietnamDay'
import { rateLimit } from '../../../utils/wallet/rateLimit'

const DHAMMAPADA_VERSES = [
  'Tâm an vạn sự an, tâm bình thế giới bình.',
  'Hận thù diệt hận thù, là điều không thể có. Từ bi diệt hận thù, là định luật ngàn thu.',
  'Chiến thắng vạn quân giặc, không bằng tự thắng mình. Tự thắng mình oanh liệt, là chiến công tối thượng.',
  'Không làm mọi điều ác, thành tựu các hạnh lành, giữ tâm ý trong sạch, chính lời chư Phật dạy.',
  'Như hoa thơm và đẹp, có sắc lại thêm hương, người nói lời lành thiện, hành động cũng như hoa.',
  'Dù sống một trăm năm, không thấy pháp tối thượng, chẳng bằng sống một ngày, thấy được pháp vô sinh.',
  'An lạc thay chánh niệm, thanh tịnh giữa cuộc đời. Giữ tâm luôn tĩnh lặng, hoa trí tuệ tốt tươi.',
  'Ý dẫn đầu các pháp, ý làm chủ ý tạo. Với ý thanh tịnh, an lạc bước theo sau như bóng không rời hình.'
]

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'mc:incense:offer', 30, 60_000)

  const body = (await readBody(event).catch(() => ({}))) || {}
  const location = body.location === 'hall' ? 'hall' : 'courtyard'

  const randomIndex = Math.floor(Math.random() * DHAMMAPADA_VERSES.length)
  const verse = DHAMMAPADA_VERSES[randomIndex]

  const account = await getSessionAccount(event)
  if (!account) {
    // Khách vãng lai (chưa kết nối ví): Vẫn được dâng hương thành tâm
    return {
      success: true,
      authenticated: false,
      firstToday: true,
      rewardMc: 15,
      verse,
      location,
      message: 'Lòng thành dâng Phật, nguyện thân tâm an lạc.'
    }
  }

  const todayStr = getVietnamDayKey()
  const refId = `incense_${account.id}_${todayStr}`

  // Kiểm tra xem hôm nay tài khoản đã nhận lộc dâng hương chưa
  const db = await getDb()
  const existing = await db
    .prepare('SELECT id, balance_after FROM mc_ledger WHERE reason = ? AND ref_id = ?')
    .get<{ id: number; balance_after: number }>('incense_daily', refId)

  if (existing) {
    const hydra = await getHydraProof(existing.id).catch(() => null)
    return {
      success: true,
      authenticated: true,
      firstToday: false,
      rewardMc: 0,
      newBalance: existing.balance_after,
      verse,
      location,
      message: 'Lòng thành dâng Phật, nguyện gia đạo bình an.',
      hydra
    }
  }

  // Lần đầu trong ngày: Tặng 15 MC công đức dâng hương
  const creditRes = await credit(account.id, 15, 'incense_daily', {
    refType: 'incense',
    refId,
    metadata: { location, date: todayStr }
  })

  const hydra = creditRes.ledgerId ? await getHydraProof(creditRes.ledgerId).catch(() => null) : null

  return {
    success: true,
    authenticated: true,
    firstToday: true,
    rewardMc: 15,
    newBalance: creditRes.balanceAfter,
    verse,
    location,
    message: 'Nhận lộc Phật đầu ngày (+15 MC) và phước lành Tâm Khinh An.',
    hydra
  }
})

