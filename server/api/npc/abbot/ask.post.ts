import { assertSameOrigin } from '../../../utils/wallet/auth'
import { rateLimit } from '../../../utils/wallet/rateLimit'
import { askAbbot } from '../../../utils/abbot/abbotService'

/**
 * POST /api/npc/abbot/ask
 * Trả lời câu hỏi có sẵn, câu hỏi tự do hoặc lời tạm biệt của người chơi với Thầy Trụ Trì.
 */
export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  rateLimit(event, 'npc:abbot:ask', 20, 60_000)
  const body = await readBody<{
    conversationId?: string
    question?: string
    questionId?: string
    mode?: 'preset' | 'free' | 'farewell'
  }>(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return askAbbot({
    conversationId: typeof body?.conversationId === 'string' ? body.conversationId : undefined,
    question: typeof body?.question === 'string' ? body.question : undefined,
    questionId: typeof body?.questionId === 'string' ? body.questionId : undefined,
    mode: body?.mode
  })
})

