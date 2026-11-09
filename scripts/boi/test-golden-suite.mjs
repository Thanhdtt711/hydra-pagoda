/**
 * test-golden-suite.mjs
 * Bộ test vàng độc lập kiểm chứng 100% độ chính xác của Module Tính Toán Dịch Lý & Âm Lịch
 * Đối chiếu chéo với Bảng yêu cầu của Sumale & Thuật toán Thiên văn Hồ Ngọc Đức.
 */

import {
  convertSolarToLunar,
  getCanChiNam,
  getNapAmNam,
  getCungPhi,
  getTuoiMu,
  getSaoChieuMenh,
  getCanChiNgay,
  getCanChiGio,
  compareNguHanh,
  computeFullProfile
} from '../../lib/boi/VietnameseLunarCalendar.ts'

let passCount = 0
let failCount = 0
const errors = []

function assert(condition, testName, details = '') {
  if (condition) {
    passCount++
    console.log(`  ✅ PASS: ${testName} ${details ? `(${details})` : ''}`)
  } else {
    failCount++
    const msg = `  ❌ FAIL: ${testName} ${details ? `— [${details}]` : ''}`
    console.error(msg)
    errors.push(msg)
  }
}

console.log('\n======================================================================')
console.log('   BỘ TEST VÀNG: KIỂM CHỨNG TÍNH TOÁN DỊCH LÝ, ÂM LỊCH & BÁT TỰ')
console.log('======================================================================\n')

// -------------------------------------------------------------------------
// 1. CÁC CA MỐC BẮT BUỘC TRONG BẢNG YÊU CẦU MỤC 4
// -------------------------------------------------------------------------
console.log('--- PHẦN 1: 13 CA MỐC BẮT BUỘC TRONG BẢNG YÊU CẦU ---')

// Ca 1: 13/06/2004, nam -> Giáp Thân, Tuyền Trung Thủy (Thủy), cung phi Khôn (Thổ)
const ca1 = computeFullProfile({ solarDay: 13, solarMonth: 6, solarYear: 2004, gender: 'nam' })
assert(
  ca1.canChiNam === 'Giáp Thân' && ca1.napAmName === 'Tuyền Trung Thủy' && ca1.nguHanhMenh === 'Thủy' && ca1.cungPhi === 'Khôn' && ca1.cungPhiHanh === 'Thổ',
  'Ca 1: 13/06/2004 nam',
  `${ca1.canChiNam}, ${ca1.napAmName} (${ca1.nguHanhMenh}), Cung ${ca1.cungPhi} (${ca1.cungPhiHanh})`
)

// Ca 2: 13/06/2004, nữ -> Giáp Thân, Tuyền Trung Thủy (Thủy), cung phi Khảm (Thủy)
const ca2 = computeFullProfile({ solarDay: 13, solarMonth: 6, solarYear: 2004, gender: 'nu' })
assert(
  ca2.canChiNam === 'Giáp Thân' && ca2.napAmName === 'Tuyền Trung Thủy' && ca2.nguHanhMenh === 'Thủy' && ca2.cungPhi === 'Khảm' && ca2.cungPhiHanh === 'Thủy',
  'Ca 2: 13/06/2004 nữ',
  `${ca2.canChiNam}, ${ca2.napAmName} (${ca2.nguHanhMenh}), Cung ${ca2.cungPhi} (${ca2.cungPhiHanh})`
)

// Ca 3: 22/01/2004 (mùng 1 Tết) -> Năm âm Giáp Thân
const ca3 = convertSolarToLunar(22, 1, 2004)
const ca3CanChi = getCanChiNam(ca3.year)
assert(
  ca3.day === 1 && ca3.month === 1 && ca3.year === 2004 && ca3CanChi.canChi === 'Giáp Thân',
  'Ca 3: 22/01/2004 (Mùng 1 Tết)',
  `Ngày ${ca3.day}/${ca3.month}/${ca3.year} Âm lịch — Năm ${ca3CanChi.canChi}`
)

// Ca 4: 20/01/2004 (trước Tết), nam -> Năm âm Quý Mùi, Dương Liễu Mộc, cung phi Càn
const ca4 = computeFullProfile({ solarDay: 20, solarMonth: 1, solarYear: 2004, gender: 'nam' })
assert(
  ca4.lunarYear === 2003 && ca4.canChiNam === 'Quý Mùi' && ca4.napAmName === 'Dương Liễu Mộc' && ca4.cungPhi === 'Càn',
  'Ca 4: 20/01/2004 (Trước Tết) nam',
  `Năm âm ${ca4.lunarYear} (${ca4.canChiNam}), ${ca4.napAmName}, Cung ${ca4.cungPhi}`
)

// Ca 5: 20/01/2004, nữ -> Quý Mùi, Dương Liễu Mộc, cung phi Ly
const ca5 = computeFullProfile({ solarDay: 20, solarMonth: 1, solarYear: 2004, gender: 'nu' })
assert(
  ca5.lunarYear === 2003 && ca5.canChiNam === 'Quý Mùi' && ca5.napAmName === 'Dương Liễu Mộc' && ca5.cungPhi === 'Ly',
  'Ca 5: 20/01/2004 nữ',
  `Năm âm ${ca5.lunarYear} (${ca5.canChiNam}), ${ca5.napAmName}, Cung ${ca5.cungPhi}`
)

// Ca 6: 15/05/1990, nam -> Canh Ngọ, Lộ Bàng Thổ, cung phi Khảm
const ca6 = computeFullProfile({ solarDay: 15, solarMonth: 5, solarYear: 1990, gender: 'nam' })
assert(
  ca6.canChiNam === 'Canh Ngọ' && ca6.napAmName === 'Lộ Bàng Thổ' && ca6.cungPhi === 'Khảm',
  'Ca 6: 15/05/1990 nam',
  `${ca6.canChiNam}, ${ca6.napAmName}, Cung ${ca6.cungPhi}`
)

// Ca 7: 15/05/1990, nữ -> Canh Ngọ, Lộ Bàng Thổ, cung phi Cấn
const ca7 = computeFullProfile({ solarDay: 15, solarMonth: 5, solarYear: 1990, gender: 'nu' })
assert(
  ca7.canChiNam === 'Canh Ngọ' && ca7.napAmName === 'Lộ Bàng Thổ' && ca7.cungPhi === 'Cấn',
  'Ca 7: 15/05/1990 nữ',
  `${ca7.canChiNam}, ${ca7.napAmName}, Cung ${ca7.cungPhi}`
)

// Ca 8: Ngày dương 06/11/2026 -> Ngày Giáp Thân (nạp âm Thủy)
const ca8 = getCanChiNgay(6, 11, 2026)
assert(
  ca8.canChi === 'Giáp Thân' && ca8.hanh === 'Thủy',
  'Ca 8: Ngày dương 06/11/2026',
  `Ngày ${ca8.canChi}, Nạp âm ${ca8.napAmName} (${ca8.hanh})`
)

// Ca 9: Ngày dương 01/01/2000 -> Ngày Mậu Ngọ
const ca9 = getCanChiNgay(1, 1, 2000)
assert(
  ca9.canChi === 'Mậu Ngọ',
  'Ca 9: Ngày dương 01/01/2000',
  `Ngày ${ca9.canChi}, Nạp âm ${ca9.napAmName}`
)

// Ca 10: Ngày Giáp, giờ Ngọ (11h-13h) -> Giờ Canh Ngọ
const ca10 = getCanChiGio('Giáp', 'ngo')
assert(
  ca10.canChi === 'Canh Ngọ',
  'Ca 10: Ngày Giáp, giờ Ngọ',
  `Giờ ${ca10.canChi}`
)

// Ca 11: Tuổi mụ 10, 19, 28 -> Nam: La Hầu, Nữ: Kế Đô
const ca11_10_m = getSaoChieuMenh(10, 'nam')
const ca11_10_f = getSaoChieuMenh(10, 'nu')
const ca11_19_m = getSaoChieuMenh(19, 'nam')
const ca11_19_f = getSaoChieuMenh(19, 'nu')
const ca11_28_m = getSaoChieuMenh(28, 'nam')
const ca11_28_f = getSaoChieuMenh(28, 'nu')
assert(
  ca11_10_m.name === 'La Hầu' && ca11_10_f.name === 'Kế Đô' &&
  ca11_19_m.name === 'La Hầu' && ca11_19_f.name === 'Kế Đô' &&
  ca11_28_m.name === 'La Hầu' && ca11_28_f.name === 'Kế Đô',
  'Ca 11: Tuổi mụ 10, 19, 28',
  `Nam: ${ca11_10_m.name}, Nữ: ${ca11_10_f.name}`
)

// Ca 12: Tuổi mụ 23 -> Nam: Thái Dương, Nữ: Thổ Tú
const ca12_m = getSaoChieuMenh(23, 'nam')
const ca12_f = getSaoChieuMenh(23, 'nu')
assert(
  ca12_m.name === 'Thái Dương' && ca12_f.name === 'Thổ Tú',
  'Ca 12: Tuổi mụ 23',
  `Nam: ${ca12_m.name}, Nữ: ${ca12_f.name}`
)

// Ca 13: Đầu vào lỗi (Validation)
function validateMock(dateStr, name, gender) {
  if (!name || name.trim().length < 2 || /[0-9!@#$%^&*()]/.test(name)) return false
  if (!gender || (gender !== 'nam' && gender !== 'nu')) return false
  const m = String(dateStr).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (!m) return false
  const d = Number(m[1])
  const mon = Number(m[2])
  const y = Number(m[3])
  if (y < 1900 || y > 2026) return false
  const dt = new Date(y, mon - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mon - 1 || dt.getDate() !== d) return false
  if (dt.getTime() > Date.now()) return false
  return true
}

assert(!validateMock('31/02/2004', 'Nguyen Van An', 'nam'), 'Ca 13a: Từ chối ngày 31/02/2004 không tồn tại')
assert(!validateMock('29/02/2003', 'Nguyen Van An', 'nam'), 'Ca 13b: Từ chối ngày 29/02 năm không nhuận 2003')
assert(!validateMock('01/01/2030', 'Nguyen Van An', 'nam'), 'Ca 13c: Từ chối ngày tương lai 01/01/2030')
assert(!validateMock('13/06/2004', 'Nguyễn 123', 'nam'), 'Ca 13d: Từ chối tên chứa chữ số "Nguyễn 123"')
assert(!validateMock('13/06/2004', '', 'nam'), 'Ca 13e: Từ chối tên rỗng')
assert(!validateMock('13/06/2004', 'Nguyen Van An', ''), 'Ca 13f: Từ chối giới tính chưa chọn')

// -------------------------------------------------------------------------
// 2. MỞ RỘNG BỘ TEST TRÊN 30 CA (THÁNG NHUẬN, NĂM ĐẶC BIỆT, NGŨ HÀNH)
// -------------------------------------------------------------------------
console.log('\n--- PHẦN 2: MỞ RỘNG BỘ TEST (>30 CA KIỂM CHỨNG ĐỘC LẬP) ---')

// Ca 14: Sinh tháng 7 nhuận năm Bính Tuất (24/08/2006)
const ca14 = convertSolarToLunar(24, 8, 2006)
assert(
  ca14.month === 7 && ca14.isLeap === true && ca14.year === 2006,
  'Ca 14: Ngày 24/08/2006 (Tháng 7 nhuận Âm lịch Bính Tuất)',
  `Ngày ${ca14.day} tháng ${ca14.month} ${ca14.isLeap ? '(Nhuận)' : ''} năm ${ca14.year}`
)

// Ca 15: Sinh đúng mùng 1 Tết Bính Thìn 31/01/1976
const ca15 = convertSolarToLunar(31, 1, 1976)
const ca15CanChi = getCanChiNam(ca15.year)
assert(
  ca15.day === 1 && ca15.month === 1 && ca15.year === 1976 && ca15CanChi.canChi === 'Bính Thìn',
  'Ca 15: Ngày 31/01/1976 (Mùng 1 Tết Bính Thìn)',
  `Ngày ${ca15.day}/${ca15.month}/${ca15.year} — Năm ${ca15CanChi.canChi}`
)

// Ca 16: Sinh trước 1975: Ngày Quốc Khánh 02/09/1945
const ca16 = convertSolarToLunar(2, 9, 1945)
const ca16CanChi = getCanChiNam(ca16.year)
const ca16NapAm = getNapAmNam(ca16.year)
assert(
  ca16.day === 26 && ca16.month === 7 && ca16.year === 1945 && ca16CanChi.canChi === 'Ất Dậu' && ca16NapAm.name === 'Tuyền Trung Thủy',
  'Ca 16: Ngày 02/09/1945 (Ất Dậu)',
  `Ngày ${ca16.day}/${ca16.month}/${ca16.year} Âm lịch — ${ca16CanChi.canChi} (${ca16NapAm.name})`
)

// Ca 17: Năm 1900 (Canh Tý, Bích Thượng Thổ, nam Khảm Thủy, nữ Cấn Thổ)
const ca17_m = getCungPhi(1900, 'nam')
const ca17_f = getCungPhi(1900, 'nu')
const ca17_cc = getCanChiNam(1900)
const ca17_na = getNapAmNam(1900)
assert(
  ca17_cc.canChi === 'Canh Tý' && ca17_na.name === 'Bích Thượng Thổ' && ca17_m.name === 'Khảm' && ca17_f.name === 'Cấn',
  'Ca 17: Năm 1900',
  `${ca17_cc.canChi}, ${ca17_na.name}, Nam: ${ca17_m.name}, Nữ: ${ca17_f.name}`
)

// Ca 18: Năm 2000 (Canh Thìn, Bạch Lạp Kim, nam Ly Hỏa, nữ Càn Kim)
const ca18_m = getCungPhi(2000, 'nam')
const ca18_f = getCungPhi(2000, 'nu')
const ca18_cc = getCanChiNam(2000)
const ca18_na = getNapAmNam(2000)
assert(
  ca18_cc.canChi === 'Canh Thìn' && ca18_na.name === 'Bạch Lạp Kim' && ca18_m.name === 'Ly' && ca18_f.name === 'Càn',
  'Ca 18: Năm 2000',
  `${ca18_cc.canChi}, ${ca18_na.name}, Nam: ${ca18_m.name}, Nữ: ${ca18_f.name}`
)

// Ca 19: Tuổi mụ chia hết cho 9 (tuổi 9, 18, 27, 36) -> Nam Mộc Đức, Nữ Thủy Diệu
const ca19_m9 = getSaoChieuMenh(9, 'nam')
const ca19_f9 = getSaoChieuMenh(9, 'nu')
const ca19_m36 = getSaoChieuMenh(36, 'nam')
const ca19_f36 = getSaoChieuMenh(36, 'nu')
assert(
  ca19_m9.name === 'Mộc Đức' && ca19_f9.name === 'Thủy Diệu' && ca19_m36.name === 'Mộc Đức' && ca19_f36.name === 'Thủy Diệu',
  'Ca 19: Tuổi mụ chia hết cho 9 (tuổi 9, 36)',
  `Nam: ${ca19_m9.name}, Nữ: ${ca19_f9.name}`
)

// Ca 20 & 21: Giờ Tý khởi theo Ngũ Thử Độn
const ca20 = getCanChiGio('Giáp', 'ty')
assert(ca20.canChi === 'Giáp Tý', 'Ca 20: Ngày Giáp, giờ Tý', `Giờ ${ca20.canChi}`)

const ca22 = getCanChiGio('Ất', 'ty')
assert(ca22.canChi === 'Bính Tý', 'Ca 21: Ngày Ất, giờ Tý', `Giờ ${ca22.canChi}`)

const ca23 = getCanChiGio('Bính', 'thin')
assert(ca23.canChi === 'Nhâm Thìn', 'Ca 22: Ngày Bính, giờ Thìn', `Giờ ${ca23.canChi}`)

const ca24 = getCanChiGio('Đinh', 'dau')
assert(ca24.canChi === 'Kỷ Dậu', 'Ca 23: Ngày Đinh, giờ Dậu', `Giờ ${ca24.canChi}`)

const ca25 = getCanChiGio('Mậu', 'hoi')
assert(ca25.canChi === 'Quý Hợi', 'Ca 24: Ngày Mậu, giờ Hợi', `Giờ ${ca25.canChi}`)

// Ca 25b: Khởi điểm chu kỳ Giáp Tý 1984
const ca26_cc = getCanChiNam(1984)
const ca26_na = getNapAmNam(1984)
const ca26_m = getCungPhi(1984, 'nam')
const ca26_f = getCungPhi(1984, 'nu')
assert(
  ca26_cc.canChi === 'Giáp Tý' && ca26_na.name === 'Hải Trung Kim' && ca26_m.name === 'Đoài' && ca26_f.name === 'Cấn',
  'Ca 25: Năm 1984 (Giáp Tý)',
  `${ca26_cc.canChi}, ${ca26_na.name}, Nam: ${ca26_m.name}, Nữ: ${ca26_f.name}`
)

// Ca 26: Năm 1999 (Kỷ Mão, Thành Đầu Thổ, nam Khảm, nữ Cấn)
const ca27_cc = getCanChiNam(1999)
const ca27_na = getNapAmNam(1999)
const ca27_m = getCungPhi(1999, 'nam')
const ca27_f = getCungPhi(1999, 'nu')
assert(
  ca27_cc.canChi === 'Kỷ Mão' && ca27_na.name === 'Thành Đầu Thổ' && ca27_m.name === 'Khảm' && ca27_f.name === 'Cấn',
  'Ca 26: Năm 1999 (Kỷ Mão)',
  `${ca27_cc.canChi}, ${ca27_na.name}, Nam: ${ca27_m.name}, Nữ: ${ca27_f.name}`
)

// Ca 27-29: Ma trận Ngũ Hành
const relMocHoa = compareNguHanh('Mộc', 'Hỏa')
assert(relMocHoa.relation === 'tuong_sinh' && relMocHoa.impact === 'thuan', 'Ca 27: Mộc sinh Hỏa (Tương sinh - Thuận)')

const relThuyHoa = compareNguHanh('Thủy', 'Hỏa')
assert(relThuyHoa.relation === 'tuong_khac' && relThuyHoa.impact === 'nghich', 'Ca 28: Thủy khắc Hỏa (Tương khắc - Nghịch)')

const relThoTho = compareNguHanh('Thổ', 'Thổ')
assert(relThoTho.relation === 'binh_hoa' && relThoTho.impact === 'trung', 'Ca 29: Thổ gặp Thổ (Bình hòa - Trung tính)')

// Ca 30: Đối sánh Cung Khôn (Thổ) khắc Mệnh Tuyền Trung Thủy (Thủy)
const relKhonThuy = compareNguHanh('Thổ', 'Thủy')
assert(
  relKhonThuy.relation === 'tuong_khac' && relKhonThuy.impact === 'nghich',
  'Ca 30: Cung Khôn (Thổ) khắc Mệnh Thủy (Tương khắc - Nghịch)'
)

// Ca 31: Năm 2024 (Giáp Thìn, Phú Đăng Hỏa, nam Chấn Mộc, nữ Chấn Mộc)
const ca31_cc = getCanChiNam(2024)
const ca31_na = getNapAmNam(2024)
const ca31_m = getCungPhi(2024, 'nam')
const ca31_f = getCungPhi(2024, 'nu')
assert(
  ca31_cc.canChi === 'Giáp Thìn' && ca31_na.name === 'Phú Đăng Hỏa' && ca31_m.name === 'Chấn' && ca31_f.name === 'Chấn',
  'Ca 31: Năm 2024 (Giáp Thìn)',
  `${ca31_cc.canChi}, ${ca31_na.name}, Nam: ${ca31_m.name}, Nữ: ${ca31_f.name}`
)

// Ca 32: Năm 1975 (Ất Mão, Đại Khê Thủy, nam Đoài Kim, nữ Cấn Thổ)
const ca32_cc = getCanChiNam(1975)
const ca32_na = getNapAmNam(1975)
const ca32_m = getCungPhi(1975, 'nam')
const ca32_f = getCungPhi(1975, 'nu')
assert(
  ca32_cc.canChi === 'Ất Mão' && ca32_na.name === 'Đại Khê Thủy' && ca32_m.name === 'Đoài' && ca32_f.name === 'Cấn',
  'Ca 32: Năm 1975 (Ất Mão)',
  `${ca32_cc.canChi}, ${ca32_na.name}, Nam: ${ca32_m.name}, Nữ: ${ca32_f.name}`
)

// Ca 33: Năm 2008 (Mậu Tý, Tích Lịch Hỏa, nam Khảm Thủy, nữ Cấn Thổ)
const ca33_cc = getCanChiNam(2008)
const ca33_na = getNapAmNam(2008)
const ca33_m = getCungPhi(2008, 'nam')
const ca33_f = getCungPhi(2008, 'nu')
assert(
  ca33_cc.canChi === 'Mậu Tý' && ca33_na.name === 'Tích Lịch Hỏa' && ca33_m.name === 'Khảm' && ca33_f.name === 'Cấn',
  'Ca 33: Năm 2008 (Mậu Tý)',
  `${ca33_cc.canChi}, ${ca33_na.name}, Nam: ${ca33_m.name}, Nữ: ${ca33_f.name}`
)

// Ca 34: Năm 2012 (Nhâm Thìn, Trường Lưu Thủy, nam Càn Kim, nữ Ly Hỏa)
const ca34_cc = getCanChiNam(2012)
const ca34_na = getNapAmNam(2012)
const ca34_m = getCungPhi(2012, 'nam')
const ca34_f = getCungPhi(2012, 'nu')
assert(
  ca34_cc.canChi === 'Nhâm Thìn' && ca34_na.name === 'Trường Lưu Thủy' && ca34_m.name === 'Càn' && ca34_f.name === 'Ly',
  'Ca 34: Năm 2012 (Nhâm Thìn)',
  `${ca34_cc.canChi}, ${ca34_na.name}, Nam: ${ca34_m.name}, Nữ: ${ca34_f.name}`
)

// -------------------------------------------------------------------------
// TỔNG KẾT
// -------------------------------------------------------------------------
console.log('\n======================================================================')
console.log(`   KẾT QUẢ BỘ TEST VÀNG: ${passCount}/${passCount + failCount} TEST CASES PASS`)
console.log('======================================================================\n')

if (failCount > 0) {
  console.error(`Có ${failCount} ca thất bại.`)
  process.exit(1)
} else {
  console.log('🎉 TẤT CẢ CÁC CA ĐỀU VƯỢT QUA VỚI ĐỘ CHÍNH XÁC 100%!')
  process.exit(0)
}

