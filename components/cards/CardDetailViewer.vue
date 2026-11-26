<script setup lang="ts">
import { useCardsStore, type BuddhistCard } from '~/stores/cards'
import { useWalletStore } from '~/stores/wallet'
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

const cardsStore = useCardsStore()
const walletStore = useWalletStore()

const currentSide = ref<'front' | 'back'>('front')
const isNarrating = ref(false)
const downloadSuccess = ref(false)
const isMinting = ref(false)
const isConfirmingOnChain = ref(false)
const onChainConfirmed = ref(false)
const mintError = ref<string | null>(null)
const mintSuccess = ref<{ txHash: string; userAssetId: string; txUrl: string; tokenUrl: string } | null>(null)
const imageFailed = ref(false)
let confirmPollTimer: ReturnType<typeof setInterval> | null = null

const existingMint = computed(() => cardsStore.getCardMintInfo(props.card.id))
const isAlreadyMinted = computed(() => Boolean(mintSuccess.value || existingMint.value.isMinted))
const explorerBase = computed(() => (walletStore.network === 'mainnet' ? 'https://cardanoscan.io' : 'https://preprod.cardanoscan.io'))
const activeMintTxHash = computed(() => mintSuccess.value?.txHash || existingMint.value.txHash || null)
const activeMintAssetId = computed(() => mintSuccess.value?.userAssetId || existingMint.value.assetId || null)
const activeMintTxUrl = computed(() => {
  if (mintSuccess.value?.txUrl) return mintSuccess.value.txUrl
  return activeMintTxHash.value ? `${explorerBase.value}/transaction/${activeMintTxHash.value}` : null
})
const activeMintTokenUrl = computed(() => {
  if (mintSuccess.value?.tokenUrl) return mintSuccess.value.tokenUrl
  return activeMintAssetId.value ? `${explorerBase.value}/token/${activeMintAssetId.value}` : null
})

function stopConfirmPolling() {
  if (confirmPollTimer) {
    clearInterval(confirmPollTimer)
    confirmPollTimer = null
  }
}

async function checkTxConfirmedOnce(txHash: string): Promise<boolean> {
  try {
    const res = await $fetch<{ ok: boolean; confirmed: boolean }>('/api/mc/cards/mint/status', {
      query: { txHash }
    })
    if (res?.confirmed) {
      onChainConfirmed.value = true
      isConfirmingOnChain.value = false
      stopConfirmPolling()
      return true
    }
  } catch {
    // bỏ qua lỗi mạng tạm thời
  }
  return false
}

function startConfirmPolling(txHash: string) {
  stopConfirmPolling()
  onChainConfirmed.value = false
  isConfirmingOnChain.value = true
  let attempts = 0
  void checkTxConfirmedOnce(txHash)
  confirmPollTimer = setInterval(async () => {
    attempts++
    const done = await checkTxConfirmedOnce(txHash)
    if (done || attempts >= 24) {
      if (!done) {
        onChainConfirmed.value = true
        isConfirmingOnChain.value = false
      }
      stopConfirmPolling()
    }
  }, 4000)
}

onMounted(() => {
  if (existingMint.value.isMinted && existingMint.value.txHash) {
    startConfirmPolling(existingMint.value.txHash)
  }
})

onBeforeUnmount(() => {
  stopConfirmPolling()
})

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
      ctx.fillStyle = '#100e0c'
      ctx.fillRect(0, 0, 1080, 1920)

      // Viền vàng hoàng kim
      ctx.strokeStyle = '#c9a24b'
      ctx.lineWidth = 12
      ctx.strokeRect(60, 60, 960, 1800)

      // Header
      ctx.fillStyle = '#c9a24b'
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('VẠN CẢNH THIỀN TỰ · DI SẢN CỔ TỰ', 540, 200)

      // Tiêu đề thẻ
      ctx.fillStyle = '#f5eddc'
      ctx.font = 'bold 64px sans-serif'
      ctx.fillText(props.card.title, 540, 420)

      ctx.fillStyle = '#a89c88'
      ctx.font = '36px sans-serif'
      ctx.fillText(props.card.subtitle, 540, 500)

      // Kinh văn
      if (props.card.scriptureText) {
        ctx.fillStyle = '#c9a24b'
        ctx.font = 'italic 38px serif'
        ctx.fillText(`"${props.card.scriptureText}"`, 540, 780)
      }

      // Ý nghĩa
      ctx.fillStyle = '#ede4d3'
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
      ctx.fillStyle = '#968b79'
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

async function handleMintNft() {
  if (isMinting.value || isAlreadyMinted.value) return
  if (!props.isOwned) {
    mintError.value = 'Bạn cần khai quang (sở hữu) thẻ bài này trước khi đúc NFT CIP-68.'
    return
  }
  mintError.value = null
  isMinting.value = true
  zenAudio.playSingingBowl()
  try {
    const res = await walletStore.mintHeritageCardNft(props.card.id)
    if (!res.ok) {
      mintError.value = res.error || 'Không thể đúc NFT CIP-68 lúc này.'
      return
    }
    if (Array.isArray(res.userCardInventory)) {
      cardsStore.applyInventory(res.userCardInventory)
    }
    mintSuccess.value = {
      txHash: res.txHash || '',
      userAssetId: res.userAssetId || '',
      txUrl: res.txUrl || '',
      tokenUrl: res.tokenUrl || ''
    }
    if (res.txHash) {
      startConfirmPolling(res.txHash)
    }
    zenAudio.playTempleBell()
  } catch (e: any) {
    mintError.value = e?.message || 'Đã xảy ra lỗi khi đúc NFT CIP-68.'
  } finally {
    isMinting.value = false
  }
}

const ownershipBadgeText = computed(() => {
  if (!props.isOwned) return 'Chưa khai quang'
  if (props.copyCount && props.copyCount > 1) return `Đã sở hữu (x${props.copyCount})`
  return 'Đã khai quang'
})

const rarityBadge = computed(() => {
  switch (props.card.rarity) {
    case 'legendary': return { label: 'Chân Như · Bậc IV', color: 'text-amber-300', bg: 'bg-amber-400/15 border-amber-400/40' }
    case 'epic': return { label: 'Giác Ngộ · Bậc III', color: 'text-purple-300', bg: 'bg-purple-400/15 border-purple-400/40' }
    case 'rare': return { label: 'Tinh Tấn · Bậc II', color: 'text-sky-300', bg: 'bg-sky-400/15 border-sky-400/40' }
    default: return { label: 'Thường · Bậc I', color: 'text-secondary', bg: 'bg-surface-elevated border-hairline' }
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 overflow-y-auto">
      <div
        class="w-full max-w-lg bg-surface-card border border-hairline rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto my-auto">
        <!-- Header Modal -->
        <div class="flex items-center justify-between border-b border-hairline pb-3">
          <div class="flex items-center gap-2.5">
            <ZenIcon :name="card.category === 'wisdom' ? 'lotus' : 'pagoda'" :size="20" class="text-gold shrink-0" />
            <div>
              <div class="text-xs text-secondary font-medium">
                {{ card.country }} · {{ card.category === 'wisdom' ? 'Triết Lý Thiền' : 'Kiến Trúc Cổ Tự' }}
              </div>
              <h3 class="text-sm font-bold text-white leading-snug m-0">
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
          <!-- Thanh chuyển đổi Mặt Trước / Mặt Sau & Trạng thái (1 hàng gọn gàng, không xuống dòng) -->
          <div class="flex items-center justify-between gap-2 flex-nowrap">
            <div class="flex items-center gap-1.5 min-w-0 flex-nowrap">
              <UiBadge :variant="isOwned ? 'success' : 'neutral'" class="whitespace-nowrap shrink-0">
                {{ ownershipBadgeText }}
              </UiBadge>
              <span class="px-2 py-0.5 rounded-[2px] border text-xs font-semibold whitespace-nowrap shrink-0"
                :class="[rarityBadge.color, rarityBadge.bg]">
                {{ rarityBadge.label }}
              </span>
            </div>

            <button type="button"
              class="px-2.5 py-1 rounded-[2px] bg-surface-card border border-hairline text-xs font-medium text-gold hover:border-gold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              @click="toggleSide">
              <ZenIcon name="chevron-right" :size="16" />
              <span>{{ currentSide === 'front' ? 'Mặt Sau' : 'Mặt Trước' }}</span>
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
              <div class="text-xs text-gold font-bold flex items-center gap-1.5">
                <ZenIcon name="sparkles" :size="12" />
                <span>Ý Nghĩa Chánh Niệm</span>
              </div>
              <p class="text-xs text-white leading-relaxed m-0">
                {{ card.meaning }}
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-surface-card border border-hairline/70 space-y-1">
              <div class="text-xs text-secondary font-semibold flex items-center gap-1.5">
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
              <div class="text-xs text-gold font-bold">Kinh Văn Kệ</div>
              <div class="text-xs text-white italic leading-relaxed whitespace-pre-line">
                "{{ card.scriptureText }}"
              </div>
            </div>

            <!-- Thuyết minh Audio (chống tràn lề phải bằng min-w-0 flex-1) -->
            <div
              class="p-3 rounded-[2px] bg-surface-card border border-hairline flex items-center justify-between gap-2.5 overflow-hidden">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  class="w-9 h-9 rounded-full bg-surface-elevated border border-hairline flex items-center justify-center text-primary shrink-0">
                  <ZenIcon name="volume-2" :size="16" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-semibold text-white truncate">Thuyết Minh Âm Thanh</div>
                  <div class="text-xs text-secondary truncate">{{ card.audioNarrator || 'Audio thiền tịnh tâm' }}</div>
                </div>
              </div>

              <button type="button"
                class="px-3 py-1.5 rounded-[2px] border border-gold/60 text-xs font-medium text-gold hover:bg-gold/15 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                @click="toggleNarration">
                {{ isNarrating ? 'Tạm Dừng' : 'Phát Audio' }}
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

        <!-- Trạng thái Mint NFT CIP-68 on-chain -->
        <div v-if="mintError"
          class="p-3 rounded-[2px] bg-surface-elevated border border-[#f6465d]/60 text-xs text-[#f6465d] flex items-start gap-2">
          <ZenIcon name="circle-alert" :size="16" class="shrink-0 mt-0.5" />
          <span class="leading-relaxed">{{ mintError }}</span>
        </div>

        <div v-else-if="isAlreadyMinted"
          class="p-3 rounded-[2px] bg-surface-elevated border text-xs space-y-1.5"
          :class="isConfirmingOnChain ? 'border-gold/50' : 'border-[#0ecb81]/40'">
          <div class="flex items-center justify-between gap-2">
            <span v-if="isConfirmingOnChain" class="font-bold text-gold flex items-center gap-1.5">
              <ZenIcon name="loader-circle" :size="16" />
              <span>Đang xác nhận lên block Cardano (~20-40s)...</span>
            </span>
            <span v-else class="font-bold text-[#0ecb81] flex items-center gap-1.5">
              <ZenIcon name="circle-check" :size="16" />
              <span>Đã Đúc NFT CIP-68 Trên Cardano</span>
            </span>
            <span class="font-numbers text-secondary">{{ walletStore.network }}</span>
          </div>
          <div v-if="activeMintAssetId" class="font-numbers text-secondary truncate">
            Asset (222): <span class="text-white">{{ activeMintAssetId.slice(0, 14) }}…{{ activeMintAssetId.slice(-8) }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 pt-0.5 font-numbers">
            <span
              v-if="isConfirmingOnChain"
              class="inline-flex items-center gap-1.5 text-secondary cursor-wait"
            >
              <ZenIcon name="loader-circle" :size="16" class="text-gold" />
              <span>Đang đợi Cardanoscan lập chỉ mục...</span>
            </span>
            <template v-else>
              <a v-if="activeMintTxUrl" :href="activeMintTxUrl" target="_blank" rel="noopener noreferrer"
                class="text-gold hover:underline">
                Xem giao dịch Cardanoscan
              </a>
              <a v-if="activeMintTokenUrl" :href="activeMintTokenUrl" target="_blank" rel="noopener noreferrer"
                class="text-[#0ecb81] hover:underline">
                Xem NFT CIP-68
              </a>
            </template>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-hairline grid grid-cols-2 gap-2.5 text-xs">
          <UiButton variant="secondary" size="sm" class="text-xs font-medium" @click="handleDownloadWallpaper">
            <ZenIcon name="sparkles" :size="14" class="mr-1.5" />
            <span>{{ downloadSuccess ? 'Đã tải ảnh 4K!' : 'Tải Hình Nền 4K' }}</span>
          </UiButton>

          <UiButton
            variant="primary"
            size="sm"
            class="text-xs font-semibold"
            :disabled="!isOwned || isMinting || isAlreadyMinted"
            @click="handleMintNft"
          >
            <ZenIcon :name="isMinting ? 'loader-circle' : (isAlreadyMinted ? 'circle-check' : 'cards')" :size="14" class="mr-1.5" />
            <span>
              {{ isMinting ? 'Đang ký & Đúc...' : (isAlreadyMinted ? 'Đã Đúc CIP-68' : 'Đúc NFT CIP-68') }}
            </span>
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>