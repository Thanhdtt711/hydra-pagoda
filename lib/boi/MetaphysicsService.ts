import {
  compareNguHanh as compareNguHanhPure,
  computeFullProfile,
  convertSolarToLunar,
  getCanChiNam,
  getCanChiNgay,
  getCungPhi,
  getNapAmNam,
  getSaoChieuMenh,
  getTuoiMu,
  type CanhGioId,
  type CuuDieuStarInfo,
  type FullMetaphysicsProfile,
  type GenderType as PureGender,
  type NguHanh as PureNguHanh,
  type QuanHeNguHanh as PureQuanHe,
  type TacDongNguHanh
} from './VietnameseLunarCalendar'
import type {
  GenderType,
  MetaphysicsAnalysis,
  MonId,
  NguHanh,
  PersonProfile,
  QuanHeNguHanh
} from './types'

export {
  convertSolarToLunar,
  getCanChiNam,
  getCanChiNgay,
  getCungPhi,
  getNapAmNam,
  getSaoChieuMenh,
  getTuoiMu,
  computeFullProfile
}

export type { FullMetaphysicsProfile, CuuDieuStarInfo }

/**
 * Tách ngày, tháng, năm sinh từ chuỗi YYYY-MM-DD, DD/MM/YYYY
 */
export function parseBirthDateComponents(birthDate: string | undefined | null): {
  day: number
  month: number
  year: number
} | null {
  if (!birthDate) return null
  const str = String(birthDate).trim()

  // Định dạng ISO: YYYY-MM-DD
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { day: d, month: m, year: y }
    }
  }

  // Định dạng Việt Nam: DD/MM/YYYY
  const vn = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (vn) {
    const d = Number(vn[1])
    const m = Number(vn[2])
    const y = Number(vn[3])
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { day: d, month: m, year: y }
    }
  }

  // Năm sinh thuần túy
  const yearOnly = str.match(/(\d{4})/)
  if (yearOnly) {
    const y = Number(yearOnly[1])
    if (y >= 1900 && y <= 2100) {
      return { day: 1, month: 1, year: y }
    }
  }

  return null
}

export function parseBirthYear(birthDate: string | undefined | null): number | null {
  const comp = parseBirthDateComponents(birthDate)
  return comp ? comp.year : null
}

/**
 * Tính Can Chi và Ngũ Hành Nạp Âm theo năm Âm lịch
 */
export function getCanChiAndNapAm(lunarYear: number): {
  canChi: string
  nguHanh: NguHanh
  napAmName: string
} {
  const { canChi } = getCanChiNam(lunarYear)
  const { name, hanh } = getNapAmNam(lunarYear)
  return {
    canChi,
    nguHanh: hanh,
    napAmName: name
  }
}

/**
 * So sánh quan hệ Ngũ Hành giữa 2 bản mệnh / 2 hành
 */
export function compareNguHanh(hanhA: NguHanh, hanhB: NguHanh): QuanHeNguHanh {
  const res = compareNguHanhPure(hanhA, hanhB)
  return res.relation
}

export function formatQuanHeLabel(rel: QuanHeNguHanh): string {
  if (rel === 'tuong_sinh') return 'Tương sinh'
  if (rel === 'tuong_khac') return 'Tương khắc'
  return 'Bình hòa'
}

/**
 * Tính Can Chi & Ngũ Hành của Ngày hiện tại
 */
export function getDayCanChiAndHanh(dateStr: string): {
  dayCanChi: string
  dayNguHanh: NguHanh
  dayCan: string
  dayChi: string
  dayNapAm: string
} {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  let y = 2026
  let month = 11
  let d = 6
  if (m) {
    y = Number(m[1])
    month = Number(m[2])
    d = Number(m[3])
  }
  const res = getCanChiNgay(d, month, y)
  return {
    dayCanChi: res.canChi,
    dayNguHanh: res.hanh,
    dayCan: res.can,
    dayChi: res.chi,
    dayNapAm: res.napAmName
  }
}

/**
 * Tính Sao Chiếu Mệnh Cửu Diệu
 */
export function getCuuDieuStar(birthLunarYear: number, currentLunarYear: number, gender: GenderType): CuuDieuStarInfo {
  const g: PureGender = gender === 'nu' ? 'nu' : 'nam'
  const tuoiMu = getTuoiMu(birthLunarYear, currentLunarYear)
  return getSaoChieuMenh(tuoiMu, g)
}

/**
 * Phân tích tổng hợp Bát Tự / Ngũ Hành / Cung Phi / Sao Chiếu Mệnh đa tầng
 */
export function analyzeMetaphysics(
  profile: PersonProfile | null | undefined,
  dateStr: string,
  mon: MonId,
  partnerProfile?: PersonProfile | null
): MetaphysicsAnalysis | null {
  const comp = parseBirthDateComponents(profile?.birthDate)
  if (!comp || !profile?.fullName?.trim()) {
    return null
  }

  const gender: PureGender = profile.gender === 'nu' ? 'nu' : 'nam'
  const birthHour = (profile.birthHour || '') as CanhGioId | ''

  // Ngày tham chiếu hiện tại
  const mDay = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const refDate = mDay
    ? { year: Number(mDay[1]), month: Number(mDay[2]), day: Number(mDay[3]) }
    : { year: 2026, month: 11, day: 6 }

  const full = computeFullProfile({
    solarDay: comp.day,
    solarMonth: comp.month,
    solarYear: comp.year,
    gender,
    birthHour,
    referenceDate: refDate
  })

  const dayInfo = getDayCanChiAndHanh(dateStr)

  // 1. Đối sánh Bản mệnh với Ngày
  const relDay = compareNguHanhPure(full.nguHanhMenh, dayInfo.dayNguHanh)
  // 2. Đối sánh Cung phi với Bản mệnh
  const relCungPhiMenh = compareNguHanhPure(full.cungPhiHanh, full.nguHanhMenh)
  // 3. Sao chiếu mệnh
  const star = full.saoChieuMenh

  const grounds: string[] = []
  let partnerComparison: MetaphysicsAnalysis['partnerComparison']

  // ĐỐI SÁNH THEO MÔN TƠ DUYÊN
  const pComp = parseBirthDateComponents(partnerProfile?.birthDate)
  if (mon === 'to_duyen' && pComp && partnerProfile?.fullName?.trim()) {
    const pGender: PureGender = partnerProfile.gender === 'nam' ? 'nam' : 'nu'
    const pFull = computeFullProfile({
      solarDay: pComp.day,
      solarMonth: pComp.month,
      solarYear: pComp.year,
      gender: pGender,
      birthHour: (partnerProfile.birthHour || '') as CanhGioId | '',
      referenceDate: refDate
    })

    const coupleRel = compareNguHanhPure(full.nguHanhMenh, pFull.nguHanhMenh)
    const coupleCung = compareNguHanhPure(full.cungPhiHanh, pFull.cungPhiHanh)

    partnerComparison = {
      partnerName: partnerProfile.fullName.trim(),
      partnerBirthYear: pFull.lunarYear,
      partnerCanChi: pFull.canChiNam,
      partnerNguHanh: pFull.nguHanhMenh,
      partnerNapAm: pFull.napAmName,
      partnerCungPhi: `${pFull.cungPhi} (${pFull.cungPhiHanh}) · ${pFull.cungPhiGroup}`,
      relation: coupleRel.relation,
      summary: `Mệnh ${full.nguHanhMenh} (${full.napAmName}) kết duyên Mệnh ${pFull.nguHanhMenh} (${pFull.napAmName}): ${formatQuanHeLabel(coupleRel.relation)} [${coupleRel.impact === 'thuan' ? 'Thuận' : coupleRel.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}]`
    }

    grounds.push(
      `Căn cứ Bát Tự: ${profile.fullName.trim()} (${full.canChiNam} · ${full.napAmName}) kết duyên cùng ${partnerProfile.fullName.trim()} (${pFull.canChiNam} · ${pFull.napAmName}).`
    )
    grounds.push(
      `Đối sánh Bản Mệnh: Mệnh ${full.nguHanhMenh} gặp ${pFull.nguHanhMenh}: ${formatQuanHeLabel(coupleRel.relation)} [${coupleRel.impact === 'thuan' ? 'Thuận' : coupleRel.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}] · Cung ${full.cungPhi} (${full.cungPhiHanh}) hội Cung ${pFull.cungPhi} (${pFull.cungPhiHanh}) [${coupleCung.impact === 'thuan' ? 'Thuận' : coupleCung.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}].`
    )
    grounds.push(
      `Thiên thời Ngày ${dayInfo.dayCanChi} (${dayInfo.dayNguHanh}): Mệnh ${full.nguHanhMenh} gặp ngày ${dayInfo.dayNguHanh}: ${formatQuanHeLabel(relDay.relation)} [${relDay.impact === 'thuan' ? 'Thuận' : relDay.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}].`
    )
  } else if (mon === 'dang_sao') {
    grounds.push(
      `Căn cứ Bát Tự: Tuổi ${full.canChiNam} (${full.lunarDateStr}) · ${full.tuoiMu} tuổi mụ — Bản mệnh ${full.napAmName} (${full.nguHanhMenh}), Cung phi ${full.cungPhi} (${full.cungPhiHanh} · ${full.cungPhiGroup}).`
    )
    grounds.push(
      `Sao Chiếu Mệnh niên vận: Sao ${star.name} (${star.element}) [${star.nature === 'cat' ? 'Cát Tinh · Thuận Bù' : star.nature === 'hung' ? 'Hung Tinh · Nghịch' : 'Bình Tinh · Trung tính'}] — ${star.summary}`
    )
    grounds.push(
      `Đối sánh Ngũ Hành: Cung phi ${full.cungPhi} (${full.cungPhiHanh}) với Mệnh ${full.nguHanhMenh}: ${formatQuanHeLabel(relCungPhiMenh.relation)} [${relCungPhiMenh.impact === 'thuan' ? 'Thuận' : relCungPhiMenh.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}] · Ngày ${dayInfo.dayCanChi} (${dayInfo.dayNguHanh}): ${formatQuanHeLabel(relDay.relation)} [${relDay.impact === 'thuan' ? 'Thuận' : relDay.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}].`
    )
  } else {
    grounds.push(
      `Căn cứ Bát Tự: Tuổi ${full.canChiNam} (${full.lunarDateStr} · ${full.tuoiMu} tuổi mụ) — Bản mệnh ${full.napAmName} (${full.nguHanhMenh}) · Cung phi ${full.cungPhi} (${full.cungPhiHanh} · ${full.cungPhiGroup}).`
    )
    grounds.push(
      `Đối sánh Ngũ Hành Cung - Mệnh: Cung phi ${full.cungPhi} (${full.cungPhiHanh}) với Bản mệnh ${full.nguHanhMenh}: ${formatQuanHeLabel(relCungPhiMenh.relation)} [${relCungPhiMenh.impact === 'thuan' ? 'Thuận' : relCungPhiMenh.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}].`
    )
    grounds.push(
      `Thiên thời Ngày ${dayInfo.dayCanChi} (${dayInfo.dayNguHanh}): Bản mệnh ${full.nguHanhMenh} gặp ngày ${dayInfo.dayNguHanh}: ${formatQuanHeLabel(relDay.relation)} [${relDay.impact === 'thuan' ? 'Thuận' : relDay.impact === 'nghich' ? 'Nghịch' : 'Trung tính'}].`
    )
    if (star.nature === 'cat') {
      grounds.push(`Niên Vận Hỗ Trợ: Sao ${star.name} (${star.element}) quang minh chiếu mệnh [Thuận Bù].`)
    }
  }

  return {
    birthYear: full.lunarYear,
    ageLunar: full.tuoiMu,
    canChiNam: full.canChiNam,
    nguHanhMenh: full.nguHanhMenh,
    napAmName: full.napAmName,
    cungPhi: full.cungPhi,
    cungPhiHanh: full.cungPhiHanh,
    dayCanChi: dayInfo.dayCanChi,
    dayNguHanh: dayInfo.dayNguHanh,
    relationToDay: relDay.relation,
    cuuDieuStar: {
      name: star.name,
      nature: star.nature,
      element: star.element,
      summary: star.summary
    },
    partnerComparison,
    grounds
  }
}
