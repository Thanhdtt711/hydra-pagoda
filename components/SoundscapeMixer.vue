<script setup lang="ts">
import { zenAudio, type AmbientChannel } from '~/lib/audio/ZenAudio'

const emit = defineEmits<{
  (e: 'close'): void
}>()

interface ChannelConfig {
  key: AmbientChannel
  name: string
  subname: string
  icon: string
  value: number
}

const channels = ref<ChannelConfig[]>([
  { key: 'rain', name: 'Mưa Rào Mái Ngói', subname: 'Mưa rơi êm đềm trên mái chùa rêu phong', icon: 'sunset', value: 0 },
  { key: 'stream', name: 'Suối Reo & Gáo Trúc', subname: 'Dòng nước thanh lương Shishi-odoshi', icon: 'lotus', value: 0 },
  { key: 'singingBowl', name: 'Chuông Xoay 432Hz', subname: 'Tần số an định tâm trí, xua tan căng thẳng', icon: 'bell', value: 30 },
  { key: 'windChimes', name: 'Phong Linh Chuông Gió', subname: 'Chuông gió Furin Á Đông ngân vang nhẹ', icon: 'sparkles', value: 15 },
  { key: 'woodenFish', name: 'Tiếng Mõ Định Tâm', subname: 'Nhịp mõ trầm ấm gõ đều đặn', icon: 'incense', value: 0 },
  { key: 'chanting', name: 'Tụng Niệm Phạn / Pali', subname: 'Âm vang tần số thiêng liêng Om 136.1Hz', icon: 'pagoda', value: 0 }
])

const masterVolume = ref(70)
const isMuted = ref(false)

onMounted(() => {
  const currentVols = zenAudio.getChannelVolumes()
  channels.value.forEach(c => {
    c.value = Math.round((currentVols[c.key] || 0) * 100)
  })
})

function updateVolume(channel: ChannelConfig) {
  zenAudio.setChannelVolume(channel.key, channel.value / 100)
}

function updateMaster() {
  zenAudio.setMasterVolume(isMuted.value ? 0 : masterVolume.value / 100)
}

function toggleMute() {
  isMuted.value = !isMuted.value
  zenAudio.setMasterVolume(isMuted.value ? 0 : masterVolume.value / 100)
}

function applyPreset(preset: 'rainy_night' | 'bamboo_stream' | 'vajra_chant' | 'zen_minimal') {
  if (preset === 'rainy_night') {
    setValues({ rain: 75, stream: 0, singingBowl: 35, windChimes: 10, woodenFish: 0, chanting: 0 })
  } else if (preset === 'bamboo_stream') {
    setValues({ rain: 0, stream: 80, singingBowl: 20, windChimes: 45, woodenFish: 0, chanting: 0 })
  } else if (preset === 'vajra_chant') {
    setValues({ rain: 0, stream: 0, singingBowl: 45, windChimes: 0, woodenFish: 50, chanting: 75 })
  } else if (preset === 'zen_minimal') {
    setValues({ rain: 0, stream: 0, singingBowl: 50, windChimes: 0, woodenFish: 0, chanting: 0 })
  }
}

function setValues(vals: Record<AmbientChannel, number>) {
  channels.value.forEach(c => {
    c.value = vals[c.key] ?? 0
    zenAudio.setChannelVolume(c.key, c.value / 100)
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Box: Spec-Sheet Geometry -->
    <div class="relative w-full max-w-xl bg-[#111111] border border-white/15 rounded-[8px] shadow-2xl overflow-hidden font-sans">
      <!-- Header -->
      <div class="p-4 bg-[#171717] border-b border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-[4px] bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
            <ZenIcon name="bell" :size="16" />
          </div>
          <div>
            <div class="mono-eyebrow text-[#888888]">AUDIO ENGINE // SPATIAL SOUND MIXER (GDD 9.0)</div>
            <h3 class="text-sm font-semibold text-white tracking-tight font-display">Bộ Trộn Âm Thanh Thiền 3D Không Gian</h3>
          </div>
        </div>
        <button 
          @click="emit('close')"
          class="w-7 h-7 flex items-center justify-center rounded-[4px] text-[#888888] hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZenIcon name="close" :size="15" />
        </button>
      </div>

      <!-- Presets Quick Bar (Wrap, Zero Horizontal Scrolling) -->
      <div class="p-3 bg-[#141414] border-b border-white/5 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="text-[10px] font-mono text-[#888888] uppercase shrink-0 mr-1">Preset:</span>
        <div class="flex flex-wrap items-center gap-1.5">
          <button 
            @click="applyPreset('zen_minimal')" 
            class="px-2.5 py-1 rounded-[4px] bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-[#ededed] transition-colors"
          >
            Tối Giản 432Hz
          </button>
          <button 
            @click="applyPreset('rainy_night')" 
            class="px-2.5 py-1 rounded-[4px] bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-[#ededed] transition-colors"
          >
            Đêm Mưa Mái Ngói
          </button>
          <button 
            @click="applyPreset('bamboo_stream')" 
            class="px-2.5 py-1 rounded-[4px] bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-[#ededed] transition-colors"
          >
            Rừng Trúc Suối Reo
          </button>
          <button 
            @click="applyPreset('vajra_chant')" 
            class="px-2.5 py-1 rounded-[4px] bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-[#ededed] transition-colors"
          >
            Khóa Lễ Mật Tông
          </button>
        </div>
      </div>

      <!-- 6 Fader Sliders Grid -->
      <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
        <div 
          v-for="c in channels" 
          :key="c.key"
          class="p-3 bg-[#161616] border border-white/10 rounded-[6px] flex flex-col justify-between"
        >
          <div class="flex items-start justify-between mb-2">
            <div>
              <div class="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <ZenIcon :name="c.icon as any" :size="13" class="text-amber-400" />
                <span>{{ c.name }}</span>
              </div>
              <div class="text-[10px] text-[#737373] mt-0.5 line-clamp-1">{{ c.subname }}</div>
            </div>
            <span class="font-mono text-xs font-bold text-amber-300">{{ c.value }}%</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-[#666666]">0</span>
            <input 
              v-model.number="c.value" 
              @input="updateVolume(c)"
              type="range" 
              min="0" 
              max="100" 
              class="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <span class="text-[10px] font-mono text-[#666666]">100</span>
          </div>
        </div>
      </div>

      <!-- Footer Master Controls -->
      <div class="p-3.5 bg-[#171717] border-t border-white/10 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1 max-w-xs">
          <button 
            @click="toggleMute"
            :class="isMuted ? 'text-red-400 border-red-400/30' : 'text-[#ededed] border-white/15'"
            class="px-2.5 py-1 rounded-[4px] border bg-white/5 flex items-center gap-1.5 text-xs font-mono shrink-0"
          >
            <ZenIcon :name="isMuted ? 'bell-off' : 'bell'" :size="13" />
            <span>{{ isMuted ? 'TẮT TIẾNG' : 'BẬT ÂM' }}</span>
          </button>
          <div class="flex items-center gap-2 flex-1">
            <span class="text-[10px] font-mono text-[#888888] shrink-0">TỔNG:</span>
            <input 
              v-model.number="masterVolume"
              @input="updateMaster"
              type="range" 
              min="0" 
              max="100" 
              class="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <span class="font-mono text-xs text-white shrink-0">{{ masterVolume }}%</span>
          </div>
        </div>

        <button 
          @click="emit('close')"
          class="px-4 py-1.5 bg-white text-black font-semibold rounded-[4px] text-xs hover:bg-white/90 transition-all"
        >
          Hoàn Tất
        </button>
      </div>
    </div>
  </div>
</template>

