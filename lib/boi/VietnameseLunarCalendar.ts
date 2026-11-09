/**
 * VietnameseLunarCalendar.ts
 * Thuật toán thiên văn chuyển đổi Lịch Âm Việt Nam chuẩn Hồ Ngọc Đức (UTC+7)
 * Cùng toàn bộ hệ thống tính toán Dịch Lý, Bát Tự, Can Chi, Nạp Âm, Cung Phi, Tuổi Mụ, Cửu Diệu.
 * Thuần hàm (Pure Functions) - không phụ thuộc đồng hồ hệ thống hay UI.
 */

export type NguHanh = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ'
export type GenderType = 'nam' | 'nu'
export type BatTrachGroup = 'Đông Tứ Mệnh' | 'Tây Tứ Mệnh'
export type QuanHeNguHanh = 'tuong_sinh' | 'tuong_khac' | 'binh_hoa'
export type TacDongNguHanh = 'thuan' | 'nghich' | 'trung'

export const THIEN_CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'] as const
export const DIA_CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'] as const

/**
 * 30 cặp Nạp Âm Lục Thập Hoa Giáp theo đúng thứ tự 60 Hoa Giáp bắt đầu từ Giáp Tý (index 0)
 */
export const NAP_AM_60_HOA_GIAP: ReadonlyArray<{ name: string; hanh: NguHanh }> = [
  { name: 'Hải Trung Kim', hanh: 'Kim' },     // 0: Giáp Tý, Ất Sửu
  { name: 'Lư Trung Hỏa', hanh: 'Hỏa' },      // 1: Bính Dần, Đinh Mão
  { name: 'Đại Lâm Mộc', hanh: 'Mộc' },       // 2: Mậu Thìn, Kỷ Tỵ
  { name: 'Lộ Bàng Thổ', hanh: 'Thổ' },       // 3: Canh Ngọ, Tân Mùi
  { name: 'Kiếm Phong Kim', hanh: 'Kim' },    // 4: Nhâm Thân, Quý Dậu
  { name: 'Sơn Đầu Hỏa', hanh: 'Hỏa' },       // 5: Giáp Tuất, Ất Hợi
  { name: 'Giản Hạ Thủy', hanh: 'Thủy' },     // 6: Bính Tý, Đinh Sửu
  { name: 'Thành Đầu Thổ', hanh: 'Thổ' },     // 7: Mậu Dần, Kỷ Mão
  { name: 'Bạch Lạp Kim', hanh: 'Kim' },      // 8: Canh Thìn, Tân Tỵ
  { name: 'Dương Liễu Mộc', hanh: 'Mộc' },    // 9: Nhâm Ngọ, Quý Mùi
  { name: 'Tuyền Trung Thủy', hanh: 'Thủy' }, // 10: Giáp Thân, Ất Dậu
  { name: 'Ốc Thượng Thổ', hanh: 'Thổ' },     // 11: Bính Tuất, Đinh Hợi
  { name: 'Tích Lịch Hỏa', hanh: 'Hỏa' },     // 12: Mậu Tý, Kỷ Sửu
  { name: 'Tùng Bách Mộc', hanh: 'Mộc' },     // 13: Canh Dần, Tân Mão
  { name: 'Trường Lưu Thủy', hanh: 'Thủy' },  // 14: Nhâm Thìn, Quý Tỵ
  { name: 'Sa Trung Kim', hanh: 'Kim' },      // 15: Giáp Ngọ, Ất Mùi
  { name: 'Sơn Hạ Hỏa', hanh: 'Hỏa' },        // 16: Bính Thân, Đinh Dậu
  { name: 'Bình Địa Mộc', hanh: 'Mộc' },      // 17: Mậu Tuất, Kỷ Hợi
  { name: 'Bích Thượng Thổ', hanh: 'Thổ' },   // 18: Canh Tý, Tân Sửu
  { name: 'Kim Bạch Kim', hanh: 'Kim' },      // 19: Nhâm Dần, Quý Mão
  { name: 'Phú Đăng Hỏa', hanh: 'Hỏa' },      // 20: Giáp Thìn, Ất Tỵ
  { name: 'Thiên Hà Thủy', hanh: 'Thủy' },    // 21: Bính Ngọ, Đinh Mùi
  { name: 'Đại Trạch Thổ', hanh: 'Thổ' },     // 22: Mậu Thân, Kỷ Dậu
  { name: 'Thoa Xuyến Kim', hanh: 'Kim' },    // 23: Canh Tuất, Tân Hợi
  { name: 'Tang Đố Mộc', hanh: 'Mộc' },       // 24: Nhâm Tý, Quý Sửu
  { name: 'Đại Khê Thủy', hanh: 'Thủy' },     // 25: Giáp Dần, Ất Mão
  { name: 'Sa Trung Thổ', hanh: 'Thổ' },      // 26: Bính Thìn, Đinh Tỵ
  { name: 'Thiên Thượng Hỏa', hanh: 'Hỏa' },  // 27: Mậu Ngọ, Kỷ Mùi
  { name: 'Thạch Lựu Mộc', hanh: 'Mộc' },     // 28: Canh Thân, Tân Dậu
  { name: 'Đại Hải Thủy', hanh: 'Thủy' }      // 29: Nhâm Tuất, Quý Hợi
]

export const CUNG_PHI_MAP: Record<number, { name: string; hanh: NguHanh; group: BatTrachGroup }> = {
  1: { name: 'Khảm', hanh: 'Thủy', group: 'Đông Tứ Mệnh' },
  2: { name: 'Khôn', hanh: 'Thổ', group: 'Tây Tứ Mệnh' },
  3: { name: 'Chấn', hanh: 'Mộc', group: 'Đông Tứ Mệnh' },
  4: { name: 'Tốn', hanh: 'Mộc', group: 'Đông Tứ Mệnh' },
  6: { name: 'Càn', hanh: 'Kim', group: 'Tây Tứ Mệnh' },
  7: { name: 'Đoài', hanh: 'Kim', group: 'Tây Tứ Mệnh' },
  8: { name: 'Cấn', hanh: 'Thổ', group: 'Tây Tứ Mệnh' },
  9: { name: 'Ly', hanh: 'Hỏa', group: 'Đông Tứ Mệnh' }
}

export interface CuuDieuStarInfo {
  name: string
  nature: 'cat' | 'hung' | 'trung'
  element: NguHanh
  summary: string
}

export const CUU_DIEU_STARS: Record<string, CuuDieuStarInfo> = {
  'La Hầu': { name: 'La Hầu', nature: 'hung', element: 'Kim', summary: 'Khẩu thiệt tinh (Kim) — Cần giữ lời ăn tiếng nói hòa ái, tránh tranh cãi thị phi.' },
  'Kế Đô': { name: 'Kế Đô', nature: 'hung', element: 'Thổ', summary: 'Ám tinh (Thổ) — Tâm dễ suy tư lo lắng, nên năng tĩnh tọa và làm việc thiện lành.' },
  'Thái Dương': { name: 'Thái Dương', nature: 'cat', element: 'Hỏa', summary: 'Đệ nhất phúc tinh (Hỏa) — Ánh nhật quang chiếu rọi, công danh và quý nhân hanh thông.' },
  'Thái Âm': { name: 'Thái Âm', nature: 'cat', element: 'Thủy', summary: 'Nguyệt cung phúc tinh (Thủy) — Hỷ sự, tài lộc và gia đạo êm ấm thuận hòa.' },
  'Mộc Đức': { name: 'Mộc Đức', nature: 'cat', element: 'Mộc', summary: 'Triều nguyên cát tinh (Mộc) — Bình an, nhân duyên tốt đẹp, sự nghiệp nảy nở.' },
  'Thủy Diệu': { name: 'Thủy Diệu', nature: 'cat', element: 'Thủy', summary: 'Phúc lộc tinh (Thủy) — Tài vận khởi sắc, lưu ý cẩn trọng lời nói và sông nước.' },
  'Thổ Tú': { name: 'Thổ Tú', nature: 'trung', element: 'Thổ', summary: 'Bình tinh thử thách (Thổ) — Đề phòng tiểu nhân gièm pha, kiên định giữ tâm bất động.' },
  'Vân Hán': { name: 'Vân Hán', nature: 'trung', element: 'Hỏa', summary: 'Bình tinh phòng thủ (Hỏa) — Cần giữ tâm ôn hòa, tránh nóng nảy vội vàng.' },
  'Thái Bạch': { name: 'Thái Bạch', nature: 'hung', element: 'Kim', summary: 'Hao tài tinh (Kim) — Cẩn trọng quản lý tiền bạc, giữ gìn sức khỏe.' }
}

/* =========================================================================
   1. THUẬT TOÁN HỒ NGỌC ĐỨC CHUYỂN ĐỔI DƯƠNG SANG ÂM LỊCH (UTC+7)
   ========================================================================= */

const PI = Math.PI

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
  }
  return jd
}

function getNewMoonDay(k: number, timeZone = 7): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = PI / 180
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)

  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3

  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr)
  C1 -= 0.0004 * Math.sin(3 * dr * Mpr)
  C1 += 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin((M + Mpr) * dr)
  C1 -= 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr)
  C1 -= 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr)
  C1 += 0.001 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((2 * Mpr + M) * dr)

  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000078 + 0.000076 * T + 0.00007 * T2
  const JdNew = Jd1 + C1 - deltat
  return Math.floor(JdNew + 0.5 + timeZone / 24)
}

function getSunLongitude(dayNumber: number, timeZone = 7): number {
  const T = (dayNumber - 2451545.5 - timeZone / 24) / 36525
  const T2 = T * T
  const dr = PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L * dr
  L = L - PI * 2 * Math.floor(L / (PI * 2))
  return Math.floor((L / PI) * 6)
}

function getLunarMonth11(yy: number, timeZone = 7): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = Math.floor(off / 29.530588853)
  let nm = getNewMoonDay(k, timeZone)
  const sunLong = getSunLongitude(nm, timeZone)
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone)
  }
  return nm
}

function getLeapMonthOffset(a11: number, timeZone = 7): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0
  let i = 1
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  do {
    last = arc
    i++
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  } while (arc !== last && i < 14)
  return i - 1
}

export interface LunarDate {
  day: number
  month: number
  year: number
  isLeap: boolean
  leapMonth: number
}

/**
 * Chuyển ngày/tháng/năm Dương lịch sang Âm lịch Việt Nam (múi giờ UTC+7).
 */
export function convertSolarToLunar(dd: number, mm: number, yy: number, timeZone = 7): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = getNewMoonDay(k + 1, timeZone)
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone)
  }

  let a11 = getLunarMonth11(yy, timeZone)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = yy
    a11 = getLunarMonth11(yy - 1, timeZone)
  } else {
    lunarYear = yy + 1
    b11 = getLunarMonth11(yy + 1, timeZone)
  }

  const lunarDay = dayNumber - monthStart + 1
  const diff = Math.floor((monthStart - a11) / 29)
  let lunarMonth = diff + 11
  let isLeap = false
  let leapMonth = 0

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone)
    leapMonth = leapMonthDiff - 2
    if (leapMonth <= 0) leapMonth += 12
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) {
        isLeap = true
      }
    }
  }

  if (lunarMonth > 12) {
    lunarMonth -= 12
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1
  }

  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeap,
    leapMonth
  }
}

/* =========================================================================
   2. CAN CHI NĂM, NẠP ÂM VÀ CUNG PHI
   ========================================================================= */

/**
 * Tính Can Chi của năm Âm lịch:
 * Can = năm âm % 10 (4 Giáp, 5 Ất, 6 Bính, 7 Đinh, 8 Mậu, 9 Kỷ, 0 Canh, 1 Tân, 2 Nhâm, 3 Quý)
 * Chi = năm âm % 12 (4 Tý, 5 Sửu, 6 Dần, 7 Mão, 8 Thìn, 9 Tỵ, 10 Ngọ, 11 Mùi, 0 Thân, 1 Dậu, 2 Tuất, 3 Hợi)
 */
export function getCanChiNam(lunarYear: number): { can: string; chi: string; canChi: string } {
  const can = THIEN_CAN[((lunarYear % 10) + 10) % 10]!
  const chi = DIA_CHI[((lunarYear % 12) + 12) % 12]!
  return { can, chi, canChi: `${can} ${chi}` }
}

/**
 * Lấy Ngũ Hành Nạp Âm của năm Âm lịch từ chu kỳ Lục Thập Hoa Giáp (Giáp Tý = 1984, index 0).
 */
export function getNapAmNam(lunarYear: number): { name: string; hanh: NguHanh } {
  const offset = ((lunarYear - 1984) % 60 + 60) % 60
  const pairIdx = Math.floor(offset / 2)
  const entry = NAP_AM_60_HOA_GIAP[pairIdx]!
  return { name: entry.name, hanh: entry.hanh }
}

/**
 * Tính Cung Phi Bát Trạch chuẩn xác theo Dịch học truyền thống:
 * - x = tổng các chữ số của 2 số cuối của năm Âm Lịch, rút gọn về 1 chữ số (1-9).
 * - Nam sinh 1900-1999: 10 - x. Nam sinh từ 2000: 9 - x.
 * - Nữ sinh 1900-1999: 5 + x. Nữ sinh từ 2000: 6 + x.
 * - Rút gọn về 1-9.
 * - Cung 5: Nam quy về Khôn (2), Nữ quy về Cấn (8).
 */
export function getCungPhi(lunarYear: number, gender: GenderType): {
  name: string
  hanh: NguHanh
  group: BatTrachGroup
  kua: number
} {
  const last2Digits = Math.abs(lunarYear) % 100
  let x = Math.floor(last2Digits / 10) + (last2Digits % 10)
  while (x > 9) {
    x = Math.floor(x / 10) + (x % 10)
  }

  let kua: number
  if (gender === 'nam') {
    kua = lunarYear < 2000 ? 10 - x : 9 - x
  } else {
    kua = lunarYear < 2000 ? 5 + x : 6 + x
  }

  while (kua > 9) kua -= 9
  while (kua <= 0) kua += 9

  if (kua === 5) {
    kua = gender === 'nam' ? 2 : 8
  }

  const info = CUNG_PHI_MAP[kua] || CUNG_PHI_MAP[1]!
  return {
    name: info.name,
    hanh: info.hanh,
    group: info.group,
    kua
  }
}

/* =========================================================================
   3. TUỔI MỤ & SAO CHIẾU MỆNH CỬU DIỆU
   ========================================================================= */

/**
 * Tính Tuổi Mụ theo năm Âm lịch:
 * Tuổi mụ = Năm âm hiện tại - Năm âm sinh + 1
 */
export function getTuoiMu(lunarBirthYear: number, currentLunarYear: number): number {
  return Math.max(1, currentLunarYear - lunarBirthYear + 1)
}

/**
 * Tính Sao Chiếu Mệnh Cửu Diệu:
 * Tuổi mụ chia 9 lấy dư (0 tính là 9). Tra bảng Nam / Nữ.
 * Đổi sao vào ngày Mùng 1 Tết Âm Lịch (theo `currentLunarYear`).
 */
export function getSaoChieuMenh(tuoiMu: number, gender: GenderType): CuuDieuStarInfo {
  const rem = ((tuoiMu % 9) + 9) % 9 // 1..8, hoặc 0 (tương đương 9)

  const maleMap: Record<number, string> = {
    1: 'La Hầu',
    2: 'Thổ Tú',
    3: 'Thủy Diệu',
    4: 'Thái Bạch',
    5: 'Thái Dương',
    6: 'Vân Hán',
    7: 'Kế Đô',
    8: 'Thái Âm',
    0: 'Mộc Đức'
  }

  const femaleMap: Record<number, string> = {
    1: 'Kế Đô',
    2: 'Vân Hán',
    3: 'Mộc Đức',
    4: 'Thái Âm',
    5: 'Thổ Tú',
    6: 'La Hầu',
    7: 'Thái Dương',
    8: 'Thái Bạch',
    0: 'Thủy Diệu'
  }

  const starName = gender === 'nu' ? femaleMap[rem]! : maleMap[rem]!
  return CUU_DIEU_STARS[starName]!
}

/* =========================================================================
   4. CAN CHI NGÀY & CAN CHI GIỜ (NGŨ THỬ ĐỘN)
   ========================================================================= */

/**
 * Tính Can Chi và Nạp Âm của Ngày Dương Lịch từ Julian Day Number (JDN).
 * Tham số `timeZone` mặc định 7 (UTC+7).
 */
export function getCanChiNgay(dd: number, mm: number, yy: number): {
  can: string
  chi: string
  canChi: string
  hanh: NguHanh
  napAmName: string
  jdn: number
} {
  const jdn = jdFromDate(dd, mm, yy)
  // Can Ngày = (JDN + 9) % 10 (0 Giáp, 1 Ất, ..., 9 Quý)
  const canIdx = ((jdn + 9) % 10 + 10) % 10
  const canNames = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const
  const can = canNames[canIdx]!

  // Chi Ngày = (JDN + 1) % 12 (0 Tý, 1 Sửu, ..., 11 Hợi)
  const chiIdx = ((jdn + 1) % 12 + 12) % 12
  const chiNames = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'] as const
  const chi = chiNames[chiIdx]!

  // Nạp Âm Ngày từ chu kỳ 60 Hoa Giáp (Giáp Tý = JDN mod 60 offset = 11)
  const offset60 = ((jdn + 49) % 60 + 60) % 60
  const napAmEntry = NAP_AM_60_HOA_GIAP[Math.floor(offset60 / 2)]!

  return {
    can,
    chi,
    canChi: `${can} ${chi}`,
    hanh: napAmEntry.hanh,
    napAmName: napAmEntry.name,
    jdn
  }
}

export type CanhGioId = 'ty' | 'suu' | 'dan' | 'mao' | 'thin' | 'ti' | 'ngo' | 'mui' | 'than' | 'dau' | 'tuat' | 'hoi'

export const CANH_GIO_INFO: Record<CanhGioId, { name: string; chi: string; chiIdx: number; timeRange: string }> = {
  ty: { name: 'Giờ Tý', chi: 'Tý', chiIdx: 0, timeRange: '23:00 - 00:59' },
  suu: { name: 'Giờ Sửu', chi: 'Sửu', chiIdx: 1, timeRange: '01:00 - 02:59' },
  dan: { name: 'Giờ Dần', chi: 'Dần', chiIdx: 2, timeRange: '03:00 - 04:59' },
  mao: { name: 'Giờ Mão', chi: 'Mão', chiIdx: 3, timeRange: '05:00 - 06:59' },
  thin: { name: 'Giờ Thìn', chi: 'Thìn', chiIdx: 4, timeRange: '07:00 - 08:59' },
  ti: { name: 'Giờ Tỵ', chi: 'Tỵ', chiIdx: 5, timeRange: '09:00 - 10:59' },
  ngo: { name: 'Giờ Ngọ', chi: 'Ngọ', chiIdx: 6, timeRange: '11:00 - 12:59' },
  mui: { name: 'Giờ Mùi', chi: 'Mùi', chiIdx: 7, timeRange: '13:00 - 14:59' },
  than: { name: 'Giờ Thân', chi: 'Thân', chiIdx: 8, timeRange: '15:00 - 16:59' },
  dau: { name: 'Giờ Dậu', chi: 'Dậu', chiIdx: 9, timeRange: '17:00 - 18:59' },
  tuat: { name: 'Giờ Tuất', chi: 'Tuất', chiIdx: 10, timeRange: '19:00 - 20:59' },
  hoi: { name: 'Giờ Hợi', chi: 'Hợi', chiIdx: 11, timeRange: '21:00 - 22:59' }
}

/**
 * Tính Can Chi của Giờ theo bài kệ "Ngũ Thử Độn" (dựa trên Can của Ngày):
 * - Giáp / Kỷ khởi Giáp Tý (Can Tý = 0)
 * - Ất / Canh khởi Bính Tý (Can Tý = 2)
 * - Bính / Tân khởi Mậu Tý (Can Tý = 4)
 * - Đinh / Nhâm khởi Canh Tý (Can Tý = 6)
 * - Mậu / Quý khởi Nhâm Tý (Can Tý = 8)
 *
 * Canh giờ Tý (chiIdx = 0) đến Hợi (chiIdx = 11). Can giờ = (startCan + chiIdx) % 10.
 */
export function getCanChiGio(dayCan: string, gioId: CanhGioId): { can: string; chi: string; canChi: string } {
  const startCanMap: Record<string, number> = {
    'Giáp': 0, 'Kỷ': 0,
    'Ất': 2, 'Canh': 2,
    'Bính': 4, 'Tân': 4,
    'Đinh': 6, 'Nhâm': 6,
    'Mậu': 8, 'Quý': 8
  }
  const canNames = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const
  const startCan = startCanMap[dayCan] ?? 0
  const chiIdx = CANH_GIO_INFO[gioId].chiIdx
  const canGio = canNames[(startCan + chiIdx) % 10]!
  const chiGio = CANH_GIO_INFO[gioId].chi
  return { can: canGio, chi: chiGio, canChi: `${canGio} ${chiGio}` }
}

/* =========================================================================
   5. BẢNG QUAN HỆ NGŨ HÀNH & ĐỐI SÁNH
   ========================================================================= */

const TUONG_SINH_PAIRS: ReadonlyArray<[NguHanh, NguHanh]> = [
  ['Mộc', 'Hỏa'], // Mộc sinh Hỏa
  ['Hỏa', 'Thổ'], // Hỏa sinh Thổ
  ['Thổ', 'Kim'], // Thổ sinh Kim
  ['Kim', 'Thủy'], // Kim sinh Thủy
  ['Thủy', 'Mộc']  // Thủy sinh Mộc
]

const TUONG_KHAC_PAIRS: ReadonlyArray<[NguHanh, NguHanh]> = [
  ['Mộc', 'Thổ'], // Mộc khắc Thổ
  ['Thổ', 'Thủy'], // Thổ khắc Thủy
  ['Thủy', 'Hỏa'], // Thủy khắc Hỏa
  ['Hỏa', 'Kim'], // Hỏa khắc Kim
  ['Kim', 'Mộc']  // Kim khắc Mộc
]

export function compareNguHanh(hanhA: NguHanh, hanhB: NguHanh): {
  relation: QuanHeNguHanh
  impact: TacDongNguHanh
  description: string
} {
  if (hanhA === hanhB) {
    return {
      relation: 'binh_hoa',
      impact: 'trung',
      description: `Đồng hành ${hanhA} — Khí vận bình ổn, hòa hợp`
    }
  }

  for (const [sinh, duocSinh] of TUONG_SINH_PAIRS) {
    if (hanhA === sinh && hanhB === duocSinh) {
      return {
        relation: 'tuong_sinh',
        impact: 'thuan',
        description: `${hanhA} sinh ${hanhB} — Sinh xuất, hao khí trợ lực`
      }
    }
    if (hanhA === duocSinh && hanhB === sinh) {
      return {
        relation: 'tuong_sinh',
        impact: 'thuan',
        description: `${hanhB} sinh ${hanhA} — Sinh nhập, vượng khí hanh thông`
      }
    }
  }

  for (const [khac, biKhac] of TUONG_KHAC_PAIRS) {
    if (hanhA === khac && hanhB === biKhac) {
      return {
        relation: 'tuong_khac',
        impact: 'nghich',
        description: `${hanhA} khắc ${hanhB} — Khắc xuất, nhiều hao tổn`
      }
    }
    if (hanhA === biKhac && hanhB === khac) {
      return {
        relation: 'tuong_khac',
        impact: 'nghich',
        description: `${hanhB} khắc ${hanhA} — Khắc nhập, thử thách nội tâm`
      }
    }
  }

  return { relation: 'binh_hoa', impact: 'trung', description: 'Bình hòa' }
}

/**
 * Tách ngày, tháng, năm từ chuỗi ngày sinh (hỗ trợ DD/MM/YYYY, DD-MM-YYYY hoặc YYYY-MM-DD)
 */
export function parseBirthDateComponents(raw: string | undefined | null): { day: number; month: number; year: number } | null {
  if (!raw) return null
  const str = String(raw).trim()
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]!, 10)
    const month = parseInt(dmyMatch[2]!, 10)
    const year = parseInt(dmyMatch[3]!, 10)
    return { day, month, year }
  }
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1]!, 10)
    const month = parseInt(ymdMatch[2]!, 10)
    const day = parseInt(ymdMatch[3]!, 10)
    return { day, month, year }
  }
  return null
}

/* =========================================================================
   6. HÀM TỔNG HỢP HỒ SƠ BÁT TỰ ĐẦY ĐỦ (DÙNG CHO BƯỚC 1 VÀ ENGINE)
   ========================================================================= */

export interface FullMetaphysicsProfile {
  // Dương lịch
  solarDay: number
  solarMonth: number
  solarYear: number
  birthHour?: CanhGioId | ''
  birthHourLabel?: string
  gender: GenderType

  // Âm lịch
  lunarDay: number
  lunarMonth: number
  lunarYear: number
  isLeap: boolean
  lunarDateStr: string

  // Can Chi & Bát Trạch
  canChiNam: string
  canNam: string
  chiNam: string
  napAmName: string
  nguHanhMenh: NguHanh

  cungPhi: string
  cungPhiHanh: NguHanh
  cungPhiGroup: BatTrachGroup
  cungPhiKua: number

  tuoiDuong: number
  tuoiMu: number
  saoChieuMenh: CuuDieuStarInfo

  // Can Chi Giờ (nếu có)
  canChiGio?: string
}

export function computeFullProfile(params: {
  solarDay: number
  solarMonth: number
  solarYear: number
  gender: GenderType
  birthHour?: CanhGioId | ''
  referenceDate?: { day: number; month: number; year: number }
}): FullMetaphysicsProfile {
  const ref = params.referenceDate || { day: 6, month: 11, year: 2026 }
  const lunar = convertSolarToLunar(params.solarDay, params.solarMonth, params.solarYear)
  const currentLunar = convertSolarToLunar(ref.day, ref.month, ref.year)

  const { can, chi, canChi: canChiNam } = getCanChiNam(lunar.year)
  const { name: napAmName, hanh: nguHanhMenh } = getNapAmNam(lunar.year)
  const cungPhi = getCungPhi(lunar.year, params.gender)
  const tuoiDuong = Math.max(0, ref.year - params.solarYear)
  const tuoiMu = getTuoiMu(lunar.year, currentLunar.year)
  const sao = getSaoChieuMenh(tuoiMu, params.gender)

  let canChiGio: string | undefined
  let birthHourLabel: string | undefined
  if (params.birthHour && CANH_GIO_INFO[params.birthHour]) {
    const dayInfo = getCanChiNgay(params.solarDay, params.solarMonth, params.solarYear)
    const gioRes = getCanChiGio(dayInfo.can, params.birthHour)
    canChiGio = gioRes.canChi
    birthHourLabel = `${CANH_GIO_INFO[params.birthHour].name} (${gioRes.canChi} · ${CANH_GIO_INFO[params.birthHour].timeRange})`
  }

  const leapTag = lunar.isLeap ? ' (Nhuận)' : ''
  const lunarDateStr = `${String(lunar.day).padStart(2, '0')}/${String(lunar.month).padStart(2, '0')}${leapTag}/${lunar.year} (${canChiNam})`

  return {
    solarDay: params.solarDay,
    solarMonth: params.solarMonth,
    solarYear: params.solarYear,
    birthHour: params.birthHour,
    birthHourLabel,
    gender: params.gender,

    lunarDay: lunar.day,
    lunarMonth: lunar.month,
    lunarYear: lunar.year,
    isLeap: lunar.isLeap,
    lunarDateStr,

    canChiNam,
    canNam: can,
    chiNam: chi,
    napAmName,
    nguHanhMenh,

    cungPhi: cungPhi.name,
    cungPhiHanh: cungPhi.hanh,
    cungPhiGroup: cungPhi.group,
    cungPhiKua: cungPhi.kua,

    tuoiDuong,
    tuoiMu,
    saoChieuMenh: sao,
    canChiGio
  }
}

