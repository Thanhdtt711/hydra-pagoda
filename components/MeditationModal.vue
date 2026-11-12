<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { useUserStore } from '~/stores/user'
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'
import { t } from '~/lib/ui/copy'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const user = useUserStore()

const durationMinutes = ref(5)
const isMeditating = ref(false)
const remainingSeconds = ref(300)
const breathState = ref<'Hít Vào' | 'Giữ Hơi' | 'Thở Ra'>('Hít Vào')
let timerInterval: any = null
let breathInterval: any = null

const formattedTime = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

function startMeditation() {
  isMeditating.value = true
  remainingSeconds.value = durationMinutes.value * 60
  zenAudio.playSingingBowl()

  timerInterval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--
    } else {
      endMeditation()
    }
  }, 1000)

  let cycle = 0
  breathInterval = setInterval(() => {
    cycle = (cycle + 1) % 14
    if (cycle < 4) breathState.value = 'Hít Vào'
    else if (cycle < 8) breathState.value = 'Giữ Hơi'
    else breathState.value = 'Thở Ra'
  }, 1000)
}

function endMeditation() {
  clearInterval(timerInterval)
  clearInterval(breathInterval)
  isMeditating.value = false
  zenAudio.playTempleBell()
  user.recordMeditation(durationMinutes.value)
}

onUnmounted(() => {
  clearInterval(timerInterval)
  clearInterval(breathInterval)
})
</script>

<template>
  <UiModal
    title="Tọa Thiền Điều Tức"
    subtitle="Thanh lọc thân tâm · Chu kỳ thở 4-4-6"
    @close="emit('close')"
  >
    <!-- Config View -->
    <div v-if="!isMeditating" class="space-y-4 font-sans text-primary">
      <div>
        <label class="text-xs font-semibold text-secondary mb-2 block">THỜI LƯỢNG THIỀN ĐỊNH</label>
        <div class="grid grid-cols-4 gap-2">
          <button 
            v-for="mins in [3, 5, 15, 30]" 
            :key="mins"
            type="button"
            @click="durationMinutes = mins"
            :class="durationMinutes === mins ? 'bg-surface-elevated text-primary font-bold border-primary' : 'bg-surface-card text-secondary border-hairline hover:bg-surface-elevated hover:text-primary'"
            class="py-2.5 rounded-[2px] font-numbers text-xs transition-colors border text-center cursor-pointer ui-focus-ring"
          >
            {{ mins }} Phút
          </button>
        </div>
      </div>

      <div class="bg-surface-elevated p-3.5 rounded-[2px] border border-hairline space-y-1.5 text-xs text-secondary leading-relaxed">
        <div class="text-primary font-semibold mb-1">Quy tắc nhịp thở 4-4-6:</div>
        <div>- Hít vào sâu bằng mũi trong 4 giây</div>
        <div>- Giữ hơi thở nhẹ nhàng trong 4 giây</div>
        <div>- Thở ra từ từ bằng miệng trong 6 giây</div>
      </div>

      <div class="pt-2">
        <UiButton 
          variant="primary"
          block
          @click="startMeditation"
        >
          <span>Bắt Đầu Tọa Thiền</span>
          <span class="font-numbers ml-1">({{ durationMinutes }}:00)</span>
        </UiButton>
      </div>
    </div>

    <!-- Active Meditation Session View -->
    <div v-else class="text-center py-6 space-y-5 font-sans">
      <!-- Minimal Breathing Circle -->
      <div class="relative w-36 h-36 mx-auto flex items-center justify-center">
        <div 
          :class="breathState === 'Hít Vào' ? 'scale-110 border-primary' : breathState === 'Giữ Hơi' ? 'scale-105 border-white' : 'scale-95 border-hairline'"
          class="absolute inset-0 rounded-full border-2 transition-transform duration-1000 ease-in-out"
        />
        <div class="text-center">
          <div class="font-numbers text-3xl font-bold text-primary tracking-tight">{{ formattedTime }}</div>
          <div class="font-sans text-xs text-gold mt-1 font-semibold">{{ breathState }}</div>
        </div>
      </div>

      <div class="text-xs text-secondary font-numbers">
        Singing Bowl 432Hz · Hòa nhập cùng nhịp thở
      </div>

      <div class="pt-4">
        <UiButton 
          variant="secondary"
          block
          @click="endMeditation"
        >
          {{ t('btn.endMeditation') }}
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>
