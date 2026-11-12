<script setup lang="ts">
import { zenAudio, type AmbientChannel } from '~/lib/audio/ZenAudio'
import { t } from '~/lib/ui/copy'

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
  <UiModal
    :model-value="true"
    title="Bộ Trộn Âm Thanh Thiền 3D Không Gian"
    eyebrow="AUDIO ENGINE // SPATIAL SOUND MIXER"
    data-testid="soundscape-mixer-modal"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4 text-xs font-sans">
      <!-- Presets Quick Bar -->
      <div class="p-3 bg-surface-card border border-hairline rounded-md flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-numbers text-secondary shrink-0 mr-1">Preset:</span>
        <div class="flex flex-wrap items-center gap-1.5">
          <button 
            type="button"
            @click="applyPreset('zen_minimal')" 
            class="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-elevated/80 border border-hairline text-xs text-primary transition-colors"
          >
            {{ t('btn.presetMinimal') }}
          </button>
          <button 
            type="button"
            @click="applyPreset('rainy_night')" 
            class="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-elevated/80 border border-hairline text-xs text-primary transition-colors"
          >
            {{ t('btn.presetRain') }}
          </button>
          <button 
            type="button"
            @click="applyPreset('bamboo_stream')" 
            class="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-elevated/80 border border-hairline text-xs text-primary transition-colors"
          >
            {{ t('btn.presetBamboo') }}
          </button>
          <button 
            type="button"
            @click="applyPreset('vajra_chant')" 
            class="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-elevated/80 border border-hairline text-xs text-primary transition-colors"
          >
            {{ t('btn.presetVajra') }}
          </button>
        </div>
      </div>

      <!-- 6 Fader Sliders Grid -->
      <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        <div 
          v-for="c in channels" 
          :key="c.key"
          class="p-3 bg-surface-card border border-hairline rounded-md flex flex-col gap-2"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <ZenIcon :name="c.icon as any" :size="14" class="text-gold" />
                <span>{{ c.name }}</span>
              </div>
              <div class="text-xs text-secondary mt-0.5 line-clamp-1">{{ c.subname }}</div>
            </div>
            <span class="font-numbers text-xs font-bold text-gold">{{ c.value }}%</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-numbers text-secondary">0</span>
            <input 
              v-model.number="c.value" 
              @input="updateVolume(c)"
              type="range" 
              min="0" 
              max="100" 
              class="w-full h-1.5 bg-surface-elevated rounded appearance-none cursor-pointer accent-gold"
            />
            <span class="text-xs font-numbers text-secondary">100</span>
          </div>
        </div>
      </div>

      <!-- Footer Master Controls -->
      <div class="pt-3 border-t border-hairline flex items-center justify-between gap-3">
        <UiButton 
          variant="secondary"
          size="sm"
          @click="toggleMute"
        >
          <ZenIcon :name="isMuted ? 'bell-off' : 'bell'" :size="13" class="mr-1" />
          <span>{{ isMuted ? 'TẮT TIẾNG' : 'BẬT ÂM' }}</span>
        </UiButton>

        <div class="flex items-center gap-2 flex-1 max-w-[200px]">
          <span class="text-xs font-numbers text-secondary shrink-0">TỔNG:</span>
          <input 
            v-model.number="masterVolume"
            @input="updateMaster"
            type="range" 
            min="0" 
            max="100" 
            class="w-full h-1.5 bg-surface-elevated rounded appearance-none cursor-pointer accent-gold"
          />
          <span class="font-numbers text-xs text-white shrink-0">{{ masterVolume }}%</span>
        </div>
      </div>
    </div>
  </UiModal>
</template>
