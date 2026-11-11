<script setup lang="ts">
import type { BuddhistCard } from '~/stores/cards'
import { zenAudio } from '~/lib/audio/ZenAudio'
import ZenIcon from '~/components/ZenIcon.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import HeritageCardArt from '~/components/cards/HeritageCardArt.vue'

const props = defineProps<{
  card: BuddhistCard
  isOwned: boolean
  copyCount?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const currentSide = ref<'front' | 'back'>('front')
const isNarrating = ref(false)
const downloadSuccess = ref(false)
const mintNotice = ref<string | null>(null)
const imageFailed = ref(false)

const resolvedImageSrc = computed(() => {
  if (props.card.imageUrl) return props.card.imageUrl
  return `/images/cards/${props.card.id}.png`
})

function onImageError() {
  imageFailed.value = true
}

function toggleSide() {
  currentSide.value = currentSide.value === 'front' ? 'back' : 'front'
  zenAudio.playSingingBowl()
}

function toggleNarration() {
  isNarrating.value = !isNarrating.value
  if (isNarrating.value) {
    zenAudio.playSingingBowl()
  }
}

function handleDownloadWallpaper() {
  downloadSuccess.value = true
  zenAudio.playTempleBell()
  // Tạo canvas tải ảnh hình nền nghệ thuật di sản
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Nền tối Binance Dark
      ctx.fillStyle = '#0b0e11'
      ctx.fillRect(0, 0, 1080, 1920)

      // Viền vàng hoàng kim
      ctx.strokeStyle = '#fcd535'
      ctx.lineWidth = 12
      ctx.strokeRect(60, 60, 960, 1800)

      // Header
      ctx.fillStyle = '#fcd535'
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('VẠN CẢNH THIỀN TỰ · DI SẢN CỔ TỰ', 540, 200)

      // Tiêu đề thẻ
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px sans-serif'
      ctx.fillText(props.card.title, 540, 420)

      ctx.fillStyle = '#929aa5'
      ctx.font = '36px sans-serif'
      ctx.fillText(props.card.subtitle, 540, 500)

      // Kinh văn
      if (props.card.scriptureText) {
        ctx.fillStyle = '#fcd535'
        ctx.font = 'italic 38px serif'
        ctx.fillText(`"${props.card.scriptureText}"`, 540, 780)
      }

      // Ý nghĩa
      ctx.fillStyle = '#e0e0e0'
      ctx.font = '32px sans-serif'
      const words = props.card.meaning.split(' ')
      let line = ''
      let y = 1000
      for (const w of words) {
        const testLine = line + w + ' '
        if (ctx.measureText(testLine).width > 800) {
          ctx.fillText(line, 540, y)
          line = w + ' '
          y += 50
        } else {
          line = testLine
        }
      }
      ctx.fillText(line, 540, y)

      // Footer
      ctx.fillStyle = '#666666'
      ctx.font = '28px monospace'
      ctx.fillText('Cardano Blockchain · Hydra L2 Notary', 540, 1780)

      const a = document.createElement('a')
      a.download = `${props.card.id}_wallpaper.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
  } catch (err) {
    console.warn('Canvas download error:', err)
  }

  setTimeout(() => {
    downloadSuccess.value = false
  }, 3000)
}

function handleMintNft() {
  mintNotice.value = 'Tính năng Đúc NFT CIP-68 trên Cardano Preprod đang chuẩn bị ra mắt trong phiên bản tới!'
  zenAudio.playSingingBowl()
  setTimeout(() => {
    mintNotice.value = null
  }, 4000)
}

const ownershipBadgeText = computed(() => {
  if (!props.isOwned) return 'Chưa khai quang'
  if (props.copyCount && props.copyCount > 1) return `Đã sở hữu (x${props.copyCount})`
  return 'Đã khai quang'
})

const rarityBadge = computed(() => {
  switch (props.card.rarity) {
    case 'legendary': return { label: 'Chân Như (Legendary)', color: 'text-amber-300', bg: 'bg-amber-400/15 border-amber-400/40' }
    case 'epic': return { label: 'Giác Ngộ (Epic)', color: 'text-purple-300', bg: 'bg-purple-400/15 border-purple-400/40' }
    case 'rare': return { label: 'Tinh Tấn (Rare)', color: 'text-sky-300', bg: 'bg-sky-400/15 border-sky-400/40' }
    default: return { label: 'Thường (Common)', color: 'text-secondary', bg: 'bg-surface-elevated border-hairline' }
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div
        class="w-full max-w-lg bg-surface-card border border-hairline rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto my-auto">
        <!-- Header Modal -->
        <div class="flex items-center justify-between border-b border-hairline pb-3">
          <div class="flex items-center gap-2.5">
            <div
              class="w-9 h-9 rounded-xl bg-surface-elevated border border-hairline flex items-center justify-center text-gold shadow-sm shrink-0">
              <ZenIcon :name="card.category === 'wisdom' ? 'lotus' : 'pagoda'" :size="18" />
            </div>
            <div>
              <div class="text-xs text-secondary font-medium">
                {{ card.country }} · {{ card.category === 'wisdom' ? 'Triết Lý Thiền' : 'Kiến Trúc Cổ Tự' }}
              </div>
              <h3 class="text-sm font-bold text-white tracking-wide leading-snug m-0">
                {{ card.title }}
              </h3>
            </div>
          </div>

          <button type="button"
            class="p-1.5 rounded-lg text-secondary hover:text-white hover:bg-surface-elevated transition-colors cursor-pointer"
            @click="emit('close')">
            <ZenIcon name="x" :size="18" />
          </button>
        </div>

        <!-- Thẻ Card 3D Lật 2 Mặt -->
        <div
          class="rounded-xl border border-hairline bg-surface-elevated p-4 sm:p-5 space-y-3.5 transition-all relative overflow-hidden">
          <!-- Thanh chuyển đổi Mặt Trước / Mặt Sau & Trạng thái -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <UiBadge :variant="isOwned ? 'success' : 'neutral'">
                {{ ownershipBadgeText }}
              </UiBadge>
              <span class="px-2 py-0.5 rounded border text-xs font-semibold"
                :class="[rarityBadge.color, rarityBadge.bg]">
                {{ rarityBadge.label }}
              </span>
            </div>

            <button type="button"
              class="px-2.5 py-1 rounded-lg bg-surface-card border border-hairline text-xs font-medium text-gold hover:border-gold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              @click="toggleSide">
              <ZenIcon name="cards" :size="12" />
              <span>{{ currentSide === 'front' ? 'Xem Mặt Sau (Kinh Kệ)' : 'Xem Mặt Trước (Triết Lý)' }}</span>
            </button>
          </div>

          <!-- MẶT TRƯỚC: ARTWORK & Ý NGHĨA TRIẾT LÝ -->
          <div v-if="currentSide === 'front'" class="space-y-3">
            <!-- Artwork Minh Họa Lớn (PNG hoặc Vector Art) -->
            <div
              class="w-full max-w-[260px] mx-auto rounded-xl overflow-hidden border border-hairline/80 shadow-lg bg-canvas-dark aspect-[16/11]">
              <img v-if="!imageFailed" :src="resolvedImageSrc" :alt="card.title" class="w-full h-full object-cover"
                @error="onImageError" />
              <HeritageCardArt v-else :card-id="card.id" :rarity="card.rarity" />
            </div>

            <div class="p-3.5 rounded-xl bg-surface-card border border-hairline space-y-1">
              <div class="text-xs text-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ZenIcon name="sparkles" :size="12" />
                <span>Ý Nghĩa Chánh Niệm</span>
              </div>
              <p class="text-xs text-white leading-relaxed m-0">
                {{ card.meaning }}
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-surface-card border border-hairline/70 space-y-1">
              <div class="text-xs text-secondary font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <ZenIcon name="pagoda" :size="12" />
                <span>Điển Tích Cổ Tự (Lore)</span>
              </div>
              <p class="text-xs text-secondary leading-relaxed m-0">
                {{ card.lore }}
              </p>
            </div>
          </div>

          <!-- MẶT SAU: KINH VĂN VĂN TỰ & NARRATOR -->
          <div v-else class="space-y-3">
            <div v-if="card.scriptureText"
              class="p-4 rounded-xl bg-surface-card border border-gold/40 text-center space-y-2 shadow-inner">
              <div class="text-xs text-gold font-bold uppercase tracking-wider">Kinh Văn Kệ</div>
              <div class="text-xs text-white font-serif italic leading-relaxed whitespace-pre-line">
                "{{ card.scriptureText }}"
              </div>
            </div>

            <!-- Thuyết minh Audio -->
            <div
              class="p-3.5 rounded-xl bg-surface-card border border-hairline flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div
                  class="w-9 h-9 rounded-full bg-surface-elevated border border-hairline flex items-center justify-center text-primary shrink-0">
                  <ZenIcon name="volume" :size="16" />
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-semibold text-white">Thuyết Minh Âm Thanh</div>
                  <div class="text-xs text-secondary truncate">{{ card.audioNarrator || 'Audio thiền tịnh tâm' }}</div>
                </div>
              </div>

              <button type="button"
                class="px-3 py-1.5 rounded-lg border border-gold/60 text-xs font-medium text-gold hover:bg-gold/15 transition-colors cursor-pointer shrink-0"
                @click="toggleNarration">
                {{ isNarrating ? 'Tạm Dừng' : 'Phát Thuyết Minh' }}
              </button>
            </div>

            <!-- Tags -->
            <div v-if="card.tags && card.tags.length" class="flex flex-wrap gap-1.5 pt-1">
              <span v-for="t in card.tags" :key="t"
                class="px-2 py-0.5 rounded-md bg-surface-card border border-hairline text-xs text-secondary font-numbers">
                #{{ t }}
              </span>
            </div>
          </div>
        </div>

        <!-- Thông báo đúc NFT nếu có -->
        <div v-if="mintNotice"
          class="p-2.5 rounded-lg bg-surface-elevated border border-gold/40 text-xs text-gold flex items-center gap-2">
          <ZenIcon name="sparkles" :size="14" class="shrink-0" />
          <span>{{ mintNotice }}</span>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-hairline grid grid-cols-2 gap-2.5 text-xs">
          <UiButton variant="secondary" size="sm" class="text-xs font-medium" @click="handleDownloadWallpaper">
            <ZenIcon name="sparkles" :size="14" class="mr-1.5" />
            <span>{{ downloadSuccess ? 'Đã tải ảnh 4K!' : 'Tải Hình Nền 4K' }}</span>
          </UiButton>

          <UiButton variant="primary" size="sm" class="text-xs font-semibold" @click="handleMintNft">
            <ZenIcon name="cards" :size="14" class="mr-1.5" />
            <span>Đúc NFT CIP-68</span>
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>