<script setup lang="ts">
import { zenAudio } from '~/lib/audio/ZenAudio'
import { useEconomyStore, type FortuneCategory, type FortuneTierId, type ServerFortuneResult } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'

const emit = defineEmits(['close'])
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
  fortuneResult.value = null

  if (currentTab.value === 'wealth') {
    zenAudio.playCoinDrop()
  } else if (currentTab.value === 'health' || currentTab.value === 'star') {
    zenAudio.playSingingBowl()
  } else {
    zenAudio.playFortuneShaking()
  }

  try {
    const res = await economy.drawFortune(currentTab.value, selectedTier.value)
    setTimeout(() => {
      isPerformingRitual.value = false
      zenAudio.playTempleBell()
      fortuneResult.value = res.fortune
    }, 900)
  } catch (err: any) {
    isPerformingRitual.value = false
    errorMessage.value = err?.data?.message || err?.message || 'Không thể gieo quẻ.'
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
    <div class="geist-card max-w-2xl w-full p-5 bg-[#111111] border border-white/15 relative max-h-[92vh] overflow-y-auto">
      <!-- Close Button -->
      <button 
        @click="emit('close')" 
        class="absolute top-4 right-4 text-[#737373] hover:text-white text-sm font-mono h-6 w-6 flex items-center justify-center rounded-[4px] hover:bg-white/10 z-10"
      >
        <ZenIcon name="close" :size="14" />
      </button>

      <!-- Monospace Header -->
      <div class="mb-3 border-b border-white/10 pb-2.5">
        <div class="mono-eyebrow text-[#8f8f8f] mb-1">ARCHIVE // SERVER-SIDE DIVINATION & MC LEDGER</div>
        <h3 class="text-base font-semibold text-white tracking-tight font-display">Bàn Gieo Quẻ & Luận Sấm Dân Gian</h3>
        <p class="text-xs text-[#a1a1a1] mt-0.5">Tiền Tài · Tình Duyên · Con Cái · Sức Khỏe · Hóa Giải Vận Hạn</p>
      </div>

      <!-- Compliance Notice Inset Box -->
      <div class="bg-[#171717] border border-white/10 rounded-[6px] p-2.5 mb-3 text-[11px] text-[#a1a1a1] flex items-center gap-2">
        <ZenIcon name="shield" :size="13" class="text-amber-400 shrink-0" />
        <span>Kết quả quẻ được sinh ngẫu nhiên an toàn trên máy chủ và lưu vào lịch sử tài khoản. Nội dung mang tính văn hóa dân gian & chánh niệm.</span>
      </div>

      <!-- 6 Category Tabs Grid -->
      <div class="grid grid-cols-3 md:grid-cols-6 gap-1 p-1 bg-[#171717] rounded-[8px] border border-white/10 mb-3 text-xs">
        <button 
          v-for="t in TAB_CONFIGS"
          :key="t.id"
          @click="currentTab = t.id as FortuneCategory; fortuneResult = null; errorMessage = null; showConfirm = false"
          :class="currentTab === t.id ? 'bg-white text-black font-semibold shadow-sm' : 'text-[#a1a1a1] hover:text-white hover:bg-white/5'"
          class="py-1.5 px-1 rounded-[6px] transition-all text-center flex flex-col items-center justify-center gap-0.5"
        >
          <ZenIcon :name="t.icon as any" :size="12" />
          <span class="text-[11px] font-medium leading-none">{{ t.name }}</span>
        </button>
      </div>

      <!-- User Currency Balance Strip -->
      <div class="px-3 py-1.5 bg-[#141414] border border-white/10 rounded-[6px] mb-3 flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-3">
          <span class="text-[#888888] text-[10px] uppercase">Ngân Khố:</span>
          <span class="text-amber-300 flex items-center gap-1 font-semibold">
            <ZenIcon name="coin" :size="11" />
            {{ economy.meritCoins.toLocaleString('vi-VN') }} MC
          </span>
          <span class="text-[#0070f3] flex items-center gap-1 font-medium">
            <ZenIcon name="cardano" :size="11" />
            {{ wallet.adaBalance }} ₳
          </span>
        </div>
        <button
          @click="economy.openTopUpModal(); emit('close')"
          class="px-2 py-0.5 rounded-[4px] bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[10px] font-mono"
        >
          + Nạp MC
        </button>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="mb-3 p-2 bg-red-500/10 border border-red-500/30 text-xs text-red-400 rounded-[6px] text-center font-mono">
        {{ errorMessage }}
      </div>

      <!-- Pre-Divination View: Tier Selection -->
      <div v-if="!fortuneResult" class="space-y-3.5">
        <div>
          <span class="mono-eyebrow block mb-1.5">CHỌN CẤP ĐỘ THỈNH QUẺ (MC):</span>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div 
              v-for="tier in economy.fortuneTiers"
              :key="tier.id"
              @click="selectedTier = tier.id; showConfirm = false"
              :class="selectedTier === tier.id ? 'border-amber-400 bg-amber-400/5' : 'border-white/10 bg-[#141414] hover:border-white/20'"
              class="p-2.5 rounded-[6px] border cursor-pointer transition-all flex flex-col justify-between relative"
            >
              <div>
                <div class="text-xs font-semibold text-white">{{ tier.label }}</div>
                <div class="text-[10px] text-[#737373] mt-0.5">{{ tier.description }}</div>
              </div>
              <div class="mt-2 text-xs font-mono font-bold text-amber-300">{{ tier.costMc.toLocaleString('vi-VN') }} MC</div>
            </div>
          </div>
        </div>

        <!-- Confirmation Box -->
        <div v-if="showConfirm" class="p-3 bg-amber-400/10 border border-amber-400/30 rounded-[6px] flex items-center justify-between gap-2 text-xs">
          <span class="text-[#ededed]">
            Xác nhận tiêu <strong class="text-amber-300 font-mono">{{ currentTierCostMc.toLocaleString('vi-VN') }} MC</strong> để gieo quẻ?
          </span>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              @click="confirmDrawFortune"
              :disabled="isPerformingRitual"
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

        <!-- Interactive Ritual Stage -->
        <div class="text-center py-4 bg-[#141414] border border-white/10 rounded-[8px]">
          <div 
            :class="{ 'animate-bounce': isPerformingRitual, 'animate-pulse': !isPerformingRitual }"
            class="w-16 h-16 mx-auto bg-black/60 rounded-[8px] border border-white/20 flex items-center justify-center text-amber-300 mb-3 shadow-lg"
          >
            <ZenIcon v-if="currentTab === 'stick'" name="cards" :size="32" />
            <ZenIcon v-else-if="currentTab === 'love'" name="lotus" :size="32" class="text-pink-300" />
            <ZenIcon v-else-if="currentTab === 'family'" name="sparkles" :size="32" class="text-amber-300" />
            <ZenIcon v-else-if="currentTab === 'wealth'" name="coin" :size="32" class="text-amber-400" />
            <ZenIcon v-else-if="currentTab === 'health'" name="incense" :size="32" class="text-emerald-400" />
            <ZenIcon v-else name="sunset" :size="32" class="text-sky-300" />
          </div>

          <div class="text-xs font-medium text-[#ededed] mb-1">
            {{ currentTab === 'wealth' ? 'Gieo 3 Đồng Tiền Hoa Sen Chiêu Tài' : currentTab === 'love' ? 'Thắt Chỉ Đỏ Cầu Duyên Nguyệt Lão' : currentTab === 'family' ? 'Dâng Đài Sen Cầu Tự Quan Âm' : currentTab === 'health' ? 'Thắp Nến Dược Sư Tiêu Trừ Tật Bệnh' : currentTab === 'star' ? 'Thắp Đèn Đàn Tràng Bắc Đẩu Giải Hạn' : 'Lắc Ống Xăm 100 Quẻ Hán Việt' }}
          </div>
          <div class="text-[11px] text-[#737373] mb-3 font-mono">
            Phí gieo quẻ: <strong class="text-amber-300">{{ currentTierCostMc.toLocaleString('vi-VN') }} MC</strong>
          </div>

          <div class="flex items-center justify-center gap-2">
            <button 
              @click="promptDrawFortune"
              :disabled="isPerformingRitual || !wallet.isAuthenticated || economy.meritCoins < currentTierCostMc"
              class="py-2.5 px-8 rounded-[6px] font-semibold bg-white hover:bg-[#ededed] text-black text-xs transition-all active:scale-[0.99] disabled:opacity-40 shadow-md inline-flex items-center gap-2"
            >
              <ZenIcon v-if="!isPerformingRitual" name="sparkles" :size="13" />
              <span>{{ isPerformingRitual ? 'Đang Khấn Nguyện Gieo Quẻ...' : `Thành Tâm Gieo Quẻ (${currentTierCostMc} MC)` }}</span>
            </button>
            <button
              v-if="wallet.isAuthenticated && economy.meritCoins < currentTierCostMc"
              @click="economy.openTopUpModal(); emit('close')"
              class="py-2.5 px-4 rounded-[6px] bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-xs font-mono font-semibold"
            >
              + Nạp MC
            </button>
          </div>
        </div>
      </div>

      <!-- Result View -->
      <div v-else class="space-y-3.5">
        <div class="flex items-start justify-between border-b border-white/10 pb-3">
          <div>
            <div class="mono-eyebrow text-[#0070f3] flex items-center gap-1.5">
              <span>{{ fortuneResult.category.toUpperCase() }} // KẾT QUẢ TỪ MÁY CHỦ</span>
            </div>
            <h4 class="text-base font-semibold text-white tracking-tight font-display mt-0.5">{{ fortuneResult.title }}</h4>
          </div>
          
          <div class="flex flex-col items-end gap-1">
            <span class="font-mono text-xs font-bold px-2 py-0.5 rounded-[4px] bg-amber-400/10 text-amber-300 border border-amber-400/30">
              {{ fortuneResult.score }}
            </span>
            <div class="border border-red-500 bg-red-500/10 text-red-400 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-[2px] tracking-wider uppercase">
              {{ fortuneResult.sealText }}
            </div>
          </div>
        </div>

        <div class="bg-[#171717] p-3.5 rounded-[6px] border border-white/10 text-center relative overflow-hidden">
          <div class="absolute -top-3 -right-3 text-white/5 font-display text-5xl select-none">⛩️</div>
          <p class="whitespace-pre-line text-xs text-amber-200/90 leading-relaxed italic font-serif">
            {{ fortuneResult.poem }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 bg-[#141414] border border-white/10 rounded-[6px]">
            <span class="text-[10px] font-mono text-amber-300 block mb-0.5 font-bold">TIỀN TÀI & LỘC VẬN</span>
            <p class="text-[#a1a1a1] text-[11px] leading-snug">{{ fortuneResult.aspects.wealth }}</p>
          </div>
          <div class="p-2.5 bg-[#141414] border border-white/10 rounded-[6px]">
            <span class="text-[10px] font-mono text-pink-300 block mb-0.5 font-bold">TÌNH DUYÊN & GIA ĐẠO</span>
            <p class="text-[#a1a1a1] text-[11px] leading-snug">{{ fortuneResult.aspects.love }}</p>
          </div>
          <div class="p-2.5 bg-[#141414] border border-white/10 rounded-[6px]">
            <span class="text-[10px] font-mono text-emerald-300 block mb-0.5 font-bold">SỨC KHỎE & THÂN THỂ</span>
            <p class="text-[#a1a1a1] text-[11px] leading-snug">{{ fortuneResult.aspects.health }}</p>
          </div>
          <div class="p-2.5 bg-[#141414] border border-white/10 rounded-[6px]">
            <span class="text-[10px] font-mono text-sky-300 block mb-0.5 font-bold">SỰ NGHIỆP & CÔNG DANH</span>
            <p class="text-[#a1a1a1] text-[11px] leading-snug">{{ fortuneResult.aspects.career }}</p>
          </div>
        </div>

        <div class="space-y-1">
          <span class="mono-eyebrow">TỔNG LUẬN Ý NGHĨA CUỘC SỐNG:</span>
          <p class="text-xs text-[#ededed] leading-relaxed">
            {{ fortuneResult.meaning }}
          </p>
        </div>

        <div class="space-y-1 bg-[#171717] p-3 rounded-[6px] border border-white/10">
          <span class="mono-eyebrow text-[#50e3c2]">PHƯƠNG PHÁP CHUYỂN HÓA & LỜI RĂN CHÁNH NIỆM:</span>
          <p class="text-xs text-[#a1a1a1] leading-relaxed">
            {{ fortuneResult.mindfulAdvice }}
          </p>
        </div>

        <div class="p-2 bg-black/60 border border-white/10 rounded-[6px] flex items-center justify-between text-[10px] font-mono">
          <div class="flex items-center gap-1.5 text-emerald-400">
            <ZenIcon name="check" :size="11" />
            <span>Bút toán sổ cái MC:</span>
          </div>
          <span class="text-[#888888] select-all truncate max-w-[280px]">#{{ fortuneResult.id }} (-{{ fortuneResult.costMc }} MC)</span>
        </div>

        <div class="flex gap-2 pt-2">
          <button 
            @click="fortuneResult = null"
            class="flex-1 py-2 rounded-[6px] text-xs bg-white/10 hover:bg-white/15 text-white font-medium transition-all"
          >
            Gieo Quẻ Khác
          </button>
          <button 
            @click="emit('close')"
            class="flex-1 py-2 rounded-[6px] text-xs bg-white text-black font-semibold hover:bg-[#ededed] transition-all"
          >
            Đóng Lại
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
