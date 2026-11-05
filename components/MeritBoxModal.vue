<script setup lang="ts">
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { signEphemeralAction } from '~/lib/cardano/ephemeralKey'

const emit = defineEmits(['close'])
const economy = useEconomyStore()
const wallet = useWalletStore()

const selectedCurrency = ref<'merit_coin' | 'divine_lotus' | 'ada'>('merit_coin')
const amount = ref(10)
const prayerText = ref('Nguyện cầu gia đạo bình an, thân tâm thường lạc')
const isDonated = ref(false)
const lastTxHash = ref('')

const quickAmounts = computed(() => {
  if (selectedCurrency.value === 'ada') return [1, 5, 10, 50]
  if (selectedCurrency.value === 'divine_lotus') return [5, 10, 25, 108]
  return [10, 50, 100, 500]
})

function handleDonate() {
  if (selectedCurrency.value === 'ada') {
    const adaNum = Number(wallet.adaBalance)
    if (adaNum < amount.value) {
      alert(`Số dư ví Cardano (${adaNum} ADA) không đủ để cúng dường ${amount.value} ADA!`)
      return
    }
    const tx = wallet.recordMeritDeposit(amount.value)
    economy.meritCoins += amount.value * 100 // Tặng điểm công đức
    signEphemeralAction('donate_merit_box', { amount: amount.value, currency: 'ada', prayer: prayerText.value })
    zenAudio.playCoinDrop()
    zenAudio.playTempleBell()
    isDonated.value = true
    lastTxHash.value = tx
    return
  }

  const success = economy.donateToMeritBox(amount.value, selectedCurrency.value, prayerText.value)
  if (success) {
    signEphemeralAction('donate_merit_box', { amount: amount.value, currency: selectedCurrency.value, prayer: prayerText.value })
    zenAudio.playCoinDrop()
    zenAudio.playTempleBell()
    isDonated.value = true
    lastTxHash.value = 'merit_receipt_' + Math.random().toString(36).substring(2, 10)
  } else {
    alert('Số dư không đủ để dâng cúng dường!')
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="geist-card max-w-md w-full p-6 bg-[#111111] border border-white/15 relative">
      <!-- Close Button -->
      <button 
        @click="emit('close')" 
        class="absolute top-4 right-4 text-[#737373] hover:text-white text-sm font-mono h-6 w-6 flex items-center justify-center rounded-[4px] hover:bg-white/10"
      >
        ✕
      </button>

      <!-- Monospace Header -->
      <div class="mb-4 border-b border-white/10 pb-3">
        <div class="mono-eyebrow text-[#8f8f8f] mb-1">CARDANO // MERIT PROTOCOL CIP-30</div>
        <h3 class="text-base font-semibold text-white tracking-tight font-display">Hòm Công Đức Kỹ Thuật Số</h3>
        <p class="text-xs text-[#a1a1a1] mt-0.5">Trợ duyên Tam Bảo · Tích lũy phước lành hồi hướng</p>
      </div>

      <div v-if="!isDonated" class="space-y-4">
        <!-- Currency Selector Tabs (6px buttons) -->
        <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#171717] rounded-[8px] border border-white/10">
          <button 
            @click="selectedCurrency = 'merit_coin'; amount = 10"
            :class="selectedCurrency === 'merit_coin' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
            class="py-1.5 text-xs rounded-[6px] transition-all font-medium flex items-center justify-center gap-1.5"
          >
            <span>🪙</span>
            <span>Tâm Duyên</span>
          </button>
          <button 
            @click="selectedCurrency = 'divine_lotus'; amount = 5"
            :class="selectedCurrency === 'divine_lotus' ? 'bg-white text-black font-semibold' : 'text-[#a1a1a1] hover:text-white'"
            class="py-1.5 text-xs rounded-[6px] transition-all font-medium flex items-center justify-center gap-1.5"
          >
            <span>🪷</span>
            <span>Sen Vàng</span>
          </button>
          <button 
            @click="selectedCurrency = 'ada'; amount = 2"
            :class="selectedCurrency === 'ada' ? 'bg-[#0070f3] text-white font-semibold' : 'text-[#a1a1a1] hover:text-white'"
            class="py-1.5 text-xs rounded-[6px] transition-all font-medium flex items-center justify-center gap-1"
          >
            <span>₳</span>
            <span>Cardano</span>
          </button>
        </div>

        <!-- Quick Amount Grid (6px buttons with monospace numbers) -->
        <div>
          <label class="mono-eyebrow mb-1.5 block">CHỌN MỨC CÔNG ĐỨC</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button 
              v-for="val in quickAmounts" 
              :key="val"
              @click="amount = val"
              :class="amount === val ? 'bg-white text-black font-bold' : 'bg-[#171717] text-[#ededed] hover:bg-white/10 border border-white/10'"
              class="py-2 rounded-[6px] font-mono text-xs transition-all font-mono-num"
            >
              {{ val }} {{ selectedCurrency === 'ada' ? '₳' : '' }}
            </button>
          </div>
        </div>

        <!-- Custom Prayer Input -->
        <div>
          <label class="mono-eyebrow mb-1.5 block">LỜI CẦU NGUYỆN / HỒI HƯỚNG</label>
          <input 
            v-model="prayerText" 
            type="text"
            class="w-full bg-[#171717] border border-white/15 rounded-[6px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0070f3] transition-colors"
            placeholder="Nhập tâm nguyện hồi hướng..."
          />
        </div>

        <!-- Action Button -->
        <button 
          @click="handleDonate"
          class="w-full py-2.5 rounded-[6px] font-medium bg-white hover:bg-[#ededed] text-black text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm"
        >
          <span>Thành Kính Dâng Cúng</span>
          <span class="font-mono font-bold font-mono-num">({{ amount }} {{ selectedCurrency === 'ada' ? 'ADA' : selectedCurrency === 'divine_lotus' ? 'SEN' : 'XU' }})</span>
        </button>
      </div>

      <!-- Success Receipt View -->
      <div v-else class="text-center py-4 space-y-3">
        <div class="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg">
          ✓
        </div>
        <h4 class="text-base font-semibold text-white tracking-tight font-display">Công Đức Viên Mãn</h4>
        <p class="text-xs text-[#a1a1a1] leading-relaxed max-w-xs mx-auto">
          Tâm nguyện của bạn đã được ghi nhận. Nguyện đem công đức này hồi hướng cho muôn loài được an lạc.
        </p>
        <div v-if="lastTxHash" class="p-2.5 bg-[#171717] rounded-[6px] border border-white/10 text-left font-mono text-[10px]">
          <div class="text-[#737373] uppercase mb-0.5">Hydra L2 Settlement Receipt</div>
          <div class="text-[#0070f3] truncate">{{ lastTxHash }}</div>
        </div>
        <button 
          @click="isDonated = false; emit('close')"
          class="w-full py-2 rounded-[6px] text-xs bg-white/10 hover:bg-white/15 text-white font-medium transition-all"
        >
          Hoàn Tất
        </button>
      </div>
    </div>
  </div>
</template>
