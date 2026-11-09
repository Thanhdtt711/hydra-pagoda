import cauTuJson from '../../data/boi/cau_tu.json' with { type: 'json' }
import chieuTaiJson from '../../data/boi/chieu_tai.json' with { type: 'json' }
import configJson from '../../data/boi/config.json' with { type: 'json' }
import dangSaoJson from '../../data/boi/dang_sao.json' with { type: 'json' }
import duocSuJson from '../../data/boi/duoc_su.json' with { type: 'json' }
import toDuyenJson from '../../data/boi/to_duyen.json' with { type: 'json' }
import xinXamJson from '../../data/boi/xin_xam.json' with { type: 'json' }
import { normalizeVietnameseText } from './SeedService'
import type {
  BoiContentBlock,
  BuffDebuffEffect,
  KhoiNoiDung,
  LegacyCategoryId,
  MonId,
  MucQue,
  PresetQuestion,
  QuanHeNguHanh,
  TopicTag
} from './types'

const CATEGORY_TO_MON: Record<string, MonId> = {
  stick: 'xin_xam',
  xin_xam: 'xin_xam',
  love: 'to_duyen',
  to_duyen: 'to_duyen',
  family: 'cau_tu',
  cau_tu: 'cau_tu',
  wealth: 'chieu_tai',
  chieu_tai: 'chieu_tai',
  health: 'duoc_su',
  duoc_su: 'duoc_su',
  star: 'dang_sao',
  dang_sao: 'dang_sao'
}

const MON_TO_CATEGORY: Record<MonId, LegacyCategoryId> = {
  xin_xam: 'stick',
  to_duyen: 'love',
  cau_tu: 'family',
  chieu_tai: 'wealth',
  duoc_su: 'health',
  dang_sao: 'star'
}

const MON_NAMES: Record<MonId, string> = {
  xin_xam: 'Xin Xăm Bát Quái',
  to_duyen: 'Tơ Duyên Tương Ngộ',
  cau_tu: 'Cầu Tự Con Cái',
  chieu_tai: 'Chiêu Tài Tấn Bảo',
  duoc_su: 'Dược Sư An Khang',
  dang_sao: 'Dâng Sao Giải Hạn'
}

const MON_DEFAULT_TAG: Record<MonId, TopicTag> = {
  xin_xam: 'tong_quan',
  to_duyen: 'tinh_duyen',
  cau_tu: 'gia_dao',
  chieu_tai: 'tai_loc',
  duoc_su: 'suc_khoe',
  dang_sao: 'tong_quan'
}

/** Bộ dữ liệu 6 môn đã nạp từ JSON */
const SUBJECT_REPOS: Record<MonId, BoiContentBlock[]> = {
  xin_xam: xinXamJson as unknown as BoiContentBlock[],
  to_duyen: toDuyenJson as unknown as BoiContentBlock[],
  cau_tu: cauTuJson as unknown as BoiContentBlock[],
  chieu_tai: chieuTaiJson as unknown as BoiContentBlock[],
  duoc_su: duocSuJson as unknown as BoiContentBlock[],
  dang_sao: dangSaoJson as unknown as BoiContentBlock[]
}

/**
 * Cho phép đăng ký thêm dữ liệu JSON của các môn tiếp theo (Bước 3 & Bước 4)
 */
export function registerSubjectBlocks(mon: MonId, blocks: BoiContentBlock[]): void {
  SUBJECT_REPOS[mon] = blocks
}

export function resolveMonId(raw: string | undefined | null): MonId {
  const key = String(raw || 'xin_xam').trim().toLowerCase()
  return CATEGORY_TO_MON[key] || 'xin_xam'
}

export function resolveLegacyCategory(mon: MonId): LegacyCategoryId {
  return MON_TO_CATEGORY[mon] || 'stick'
}

export function getMonDisplayName(mon: MonId): string {
  return MON_NAMES[mon] || 'Xin Xăm Bát Quái'
}

export function getDefaultTopicForMon(mon: MonId): TopicTag {
  return MON_DEFAULT_TAG[mon] || 'tong_quan'
}

export function getBoiConfig() {
  return configJson
}

export function getDisclaimerText(): string {
  return configJson.disclaimer || 'Chỉ mang tính giải trí'
}

export function getMucMeta(muc: MucQue): { label: string; sealText: string; badgeColor: string } {
  const map = configJson.mucMetadata as Record<MucQue, { label: string; sealText: string; badgeColor: string }>
  return map[muc] || map.binh
}

export function getTopicLabel(tag: TopicTag): string {
  const map = configJson.topicLabels as Record<TopicTag, string>
  return map[tag] || map.tong_quan
}

export function getPresetQuestions(monOrCategory: string): PresetQuestion[] {
  const mon = resolveMonId(monOrCategory)
  const presets = (configJson.presetQuestions as Record<string, PresetQuestion[]>)[mon]
  return presets || (configJson.presetQuestions.xin_xam as PresetQuestion[])
}

export function getDailyEffectForMuc(muc: MucQue): BuffDebuffEffect {
  const map = configJson.dailyEffects as Record<MucQue, BuffDebuffEffect>
  return map[muc] || map.binh
}

/**
 * Dò từ khóa từ câu hỏi tự do để quy về chủ đề có sẵn (TopicTag).
 * KHÔNG gọi AI sinh text lúc chạy.
 */
export function matchTopicFromQuestion(customQuestion: string | undefined | null, fallbackMon: MonId = 'xin_xam'): TopicTag {
  const norm = normalizeVietnameseText(customQuestion)
  if (!norm) return getDefaultTopicForMon(fallbackMon)

  const padded = ` ${norm} `
  const rules = configJson.keywordMap as Array<{ tag: TopicTag; keywords: string[] }>

  let bestTag: TopicTag | null = null
  let bestScore = 0

  for (const rule of rules) {
    let score = 0
    for (const kw of rule.keywords) {
      const normKw = normalizeVietnameseText(kw)
      if (!normKw) continue
      if (padded.includes(` ${normKw} `)) {
        score += normKw.includes(' ') ? 3 : 2
      } else if (norm.includes(normKw)) {
        score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestTag = rule.tag
    }
  }

  return bestTag || getDefaultTopicForMon(fallbackMon)
}

/**
 * Lấy danh sách mảnh nội dung theo (môn, mức quẻ, khối, chủ đề).
 * Nếu môn chưa có file JSON riêng (sẽ bổ sung ở Bước 3 & 4), dùng kho chung đã điều chỉnh an toàn.
 */
export function getCandidateBlocks(
  mon: MonId,
  muc: MucQue,
  khoi: KhoiNoiDung,
  tag: TopicTag,
  quanHe?: QuanHeNguHanh,
  userAge?: number,
  userGender?: GenderType
): BoiContentBlock[] {
  const pool = SUBJECT_REPOS[mon] || SUBJECT_REPOS.xin_xam || []

  // Lọc theo mức quẻ, khối, ngũ hành, độ tuổi và giới tính
  const byMucAndKhoi = pool.filter((b) => {
    if (b.muc !== muc || b.khoi !== khoi) return false
    if (b.dieukien?.quanHe && quanHe && !b.dieukien.quanHe.includes(quanHe)) {
      return false
    }
    // Lọc theo giới tính nếu block có khai báo
    if (userGender && b.dieukien?.gender && !b.dieukien.gender.includes(userGender)) {
      return false
    }
    // Lọc theo độ tuổi:
    if (userAge !== undefined) {
      if (b.dieukien?.minAge !== undefined && userAge < b.dieukien.minAge) return false
      if (b.dieukien?.maxAge !== undefined && userAge > b.dieukien.maxAge) return false

      // Quy tắc bảo vệ độ tuổi khi xem quẻ tổng quan:
      // 1. Tag thi_cu (ôn thi, thi cử học đường): chỉ gợi ý cho tuổi 12-35. Nếu > 35 tuổi mà người xem không hỏi về thi cử thì loại bỏ.
      if (tag !== 'thi_cu' && userAge > 35 && b.tags.includes('thi_cu') && !b.tags.includes('su_nghiep')) {
        return false
      }
      // 2. Tag gia_dao liên quan đến con cái/kết hôn: chỉ cho tuổi >= 18.
      if (userAge < 18 && (b.tags.includes('gia_dao') || mon === 'cau_tu')) {
        return false
      }
    }
    return true
  })

  // Ưu tiên các block khớp đúng tag chủ đề
  const byTag = byMucAndKhoi.filter(b => b.tags.includes(tag))
  const finalPool = byTag.length >= 2 ? byTag : byMucAndKhoi

  // Ràng buộc an toàn bắt buộc cho Cầu Tự và Dược Sư ở mức xấu (Hung / Đại Hung):
  // Luôn đảm bảo có cụm "cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ", cấm phán bệnh, cấm nói vô sinh.
  if ((mon === 'cau_tu' || mon === 'duoc_su') && (muc === 'hung' || muc === 'dai_hung') && khoi === 'luangiai') {
    return finalPool.map((b) => {
      if (b.text.includes('cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ')) {
        return b
      }
      return {
        ...b,
        text: `${b.text} Giai đoạn này bạn cần kiên nhẫn, chú ý nghỉ ngơi, nên đi khám định kỳ.`
      }
    })
  }

  return finalPool
}
