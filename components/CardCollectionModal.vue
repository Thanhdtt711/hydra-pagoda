<script setup lang="ts">
import { useCardsStore } from '~/stores/cards'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { zenAudio } from '~/lib/audio/ZenAudio'

const emit = defineEmits(['close'])
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

const selectedCard = ref(cardsStore.allCards[0])

const selectedCardPriceMc = computed(() => {
  const found = economy.cardCatalog.find(i => i.id === selectedCard.value.id)
  return found ? found.priceMc : 300
})

const isSelectedCardOwned = computed(() => {
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="geist-card max-w-4xl w-full h-[85vh] p-6 bg-[#111111] border border-white/15 relative flex flex-col">
      <!-- Close Button -->
      <button 
        @click="emit('close')" 
        class="absolute top-4 right-4 text-[#737373] hover:text-white text-sm font-mono h-6 w-6 flex items-center justify-center rounded-[4px] hover:bg-white/10 z-10"
      >
        ✕
      </button>

      <!-- Top Header & Filters -->
      <div class="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div>
          <div class="mono-eyebrow text-[#8f8f8f] mb-1">CARDANO ARCHIVE // HERITAGE COLLECTION</div>
          <h3 class="text-base font-semibold text-white tracking-tight font-display">Thư Viện Thẻ Bài Di Sản</h3>
          <p class="text-xs text-[#a1a1a1] mt-0.5">Kiến trúc cổ tự và tinh hoa triết lý kinh điển</p>
        </div>

        <div class="flex items-center gap-3 mr-8">
          <span class="text-xs font-mono text-amber-300 font-semibold">{{ economy.meritCoins.toLocaleString('vi-VN') }} MC</span>
          <!-- Filter Tabs -->
          <div class="flex gap-1 bg-[#171717] p-1 rounded-[8px] border border-white/10 text-xs">
            <button 
              @click="filterCategory = 'all'"
              :class="filterCategory === 'all' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
              class="px-2.5 py-1 rounded-[6px] font-medium transition-all"
            >
              Tất Cả
            </button>
            <button 
              @click="filterCategory = 'wisdom'"
              :class="filterCategory = 'wisdom' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
              class="px-2.5 py-1 rounded-[6px] font-medium transition-all"
            >
              Triết Lý
            </button>
            <button 
              @click="filterCategory = 'architecture'"
              :class="filterCategory === 'architecture' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
              class="px-2.5 py-1 rounded-[6px] font-medium transition-all"
            >
              Cổ Tự 3D
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content: Left List & Right Detail -->
      <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
        <!-- Card Selector List -->
        <div class="space-y-1.5 overflow-y-auto pr-1 md:col-span-1">
          <div 
            v-for="card in filteredCards" 
            :key="card.id"
            @click="selectedCard = card; showConfirm = false; mintNotice = null"
            :class="selectedCard.id === card.id ? 'border-white bg-[#1c1c1c]' : 'border-white/10 bg-[#141414] hover:border-white/20'"
            class="p-2.5 rounded-[6px] border cursor-pointer transition-all flex items-center gap-2.5"
          >
            <div class="w-8 h-8 rounded-[4px] bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-sm shrink-0">
              <ZenIcon :name="card.category === 'wisdom' ? 'lotus' : 'pagoda'" :size="15" class="text-white/80" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium text-white truncate">{{ card.title }}</div>
              <div class="text-[10px] text-[#737373] font-mono flex items-center gap-1.5 mt-0.5">
                <span>{{ card.country }}</span>
                <span>/</span>
                <span class="uppercase text-amber-300">{{ card.rarity }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Card Detail View -->
        <div class="bg-[#141414] p-5 rounded-[8px] border border-white/10 md:col-span-2 overflow-y-auto flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between mb-3 border-b border-white/10 pb-3">
              <div>
                <span class="mono-eyebrow text-[#0070f3]">
                  {{ selectedCard.category === 'wisdom' ? 'CATEGORY // WISDOM' : 'CATEGORY // ARCHITECTURE' }}
                </span>
                <h4 class="text-lg font-semibold text-white tracking-tight font-display mt-0.5">{{ selectedCard.title }}</h4>
                <div class="text-xs text-[#a1a1a1] mt-0.5 font-mono">{{ selectedCard.subtitle }} · {{ selectedCard.country }}</div>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  @click="toggleNarration"
                  :class="isNarrating ? 'bg-amber-400 text-black border-amber-400' : 'bg-white/5 text-[#a1a1a1] hover:text-white border-white/10'"
                  class="px-2.5 py-1 rounded-[4px] border text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <ZenIcon :name="isNarrating ? 'bell' : 'bell-off'" :size="12" />
                  <span>{{ isNarrating ? 'AUDIO ON' : 'AUDIO' }}</span>
                </button>
              </div>
            </div>

            <!-- Scripture Quote -->
            <div v-if="selectedCard.scriptureText" class="p-3 bg-[#1a1a1a] border border-white/10 rounded-[6px] mb-3.5 italic text-xs text-[#ededed] text-center leading-relaxed">
              "{{ selectedCard.scriptureText }}"
            </div>

            <!-- Meaning & Lore -->
            <div class="space-y-3 text-xs leading-relaxed">
              <div>
                <span class="mono-eyebrow block mb-1">Ý NGHĨA CỐT LÕI</span>
                <p class="text-[#ededed]">{{ selectedCard.meaning }}</p>
              </div>

              <div>
                <span class="mono-eyebrow block mb-1">ĐIỂN TÍCH & LỊCH SỬ</span>
                <p class="text-[#a1a1a1]">{{ selectedCard.lore }}</p>
              </div>
            </div>

            <div v-if="showConfirm" class="mt-3 p-3 bg-amber-400/10 border border-amber-400/30 rounded-[6px] flex items-center justify-between gap-2 text-xs">
              <span class="text-[#ededed]">
                Xác nhận tiêu <strong class="text-amber-300 font-mono">{{ selectedCardPriceMc.toLocaleString('vi-VN') }} MC</strong> để thỉnh thẻ bài <strong>{{ selectedCard.title }}</strong>?
              </span>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  @click="confirmUnlockCard"
                  :disabled="economy.isSpending"
                  class="px-3 py-1 rounded-[4px] bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs"
                >
                  Xác nhận
                </button>
                <button
                  @click="showConfirm = false"
                  class="px-2.5 py-1 rounded-[4px] bg-white/10 hover:bg-white/15 text-white text-xs"
                >
                  Hủy
                </button>
              </div>
            </div>

            <div v-if="mintNotice" class="mt-3 p-2 rounded-[4px] bg-amber-400/10 border border-amber-400/30 text-xs font-mono text-amber-300 text-center">
              {{ mintNotice }}
            </div>
          </div>

          <!-- Bottom Action -->
          <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span class="font-mono text-[10px] text-[#737373]">SERVER INVENTORY & MC LEDGER</span>
            <span v-if="isSelectedCardOwned" class="px-3 py-1 rounded-[4px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
              ✓ Đã sở hữu trong kho đồ
            </span>
            <div v-else class="flex items-center gap-2">
              <button 
                @click="promptUnlockCard"
                :disabled="economy.isSpending || !wallet.isAuthenticated || economy.meritCoins < selectedCardPriceMc"
                class="px-3 py-1.5 rounded-[6px] bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                <ZenIcon name="coin" :size="13" />
                <span>Thỉnh Thẻ Bài ({{ selectedCardPriceMc.toLocaleString('vi-VN') }} MC)</span>
              </button>
              <button
                v-if="wallet.isAuthenticated && economy.meritCoins < selectedCardPriceMc"
                @click="economy.openTopUpModal(); emit('close')"
                class="px-2.5 py-1.5 rounded-[6px] bg-[#0070f3]/20 text-[#38bdf8] border border-[#0070f3]/40 text-xs font-mono"
              >
                + Nạp MC
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
