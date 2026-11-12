import { assertSameOrigin } from '../../../utils/wallet/auth'
import { rateLimit } from '../../../utils/wallet/rateLimit'
import { greetAbbot } from '../../../utils/abbot/abbotService'

/**
 * POST /api/npc/abbot/greet
 * Mở lời chào khi người chơi đến gần Thầy Trụ Trì và trả tối đa 6 câu hỏi gợi ý.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'npc:abbot:greet', 30, 60_000)
  const body: { conversationId?: string } = (await readBody<{ conversationId?: string }>(event).catch(() => null)) || {}
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return greetAbbot(body?.conversationId)
})

