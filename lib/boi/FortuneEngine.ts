import {
  getBoiConfig,
  getCandidateBlocks,
  getDailyEffectForMuc,
  getDefaultTopicForMon,
  getDisclaimerText,
  getMonDisplayName,
  getMucMeta,
  getPresetQuestions,
  getTopicLabel,
  matchTopicFromQuestion,
  resolveLegacyCategory,
  resolveMonId
} from './ContentRepository'
import { analyzeMetaphysics } from './MetaphysicsService'
import { buildFortuneSeed, createSeededRng, extractDateFromQuestion, type SeededRng } from './SeedService'
import type {
  BoiContentBlock,
  FortuneDrawInput,
  FortuneDrawResult,
  MucQue,
  QuanHeNguHanh,
  RecentDrawRef,
  TopicTag
} from './types'

const MUC_ORDER: ReadonlyArray<MucQue> = ['dai_cat', 'cat', 'binh', 'hung', 'dai_hung']

/**
 * Tính phân bố xác suất 5 mức quẻ:
 * - Mặc định: Đại Cát 10% / Cát 30% / Bình 30% / Hung 20% / Đại Hung 10%.
 * - Điều chỉnh theo Tương sinh (+) / Tương khắc (-) và điều chỉnh phụ theo ngày (dành cho Tơ Duyên).
 * - Bắt buộc tổng (Hung + Đại Hung) >= 15% (0.15) trong mọi trường hợp.
 */
export function computeMucProbabilities(
  quanHe: QuanHeNguHanh = 'binh_hoa',
  secondaryDayRelation?: QuanHeNguHanh,
  dailySeedShift = 0
): Record<MucQue, number> {
  const cfg = getBoiConfig()
  const base = cfg.baseProbabilities
  const adjMap = cfg.relationAdjustments as Record<QuanHeNguHanh, Record<MucQue, number>>
  const adj = adjMap[quanHe] || adjMap.binh_hoa
  const dayAdj = secondaryDayRelation ? (adjMap[secondaryDayRelation] || adjMap.binh_hoa) : null

  const clampShift = Math.max(-0.02, Math.min(0.02, dailySeedShift))

  const raw: Record<MucQue, number> = {
    dai_cat: Math.max(0.01, base.dai_cat + (adj.dai_cat || 0) + (dayAdj ? (dayAdj.dai_cat || 0) * 0.35 : 0) + clampShift * 0.5),
    cat: Math.max(0.01, base.cat + (adj.cat || 0) + (dayAdj ? (dayAdj.cat || 0) * 0.35 : 0) + clampShift * 0.5),
    binh: Math.max(0.01, base.binh + (adj.binh || 0) + (dayAdj ? (dayAdj.binh || 0) * 0.35 : 0)),
    hung: Math.max(0.01, base.hung + (adj.hung || 0) + (dayAdj ? (dayAdj.hung || 0) * 0.35 : 0) - clampShift * 0.5),
    dai_hung: Math.max(0.01, base.dai_hung + (adj.dai_hung || 0) + (dayAdj ? (dayAdj.dai_hung || 0) * 0.35 : 0) - clampShift * 0.5)
  }

  // Chuẩn hóa lần 1
  const total1 = raw.dai_cat + raw.cat + raw.binh + raw.hung + raw.dai_hung
  for (const k of MUC_ORDER) {
    raw[k] = raw[k] / total1
  }

  // Đảm bảo bất biến: (hung + dai_hung) >= minCombinedBadRate (0.15)
  const minBad = Math.max(0.15, Number(cfg.minCombinedBadRate || 0.15))
  const currentBad = raw.hung + raw.dai_hung
  if (currentBad < minBad) {
    const scaleBad = minBad / Math.max(0.0001, currentBad)
    raw.hung *= scaleBad
    raw.dai_hung *= scaleBad

    const remainingGood = 1 - minBad
    const currentGood = raw.dai_cat + raw.cat + raw.binh
    const scaleGood = remainingGood / Math.max(0.0001, currentGood)
    raw.dai_cat *= scaleGood
    raw.cat *= scaleGood
    raw.binh *= scaleGood
  }

  return raw
}

/**
 * Rút mức quẻ theo xác suất cộng dồn từ PRNG có seed
 */
export function rollMucQue(rng: SeededRng, probs: Record<MucQue, number>): MucQue {
  const r = rng.nextFloat()
  let acc = 0
  for (const muc of MUC_ORDER) {
    acc += probs[muc]
    if (r < acc) {
      return muc
    }
  }
  return 'dai_hung'
}

/**
 * Chọn 1 mảnh nội dung bằng PRNG có seed, ưu tiên tránh trùng với 3 lần gieo gần nhất
 */
function pickBlockAvoidingRecent(
  rng: SeededRng,
  candidates: BoiContentBlock[],
  recentIds: Set<string>
): BoiContentBlock {
  if (candidates.length === 0) {
    throw new Error('Không tìm thấy dữ liệu nội dung quẻ phù hợp.')
  }
  const nonRecent = candidates.filter(b => !recentIds.has(b.id))
  const pool = nonRecent.length > 0 ? nonRecent : candidates
  const idx = rng.nextInt(pool.length)
  return pool[idx]!
}

/**
 * Sinh tóm tắt 4 phương diện phụ trợ (Tiền tài, Duyên tình, Sức khỏe, Sự nghiệp)
 * nhất quán với mức quẻ để tương thích với cả UI 4 ô truyền thống.
 */
function buildFourAspectsSummary(muc: MucQue, mon: string, luangiaiText: string): {
  wealth: string
  love: string
  health: string
  career: string
} {
  const map: Record<MucQue, { wealth: string; love: string; health: string; career: string }> = {
    dai_cat: {
      wealth: 'Tài khí vượng phát, lộc chính và lộc phụ đều hanh thông; nên trích một phần làm việc thiện lành.',
      love: 'Nhân duyên hòa hợp, gia đạo đón tin vui ấm áp, đôi lứa thấu hiểu và sẻ chia.',
      health: 'Thân tâm an thái, khí huyết lưu thông; duy trì giấc ngủ điều độ để giữ trọn sinh lực.',
      career: 'Quý nhân nâng đỡ, mưu sự lớn dễ thành, uy tín cá nhân tỏa sáng trong tập thể.'
    },
    cat: {
      wealth: 'Thu nhập ổn định và tăng trưởng đều, thuận lợi cho kế hoạch tích lũy dài hạn.',
      love: 'Tình cảm êm đềm, khúc mắc nhỏ được tháo gỡ nhờ lời nói chân thành.',
      health: 'Tinh thần minh mẫn, thể lực tốt; nên duy trì vận động nhẹ và thở chánh niệm mỗi ngày.',
      career: 'Công việc tiến triển đúng lộ trình, chăm chỉ bền bỉ ắt gặt hái thành quả.'
    },
    binh: {
      wealth: 'Tài chính cân bằng thu chi, nên giữ nguyên kế hoạch hiện tại và tránh chi tiêu ngẫu hứng.',
      love: 'Duyên tình bình lặng, cần kiên nhẫn lắng nghe để bồi đắp sự gắn kết lâu dài.',
      health: 'Sức khỏe ổn định, lưu ý cân đối thời gian làm việc và nghỉ ngơi hợp lý.',
      career: 'Giai đoạn củng cố nội lực và hoàn thiện việc cũ, chưa nên vội vàng thay đổi lớn.'
    },
    hung: {
      wealth: 'Đề phòng chi phí phát sinh hoặc chậm trễ thu hồi vốn; tạm hoãn đầu tư mạo hiểm.',
      love: 'Dễ nảy sinh hiểu lầm vì lời nói lúc mệt mỏi; hãy nhường một câu để giữ hòa khí.',
      health: 'Cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ và tránh thức khuya quá sức.',
      career: 'Có thử thách nhỏ nơi công sở, cần kiểm tra kỹ từng chi tiết và giữ tâm điềm tĩnh.'
    },
    dai_hung: {
      wealth: 'Bảo toàn ngân khố tối đa, tuyệt đối tránh vay mượn lớn hoặc đầu tư tất tay lúc này.',
      love: 'Giữ tâm tịnh khẩu trước xung đột, không quyết định nóng vội khi cảm xúc đang căng thẳng.',
      health: 'Cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ và ưu tiên phục hồi thân tâm.',
      career: 'Lấy phòng thủ làm gốc, tập trung giữ vững phần việc cốt lõi và chờ thời cơ mới.'
    }
  }

  const base = { ...(map[muc] || map.binh) }
  if (mon === 'cau_tu' || mon === 'duoc_su') {
    if (muc === 'hung' || muc === 'dai_hung') {
      base.health = 'Cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ để chăm sóc sức khỏe khoa học.'
    }
  }
  return base
}

/**
 * Hàm chính sinh kết quả Bói Quẻ 6 Môn Cầu An (Pure Deterministic Function).
 * Cùng đầu vào trong cùng ngày luôn trả về đúng cùng 1 kết quả 100%.
 */
export function generateFortune(input: FortuneDrawInput): FortuneDrawResult {
  const mon = resolveMonId(input.mon)
  const category = resolveLegacyCategory(mon)
  const monName = getMonDisplayName(mon)
  const mode = input.mode || 'quick'

  // Xác định câu hỏi & chủ đề (TopicTag)
  const presets = getPresetQuestions(mon)
  let matchedTag: TopicTag = getDefaultTopicForMon(mon)
  let questionIdKey = `mode_${mode}_default`
  let questionText = presets[0]?.text || 'Xin quẻ cầu an và chỉ dẫn chánh niệm trong ngày.'

  if (mode === 'preset' && input.questionId) {
    const foundPreset = presets.find(q => q.id === input.questionId)
    if (foundPreset) {
      matchedTag = foundPreset.tag
      questionIdKey = foundPreset.id
      questionText = foundPreset.text
    }
  } else if (mode === 'custom' && input.customQuestion?.trim()) {
    matchedTag = matchTopicFromQuestion(input.customQuestion, mon)
    questionText = input.customQuestion.trim()
    questionIdKey = `custom_${matchedTag}_${questionText}`
  } else if (input.questionId) {
    const foundPreset = presets.find(q => q.id === input.questionId)
    if (foundPreset) {
      matchedTag = foundPreset.tag
      questionIdKey = foundPreset.id
      questionText = foundPreset.text
    }
  }

  // Hồ sơ bắt buộc: mọi phương thức (A/B/C/D) đều dùng hồ sơ để tính căn cứ Bát Tự
  const useProfile = input.profile?.fullName?.trim() && input.profile?.birthDate?.trim()
    ? input.profile
    : null

  const usePartner =
    mon === 'to_duyen' && useProfile && input.partnerProfile?.fullName?.trim() && input.partnerProfile?.birthDate?.trim()
      ? input.partnerProfile
      : null

  // Tự động bóc tách ngày mục tiêu cụ thể nếu người chơi gõ trong câu hỏi (vd: "đi chơi vào ngày 20/11/2026")
  const targetDateStr = input.customQuestion?.trim()
    ? extractDateFromQuestion(input.customQuestion, input.dateStr)
    : null
  const effectiveInputDateStr = targetDateStr || input.dateStr

  // Tạo seed nhất quán: seed = hash(ngày sinh + giờ sinh + giới tính + id môn + id câu hỏi + ngày mục tiêu/hiện tại)
  const { seed, seedInputKey, dateStr } = buildFortuneSeed({
    fullName: useProfile?.fullName || 'khach_thap_phuong',
    birthDate: useProfile?.birthDate || '0000-00-00',
    birthHour: useProfile?.birthHour || '',
    gender: useProfile?.gender || 'khac',
    mon,
    questionId: questionIdKey,
    dateStr: effectiveInputDateStr,
    partnerFullName: usePartner?.fullName,
    partnerBirthDate: usePartner?.birthDate,
    partnerGender: usePartner?.gender
  })

  const rng = createSeededRng(seed)

  // Tính căn cứ Can Chi / Ngũ Hành / Cung Phi / Sao Cửu Diệu theo đúng ngày dateStr (ngày mục tiêu hoặc ngày hôm nay)
  const metaphysics = useProfile ? analyzeMetaphysics(useProfile, dateStr, mon, usePartner) : null
  const grounds = metaphysics ? [...metaphysics.grounds] : []

  if (targetDateStr && grounds.length > 0) {
    const [ty, tm, td] = targetDateStr.split('-')
    const vnTargetLabel = `${td}/${tm}/${ty}`
    for (let i = 0; i < grounds.length; i++) {
      if (grounds[i]!.includes('Thiên thời Ngày ')) {
        grounds[i] = grounds[i]!.replace('Thiên thời Ngày ', `Thiên thời Ngày ${vnTargetLabel} · `)
      } else if (grounds[i]!.includes('· Ngày ')) {
        grounds[i] = grounds[i]!.replace('· Ngày ', `· Ngày ${vnTargetLabel} · `)
      }
    }
  }

  // Xác định quan hệ Ngũ Hành để điều chỉnh tỉ lệ mức quẻ
  let effectiveRelation: QuanHeNguHanh = 'binh_hoa'
  let secondaryDayRel: QuanHeNguHanh | undefined
  let dailySeedShift = 0

  if (metaphysics) {
    if (mon === 'to_duyen' && metaphysics.partnerComparison) {
      effectiveRelation = metaphysics.partnerComparison.relation
      secondaryDayRel = metaphysics.relationToDay
      // Cộng điều chỉnh nhẹ theo seed ngày (-0.015 .. +0.015)
      dailySeedShift = ((seed % 31) - 15) / 1000
    } else if (mon === 'dang_sao') {
      effectiveRelation =
        metaphysics.cuuDieuStar.nature === 'cat'
          ? 'tuong_sinh'
          : metaphysics.cuuDieuStar.nature === 'hung'
            ? 'tuong_khac'
            : 'binh_hoa'
    } else {
      effectiveRelation = metaphysics.relationToDay
    }
  }

  const probabilitiesUsed = computeMucProbabilities(effectiveRelation, secondaryDayRel, dailySeedShift)
  const muc = rollMucQue(rng, probabilitiesUsed)
  const mucMeta = getMucMeta(muc)

  // Giải thích minh bạch yếu tố bù đắp nếu căn cứ nghịch mà quẻ vẫn tốt (hoặc ngược lại)
  if (metaphysics) {
    if (effectiveRelation === 'tuong_khac' && (muc === 'dai_cat' || muc === 'cat')) {
      grounds.push(
        'Yếu tố bù đắp: Căn cứ có xung khắc nhưng quẻ đắc Cát do phúc duyên niên vận sao lành nâng đỡ, khuyên tích đức hành thiện để bảo toàn vượng khí.'
      )
    } else if (effectiveRelation === 'tuong_sinh' && (muc === 'hung' || muc === 'dai_hung')) {
      grounds.push(
        'Yếu tố cảnh báo: Căn cứ tuy tương sinh nhưng vận trình thời điểm gặp điểm lắng, nhắc nhở giữ tâm kiên định và hành sự cẩn trọng.'
      )
    }
  }

  // Tập hợp các block ID trong 3 lần gieo gần nhất để tránh lặp lại
  const recentSlice: RecentDrawRef[] = Array.isArray(input.recentDraws) ? input.recentDraws.slice(0, 3) : []
  const recentIds = new Set<string>()
  for (const r of recentSlice) {
    if (r.thoId) recentIds.add(r.thoId)
    if (r.luangiaiId) recentIds.add(r.luangiaiId)
    if (r.loikhuyenId) recentIds.add(r.loikhuyenId)
    if (r.hoagiaiId) recentIds.add(r.hoagiaiId)
  }

  // Chọn 4 khối nội dung bằng seed có kèm bộ lọc độ tuổi và giới tính
  const userAge = metaphysics ? metaphysics.ageLunar : undefined
  const userGender = useProfile?.gender

  const thoCandidates = getCandidateBlocks(mon, muc, 'tho', matchedTag, effectiveRelation, userAge, userGender)
  const lgCandidates = getCandidateBlocks(mon, muc, 'luangiai', matchedTag, effectiveRelation, userAge, userGender)
  const lkCandidates = getCandidateBlocks(mon, muc, 'loikhuyen', matchedTag, effectiveRelation, userAge, userGender)

  const thoBlock = pickBlockAvoidingRecent(rng, thoCandidates, recentIds)
  const lgBlock = pickBlockAvoidingRecent(rng, lgCandidates, recentIds)
  const lkBlock = pickBlockAvoidingRecent(rng, lkCandidates, recentIds)

  let hgBlock: BoiContentBlock | null = null
  if (muc === 'hung' || muc === 'dai_hung') {
    const hgCandidates = getCandidateBlocks(mon, muc, 'hoagiai', matchedTag, effectiveRelation, userAge, userGender)
    hgBlock = pickBlockAvoidingRecent(rng, hgCandidates, recentIds)
  }

  const disclaimer = getDisclaimerText()
  const dailyEffect = getDailyEffectForMuc(muc)
  const aspects = buildFourAspectsSummary(muc, mon, lgBlock.text)
  let title = thoBlock.title || `${monName} · ${mucMeta.label}`
  if (mon === 'xin_xam') {
    title = title.replace(/^Quẻ Số\s+/i, 'Thẻ số ')
  }

  return {
    seed,
    seedInputKey,
    dateStr,
    targetDateStr,
    mon,
    category,
    monName,
    mode,
    matchedTag,
    matchedTagLabel: getTopicLabel(matchedTag),
    questionText,
    muc,
    mucLabel: mucMeta.label,
    mucBadgeColor: mucMeta.badgeColor,
    probabilitiesUsed,
    grounds,
    metaphysics,
    blocks: {
      tho: {
        id: thoBlock.id,
        title,
        text: thoBlock.text
      },
      luangiai: {
        id: lgBlock.id,
        text: lgBlock.text
      },
      loikhuyen: {
        id: lkBlock.id,
        text: lkBlock.text
      },
      hoagiai: hgBlock
        ? {
            id: hgBlock.id,
            text: hgBlock.text
          }
        : null
    },
    dailyEffect,
    disclaimer,
    // Các trường tương thích ngược với giao diện và DB hiện tại
    title,
    score: mucMeta.label,
    sealText: mucMeta.sealText,
    poem: thoBlock.text,
    meaning: lgBlock.text,
    mindfulAdvice: lkBlock.text,
    remediationText: hgBlock ? hgBlock.text : null,
    aspects
  }
}

