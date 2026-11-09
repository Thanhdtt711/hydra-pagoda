/**
 * Dịch vụ Ví Nội Bộ MC Coin (Bước 4 - Spend MC Coin Service).
 *
 * Nguyên tắc bảo mật & toàn vẹn tài chính:
 * 1. Mọi hành động tiêu MC trong game (Cửa Hàng/Di Sản, Bói Quẻ & Cầu An, Hòm Công Đức, và các dịch vụ mở rộng)
 *    ĐỀU BẮT BUỘC đi qua hàm nguyên tử `spend(accountId, amount, reason, refId, opts)`.
 * 2. Client KHÔNG BAO GIỜ quyết định số dư, giá vật phẩm hay kết quả bói quẻ.
 * 3. Chống số dư âm & chống đua luồng (race condition) bằng câu lệnh cập nhật có điều kiện:
 *      `UPDATE accounts SET mc_balance = mc_balance - ? WHERE id = ? AND mc_balance >= ?`
 *    kết hợp khóa giao dịch `BEGIN IMMEDIATE` của SQLite WAL.
 * 4. Idempotency: mỗi yêu cầu tiêu có `requestId` (`refId`); ràng buộc `UNIQUE(reason, ref_id)` trong `mc_ledger`
 *    đảm bảo gửi lặp cùng `requestId` không bao giờ trừ MC hai lần.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { resolveLegacyCategory, resolveMonId } from '../../../lib/boi/ContentRepository'
import { generateFortune } from '../../../lib/boi/FortuneEngine'
import type { FortuneDrawInput, InputMode, PersonProfile, RecentDrawRef } from '../../../lib/boi/types'
import { HallLayout } from '../../../lib/world3d/world/HallLayout'
import { apiError } from './auth'
import { getDb, withTransaction } from './db'
import { scheduleHydraRecord } from '../hydra/hydraQueue'

export type SpendReason =
  | 'shop_buy_attire'
  | 'shop_buy_offering'
  | 'shop_unlock_card'
  | 'fortune_divination'
  | 'merit_donation'
  | 'hau_dong_donation'
  | 'custom_service'

export type DivinationCategory = 'stick' | 'love' | 'family' | 'wealth' | 'health' | 'star'
export type DivinationTier = 'basic' | 'auspicious' | 'golden'
export type ShopCategory = 'attire' | 'offering' | 'heritage_card'

export interface McServiceDefinition {
  id: string
  name: string
  reason: SpendReason
  description: string
  minMc: number
  maxMc: number
  fixedPriceMc: number | null
  enabled: boolean
}

export interface ShopCatalogItem {
  id: string
  name: string
  subname: string
  category: ShopCategory
  countryCode: string
  countryId?: string
  priceMc: number
  consumable: boolean
  defaultUnlocked: boolean
  icon: string
}

export interface FortuneTierConfig {
  id: DivinationTier
  name: string
  badge: string
  description: string
  costMc: number
}

export interface FortuneEntry {
  category: DivinationCategory
  title: string
  score: string
  sealText: string
  poem: string
  aspects: {
    wealth: string
    career: string
    love: string
    health: string
    family: string
  }
  meaning: string
  mindfulAdvice: string
}

/* ============================================================================
 * 1. DANH MỤC CẤU HÌNH DỊCH VỤ TIÊU MC & VẬT PHẨM TRÊN SERVER
 * ========================================================================== */

/** Danh sách dịch vụ tiêu MC dạng cấu hình để dễ dàng mở rộng thêm dịch vụ mới */
export const MC_SERVICES_CONFIG: McServiceDefinition[] = [
  {
    id: 'shop_attire',
    name: 'Thỉnh Cổ Phục 9 Quốc Gia',
    reason: 'shop_buy_attire',
    description: 'Mở khóa vĩnh viễn trang phục hành hương truyền thống của 9 quốc gia Á Đông & Làng Mai',
    minMc: 500,
    maxMc: 2500,
    fixedPriceMc: null,
    enabled: true
  },
  {
    id: 'shop_offering',
    name: 'Thỉnh Lễ Vật & Nhang Trầm',
    reason: 'shop_buy_offering',
    description: 'Thỉnh nhang trầm, hoa đăng, bánh oản và mâm ngũ quả dâng cúng Tam Bảo',
    minMc: 50,
    maxMc: 120,
    fixedPriceMc: null,
    enabled: true
  },
  {
    id: 'shop_heritage_card',
    name: 'Khai Quang Thẻ Bài Di Sản 3D',
    reason: 'shop_unlock_card',
    description: 'Mở khóa mô hình 3D cổ tự và triết lý kinh điển theo chuẩn metadata CIP-68',
    minMc: 1500,
    maxMc: 2500,
    fixedPriceMc: null,
    enabled: true
  },
  {
    id: 'fortune_divination',
    name: 'Bói Quẻ 6 Môn & Cầu An',
    reason: 'fortune_divination',
    description: 'Gieo quẻ chiêm bốc 6 môn (Xin Xăm, Tình Duyên, Cầu Tự, Tài Lộc, Sức Khỏe, Dâng Sao) — 50 MC/lượt thêm',
    minMc: 50,
    maxMc: 50,
    fixedPriceMc: 50,
    enabled: true
  },
  {
    id: 'merit_donation',
    name: 'Cúng Dường Hòm Công Đức',
    reason: 'merit_donation',
    description: 'Phát tâm công đức tự nguyện (số MC tùy chọn) ghi danh bảng vàng công đức toàn chùa',
    minMc: 10,
    maxMc: 1_000_000,
    fixedPriceMc: null,
    enabled: true
  }
]

/** Danh mục vật phẩm Cửa Hàng & Thẻ Bài Di Sản (giá luôn quyết định ở server) */
export const SHOP_CATALOG: ShopCatalogItem[] = [
  // A. Cổ phục 9 quốc gia (mua 1 lần mở khóa vĩnh viễn)
  {
    id: 'vietnam',
    name: 'Áo Lam Cổ Phục & Nón Lá',
    subname: 'Áo Tấc lụa lam Hà Đông dệt viền chỉ vàng kim',
    category: 'attire',
    countryCode: 'VN',
    countryId: 'vietnam',
    priceMc: 0,
    consumable: false,
    defaultUnlocked: true,
    icon: 'sparkles'
  },
  {
    id: 'japan',
    name: 'Samue Thiền Tăng & Nón Kasa',
    subname: 'Đen chàm Zen tối giản đan nón rơm Kasa',
    category: 'attire',
    countryCode: 'JP',
    countryId: 'japan',
    priceMc: 500,
    consumable: false,
    defaultUnlocked: true,
    icon: 'sparkles'
  },
  {
    id: 'western',
    name: 'Pháp Phục Nâu Làng Mai',
    subname: 'Vải thô mộc mạc từng bước chân an lạc',
    category: 'attire',
    countryCode: 'LM',
    countryId: 'western',
    priceMc: 600,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },
  {
    id: 'thailand',
    name: 'Y Cà Sa Theravada',
    subname: 'Saffron vàng nghệ hoàng gia Thái Lan',
    category: 'attire',
    countryCode: 'TH',
    countryId: 'thailand',
    priceMc: 800,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },
  {
    id: 'korea',
    name: 'Hanbok Durumagi & Mũ Gat',
    subname: 'Xám khói thanh tịnh thiền phái Tào Khê',
    category: 'attire',
    countryCode: 'KR',
    countryId: 'korea',
    priceMc: 1000,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },
  {
    id: 'taiwan',
    name: 'Áo Tràng Lam Cổ Tự',
    subname: 'Đại Phật nhân gian thêu hoa sen ngọc',
    category: 'attire',
    countryCode: 'TW',
    countryId: 'taiwan',
    priceMc: 1200,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },
  {
    id: 'singapore',
    name: 'Pháp Phục Lụa Singapore',
    subname: 'Giao thoa thanh lịch thời Đường hiện đại',
    category: 'attire',
    countryCode: 'SG',
    countryId: 'singapore',
    priceMc: 1500,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },
  {
    id: 'india',
    name: 'Khăn Quàng Dhoti Bồ Đề',
    subname: 'Y đỏ phù sa đất Phật Tứ Động Tâm',
    category: 'attire',
    countryCode: 'IN',
    countryId: 'india',
    priceMc: 1800,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },
  {
    id: 'tibet',
    name: 'Áo Chuba & Mũ Pandita',
    subname: 'Vải dạ viền gấm Tây Tạng tuyết sơn',
    category: 'attire',
    countryCode: 'TB',
    countryId: 'tibet',
    priceMc: 2500,
    consumable: false,
    defaultUnlocked: false,
    icon: 'sparkles'
  },

  // B. Lễ vật & Nhang trầm (tiêu hao / tích lũy số lượng trong kho đồ)
  {
    id: 'incense_quang',
    name: 'Trầm Hương Xứ Quảng',
    subname: 'Tỏa làn khói trầm thơm ngát 30 phút',
    category: 'offering',
    countryCode: 'VN',
    priceMc: 50,
    consumable: true,
    defaultUnlocked: false,
    icon: 'incense'
  },
  {
    id: 'lotus_lantern',
    name: 'Hoa Đăng Cầu An',
    subname: 'Đèn sen lung linh thắp sáng ước nguyện',
    category: 'offering',
    countryCode: 'VN',
    priceMc: 60,
    consumable: true,
    defaultUnlocked: false,
    icon: 'lotus'
  },
  {
    id: 'incense_japan',
    name: 'Đàn Hương Kyoto',
    subname: 'Thanh khiết hương trầm chùa cổ Nhật Bản',
    category: 'offering',
    countryCode: 'JP',
    priceMc: 80,
    consumable: true,
    defaultUnlocked: false,
    icon: 'incense'
  },
  {
    id: 'oan_cake',
    name: 'Bánh Oản Hoàng Cung',
    subname: 'Lễ phẩm trang nghiêm thời Nguyễn',
    category: 'offering',
    countryCode: 'VN',
    priceMc: 100,
    consumable: true,
    defaultUnlocked: false,
    icon: 'cards'
  },
  {
    id: 'fruit_basket',
    name: 'Mâm Ngũ Quả Cúng Dường',
    subname: 'Hoa quả tươi ngũ sắc kính dâng Tam Bảo',
    category: 'offering',
    countryCode: 'VN',
    priceMc: 120,
    consumable: true,
    defaultUnlocked: false,
    icon: 'lotus'
  },

  // C. Thẻ bài Di Sản 3D (mở khóa bộ sưu tập cổ tự)
  {
    id: 'card_vn_truclam',
    name: 'Thẻ Di Sản: Cư Trần Lạc Đạo Phú',
    subname: 'Thiền Phái Trúc Lâm Yên Tử · Việt Nam',
    category: 'heritage_card',
    countryCode: 'VN',
    priceMc: 0,
    consumable: false,
    defaultUnlocked: true,
    icon: 'cards'
  },
  {
    id: 'card_jp_ichigo',
    name: 'Thẻ Di Sản: Nhất Kỳ Nhất Hội',
    subname: 'Triết Lý Thiền Trà · Nhật Bản',
    category: 'heritage_card',
    countryCode: 'JP',
    priceMc: 0,
    consumable: false,
    defaultUnlocked: true,
    icon: 'cards'
  },
  {
    id: 'card_vn_motcot',
    name: 'Thẻ Di Sản: Chùa Một Cột (Diên Hựu Tự)',
    subname: 'Đóa Sen Ngàn Năm Thăng Long · Việt Nam',
    category: 'heritage_card',
    countryCode: 'VN',
    priceMc: 0,
    consumable: false,
    defaultUnlocked: true,
    icon: 'pagoda'
  },
  {
    id: 'card_jp_kinkaku',
    name: 'Thẻ Di Sản: Chùa Vàng Kinkaku-ji',
    subname: 'Lộc Uyển Tự Kyoto · Nhật Bản',
    category: 'heritage_card',
    countryCode: 'JP',
    priceMc: 1500,
    consumable: false,
    defaultUnlocked: false,
    icon: 'pagoda'
  },
  {
    id: 'card_kr_bulguk',
    name: 'Thẻ Di Sản: Phật Quốc Tự (Bulguksa)',
    subname: 'Đỉnh Cao Kiến Trúc Đá Silla · Hàn Quốc',
    category: 'heritage_card',
    countryCode: 'KR',
    priceMc: 2000,
    consumable: false,
    defaultUnlocked: false,
    icon: 'pagoda'
  },
  {
    id: 'card_th_watphra',
    name: 'Thẻ Di Sản: Chùa Phật Ngọc (Wat Phra Kaew)',
    subname: 'Bảo Vật Hoàng Gia · Thái Lan',
    category: 'heritage_card',
    countryCode: 'TH',
    priceMc: 2500,
    consumable: false,
    defaultUnlocked: false,
    icon: 'pagoda'
  }
]

/** Mức phí Bói Quẻ & Cầu An (đồng giá 50 MC / lượt thêm) */
export const FORTUNE_TIERS: Record<DivinationTier, FortuneTierConfig> = {
  basic: {
    id: 'basic',
    name: 'Thỉnh Quẻ Cầu An',
    badge: '50 MC / Lượt',
    description: 'Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày',
    costMc: 50
  },
  auspicious: {
    id: 'auspicious',
    name: 'Thỉnh Quẻ Cầu An',
    badge: '50 MC / Lượt',
    description: 'Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày',
    costMc: 50
  },
  golden: {
    id: 'golden',
    name: 'Thỉnh Quẻ Cầu An',
    badge: '50 MC / Lượt',
    description: 'Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày',
    costMc: 50
  }
}

export const MERIT_CONFIG = {
  minMc: 10,
  maxMc: 1_000_000,
  suggestedAmountsMc: [50, 100, 500, 1000] as const,
  baseGlobalMeritMc: 0,
  rewardThresholds: [
    { minMc: 500, itemId: 'lotus_lantern', itemName: 'Hoa Đăng Cầu An' }
  ]
}

/** Kho dữ liệu quẻ bói 6 môn trên server (client không tự chọn kết quả) */
export const FORTUNE_CORPUS: Record<DivinationCategory, FortuneEntry[]> = {
  stick: [
    {
      category: 'stick',
      title: 'Quẻ Số 01: Thuần Càn (Bát Thuần Càn)',
      score: 'Thượng Thượng Đại Cát',
      sealText: 'PHI LONG TẠI THIÊN',
      poem: 'Rồng vàng bay lượn chốn trời cao\nVạn sự hanh thông rạng ngọc đào\nChí lớn vươn xa nghìn dặm thẳm\nĐức dày phúc ấm ánh dương trào.',
      aspects: {
        wealth: 'Tài lộc dồi dào, kinh doanh buôn bán thu nhiều lợi nhuận.',
        career: 'Công danh thăng tiến rực rỡ, được quý nhân nâng đỡ.',
        love: 'Tình duyên thắm thiết, gia đạo viên mãn bình an.',
        health: 'Thân thể tráng kiện, khí huyết lưu thông sung túc.',
        family: 'Gia đạo hưng vượng, con cháu hiếu thuận thảo hiền.'
      },
      meaning: 'Thời vận hanh thông đến độ chín muồi. Mọi dự định ấp ủ đều có thể triển khai mạnh dạn, lấy đạo đức làm gốc thì thành công rực rỡ.',
      mindfulAdvice: 'Khi ở đỉnh cao phong độ, chớ sinh tâm kiêu ngạo; hãy giữ tâm khiêm nhường như bông lúa chín cúi đầu và sẵn lòng giúp đỡ người khác.'
    },
    {
      category: 'stick',
      title: 'Quẻ Số 14: Hỏa Thiên Đại Hữu',
      score: 'Thượng Cát Hanh Thông',
      sealText: 'KHO TÀNG PHƯỚC ĐỨC',
      poem: 'Mặt trời chiếu rọi giữa trời trưa\nGặt hái thành công trúng tiết mùa\nTích thiện tu tâm trời đất trợ\nBình an phú quý tựa chuông xưa.',
      aspects: {
        wealth: 'Tiền tài sung túc, có của ăn của để vững bền.',
        career: 'Mở rộng quy mô thuận lợi, đồng nghiệp kính nể.',
        love: 'Đôi bên hòa hợp, tìm được tri kỷ đồng điệu.',
        health: 'Tinh thần sảng khoái, không có bệnh tật hiểm nghèo.',
        family: 'Trong ấm ngoài êm, đón nhận nhiều tin vui mừng rỡ.'
      },
      meaning: 'Sở hữu nhiều phước lành và tài nguyên quý giá. Thời điểm tốt để hợp tác, mở mang công việc thiện nguyện và kinh doanh.',
      mindfulAdvice: 'Của cải nhiều cần biết san sẻ cho những mảnh đời cơ nhỡ; phước đức bố thí chính là chiếc khiên bảo vệ gia tộc vững bền nhất.'
    }
  ],
  love: [
    {
      category: 'love',
      title: 'Quẻ Tơ Duyên: Nguyệt Lão Se Chỉ Đỏ',
      score: 'Lương Duyên Tiền Định',
      sealText: 'BÁCH NIÊN HẢO HỢP',
      poem: 'Biển người muôn dặm gặp được nhau\nChẳng phải ngẫu nhiên tự thuở nào\nChữ duyên vun đắp bằng thấu hiểu\nChữ nợ bao dung chữ ngọt ngào.',
      aspects: {
        wealth: 'Vợ chồng đồng lòng tát biển Đông cũng cạn, kinh tế ngày càng khấm khá.',
        career: 'Hậu phương vững chắc giúp sự nghiệp thăng hoa.',
        love: 'Tình cảm mặn nồng son sắt, thấu hiểu và sẻ chia sâu sắc.',
        health: 'Tâm an vui vẻ, đôi bên cùng chăm sóc sức khỏe cho nhau.',
        family: 'Gia đình hai bên thuận hòa, xóm giềng ngợi khen.'
      },
      meaning: 'Mối nhân duyên sâu đậm gặp lại. Dù có thử thách ban đầu, chỉ cần đôi bên chân thành và kiên nhẫn thì kết quả sẽ đơm hoa kết trái.',
      mindfulAdvice: 'Tình yêu bền vững không phải là tìm kiếm một người hoàn hảo, mà là học cách nhìn nhận nhau bằng sự bao dung trọn vẹn.'
    },
    {
      category: 'love',
      title: 'Quẻ Tơ Duyên: Hoa Nở Đợi Gió Đông',
      score: 'Duyên Lành Đang Đến',
      sealText: 'HOAN HỶ TƯƠNG PHÙNG',
      poem: 'Hoa mai ấp ủ giữa ngày đông\nChờ ngọn gió xuân ấm cõi lòng\nChớ vội cưỡng cầu duyên đến muộn\nTrời dành tri kỷ ngát hương trong.',
      aspects: {
        wealth: 'Tập trung bồi dưỡng tài chính cá nhân, vững vàng tự chủ.',
        career: 'Thời gian này tập trung học tập, phát triển sự nghiệp cá nhân.',
        love: 'Người độc thân sắp gặp được đối tượng hòa hợp về tâm hồn.',
        health: 'Giữ tâm lý thoải mái, yêu thương chăm sóc bản thân.',
        family: 'Gia đình ủng hộ, không nên chịu áp lực giục giã.'
      },
      meaning: 'Duyên lành đang được chuẩn bị cho bạn vào thời điểm thích hợp nhất.',
      mindfulAdvice: 'Hãy trở thành phiên bản lương thiện và bình an nhất của chính mình; bông hoa thơm tự khắc thu hút đàn bướm ghé thăm.'
    }
  ],
  family: [
    {
      category: 'family',
      title: 'Quẻ Cầu Tự: Quan Âm Tống Tử Ban Phước',
      score: 'Sinh Quý Tử Cát Khánh',
      sealText: 'LIÊN HOA HÓA SANH',
      poem: 'Đài sen Quan Âm tỏa ánh lành\nGia đường tích đức sớm sinh mầm\nĐón tay bồng bế thiên tiên tử\nHiếu thảo thơm danh rạng tổ tông.',
      aspects: {
        wealth: 'Con cái mang lại tài lộc và sinh khí hưng thịnh cho cha mẹ.',
        career: 'Sự nghiệp hanh thông, động lực phấn đấu vì tương lai con trẻ.',
        love: 'Tình cảm vợ chồng thêm gắn kết keo sơn.',
        health: 'Thân thể an khang, thai kỳ bình an thuận lợi.',
        family: 'Gia tộc có người nối dõi đức hạnh, dòng họ vẻ vang.'
      },
      meaning: 'Tâm nguyện cầu con cái và bình an gia đạo sắp được toại nguyện.',
      mindfulAdvice: 'Giữ tâm luôn hoan hỷ, nghe nhạc thiền, thường niệm Phật và làm việc thiện giúp đời để bồi đắp phúc đức gia môn.'
    },
    {
      category: 'family',
      title: 'Quẻ Cầu Tự: Đắp Bồi Cội Rễ',
      score: 'Dưỡng Đức Cầu Tự',
      sealText: 'CĂN LÀNH BỀN CHẶT',
      poem: 'Cây muốn xanh tươi gốc phải sâu\nTâm thành khấn nguyện chớ lo âu\nThả cá phóng sinh bồi phước báu\nCành vàng trổ lá đón duyên đầu.',
      aspects: {
        wealth: 'Tiết kiệm tài chính chuẩn bị chu đáo cho thế hệ tương lai.',
        career: 'Công việc ổn định, tạo nền tảng vững chắc cho mái ấm.',
        love: 'Vợ chồng thông cảm, san sẻ áp lực tâm lý với nhau.',
        health: 'Bồi bổ thân thể, kết hợp nghỉ ngơi tĩnh tâm.',
        family: 'Hiếu kính với cha mẹ hai bên để tăng thêm phước báo tổ tiên.'
      },
      meaning: 'Cần thời gian bồi bổ cả về sức khỏe lẫn phước đức, tránh căng thẳng âu lo.',
      mindfulAdvice: 'Hãy cùng nhau làm việc thiện, chăm sóc sức khỏe khoa học; tâm an thì mầm sống thiện lành tự nhiên đến.'
    }
  ],
  wealth: [
    {
      category: 'wealth',
      title: 'Quẻ Tiền Tài: Chiêu Tài Tấn Bảo - Lộc Phát Vô Cương',
      score: 'Đại Phú Đại Quý',
      sealText: 'KIM NGỌC MÃN ĐƯỜNG',
      poem: 'Thần Tài gõ cửa đón xuân sang\nTiền vô như nước ngập kho vàng\nBuôn may bán đắt nghìn khách quý\nPhúc đức lưu danh rạng họ hàng.',
      aspects: {
        wealth: 'Đầu tư sinh lời tốt, kinh doanh phát đạt, dòng tiền dồi dào.',
        career: 'Ký kết hợp đồng lớn, đối tác tin cậy, vị thế vững chắc.',
        love: 'Tài chính vững vàng giúp đời sống tình cảm thêm phần an tâm.',
        health: 'Chú ý nghỉ ngơi điều độ, không tham công tiếc việc quá sức.',
        family: 'Gia đình sung túc, hưng vượng.'
      },
      meaning: 'Vận may tài chính khởi sắc, những nỗ lực trước đây bắt đầu thu hoạch trái ngọt.',
      mindfulAdvice: 'Đồng tiền chân chính kiếm bằng mồ hôi và chữ Tín mới giữ được lâu bền. Hãy trích một phần giúp người khó khăn.'
    },
    {
      category: 'wealth',
      title: 'Quẻ Tiền Tài: Tích Tiểu Thành Đại - Vững Như Bàn Thạch',
      score: 'Tài Vận Ổn Định',
      sealText: 'BÌNH AN CHIÊU TÀI',
      poem: 'Gom từng hạt cát dựng thành non\nChớ hám làm giàu bước vội vàng\nCần kiệm liêm minh xây tổ ấm\nTài lộc trường tồn sánh giang sơn.',
      aspects: {
        wealth: 'Tiền bạc tích lũy đều đặn, tránh xa các cạm bẫy đầu cơ rủi ro.',
        career: 'Làm việc chuyên cần, được cấp trên và đồng nghiệp tin tưởng.',
        love: 'Chi tiêu điều độ, cùng nhau tích lũy xây dựng tương lai.',
        health: 'Ăn uống lành mạnh, sức khỏe dẻo dai.',
        family: 'Không khí gia đình ấm cúng, hòa thuận.'
      },
      meaning: 'Tài vận đang ở thế tích lũy an toàn, bền vững.',
      mindfulAdvice: 'Biết đủ là giàu nhất. Giữ tâm chánh niệm sẽ tránh được muôn vàn cạm bẫy tài chính.'
    }
  ],
  health: [
    {
      category: 'health',
      title: 'Quẻ Sức Khỏe: Dược Sư Quán Chiếu - Tiêu Tai Diên Thọ',
      score: 'Thân Khang Kiện Tráng',
      sealText: 'LƯU LY QUANG MINH',
      poem: 'Dược Sư Lưu Ly tỏa sắc xanh\nThân tâm thanh tịnh dứt phiền quanh\nKhí huyết điều hòa tươi sắc mặt\nTrường thọ an nhiên phúc tốt lành.',
      aspects: {
        wealth: 'Thân thể khỏe mạnh chính là tài sản quý giá nhất.',
        career: 'Năng lượng tràn đầy, làm việc hiệu quả và minh mẫn.',
        love: 'Tâm trạng vui vẻ hòa ái, lan tỏa niềm an vui cho người thân.',
        health: 'Bệnh tật tiêu trừ, hồi phục nhanh chóng.',
        family: 'Cả nhà khỏe mạnh bình an.'
      },
      meaning: 'Năng lượng sinh học và sức đề kháng rất tốt, tinh thần minh mẫn.',
      mindfulAdvice: 'Hãy ăn uống thanh đạm, ngủ đủ giấc và tập thở chánh niệm mỗi ngày.'
    },
    {
      category: 'health',
      title: 'Quẻ Sức Khỏe: Điều Thân Dưỡng Tánh',
      score: 'Cần Tịnh Dưỡng Thân',
      sealText: 'DƯỠNG TÂM AN THỂ',
      poem: 'Thân như cỗ máy dãi dầu sương\nChớ để lao tâm nhọc dặm trường\nBuông xả lo toan về thở nhẹ\nSuối nguồn sinh lực ngát ngàn phương.',
      aspects: {
        wealth: 'Chi tiêu hợp lý cho sức khỏe và dinh dưỡng.',
        career: 'Cần cân bằng giữa công việc và nghỉ ngơi, tránh kiệt sức.',
        love: 'Đón nhận sự chăm sóc và động viên từ người thân.',
        health: 'Chú ý giấc ngủ và thư giãn thần kinh sau giờ làm việc.',
        family: 'Gia đình cùng nhau tập thiền, đi bộ hít thở khí trời.'
      },
      meaning: 'Cơ thể cần được nghỉ ngơi và tái tạo năng lượng sau chuỗi ngày làm việc căng thẳng.',
      mindfulAdvice: 'Thực hành thiền thở sâu 15 phút mỗi ngày; buông bỏ những muộn phiền không đáng có.'
    }
  ],
  star: [
    {
      category: 'star',
      title: 'Quẻ Dâng Sao: Bắc Đẩu Thất Tinh Hộ Mệnh',
      score: 'Hóa Hung Thành Cát',
      sealText: 'THẤT TINH HỘ MẠNG',
      poem: 'Thất Tinh Bắc Đẩu rạng cung trời\nHóa giải oan khiên độ vạn đời\nSao tốt chiếu soi đường sáng sủa\nTai qua nạn khỏi nở nụ cười.',
      aspects: {
        wealth: 'Tài sản được bảo toàn nguyên vẹn, hóa giải hao tài.',
        career: 'Vượt qua sóng gió thị phi, công việc ổn định.',
        love: 'Hiểu lầm được tháo gỡ, gia đạo thuận hòa.',
        health: 'Tai qua nạn khỏi, đi lại bình an.',
        family: 'Gia đạo bình an, đón nhận điềm lành.'
      },
      meaning: 'Mọi vận hạn ách tắc đều được hóa giải êm đẹp nhờ tâm đức tích lũy.',
      mindfulAdvice: 'Cách giải hạn tốt nhất chính là khởi tâm từ bi, làm việc thiện và nói lời hòa ái với mọi người.'
    },
    {
      category: 'star',
      title: 'Quẻ Dâng Sao: Tịnh Tâm Chuyển Hóa Niên Hạn',
      score: 'Tu Thân Giải Hạn',
      sealText: 'TÂM ĐỨC TIÊU TAI',
      poem: 'Hạn sao chỉ thử thách lòng người\nChớ sợ hung tinh chớ đổi dời\nGiữ miệng không gieo điều khẩu nghiệp\nTrời cao che chở suốt muôn nơi.',
      aspects: {
        wealth: 'Cẩn trọng tiền bạc, quản lý chi tiêu chặt chẽ.',
        career: 'Hạn chế tranh cãi nơi công sở, lấy chữ Hòa làm quý.',
        love: 'Lắng nghe và nhường nhịn để giữ gìn hòa khí gia đình.',
        health: 'Chú ý giữ ấm cơ thể và đi lại cẩn thận.',
        family: 'Thường xuyên cầu an, vun bồi phúc đức gia tiên.'
      },
      meaning: 'Gặp thử thách cần lấy chữ Nhẫn làm đầu, bình tĩnh thì mọi việc đều êm xuôi.',
      mindfulAdvice: 'Một câu nhịn chín câu lành. Khi tâm bình thì mọi sóng gió đều tự tan biến.'
    }
  ]
}

/* ============================================================================
 * 2. HÀM TIÊU MC NGUYÊN TỬ (`spend`) & SỔ CÁI BẤT BIẾN (`mc_ledger`)
 * ========================================================================== */

export interface SpendResult<TExtra = Record<string, unknown>> {
  ledgerId: number
  accountId: number
  spentMc: number
  balanceAfter: number
  reason: SpendReason
  refId: string
  idempotentReplay: boolean
  createdAt: number
  extra: TExtra
}

export interface SpendOptions<TExtra> {
  refType?: string
  metadata?: Record<string, unknown>
  /**
   * Callback chạy bên trong CÙNG transaction SQLite ngay sau khi đã trừ `mc_balance`
   * và ghi `mc_ledger`. Nếu callback ném lỗi, toàn bộ việc trừ MC cũng được ROLLBACK.
   */
  onSpent?: (conn: DatabaseSync, ctx: { ledgerId: number; balanceAfter: number; now: number }) => TExtra
  /**
   * Khi phát hiện request lặp lại (`idempotentReplay = true`), khôi phục dữ liệu `extra`
   * từ bản ghi đã lưu trước đó để trả về kết quả giống hệt lần đầu.
   */
  onReplay?: (conn: DatabaseSync, existingLedger: { id: number; balanceAfter: number; metadataJson: string | null; createdAt: number }) => TExtra
}

export function normalizeRequestId(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (s.length < 4 || s.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(s)) {
    apiError(400, 'invalid_request_id', 'Mã yêu cầu (requestId) không hợp lệ (cần 4-128 ký tự chữ/số)')
  }
  return s
}

/**
 * Hàm trung tâm duy nhất để tiêu MC coin trong toàn bộ hệ thống.
 * - Chạy nguyên tử trong `withTransaction` (`BEGIN IMMEDIATE`).
 * - Kiểm tra idempotency theo `(reason, refId)`: gửi trùng không bao giờ trừ tiền lần 2.
 * - Cập nhật có điều kiện `WHERE id = ? AND mc_balance >= ?` chống số dư âm kể cả khi đua luồng.
 */
export function spend<TExtra = Record<string, unknown>>(
  accountId: number,
  amount: number,
  reason: SpendReason,
  refId: string,
  opts?: SpendOptions<TExtra>
): SpendResult<TExtra> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    apiError(400, 'invalid_amount', 'Số lượng MC cần tiêu phải là số nguyên dương')
  }
  const cleanRefId = normalizeRequestId(refId)
  const refType = opts?.refType || reason

  const result = withTransaction(conn => {
    // 1. Kiểm tra Idempotency trong mc_ledger theo UNIQUE(reason, ref_id)
    const existing = conn
      .prepare(
        `SELECT id, account_id, delta_mc, balance_after, metadata_json, created_at
           FROM mc_ledger
          WHERE reason = ? AND ref_id = ?`
      )
      .get(reason, cleanRefId) as
      | {
        id: number
        account_id: number
        delta_mc: number
        balance_after: number
        metadata_json: string | null
        created_at: number
      }
      | undefined

    if (existing) {
      if (existing.account_id !== accountId) {
        apiError(409, 'request_id_conflict', 'Mã requestId đã được sử dụng bởi một giao dịch khác')
      }
      // Lấy số dư hiện tại của tài khoản
      const acc = conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId) as { mc_balance: number } | undefined
      const currentBalance = acc ? acc.mc_balance : existing.balance_after
      const extra = opts?.onReplay
        ? opts.onReplay(conn, {
          id: existing.id,
          balanceAfter: currentBalance,
          metadataJson: existing.metadata_json,
          createdAt: existing.created_at
        })
        : ((existing.metadata_json ? JSON.parse(existing.metadata_json) : {}) as TExtra)

      return {
        ledgerId: existing.id,
        accountId,
        spentMc: Math.abs(existing.delta_mc),
        balanceAfter: currentBalance,
        reason,
        refId: cleanRefId,
        idempotentReplay: true,
        createdAt: existing.created_at,
        extra
      }
    }

    // 2. Trừ số dư có điều kiện nguyên tử: chỉ trừ khi mc_balance >= amount
    const upd = conn
      .prepare(
        `UPDATE accounts
            SET mc_balance = mc_balance - ?
          WHERE id = ? AND mc_balance >= ?`
      )
      .run(amount, accountId, amount)

    if (Number(upd.changes) === 0) {
      const row = conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId) as { mc_balance: number } | undefined
      if (!row) {
        apiError(404, 'account_not_found', 'Không tìm thấy tài khoản người chơi')
      }
      apiError(
        400,
        'insufficient_mc_balance',
        `Số dư MC không đủ (hiện có ${row.mc_balance.toLocaleString()} MC, cần ${amount.toLocaleString()} MC). Vui lòng nạp thêm MC!`
      )
    }

    const afterRow = conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId) as { mc_balance: number }
    const balanceAfter = afterRow.mc_balance
    const now = Date.now()

    // 3. Ghi bút toán âm (-amount) vào sổ cái bất biến mc_ledger
    const ins = conn
      .prepare(
        `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        accountId,
        -amount,
        balanceAfter,
        reason,
        refType,
        cleanRefId,
        opts?.metadata ? JSON.stringify(opts.metadata) : null,
        now
      )

    const ledgerId = Number(ins.lastInsertRowid)
    const extra = opts?.onSpent
      ? opts.onSpent(conn, { ledgerId, balanceAfter, now })
      : ({} as TExtra)

    return {
      ledgerId,
      accountId,
      spentMc: amount,
      balanceAfter,
      reason,
      refId: cleanRefId,
      idempotentReplay: false,
      createdAt: now,
      extra
    }
  })

  // Hybrid Hydra L2: SAU KHI SQLite đã commit, phản chiếu bút toán lên Hydra Head (không chặn, không ném lỗi).
  if (!result.idempotentReplay) void scheduleHydraRecord(result.ledgerId)
  return result
}

export interface CreditResult {
  ledgerId: number
  accountId: number
  creditedMc: number
  balanceAfter: number
  reason: string
  refId: string
  idempotentReplay: boolean
  createdAt: number
}

/**
 * Cộng MC nguyên tử (ví dụ `meditation_reward`): cập nhật `accounts.mc_balance` + ghi `mc_ledger` dương trong
 * CÙNG một transaction, idempotent theo UNIQUE(reason, ref_id). Sau commit, bút toán được phản chiếu lên Hydra L2.
 */
export function credit(
  accountId: number,
  amount: number,
  reason: string,
  opts: { refType?: string; refId: string; metadata?: Record<string, unknown> }
): CreditResult {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    apiError(400, 'invalid_amount', 'Số lượng MC cần cộng phải là số nguyên dương')
  }
  const refId = normalizeRequestId(opts.refId)
  const result = withTransaction((conn): CreditResult => {
    const existing = conn
      .prepare('SELECT id, account_id, delta_mc, balance_after, created_at FROM mc_ledger WHERE reason = ? AND ref_id = ?')
      .get(reason, refId) as { id: number; account_id: number; delta_mc: number; balance_after: number; created_at: number } | undefined
    if (existing) {
      if (existing.account_id !== accountId) {
        apiError(409, 'request_id_conflict', 'Mã tham chiếu đã được sử dụng bởi một giao dịch khác')
      }
      return {
        ledgerId: existing.id,
        accountId,
        creditedMc: Math.abs(existing.delta_mc),
        balanceAfter: existing.balance_after,
        reason,
        refId,
        idempotentReplay: true,
        createdAt: existing.created_at
      }
    }
    const upd = conn.prepare('UPDATE accounts SET mc_balance = mc_balance + ? WHERE id = ?').run(amount, accountId)
    if (Number(upd.changes) === 0) apiError(404, 'account_not_found', 'Không tìm thấy tài khoản người chơi')
    const row = conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId) as { mc_balance: number }
    const now = Date.now()
    const ins = conn
      .prepare(
        `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(accountId, amount, row.mc_balance, reason, opts.refType || reason, refId, opts.metadata ? JSON.stringify(opts.metadata) : null, now)
    return {
      ledgerId: Number(ins.lastInsertRowid),
      accountId,
      creditedMc: amount,
      balanceAfter: row.mc_balance,
      reason,
      refId,
      idempotentReplay: false,
      createdAt: now
    }
  })
  if (!result.idempotentReplay) void scheduleHydraRecord(result.ledgerId)
  return result
}

/* ============================================================================
 * 2b. TỌA THIỀN NHẬN MC (MEDITATE-TO-EARN) — server giữ đồng hồ & hạn mức ngày
 * ========================================================================== */

export interface MeditationPlan {
  durationMin: number
  durationSec: number
  rewardMc: number
}

/** Gói thời lượng & phần thưởng cố định ở server (client không được tự quyết định số MC). */
export const MEDITATION_PLANS: readonly MeditationPlan[] = [
  { durationMin: 3, durationSec: 180, rewardMc: 15 },
  { durationMin: 5, durationSec: 300, rewardMc: 30 },
  { durationMin: 15, durationSec: 900, rewardMc: 80 },
  { durationMin: 30, durationSec: 1800, rewardMc: 150 }
]

/** Trần MC nhận từ tọa thiền mỗi ngày (giờ Việt Nam UTC+7) cho mỗi tài khoản. */
export const DAILY_MEDITATION_CAP_MC = 200
/** Dung sai trễ mạng khi kiểm tra đủ thời gian (giây). */
const MEDITATION_EARLY_TOLERANCE_SEC = 3
/** Sau khi hết giờ, chỗ ngồi vẫn được giữ thêm một khoảng ngắn để client kịp gọi hoàn thành. */
const MEDITATION_SLOT_GRACE_MS = 60_000

function getVietnamDayKey(now = Date.now()): string {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

function getMeditationEarnedToday(conn: DatabaseSync, accountId: number, dayKey: string): number {
  const row = conn
    .prepare(
      `SELECT COALESCE(SUM(credited_mc), 0) AS total
         FROM meditation_sessions
        WHERE account_id = ? AND day_key = ? AND status = 'completed'`
    )
    .get(accountId, dayKey) as { total: number }
  return Number(row.total || 0)
}

/** Các mã bồ đoàn đang có phiên thiền còn hiệu lực (của bất kỳ tài khoản nào), tùy chọn loại trừ một tài khoản. */
function getMeditationOccupiedSlotIds(conn: DatabaseSync, now: number, excludeAccountId?: number): number[] {
  const rows = conn
    .prepare(
      `SELECT slot_id, account_id, started_at, duration_sec
         FROM meditation_sessions
        WHERE status = 'active' AND slot_id IS NOT NULL`
    )
    .all() as Array<{ slot_id: number; account_id: number; started_at: number; duration_sec: number }>
  const ids = new Set<number>()
  for (const r of rows) {
    if (excludeAccountId !== undefined && r.account_id === excludeAccountId) continue
    if (now <= r.started_at + r.duration_sec * 1000 + MEDITATION_SLOT_GRACE_MS) ids.add(Number(r.slot_id))
  }
  return Array.from(ids).sort((a, b) => a - b)
}

export function getMeditationStatus(accountId: number | null) {
  const conn = getDb()
  const now = Date.now()
  const dayKey = getVietnamDayKey(now)
  const dailyEarnedMc = accountId ? getMeditationEarnedToday(conn, accountId, dayKey) : 0
  return {
    plans: MEDITATION_PLANS,
    dailyCapMc: DAILY_MEDITATION_CAP_MC,
    dailyEarnedMc,
    remainingDailyMc: Math.max(0, DAILY_MEDITATION_CAP_MC - dailyEarnedMc),
    occupiedSlotIds: getMeditationOccupiedSlotIds(conn, now),
    totalSlots: HallLayout.getTotalSlotCount()
  }
}

export function startMeditationSession(accountId: number, durationMinRaw: unknown, slotIdRaw?: unknown) {
  const durationMin = Number(durationMinRaw)
  const plan = MEDITATION_PLANS.find(p => p.durationMin === durationMin)
  if (!plan) {
    apiError(400, 'invalid_duration', 'Thời lượng tọa thiền không hợp lệ (chỉ nhận 3, 5, 15 hoặc 30 phút)')
  }

  let slotId: number | null = null
  if (slotIdRaw !== undefined && slotIdRaw !== null && slotIdRaw !== '') {
    const n = Number(slotIdRaw)
    if (!Number.isInteger(n) || n < 0 || n >= HallLayout.getTotalSlotCount()) {
      apiError(400, 'invalid_slot', 'Mã bồ đoàn không hợp lệ')
    }
    slotId = n
  }

  return withTransaction(conn => {
    const now = Date.now()
    // Một tài khoản chỉ có một phiên đang chạy: phiên cũ bị hủy (đồng thời nhả chỗ ngồi cũ).
    conn
      .prepare(`UPDATE meditation_sessions SET status = 'cancelled', completed_at = ? WHERE account_id = ? AND status = 'active'`)
      .run(now, accountId)

    if (slotId !== null && getMeditationOccupiedSlotIds(conn, now, accountId).includes(slotId)) {
      apiError(409, 'slot_taken', 'Bồ đoàn này vừa có đồng tu ngồi trước. Xin chọn chỗ khác.')
    }

    const dayKey = getVietnamDayKey(now)
    const earned = getMeditationEarnedToday(conn, accountId, dayKey)
    const sessionToken = `med_${randomBytes(12).toString('hex')}`
    conn
      .prepare(
        `INSERT INTO meditation_sessions
           (session_token, account_id, slot_id, duration_min, duration_sec, expected_reward_mc, status, day_key, started_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      )
      .run(sessionToken, accountId, slotId, plan.durationMin, plan.durationSec, plan.rewardMc, dayKey, now)

    return {
      sessionToken,
      slotId,
      durationMin: plan.durationMin,
      durationSec: plan.durationSec,
      rewardMc: plan.rewardMc,
      startedAt: now,
      targetEndAt: now + plan.durationSec * 1000,
      dailyCapMc: DAILY_MEDITATION_CAP_MC,
      dailyEarnedMc: earned,
      remainingDailyMc: Math.max(0, DAILY_MEDITATION_CAP_MC - earned)
    }
  })
}

interface MeditationSessionRow {
  id: number
  session_token: string
  account_id: number
  slot_id: number | null
  duration_min: number
  duration_sec: number
  expected_reward_mc: number
  credited_mc: number
  status: 'active' | 'completed' | 'cancelled'
  day_key: string
  started_at: number
  completed_at: number | null
  ledger_id: number | null
}

function loadMeditationSession(conn: DatabaseSync, accountId: number, sessionTokenRaw: unknown): MeditationSessionRow {
  const token = typeof sessionTokenRaw === 'string' ? sessionTokenRaw.trim() : ''
  if (token.length < 8 || token.length > 64 || !/^[a-zA-Z0-9_]+$/.test(token)) {
    apiError(400, 'invalid_session_token', 'Mã phiên thiền không hợp lệ')
  }
  const row = conn
    .prepare('SELECT * FROM meditation_sessions WHERE session_token = ? AND account_id = ?')
    .get(token, accountId) as unknown as MeditationSessionRow | undefined
  if (!row) apiError(404, 'session_not_found', 'Không tìm thấy phiên tọa thiền của bạn')
  return row
}

export function completeMeditationSession(accountId: number, sessionTokenRaw: unknown) {
  const conn = getDb()
  const row = loadMeditationSession(conn, accountId, sessionTokenRaw)
  const balanceOf = () =>
    (conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId) as { mc_balance: number }).mc_balance

  const buildResult = (creditedMc: number, ledgerId: number | null, idempotentReplay: boolean) => ({
    sessionToken: row.session_token,
    durationMin: row.duration_min,
    expectedRewardMc: row.expected_reward_mc,
    creditedMc,
    dailyCapReached: creditedMc < row.expected_reward_mc,
    ledgerId,
    mcBalance: balanceOf(),
    dailyEarnedMc: getMeditationEarnedToday(conn, accountId, row.day_key),
    dailyCapMc: DAILY_MEDITATION_CAP_MC,
    idempotentReplay
  })

  if (row.status === 'completed') return buildResult(row.credited_mc, row.ledger_id, true)
  if (row.status === 'cancelled') {
    apiError(409, 'session_cancelled', 'Phiên tọa thiền này đã bị hủy nên không thể nhận thưởng')
  }

  const now = Date.now()
  const minElapsedMs = (row.duration_sec - MEDITATION_EARLY_TOLERANCE_SEC) * 1000
  const elapsedMs = now - row.started_at
  if (elapsedMs < minElapsedMs) {
    const remainSec = Math.ceil((row.duration_sec * 1000 - elapsedMs) / 1000)
    apiError(400, 'meditation_incomplete', `Chưa đủ thời gian tọa thiền, còn khoảng ${remainSec} giây nữa`)
  }

  // Nếu lần gọi trước đã ghi sổ cái nhưng chưa kịp đánh dấu hoàn thành (sự cố giữa chừng) thì dùng lại bút toán đó.
  const existingLedger = conn
    .prepare("SELECT id, delta_mc FROM mc_ledger WHERE reason = 'meditation_reward' AND ref_id = ?")
    .get(row.session_token) as { id: number; delta_mc: number } | undefined

  let creditedMc = 0
  let ledgerId: number | null = null
  if (existingLedger) {
    creditedMc = Number(existingLedger.delta_mc)
    ledgerId = existingLedger.id
  } else {
    const earned = getMeditationEarnedToday(conn, accountId, row.day_key)
    creditedMc = Math.min(row.expected_reward_mc, Math.max(0, DAILY_MEDITATION_CAP_MC - earned))
    if (creditedMc > 0) {
      const res = credit(accountId, creditedMc, 'meditation_reward', {
        refType: 'meditation',
        refId: row.session_token,
        metadata: { durationMin: row.duration_min, sessionToken: row.session_token, slotId: row.slot_id }
      })
      creditedMc = res.creditedMc
      ledgerId = res.ledgerId
    }
  }

  conn
    .prepare(
      `UPDATE meditation_sessions
          SET status = 'completed', credited_mc = ?, completed_at = ?, ledger_id = ?
        WHERE id = ? AND status = 'active'`
    )
    .run(creditedMc, now, ledgerId, row.id)

  return buildResult(creditedMc, ledgerId, false)
}

/** Xả thiền sớm: hủy phiên đang chạy (nhả chỗ ngồi), không nhận MC. */
export function cancelMeditationSession(accountId: number, sessionTokenRaw: unknown) {
  const conn = getDb()
  const row = loadMeditationSession(conn, accountId, sessionTokenRaw)
  if (row.status !== 'active') return { cancelled: false, status: row.status }
  conn
    .prepare(`UPDATE meditation_sessions SET status = 'cancelled', completed_at = ? WHERE id = ? AND status = 'active'`)
    .run(Date.now(), row.id)
  return { cancelled: true, status: 'cancelled' as const }
}

/* ============================================================================
 * 3. NGHIỆP VỤ CỬA HÀNG / DI SẢN, BÓI QUẺ & HÒM CÔNG ĐỨC
 * ========================================================================== */

export interface InventoryItemRecord {
  itemId: string
  category: ShopCategory
  quantity: number
  unlockedAt: number
}

export function getAccountInventory(accountId: number): InventoryItemRecord[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT item_id, category, quantity, unlocked_at
         FROM account_inventory
        WHERE account_id = ?
        ORDER BY unlocked_at DESC`
    )
    .all(accountId) as Array<{ item_id: string; category: ShopCategory; quantity: number; unlocked_at: number }>

  const map = new Map<string, InventoryItemRecord>()
  // Luôn bao gồm các vật phẩm mở khóa mặc định (priceMc = 0)
  for (const item of SHOP_CATALOG) {
    if (item.defaultUnlocked) {
      map.set(item.id, {
        itemId: item.id,
        category: item.category,
        quantity: 1,
        unlockedAt: 0
      })
    }
  }
  for (const r of rows) {
    map.set(r.item_id, {
      itemId: r.item_id,
      category: r.category,
      quantity: r.quantity,
      unlockedAt: r.unlocked_at
    })
  }
  return Array.from(map.values())
}

/**
 * Mua vật phẩm Cửa Hàng (Cổ phục 9 nước, Lễ vật & Nhang trầm) hoặc mở khóa Thẻ Bài Di Sản.
 * Giá luôn tra cứu từ `SHOP_CATALOG` phía server, bỏ qua mọi giá do client gửi lên.
 */
export function purchaseShopItem(accountId: number, itemId: string, requestId: string) {
  const cleanItemId = String(itemId || '').trim()
  const item = SHOP_CATALOG.find(i => i.id === cleanItemId)
  if (!item) {
    apiError(404, 'item_not_found', `Vật phẩm "${cleanItemId}" không tồn tại trong danh mục Cửa Hàng`)
  }
  if (item.defaultUnlocked || item.priceMc <= 0) {
    apiError(400, 'already_unlocked', `Vật phẩm "${item.name}" đã được mở khóa mặc định`)
  }

  const reason: SpendReason =
    item.category === 'attire'
      ? 'shop_buy_attire'
      : item.category === 'heritage_card'
        ? 'shop_unlock_card'
        : 'shop_buy_offering'

  // Trước khi trừ tiền (với vật phẩm không tiêu hao như cổ phục / thẻ bài): kiểm tra đã mở khóa chưa
  if (!item.consumable) {
    const db = getDb()
    // Nếu đây là replay của chính requestId đã mua thành công trước đó thì vẫn cho đi qua spend() để trả kết quả idempotent
    const isReplay = db
      .prepare('SELECT 1 FROM mc_ledger WHERE reason = ? AND ref_id = ? AND account_id = ?')
      .get(reason, normalizeRequestId(requestId), accountId)

    if (!isReplay) {
      const owned = db
        .prepare('SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = ?')
        .get(accountId, item.id) as { quantity: number } | undefined
      if (owned) {
        apiError(400, 'already_owned', `Bạn đã sở hữu "${item.name}" trong kho đồ rồi`)
      }
    }
  }

  return spend(accountId, item.priceMc, reason, requestId, {
    refType: item.category,
    metadata: { itemId: item.id, itemName: item.name, category: item.category, priceMc: item.priceMc },
    onSpent: (conn, { now }) => {
      conn
        .prepare(
          `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
           VALUES (?, ?, ?, 1, ?, ?)
           ON CONFLICT(account_id, item_id) DO UPDATE SET
             quantity = account_inventory.quantity + 1,
             updated_at = excluded.updated_at`
        )
        .run(accountId, item.id, item.category, now, now)

      const inv = conn
        .prepare('SELECT quantity, unlocked_at FROM account_inventory WHERE account_id = ? AND item_id = ?')
        .get(accountId, item.id) as { quantity: number; unlocked_at: number }

      return {
        item,
        quantity: inv.quantity,
        unlockedAt: inv.unlocked_at
      }
    },
    onReplay: (conn) => {
      const inv = conn
        .prepare('SELECT quantity, unlocked_at FROM account_inventory WHERE account_id = ? AND item_id = ?')
        .get(accountId, item.id) as { quantity: number; unlocked_at: number } | undefined
      return {
        item,
        quantity: inv?.quantity ?? 1,
        unlockedAt: inv?.unlocked_at ?? Date.now()
      }
    }
  })
}

function getStartOfVietnamDayMs(now = Date.now()): number {
  const vnOffsetMs = 7 * 3600 * 1000
  const vnNow = now + vnOffsetMs
  const startOfVnDay = Math.floor(vnNow / 86_400_000) * 86_400_000
  return startOfVnDay - vnOffsetMs
}

function getAccountDailyFreeUsedMap(conn: DatabaseSync, accountId: number, now = Date.now()): Record<string, number> {
  const startMs = getStartOfVietnamDayMs(now)
  const rows = conn
    .prepare(
      `SELECT category, COUNT(*) AS cnt
         FROM fortune_records
        WHERE account_id = ? AND created_at >= ? AND tier = 'free_daily'
        GROUP BY category`
    )
    .all(accountId, startMs) as Array<{ category: string; cnt: number }>

  const out: Record<string, number> = {
    stick: 0,
    love: 0,
    family: 0,
    wealth: 0,
    health: 0,
    star: 0
  }
  for (const r of rows) {
    out[r.category] = Number(r.cnt || 0)
  }
  return out
}

function loadRecentDrawsForAccount(conn: DatabaseSync, accountId: number, fallbackMon: string): RecentDrawRef[] {
  const recentRows = conn
    .prepare(
      `SELECT fortune_json
         FROM fortune_records
        WHERE account_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 3`
    )
    .all(accountId) as Array<{ fortune_json: string }>

  const recentDraws: RecentDrawRef[] = []
  for (const r of recentRows) {
    try {
      const parsed = JSON.parse(r.fortune_json)
      recentDraws.push({
        mon: parsed.mon || fallbackMon,
        muc: parsed.muc,
        thoId: parsed.blocks?.tho?.id || parsed.id,
        luangiaiId: parsed.blocks?.luangiai?.id,
        loikhuyenId: parsed.blocks?.loikhuyen?.id,
        hoagiaiId: parsed.blocks?.hoagiai?.id || null
      })
    } catch {
      // Bỏ qua bản ghi cũ
    }
  }
  return recentDraws
}

/**
 * Gieo quẻ Bói Quẻ & Cầu An 6 môn:
 * - Hỗ trợ 3 phương thức thanh toán lượt (`paymentMode`):
 *   1. `'free_daily'`: Miễn phí 1 lượt/môn/ngày (`0 MC`).
 *   2. `'offering_item'`: Dùng 1 vật phẩm Lễ Phẩm trong túi đồ (`incense_quang`, `lotus_lantern`...) để thêm lượt (`0 MC`).
 *   3. `'mc'` (mặc định): Tiêu MC theo `FORTUNE_TIERS[tier].costMc` (`10 / 50 / 100 MC`).
 * - Kết quả quẻ sinh bằng `FortuneEngine` (PRNG có seed nhất quán theo ngày + tránh trùng 3 lần gần nhất) trên server và lưu vào `fortune_records`.
 * - Gửi lặp cùng `requestId` trả về đúng quẻ đã gieo mà không trừ tiền/vật phẩm lần 2.
 */
export function drawFortuneWithMc(
  accountId: number,
  categoryRaw: string,
  tierRaw: string,
  requestId: string,
  boiOptions?: {
    mode?: InputMode
    questionId?: string
    customQuestion?: string
    profile?: PersonProfile | null
    partnerProfile?: PersonProfile | null
    dateStr?: string
    paymentMode?: 'free_daily' | 'offering_item' | 'mc'
    offeringItemId?: string
  }
) {
  const validCategories = new Set([
    'stick', 'love', 'family', 'wealth', 'health', 'star',
    'xin_xam', 'to_duyen', 'cau_tu', 'chieu_tai', 'duoc_su', 'dang_sao'
  ])
  const rawCatKey = String(categoryRaw || 'stick').trim().toLowerCase()
  if (!validCategories.has(rawCatKey)) {
    apiError(400, 'invalid_category', 'Môn bói quẻ không hợp lệ')
  }
  const mon = resolveMonId(rawCatKey)
  const category = resolveLegacyCategory(mon) as DivinationCategory

  const paymentMode = boiOptions?.paymentMode || 'mc'
  const cleanReqId = normalizeRequestId(requestId)

  // Trường hợp 1: Dùng lượt miễn phí mỗi ngày (1 lượt/môn/ngày) hoặc dùng Vật phẩm Lễ Phẩm
  if (paymentMode === 'free_daily' || paymentMode === 'offering_item') {
    return withTransaction((conn) => {
      const existingRec = conn
        .prepare('SELECT id, cost_mc, fortune_json, receipt_hash FROM fortune_records WHERE request_id = ? AND account_id = ?')
        .get(cleanReqId, accountId) as { id: number; cost_mc: number; fortune_json: string; receipt_hash: string } | undefined

      const accRow = conn
        .prepare('SELECT mc_balance FROM accounts WHERE id = ?')
        .get(accountId) as { mc_balance: number } | undefined
      const currentBalance = Number(accRow?.mc_balance || 0)

      if (existingRec) {
        return {
          idempotentReplay: true,
          ledgerId: existingRec.id,
          spentMc: existingRec.cost_mc,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance,
          extra: {
            fortune: JSON.parse(existingRec.fortune_json),
            receiptHash: existingRec.receipt_hash,
            paymentMode,
            inventory: getAccountInventory(accountId),
            dailyFreeUsedByCategory: getAccountDailyFreeUsedMap(conn, accountId)
          }
        }
      }

      const now = Date.now()
      let tierLabel = 'Lượt Miễn Phí Trong Ngày'
      let tierCode = 'free_daily'

      if (paymentMode === 'free_daily') {
        const usedMap = getAccountDailyFreeUsedMap(conn, accountId, now)
        if ((usedMap[category] || 0) >= 1) {
          apiError(
            400,
            'daily_free_exhausted',
            'Bạn đã dùng hết 1 lượt miễn phí hôm nay cho môn này. Hãy dùng Lễ Phẩm (Nhang Trầm / Hoa Đăng) hoặc MC Coin để thỉnh thêm lượt!'
          )
        }
      } else {
        const itemId = String(boiOptions?.offeringItemId || 'incense_quang').trim()
        const catalogItem = SHOP_CATALOG.find(i => i.id === itemId && i.category === 'offering')
        if (!catalogItem) {
          apiError(400, 'invalid_offering_item', 'Vật phẩm lễ phẩm không hợp lệ')
        }
        const decRes = conn
          .prepare(
            `UPDATE account_inventory
                SET quantity = quantity - 1, updated_at = ?
              WHERE account_id = ? AND item_id = ? AND quantity >= 1`
          )
          .run(now, accountId, itemId)
        if (Number(decRes.changes || 0) === 0) {
          apiError(
            400,
            'insufficient_offering_item',
            `Bạn không còn "${catalogItem.name}" trong túi đồ. Hãy thỉnh thêm ở Cửa Hàng hoặc dùng MC Coin!`
          )
        }
        tierLabel = `Dâng Lễ Phẩm (${catalogItem.name})`
        tierCode = `offering_${itemId}`
      }

      const recentDraws = loadRecentDrawsForAccount(conn, accountId, mon)
      const generated = generateFortune({
        mon,
        mode: boiOptions?.mode || 'quick',
        questionId: boiOptions?.questionId,
        customQuestion: boiOptions?.customQuestion,
        profile: boiOptions?.profile || null,
        partnerProfile: boiOptions?.partnerProfile || null,
        dateStr: boiOptions?.dateStr,
        recentDraws
      })

      const receiptHash = 'mc_fortune_' + createHash('sha256')
        .update(`${accountId}:${cleanReqId}:${tierCode}:${now}`)
        .digest('hex')
        .slice(0, 24)

      const fortunePayload = {
        id: generated.blocks.tho.id,
        ...generated,
        tier: tierCode,
        tierName: tierLabel,
        paymentMode,
        costMc: 0,
        receiptHash,
        createdAt: now
      }

      const ins = conn
        .prepare(
          `INSERT INTO fortune_records (account_id, request_id, category, tier, cost_mc, fortune_json, receipt_hash, created_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
        )
        .run(accountId, cleanReqId, category, tierCode, JSON.stringify(fortunePayload), receiptHash, now)

      return {
        idempotentReplay: false,
        ledgerId: Number(ins.lastInsertRowid || 0),
        spentMc: 0,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance,
        extra: {
          fortune: fortunePayload,
          receiptHash,
          paymentMode,
          inventory: getAccountInventory(accountId),
          dailyFreeUsedByCategory: getAccountDailyFreeUsedMap(conn, accountId, now)
        }
      }
    })
  }

  // Trường hợp 2: Tiêu MC Coin theo cấp độ (10 / 50 / 100 MC)
  const tier = String(tierRaw || 'auspicious').trim() as DivinationTier
  const tierCfg = FORTUNE_TIERS[tier]
  if (!tierCfg) {
    apiError(400, 'invalid_tier', 'Cấp độ thỉnh quẻ không hợp lệ')
  }

  return spend(accountId, tierCfg.costMc, 'fortune_divination', cleanReqId, {
    refType: 'fortune',
    metadata: { category, mon, tier, mode: boiOptions?.mode || 'quick', costMc: tierCfg.costMc },
    onSpent: (conn, { ledgerId, now }) => {
      const recentDraws = loadRecentDrawsForAccount(conn, accountId, mon)

      const generated = generateFortune({
        mon,
        mode: boiOptions?.mode || 'quick',
        questionId: boiOptions?.questionId,
        customQuestion: boiOptions?.customQuestion,
        profile: boiOptions?.profile || null,
        partnerProfile: boiOptions?.partnerProfile || null,
        dateStr: boiOptions?.dateStr,
        recentDraws
      })

      const receiptHash = 'mc_fortune_' + createHash('sha256')
        .update(`${accountId}:${cleanReqId}:${ledgerId}:${now}`)
        .digest('hex')
        .slice(0, 24)

      const fortunePayload = {
        id: generated.blocks.tho.id,
        ...generated,
        tier: tierCfg.id,
        tierName: tierCfg.name,
        paymentMode: 'mc',
        costMc: tierCfg.costMc,
        receiptHash,
        createdAt: now
      }

      conn
        .prepare(
          `INSERT INTO fortune_records (account_id, request_id, category, tier, cost_mc, fortune_json, receipt_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(accountId, cleanReqId, category, tier, tierCfg.costMc, JSON.stringify(fortunePayload), receiptHash, now)

      return {
        fortune: fortunePayload,
        receiptHash,
        paymentMode: 'mc',
        inventory: getAccountInventory(accountId),
        dailyFreeUsedByCategory: getAccountDailyFreeUsedMap(conn, accountId, now)
      }
    },
    onReplay: (conn) => {
      const rec = conn
        .prepare('SELECT fortune_json, receipt_hash FROM fortune_records WHERE request_id = ? AND account_id = ?')
        .get(cleanReqId, accountId) as { fortune_json: string; receipt_hash: string } | undefined
      if (!rec) {
        apiError(409, 'request_id_conflict', 'Không tìm thấy bản ghi quẻ tương ứng với requestId')
      }
      return {
        fortune: JSON.parse(rec.fortune_json),
        receiptHash: rec.receipt_hash,
        paymentMode: 'mc',
        inventory: getAccountInventory(accountId),
        dailyFreeUsedByCategory: getAccountDailyFreeUsedMap(conn, accountId)
      }
    }
  })
}

/**
 * Cúng dường Hòm Công Đức bằng MC:
 * - Số MC tùy chọn (nguyên dương, trong khoảng `MERIT_CONFIG.minMc .. MERIT_CONFIG.maxMc`).
 * - Cộng vào tổng công đức toàn chùa (`globalMeritTotal`), lưu bảng công đức (`merit_donations`).
 * - Nếu cúng dường `>= 500 MC`, tặng vật phẩm tri ân `lotus_lantern` (Hoa Đăng Cầu An) vào kho đồ.
 */
export function donateMeritWithMc(
  accountId: number,
  amountMc: number,
  prayerRaw: string,
  requestId: string
) {
  if (!Number.isSafeInteger(amountMc) || amountMc < MERIT_CONFIG.minMc || amountMc > MERIT_CONFIG.maxMc) {
    apiError(
      400,
      'invalid_merit_amount',
      `Số MC công đức phải là số nguyên từ ${MERIT_CONFIG.minMc.toLocaleString()} đến ${MERIT_CONFIG.maxMc.toLocaleString()} MC`
    )
  }
  const prayer = String(prayerRaw || 'Nguyện cầu gia đạo bình an, thân tâm thường lạc')
    .trim()
    .slice(0, 240) || 'Nguyện cầu gia đạo bình an, thân tâm thường lạc'

  const cleanReqId = normalizeRequestId(requestId)

  return spend(accountId, amountMc, 'merit_donation', cleanReqId, {
    refType: 'merit_box',
    metadata: { amountMc, prayer },
    onSpent: (conn, { ledgerId, now }) => {
      const receiptHash = 'mc_merit_' + createHash('sha256')
        .update(`${accountId}:${cleanReqId}:${ledgerId}:${now}`)
        .digest('hex')
        .slice(0, 24)

      let rewardItemId: string | null = null
      let rewardItemName: string | null = null
      if (amountMc >= 500) {
        rewardItemId = 'lotus_lantern'
        rewardItemName = 'Hoa Đăng Cầu An'
        conn
          .prepare(
            `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
             VALUES (?, 'lotus_lantern', 'offering', 1, ?, ?)
             ON CONFLICT(account_id, item_id) DO UPDATE SET
               quantity = account_inventory.quantity + 1,
               updated_at = excluded.updated_at`
          )
          .run(accountId, now, now)
      }

      conn
        .prepare(
          `INSERT INTO merit_donations (account_id, request_id, amount_mc, prayer, reward_item_id, receipt_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(accountId, cleanReqId, amountMc, prayer, rewardItemId, receiptHash, now)

      const totalRow = conn
        .prepare('SELECT COALESCE(SUM(amount_mc), 0) AS total FROM merit_donations')
        .get() as { total: number }

      return {
        amountMc,
        prayer,
        receiptHash,
        rewardItemId,
        rewardItemName,
        globalMeritTotal: Number(totalRow.total || 0),
        blessing: 'Nguyện đem công đức này, hồi hướng khắp tất cả, đệ tử và chúng sanh, đều trọn thành Phật đạo.'
      }
    },
    onReplay: (conn) => {
      const row = conn
        .prepare(
          `SELECT amount_mc, prayer, reward_item_id, receipt_hash
             FROM merit_donations
            WHERE request_id = ? AND account_id = ?`
        )
        .get(cleanReqId, accountId) as
        | { amount_mc: number; prayer: string; reward_item_id: string | null; receipt_hash: string }
        | undefined
      const totalRow = conn
        .prepare('SELECT COALESCE(SUM(amount_mc), 0) AS total FROM merit_donations')
        .get() as { total: number }
      return {
        amountMc: row?.amount_mc ?? amountMc,
        prayer: row?.prayer ?? prayer,
        receiptHash: row?.receipt_hash ?? '',
        rewardItemId: row?.reward_item_id ?? null,
        rewardItemName: row?.reward_item_id === 'lotus_lantern' ? 'Hoa Đăng Cầu An' : null,
        globalMeritTotal: Number(totalRow.total || 0),
        blessing: 'Nguyện đem công đức này, hồi hướng khắp tất cả, đệ tử và chúng sanh, đều trọn thành Phật đạo.'
      }
    }
  })
}

/** Lấy tổng công đức, bảng vàng công đức gần nhất, lịch sử quẻ và sổ cái biến động của tài khoản */
export function getMcOverviewAndHistory(accountId: number | null) {
  const db = getDb()
  const totalRow = db
    .prepare('SELECT COALESCE(SUM(amount_mc), 0) AS total, COUNT(*) AS count FROM merit_donations')
    .get() as { total: number; count: number }

  const leaderboard = db
    .prepare(
      `SELECT a.display_name AS displayName, a.address AS address,
              SUM(m.amount_mc) AS totalMc, COUNT(m.id) AS donationCount, MAX(m.created_at) AS lastAt
         FROM merit_donations m
         JOIN accounts a ON a.id = m.account_id
        GROUP BY m.account_id
        ORDER BY totalMc DESC, lastAt DESC
        LIMIT 10`
    )
    .all() as Array<{ displayName: string; address: string; totalMc: number; donationCount: number; lastAt: number }>

  const recentDonations = db
    .prepare(
      `SELECT m.id, a.display_name AS displayName, m.amount_mc AS amountMc, m.prayer,
              m.reward_item_id AS rewardItemId, m.receipt_hash AS receiptHash, m.created_at AS createdAt
         FROM merit_donations m
         JOIN accounts a ON a.id = m.account_id
        ORDER BY m.created_at DESC
        LIMIT 15`
    )
    .all()

  let inventory: InventoryItemRecord[] = []
  let fortuneHistory: Array<Record<string, unknown>> = []
  let ledgerHistory: Array<Record<string, unknown>> = []
  let dailyFreeUsedByCategory: Record<string, number> = {
    stick: 0,
    love: 0,
    family: 0,
    wealth: 0,
    health: 0,
    star: 0
  }

  if (accountId) {
    inventory = getAccountInventory(accountId)
    dailyFreeUsedByCategory = getAccountDailyFreeUsedMap(db, accountId)

    const fRows = db
      .prepare(
        `SELECT id, request_id AS requestId, category, tier, cost_mc AS costMc,
                fortune_json AS fortuneJson, receipt_hash AS receiptHash, created_at AS createdAt,
             (SELECT l.hydra_status FROM mc_ledger l WHERE l.reason = 'fortune_divination' AND l.ref_id = fortune_records.request_id LIMIT 1) AS hydraStatus,
             (SELECT l.hydra_tx_hash FROM mc_ledger l WHERE l.reason = 'fortune_divination' AND l.ref_id = fortune_records.request_id LIMIT 1) AS hydraTxHash,
             (SELECT l.hydra_snapshot_no FROM mc_ledger l WHERE l.reason = 'fortune_divination' AND l.ref_id = fortune_records.request_id LIMIT 1) AS hydraSnapshotNo
           FROM fortune_records
          WHERE account_id = ?
          ORDER BY created_at DESC
          LIMIT 30`
      )
      .all(accountId) as Array<{
        id: number
        requestId: string
        category: string
        tier: string
        costMc: number
        fortuneJson: string
        receiptHash: string
        createdAt: number
        hydraStatus: string | null
        hydraTxHash: string | null
        hydraSnapshotNo: number | null
      }>

    fortuneHistory = fRows.map(r => ({
      id: r.id,
      requestId: r.requestId,
      category: r.category,
      tier: r.tier,
      costMc: r.costMc,
      receiptHash: r.receiptHash,
      createdAt: r.createdAt,
      // Lượt miễn phí (0 MC) không tạo bút toán nên không có trạng thái sổ cái để hiển thị.
      hydra: (r.hydraStatus || r.costMc > 0)
        ? {
          enabled: true,
          status: r.hydraStatus || 'offchain',
          txHash: r.hydraTxHash || null,
          snapshotNo: r.hydraSnapshotNo ?? null
        }
        : null,
      fortune: JSON.parse(r.fortuneJson)
    }))

    ledgerHistory = db
      .prepare(
        `SELECT id, delta_mc AS deltaMc, balance_after AS balanceAfter, reason, ref_type AS refType,
                ref_id AS refId, tx_hash AS txHash, metadata_json AS metadataJson, created_at AS createdAt,
                hydra_tx_hash AS hydraTxHash, hydra_snapshot_no AS hydraSnapshotNo, hydra_status AS hydraStatus
           FROM mc_ledger
          WHERE account_id = ?
          ORDER BY id DESC
          LIMIT 50`
      )
      .all(accountId) as Array<Record<string, unknown>>
  } else {
    // Khách chưa đăng nhập vẫn thấy các vật phẩm mở khóa mặc định
    inventory = SHOP_CATALOG.filter(i => i.defaultUnlocked).map(i => ({
      itemId: i.id,
      category: i.category,
      quantity: 1,
      unlockedAt: 0
    }))
  }

  return {
    services: MC_SERVICES_CONFIG,
    shopCatalog: SHOP_CATALOG,
    fortuneTiers: FORTUNE_TIERS,
    meritConfig: MERIT_CONFIG,
    globalMeritTotal: Number(totalRow.total || 0),
    globalDonationCount: Number(totalRow.count || 0),
    leaderboard,
    recentDonations,
    inventory,
    fortuneHistory,
    ledgerHistory,
    dailyFreeUsedByCategory,
    meditation: getMeditationStatus(accountId)
  }
}

