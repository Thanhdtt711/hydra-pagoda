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

type ShopTab = 'attire' | 'offerings'
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
  <UiModal
    :model-value="true"
    title="Cửa Hàng Pháp Bảo & Tủ Đồ Cổ Phục"
    eyebrow="SANCTUARY BAZAAR // SERVER MC WALLET"
    data-testid="sanctuary-shop-modal"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4 text-xs font-sans">
      <!-- Currency Bar -->
      <div class="p-3 bg-surface-card rounded-md border border-hairline flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5 text-gold font-numbers font-medium">
            <ZenIcon name="coin" :size="14" />
            <span>{{ economy.meritCoins.toLocaleString('vi-VN') }} MC</span>
          </div>
          <div class="flex items-center gap-1.5 text-secondary font-numbers">
            <ZenIcon name="cardano" :size="14" />
            <span>{{ wallet.adaBalance }} ADA</span>
          </div>
        </div>
        <UiButton
          variant="secondary"
          size="sm"
          @click="economy.openTopUpModal(); emit('close')"
        >
          + Nạp MC
        </UiButton>
      </div>

      <!-- Category Tabs -->
      <div class="flex items-center gap-1 bg-surface-elevated p-1 rounded-md border border-hairline">
        <button 
          type="button"
          @click="activeTab = 'attire'"
          :class="activeTab === 'attire' ? 'bg-gold text-canvas-dark font-semibold' : 'text-secondary hover:text-white'"
          class="flex-1 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <ZenIcon name="sparkles" :size="13" />
          <span>Tủ Đồ Cổ Phục</span>
        </button>
        <button 
          type="button"
          @click="activeTab = 'offerings'"
          :class="activeTab === 'offerings' ? 'bg-gold text-canvas-dark font-semibold' : 'text-secondary hover:text-white'"
          class="flex-1 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <ZenIcon name="incense" :size="13" />
          <span>Đồ Lễ Cúng Dường</span>
        </button>
      </div>

      <!-- Confirmation Bar -->
      <div v-if="pendingItem" class="p-3 bg-surface-elevated border border-gold/40 rounded-md flex flex-col gap-2 text-xs">
        <span class="text-primary">
          Xác nhận tiêu <strong class="text-gold font-numbers">{{ pendingItem.priceMc.toLocaleString('vi-VN') }} MC</strong> để thỉnh <strong>{{ pendingItem.name }}</strong>?
        </span>
        <div class="flex items-center justify-end gap-2">
          <UiButton
            variant="secondary"
            size="sm"
            @click="pendingItem = null"
          >
            Hủy
          </UiButton>
          <UiButton
            variant="primary"
            size="sm"
            :disabled="economy.isSpending"
            @click="confirmBuy"
          >
            {{ economy.isSpending ? 'Đang xử lý...' : 'Xác nhận' }}
          </UiButton>
        </div>
      </div>

      <!-- Purchase Toast Notice -->
      <div v-if="purchaseNotice" class="p-2.5 bg-surface-elevated border border-gold/30 rounded-md text-xs text-gold text-center font-numbers">
        {{ purchaseNotice }}
      </div>

      <!-- Products Grid -->
      <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        <div 
          v-for="item in currentItems" 
          :key="item.id"
          class="p-3 bg-surface-card border border-hairline rounded-md flex flex-col gap-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-numbers text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-elevated text-secondary border border-hairline">
                  {{ item.countryCode }}
                </span>
                <span class="text-xs font-semibold text-white tracking-tight">{{ item.name }}</span>
              </div>
              <div class="text-xs text-secondary mt-1">{{ item.subname }}</div>
            </div>
            <div class="flex items-center gap-1">
              <span v-if="economy.getItemQuantity(item.id) > 0 && item.stackable" class="font-numbers text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-gold border border-hairline">
                x{{ economy.getItemQuantity(item.id) }}
              </span>
              <span v-if="user.currentCountry === item.countryId" class="font-numbers text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-trading-up border border-hairline">
                ĐANG MẶC
              </span>
            </div>
          </div>

          <!-- Price & Action Buttons -->
          <div class="pt-2 border-t border-hairline flex items-center justify-between gap-2">
            <UiButton 
              v-if="item.countryId && economy.isItemUnlocked(item)"
              variant="secondary"
              size="sm"
              @click="previewOutfit(item)"
            >
              Mặc Ngay
            </UiButton>
            <UiButton 
              v-else-if="item.countryId"
              variant="secondary"
              size="sm"
              @click="previewOutfit(item)"
            >
              Mặc Thử
            </UiButton>

            <div class="flex items-center gap-2 ml-auto">
              <span v-if="!item.stackable && economy.isItemUnlocked(item)" class="text-xs font-numbers text-trading-up">
                Đã sở hữu
              </span>
              <template v-else-if="item.priceMc > 0">
                <UiButton 
                  variant="primary"
                  size="sm"
                  :disabled="!wallet.isAuthenticated || economy.meritCoins < item.priceMc"
                  @click="promptBuy(item)"
                >
                  <ZenIcon name="coin" :size="13" class="mr-1" />
                  <span><span class="font-numbers">{{ item.priceMc.toLocaleString('vi-VN') }}</span> MC</span>
                </UiButton>
                <UiButton
                  v-if="wallet.isAuthenticated && economy.meritCoins < item.priceMc"
                  variant="secondary"
                  size="sm"
                  @click="economy.openTopUpModal(); emit('close')"
                >
                  Nạp MC
                </UiButton>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="pt-2 border-t border-hairline text-xs text-secondary">
        Mọi giao dịch vật phẩm đều lưu kho đồ & sổ cái MC trên máy chủ.
      </div>
    </div>
  </UiModal>
</template>
