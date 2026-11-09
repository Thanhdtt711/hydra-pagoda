<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { signEphemeralAction } from '~/lib/cardano/ephemeralKey'
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'
import ZenIcon from '~/components/ZenIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

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
  <UiModal
    title="Hòm Công Đức Kỹ Thuật Số"
    subtitle="Trợ duyên Tam Bảo · Tích lũy phước lành hồi hướng"
    @close="emit('close')"
  >
    <div v-if="!isDonated" class="space-y-4 font-sans text-primary">
      <!-- Currency Selector Tabs -->
      <div class="grid grid-cols-3 gap-1.5 p-1 bg-surface-elevated rounded-[6px] border border-hairline">
        <button 
          type="button"
          @click="selectedCurrency = 'merit_coin'; amount = 10"
          :class="selectedCurrency === 'merit_coin' ? 'bg-surface-card text-primary font-semibold border-primary' : 'text-secondary hover:text-primary border-transparent'"
          class="py-2 text-xs rounded-[4px] border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <ZenIcon name="coin" :size="14" class="text-gold" />
          <span>Tâm Duyên (MC)</span>
        </button>
        <button 
          type="button"
          @click="selectedCurrency = 'divine_lotus'; amount = 5"
          :class="selectedCurrency === 'divine_lotus' ? 'bg-surface-card text-primary font-semibold border-primary' : 'text-secondary hover:text-primary border-transparent'"
          class="py-2 text-xs rounded-[4px] border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <ZenIcon name="lotus" :size="14" class="text-trading-up" />
          <span>Sen Vàng</span>
        </button>
        <button 
          type="button"
          @click="selectedCurrency = 'ada'; amount = 2"
          :class="selectedCurrency === 'ada' ? 'bg-surface-card text-primary font-semibold border-primary' : 'text-secondary hover:text-primary border-transparent'"
          class="py-2 text-xs rounded-[4px] border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <ZenIcon name="cardano" :size="14" class="text-info" />
          <span>Cardano (ADA)</span>
        </button>
      </div>

      <!-- Quick Amount Grid -->
      <div>
        <label class="text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 block">CHỌN MỨC CÔNG ĐỨC</label>
        <div class="grid grid-cols-4 gap-2">
          <button 
            v-for="val in quickAmounts" 
            :key="val"
            type="button"
            @click="amount = val"
            :class="amount === val ? 'bg-surface-elevated text-primary font-bold border-primary' : 'bg-surface-card text-secondary border-hairline hover:bg-surface-elevated hover:text-primary'"
            class="py-2.5 rounded-[6px] font-numbers text-xs transition-colors border text-center cursor-pointer ui-focus-ring"
          >
            {{ val }} {{ selectedCurrency === 'ada' ? 'ADA' : '' }}
          </button>
        </div>
      </div>

      <!-- Custom Prayer Input -->
      <div>
        <label class="text-xs font-semibold uppercase tracking-wider text-secondary mb-1.5 block">LỜI CẦU NGUYỆN / HỒI HƯỚNG</label>
        <input 
          v-model="prayerText" 
          type="text"
          class="w-full bg-surface-elevated border border-hairline rounded-[6px] px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-primary transition-colors font-sans"
          placeholder="Nhập tâm nguyện hồi hướng..."
        />
      </div>

      <!-- Action Button -->
      <div class="pt-2">
        <UiButton 
          variant="primary"
          block
          @click="handleDonate"
        >
          <span>Thành Kính Dâng Cúng</span>
          <span class="font-numbers ml-1 font-bold">({{ amount }} {{ selectedCurrency === 'ada' ? 'ADA' : selectedCurrency === 'divine_lotus' ? 'SEN' : 'MC' }})</span>
        </UiButton>
      </div>
    </div>

    <!-- Success Receipt View -->
    <div v-else class="text-center py-6 space-y-4 font-sans text-primary">
      <div class="w-12 h-12 mx-auto rounded-full bg-trading-up/10 text-trading-up border border-trading-up/30 flex items-center justify-center">
        <ZenIcon name="circle-check" :size="24" />
      </div>
      <h4 class="text-base font-bold text-primary">Công Đức Viên Mãn</h4>
      <p class="text-xs text-secondary leading-relaxed max-w-xs mx-auto m-0">
        Tâm nguyện của bạn đã được ghi nhận. Nguyện đem công đức này hồi hướng cho muôn loài được an lạc.
      </p>
      <div v-if="lastTxHash" class="p-3 bg-surface-elevated rounded-[6px] border border-hairline text-left font-numbers text-xs space-y-1">
        <div class="text-secondary uppercase">Hydra L2 Settlement Receipt</div>
        <div class="text-info truncate select-all">{{ lastTxHash }}</div>
      </div>
      <div class="pt-2">
        <UiButton 
          variant="secondary"
          block
          @click="isDonated = false; emit('close')"
        >
          Hoàn Tất
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>
