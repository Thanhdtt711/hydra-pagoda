<script setup lang="ts">
import type { ZenChatMessage } from '~/lib/network/MultiplayerClient'
import ZenIcon from '~/components/ZenIcon.vue'
import { t } from '~/lib/ui/copy'

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
  <div v-if="modelValue" class="binance-drawer-anim fixed bottom-14 right-3 w-96 max-w-[92vw] z-30 flex flex-col bg-surface-card border border-hairline rounded-[2px] shadow-2xl overflow-hidden font-sans text-primary">
    <!-- Header: Spec-sheet Bar -->
    <div class="px-3.5 py-2.5 bg-surface-elevated border-b border-hairline flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ZenIcon name="message" :size="14" class="text-gold" />
        <span class="text-xs font-semibold text-primary tracking-tight">KHẨU Ý THANH TỊNH // SANGHA CHAT</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-numbers text-xs text-secondary flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-trading-up"></span>
          {{ onlineCount }} ĐỒNG TU
        </span>
        <button 
          @click="emit('update:modelValue', false)"
          class="w-6 h-6 flex items-center justify-center rounded-[2px] text-secondary hover:text-primary hover:bg-surface-card transition-colors ui-focus-ring cursor-pointer"
          title="Đóng (ESC)"
        >
          <ZenIcon name="x" :size="14" />
        </button>
      </div>
    </div>

    <!-- Messages Feed -->
    <div ref="chatFeedRef" class="p-3 h-56 overflow-y-auto space-y-2.5 text-xs">
      <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-center text-secondary p-4">
        <ZenIcon name="lotus" :size="24" class="text-secondary/40 mb-2" />
        <p class="text-xs m-0">{{ t('desc.chatEmpty') }}</p>
      </div>

      <div 
        v-for="(msg, idx) in messages" 
        :key="idx"
        class="bg-surface-elevated border border-hairline rounded-[2px] p-2 space-y-1"
      >
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5">
            <span class="font-numbers px-1.5 py-0.5 rounded-[2px] bg-canvas-dark text-secondary font-bold text-xs border border-hairline">
              {{ COUNTRY_CODES[msg.country] || 'VN' }}
            </span>
            <span class="font-semibold text-primary tracking-tight">{{ msg.name }}</span>
          </div>
          <span class="font-numbers text-secondary text-xs">{{ formatTime(msg.timestamp) }}</span>
        </div>
        <p class="text-primary text-xs leading-relaxed font-normal m-0">{{ msg.text }}</p>
      </div>
    </div>

    <!-- Quick Aspirations (Canned Mantras - Wrap, Zero Horizontal Scrolling) -->
    <div class="px-2.5 py-1.5 bg-canvas-dark border-t border-hairline flex flex-wrap gap-1.5">
      <button
        v-for="(mantra, i) in QUICK_MANTRAS"
        :key="i"
        @click="handleSend(mantra)"
        class="px-2 py-1 rounded-[2px] bg-surface-elevated hover:bg-surface-card border border-hairline text-xs text-secondary hover:text-primary whitespace-nowrap transition-colors cursor-pointer"
      >
        {{ mantra }}
      </button>
    </div>

    <!-- Input Bar -->
    <div class="p-2.5 bg-surface-elevated border-t border-hairline flex items-center gap-2">
      <input 
        v-model="inputMessage"
        @keydown="handleKeyDown"
        type="text" 
        maxlength="120"
        placeholder="Gởi lời nguyện chúc an lành... (Enter)"
        class="flex-1 bg-surface-card border border-hairline focus:border-primary focus:ring-1 focus:ring-primary rounded-[2px] px-3 py-1.5 text-xs text-primary placeholder:text-muted outline-none transition-colors"
      />
      <button 
        @click="handleSend()"
        :disabled="!inputMessage.trim()"
        class="h-8 px-3 rounded-[2px] bg-seal text-on-seal font-semibold text-xs flex items-center gap-1.5 hover:bg-seal-active disabled:bg-seal-disabled disabled:text-muted disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer border-none"
      >
        <ZenIcon name="send" :size="12" />
        <span>Gởi</span>
      </button>
    </div>
  </div>
</template>
