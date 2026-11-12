// copy.ts - Nguồn chuỗi hiển thị duy nhất cho giao diện (Giai đoạn 4, bước 4.5).
// Sửa chữ ở đây, không sửa rải rác trong component. Dễ thêm tiếng Anh sau này bằng cách
// tách thành COPY_VI / COPY_EN và chọn theo locale.
//
// Ngân sách chữ (kiểm bằng scripts/verify-copy-budget.mjs, tiền tố khóa quyết định giới hạn):
//   btn.*   <= 3 từ     title.* <= 3 từ     toast.* <= 6 từ     tip.* / desc.* <= 12 từ
// Chỗ giữ chỗ {tên} tính là 1 từ.
//
// Thuật ngữ thống nhất (xem docs/ra_soat/06_ke_hoach_giam_chu.md):
//   MC = điểm công đức trong game | công đức = hành động quyên góp | hòm công đức
//   quẻ = kết quả bói | gieo quẻ = hành động bói | bồ đoàn = chỗ ngồi thiền

export const COPY = {
  // ---- Nút (<= 3 từ, động từ ngắn) ----
  'btn.walkToAbbot': 'Lại gần thầy',
  'btn.understood': 'Đã hiểu',
  'btn.bow': 'Chắp tay',
  'btn.bowDone': 'Đã khánh hỷ',
  'btn.claimLoc': 'Thỉnh lộc',
  'btn.claimed': 'Đã nhận lộc',
  'btn.details': 'Chi tiết',
  'btn.walkToHauDong': 'Tới điện',
  'btn.hdLive': 'Đàn đang mở',
  'btn.hdOpen': 'Mở đàn',
  'btn.hdPool': 'Góp Bách Gia',
  'btn.confirm': 'Xác nhận',
  'btn.cancel': 'Hủy',
  'btn.back': 'Quay lại',
  'btn.processing': 'Đang xử lý...',
  'btn.endMeditation': 'Kết thúc',
  'btn.startMeditation': 'Ngồi thiền',
  'btn.remedyMeditate': 'Tọa thiền',
  'btn.guideToDesk': 'Đến bàn xăm',
  'btn.guideToMerit': 'Đến hòm',
  'btn.guideToHall': 'Vào Chánh Điện',
  'btn.saveProfile': 'Lưu hồ sơ',
  'btn.coupleDesk': 'Đài Tơ Duyên',
  'btn.saveShare': 'Lưu ảnh quẻ',
  'btn.drawAgain': 'Xin lại',
  'btn.rolling': 'Đang lắc...',
  'btn.drawFree': 'Gieo quẻ',
  'btn.drawOffering': 'Dâng lễ vật',
  'btn.drawPaid': 'Gieo {mc} MC',
  'btn.downloadPng': 'Tải ảnh',
  'btn.tabAttire': 'Cổ phục',
  'btn.tabOfferings': 'Lễ vật',
  'btn.resetDefault': 'Mặc định',
  'btn.refreshWallet': 'Làm mới ví',
  'btn.newTopup': 'Nạp tiếp',
  'btn.legal': 'Pháp lý',
  'btn.presetMinimal': 'Tối giản',
  'btn.presetRain': 'Đêm mưa',
  'btn.presetBamboo': 'Rừng trúc',
  'btn.presetVajra': 'Mật tông',
  'btn.more': 'Xem thêm',
  'btn.topupConfirm': 'Nạp {mc} MC',
  'btn.donate': 'Cúng dường',

  // ---- Tiêu đề màn / drawer (<= 3 từ) ----
  'title.appName': 'Vạn Cảnh Chùa',
  'title.cardReveal': 'Khai quang thẻ',
  'title.profileNew': 'Khai hồ sơ',
  'title.profileEdit': 'Sửa hồ sơ',
  'title.pickCategory': 'Chọn môn',
  'title.pickMethod': 'Cách thỉnh',
  'title.interpret': 'Luận giải',
  'title.advice': 'Lời khuyên',
  'title.remedy': 'Hóa giải',
  'title.merit': 'Cúng dường',
  'title.meritTotal': 'Tổng công đức',
  'title.leaderboard': 'Bảng vàng',
  'title.meditation': 'Tọa thiền 432Hz',
  'title.soundscape': 'Âm cảnh',
  'title.chat': 'Pháp đàm',
  'title.pilgrims': 'Đồng tu',
  'title.hdRest': 'Tịnh đàn',
  'title.hdSponsor': 'Mở đàn riêng',
  'title.hdCrowd': 'Quỹ Bách Gia',
  'title.legal': 'Pháp lý',

  // ---- Mô tả mặc định (<= 12 từ, 1 câu) ----
  'desc.appTagline': 'Chùa 3D và bói quẻ',
  'desc.cardReveal': 'Chạm thẻ để lật',
  'desc.hdInside': 'Chắp tay, đợi giá thứ 5 để thỉnh lộc.',
  'desc.hdOutside': 'Sang Điện Thờ Tứ Phủ bên phải sân chùa.',
  'desc.hdConfirmSingle': 'Chia quỹ lộc, tu bổ, đại lễ. Tên bạn lên Thư Vàng.',
  'desc.hdConfirmPool': 'Cộng dồn vào Quỹ Bách Gia. Đủ 2,500 MC tự khai đàn.',
  'desc.hdRest': 'Hầu Đồng diễn ra 11:00 mỗi ngày, hoặc mở đàn riêng.',
  'desc.hdSponsor': 'Một buổi hầu 8 phút, tên khắc Thư Vàng.',
  'desc.hdCrowd': 'Cùng góp, đủ 2,500 MC tự khai đàn.',
  'desc.profileNeeded': 'Cần hồ sơ để mở khóa gieo quẻ.',
  'desc.birthHourUnknown': 'Không rõ giờ sinh: bỏ trống Can Chi giờ.',
  'desc.genderWhy': 'Dùng tính Cung Phi và Sao chiếu mệnh.',
  'desc.privacy': 'Dữ liệu chỉ lưu trên thiết bị, không lên chuỗi.',
  'desc.loveSingle': 'Xem vận đào hoa theo Bát Tự của bạn.',
  'desc.mcNote': 'MC là điểm trong game, không đổi ra ADA.',
  'desc.coupleIntro': 'Thắt chỉ hồng, gieo quẻ Bát Tự đôi lứa.',
  'desc.coupleAdvice': 'Cùng thấu hiểu và bao dung để duyên tròn đầy.',
  'desc.meritIntro': 'Ghi sổ vàng, chia quỹ hương trầm và duy tu.',
  'desc.meritLedger': 'Công đức ghi sổ cái, chia cho duy tu và hoa đăng.',
  'desc.leaderboardEmpty': 'Người đầu tiên cúng dường sẽ lưu danh.',
  'desc.gachaIntro': 'Mở gói thỉnh thẻ di sản, ghi nhận trên Hydra L2.',
  'desc.meditationIntro': 'Chuông Tây Tạng và nhịp thở 4-4-6 đưa tâm về chánh niệm.',
  'desc.meditationOutside': 'Vào trong Đại Hùng Bảo Điện để tìm bồ đoàn.',
  'desc.meditationFull': 'Mọi bồ đoàn đã có người. Chờ hoặc quay lại sau.',
  'desc.soundscape': 'Chỉnh âm lượng từng nguồn để tìm bình yên.',
  'desc.chat': 'Gõ lời nhắn hoặc chọn câu niệm gửi đồng tu.',
  'desc.chatEmpty': 'Chưa có lời nguyện nào.',
  'desc.walletIframe': 'Bấm Kết nối ở thanh menu HydraOne để đăng nhập.',
  'desc.walletConnect': 'Chọn ví Cardano. Ký CIP-8 miễn phí, không giao dịch on-chain.',
  'desc.walletTopup': 'MC cộng tự động khi giao dịch đủ xác nhận.',
  'desc.abbotNote': 'NPC văn hóa, nội dung tham khảo, không bói toán.',
  'desc.prayerHint': 'Nhập lời cầu nguyện cho bạn và gia quyến.',
  'desc.hideBirth': 'Ẩn ngày sinh khi xuất ảnh.',
  'desc.charmReceived': 'Đã cất vào túi đồ.',
  'desc.altHint': 'Giữ ALT để hiện con trỏ.',
  'desc.nonCustodial': 'Không giữ khóa riêng, không tự chuyển tiền.',

  // ---- Chú giải ngắn (<= 12 từ) ----
  'tip.coupleHint': 'Hai người, so khớp Bát Tự',
  'tip.mcHeld': 'Số dư MC của bạn',

  // ---- Toast / thông báo (<= 6 từ) ----
  'toast.mcGain': '+{mc} MC',
  'toast.dailyCap': 'Đủ rồi hôm nay',
  'toast.needHall': 'Vào Chánh Điện trước',
  'toast.needWallet': 'Kết nối ví để tiếp tục',
  'toast.noFunds': 'Không đủ MC',
  'toast.retry': 'Thử lại sau giây lát'
} as const

export type CopyKey = keyof typeof COPY

/** Lấy chuỗi theo khóa, thay {tên} bằng giá trị. Khóa lạ trả về chính khóa để dễ phát hiện. */
export function t(key: CopyKey, vars?: Record<string, string | number>): string {
  let s: string = COPY[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}
