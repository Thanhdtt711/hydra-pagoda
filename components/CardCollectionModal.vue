<script setup lang="ts">
import { useCardsStore } from '~/stores/cards'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { zenAudio } from '~/lib/audio/ZenAudio'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const cardsStore = useCardsStore()
const economy = useEconomyStore()
const wallet = useWalletStore()

const filterCategory = ref<'all' | 'wisdom' | 'architecture'>('all')
const isNarrating = ref(false)
const mintNotice = ref<string | null>(null)
const showConfirm = ref(false)

const filteredCards = computed(() => {
  if (filterCategory.value === 'all') return cardsStore.allCards
  return cardsStore.allCards.filter(c => c.category === filterCategory.value)
})

const selectedCard = ref(cardsStore.allCards[0] || {
  id: '',
  title: '',
  subtitle: '',
  category: 'wisdom',
  country: '',
  rarity: 'common',
  scriptureText: '',
  meaning: '',
  lore: ''
})

const selectedCardPriceMc = computed(() => {
  const found = economy.cardCatalog.find(i => i.id === selectedCard.value?.id)
  return found ? found.priceMc : 300
})

const isSelectedCardOwned = computed(() => {
  if (!selectedCard.value) return false
  const found = economy.cardCatalog.find(i => i.id === selectedCard.value.id)
  if (found) return economy.isItemUnlocked(found)
  return economy.ownedItemIds.has(selectedCard.value.id)
})

onMounted(async () => {
  await economy.fetchCatalog()
})

function toggleNarration() {
  isNarrating.value = !isNarrating.value
  zenAudio.playSingingBowl()
}

function promptUnlockCard() {
  mintNotice.value = null
  if (!wallet.isAuthenticated) {
    mintNotice.value = 'Vui lòng kết nối ví Eternl để thỉnh thẻ bài di sản!'
    return
  }
  if (economy.meritCoins < selectedCardPriceMc.value) {
    mintNotice.value = `Không đủ MC (${economy.meritCoins.toLocaleString('vi-VN')} / ${selectedCardPriceMc.value.toLocaleString('vi-VN')} MC).`
    return
  }
  showConfirm.value = true
}

async function confirmUnlockCard() {
  showConfirm.value = false
  try {
    const res = await economy.buyShopItem(selectedCard.value.id)
    zenAudio.playTempleBell()
    zenAudio.playCoinDrop()
    mintNotice.value = `Đã thỉnh thẻ bài "${res.item.name}" vào kho đồ (-${res.item.priceMc.toLocaleString('vi-VN')} MC)!`
  } catch (err: any) {
    mintNotice.value = err?.data?.message || err?.message || 'Không thể thỉnh thẻ bài.'
  }
}
</script>

<template>
  <UiModal
    :model-value="true"
    title="Thư Viện Thẻ Bài Di Sản"
    eyebrow="CARDANO ARCHIVE // HERITAGE COLLECTION"
    data-testid="card-collection-modal"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4 text-xs font-sans">
      <!-- Balance & Filter Tabs -->
      <div class="flex items-center justify-between gap-2 border-b border-hairline pb-3">
        <div class="flex items-center gap-1.5 text-gold font-numbers font-medium text-xs">
          <ZenIcon name="coin" :size="14" />
          <span>{{ economy.meritCoins.toLocaleString('vi-VN') }} MC</span>
        </div>

        <div class="flex items-center gap-1 bg-surface-elevated p-1 rounded-md border border-hairline text-xs">
          <button 
            type="button"
            @click="filterCategory = 'all'"
            :class="filterCategory === 'all' ? 'bg-gold text-canvas-dark font-semibold' : 'text-secondary hover:text-white'"
            class="px-2.5 py-1 rounded text-xs transition-colors"
          >
            Tất Cả
          </button>
          <button 
            type="button"
            @click="filterCategory = 'wisdom'"
            :class="filterCategory === 'wisdom' ? 'bg-gold text-canvas-dark font-semibold' : 'text-secondary hover:text-white'"
            class="px-2.5 py-1 rounded text-xs transition-colors"
          >
            Triết Lý
          </button>
          <button 
            type="button"
            @click="filterCategory = 'architecture'"
            :class="filterCategory === 'architecture' ? 'bg-gold text-canvas-dark font-semibold' : 'text-secondary hover:text-white'"
            class="px-2.5 py-1 rounded text-xs transition-colors"
          >
            Cổ Tự 3D
          </button>
        </div>
      </div>

      <!-- Card Selector List -->
      <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        <div 
          v-for="card in filteredCards" 
          :key="card.id"
          @click="selectedCard = card; showConfirm = false; mintNotice = null"
          :class="selectedCard?.id === card.id ? 'border-gold bg-surface-elevated' : 'border-hairline bg-surface-card hover:border-hairline'"
          class="p-2.5 rounded-md border cursor-pointer transition-colors flex items-center gap-2.5"
        >
          <div class="w-8 h-8 rounded bg-surface-elevated border border-hairline flex items-center justify-center text-xs shrink-0 text-gold">
            <ZenIcon :name="card.category === 'wisdom' ? 'lotus' : 'pagoda'" :size="16" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-medium text-white truncate">{{ card.title }}</div>
            <div class="text-xs text-secondary font-numbers flex items-center gap-1.5 mt-0.5">
              <span>{{ card.country }}</span>
              <span>/</span>
              <span class="uppercase text-gold">{{ card.rarity }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Selected Card Detail View -->
      <div v-if="selectedCard" class="bg-surface-card p-4 rounded-md border border-hairline flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2 border-b border-hairline pb-3">
          <div>
            <div class="text-xs text-gold uppercase tracking-wider font-numbers">
              {{ selectedCard.category === 'wisdom' ? 'CATEGORY // WISDOM' : 'CATEGORY // ARCHITECTURE' }}
            </div>
            <h4 class="text-sm font-semibold text-white tracking-tight mt-0.5">{{ selectedCard.title }}</h4>
            <div class="text-xs text-secondary mt-0.5 font-numbers">{{ selectedCard.subtitle }} · {{ selectedCard.country }}</div>
          </div>
          <UiButton 
            variant="secondary"
            size="sm"
            @click="toggleNarration"
          >
            <ZenIcon :name="isNarrating ? 'bell' : 'bell-off'" :size="14" class="mr-1 text-gold" />
            <span>{{ isNarrating ? 'BẬT ÂM' : 'TẮT ÂM' }}</span>
          </UiButton>
        </div>

        <!-- Scripture Quote -->
        <div v-if="selectedCard.scriptureText" class="p-3 bg-surface-elevated border border-hairline rounded-md italic text-xs text-primary leading-relaxed text-center">
          "{{ selectedCard.scriptureText }}"
        </div>

        <!-- Meaning & Lore -->
        <div class="space-y-2 text-xs leading-relaxed">
          <div>
            <span class="text-xs font-semibold text-secondary uppercase block mb-0.5">Ý NGHĨA CỐT LÕI</span>
            <p class="text-primary">{{ selectedCard.meaning }}</p>
          </div>
          <div>
            <span class="text-xs font-semibold text-secondary uppercase block mb-0.5">ĐIỂN TÍCH & LỊCH SỬ</span>
            <p class="text-secondary">{{ selectedCard.lore }}</p>
          </div>
        </div>

        <!-- Confirm Spend Box -->
        <div v-if="showConfirm" class="p-3 bg-surface-elevated border border-gold/40 rounded-md flex flex-col gap-2 text-xs">
          <span class="text-primary">
            Xác nhận tiêu <strong class="text-gold font-numbers">{{ selectedCardPriceMc.toLocaleString('vi-VN') }} MC</strong> để thỉnh thẻ bài <strong>{{ selectedCard.title }}</strong>?
          </span>
          <div class="flex items-center justify-end gap-2">
            <UiButton
              variant="secondary"
              size="sm"
              @click="showConfirm = false"
            >
              Hủy
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              :disabled="economy.isSpending"
              @click="confirmUnlockCard"
            >
              Xác nhận
            </UiButton>
          </div>
        </div>

        <div v-if="mintNotice" class="p-2 rounded bg-surface-elevated border border-gold/30 text-xs font-numbers text-gold text-center">
          {{ mintNotice }}
        </div>

        <!-- Card Ownership / Purchase Action -->
        <div class="pt-3 border-t border-hairline flex items-center justify-between gap-2">
          <span class="font-numbers text-xs text-secondary">MC LEDGER</span>
          <span v-if="isSelectedCardOwned" class="text-trading-up text-xs font-numbers font-medium">
            Đã sở hữu trong kho đồ
          </span>
          <div v-else class="flex items-center gap-2">
            <UiButton 
              variant="primary"
              size="sm"
              :disabled="economy.isSpending || !wallet.isAuthenticated || economy.meritCoins < selectedCardPriceMc"
              @click="promptUnlockCard"
            >
              <ZenIcon name="coin" :size="14" class="mr-1" />
              <span>Thỉnh Thẻ (<span class="font-numbers">{{ selectedCardPriceMc.toLocaleString('vi-VN') }}</span> MC)</span>
            </UiButton>
            <UiButton
              v-if="wallet.isAuthenticated && economy.meritCoins < selectedCardPriceMc"
              variant="secondary"
              size="sm"
              @click="economy.openTopUpModal(); emit('close')"
            >
              + Nạp MC
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>
