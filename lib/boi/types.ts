/**
 * Hệ thống "Bói Quẻ 6 Môn Cầu An" — Định nghĩa kiểu dữ liệu cốt lõi
 */

export type MonId = 'xin_xam' | 'to_duyen' | 'cau_tu' | 'chieu_tai' | 'duoc_su' | 'dang_sao'

/** Ánh xạ hai chiều giữa mã tab UI cũ ('stick'...) và mã môn chuẩn ('xin_xam'...) */
export type LegacyCategoryId = 'stick' | 'love' | 'family' | 'wealth' | 'health' | 'star'

export type MucQue = 'dai_cat' | 'cat' | 'binh' | 'hung' | 'dai_hung'

export type KhoiNoiDung = 'tho' | 'luangiai' | 'loikhuyen' | 'hoagiai'

export type InputMode = 'quick' | 'preset' | 'profile' | 'custom'

export type GenderType = 'nam' | 'nu' | 'khac'

export type NguHanh = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ'

export type QuanHeNguHanh = 'tuong_sinh' | 'tuong_khac' | 'binh_hoa'

export type TopicTag =
  | 'tong_quan'
  | 'su_nghiep'
  | 'tai_loc'
  | 'tinh_duyen'
  | 'gia_dao'
  | 'suc_khoe'
  | 'thi_cu'
  | 'xuat_hanh'

export interface BoiBlockCondition {
  /** Chỉ khớp khi quan hệ ngũ hành thuộc danh sách này */
  quanHe?: QuanHeNguHanh[]
  /** Chỉ khớp khi bản mệnh thuộc các hành này */
  menh?: NguHanh[]
  /** Chỉ khớp với giới tính cụ thể */
  gender?: GenderType[]
  /** Giới hạn độ tuổi tối thiểu */
  minAge?: number
  /** Giới hạn độ tuổi tối đa */
  maxAge?: number
}

/**
 * Schema chuẩn cho từng mảnh nội dung trong `data/boi/*.json`
 * { id, mon, muc, khoi: "tho|luangiai|loikhuyen|hoagiai", title?, text, tags[], dieukien? }
 */
export interface BoiContentBlock {
  id: string
  mon: MonId
  muc: MucQue
  khoi: KhoiNoiDung
  /** Tên quẻ (dành cho khối 'tho', vd: "Quẻ Số 01 · Thượng Thượng Cửu Long") */
  title?: string
  text: string
  tags: TopicTag[]
  dieukien?: BoiBlockCondition
}

export interface PresetQuestion {
  id: string
  text: string
  tag: TopicTag
}

export interface PersonProfile {
  fullName: string
  /** Định dạng YYYY-MM-DD hoặc YYYY */
  birthDate: string
  /** Giờ sinh tùy chọn: 'ty' | 'suu' | ... | 'hoi' hoặc '' */
  birthHour?: string
  gender: GenderType
}

export interface SavedFortuneProfile extends PersonProfile {
  /** Thông tin người thương (dùng cho môn Tơ Duyên Tương Ngộ) */
  partner?: PersonProfile | null
  updatedAt: number
}

export interface MetaphysicsAnalysis {
  birthYear: number
  ageLunar: number
  canChiNam: string
  nguHanhMenh: NguHanh
  napAmName: string
  cungPhi: string
  cungPhiHanh: NguHanh
  dayCanChi: string
  dayNguHanh: NguHanh
  relationToDay: QuanHeNguHanh
  /** Sao chiếu mệnh Cửu Diệu (La Hầu, Kế Đô, Thái Dương, Thái Âm, Mộc Đức, Thủy Diệu, Thổ Tú, Vân Hán, Thái Bạch) */
  cuuDieuStar: {
    name: string
    nature: 'cat' | 'hung' | 'trung'
    element: NguHanh
    summary: string
  }
  /** Phân tích tương hợp hai mệnh (dành cho Tơ Duyên Tương Ngộ) */
  partnerComparison?: {
    partnerName: string
    partnerBirthYear: number
    partnerCanChi: string
    partnerNguHanh: NguHanh
    partnerNapAm: string
    partnerCungPhi: string
    relation: QuanHeNguHanh
    summary: string
  }
  /** 1-2 dòng căn cứ hiển thị trên kết quả */
  grounds: string[]
}

export interface RecentDrawRef {
  mon: MonId
  muc?: MucQue
  thoId?: string
  luangiaiId?: string
  loikhuyenId?: string
  hoagiaiId?: string | null
}

export interface FortuneDrawInput {
  mon: MonId | LegacyCategoryId
  mode: InputMode
  /** Ngày hiện tại định dạng YYYY-MM-DD (mặc định lấy theo giờ địa phương/UTC+7) */
  dateStr?: string
  /** Mã câu hỏi có sẵn (Chế độ B) */
  questionId?: string
  /** Câu hỏi tự do của người chơi (Chế độ câu hỏi tự do) */
  customQuestion?: string
  /** Hồ sơ cá nhân (Chế độ C hoặc hồ sơ đã lưu) */
  profile?: PersonProfile | null
  /** Hồ sơ người kia (dành cho môn Tơ Duyên) */
  partnerProfile?: PersonProfile | null
  /** Danh sách tối đa 3 lần gieo gần nhất để tránh trùng biến thể */
  recentDraws?: RecentDrawRef[]
}

export interface BuffDebuffEffect {
  type: 'buff' | 'neutral' | 'debuff'
  id: string
  name: string
  description: string
  statModifier: Record<string, number>
  remediationQuest?: {
    id: string
    title: string
    actionType: 'meditate' | 'donate_merit' | 'light_incense'
    description: string
  } | null
}

export interface FortuneDrawResult {
  seed: number
  seedInputKey: string
  dateStr: string
  /** Ngày mục tiêu được tự động bóc tách từ câu hỏi tự do (vd: '2026-11-20' từ "đi chơi ngày 20/11/2026") */
  targetDateStr?: string | null
  mon: MonId
  category: LegacyCategoryId
  monName: string
  mode: InputMode
  matchedTag: TopicTag
  matchedTagLabel: string
  questionText: string
  muc: MucQue
  mucLabel: string
  mucBadgeColor: string
  probabilitiesUsed: Record<MucQue, number>
  /** 1-2 dòng căn cứ (rỗng nếu dùng Chế độ A và không có thông tin hồ sơ) */
  grounds: string[]
  metaphysics: MetaphysicsAnalysis | null
  /** 4 khối nội dung */
  blocks: {
    tho: { id: string; title: string; text: string }
    luangiai: { id: string; text: string }
    loikhuyen: { id: string; text: string }
    hoagiai: { id: string; text: string } | null
  }
  /** Buff/Debuff nhẹ trong ngày từ file config */
  dailyEffect: BuffDebuffEffect
  /** Dòng bắt buộc cuối kết quả */
  disclaimer: string
  /** Các trường tương thích ngược với giao diện cũ */
  title: string
  score: string
  sealText: string
  poem: string
  meaning: string
  mindfulAdvice: string
  remediationText: string | null
  aspects: {
    wealth: string
    love: string
    health: string
    career: string
  }
}

