/**
 * Bộ Unit Test cho Hệ thống "Bói Quẻ 6 Môn Cầu An" (Bước 2: Khung chung + Xin Xăm Bát Quái)
 *
 * Kiểm chứng đầy đủ các yêu cầu kỹ thuật:
 * 1. Tính nhất quán theo seed (Determinism): Cùng input trong cùng ngày luôn ra đúng cùng 1 kết quả (chống reroll). Qua ngày hoặc đổi input thì đổi kết quả.
 * 2. Phân bố mức quẻ sau 10.000 lần chạy gần đúng tỉ lệ: Đại Cát ~10% / Cát ~30% / Bình ~30% / Hung ~20% / Đại Hung ~10%.
 * 3. Bất biến xác suất: Dù điều chỉnh theo Tương sinh (+) hay Tương khắc (-), tổng (Hung + Đại Hung) không bao giờ dưới 15%.
 * 4. Quẻ xấu (Hung / Đại Hung) LUÔN có khối Hóa Giải (`blocks.hoagiai`), quẻ tốt luôn có lời nhắc cân bằng.
 * 5. Chống trùng lặp với 3 lần gieo gần nhất (`recentDraws`).
 * 6. Dò từ khóa câu hỏi tự do quy về đúng chủ đề có sẵn (không gọi AI), tính Can Chi / Ngũ Hành / Cung Phi / Sao Cửu Diệu, ẩn dòng căn cứ khi ở chế độ A không có hồ sơ, và luôn có dòng "Chỉ mang tính giải trí".
 */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

// Hỗ trợ nạp trực tiếp các module TypeScript (.ts) trong `lib/boi/*` mà không cần thêm đuôi .ts vào code Nuxt
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.js') &&
      !specifier.endsWith('.mjs') &&
      !specifier.endsWith('.json') &&
      context.parentURL
    ) {
      const parentDir = dirname(fileURLToPath(context.parentURL))
      const candidateTs = resolve(parentDir, `${specifier}.ts`)
      if (existsSync(candidateTs)) {
        return nextResolve(pathToFileURL(candidateTs).href, context)
      }
    }
    return nextResolve(specifier, context)
  }
})

// Giả lập localStorage trong Node để kiểm thử GameplayService (Bước 5)
const memoryStorage = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear()
}

const { buildFortuneSeed, createSeededRng, extractDateFromQuestion, normalizeVietnameseText } = await import('../../lib/boi/SeedService.ts')
const { analyzeMetaphysics, compareNguHanh, getCanChiAndNapAm, getCungPhi, getCuuDieuStar } = await import('../../lib/boi/MetaphysicsService.ts')
const { getBoiConfig, matchTopicFromQuestion, getCandidateBlocks, getMucMeta } = await import('../../lib/boi/ContentRepository.ts')
const { computeMucProbabilities, generateFortune, rollMucQue } = await import('../../lib/boi/FortuneEngine.ts')
const {
  appendLocalFortuneHistory,
  applyFortuneDailyEffect,
  getRemainingFreeDraws,
  loadActiveDailyEffect,
  loadLocalFortuneHistory,
  markDailyFreeUsed,
  resolveActiveDebuff
} = await import('../../lib/boi/GameplayService.ts')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✅ PASS: ${name}`)
  } catch (err) {
    failed++
    console.error(`  ❌ FAIL: ${name}`)
    console.error('     ', err?.message || err)
  }
}

console.log('======================================================================')
console.log(' BỘ UNIT TEST: HỆ THỐNG BÓI QUẺ 6 MÔN CẦU AN (BƯỚC 2 — XIN XĂM BÁT QUÁI)')
console.log('======================================================================')

// -----------------------------------------------------------------------------
// 1. Test tính nhất quán theo Seed (Chống reroll trong cùng ngày)
// -----------------------------------------------------------------------------
test('1. Cùng đầu vào trong cùng ngày luôn trả về đúng cùng 1 kết quả (Chống reroll)', () => {
  const input = {
    mon: 'xin_xam',
    mode: 'profile',
    dateStr: '2026-11-05',
    questionId: 'xx_q2',
    profile: {
      fullName: '  Nguyễn   Văn   An ',
      birthDate: '1996-05-15',
      birthHour: 'thin',
      gender: 'nam'
    }
  }

  const res1 = generateFortune(input)
  const res2 = generateFortune({
    ...input,
    profile: {
      ...input.profile,
      fullName: 'nguyen van an' // Viết thường không dấu vẫn chuẩn hóa về cùng 1 tên
    }
  })

  assert.equal(res1.seed, res2.seed, 'Seed phải giống hệt nhau sau khi chuẩn hóa họ tên')
  assert.equal(res1.muc, res2.muc, 'Mức quẻ phải giống hệt nhau')
  assert.equal(res1.blocks.tho.id, res2.blocks.tho.id, 'Khối Thơ phải giống hệt nhau')
  assert.equal(res1.blocks.luangiai.id, res2.blocks.luangiai.id, 'Khối Luận giải phải giống hệt nhau')
  assert.equal(res1.blocks.loikhuyen.id, res2.blocks.loikhuyen.id, 'Khối Lời khuyên phải giống hệt nhau')
  assert.deepEqual(res1.blocks.hoagiai, res2.blocks.hoagiai, 'Khối Hóa giải phải giống hệt nhau')
})

test('2. Sang ngày mới hoặc đổi câu hỏi sẽ sinh ra seed khác (Đổi vận theo ngày)', () => {
  const baseInput = {
    mon: 'xin_xam',
    mode: 'profile',
    dateStr: '2026-11-05',
    questionId: 'xx_q1',
    profile: { fullName: 'Trần Thị Bình', birthDate: '1998-08-20', gender: 'nu' }
  }
  const day1 = generateFortune(baseInput)
  const day2 = generateFortune({ ...baseInput, dateStr: '2026-11-06' })
  const diffQ = generateFortune({ ...baseInput, questionId: 'xx_q3' })

  assert.notEqual(day1.seed, day2.seed, 'Qua ngày mới seed phải thay đổi')
  assert.notEqual(day1.seed, diffQ.seed, 'Đổi câu hỏi seed phải thay đổi')
})

// -----------------------------------------------------------------------------
// 2. Test phân bố mức quẻ sau 10.000 lần chạy & bất biến (Hung + Đại Hung >= 15%)
// -----------------------------------------------------------------------------
test('3. Phân bố mức quẻ sau 10.000 lần chạy khớp tỉ lệ chuẩn (10% / 30% / 30% / 20% / 10%)', () => {
  const N = 10_000
  const probs = computeMucProbabilities('binh_hoa')
  const counts = { dai_cat: 0, cat: 0, binh: 0, hung: 0, dai_hung: 0 }

  for (let i = 0; i < N; i++) {
    const { seed } = buildFortuneSeed({
      fullName: `Hanh Gia Thu Nghiem ${i}`,
      birthDate: `19${50 + (i % 50)}-0${1 + (i % 9)}-15`,
      gender: i % 2 === 0 ? 'nam' : 'nu',
      mon: 'xin_xam',
      questionId: `xx_q${1 + (i % 7)}`,
      dateStr: '2026-11-05'
    })
    const rng = createSeededRng(seed)
    const muc = rollMucQue(rng, probs)
    counts[muc]++
  }

  const rates = {
    dai_cat: counts.dai_cat / N,
    cat: counts.cat / N,
    binh: counts.binh / N,
    hung: counts.hung / N,
    dai_hung: counts.dai_hung / N
  }

  console.log(
    `     [10.000 runs] Đại Cát=${(rates.dai_cat * 100).toFixed(2)}% | Cát=${(rates.cat * 100).toFixed(2)}% | Bình=${(rates.binh * 100).toFixed(2)}% | Hung=${(rates.hung * 100).toFixed(2)}% | Đại Hung=${(rates.dai_hung * 100).toFixed(2)}%`
  )

  // Sai số thống kê cho N=10.000 nằm trong biên độ ±2.5%
  assert.ok(Math.abs(rates.dai_cat - 0.10) < 0.025, `Đại Cát lệch quá ngưỡng: ${rates.dai_cat}`)
  assert.ok(Math.abs(rates.cat - 0.30) < 0.025, `Cát lệch quá ngưỡng: ${rates.cat}`)
  assert.ok(Math.abs(rates.binh - 0.30) < 0.025, `Bình lệch quá ngưỡng: ${rates.binh}`)
  assert.ok(Math.abs(rates.hung - 0.20) < 0.025, `Hung lệch quá ngưỡng: ${rates.hung}`)
  assert.ok(Math.abs(rates.dai_hung - 0.10) < 0.025, `Đại Hung lệch quá ngưỡng: ${rates.dai_hung}`)
})

test('4. Tỉ lệ chỉnh theo Tương sinh (+) / Tương khắc (-) luôn giữ tổng (Hung + Đại Hung) >= 15%', () => {
  const pSinh = computeMucProbabilities('tuong_sinh')
  const pBinh = computeMucProbabilities('binh_hoa')
  const pKhac = computeMucProbabilities('tuong_khac')

  assert.ok(pSinh.hung + pSinh.dai_hung >= 0.15, `Tương sinh: Hung + Đại Hung (${pSinh.hung + pSinh.dai_hung}) phải >= 15%`)
  assert.ok(pBinh.hung + pBinh.dai_hung >= 0.15, `Bình hòa: Hung + Đại Hung phải >= 15%`)
  assert.ok(pKhac.hung + pKhac.dai_hung >= 0.15, `Tương khắc: Hung + Đại Hung phải >= 15%`)
  assert.ok(pSinh.dai_cat + pSinh.cat > pBinh.dai_cat + pBinh.cat, 'Tương sinh phải tăng tỉ lệ quẻ tốt so với Bình hòa')
  assert.ok(pKhac.hung + pKhac.dai_hung > pBinh.hung + pBinh.dai_hung, 'Tương khắc phải tăng tỉ lệ quẻ xấu so với Bình hòa')
})

// -----------------------------------------------------------------------------
// 3. Test Quẻ xấu luôn có Hóa Giải & Quẻ tốt có lời nhắc cân bằng
// -----------------------------------------------------------------------------
test('5. 100% quẻ Hung và Đại Hung luôn kèm khối Hóa Giải; quẻ tốt có lời nhắc cân bằng; luôn có "Chỉ mang tính giải trí"', () => {
  let hungCount = 0
  let goodCount = 0

  for (let i = 0; i < 400; i++) {
    const res = generateFortune({
      mon: 'xin_xam',
      mode: 'quick',
      dateStr: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}`,
      questionId: `xx_q${1 + (i % 7)}_${i}`
    })

    assert.ok(res.disclaimer.includes('Chỉ mang tính giải trí'), 'Cuối kết quả bắt buộc có cụm "Chỉ mang tính giải trí"')

    if (res.muc === 'hung' || res.muc === 'dai_hung') {
      hungCount++
      assert.ok(res.blocks.hoagiai && res.blocks.hoagiai.text.length > 20, `Quẻ ${res.muc} bắt buộc phải có khối hoagiai`)
      assert.ok(res.remediationText && res.remediationText.length > 20, 'remediationText phải khác rỗng cho quẻ xấu')
    } else {
      assert.equal(res.blocks.hoagiai, null, `Quẻ ${res.muc} không có khối hoagiai`)
      if (res.muc === 'dai_cat' || res.muc === 'cat') {
        goodCount++
        assert.ok(
          res.blocks.loikhuyen.text.includes('Lời nhắc cân bằng'),
          `Quẻ tốt (${res.muc}) phải có lời nhắc cân bằng trong khối lời khuyên`
        )
      }
    }
  }

  assert.ok(hungCount > 50, `Đã kiểm tra ${hungCount} quẻ Hung/Đại Hung`)
  assert.ok(goodCount > 100, `Đã kiểm tra ${goodCount} quẻ Đại Cát/Cát`)
})

// -----------------------------------------------------------------------------
// 4. Test chống trùng lặp với 3 lần gieo gần nhất
// -----------------------------------------------------------------------------
test('6. Tránh trùng biến thể nội dung với 3 lần gieo gần nhất của người chơi', () => {
  const recentDraws = [
    {
      mon: 'xin_xam',
      thoId: 'xx_tho_daicat_01',
      luangiaiId: 'xx_lg_daicat_01',
      loikhuyenId: 'xx_lk_daicat_01',
      hoagiaiId: 'xx_hg_hung_01'
    },
    {
      mon: 'xin_xam',
      thoId: 'xx_tho_cat_01',
      luangiaiId: 'xx_lg_cat_01',
      loikhuyenId: 'xx_lk_cat_01',
      hoagiaiId: 'xx_hg_hung_02'
    },
    {
      mon: 'xin_xam',
      thoId: 'xx_tho_binh_01',
      luangiaiId: 'xx_lg_binh_01',
      loikhuyenId: 'xx_lk_binh_01',
      hoagiaiId: 'xx_hg_daihung_01'
    }
  ]

  const forbiddenIds = new Set([
    'xx_tho_daicat_01', 'xx_lg_daicat_01', 'xx_lk_daicat_01', 'xx_hg_hung_01',
    'xx_tho_cat_01', 'xx_lg_cat_01', 'xx_lk_cat_01', 'xx_hg_hung_02',
    'xx_tho_binh_01', 'xx_lg_binh_01', 'xx_lk_binh_01', 'xx_hg_daihung_01'
  ])

  for (let i = 0; i < 100; i++) {
    const res = generateFortune({
      mon: 'xin_xam',
      mode: 'preset',
      questionId: `xx_q${1 + (i % 7)}`,
      dateStr: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`,
      recentDraws
    })

    assert.ok(!forbiddenIds.has(res.blocks.tho.id), `Khối Thơ không được trùng với 3 lần gần nhất (${res.blocks.tho.id})`)
    assert.ok(!forbiddenIds.has(res.blocks.luangiai.id), `Khối Luận giải không được trùng với 3 lần gần nhất (${res.blocks.luangiai.id})`)
    assert.ok(!forbiddenIds.has(res.blocks.loikhuyen.id), `Khối Lời khuyên không được trùng với 3 lần gần nhất (${res.blocks.loikhuyen.id})`)
    if (res.blocks.hoagiai) {
      assert.ok(!forbiddenIds.has(res.blocks.hoagiai.id), `Khối Hóa giải không được trùng với 3 lần gần nhất (${res.blocks.hoagiai.id})`)
    }
  }
})

// -----------------------------------------------------------------------------
// 5. Test Căn cứ Can Chi / Ngũ Hành / Cung Phi / Sao Cửu Diệu & Chế độ A ẩn căn cứ
// -----------------------------------------------------------------------------
test('7. Tính đúng Can Chi, Ngũ Hành Nạp Âm, Cung Phi, Sao Cửu Diệu và ẩn căn cứ khi ở Chế độ A', () => {
  // Năm 1984 = Giáp Tý = Hải Trung Kim
  const cc1984 = getCanChiAndNapAm(1984)
  assert.equal(cc1984.canChi, 'Giáp Tý')
  assert.equal(cc1984.nguHanh, 'Kim')
  assert.equal(cc1984.napAmName, 'Hải Trung Kim')

  // Năm 1986 = Bính Dần = Lư Trung Hỏa
  const cc1986 = getCanChiAndNapAm(1986)
  assert.equal(cc1986.canChi, 'Bính Dần')
  assert.equal(cc1986.nguHanh, 'Hỏa')
  assert.equal(cc1986.napAmName, 'Lư Trung Hỏa')

  // Quan hệ ngũ hành: Hỏa gặp Thủy -> Tương khắc; Mộc gặp Hỏa -> Tương sinh
  assert.equal(compareNguHanh('Hỏa', 'Thủy'), 'tuong_khac')
  assert.equal(compareNguHanh('Mộc', 'Hỏa'), 'tuong_sinh')
  assert.equal(compareNguHanh('Kim', 'Kim'), 'binh_hoa')

  // Sao Cửu Diệu: Sinh năm 1990, năm 2026 là 37 tuổi mụ (37 % 9 = 1 -> Nam La Hầu, Nữ Kế Đô)
  const starNam = getCuuDieuStar(1990, 2026, 'nam')
  const starNu = getCuuDieuStar(1990, 2026, 'nu')
  assert.equal(starNam.name, 'La Hầu')
  assert.equal(starNu.name, 'Kế Đô')

  // Chế độ A (Xin nhanh) không có hồ sơ -> ẩn dòng căn cứ (grounds = [])
  const quickRes = generateFortune({ mon: 'xin_xam', mode: 'quick', dateStr: '2026-11-05' })
  assert.equal(quickRes.grounds.length, 0, 'Chế độ A không có hồ sơ phải ẩn dòng căn cứ')

  // Chế độ C có hồ sơ -> hiển thị 2 dòng căn cứ
  const profileRes = generateFortune({
    mon: 'xin_xam',
    mode: 'profile',
    dateStr: '2026-11-05',
    profile: { fullName: 'Lê Minh Tuấn', birthDate: '1986-04-10', gender: 'nam' }
  })
  assert.ok(profileRes.grounds.length >= 2, 'Chế độ C có hồ sơ phải hiển thị ít nhất 2 dòng căn cứ')
  assert.ok(profileRes.grounds[0].includes('Bính Dần'), 'Dòng căn cứ 1 phải chứa Can Chi năm sinh')
})

// -----------------------------------------------------------------------------
// 6. Test dò từ khóa câu hỏi tự do & quy tắc an toàn cho Cầu Tự / Dược Sư
// -----------------------------------------------------------------------------
test('8. Dò từ khóa câu hỏi tự do quy về đúng chủ đề có sẵn và kiểm tra câu chữ an toàn Cầu Tự / Dược Sư', () => {
  assert.equal(matchTopicFromQuestion('Tháng này tôi đầu tư kinh doanh tiền bạc có lời không?'), 'tai_loc')
  assert.equal(matchTopicFromQuestion('Chuyện tình cảm với người yêu bao giờ cưới?'), 'tinh_duyen')
  assert.equal(matchTopicFromQuestion('Sức khỏe dạo này hay mất ngủ mệt mỏi quá'), 'suc_khoe')
  assert.equal(matchTopicFromQuestion('Sắp tới thi tốt nghiệp đại học điểm có cao không?'), 'thi_cu')
  assert.equal(matchTopicFromQuestion('Xin việc mới và thăng chức ở công ty'), 'su_nghiep')

  // Kiểm tra Cầu Tự và Dược Sư ở mức xấu chỉ nói "cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ"
  for (let i = 0; i < 60; i++) {
    const ctRes = generateFortune({
      mon: 'cau_tu',
      mode: 'quick',
      dateStr: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}`,
      questionId: `ct_test_${i}`
    })
    if (ctRes.muc === 'hung' || ctRes.muc === 'dai_hung') {
      assert.ok(
        ctRes.blocks.luangiai.text.includes('cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ'),
        'Cầu Tự mức xấu bắt buộc dùng câu chuẩn an toàn'
      )
      assert.ok(!ctRes.blocks.luangiai.text.toLowerCase().includes('vô sinh'), 'Cấm tuyệt đối từ vô sinh')
    }
  }
})

// -----------------------------------------------------------------------------
// 7. Test Bước 3: Môn Tơ Duyên Tương Ngộ (Đối sánh 2 mệnh Tương sinh / Tương khắc / Bình hòa)
// -----------------------------------------------------------------------------
test('9. [Bước 3] Tơ Duyên Tương Ngộ: Đối sánh Tương sinh / Tương khắc / Bình hòa giữa 2 mệnh + điều chỉnh seed ngày', () => {
  // Cặp 1: 1988 (Mậu Thìn - Đại Lâm Mộc) & 1986 (Bính Dần - Lư Trung Hỏa) -> Mộc sinh Hỏa (Tương sinh)
  const sinhCouple = generateFortune({
    mon: 'to_duyen',
    mode: 'profile',
    dateStr: '2026-11-05',
    questionId: 'td_q1',
    profile: { fullName: 'Phạm Hoàng Nam', birthDate: '1988-03-12', gender: 'nam' },
    partnerProfile: { fullName: 'Đỗ Ngọc Lan', birthDate: '1986-09-20', gender: 'nu' }
  })

  assert.equal(sinhCouple.metaphysics?.partnerComparison?.relation, 'tuong_sinh', 'Mộc gặp Hỏa phải là Tương sinh')
  assert.ok(sinhCouple.grounds.length >= 2, 'Tơ Duyên có hồ sơ đôi lứa phải hiển thị ít nhất 2 dòng căn cứ')
  assert.ok(sinhCouple.grounds[1].includes('Tương sinh'), 'Dòng căn cứ 2 phải ghi rõ Tương sinh')
  assert.ok(
    sinhCouple.probabilitiesUsed.hung + sinhCouple.probabilitiesUsed.dai_hung >= 0.15,
    'Dù cặp đôi Tương sinh + ngày tốt thì tổng Hung + Đại Hung vẫn phải >= 15%'
  )

  // Cặp 2: 1986 (Bính Dần - Lư Trung Hỏa) & 1996 (Bính Tý - Giản Hạ Thủy) -> Thủy khắc Hỏa (Tương khắc)
  const khacCouple = generateFortune({
    mon: 'to_duyen',
    mode: 'profile',
    dateStr: '2026-11-05',
    questionId: 'td_q1',
    profile: { fullName: 'Lê Minh Tuấn', birthDate: '1986-04-10', gender: 'nam' },
    partnerProfile: { fullName: 'Vũ Thu Hà', birthDate: '1996-11-02', gender: 'nu' }
  })

  assert.equal(khacCouple.metaphysics?.partnerComparison?.relation, 'tuong_khac', 'Hỏa gặp Thủy phải là Tương khắc')
  assert.ok(khacCouple.grounds[1].includes('Tương khắc'), 'Dòng căn cứ 2 phải ghi rõ Tương khắc')
  assert.ok(
    khacCouple.probabilitiesUsed.hung + khacCouple.probabilitiesUsed.dai_hung >
      sinhCouple.probabilitiesUsed.hung + sinhCouple.probabilitiesUsed.dai_hung,
    'Cặp Tương khắc phải có tỉ lệ quẻ thử thách cao hơn cặp Tương sinh'
  )

  // Cặp 3: 1984 (Giáp Tý - Hải Trung Kim) & 1993 (Quý Dậu - Kiếm Phong Kim) -> Kim gặp Kim (Bình hòa)
  const binhCouple = generateFortune({
    mon: 'to_duyen',
    mode: 'profile',
    dateStr: '2026-11-05',
    questionId: 'td_q4',
    profile: { fullName: 'Trương Quốc Bảo', birthDate: '1984-02-18', gender: 'nam' },
    partnerProfile: { fullName: 'Ngô Minh Châu', birthDate: '1993-07-25', gender: 'nu' }
  })

  assert.equal(binhCouple.metaphysics?.partnerComparison?.relation, 'binh_hoa', 'Kim gặp Kim phải là Bình hòa')
  assert.ok(binhCouple.grounds[1].includes('Bình hòa'), 'Dòng căn cứ 2 phải ghi rõ Bình hòa')
})

test('10. [Bước 3] Kho nội dung `data/boi/to_duyen.json`: 100% block từ Tơ Duyên, quẻ Hung luôn có hóa giải, tránh trùng 3 lần gần nhất', () => {
  const recent = []
  for (let i = 0; i < 200; i++) {
    const res = generateFortune({
      mon: 'to_duyen',
      mode: i % 2 === 0 ? 'profile' : 'preset',
      dateStr: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}`,
      questionId: `td_q${1 + (i % 7)}`,
      profile: { fullName: `Hanh Gia ${i}`, birthDate: `19${80 + (i % 20)}-05-10`, gender: 'nam' },
      partnerProfile: { fullName: `Nguoi Thuong ${i}`, birthDate: `19${82 + (i % 20)}-08-15`, gender: 'nu' },
      recentDraws: recent.slice(0, 3)
    })

    assert.ok(res.blocks.tho.id.startsWith('td_tho_'), `Mã khối Thơ phải thuộc môn Tơ Duyên (${res.blocks.tho.id})`)
    assert.ok(res.blocks.luangiai.id.startsWith('td_lg_'), `Mã khối Luận giải phải thuộc môn Tơ Duyên (${res.blocks.luangiai.id})`)
    assert.ok(res.blocks.loikhuyen.id.startsWith('td_lk_'), `Mã khối Lời khuyên phải thuộc môn Tơ Duyên (${res.blocks.loikhuyen.id})`)

    if (res.muc === 'hung' || res.muc === 'dai_hung') {
      assert.ok(res.blocks.hoagiai && res.blocks.hoagiai.id.startsWith('td_hg_'), 'Quẻ xấu Tơ Duyên bắt buộc có Pháp Hóa Giải Tơ Duyên')
    } else if (res.muc === 'dai_cat' || res.muc === 'cat') {
      assert.ok(res.blocks.loikhuyen.text.includes('Lời nhắc cân bằng'), 'Quẻ tốt Tơ Duyên phải có lời nhắc cân bằng')
    }

    // Kiểm tra không trùng với 3 lần gần nhất
    for (const r of recent.slice(0, 3)) {
      if (r.muc === res.muc) {
        assert.notEqual(res.blocks.tho.id, r.thoId, 'Không được lặp lại bài thơ của 3 lần gần nhất cùng mức quẻ')
      }
    }

    recent.unshift({
      mon: 'to_duyen',
      muc: res.muc,
      thoId: res.blocks.tho.id,
      luangiaiId: res.blocks.luangiai.id,
      loikhuyenId: res.blocks.loikhuyen.id,
      hoagiaiId: res.blocks.hoagiai?.id || null
    })
  }
})

// -----------------------------------------------------------------------------
// 8. Test Bước 4: Nhân rộng 4 môn còn lại (Cầu Tự, Chiêu Tài, Dược Sư, Dâng Sao)
// -----------------------------------------------------------------------------
test('11. [Bước 4] Cả 6 môn Cầu An đều nạp từ 6 file JSON riêng biệt, đủ 4 khối, có hóa giải cho quẻ Hung & nhắc cân bằng cho quẻ Cát', () => {
  const subjects = [
    { mon: 'xin_xam', prefix: 'xx_' },
    { mon: 'to_duyen', prefix: 'td_' },
    { mon: 'cau_tu', prefix: 'ct_' },
    { mon: 'chieu_tai', prefix: 'cht_' },
    { mon: 'duoc_su', prefix: 'ds_' },
    { mon: 'dang_sao', prefix: 'sao_' }
  ]

  for (const { mon, prefix } of subjects) {
    const recent = []
    for (let i = 0; i < 80; i++) {
      const res = generateFortune({
        mon,
        mode: 'profile',
        dateStr: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}`,
        questionId: `q_${i}`,
        profile: { fullName: `Thien Tin ${i}`, birthDate: `19${75 + (i % 30)}-06-15`, gender: i % 2 === 0 ? 'nam' : 'nu' },
        recentDraws: recent.slice(0, 3)
      })

      assert.ok(res.blocks.tho.id.startsWith(`${prefix}tho_`), `[${mon}] Khối Thơ phải có tiền tố ${prefix}tho_ (nhận ${res.blocks.tho.id})`)
      assert.ok(res.blocks.luangiai.id.startsWith(`${prefix}lg_`), `[${mon}] Khối Luận giải phải có tiền tố ${prefix}lg_ (nhận ${res.blocks.luangiai.id})`)
      assert.ok(res.blocks.loikhuyen.id.startsWith(`${prefix}lk_`), `[${mon}] Khối Lời khuyên phải có tiền tố ${prefix}lk_ (nhận ${res.blocks.loikhuyen.id})`)
      assert.ok(res.disclaimer.includes('Chỉ mang tính giải trí'), `[${mon}] Phải có dòng "Chỉ mang tính giải trí"`)

      if (res.muc === 'hung' || res.muc === 'dai_hung') {
        assert.ok(res.blocks.hoagiai && res.blocks.hoagiai.id.startsWith(`${prefix}hg_`), `[${mon}] Quẻ xấu bắt buộc có khối Hóa giải ${prefix}hg_`)
      } else if (res.muc === 'dai_cat' || res.muc === 'cat') {
        assert.ok(res.blocks.loikhuyen.text.includes('Lời nhắc cân bằng'), `[${mon}] Quẻ tốt phải có Lời nhắc cân bằng`)
      }

      recent.unshift({
        mon,
        muc: res.muc,
        thoId: res.blocks.tho.id,
        luangiaiId: res.blocks.luangiai.id,
        loikhuyenId: res.blocks.loikhuyen.id,
        hoagiaiId: res.blocks.hoagiai?.id || null
      })
    }
  }
})

test('12. [Bước 4] Cầu Tự & Dược Sư An Khang: 100% quẻ xấu chỉ nói "cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ", cấm phán bệnh / vô sinh', () => {
  for (const mon of ['cau_tu', 'duoc_su']) {
    let badChecked = 0
    for (let i = 0; i < 150; i++) {
      const res = generateFortune({
        mon,
        mode: 'quick',
        dateStr: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}`,
        questionId: `${mon}_safe_${i}`
      })

      if (res.muc === 'hung' || res.muc === 'dai_hung') {
        badChecked++
        assert.ok(
          res.blocks.luangiai.text.includes('cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ'),
          `[${mon}] Luận giải mức xấu phải chứa cụm "cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ"`
        )
        assert.ok(
          res.blocks.loikhuyen.text.includes('cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ'),
          `[${mon}] Lời khuyên mức xấu phải chứa cụm "cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ"`
        )
        const combinedLower = `${res.blocks.luangiai.text} ${res.blocks.loikhuyen.text}`.toLowerCase()
        assert.ok(!combinedLower.includes('vô sinh'), `[${mon}] Cấm tuyệt đối từ "vô sinh"`)
        assert.ok(!combinedLower.includes('ung thư'), `[${mon}] Cấm tuyệt đối phán bệnh`)
      }
    }
    assert.ok(badChecked >= 25, `[${mon}] Đã kiểm tra ít nhất 25 quẻ xấu (${badChecked})`)
  }
})

test('13. [Bước 4] Dâng Sao Giải Hạn: Tính đủ 9 Sao Cửu Diệu theo tuổi mụ & giới tính và hiển thị trong căn cứ', () => {
  const seenStars = new Set()
  for (let birthYear = 1980; birthYear <= 1997; birthYear++) {
    for (const gender of ['nam', 'nu']) {
      const res = generateFortune({
        mon: 'dang_sao',
        mode: 'profile',
        dateStr: '2026-11-05',
        profile: { fullName: 'Hành Giả Sao', birthDate: `${birthYear}-03-15`, gender }
      })
      const starName = res.metaphysics?.cuuDieuStar?.name
      assert.ok(starName, 'Phải tính được tên sao Cửu Diệu')
      seenStars.add(starName)
      assert.ok(res.grounds[1].includes(`Sao ${starName}`), `Dòng căn cứ 2 phải hiển thị tên Sao ${starName}`)
    }
  }

  const expectedNineStars = ['La Hầu', 'Kế Đô', 'Thái Dương', 'Thái Âm', 'Mộc Đức', 'Thủy Diệu', 'Thổ Tú', 'Vân Hán', 'Thái Bạch']
  for (const s of expectedNineStars) {
    assert.ok(seenStars.has(s), `Phải tính ra đủ sao ${s} trong bảng Cửu Diệu`)
  }
})

// -----------------------------------------------------------------------------
// 9. Test Bước 5: Giới hạn lượt miễn phí 1 lượt/môn/ngày, Lưu lịch sử tối đa 30, Buff/Debuff & Nhiệm vụ hóa giải
// -----------------------------------------------------------------------------
test('14. [Bước 5] Giới hạn 1 lượt miễn phí/môn/ngày, sang ngày mới tự mở lại, và lưu lịch sử tối đa 30 quẻ', () => {
  globalThis.localStorage.clear()
  const cfg = getBoiConfig()
  assert.equal(cfg.dailyFreeDrawsPerSubject, 1, 'Config quy định mỗi ngày miễn phí 1 lượt/môn')
  assert.equal(cfg.maxHistoryRecords, 30, 'Config quy định lưu tối đa 30 lịch sử quẻ')

  // Ban đầu cả 6 môn đều có 1 lượt miễn phí trong ngày 2026-11-05
  assert.equal(getRemainingFreeDraws('stick', '2026-11-05'), 1)
  assert.equal(getRemainingFreeDraws('love', '2026-11-05'), 1)

  // Dùng 1 lượt miễn phí ở môn Xin Xăm (stick) -> còn 0 lượt ở môn stick, nhưng môn Tơ Duyên (love) vẫn còn 1 lượt
  markDailyFreeUsed('stick', '2026-11-05')
  assert.equal(getRemainingFreeDraws('stick', '2026-11-05'), 0, 'Môn đã dùng lượt miễn phí trong ngày phải về 0')
  assert.equal(getRemainingFreeDraws('love', '2026-11-05'), 1, 'Các môn khác vẫn còn nguyên 1 lượt miễn phí')

  // Qua ngày hôm sau (2026-11-06) -> tự động mở lại 1 lượt miễn phí cho môn stick
  assert.equal(getRemainingFreeDraws('stick', '2026-11-06'), 1, 'Qua ngày mới phải khôi phục 1 lượt miễn phí/môn')

  // Lưu 35 quẻ liên tiếp vào lịch sử -> chỉ giữ tối đa đúng 30 quẻ mới nhất
  for (let i = 1; i <= 35; i++) {
    appendLocalFortuneHistory({
      id: `id_${i}`,
      requestId: `req_${i}`,
      category: 'stick',
      tier: 'basic',
      costMc: 0,
      paymentMode: 'free_daily',
      receiptHash: `HASH_${i}`,
      createdAt: 1700000000000 + i * 1000,
      fortune: { title: `Quẻ số ${i}` }
    })
  }
  const history = loadLocalFortuneHistory()
  assert.equal(history.length, 30, 'Lịch sử quẻ không bao giờ vượt quá 30 bản ghi')
  assert.equal(history[0].requestId, 'req_35', 'Bản ghi mới nhất phải nằm đầu danh sách')
  assert.equal(history[29].requestId, 'req_6', 'Bản ghi thứ 30 phải là req_6 (5 bản ghi cũ nhất tự động bị cắt)')
})

test('15. [Bước 5] Quẻ tốt cho Buff nhỏ trong ngày, quẻ xấu cho Debuff nhẹ kèm nhiệm vụ hóa giải để gỡ (giá trị từ data/boi/config.json)', () => {
  globalThis.localStorage.clear()
  const cfg = getBoiConfig()

  // Kiểm tra giá trị Buff / Debuff lấy từ data/boi/config.json
  assert.equal(cfg.dailyEffects.dai_cat.type, 'buff')
  assert.ok(cfg.dailyEffects.dai_cat.statModifier.karmaBonusPct > 0, 'Đại Cát phải mang giá trị buff dương trong config.json')
  assert.equal(cfg.dailyEffects.cat.type, 'buff')
  assert.ok(cfg.dailyEffects.cat.statModifier.karmaBonusPct > 0, 'Cát phải mang giá trị buff dương trong config.json')
  assert.equal(cfg.dailyEffects.hung.type, 'debuff')
  assert.ok(cfg.dailyEffects.hung.statModifier.karmaBonusPct < 0, 'Hung phải mang giá trị debuff âm nhẹ trong config.json')
  assert.ok(cfg.dailyEffects.hung.remediationQuest?.title, 'Hung phải có nhiệm vụ hóa giải trong config.json')
  assert.equal(cfg.dailyEffects.dai_hung.type, 'debuff')
  assert.ok(cfg.dailyEffects.dai_hung.statModifier.karmaBonusPct < 0, 'Đại Hung phải mang giá trị debuff âm nhẹ trong config.json')
  assert.ok(cfg.dailyEffects.dai_hung.remediationQuest?.title, 'Đại Hung phải có nhiệm vụ hóa giải trong config.json')

  // Giả lập rút trúng quẻ Hung -> nhận Debuff nhẹ kèm nhiệm vụ hóa giải
  const hungState = applyFortuneDailyEffect({
    mon: 'xin_xam',
    monName: 'Xin Xăm Bát Quái',
    muc: 'hung',
    mucLabel: 'Hung Quẻ',
    title: 'Quẻ Thử Thách',
    dateStr: '2026-11-05',
    dailyEffect: cfg.dailyEffects.hung
  })
  assert.ok(hungState, 'Phải lưu trạng thái hiệu ứng ngày')
  assert.equal(hungState.effect.type, 'debuff', 'Khi rút quẻ Hung thì trạng thái đang kích hoạt phải là debuff')
  assert.equal(hungState.resolved, false, 'Ban đầu debuff chưa được hóa giải')

  // Thực hiện nhiệm vụ hóa giải -> gỡ Debuff và chuyển hóa thành trạng thái bình an (resolved = true)
  const resolvedState = resolveActiveDebuff('Tọa Thiền Chánh Niệm 432Hz', '2026-11-05')
  assert.ok(resolvedState, 'Hàm resolveActiveDebuff phải trả về trạng thái sau khi gỡ')
  assert.equal(resolvedState.resolved, true, 'Sau khi hoàn thành nhiệm vụ hóa giải, resolved phải bằng true')
  assert.equal(resolvedState.effect.type, 'buff', 'Hiệu ứng sau khi hóa giải chuyển hóa thành buff Tâm Bình Khí Hòa')
  assert.ok(resolvedState.effect.statModifier.karmaBonusPct >= 0, 'Debuff âm đã được gỡ bỏ hoàn toàn')
  assert.equal(loadActiveDailyEffect('2026-11-05')?.resolved, true, 'Trạng thái đã gỡ debuff được lưu bền vững trong ngày')
})

test('16. [Bước 4] Seed độc lập với họ tên: Đổi họ tên không làm thay đổi seed gieo quẻ trong cùng ngày', () => {
  const seed1 = buildFortuneSeed({
    fullName: 'Nguyễn Văn An',
    birthDate: '2004-06-13',
    birthHour: 'ty',
    gender: 'nam',
    mon: 'xin_xam',
    questionId: 'q_default',
    dateStr: '2026-11-06'
  })
  const seed2 = buildFortuneSeed({
    fullName: 'Trần Thị Bích Ngọc',
    birthDate: '2004-06-13',
    birthHour: 'ty',
    gender: 'nam',
    mon: 'xin_xam',
    questionId: 'q_default',
    dateStr: '2026-11-06'
  })
  assert.equal(seed1.seed, seed2.seed, 'Đổi họ tên không được làm thay đổi seed gieo quẻ!')
})

test('17. [Bước 4] Đúng chuẩn 5 mức quẻ duy nhất: Đại Cát, Cát, Bình, Hung, Đại Hung (không có nhãn thừa)', () => {
  const mucs = ['dai_cat', 'cat', 'binh', 'hung', 'dai_hung']
  const expectedLabels = ['Đại Cát', 'Cát', 'Bình', 'Hung', 'Đại Hung']
  mucs.forEach((muc, idx) => {
    const meta = getMucMeta(muc)
    assert.equal(meta.label, expectedLabels[idx])
    assert.ok(!meta.label.includes('Thượng'), `Huy hiệu ${muc} không được chứa từ 'Thượng'`)
    assert.ok(!meta.label.includes('Cát Lành'), `Huy hiệu ${muc} không được chứa từ 'Cát Lành'`)
  })
})

test('18. [Bước 4] Môn Xin Xăm tiêu đề thẻ dùng danh xưng "Thẻ số N", không dùng "Quẻ Số N"', () => {
  const res = generateFortune({
    mon: 'xin_xam',
    mode: 'preset',
    profile: {
      fullName: 'Phạm Minh Tuấn',
      birthDate: '2004-06-13',
      gender: 'nam'
    },
    dateStr: '2026-11-06'
  })
  assert.ok(res.title.startsWith('Thẻ số '), `Tiêu đề Xin Xăm phải bắt đầu bằng 'Thẻ số ', hiện tại: ${res.title}`)
  assert.ok(!res.title.includes('Quẻ Số'), `Tiêu đề không được chứa 'Quẻ Số', hiện tại: ${res.title}`)
})

test('19. [Bước 4] Lọc theo độ tuổi: Chặn thi cử học đường với người lớn tuổi (>35) và chặn cầu tự với trẻ em (<18)', () => {
  // Người 60 tuổi xem tổng quan
  const blocksForElder = getCandidateBlocks('xin_xam', 'cat', 'luangiai', 'tong_quan', 'tuong_sinh', 60, 'nam')
  const hasSchoolExam = blocksForElder.some(b => b.tags.includes('thi_cu') && !b.tags.includes('su_nghiep'))
  assert.ok(!hasSchoolExam, 'Người 60 tuổi xem tổng quan không được nhận nội dung ôn thi học đường')

  // Trẻ em 10 tuổi
  const blocksForChild = getCandidateBlocks('cau_tu', 'cat', 'luangiai', 'gia_dao', 'tuong_sinh', 10, 'nam')
  assert.equal(blocksForChild.length, 0, 'Trẻ em dưới 18 tuổi bị chặn không nhận nội dung con cái / cầu tự')
})

test('20. [Bước 4] Căn cứ Bát Tự đa tầng: Đầy đủ Cung phi, Bản mệnh, Ngày, nhãn [Thuận]/[Nghịch]/[Trung tính] và yếu tố bù đắp', () => {
  const res = generateFortune({
    mon: 'xin_xam',
    mode: 'preset',
    profile: {
      fullName: 'Trần Văn Long',
      birthDate: '2004-06-13',
      gender: 'nam'
    },
    dateStr: '2026-11-06'
  })
  assert.ok(res.grounds.length >= 3, 'Căn cứ phải có tối thiểu 3 dòng chi tiết')
  const gStr = res.grounds.join('\n')
  assert.ok(gStr.includes('Cung phi Khôn') || gStr.includes('Cung phi'), 'Căn cứ phải đối sánh Cung phi')
  assert.ok(gStr.includes('Thuận') || gStr.includes('Nghịch') || gStr.includes('Trung tính'), 'Căn cứ phải có nhãn tác động')
})

test('21. Tự động bóc tách ngày mục tiêu trong câu hỏi tự do (vd: "Tôi muốn đi chơi vào ngày 20/11/2026") để tính đúng Thiên thời Can Chi ngày đó', () => {
  assert.equal(extractDateFromQuestion('Tôi muốn đi chơi vào ngày 20/11/2026'), '2026-11-20')
  assert.equal(extractDateFromQuestion('Khai trương ngày 15-12-2026 có thuận lợi không?'), '2026-12-15')
  assert.equal(extractDateFromQuestion('Xuất hành ngày 8 tháng 3 năm 2027'), '2027-03-08')
  assert.equal(extractDateFromQuestion('Đi du lịch vào 25/11', '2026-11-09'), '2026-11-25')
  assert.equal(extractDateFromQuestion('Ngày 31/02/2026 có tốt không?'), null, 'Ngày không tồn tại trên lịch phải trả về null')

  const resToday = generateFortune({
    mon: 'xin_xam',
    mode: 'custom',
    dateStr: '2026-11-06',
    customQuestion: 'Tôi muốn đi chơi vào ngày 20/11/2026',
    profile: {
      fullName: 'Trịnh Mạnh Cường',
      birthDate: '2001-12-23',
      gender: 'nam'
    }
  })

  assert.equal(resToday.matchedTag, 'xuat_hanh', 'Câu hỏi "đi chơi" phải khớp chủ đề xuat_hanh')
  assert.equal(resToday.targetDateStr, '2026-11-20', 'Phải bóc tách đúng targetDateStr = 2026-11-20')
  assert.equal(resToday.dateStr, '2026-11-20', 'dateStr tính toán phải chuyển sang 2026-11-20')
  assert.equal(resToday.metaphysics?.dayCanChi, 'Mậu Tuất', 'Ngày 20/11/2026 Dương lịch phải là ngày Mậu Tuất')
  assert.equal(resToday.metaphysics?.dayNguHanh, 'Mộc', 'Ngày Mậu Tuất có nạp âm Bình Địa Mộc (hành Mộc)')
  assert.ok(
    resToday.grounds.some(g => g.includes('20/11/2026') && g.includes('Mậu Tuất')),
    'Dòng căn cứ Thiên thời phải hiển thị rõ ngày 20/11/2026 và Can Chi Mậu Tuất'
  )
})

console.log('----------------------------------------------------------------------')
console.log(` KẾT QUẢ: ${passed} PASS / ${failed} FAIL`)
console.log('======================================================================')

if (failed > 0) {
  process.exit(1)
}

