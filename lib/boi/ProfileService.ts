import {
  computeFullProfile,
  parseBirthDateComponents,
  type CanhGioId,
  type FullMetaphysicsProfile,
  type GenderType as PureGender
} from './VietnameseLunarCalendar'
import type { GenderType, PersonProfile, SavedFortuneProfile } from './types'

const STORAGE_KEY = 'van_canh_fortune_profile_v3'
const PARTNERS_STORAGE_KEY = 'van_canh_partner_contacts_v3'

export const BIRTH_HOUR_OPTIONS: ReadonlyArray<{ id: CanhGioId | ''; label: string; timeRange: string }> = [
  { id: '', label: 'Không rõ giờ sinh (Mặc định)', timeRange: '' },
  { id: 'ty', label: 'Giờ Tý', timeRange: '23:00 - 00:59' },
  { id: 'suu', label: 'Giờ Sửu', timeRange: '01:00 - 02:59' },
  { id: 'dan', label: 'Giờ Dần', timeRange: '03:00 - 04:59' },
  { id: 'mao', label: 'Giờ Mão', timeRange: '05:00 - 06:59' },
  { id: 'thin', label: 'Giờ Thìn', timeRange: '07:00 - 08:59' },
  { id: 'ti', label: 'Giờ Tỵ', timeRange: '09:00 - 10:59' },
  { id: 'ngo', label: 'Giờ Ngọ', timeRange: '11:00 - 12:59' },
  { id: 'mui', label: 'Giờ Mùi', timeRange: '13:00 - 14:59' },
  { id: 'than', label: 'Giờ Thân', timeRange: '15:00 - 16:59' },
  { id: 'dau', label: 'Giờ Dậu', timeRange: '17:00 - 18:59' },
  { id: 'tuat', label: 'Giờ Tuất', timeRange: '19:00 - 20:59' },
  { id: 'hoi', label: 'Giờ Hợi', timeRange: '21:00 - 22:59' }
]

export interface ProfileValidationResult {
  valid: boolean
  error?: string
  fieldErrors: {
    fullName?: string
    birthDate?: string
    gender?: string
    birthHour?: string
  }
  sanitized?: PersonProfile
}

/**
 * Chuẩn hóa họ tên: chuẩn NFC, gộp khoảng trắng, 2-50 ký tự,
 * chỉ chấp nhận chữ cái tiếng Việt có dấu, khoảng trắng, gạch nối '-', nháy đơn '\''.
 * Từ chối chữ số, ký tự đặc biệt, emoji.
 */
export function sanitizeFullName(raw: string | undefined | null): { name: string; error?: string } {
  if (!raw) {
    return { name: '', error: 'Vui lòng nhập họ và tên.' }
  }
  const normalized = String(raw).normalize('NFC').trim().replace(/\s+/g, ' ')
  if (normalized.length < 2) {
    return { name: normalized, error: 'Họ và tên phải có tối thiểu 2 ký tự.' }
  }
  if (normalized.length > 50) {
    return { name: normalized, error: 'Họ và tên không được vượt quá 50 ký tự.' }
  }

  // Regex hỗ trợ Unicode chữ tiếng Việt (Latin Extended Additional)
  const nameRegex = /^[a-zA-Z\s'-àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]+$/
  if (!nameRegex.test(normalized)) {
    return { name: normalized, error: 'Họ tên chỉ gồm chữ cái tiếng Việt có dấu, không chứa số, emoji hay ký hiệu lạ.' }
  }

  return { name: normalized }
}

/**
 * Kiểm tra tính hợp lệ của ngày sinh dương lịch
 */
export function sanitizeBirthDate(raw: string | undefined | null): {
  isoDate: string
  dmyDate: string
  day: number
  month: number
  year: number
  error?: string
} {
  if (!raw) {
    return { isoDate: '', dmyDate: '', day: 0, month: 0, year: 0, error: 'Vui lòng nhập ngày tháng năm sinh.' }
  }

  const comp = parseBirthDateComponents(raw)
  if (!comp) {
    return { isoDate: '', dmyDate: '', day: 0, month: 0, year: 0, error: 'Định dạng ngày sinh không hợp lệ (nhập DD/MM/YYYY).' }
  }

  const { day, month, year } = comp

  if (year < 1900) {
    return { isoDate: '', dmyDate: '', day, month, year, error: 'Năm sinh phải từ năm 1900 trở lại đây.' }
  }

  // Kiểm tra ngày thực tế theo lịch Gregory (bắt lỗi 31/02, 29/02 năm không nhuận)
  const testDate = new Date(year, month - 1, day)
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return { isoDate: '', dmyDate: '', day, month, year, error: `Ngày ${day}/${month}/${year} không tồn tại trên lịch.` }
  }

  // Ngày tương lai
  const now = new Date()
  if (testDate.getTime() > now.getTime()) {
    return { isoDate: '', dmyDate: '', day, month, year, error: 'Ngày sinh không được ở thời điểm tương lai.' }
  }

  // Tuổi > 120
  const age = now.getFullYear() - year
  if (age > 120) {
    return { isoDate: '', dmyDate: '', day, month, year, error: 'Tuổi không được vượt quá 120 tuổi.' }
  }

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const dmyDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`

  return { isoDate, dmyDate, day, month, year }
}

/**
 * Xác thực toàn diện hồ sơ người xem quẻ
 */
export function validatePersonProfile(profile: Partial<PersonProfile> | null | undefined): ProfileValidationResult {
  const fieldErrors: ProfileValidationResult['fieldErrors'] = {}

  if (!profile) {
    return {
      valid: false,
      error: 'Vui lòng điền thông tin hồ sơ.',
      fieldErrors: { fullName: 'Chưa nhập họ tên.', birthDate: 'Chưa nhập ngày sinh.', gender: 'Chưa chọn giới tính.' }
    }
  }

  // 1. Họ và tên
  const nameRes = sanitizeFullName(profile.fullName)
  if (nameRes.error) {
    fieldErrors.fullName = nameRes.error
  }

  // 2. Ngày sinh
  const dateRes = sanitizeBirthDate(profile.birthDate)
  if (dateRes.error) {
    fieldErrors.birthDate = dateRes.error
  }

  // 3. Giới tính (bắt buộc chọn nam hoặc nu)
  const gRaw = String(profile.gender || '').toLowerCase().trim()
  let gender: GenderType | undefined
  if (gRaw === 'nam' || gRaw === 'nu') {
    gender = gRaw as GenderType
  } else {
    fieldErrors.gender = 'Vui lòng chọn giới tính Nam hoặc Nữ.'
  }

  // 4. Giờ sinh
  const rawHour = String(profile.birthHour || '').trim() as CanhGioId | ''
  const validHours: Array<CanhGioId | ''> = ['', 'ty', 'suu', 'dan', 'mao', 'thin', 'ti', 'ngo', 'mui', 'than', 'dau', 'tuat', 'hoi']
  const birthHour = validHours.includes(rawHour) ? rawHour : ''

  const hasError = Object.keys(fieldErrors).length > 0
  if (hasError) {
    const firstErr = fieldErrors.fullName || fieldErrors.birthDate || fieldErrors.gender || 'Thông tin chưa hợp lệ.'
    return {
      valid: false,
      error: firstErr,
      fieldErrors
    }
  }

  return {
    valid: true,
    fieldErrors: {},
    sanitized: {
      fullName: nameRes.name,
      birthDate: dateRes.isoDate,
      birthHour,
      gender: gender!
    }
  }
}

/**
 * Tự động tính toán dữ liệu xem trước cho thẻ xem trước Bát Tự
 */
export function previewProfileMetaphysics(profile: PersonProfile): FullMetaphysicsProfile | null {
  const comp = parseBirthDateComponents(profile.birthDate)
  if (!comp) return null
  const gender: PureGender = profile.gender === 'nu' ? 'nu' : 'nam'
  const hour = (profile.birthHour || '') as CanhGioId | ''

  return computeFullProfile({
    solarDay: comp.day,
    solarMonth: comp.month,
    solarYear: comp.year,
    gender,
    birthHour: hour
  })
}

/* =========================================================================
   LƯU TRỮ VÀ TẢI HỒ SƠ CHÍNH
   ========================================================================= */

export function loadSavedProfile(): SavedFortuneProfile | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedFortuneProfile
    const check = validatePersonProfile(parsed)
    if (!check.valid || !check.sanitized) return null

    let partner: PersonProfile | null = null
    if (parsed.partner) {
      const pCheck = validatePersonProfile(parsed.partner)
      if (pCheck.valid && pCheck.sanitized) {
        partner = pCheck.sanitized
      }
    }

    return {
      ...check.sanitized,
      partner,
      updatedAt: Number(parsed.updatedAt || Date.now())
    }
  } catch {
    return null
  }
}

export function saveProfile(
  profile: PersonProfile,
  partner?: PersonProfile | null
): SavedFortuneProfile {
  const check = validatePersonProfile(profile)
  if (!check.valid || !check.sanitized) {
    throw new Error(check.error || 'Hồ sơ không hợp lệ')
  }

  let cleanPartner: PersonProfile | null = null
  if (partner && (partner.fullName?.trim() || partner.birthDate?.trim())) {
    const pCheck = validatePersonProfile(partner)
    if (pCheck.valid && pCheck.sanitized) {
      cleanPartner = pCheck.sanitized
    }
  }

  const saved: SavedFortuneProfile = {
    ...check.sanitized,
    partner: cleanPartner,
    updatedAt: Date.now()
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
      // Bỏ qua lỗi quota
    }
  }
  return saved
}

export function clearSavedProfile(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(PARTNERS_STORAGE_KEY)
    } catch {
      // Ignore
    }
  }
}

/* =========================================================================
   DANH BẠ NGƯỜI THƯƠNG (TỐI ĐA 5 HỒ SƠ CHO MÔN TƠ DUYÊN)
   ========================================================================= */

export function loadPartnerContacts(): PersonProfile[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(PARTNERS_STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PersonProfile[]
    if (!Array.isArray(list)) return []
    return list
      .map(p => validatePersonProfile(p))
      .filter(r => r.valid && r.sanitized)
      .map(r => r.sanitized!)
      .slice(0, 5)
  } catch {
    return []
  }
}

export function savePartnerContact(partner: PersonProfile): PersonProfile[] {
  const check = validatePersonProfile(partner)
  if (!check.valid || !check.sanitized) {
    throw new Error(check.error || 'Hồ sơ người thương không hợp lệ')
  }
  const current = loadPartnerContacts()
  // Lọc trùng theo họ tên + ngày sinh
  const filtered = current.filter(
    p => !(p.fullName === check.sanitized!.fullName && p.birthDate === check.sanitized!.birthDate)
  )
  const updated = [check.sanitized!, ...filtered].slice(0, 5)

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }
  return updated
}

export function deletePartnerContact(fullName: string, birthDate: string): PersonProfile[] {
  const current = loadPartnerContacts()
  const updated = current.filter(p => !(p.fullName === fullName && p.birthDate === birthDate))
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }
  return updated
}
