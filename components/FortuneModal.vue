<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { useEconomyStore, type FortuneCategory, type FortuneTierId, type ServerFortuneResult } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import ZenIcon from '~/components/ZenIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const economy = useEconomyStore()
const wallet = useWalletStore()

const currentTab = ref<FortuneCategory>('stick')
const selectedTier = ref<FortuneTierId>('auspicious')
const isPerformingRitual = ref(false)
const showConfirm = ref(false)
const errorMessage = ref<string | null>(null)
const fortuneResult = ref<ServerFortuneResult | null>(null)

const TAB_CONFIGS = [
  { id: 'stick', name: 'Xin Xăm', sub: 'Bát Quái 100 Quẻ', icon: 'cards' },
  { id: 'love', name: 'Tình Duyên', sub: 'Nguyệt Lão Chỉ Đỏ', icon: 'lotus' },
  { id: 'family', name: 'Cầu Tự', sub: 'Quan Âm Tống Tử', icon: 'sparkles' },
  { id: 'wealth', name: 'Tiền Tài', sub: 'Chiêu Tài Thần Tài', icon: 'coin' },
  { id: 'health', name: 'Sức Khỏe', sub: 'Dược Sư Diên Thọ', icon: 'incense' },
  { id: 'star', name: 'Dâng Sao', sub: 'Bắc Đẩu Giải Hạn', icon: 'sunset' }
]

const currentTierCostMc = computed(() => {
  const tier = economy.fortuneTiers.find(t => t.id === selectedTier.value)
  return tier ? tier.costMc : 50
})

onMounted(async () => {
  await economy.fetchCatalog()
})

function promptDrawFortune() {
  errorMessage.value = null
  if (!wallet.isAuthenticated) {
    errorMessage.value = 'Vui lòng kết nối và đăng nhập ví Eternl để gieo quẻ!'
    return
  }
  if (economy.meritCoins < currentTierCostMc.value) {
    errorMessage.value = `Không đủ MC (${economy.meritCoins.toLocaleString('vi-VN')} / ${currentTierCostMc.value.toLocaleString('vi-VN')} MC). Vui lòng nạp thêm MC!`
    return
  }
  showConfirm.value = true
}

async function confirmDrawFortune() {
  showConfirm.value = false
  errorMessage.value = null
  isPerformingRitual.value = true

  zenAudio.playTempleBell()
  zenAudio.playWoodenFish()

  try {
    const res = await economy.drawServerFortune(currentTab.value, selectedTier.value)
    if (res.success && res.fortune) {
      fortuneResult.value = res.fortune
      zenAudio.playGong()
    } else {
      errorMessage.value = res.error || 'Gieo quẻ thất bại.'
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Không thể gieo quẻ.'
  } finally {
    isPerformingRitual.value = false
  }
}
</script>

<template>
  <UiModal
    title="Bàn Gieo Quẻ Dân Gian"
    subtitle="Tiền Tài · Tình Duyên · Cầu Tự · Sức Khỏe · Dâng Sao"
    @close="emit('close')"
  >
    <div class="space-y-4 font-sans text-primary">
      <!-- Compliance Notice -->
      <div class="bg-surface-elevated border border-hairline rounded-[6px] p-3 text-xs text-secondary flex items-start gap-2.5">
        <ZenIcon name="info" :size="16" class="text-gold shrink-0 mt-0.5" />
        <span class="leading-normal">Kết quả quẻ được sinh ngẫu nhiên an toàn trên máy chủ và lưu vào lịch sử tài khoản. Nội dung mang tính văn hóa dân gian hư cấu &amp; chánh niệm.</span>
      </div>

      <!-- 6 Category Tabs Grid -->
      <div class="grid grid-cols-3 gap-1.5 p-1 bg-surface-elevated rounded-[6px] border border-hairline">
        <button 
          v-for="t in TAB_CONFIGS"
          :key="t.id"
          type="button"
          @click="currentTab = t.id as FortuneCategory; fortuneResult = null; errorMessage = null; showConfirm = false"
          :class="currentTab === t.id ? 'bg-surface-card text-primary font-semibold border-primary' : 'text-secondary hover:text-primary hover:bg-surface-card border-transparent'"
          class="py-2 px-1.5 rounded-[4px] border text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <ZenIcon :name="t.icon as any" :size="14" />
          <span class="text-xs font-medium leading-none">{{ t.name }}</span>
        </button>
      </div>

      <!-- User Currency Balance Strip -->
      <div class="px-3 py-2 bg-surface-elevated border border-hairline rounded-[6px] flex items-center justify-between text-xs font-numbers">
        <div class="flex items-center gap-3">
          <span class="text-secondary text-xs uppercase font-sans">Số dư:</span>
          <span class="text-gold flex items-center gap-1 font-semibold">
            {{ economy.meritCoins.toLocaleString('vi-VN') }} MC
          </span>
          <span class="text-info flex items-center gap-1 font-medium">
            {{ wallet.adaBalance }} ADA
          </span>
        </div>
        <button
          type="button"
          @click="economy.openTopUpModal(); emit('close')"
          class="px-2 py-1 rounded-[4px] bg-primary text-ink text-xs font-bold cursor-pointer border-none hover:bg-primary-active transition-colors"
        >
          + Nạp MC
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="p-3 bg-trading-down/10 border border-trading-down/30 text-xs text-trading-down rounded-[6px] text-center font-numbers">
        {{ errorMessage }}
      </div>

      <!-- Pre-Divination View: Tier Selection -->
      <div v-if="!fortuneResult" class="space-y-3.5">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-1.5">CHỌN CẤP ĐỘ THỈNH QUẺ (MC):</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div 
              v-for="tier in economy.fortuneTiers"
              :key="tier.id"
              @click="selectedTier = tier.id; showConfirm = false"
              :class="selectedTier === tier.id ? 'border-primary bg-surface-elevated' : 'border-hairline bg-surface-card hover:bg-surface-elevated'"
              class="p-2.5 rounded-[6px] border cursor-pointer transition-colors flex flex-col justify-between"
            >
              <div>
                <div class="text-xs font-semibold text-primary">{{ tier.label }}</div>
                <div class="text-xs text-secondary mt-0.5 leading-tight">{{ tier.description }}</div>
              </div>
              <div class="mt-2 text-xs font-numbers font-bold text-gold">{{ tier.costMc.toLocaleString('vi-VN') }} MC</div>
            </div>
          </div>
        </div>

        <!-- Confirmation Box -->
        <div v-if="showConfirm" class="p-3 bg-primary/10 border border-primary/30 rounded-[6px] flex items-center justify-between gap-2 text-xs">
          <span class="text-primary leading-tight">
            Xác nhận tiêu <strong class="text-gold font-numbers">{{ currentTierCostMc.toLocaleString('vi-VN') }} MC</strong> để gieo quẻ?
          </span>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              @click="confirmDrawFortune"
              :disabled="isPerformingRitual"
              class="px-3 py-1 rounded-[4px] bg-primary hover:bg-primary-active text-ink font-semibold text-xs border-none cursor-pointer"
            >
              Xác nhận
            </button>
            <button
              type="button"
              @click="showConfirm = false"
              class="px-2 py-1 rounded-[4px] bg-surface-card text-secondary hover:text-primary text-xs border border-hairline cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>

        <!-- Action Button -->
        <div class="pt-2">
          <UiButton 
            variant="primary"
            block
            :loading="isPerformingRitual"
            :disabled="isPerformingRitual || !wallet.isAuthenticated || economy.meritCoins < currentTierCostMc"
            @click="promptDrawFortune"
          >
            {{ isPerformingRitual ? 'Đang Khấn Nguyện Gieo Quẻ...' : `Thành Tâm Gieo Quẻ (${currentTierCostMc} MC)` }}
          </UiButton>
        </div>
      </div>

      <!-- Result View -->
      <div v-else class="space-y-3.5">
        <div class="flex items-start justify-between border-b border-hairline pb-3">
          <div>
            <div class="text-xs font-semibold text-secondary uppercase font-numbers">
              {{ fortuneResult.category }} // KẾT QUẢ TỪ MÁY CHỦ
            </div>
            <h4 class="text-base font-bold text-primary mt-1">{{ fortuneResult.title }}</h4>
          </div>
          
          <div class="flex flex-col items-end gap-1">
            <span class="font-numbers text-xs font-bold px-2 py-0.5 rounded-[4px] bg-primary/10 text-gold border border-primary/30">
              {{ fortuneResult.score }}
            </span>
            <div class="border border-trading-down/40 bg-trading-down/10 text-trading-down text-xs font-numbers font-bold px-1.5 py-0.5 rounded-[2px] tracking-wider uppercase">
              {{ fortuneResult.sealText }}
            </div>
          </div>
        </div>

        <div class="bg-surface-elevated p-3.5 rounded-[6px] border border-hairline text-center">
          <p class="whitespace-pre-line text-xs text-primary leading-relaxed italic m-0">
            {{ fortuneResult.poem }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 bg-surface-elevated border border-hairline rounded-[6px]">
            <span class="text-xs font-numbers text-gold block mb-0.5 font-bold">TIỀN TÀI &amp; LỘC VẬN</span>
            <p class="text-secondary text-xs leading-snug m-0">{{ fortuneResult.aspects.wealth }}</p>
          </div>
          <div class="p-2.5 bg-surface-elevated border border-hairline rounded-[6px]">
            <span class="text-xs font-numbers text-gold block mb-0.5 font-bold">TÌNH DUYÊN &amp; GIA ĐẠO</span>
            <p class="text-secondary text-xs leading-snug m-0">{{ fortuneResult.aspects.love }}</p>
          </div>
          <div class="p-2.5 bg-surface-elevated border border-hairline rounded-[6px]">
            <span class="text-xs font-numbers text-trading-up block mb-0.5 font-bold">SỨC KHỎE &amp; THÂN THỂ</span>
            <p class="text-secondary text-xs leading-snug m-0">{{ fortuneResult.aspects.health }}</p>
          </div>
          <div class="p-2.5 bg-surface-elevated border border-hairline rounded-[6px]">
            <span class="text-xs font-numbers text-info block mb-0.5 font-bold">SỰ NGHIỆP &amp; CÔNG DANH</span>
            <p class="text-secondary text-xs leading-snug m-0">{{ fortuneResult.aspects.career }}</p>
          </div>
        </div>

        <div class="space-y-1">
          <span class="text-xs font-semibold text-secondary uppercase">TỔNG LUẬN Ý NGHĨA CUỘC SỐNG:</span>
          <p class="text-xs text-primary leading-relaxed m-0">
            {{ fortuneResult.meaning }}
          </p>
        </div>

        <div class="space-y-1 bg-surface-elevated p-3 rounded-[6px] border border-hairline">
          <span class="text-xs font-semibold text-trading-up uppercase">PHƯƠNG PHÁP CHUYỂN HÓA &amp; LỜI RĂN CHÁNH NIỆM:</span>
          <p class="text-xs text-secondary leading-relaxed m-0">
            {{ fortuneResult.mindfulAdvice }}
          </p>
        </div>

        <div class="p-2 bg-canvas-dark border border-hairline rounded-[6px] flex items-center justify-between text-xs font-numbers">
          <div class="flex items-center gap-1.5 text-trading-up">
            <ZenIcon name="check" :size="14" />
            <span>Bút toán sổ cái MC:</span>
          </div>
          <span class="text-secondary select-all truncate max-w-[240px]">#{{ fortuneResult.id }} (-{{ fortuneResult.costMc }} MC)</span>
        </div>

        <div class="flex gap-2 pt-2">
          <UiButton 
            variant="secondary"
            class="flex-1"
            @click="fortuneResult = null"
          >
            Gieo Quẻ Khác
          </UiButton>
          <UiButton 
            variant="primary"
            class="flex-1"
            @click="emit('close')"
          >
            Đóng Lại
          </UiButton>
        </div>
      </div>
    </div>
  </UiModal>
</template>
