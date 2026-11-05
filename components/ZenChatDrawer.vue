<script setup lang="ts">
import type { ZenChatMessage } from '~/lib/network/MultiplayerClient'

interface Props {
  modelValue: boolean
  messages: ZenChatMessage[]
  onlineCount: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'send', text: string): void
}>()

const inputMessage = ref('')
const chatFeedRef = ref<HTMLElement | null>(null)

const QUICK_MANTRAS = [
  'Nam Mô A Di Đà Phật',
  'Thân tâm an lạc, vạn sự cát tường',
  'Nguyện cầu quốc thái dân an',
  'Mỗi bước chân nở một đóa hoa sen',
  'Thở vào tâm tĩnh lặng, thở ra miệng mỉm cười',
  'Tâm bình thế giới bình'
]

function handleSend(text?: string) {
  const content = text || inputMessage.value
  if (!content.trim()) return
  emit('send', content.trim())
  inputMessage.value = ''
  scrollToBottom()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatFeedRef.value) {
      chatFeedRef.value.scrollTop = chatFeedRef.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, () => {
  scrollToBottom()
})

const COUNTRY_CODES: Record<string, string> = {
  vietnam: 'VN',
  japan: 'JP',
  thailand: 'TH',
  korea: 'KR',
  taiwan: 'TW',
  singapore: 'SG',
  india: 'IN',
  tibet: 'TB',
  western: 'LM'
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-if="modelValue" class="fixed bottom-14 right-3 w-96 max-w-[92vw] z-30 flex flex-col bg-[#111111]/95 backdrop-blur-xl border border-white/12 rounded-[8px] shadow-2xl overflow-hidden font-sans">
    <!-- Header: Spec-sheet Bar -->
    <div class="px-3 py-2 bg-[#171717] border-b border-white/10 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ZenIcon name="message" :size="14" class="text-amber-400" />
        <span class="text-xs font-semibold text-white tracking-tight">KHẨU Ý THANH TỊNH // SANGHA CHAT</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-mono text-[10px] text-[#888888] flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {{ onlineCount }} ĐỒNG TU
        </span>
        <button 
          @click="emit('update:modelValue', false)"
          class="w-6 h-6 flex items-center justify-center rounded-[4px] text-[#888888] hover:text-white hover:bg-white/10 transition-colors"
          title="Đóng (ESC)"
        >
          <ZenIcon name="close" :size="13" />
        </button>
      </div>
    </div>

    <!-- Messages Feed -->
    <div ref="chatFeedRef" class="p-3 h-56 overflow-y-auto space-y-2.5 text-xs">
      <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center text-[#737373] p-4">
        <ZenIcon name="lotus" :size="24" class="text-white/20 mb-2" />
        <p class="text-[11px]">Chưa có lời nguyện nào. Hãy gởi một tâm nguyện an lành đến đại chúng đồng tu.</p>
      </div>

      <div 
        v-for="(msg, idx) in messages" 
        :key="idx"
        class="bg-[#171717]/80 border border-white/5 rounded-[6px] p-2 space-y-1"
      >
        <div class="flex items-center justify-between text-[10px]">
          <div class="flex items-center gap-1.5">
            <span class="font-mono px-1 py-0.2 rounded-[2px] bg-white/10 text-white font-bold text-[9px]">
              {{ COUNTRY_CODES[msg.country] || 'VN' }}
            </span>
            <span class="font-semibold text-white tracking-tight">{{ msg.name }}</span>
          </div>
          <span class="font-mono text-[#737373]">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <p class="text-[#ededed] text-xs leading-relaxed font-normal">{{ msg.text }}</p>
      </div>
    </div>

    <!-- Quick Aspirations (Canned Mantras - Wrap, Zero Horizontal Scrolling) -->
    <div class="px-2.5 py-1.5 bg-[#141414] border-t border-white/5 flex flex-wrap gap-1.5">
      <button
        v-for="(mantra, i) in QUICK_MANTRAS"
        :key="i"
        @click="handleSend(mantra)"
        class="px-2 py-1 rounded-[4px] bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-[#a1a1a1] hover:text-white whitespace-nowrap transition-colors"
      >
        {{ mantra }}
      </button>
    </div>

    <!-- Input Bar -->
    <div class="p-2.5 bg-[#171717] border-t border-white/10 flex items-center gap-2">
      <input 
        v-model="inputMessage"
        @keydown="handleKeyDown"
        type="text" 
        maxlength="120"
        placeholder="Gởi lời nguyện chúc an lành... (Enter)"
        class="flex-1 bg-black/60 border border-white/15 focus:border-white/40 rounded-[6px] px-3 py-1.5 text-xs text-white placeholder-[#666666] outline-none transition-colors"
      />
      <button 
        @click="handleSend()"
        :disabled="!inputMessage.trim()"
        class="h-8 px-3 rounded-[6px] bg-white text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
      >
        <ZenIcon name="send" :size="12" />
        <span>Gởi</span>
      </button>
    </div>
  </div>
</template>

