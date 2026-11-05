<script setup lang="ts">
import { useEconomyStore, type ShopCatalogItem } from '~/stores/economy'
import { useUserStore, type CountryId } from '~/stores/user'
import { useWalletStore } from '~/stores/wallet'
import { zenAudio } from '~/lib/audio/ZenAudio'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'outfitChanged', countryId: CountryId): void
}>()

const economy = useEconomyStore()
const user = useUserStore()
const wallet = useWalletStore()

type ShopTab = 'offerings' | 'attire'
const activeTab = ref<ShopTab>('attire')
const purchaseNotice = ref<string | null>(null)
const pendingItem = ref<ShopCatalogItem | null>(null)

const currentItems = computed(() => activeTab.value === 'attire' ? economy.attireCatalog : economy.offeringCatalog)

onMounted(async () => {
  await economy.fetchCatalog()
})

function promptBuy(item: ShopCatalogItem) {
  if (!wallet.isAuthenticated) {
    showNotice('Vui lòng kết nối và đăng nhập ví Eternl để mua vật phẩm bằng MC!')
    return
  }
  if (economy.meritCoins < item.priceMc) {
    showNotice(`Số dư MC không đủ (${economy.meritCoins.toLocaleString('vi-VN')} / ${item.priceMc.toLocaleString('vi-VN')} MC). Hãy nạp thêm MC!`)
    return
  }
  pendingItem.value = item
}

async function confirmBuy() {
  const item = pendingItem.value
  if (!item) return
  try {
    const res = await economy.buyShopItem(item.id)
    pendingItem.value = null
    zenAudio.playCoinDrop()
    if (item.countryId) {
      user.setCountry(item.countryId as CountryId)
      emit('outfitChanged', item.countryId as CountryId)
      showNotice(`Đã mở khóa & khoác: ${res.item.name} (-${res.item.priceMc.toLocaleString('vi-VN')} MC)!`)
    } else {
      showNotice(`Đã thỉnh thành công: ${res.item.name} (-${res.item.priceMc.toLocaleString('vi-VN')} MC)!`)
    }
  } catch (err: any) {
    showNotice(err?.data?.message || err?.message || 'Không thể mua vật phẩm.')
  }
}

function previewOutfit(item: ShopCatalogItem) {
  if (item.countryId) {
    user.setCountry(item.countryId as CountryId)
    emit('outfitChanged', item.countryId as CountryId)
    zenAudio.playWoodenFish()
  }
}

function showNotice(msg: string) {
  purchaseNotice.value = msg
  setTimeout(() => {
    purchaseNotice.value = null
  }, 4500)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Box -->
    <div class="relative w-full max-w-2xl bg-[#111111] border border-white/15 rounded-[8px] shadow-2xl overflow-hidden font-sans">
      <!-- Header -->
      <div class="p-4 bg-[#171717] border-b border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-[4px] bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
            <ZenIcon name="pagoda" :size="16" />
          </div>
          <div>
            <div class="mono-eyebrow text-[#888888]">SANCTUARY BAZAAR // SERVER MC WALLET</div>
            <h3 class="text-sm font-semibold text-white tracking-tight font-display">Cửa Hàng Pháp Bảo & Tủ Đồ Cổ Phục</h3>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-7 h-7 flex items-center justify-center rounded-[4px] text-[#888888] hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZenIcon name="close" :size="15" />
        </button>
      </div>

      <!-- Currency Bar -->
      <div class="px-4 py-2.5 bg-[#141414] border-b border-white/5 flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 text-amber-300 font-semibold">
            <ZenIcon name="coin" :size="13" />
            <span>{{ economy.meritCoins.toLocaleString('vi-VN') }} MC</span>
          </div>
          <div class="flex items-center gap-1.5 text-[#0070f3]">
            <ZenIcon name="cardano" :size="13" />
            <span>{{ wallet.adaBalance }} ADA</span>
          </div>
        </div>
        <button
          @click="economy.openTopUpModal(); emit('close')"
          class="px-2.5 py-1 rounded-[4px] bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[10px] font-mono font-semibold"
        >
          + Nạp MC
        </button>
      </div>

      <!-- Category Tabs -->
      <div class="p-3 bg-[#161616] border-b border-white/10 flex items-center gap-2">
        <button 
          @click="activeTab = 'attire'"
          :class="activeTab === 'attire' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
          class="px-3 py-1 rounded-[4px] text-xs transition-colors flex items-center gap-1.5"
        >
          <ZenIcon name="sparkles" :size="13" />
          <span>Tủ Đồ Cổ Phục 9 Quốc Gia</span>
        </button>
        <button 
          @click="activeTab = 'offerings'"
          :class="activeTab === 'offerings' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
          class="px-3 py-1 rounded-[4px] text-xs transition-colors flex items-center gap-1.5"
        >
          <ZenIcon name="incense" :size="13" />
          <span>Đồ Lễ Cúng Dường & Nhang Trầm</span>
        </button>
      </div>

      <!-- Confirmation Bar -->
      <div v-if="pendingItem" class="p-3 bg-amber-400/10 border-b border-amber-400/30 flex items-center justify-between gap-3 text-xs">
        <span class="text-[#ededed]">
          Xác nhận tiêu <strong class="text-amber-300 font-mono">{{ pendingItem.priceMc.toLocaleString('vi-VN') }} MC</strong> để thỉnh <strong>{{ pendingItem.name }}</strong>?
        </span>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="confirmBuy"
            :disabled="economy.isSpending"
            class="px-3 py-1 rounded-[4px] bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs disabled:opacity-50"
          >
            {{ economy.isSpending ? 'Đang xử lý...' : 'Xác nhận' }}
          </button>
          <button
            @click="pendingItem = null"
            class="px-2.5 py-1 rounded-[4px] bg-white/10 hover:bg-white/15 text-white text-xs"
          >
            Hủy
          </button>
        </div>
      </div>

      <!-- Purchase Toast Notice -->
      <div v-if="purchaseNotice" class="p-2.5 bg-amber-400/10 border-b border-amber-400/20 text-xs text-amber-300 text-center font-mono">
        {{ purchaseNotice }}
      </div>

      <!-- Products Grid -->
      <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto">
        <div 
          v-for="item in currentItems" 
          :key="item.id"
          class="p-3 bg-[#161616] border border-white/10 hover:border-white/20 rounded-[6px] flex flex-col justify-between transition-all"
        >
          <div class="flex items-start justify-between mb-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono text-[9px] font-bold px-1 py-0.2 rounded-[2px] bg-white/10 text-white">
                  {{ item.countryCode }}
                </span>
                <span class="text-xs font-semibold text-white tracking-tight">{{ item.name }}</span>
              </div>
              <div class="text-[11px] text-[#737373] mt-1">{{ item.subname }}</div>
            </div>
            <div class="flex items-center gap-1">
              <span v-if="economy.getItemQuantity(item.id) > 0 && item.stackable" class="font-mono text-[9px] px-1.5 py-0.5 rounded-[2px] bg-sky-500/15 text-sky-300 border border-sky-500/30">
                x{{ economy.getItemQuantity(item.id) }}
              </span>
              <span v-if="user.currentCountry === item.countryId" class="font-mono text-[9px] px-1.5 py-0.5 rounded-[2px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ĐANG MẶC
              </span>
            </div>
          </div>

          <!-- Price & Action Buttons -->
          <div class="pt-2 border-t border-white/5 flex items-center justify-between gap-1 text-[11px]">
            <button 
              v-if="item.countryId && economy.isItemUnlocked(item)"
              @click="previewOutfit(item)"
              class="px-2 py-1 rounded-[3px] bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono transition-colors"
            >
              Mặc Ngay
            </button>
            <button 
              v-else-if="item.countryId"
              @click="previewOutfit(item)"
              class="px-2 py-1 rounded-[3px] bg-white/5 hover:bg-white/15 text-[#a1a1a1] hover:text-white text-[10px] font-mono transition-colors"
            >
              Mặc Thử
            </button>

            <div class="flex items-center gap-1.5 ml-auto">
              <span v-if="!item.stackable && economy.isItemUnlocked(item)" class="text-[10px] font-mono text-emerald-400">
                Đã sở hữu
              </span>
              <template v-else-if="item.priceMc > 0">
                <button 
                  @click="promptBuy(item)"
                  :disabled="!wallet.isAuthenticated || economy.meritCoins < item.priceMc"
                  class="px-2.5 py-1 rounded-[4px] bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-center gap-1 transition-colors disabled:opacity-40"
                >
                  <ZenIcon name="coin" :size="10" />
                  <span>{{ item.priceMc.toLocaleString('vi-VN') }} MC</span>
                </button>
                <button
                  v-if="wallet.isAuthenticated && economy.meritCoins < item.priceMc"
                  @click="economy.openTopUpModal(); emit('close')"
                  class="px-2 py-1 rounded-[4px] bg-[#0070f3]/20 text-[#38bdf8] border border-[#0070f3]/40 text-[9px] font-mono"
                >
                  Nạp MC
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 bg-[#171717] border-t border-white/10 flex items-center justify-between text-[11px] text-[#737373]">
        <span>Mọi giao dịch vật phẩm đều lưu kho đồ & sổ cái MC trên máy chủ.</span>
        <button 
          @click="emit('close')"
          class="px-3.5 py-1 bg-white text-black font-semibold rounded-[4px] text-xs hover:bg-white/90 transition-all"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
</template>
