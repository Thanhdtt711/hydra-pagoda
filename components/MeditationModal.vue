<script setup lang="ts">
import { zenAudio } from '~/lib/audio/ZenAudio'
import { useUserStore } from '~/stores/user'

const emit = defineEmits(['close'])
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
        <div class="mono-eyebrow text-[#50e3c2] mb-1">ZEN // MINDFULNESS ENGINE 432Hz</div>
        <h3 class="text-base font-semibold text-white tracking-tight font-display">Tọa Thiền Điều Tức</h3>
        <p class="text-xs text-[#a1a1a1] mt-0.5">Thanh lọc thân tâm · Chu kỳ thở 4-4-6</p>
      </div>

      <!-- Config View -->
      <div v-if="!isMeditating" class="space-y-4">
        <div>
          <label class="mono-eyebrow mb-1.5 block">THỜI LƯỢNG THIỀN ĐỊNH</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button 
              v-for="mins in [3, 5, 15, 30]" 
              :key="mins"
              @click="durationMinutes = mins"
              :class="durationMinutes === mins ? 'bg-white text-black font-semibold' : 'bg-[#171717] text-[#ededed] border border-white/10 hover:bg-white/10'"
              class="py-2 rounded-[6px] font-mono text-xs transition-all font-mono-num text-center"
            >
              {{ mins }} Phút
            </button>
          </div>
        </div>

        <div class="bg-[#171717] p-3 rounded-[6px] border border-white/10 space-y-1 text-xs text-[#a1a1a1] leading-relaxed">
          <div class="text-white font-medium mb-1">Quy tắc nhịp thở 4-4-6:</div>
          <div>• Hít vào sâu bằng mũi trong 4 giây</div>
          <div>• Giữ hơi thở nhẹ nhàng trong 4 giây</div>
          <div>• Thở ra từ từ bằng miệng trong 6 giây</div>
        </div>

        <button 
          @click="startMeditation"
          class="w-full py-2.5 rounded-[6px] font-medium bg-white hover:bg-[#ededed] text-black text-xs transition-all active:scale-[0.99] shadow-sm flex items-center justify-center gap-2"
        >
          <span>Bắt Đầu Tọa Thiền</span>
          <span class="font-mono font-bold font-mono-num">({{ durationMinutes }}:00)</span>
        </button>
      </div>

      <!-- Active Meditation Session View -->
      <div v-else class="text-center py-4 space-y-5">
        <!-- Minimal Breathing Circle -->
        <div class="relative w-36 h-36 mx-auto flex items-center justify-center">
          <div 
            :class="breathState === 'Hít Vào' ? 'scale-110 border-[#50e3c2]' : breathState === 'Giữ Hơi' ? 'scale-105 border-white' : 'scale-90 border-[#737373]'"
            class="absolute inset-0 rounded-full border-2 transition-transform duration-1000 ease-in-out opacity-80"
          ></div>
          <div class="text-center">
            <div class="font-mono text-2xl font-bold text-white font-mono-num tracking-tight">{{ formattedTime }}</div>
            <div class="font-mono text-[11px] text-[#50e3c2] uppercase mt-1 tracking-wider">{{ breathState }}</div>
          </div>
        </div>

        <div class="text-xs text-[#737373] font-mono">
          Singing Bowl 432Hz · Hòa nhập cùng nhịp thở
        </div>

        <button 
          @click="endMeditation"
          class="w-full py-2 rounded-[6px] text-xs bg-white/10 hover:bg-white/15 text-white font-medium transition-all"
        >
          Kết Thúc Thiền Định
        </button>
      </div>
    </div>
  </div>
</template>
