<script setup lang="ts">
const props = defineProps<{
  cardId: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}>()

const glowColor = computed(() => {
  switch (props.rarity) {
    case 'legendary': return '#c9a24b'
    case 'epic': return '#c084fc'
    case 'rare': return '#38bdf8'
    default: return '#94a3b8'
  }
})
</script>

<template>
  <div class="w-full h-full relative overflow-hidden flex items-center justify-center rounded bg-[#14120f]">
    <!-- Hào quang nền sau lưng -->
    <div
      class="absolute inset-0 opacity-25 blur-md pointer-events-none transition-opacity"
      :style="{ background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)` }"
    />

    <!-- HỌA TIẾT NGHỆ THUẬT VECTOR CHO TỪNG THẺ DI SẢN -->

    <!-- 1. Chùa Một Cột (Đóa Sen Vươn Lên Từ Nước) -->
    <svg v-if="cardId === 'card_vn_motcot'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-gold">
      <!-- Hồ sen & Gợn sóng -->
      <path d="M15 82 Q 50 88 85 82" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6" />
      <path d="M25 88 Q 50 94 75 88" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.4" />
      <!-- Cột đá -->
      <rect x="46" y="52" width="8" height="30" fill="currentColor" opacity="0.85" rx="1" />
      <!-- Bệ sen đỡ chùa -->
      <path d="M38 52 C 38 52, 44 46, 50 46 C 56 46, 62 52, 62 52 Z" fill="currentColor" />
      <!-- Mái chùa cong ngàn năm -->
      <path d="M26 44 Q 50 34 74 44 L 68 36 Q 50 28 32 36 Z" fill="currentColor" />
      <path d="M36 36 L 50 20 L 64 36 Z" fill="currentColor" opacity="0.9" />
      <!-- Đỉnh hoa sen nóc chùa -->
      <circle cx="50" cy="18" r="3" fill="#c9a24b" />
      <!-- Hào quang mặt trời -->
      <circle cx="50" cy="18" r="12" stroke="#c9a24b" stroke-width="1" stroke-dasharray="2 2" fill="none" opacity="0.5" />
    </svg>

    <!-- 2. Cư Trần Lạc Đạo Phú (Trúc Lâm Yên Tử) -->
    <svg v-else-if="cardId === 'card_vn_truclam'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-gold">
      <!-- Đỉnh núi mây ngàn Yên Tử -->
      <path d="M10 85 L 35 45 L 60 75 L 85 35 L 95 85 Z" fill="currentColor" opacity="0.25" />
      <path d="M20 85 L 50 30 L 80 85 Z" fill="currentColor" opacity="0.5" />
      <!-- Rừng trúc thiền trượng -->
      <line x1="28" y1="35" x2="28" y2="85" stroke="currentColor" stroke-width="2" />
      <line x1="34" y1="45" x2="34" y2="85" stroke="currentColor" stroke-width="1.5" />
      <line x1="72" y1="40" x2="72" y2="85" stroke="currentColor" stroke-width="2" />
      <!-- Trăng thiền viên mãn -->
      <circle cx="50" cy="24" r="10" fill="none" stroke="#c9a24b" stroke-width="2" />
      <circle cx="50" cy="24" r="7" fill="#c9a24b" opacity="0.4" />
    </svg>

    <!-- 3. Chùa Keo Thái Bình (Gác Chuông Mộng Gỗ) -->
    <svg v-else-if="cardId === 'card_vn_keo'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-purple-300">
      <!-- 3 Tầng mái ngói đao cong -->
      <path d="M34 32 Q 50 24 66 32 L 62 26 Q 50 20 38 26 Z" fill="currentColor" />
      <path d="M28 50 Q 50 40 72 50 L 66 44 Q 50 36 34 44 Z" fill="currentColor" opacity="0.85" />
      <path d="M20 70 Q 50 58 80 70 L 74 62 Q 50 52 26 62 Z" fill="currentColor" opacity="0.7" />
      <!-- Khung cột gỗ mộng mị -->
      <rect x="44" y="32" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" />
      <rect x="40" y="50" width="20" height="12" fill="none" stroke="currentColor" stroke-width="1.5" />
      <rect x="36" y="70" width="28" height="16" fill="none" stroke="currentColor" stroke-width="2" />
      <!-- Chuông đồng cổ treo giữa gác -->
      <path d="M47 38 C 47 36, 53 36, 53 38 L 54 44 L 46 44 Z" fill="#c9a24b" />
    </svg>

    <!-- 4. Bát Nhã Tâm Kinh (Ấn Chú Trí Huệ) -->
    <svg v-else-if="cardId === 'card_vn_batnha'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-sky-300">
      <!-- Vòng tròn trí tuệ Bát Nhã -->
      <circle cx="50" cy="50" r="32" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="3 3" opacity="0.6" />
      <circle cx="50" cy="50" r="24" stroke="currentColor" stroke-width="2" fill="none" opacity="0.8" />
      <!-- Chữ Vạn Phật Giáo ở tâm -->
      <path d="M42 42 L 50 42 L 50 58 L 42 58 M50 50 L 58 50 L 58 38 M50 50 L 38 50 L 38 62 M50 50 L 50 38" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <!-- 4 Đóa Sen 4 Phương -->
      <circle cx="50" cy="18" r="3" fill="#c9a24b" />
      <circle cx="50" cy="82" r="3" fill="#c9a24b" />
      <circle cx="18" cy="50" r="3" fill="#c9a24b" />
      <circle cx="82" cy="50" r="3" fill="#c9a24b" />
    </svg>

    <!-- 5. Chùa Hương Tích (Đệ Nhất Động Non Nước) -->
    <svg v-else-if="cardId === 'card_vn_huong'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-slate-300">
      <!-- Cửa động Hương Tích & Núi đá vôi -->
      <path d="M15 85 Q 15 35 50 25 Q 85 35 85 85 Z" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M28 85 Q 28 48 50 40 Q 72 48 72 85 Z" fill="currentColor" opacity="0.35" />
      <!-- Con thuyền suối Yến thanh bình -->
      <path d="M38 78 Q 50 82 62 78 L 66 74 Q 50 76 34 74 Z" fill="#c9a24b" />
      <!-- Thạch nhũ động -->
      <polygon points="45,26 47,38 49,26" fill="currentColor" />
      <polygon points="53,27 55,42 57,27" fill="currentColor" />
    </svg>

    <!-- 6. Todaiji (Đại Phật Tỳ Lô Giá Na) -->
    <svg v-else-if="cardId === 'card_jp_todaiji'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-gold">
      <!-- Tượng Đại Phật Tọa Thiền -->
      <ellipse cx="50" cy="30" rx="9" ry="11" fill="currentColor" />
      <!-- Nhục kế & Hào quang -->
      <circle cx="50" cy="18" r="3" fill="currentColor" />
      <circle cx="50" cy="30" r="22" stroke="#c9a24b" stroke-width="1.5" fill="none" stroke-dasharray="2 3" opacity="0.7" />
      <!-- Vai & Thân tọa thiền -->
      <path d="M32 44 Q 50 38 68 44 L 75 70 Q 50 74 25 70 Z" fill="currentColor" opacity="0.9" />
      <!-- Tòa sen báu ngàn cánh -->
      <path d="M20 72 Q 50 64 80 72 L 78 82 Q 50 86 22 82 Z" fill="#c9a24b" />
    </svg>

    <!-- 7. Chùa Vàng Kinkaku-ji -->
    <svg v-else-if="cardId === 'card_jp_kinkaku'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-purple-300">
      <!-- Chim Phượng Hoàng đỉnh nóc chùa -->
      <polygon points="50,14 47,20 53,20" fill="#c9a24b" />
      <!-- 3 Tầng dát vàng soi bóng -->
      <path d="M34 26 Q 50 20 66 26 L 62 22 Q 50 18 38 22 Z" fill="#c9a24b" />
      <path d="M26 44 Q 50 34 74 44 L 70 38 Q 50 30 30 38 Z" fill="#c9a24b" opacity="0.9" />
      <path d="M18 64 Q 50 50 82 64 L 76 56 Q 50 44 24 56 Z" fill="#c9a24b" opacity="0.8" />
      <!-- Khung tầng gỗ -->
      <rect x="42" y="26" width="16" height="12" fill="#1a1714" stroke="currentColor" stroke-width="1.5" />
      <rect x="36" y="44" width="28" height="12" fill="#1a1714" stroke="currentColor" stroke-width="1.5" />
      <rect x="30" y="64" width="40" height="16" fill="#1a1714" stroke="currentColor" stroke-width="1.5" />
      <!-- Gợn sóng hồ Kyoko-chi -->
      <line x1="20" y1="86" x2="80" y2="86" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6" />
    </svg>

    <!-- 8. Nhất Kỳ Nhất Hội (Thiền Trà Sen no Rikyu) -->
    <svg v-else-if="cardId === 'card_jp_ichigo'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-purple-300">
      <!-- Chén Trà Chawan Thiền Đạo -->
      <path d="M26 52 Q 24 74 50 78 Q 76 74 74 52 Z" fill="currentColor" opacity="0.8" />
      <ellipse cx="50" cy="52" rx="24" ry="7" fill="#0ecb81" opacity="0.75" />
      <!-- Làn khói trà thanh tịnh bay lên -->
      <path d="M44 44 Q 40 32 46 22 Q 52 14 48 8" stroke="#c9a24b" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7" />
      <path d="M54 44 Q 58 34 52 24 Q 46 16 52 8" stroke="#c9a24b" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5" />
      <!-- Búp trà non trôi trên mặt nước -->
      <circle cx="50" cy="52" r="2.5" fill="#c9a24b" />
    </svg>

    <!-- 9. Vòng Tròn Enso (Thực Tại Vô Thường) -->
    <svg v-else-if="cardId === 'card_jp_enso'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-sky-300">
      <!-- Nét bút lông mực tàu Enso không khép kín -->
      <path
        d="M50 16 A 34 34 0 1 1 20 42"
        fill="none"
        stroke="currentColor"
        stroke-width="7"
        stroke-linecap="round"
        stroke-dasharray="190 20"
        opacity="0.9"
      />
      <!-- Hạt mực vương vãi tự nhiên -->
      <circle cx="16" cy="46" r="2" fill="currentColor" />
      <circle cx="18" cy="52" r="1.5" fill="currentColor" />
      <circle cx="48" cy="50" r="3" fill="#c9a24b" />
    </svg>

    <!-- 10. Vườn Đá Khô Ryoan-ji -->
    <svg v-else-if="cardId === 'card_jp_ryoanji'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-slate-300">
      <!-- Thảm sỏi cào gợn sóng Karesansui -->
      <circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.2" />
      <circle cx="50" cy="50" r="32" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.4" />
      <circle cx="50" cy="50" r="24" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.6" />
      <circle cx="50" cy="50" r="16" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />
      <!-- 3 Hòn đá thiền định mộc mạc -->
      <polygon points="46,42 54,40 56,52 44,52" fill="currentColor" />
      <polygon points="30,58 36,56 38,64 28,64" fill="currentColor" opacity="0.8" />
      <polygon points="66,36 72,34 74,42 64,42" fill="currentColor" opacity="0.8" />
    </svg>

    <!-- 11. Chùa Phật Ngọc Wat Phra Kaew -->
    <svg v-else-if="cardId === 'card_th_watphra'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-gold">
      <!-- Đỉnh bảo tháp nhọn Chedi Hoàng gia -->
      <path d="M50 10 L 53 45 L 47 45 Z" fill="#0ecb81" />
      <circle cx="50" cy="8" r="3" fill="#c9a24b" />
      <!-- Thân bảo tháp Phật Ngọc Thái Lan -->
      <path d="M42 45 L 58 45 L 64 68 L 36 68 Z" fill="#0ecb81" opacity="0.85" />
      <!-- Y phục vàng ròng bảo bọc -->
      <path d="M40 52 Q 50 48 60 52 L 62 62 Q 50 60 38 62 Z" fill="#c9a24b" />
      <!-- Bệ tam cấp hoàng gia -->
      <rect x="28" y="68" width="44" height="6" fill="#c9a24b" />
      <rect x="22" y="74" width="56" height="8" fill="#c9a24b" opacity="0.8" />
    </svg>

    <!-- 12. Chùa Bình Minh Wat Arun -->
    <svg v-else-if="cardId === 'card_th_watarun'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-purple-300">
      <!-- Tháp Prang Khổng Lồ Cao Vút -->
      <polygon points="50,12 47,30 53,30" fill="currentColor" />
      <path d="M44 30 L 56 30 L 60 62 L 40 62 Z" fill="currentColor" opacity="0.8" />
      <path d="M36 62 L 64 62 L 68 84 L 32 84 Z" fill="currentColor" opacity="0.9" />
      <!-- Hoa văn cẩn gốm sứ đa sắc -->
      <circle cx="50" cy="42" r="3" fill="#c9a24b" />
      <circle cx="50" cy="54" r="3" fill="#c9a24b" />
      <circle cx="44" cy="72" r="2.5" fill="#38bdf8" />
      <circle cx="56" cy="72" r="2.5" fill="#38bdf8" />
      <!-- Mặt trời ban mai mọc sau tháp -->
      <circle cx="50" cy="20" r="16" fill="none" stroke="#c9a24b" stroke-width="1" stroke-dasharray="2 3" opacity="0.5" />
    </svg>

    <!-- 13. Từ Bi Quán Metta Bhavana -->
    <svg v-else-if="cardId === 'card_th_metta'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-sky-300">
      <!-- Trái tim từ bi & Bồ đề tâm -->
      <path d="M50 78 C 20 54, 20 28, 38 28 C 46 28, 50 34, 50 34 C 50 34, 54 28, 62 28 C 80 28, 80 54, 50 78 Z" fill="currentColor" opacity="0.4" />
      <path d="M50 72 C 28 52, 28 34, 40 34 C 46 34, 50 38, 50 38 C 50 38, 54 34, 60 34 C 72 34, 72 52, 50 72 Z" fill="currentColor" opacity="0.75" />
      <!-- Đóa sen trắng thuần khiết ở tâm -->
      <circle cx="50" cy="50" r="6" fill="#c9a24b" />
      <!-- Vòng sóng an lạc lan tỏa -->
      <circle cx="50" cy="50" r="30" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" fill="none" opacity="0.5" />
    </svg>

    <!-- 14. Bánh Xe Pháp Luân Dhammacakka -->
    <svg v-else-if="cardId === 'card_th_dhamma'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-slate-300">
      <!-- Vành ngoài Pháp Luân -->
      <circle cx="50" cy="50" r="34" stroke="currentColor" stroke-width="4" fill="none" />
      <!-- Trục tâm -->
      <circle cx="50" cy="50" r="10" fill="#c9a24b" />
      <circle cx="50" cy="50" r="4" fill="#1a1714" />
      <!-- 8 Nan Hoa Bát Chánh Đạo -->
      <line x1="50" y1="16" x2="50" y2="84" stroke="currentColor" stroke-width="2.5" />
      <line x1="16" y1="50" x2="84" y2="50" stroke="currentColor" stroke-width="2.5" />
      <line x1="26" y1="26" x2="74" y2="74" stroke="currentColor" stroke-width="2" />
      <line x1="74" y1="26" x2="26" y2="74" stroke="currentColor" stroke-width="2" />
    </svg>

    <!-- 15. Hải Ấn Tự Haeinsa (Đại Tạng Kinh Mộc Bản) -->
    <svg v-else-if="cardId === 'card_kr_haeinsa'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-gold">
      <!-- Giá gỗ thông gió tự nhiên Janggyeong Panjeon -->
      <rect x="20" y="24" width="60" height="56" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="20" y1="42" x2="80" y2="42" stroke="currentColor" stroke-width="1.5" />
      <line x1="20" y1="60" x2="80" y2="60" stroke="currentColor" stroke-width="1.5" />
      <!-- Các thanh mộc bản kinh Phật xếp đều tăm tắp -->
      <line x1="28" y1="24" x2="28" y2="42" stroke="#c9a24b" stroke-width="2" />
      <line x1="36" y1="24" x2="36" y2="42" stroke="#c9a24b" stroke-width="2" />
      <line x1="44" y1="24" x2="44" y2="42" stroke="#c9a24b" stroke-width="2" />
      <line x1="52" y1="24" x2="52" y2="42" stroke="#c9a24b" stroke-width="2" />
      <line x1="60" y1="24" x2="60" y2="42" stroke="#c9a24b" stroke-width="2" />
      <line x1="68" y1="24" x2="68" y2="42" stroke="#c9a24b" stroke-width="2" />
      <!-- Mái ngói cong truyền thống Hàn Quốc Hanok -->
      <path d="M14 24 Q 50 14 86 24 L 80 18 Q 50 10 20 18 Z" fill="currentColor" />
    </svg>

    <!-- 16. Phật Quốc Tự Bulguksa (Tháp Đá Dabotap & Seokgatap) -->
    <svg v-else-if="cardId === 'card_kr_bulguk'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-purple-300">
      <!-- Tháp đá Đa Bảo Tháp (Dabotap) Silla -->
      <rect x="38" y="70" width="24" height="14" fill="currentColor" />
      <!-- 4 Cột đá chống đỡ tầng 2 -->
      <line x1="42" y1="52" x2="42" y2="70" stroke="currentColor" stroke-width="3" />
      <line x1="58" y1="52" x2="58" y2="70" stroke="currentColor" stroke-width="3" />
      <!-- Mái đá bát giác tầng trên -->
      <polygon points="34,52 66,52 60,44 40,44" fill="currentColor" opacity="0.9" />
      <polygon points="38,44 62,44 58,34 42,34" fill="currentColor" opacity="0.8" />
      <!-- Đỉnh tháp nhọn vươn trời -->
      <polygon points="46,34 54,34 50,18" fill="#c9a24b" />
      <circle cx="50" cy="16" r="3" fill="#c9a24b" />
    </svg>

    <!-- 17. Nhất Tâm Chân Như Wonhyo -->
    <svg v-else-if="cardId === 'card_kr_wonhyo'" viewBox="0 0 100 100" class="w-full h-full p-2.5 text-sky-300">
      <!-- Ánh trăng rọi chiếu cõi lòng đêm tối -->
      <circle cx="50" cy="34" r="18" fill="none" stroke="#c9a24b" stroke-width="2" />
      <circle cx="50" cy="34" r="14" fill="#c9a24b" opacity="0.3" />
      <!-- Giọt nước cam lộ thanh tịnh rơi xuống -->
      <path d="M50 48 C 44 58, 42 66, 50 74 C 58 66, 56 58, 50 48 Z" fill="currentColor" opacity="0.85" />
      <circle cx="50" cy="66" r="3" fill="#38bdf8" />
      <!-- Gợn sóng tâm thức mở rộng -->
      <ellipse cx="50" cy="80" rx="30" ry="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
    </svg>

    <!-- 18. Tào Khê Tự Jogyesa (Bạch Tùng Cổ Thụ & Lồng Đèn) -->
    <svg v-else viewBox="0 0 100 100" class="w-full h-full p-2.5 text-slate-300">
      <!-- Thân cây thông vỏ trắng cổ thụ 500 năm -->
      <path d="M48 85 Q 46 55 52 40 Q 48 30 50 20" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" />
      <!-- Tán thông xanh tỏa bóng -->
      <ellipse cx="38" cy="35" rx="16" ry="8" fill="#0ecb81" opacity="0.6" />
      <ellipse cx="62" cy="30" rx="18" ry="9" fill="#0ecb81" opacity="0.7" />
      <ellipse cx="50" cy="20" rx="14" ry="7" fill="#0ecb81" opacity="0.8" />
      <!-- Lồng đèn hoa sen lung linh -->
      <circle cx="32" cy="48" r="4" fill="#c9a24b" />
      <circle cx="68" cy="44" r="4" fill="#f6465d" />
      <circle cx="50" cy="40" r="4.5" fill="#c9a24b" />
    </svg>
  </div>
</template>

