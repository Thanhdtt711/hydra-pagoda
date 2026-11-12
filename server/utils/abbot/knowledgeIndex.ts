import fs from 'node:fs'
import path from 'node:path'

export type AbbotEmotion = 'calm' | 'smile' | 'thoughtful' | 'serious'

export const ABBOT_KB_FOLDERS = [
  'kinh_dich',
  'tu_dieu_de',
  'giao_ly_phat_phap',
  'gioi_luat',
  'tong_chi_truyen_thong',
  'quy_dinh_gh_phat_giao_vn',
  'phap_luat_nha_nuoc',
  'van_hoa_chua_nghi_le',
  'thong_tin_game'
] as const

export interface PresetQuestionItem {
  id: string
  text: string
  category: string
  primary_source: string
  related_ids: string[]
  emotion?: AbbotEmotion
  offline_answer: string
}

export interface KnowledgeChunk {
  id: string
  sourcePath: string // e.g. 'data/giao_ly_phat_phap/nhan_qua.md'
  category: string
  title: string
  heading: string
  content: string
  tags: string[]
  traditionNotes: string
  documentRef: string
  normalizedAll: string
  normalizedTitleTags: string
}

export interface KnowledgeMatch {
  chunk: KnowledgeChunk
  score: number
}

interface KnowledgeStore {
  chunks: KnowledgeChunk[]
  validSources: Set<string>
  presets: PresetQuestionItem[]
  presetById: Map<string, PresetQuestionItem>
}

let cachedStore: KnowledgeStore | null = null

export function normalizeVietnamese(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const DOMAIN_SYNONYMS: Array<[RegExp, string[]]> = [
  [/\b(boi|xam|que|dich|bat quai|ngu hanh|tu vi|van menh|so menh|giai han|xui)\b/g, ['kinh dich', 'triet hoc phuong dong', 'que', 'van menh']],
  [/\b(tu dieu de|kho de|tap de|diet de|dao de|dieu|kho dau)\b/g, ['tu dieu de', 'kho', 'tap', 'diet', 'dao']],
  [/\b(nhan qua|nghiep|karma|luan hoi|bao ung)\b/g, ['nhan qua', 'nghiep', 'luan hoi', 'hat giong']],
  [/\b(ngu gioi|gioi luat|thap thien|bat quan trai|xuat gia|an chay|sat sinh)\b/g, ['ngu gioi', 'gioi luat', 'thap thien', 'tai gia']],
  [/\b(thien|tinh do|mat tong|truc lam|bac tong|nam tong|khat si|tong phai)\b/g, ['thien', 'tinh do', 'truc lam', 'tong phai']],
  [/\b(giao hoi|ghpgvn|hien chuong|tang su|tu vien)\b/g, ['giao hoi phat giao viet nam', 'hien chuong', 'tu vien']],
  [/\b(phap luat|luat|nha nuoc|nghi dinh|thong tu|di tich|le hoi|cong duc|tu thien)\b/g, ['phap luat', 'tin nguong ton giao', 'cong duc', 'di tich']],
  [/\b(hau dong|tho mau|tu phu|duc thanh tran|co chin|ong hoang|co doi)\b/g, ['tho mau', 'hau dong', 'duc thanh tran', 'tu phu']],
  [/\b(thap huong|le phat|di chua|ram|mong 1|mong mot|phat dan|vu lan|tuong phat)\b/g, ['di chua', 'thap huong', 'ram', 'mong mot', 'vu lan']],
  [/\b(game|pagoda|mc|merit|loc|432hz|bo doan|hom cong duc|ban xem que)\b/g, ['huong dan game', 'thien 432hz', 'nhan loc', 'cong duc']],
  [/\b(lo au|stress|buon|ap luc|binh an|tinh tam|hoi tho|chanh niem)\b/g, ['lo au', 'binh an', 'hoi tho', 'chanh niem']]
]

function tokenizeNormalized(norm: string): string[] {
  if (!norm) return []
  return Array.from(new Set(norm.split(' ').filter(t => t.length >= 2)))
}

function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta: Record<string, string | string[]> = {}
  const lines = match[1].split(/\r?\n/)
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val
        .slice(1, -1)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    } else {
      meta[key] = val
    }
  }
  return { meta, body: match[2].trim() }
}

function splitMarkdownSections(body: string, fallbackHeading: string): Array<{ heading: string; content: string }> {
  const parts = body.split(/^##\s+/m)
  const sections: Array<{ heading: string; content: string }> = []

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const nlIdx = trimmed.indexOf('\n')
    if (nlIdx === -1) {
      sections.push({ heading: fallbackHeading, content: trimmed })
    } else {
      const heading = trimmed.slice(0, nlIdx).trim()
      const content = trimmed.slice(nlIdx + 1).trim()
      if (content) {
        sections.push({ heading, content })
      }
    }
  }

  return sections.length > 0 ? sections : [{ heading: fallbackHeading, content: body }]
}

function resolveDataRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '..', 'data'),
    path.resolve(process.cwd(), '..', '..', 'data')
  ]
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }
  return path.resolve(process.cwd(), 'data')
}

function buildKnowledgeStore(): KnowledgeStore {
  const dataRoot = resolveDataRoot()
  const chunks: KnowledgeChunk[] = []
  const validSources = new Set<string>()
  const presets: PresetQuestionItem[] = []
  const presetById = new Map<string, PresetQuestionItem>()

  // 1. Nạp danh sách câu hỏi có sẵn
  const presetPath = path.join(dataRoot, 'cau_hoi_co_san', 'questions.json')
  if (fs.existsSync(presetPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(presetPath, 'utf8')) as { questions?: PresetQuestionItem[] }
      for (const q of parsed.questions ?? []) {
        if (q?.id && q?.text) {
          presets.push(q)
          presetById.set(q.id, q)
        }
      }
    } catch (err) {
      console.error('[abbot:kb] Lỗi đọc questions.json:', err)
    }
  }

  // 2. Đọc toàn bộ file Markdown trong 9 thư mục tri thức
  for (const folder of ABBOT_KB_FOLDERS) {
    const folderDir = path.join(dataRoot, folder)
    if (!fs.existsSync(folderDir)) continue

    const files = fs.readdirSync(folderDir).filter(f => f.endsWith('.md')).sort()
    for (const fileName of files) {
      const fullPath = path.join(folderDir, fileName)
      const relSource = `data/${folder}/${fileName}`
      validSources.add(relSource)

      const raw = fs.readFileSync(fullPath, 'utf8')
      const { meta, body } = parseFrontmatter(raw)
      const title = typeof meta.title === 'string' && meta.title ? meta.title : fileName.replace(/\.md$/, '')
      const category = typeof meta.category === 'string' && meta.category ? meta.category : folder
      const tags = Array.isArray(meta.tags) ? meta.tags : []
      const traditionNotes = typeof meta.tradition_notes === 'string' ? meta.tradition_notes : ''
      const documentRef = typeof meta.document_ref === 'string' ? meta.document_ref : ''

      const sections = splitMarkdownSections(body, title)
      sections.forEach((sec, idx) => {
        const normalizedTitleTags = normalizeVietnamese(`${title} ${sec.heading} ${tags.join(' ')}`)
        const normalizedAll = normalizeVietnamese(`${title} ${sec.heading} ${tags.join(' ')} ${sec.content} ${traditionNotes} ${documentRef}`)
        chunks.push({
          id: `${relSource}#${idx}`,
          sourcePath: relSource,
          category,
          title,
          heading: sec.heading,
          content: sec.content,
          tags,
          traditionNotes,
          documentRef,
          normalizedAll,
          normalizedTitleTags
        })
      })
    }
  }

  return { chunks, validSources, presets, presetById }
}

export function getKnowledgeStore(): KnowledgeStore {
  if (!cachedStore) {
    cachedStore = buildKnowledgeStore()
  }
  return cachedStore
}

export function findPresetQuestion(questionId?: string, questionText?: string): PresetQuestionItem | null {
  const store = getKnowledgeStore()
  if (questionId && store.presetById.has(questionId)) {
    return store.presetById.get(questionId) ?? null
  }
  if (!questionText) return null
  const norm = normalizeVietnamese(questionText)
  if (!norm) return null
  for (const item of store.presets) {
    if (normalizeVietnamese(item.text) === norm) {
      return item
    }
  }
  return null
}

export function pickGreetingQuestions(limit = 6): PresetQuestionItem[] {
  const store = getKnowledgeStore()
  const pool = [...store.presets]
  // Xáo trộn Fisher-Yates nhẹ nhưng luôn đảm bảo có câu đa dạng chủ đề
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(limit, pool.length))
}

export function getRelatedQuestions(opts: {
  preset?: PresetQuestionItem | null
  matchedCategory?: string
  excludeText?: string
  limit?: number
}): string[] {
  const store = getKnowledgeStore()
  const limit = opts.limit ?? 3
  const excludeNorm = normalizeVietnamese(opts.excludeText || '')
  const result: string[] = []
  const seen = new Set<string>()

  const pushIfValid = (item: PresetQuestionItem | undefined) => {
    if (!item) return
    const norm = normalizeVietnamese(item.text)
    if (!norm || norm === excludeNorm || seen.has(norm)) return
    seen.add(norm)
    result.push(item.text)
  }

  if (opts.preset?.related_ids?.length) {
    for (const relId of opts.preset.related_ids) {
      if (result.length >= limit) break
      pushIfValid(store.presetById.get(relId))
    }
  }

  if (result.length < limit && opts.matchedCategory) {
    for (const item of store.presets) {
      if (result.length >= limit) break
      if (item.category === opts.matchedCategory) pushIfValid(item)
    }
  }

  for (const item of store.presets) {
    if (result.length >= limit) break
    pushIfValid(item)
  }

  return result.slice(0, limit)
}

export function searchKnowledge(query: string, topK = 4, prioritySourcePath?: string): KnowledgeMatch[] {
  const store = getKnowledgeStore()
  const baseNorm = normalizeVietnamese(query)
  if (!baseNorm) return []

  const extraTerms: string[] = []
  for (const [pattern, expansions] of DOMAIN_SYNONYMS) {
    if (pattern.test(baseNorm)) {
      extraTerms.push(...expansions)
    }
  }

  const baseTokens = tokenizeNormalized(baseNorm)
  const expandedTokens = tokenizeNormalized(`${baseNorm} ${extraTerms.join(' ')}`)

  const scored: KnowledgeMatch[] = []
  for (const chunk of store.chunks) {
    let score = 0
    if (prioritySourcePath && chunk.sourcePath === prioritySourcePath) {
      score += 12
    }

    // Khớp cụm từ nguyên gốc
    if (baseNorm.length >= 4 && chunk.normalizedTitleTags.includes(baseNorm)) {
      score += 10
    } else if (baseNorm.length >= 6 && chunk.normalizedAll.includes(baseNorm)) {
      score += 6
    }

    // Khớp từng từ khóa gốc và từ khóa mở rộng
    for (const tok of baseTokens) {
      if (chunk.normalizedTitleTags.includes(tok)) score += 3.0
      else if (chunk.normalizedAll.includes(tok)) score += 1.4
    }
    for (const tok of expandedTokens) {
      if (baseTokens.includes(tok)) continue
      if (chunk.normalizedTitleTags.includes(tok)) score += 1.5
      else if (chunk.normalizedAll.includes(tok)) score += 0.6
    }

    // Thưởng nhẹ khi khớp tag đầy đủ
    for (const tag of chunk.tags) {
      const tagNorm = normalizeVietnamese(tag)
      if (tagNorm && baseNorm.includes(tagNorm)) {
        score += 4.5
      }
    }

    if (score > 0) {
      scored.push({ chunk, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
