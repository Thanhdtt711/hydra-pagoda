<script setup lang="ts">
import type { BuddhistCard } from '~/stores/cards'
import ZenIcon from '~/components/ZenIcon.vue'
import HeritageCardArt from '~/components/cards/HeritageCardArt.vue'

const props = withDefaults(
  defineProps<{
    card: BuddhistCard
    isOwned?: boolean
    copyCount?: number
    isFlipped?: boolean // true: mặt ngửa (đã mở), false: mặt úp
    interactive?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    isOwned: true,
    copyCount: 1,
    isFlipped: true,
    interactive: true,
    size: 'md'
  }
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

// Quản lý ảnh PNG (Tự động tải PNG từ /images/cards/{id}.png hoặc card.imageUrl, nếu lỗi thì fallback sang Vector Art)
const imageFailed = ref(false)
const resolvedImageSrc = computed(() => {
  if (props.card.imageUrl) return props.card.imageUrl
  return `/images/cards/${props.card.id}.png`
})

function onImageError() {
  imageFailed.value = true
}

// Phẩm cấp cấu hình màu sắc & hoa văn chuẩn Binance Dark
const rarityConfig = computed(() => {
  switch (props.card.rarity) {
    case 'legendary':
      return {
        label: 'Chân Như',
        tier: 'Bậc IV',
        border: 'border-amber-400/90',
        innerBorder: 'border-amber-400/40',
        cornerColor: 'text-amber-400',
        ribbonBg: 'bg-gold text-canvas-dark font-black',
        glowText: 'text-amber-300',
        accentBg: 'bg-amber-400/10'
      }
    case 'epic':
      return {
        label: 'Giác Ngộ',
        tier: 'Bậc III',
        border: 'border-purple-400/90',
        innerBorder: 'border-purple-400/40',
        cornerColor: 'text-purple-400',
        ribbonBg: 'bg-purple-500 text-white font-bold',
        glowText: 'text-purple-300',
        accentBg: 'bg-purple-400/10'
      }
    case 'rare':
      return {
        label: 'Tinh Tấn',
        tier: 'Bậc II',
        border: 'border-sky-400/80',
        innerBorder: 'border-sky-400/30',
        cornerColor: 'text-sky-400',
        ribbonBg: 'bg-sky-600 text-white font-bold',
        glowText: 'text-sky-300',
        accentBg: 'bg-sky-400/10'
      }
    default:
      return {
        label: 'Thường',
        tier: 'Bậc I',
        border: 'border-hairline hover:border-hairline-light',
        innerBorder: 'border-hairline/60',
        cornerColor: 'text-secondary/60',
        ribbonBg: 'bg-surface-elevated text-secondary font-semibold border border-hairline',
        glowText: 'text-secondary',
        accentBg: 'bg-surface-card'
      }
  }
})

// Tên quốc gia hiển thị trang nhã
const countryLabel = computed(() => {
  switch (props.card.country) {
    case 'Việt Nam': return 'Việt Nam'
    case 'Nhật Bản': return 'Nhật Bản'
    case 'Thái Lan': return 'Thái Lan'
    case 'Hàn Quốc': return 'Hàn Quốc'
    default: return props.card.country
  }
})
</script>

<template>
  <div
    class="heritage-card relative select-none rounded-xl transition-all duration-300 group"
    :class="[
      interactive ? 'cursor-pointer hover:-translate-y-1' : '',
      size === 'sm' ? 'w-full text-xs' : size === 'lg' ? 'w-full text-sm' : 'w-full text-xs'
    ]"
    @click="emit('click')"
  >
    <!-- THẺ BÀI MẶT TRƯỚC (ĐÃ LẬT / HIỂN THỊ CHI TIẾT) -->
    <div
      v-if="isFlipped"
      class="w-full h-full rounded-xl p-2.5 flex flex-col justify-between relative overflow-hidden bg-[#14120f] border transition-all"
      :class="[
        rarityConfig.border,
        !isOwned ? 'opacity-70 saturate-50' : ''
      ]"
    >
      <!-- Hiệu ứng ánh kim chạy qua thẻ Legendary / Epic -->
      <div
        v-if="card.rarity === 'legendary' || card.rarity === 'epic'"
        class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none z-20"
      />

      <!-- Huy hiệu số lượng bản sao sở hữu -->
      <div
        v-if="isOwned && copyCount > 1"
        class="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-gold text-canvas-dark font-numbers font-bold text-xs shadow-md z-30 flex items-center gap-0.5"
      >
        <span>x</span>
        <span>{{ copyCount }}</span>
      </div>

      <!-- Icon khóa nếu chưa sở hữu -->
      <div
        v-if="!isOwned"
        class="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-canvas-dark/90 border border-hairline text-secondary text-xs flex items-center gap-1 z-30"
      >
        <ZenIcon name="circle-alert" :size="12" />
        <span>Chưa mở</span>
      </div>

      <!-- 1. HEADER THẺ: Quốc Gia & Thể Loại -->
      <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-hairline/60 z-10">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full" :class="rarityConfig.cornerColor.replace('text-', 'bg-')" />
          <span class="text-xs font-semibold text-secondary truncate">{{ countryLabel }}</span>
        </div>
        <div class="flex items-center gap-1 shrink-0 text-xs">
          <span class="px-1.5 py-0.5 rounded bg-surface-elevated/80 border border-hairline/80 font-medium text-xs" :class="rarityConfig.glowText">
            {{ card.category === 'wisdom' ? 'Triết Lý' : 'Cổ Tự' }}
          </span>
        </div>
      </div>

      <!-- 2. KHUNG ARTWORK NGHỆ THUẬT (Hỗ trợ Ảnh PNG thật hoặc Vector Art Fallback) -->
      <div class="my-2 rounded-lg overflow-hidden border relative bg-canvas-dark shrink-0 aspect-[16/11]" :class="rarityConfig.innerBorder">
        <!-- Ảnh PNG thật nếu có và tải thành công -->
        <img
          v-if="!imageFailed"
          :src="resolvedImageSrc"
          :alt="card.title"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          @error="onImageError"
        />

        <!-- Vector Art dự phòng nếu chưa có ảnh PNG -->
        <HeritageCardArt
          v-else
          :card-id="card.id"
          :rarity="card.rarity"
        />

        <!-- Lớp phủ sương mờ phong ấn nếu chưa sở hữu -->
        <div
          v-if="!isOwned"
          class="absolute inset-0 bg-canvas-dark/65 flex flex-col items-center justify-center text-center p-2"
        >
          <div class="w-8 h-8 rounded-full bg-surface-elevated/90 border border-hairline flex items-center justify-center text-secondary mb-1">
            <ZenIcon name="sparkles" :size="14" />
          </div>
          <span class="text-xs text-secondary font-medium">Chưa khai quang</span>
        </div>
      </div>

      <!-- 3. THÔNG TIN TIÊU ĐỀ & Ý NGHĨA (Không bị đè dính chữ) -->
      <div class="flex-1 flex flex-col justify-start py-1 z-10">
        <h4
          class="text-xs font-bold leading-snug line-clamp-2 transition-colors m-0 min-h-[30px] flex items-center"
          :class="[
            isOwned ? 'text-white group-hover:' + rarityConfig.glowText : 'text-secondary'
          ]"
        >
          {{ card.title }}
        </h4>
        <p class="text-xs text-secondary line-clamp-1 leading-normal mt-1 mb-0">
          {{ card.subtitle }}
        </p>
      </div>

      <!-- 4. FOOTER: RIBBON PHẨM CẤP -->
      <div class="pt-1.5 border-t border-hairline/60 flex items-center justify-between text-xs z-10">
        <div class="flex items-center gap-1.5">
          <span class="px-1.5 py-0.5 rounded text-xs leading-none" :class="rarityConfig.ribbonBg">
            {{ rarityConfig.label }}
          </span>
          <span class="text-xs font-semibold tracking-tight" :class="rarityConfig.glowText">
            {{ rarityConfig.tier }}
          </span>
        </div>

        <span class="text-xs text-secondary font-numbers">
          #{{ card.id.slice(-2) }}
        </span>
      </div>
    </div>

    <!-- THẺ BÀI MẶT ÚP (CHƯA LẬT - PHONG CÁCH BÙA CHÚ PHONG ẤN DI SẢN MẠ VÀNG) -->
    <div
      v-else
      class="w-full h-full rounded-xl p-3 flex flex-col items-center justify-between text-center relative overflow-hidden bg-[#14120f] border border-amber-400/50 shadow-xl group-hover:border-gold transition-all"
    >
      <!-- Khung viền chỉ mạ vàng hoa văn góc -->
      <div class="absolute inset-1.5 rounded-lg border border-amber-400/25 pointer-events-none p-1 flex flex-col justify-between">
        <div class="flex justify-between text-amber-400/40 text-xs">
          <span>+</span>
          <span>+</span>
        </div>
        <div class="flex justify-between text-amber-400/40 text-xs">
          <span>+</span>
          <span>+</span>
        </div>
      </div>

      <!-- Header mặt sau: Nhãn thanh tịnh -->
      <div class="z-10 pt-1 text-center">
        <span class="px-2 py-0.5 rounded-[2px] bg-gold/10 border border-gold/30 text-gold text-xs font-semibold">
          Di Sản Cổ Tự
        </span>
      </div>

      <!-- Tâm điểm: Đồ án Bát Nhã Mandala -->
      <div class="my-auto flex flex-col items-center justify-center space-y-2 z-10">
        <div class="w-12 h-12 rounded-full bg-gold/15 border border-gold/60 flex items-center justify-center text-gold group-hover:scale-110 transition-transform duration-300">
          <ZenIcon name="sparkles" :size="20" class="text-gold" />
        </div>
        <div class="text-xs font-bold text-white">
          Chạm Để Lật
        </div>
      </div>

      <!-- Footer mặt sau: Cardano L2 -->
      <div class="text-xs text-secondary/60 font-numbers z-10 pb-1">
        Hydra L2 Notary
      </div>
    </div>
  </div>
</template>

<style scoped>
.heritage-card {
  aspect-ratio: 2 / 2.88;
}
</style>
