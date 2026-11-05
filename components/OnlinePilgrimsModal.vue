<script setup lang="ts">
import type { PilgrimPresence } from '~/lib/network/MultiplayerClient'

interface Props {
  modelValue: boolean
  pilgrims: PilgrimPresence[]
  localName: string
  localTitle: string
  localCountry: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'bowTo', id: string): void
}>()

const COUNTRY_NAMES: Record<string, { name: string; code: string }> = {
  vietnam: { name: 'Việt Nam', code: 'VN' },
  japan: { name: 'Nhật Bản', code: 'JP' },
  thailand: { name: 'Thái Lan', code: 'TH' },
  korea: { name: 'Hàn Quốc', code: 'KR' },
  taiwan: { name: 'Đài Loan', code: 'TW' },
  singapore: { name: 'Singapore', code: 'SG' },
  india: { name: 'Ấn Độ', code: 'IN' },
  tibet: { name: 'Tây Tạng', code: 'TB' },
  western: { name: 'Làng Mai', code: 'LM' }
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'meditating': return 'Tọa thiền kiết già'
    case 'bowing': return 'Chắp tay cúi lạy'
    case 'walking': return 'Kinh hành an lạc'
    default: return 'Đứng trang nghiêm'
  }
}

function getActionBadgeClass(action: string): string {
  switch (action) {
    case 'meditating': return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    case 'bowing': return 'bg-sky-500/10 text-sky-300 border-sky-500/30'
    case 'walking': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    default: return 'bg-white/5 text-[#a1a1a1] border-white/10'
  }
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('update:modelValue', false)"></div>

    <!-- Modal Box: Spec-Sheet Geometry -->
    <div class="relative w-full max-w-lg bg-[#111111] border border-white/15 rounded-[8px] shadow-2xl overflow-hidden font-sans">
      <!-- Header -->
      <div class="p-4 bg-[#171717] border-b border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-[4px] bg-white/5 border border-white/10 flex items-center justify-center text-amber-400">
            <ZenIcon name="users" :size="16" />
          </div>
          <div>
            <div class="mono-eyebrow text-[#888888]">COMMUNITY PRESENCE // MULTIPLAYER ENGINE</div>
            <h3 class="text-sm font-semibold text-white tracking-tight font-display">Danh Sách Đồng Tu Đang Online</h3>
          </div>
        </div>
        <button 
          @click="emit('update:modelValue', false)"
          class="w-7 h-7 flex items-center justify-center rounded-[4px] text-[#888888] hover:text-white hover:bg-white/10 transition-colors"
        >
          <ZenIcon name="close" :size="15" />
        </button>
      </div>

      <!-- Live Count Stats Banner -->
      <div class="px-4 py-2.5 bg-[#141414] border-b border-white/5 flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-2 text-emerald-400">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{{ pilgrims.length + 1 }} ĐỒNG TU ĐANG CÙNG CHIÊM BÁI</span>
        </div>
        <span class="text-[#737373]">ĐỒNG BỘ WEBSOCKET 20HZ</span>
      </div>

      <!-- Pilgrims List -->
      <div class="p-4 max-h-[60vh] overflow-y-auto space-y-2">
        <!-- Local User Entry (You) -->
        <div class="p-3 rounded-[6px] bg-[#1a1a1a] border border-amber-500/30 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-[4px] bg-amber-400/10 border border-amber-400/20 flex items-center justify-center font-mono text-[10px] font-bold text-amber-300">
              {{ COUNTRY_NAMES[localCountry]?.code || 'VN' }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-white">{{ localName }}</span>
                <span class="font-mono text-[9px] px-1 py-0.2 rounded-[2px] bg-amber-400 text-black font-bold">BẠN</span>
              </div>
              <div class="text-[10px] text-amber-400/80 font-mono">{{ localTitle }}</div>
            </div>
          </div>
          <span class="font-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-white/5 border border-white/10 text-emerald-400">
            Trực Tuyến
          </span>
        </div>

        <!-- Remote Pilgrims -->
        <div 
          v-for="p in pilgrims" 
          :key="p.id"
          class="p-3 rounded-[6px] bg-[#141414] border border-white/10 hover:border-white/20 transition-all flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-[4px] bg-white/5 border border-white/10 flex items-center justify-center font-mono text-[10px] font-bold text-[#a1a1a1]">
              {{ COUNTRY_NAMES[p.country]?.code || 'VN' }}
            </div>
            <div>
              <div class="text-xs font-semibold text-white">{{ p.name }}</div>
              <div class="text-[10px] text-[#737373] font-mono">{{ p.title }} · {{ COUNTRY_NAMES[p.country]?.name || p.country }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span :class="getActionBadgeClass(p.action)" class="font-mono text-[10px] px-2 py-0.5 rounded-[4px] border">
              {{ getActionLabel(p.action) }}
            </span>
            <button 
              @click="emit('bowTo', p.id)"
              class="px-2 py-1 rounded-[4px] bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white flex items-center gap-1 transition-colors"
              title="Chắp tay chào đồng tu này"
            >
              <ZenIcon name="hand-bow" :size="12" />
              <span>Chào</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 bg-[#171717] border-t border-white/10 flex items-center justify-between text-[11px] text-[#737373]">
        <span>Không phân biệt tông phái, đồng tu một cõi thanh tịnh.</span>
        <button 
          @click="emit('update:modelValue', false)"
          class="px-3 py-1 bg-white text-black font-semibold rounded-[4px] text-xs hover:bg-white/90 transition-all"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
</template>

