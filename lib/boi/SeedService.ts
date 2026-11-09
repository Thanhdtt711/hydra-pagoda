import type { GenderType, MonId } from './types'

/**
 * Chuẩn hóa chuỗi tiếng Việt (họ tên, câu hỏi):
 * - Chuyển chữ thường
 * - Bỏ dấu thanh và phụ âm đặc biệt (đ -> d)
 * - Gộp nhiều khoảng trắng liên tiếp thành 1 khoảng trắng
 */
export function normalizeVietnameseText(raw: string | undefined | null): string {
  if (!raw) return ''
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chuẩn hóa ngày sinh về dạng YYYY-MM-DD hoặc YYYY (nếu chỉ nhập năm sinh).
 */
export function normalizeBirthDate(raw: string | undefined | null): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2]!.padStart(2, '0')
    const d = isoMatch[3]!.padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmyMatch) {
    const d = dmyMatch[1]!.padStart(2, '0')
    const m = dmyMatch[2]!.padStart(2, '0')
    const y = dmyMatch[3]
    return `${y}-${m}-${d}`
  }
  const yearOnly = trimmed.match(/(\d{4})/)
  return yearOnly ? yearOnly[1]! : trimmed
}

/**
 * Lấy chuỗi ngày hiện tại định dạng YYYY-MM-DD theo múi giờ Việt Nam (UTC+7).
 */
export function getVietnamDateStr(dateOrMs: Date | number = Date.now()): string {
  const ms = typeof dateOrMs === 'number' ? dateOrMs : dateOrMs.getTime()
  const vnTime = new Date(ms + 7 * 3600 * 1000)
  const y = vnTime.getUTCFullYear()
  const m = String(vnTime.getUTCMonth() + 1).padStart(2, '0')
  const d = String(vnTime.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Kiểm tra một bộ (năm, tháng, ngày) Dương lịch có tồn tại hợp lệ trên lịch thực tế hay không.
 */
function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Tự động bóc tách ngày mục tiêu cụ thể từ câu hỏi của người chơi (nếu có).
 * Hỗ trợ các dạng phổ biến:
 * - "20/11/2026", "20-11-2026", "20.11.2026" (DD/MM/YYYY)
 * - "2026-11-20", "2026/11/20" (YYYY-MM-DD)
 * - "ngày 20 tháng 11 năm 2026" hoặc "ngày 20 tháng 11"
 * - "ngày 20/11" hoặc "vào 20/11" (tự lấy năm từ fallbackDateStr hoặc năm hiện tại UTC+7)
 * Trả về chuỗi 'YYYY-MM-DD' nếu hợp lệ, ngược lại trả về null.
 */
export function extractDateFromQuestion(
  rawQuestion: string | undefined | null,
  fallbackDateStr?: string
): string | null {
  if (!rawQuestion) return null
  const text = String(rawQuestion).trim()
  if (!text) return null

  const refDate = fallbackDateStr ? normalizeBirthDate(fallbackDateStr) : getVietnamDateStr()
  const refYearMatch = refDate.match(/^(\d{4})/)
  const defaultYear = refYearMatch ? Number(refYearMatch[1]) : new Date().getFullYear()

  // 1. Dạng DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyRegex = /\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})\b/g
  for (const m of text.matchAll(dmyRegex)) {
    const day = Number(m[1])
    const month = Number(m[2])
    const year = Number(m[3])
    if (isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day)
    }
  }

  // 2. Dạng ISO YYYY-MM-DD hoặc YYYY/MM/DD
  const ymdRegex = /\b(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\b/g
  for (const m of text.matchAll(ymdRegex)) {
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    if (isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day)
    }
  }

  // 3. Dạng tiếng Việt: "ngày 20 tháng 11 (năm 2026)" hoặc "ngay 20 thang 11 (nam 2026)"
  const norm = normalizeVietnameseText(text)
  const vnWordsRegex = /\bngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b/
  const vnMatch = norm.match(vnWordsRegex)
  if (vnMatch) {
    const day = Number(vnMatch[1])
    const month = Number(vnMatch[2])
    const year = vnMatch[3] ? Number(vnMatch[3]) : defaultYear
    if (isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day)
    }
  }

  // 4. Dạng rút gọn có từ khóa đứng trước: "ngày 20/11", "vào 20/11", "hôm 20/11", "mùng 5/12"
  const shortDmyRegex = /(?:ngay|vao|hom|mung|mong)\s+(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?!\s*[\/\-.]\s*\d)/i
  const normKeepSlash = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
  const shortMatch = normKeepSlash.match(shortDmyRegex)
  if (shortMatch) {
    const day = Number(shortMatch[1])
    const month = Number(shortMatch[2])
    if (isValidCalendarDate(defaultYear, month, day)) {
      return formatIsoDate(defaultYear, month, day)
    }
  }

  return null
}

/**
 * Hàm băm tất định 32-bit (FNV-1a kết hợp Murmur3 finalizer)
 * Đảm bảo phân bố đều trên [0, 2^32 - 1] cho mọi thay đổi nhỏ ở chuỗi đầu vào.
 */
export function hashSeedString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // MurmurHash3 32-bit avalanche finalizer
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export interface SeedBuildParams {
  fullName?: string
  birthDate?: string
  birthHour?: string
  gender?: GenderType | string
  mon: MonId | string
  questionId?: string
  dateStr?: string
  partnerFullName?: string
  partnerBirthDate?: string
  partnerGender?: GenderType | string
}

/**
 * Tạo chuỗi khóa chuẩn hóa và mã seed 32-bit theo đúng công thức:
 * seed = hash(ngày sinh dương + giờ sinh nếu có + giới tính + id môn + id câu hỏi + ngày hiện tại UTC+7)
 * TUYỆT ĐỐI KHÔNG ĐƯA HỌ TÊN VÀO SEED (đổi tên không làm đổi kết quả quẻ trong cùng ngày).
 */
export function buildFortuneSeed(params: SeedBuildParams): { seed: number; seedInputKey: string; dateStr: string } {
  const normBirth = normalizeBirthDate(params.birthDate || '0000-00-00')
  const normHour = normalizeVietnameseText(params.birthHour || '')
  const normGender = normalizeVietnameseText(params.gender || 'khac')
  const normMon = normalizeVietnameseText(params.mon)
  const normQuestion = normalizeVietnameseText(params.questionId || 'default_question')
  const dateStr = params.dateStr ? normalizeBirthDate(params.dateStr) : getVietnamDateStr()

  let key = `${normBirth}${normHour ? ':' + normHour : ''}|${normGender}|${normMon}|${normQuestion}|${dateStr}`

  if (params.partnerBirthDate || params.partnerFullName) {
    const pBirth = normalizeBirthDate(params.partnerBirthDate || '')
    const pGender = normalizeVietnameseText(params.partnerGender || '')
    key += `|partner:${pBirth}:${pGender}`
  }

  return {
    seed: hashSeedString(key),
    seedInputKey: key,
    dateStr
  }
}

export interface SeededRng {
  /** Số thực giả ngẫu nhiên trong khoảng [0, 1) */
  nextFloat: () => number
  /** Số nguyên giả ngẫu nhiên trong khoảng [0, maxExclusive - 1] */
  nextInt: (maxExclusive: number) => number
}

/**
 * Bộ sinh số giả ngẫu nhiên có seed (Mulberry32 PRNG).
 * Thuần hàm, cùng seed luôn sinh ra đúng cùng dãy số trên mọi nền tảng JS/TS.
 */
export function createSeededRng(seed: number): SeededRng {
  let state = (seed >>> 0) || 0x6d2b79f5

  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const nextInt = (maxExclusive: number): number => {
    if (maxExclusive <= 1) return 0
    return Math.floor(nextFloat() * maxExclusive)
  }

  return {
    nextFloat,
    nextInt
  }
}

