import crypto from 'node:crypto'
import {
  ABBOT_SYSTEM_PROMPT,
  detectCrisisInput,
  detectPromptInjectionOrOffTopic,
  sanitizeAbbotResponse,
  type AbbotResponsePayload
} from './abbotPrompt'
import {
  findPresetQuestion,
  getKnowledgeStore,
  getRelatedQuestions,
  normalizeVietnamese,
  pickGreetingQuestions,
  searchKnowledge,
  type AbbotEmotion,
  type KnowledgeMatch
} from './knowledgeIndex'

interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationSession {
  id: string
  turns: ConversationTurn[]
  updatedAt: number
}

const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 1000
const sessions = new Map<string, ConversationSession>()

function pruneSessions() {
  const now = Date.now()
  for (const [id, sess] of sessions.entries()) {
    if (now - sess.updatedAt > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
  if (sessions.size > MAX_SESSIONS) {
    const oldest = Array.from(sessions.values()).sort((a, b) => a.updatedAt - b.updatedAt)
    for (const item of oldest.slice(0, sessions.size - MAX_SESSIONS)) {
      sessions.delete(item.id)
    }
  }
}

function getOrCreateSession(conversationId?: string): ConversationSession {
  pruneSessions()
  const cleanId = typeof conversationId === 'string' ? conversationId.trim() : ''
  if (cleanId && sessions.has(cleanId)) {
    const existing = sessions.get(cleanId)!
    existing.updatedAt = Date.now()
    return existing
  }
  const id = cleanId && /^[a-zA-Z0-9_-]{8,64}$/.test(cleanId)
    ? cleanId
    : `abbot_${crypto.randomBytes(8).toString('hex')}`
  const created: ConversationSession = { id, turns: [], updatedAt: Date.now() }
  sessions.set(id, created)
  return created
}

function recordTurn(session: ConversationSession, userText: string, assistantReply: string) {
  session.turns.push({ role: 'user', content: userText })
  session.turns.push({ role: 'assistant', content: assistantReply })
  if (session.turns.length > 12) {
    session.turns = session.turns.slice(-12)
  }
  session.updatedAt = Date.now()
}

export interface GreetAbbotResponse extends AbbotResponsePayload {
  conversationId: string
  custom_option_label: string
}

export interface AskAbbotResponse extends AbbotResponsePayload {
  conversationId: string
  modeUsed: 'llm_rag' | 'offline_rag' | 'safety_guard' | 'farewell'
}

export function greetAbbot(conversationId?: string): GreetAbbotResponse {
  const session = getOrCreateSession(conversationId)
  const picked = pickGreetingQuestions(6)
  const reply = 'A Di Đà Phật, thầy chào con vừa bước lên thềm Đại Hùng Bảo Điện. Thầy đứng đây đón khách thập phương; con có thắc mắc gì về Phật pháp, giới luật, nghi lễ chùa, Kinh Dịch, quy định hay cách sinh hoạt trong chùa Pagoda thì cứ thong thả hỏi thầy nhé.'

  return {
    conversationId: session.id,
    reply,
    emotion: 'smile',
    suggested_questions: picked.map(q => q.text),
    custom_option_label: 'Con muốn hỏi điều khác',
    sources: []
  }
}

function cleanMarkdownToProse(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-\s+/gm, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickSentences(prose: string, maxSentences = 5): string {
  const parts = prose.match(/[^.!?]+[.!?]+/g)
  if (!parts || parts.length === 0) return prose.slice(0, 420)
  return parts.slice(0, maxSentences).join(' ').trim()
}

function buildOfflineRagResponse(
  question: string,
  matches: KnowledgeMatch[],
  fallbackSuggestions: string[],
  presetAnswer?: { answer: string; source: string; emotion?: AbbotEmotion } | null
): AbbotResponsePayload {
  const store = getKnowledgeStore()
  const normQ = normalizeVietnamese(question)

  // 1. Khớp câu hỏi có sẵn có câu trả lời biên soạn chuẩn
  if (presetAnswer) {
    return sanitizeAbbotResponse(
      {
        reply: presetAnswer.answer,
        emotion: presetAnswer.emotion ?? 'calm',
        suggested_questions: fallbackSuggestions,
        sources: presetAnswer.source ? [presetAnswer.source] : []
      },
      store.validSources,
      fallbackSuggestions
    )
  }

  // 2. Hỏi chi tiết về luật/quy định mà không đủ tài liệu khớp rõ
  const isLegalOrRuleQuery = /\b(dieu khoan|nghi dinh|thong tu|hien chuong|phap luat|quy dinh|luat)\b/.test(normQ)
  const topMatch = matches[0]
  if (!topMatch || topMatch.score < 2.2) {
    const honestReply = isLegalOrRuleQuery
      ? 'A Di Đà Phật, về các điều khoản quy định cụ thể của Giáo hội hoặc văn bản pháp luật ngoài phạm vi tổng quan sẵn có, thầy chưa nắm chính xác nên con hãy tham khảo văn bản gốc hoặc cơ quan có thẩm quyền để chắc chắn nhé.'
      : 'A Di Đà Phật, điều con hỏi thật thú vị nhưng trong tủ sách nhỏ ở chùa thầy chưa có tài liệu đối chiếu đủ rõ để trả lời trọn vẹn. Thầy chỉ xin chia sẻ những điều thuộc phạm vi Phật pháp căn bản, giới luật, văn hóa chùa, Kinh Dịch hoặc hướng dẫn sinh hoạt tại Pagoda thôi nhé.'
    return sanitizeAbbotResponse(
      {
        reply: honestReply,
        emotion: 'thoughtful',
        suggested_questions: fallbackSuggestions,
        sources: []
      },
      store.validSources,
      fallbackSuggestions
    )
  }

  // 3. Tổng hợp mượt mà từ top chunks tìm thấy trong data/
  const selectedSources = Array.from(new Set(matches.slice(0, 2).map(m => m.chunk.sourcePath)))
  const prose = cleanMarkdownToProse(topMatch.chunk.content)
  const bodyExcerpt = pickSentences(prose, 5)

  let prefix = 'A Di Đà Phật, về điều con vừa hỏi, theo tài liệu của nhà chùa: '
  let emotion: AbbotEmotion = 'calm'
  let suffix = ''

  if (topMatch.chunk.category === 'kinh_dich') {
    emotion = 'thoughtful'
    suffix = ' Con nhớ giúp thầy rằng Kinh Dịch là triết học văn hóa phương Đông chứ không phải giáo lý Phật giáo, và vận mệnh vẫn nằm ở việc con làm hôm nay.'
  } else if (topMatch.chunk.category === 'phap_luat_nha_nuoc' || topMatch.chunk.category === 'quy_dinh_gh_phat_giao_vn') {
    emotion = 'serious'
    const refNote = topMatch.chunk.documentRef ? ` (tham chiếu: ${topMatch.chunk.documentRef})` : ''
    suffix = `${refNote}. Nếu cần đối chiếu điều khoản chi tiết hơn, con nên xem thêm văn bản gốc hoặc hỏi cơ quan có thẩm quyền.`
  } else if (topMatch.chunk.category === 'thong_tin_game') {
    emotion = 'smile'
  } else if (topMatch.chunk.traditionNotes && /\b(bac tong|nam tong|tong phai|khac)\b/.test(normQ)) {
    suffix = ` Lưu ý thêm giữa các truyền thống: ${topMatch.chunk.traditionNotes}`
  }

  const reply = `${prefix}${bodyExcerpt}${suffix}`.replace(/\s+/g, ' ').trim()

  return sanitizeAbbotResponse(
    {
      reply,
      emotion,
      suggested_questions: fallbackSuggestions,
      sources: selectedSources
    },
    store.validSources,
    fallbackSuggestions
  )
}

async function callGeminiNative(opts: {
  apiKey: string
  baseUrl: string
  model: string
  systemText: string
  contextText: string
  history: ConversationTurn[]
  question: string
}): Promise<string | null> {
  const contents = [
    ...opts.history.slice(-8).map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }]
    })),
    { role: 'user', parts: [{ text: opts.question }] }
  ]

  const modelsToTry = Array.from(new Set([opts.model, 'gemini-2.5-flash-lite'].filter(Boolean)))
  for (const targetModel of modelsToTry) {
    const cleanBase = opts.baseUrl.includes('generativelanguage.googleapis.com')
      ? opts.baseUrl.replace(/\/openai\/?$/, '').replace(/\/+$/, '')
      : 'https://generativelanguage.googleapis.com/v1beta'
    const url = `${cleanBase}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 14_000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${opts.systemText}\n\n${opts.contextText}` }]
          },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1400,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        if (res.status === 429 || res.status === 503) continue
        return null
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
      if (text) return text
    } catch {
      // Thử model dự phòng hoặc fallback RAG offline
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

async function callLlmWithRag(opts: {
  question: string
  matches: KnowledgeMatch[]
  history: ConversationTurn[]
  fallbackSuggestions: string[]
}): Promise<AbbotResponsePayload | null> {
  const cfg = useRuntimeConfig()
  const apiKey = String(cfg.abbotLlmApiKey || process.env.NUXT_ABBOT_LLM_API_KEY || '').trim()
  if (!apiKey) return null

  const baseUrl = String(
    cfg.abbotLlmBaseUrl || process.env.NUXT_ABBOT_LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/+$/, '')
  const model = String(cfg.abbotLlmModel || process.env.NUXT_ABBOT_LLM_MODEL || 'gemini-2.5-flash').trim()

  const store = getKnowledgeStore()
  const contextBlock = opts.matches.length
    ? opts.matches
        .map(
          (m, idx) =>
            `[Nguồn ${idx + 1}: ${m.chunk.sourcePath} | Tiêu đề: ${m.chunk.title} - ${m.chunk.heading}${m.chunk.documentRef ? ` | Văn bản: ${m.chunk.documentRef}` : ''}${m.chunk.traditionNotes ? ` | Lưu ý tông phái: ${m.chunk.traditionNotes}` : ''}]\n${m.chunk.content}`
        )
        .join('\n\n')
    : 'Không có tài liệu khớp mạnh trong dữ liệu của chùa. Nếu là câu hỏi quy định Giáo hội hoặc pháp luật chi tiết, hãy trả lời thẳng thắn là thầy chưa nắm chính xác và khuyên tham khảo văn bản gốc hoặc cơ quan có thẩm quyền.'

  const contextText = `[TAI_LIEU_THAM_KHAO]\n${contextBlock}\n\nHãy trả về JSON hợp lệ theo đúng schema đã quy định.`
  const isGoogleKey = apiKey.startsWith('AQ.') || apiKey.startsWith('AIza') || baseUrl.includes('generativelanguage.googleapis.com')

  try {
    let rawContent: string | null = null

    if (isGoogleKey && !baseUrl.includes('/openai')) {
      rawContent = await callGeminiNative({
        apiKey,
        baseUrl,
        model,
        systemText: ABBOT_SYSTEM_PROMPT,
        contextText,
        history: opts.history,
        question: opts.question
      })
    } else {
      const messages = [
        { role: 'system', content: ABBOT_SYSTEM_PROMPT },
        { role: 'system', content: contextText },
        ...opts.history.slice(-8),
        { role: 'user', content: opts.question }
      ]

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12_000)
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            max_tokens: 750,
            response_format: { type: 'json_object' },
            messages
          }),
          signal: controller.signal
        })
        if (res.ok) {
          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
          rawContent = json.choices?.[0]?.message?.content?.trim() || null
        }
      } finally {
        clearTimeout(timer)
      }
    }

    if (!rawContent) return null
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as Partial<AbbotResponsePayload>
    return sanitizeAbbotResponse(parsed, store.validSources, opts.fallbackSuggestions)
  } catch (err) {
    console.warn('[abbot:llm] Fallback về RAG offline:', err instanceof Error ? err.message : err)
    return null
  }
}

export async function askAbbot(input: {
  conversationId?: string
  question?: string
  questionId?: string
  mode?: 'preset' | 'free' | 'farewell'
}): Promise<AskAbbotResponse> {
  const store = getKnowledgeStore()
  const session = getOrCreateSession(input.conversationId)
  const mode = input.mode ?? 'free'

  // 1. Tạm biệt thầy
  if (mode === 'farewell' || /^(tam biet|chao thay con ve|con xin phep|bye)$/i.test(normalizeVietnamese(input.question || ''))) {
    const reply = 'A Di Đà Phật, thầy tiễn con nhé. Mong con giữ được thân tâm an lạc, đi giữa đời thường mà lòng vẫn thong dong như mặt hồ tĩnh lặng.'
    return {
      conversationId: session.id,
      reply,
      emotion: 'smile',
      suggested_questions: [],
      sources: [],
      modeUsed: 'farewell'
    }
  }

  const preset = findPresetQuestion(input.questionId, input.question)
  const rawQuestion = (preset?.text || input.question || '').trim().slice(0, 500)

  if (!rawQuestion) {
    const suggestions = getRelatedQuestions({ limit: 3 })
    return {
      conversationId: session.id,
      reply: 'A Di Đà Phật, con định hỏi thầy điều gì thế? Con có thể chọn một câu gợi ý bên dưới hoặc viết câu hỏi cho thầy nhé.',
      emotion: 'smile',
      suggested_questions: suggestions,
      sources: [],
      modeUsed: 'offline_rag'
    }
  }

  // 2. An toàn tâm lý (ưu tiên tuyệt đối, không giảng đạo lúc khủng hoảng)
  if (detectCrisisInput(rawQuestion)) {
    const crisisReply =
      'A Di Đà Phật, nghe những lời vừa rồi thầy rất thương và lo cho con. Lúc lòng nặng nề và bế tắc thế này, con đừng gánh chịu một mình nhé. Con hãy gọi ngay cho một người thân, bạn bè tin cậy ở gần bên để nói chuyện, và liên hệ với bác sĩ hoặc chuyên gia tâm lý, đường dây hỗ trợ khủng hoảng tại nơi con sinh sống để được giúp đỡ kịp thời. Thầy luôn lắng nghe và mong con được an toàn.'
    recordTurn(session, rawQuestion, crisisReply)
    return {
      conversationId: session.id,
      reply: crisisReply,
      emotion: 'serious',
      suggested_questions: [],
      sources: [],
      modeUsed: 'safety_guard'
    }
  }

  // 3. Ngăn hỏi ngoài phạm vi hoặc ép thoát vai
  const guardReason = detectPromptInjectionOrOffTopic(rawQuestion)
  if (guardReason) {
    const fallbackSuggestions = getRelatedQuestions({ limit: 3 })
    const reply =
      'A Di Đà Phật, chuyện đó nằm ngoài chốn thiền môn nên thầy xin phép không bàn tới. Nếu con muốn tìm hiểu về Phật pháp, giữ tâm bình an, nghi lễ chùa hay văn hóa truyền thống trong Pagoda thì thầy rất sẵn lòng chia sẻ.'
    recordTurn(session, rawQuestion, reply)
    return {
      conversationId: session.id,
      reply,
      emotion: 'calm',
      suggested_questions: fallbackSuggestions,
      sources: [],
      modeUsed: 'safety_guard'
    }
  }

  // 4. Truy xuất tri thức RAG từ data/
  const matches = searchKnowledge(rawQuestion, 4, preset?.primary_source)
  const matchedCategory = preset?.category || matches[0]?.chunk.category
  const fallbackSuggestions = getRelatedQuestions({
    preset,
    matchedCategory,
    excludeText: rawQuestion,
    limit: 3
  })

  // 5. Nếu có LLM key -> gọi LLM kèm ngữ cảnh RAG; nếu không -> chạy Offline RAG chuẩn
  const llmResult = await callLlmWithRag({
    question: rawQuestion,
    matches,
    history: session.turns,
    fallbackSuggestions
  })

  if (llmResult) {
    recordTurn(session, rawQuestion, llmResult.reply)
    return {
      conversationId: session.id,
      ...llmResult,
      modeUsed: 'llm_rag'
    }
  }

  // Nếu câu hỏi tự do khớp rất sát với một câu hỏi mẫu (người chơi tự gõ lại câu tương tự)
  let matchedPresetForOffline = preset
  if (!matchedPresetForOffline) {
    const normInput = normalizeVietnamese(rawQuestion)
    matchedPresetForOffline =
      store.presets.find(p => {
        const pNorm = normalizeVietnamese(p.text)
        return pNorm.includes(normInput) || normInput.includes(pNorm)
      }) ?? null
  }

  const offlineResult = buildOfflineRagResponse(
    rawQuestion,
    matches,
    fallbackSuggestions,
    matchedPresetForOffline
      ? {
          answer: matchedPresetForOffline.offline_answer,
          source: matchedPresetForOffline.primary_source,
          emotion: matchedPresetForOffline.emotion
        }
      : null
  )

  recordTurn(session, rawQuestion, offlineResult.reply)
  return {
    conversationId: session.id,
    ...offlineResult,
    modeUsed: 'offline_rag'
  }
}

