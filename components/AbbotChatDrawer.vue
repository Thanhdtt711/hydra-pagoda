<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import ZenIcon from '~/components/ZenIcon.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import { t } from '~/lib/ui/copy'
import type { AbbotNpcEmotion } from '~/lib/world3d/characters/AbbotNpc'

interface Props {
  modelValue: boolean
  isNearAbbot?: boolean
}

interface ChatEntry {
  id: string
  role: 'abbot' | 'user'
  text: string
  emotion?: AbbotNpcEmotion
  sources?: string[]
}

interface GreetResponse {
  conversationId: string
  reply: string
  emotion: AbbotNpcEmotion
  suggested_questions: string[]
  custom_option_label?: string
  sources?: string[]
}

interface AskResponse {
  conversationId: string
  reply: string
  emotion: AbbotNpcEmotion
  suggested_questions: string[]
  sources: string[]
}

const props = withDefaults(defineProps<Props>(), {
  isNearAbbot: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'emotion', emotion: AbbotNpcEmotion): void
  (e: 'walk-to-abbot'): void
}>()

const EMOTION_META: Record<AbbotNpcEmotion, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  calm: { label: 'An nhiên', variant: 'neutral' },
  smile: { label: 'Hoan hỉ', variant: 'success' },
  thoughtful: { label: 'Trầm ngâm', variant: 'warning' },
  serious: { label: 'Trang nghiêm', variant: 'neutral' }
}

const SOURCE_LABELS: Record<string, string> = {
  'tong_quan_kinh_dich.md': 'Triết học Kinh Dịch',
  'bat_quai_am_duong_ngu_hanh.md': 'Bát quái & Ngũ hành',
  'tu_dieu_de.md': 'Tứ Diệu Đế',
  'nhan_qua.md': 'Giáo lý Nhân quả',
  'nghiep_va_luan_hoi.md': 'Nghiệp & Luân hồi',
  'vo_thuong_vo_nga_duyen_khoi.md': 'Vô thường & Duyên khởi',
  'bat_chanh_dao_luc_do_tam_bao.md': 'Bát chánh đạo & Tam bảo',
  'tu_vo_luong_tam_thien_dinh.md': 'Tứ vô lượng tâm & Chánh niệm',
  'ngu_gioi.md': 'Ngũ giới tại gia',
  'thap_thien_bat_quan_trai.md': 'Thập thiện & Giới xuất gia',
  'cac_tong_phai_phat_giao.md': 'Các tông phái & Thiền Trúc Lâm',
  'hien_chuong_to_chuc_ghpgvn.md': 'Hiến chương & Nội quy chùa (GHPGVN)',
  'tin_nguong_ton_giao_le_hoi.md': 'Pháp luật Tín ngưỡng & Lễ hội',
  'cong_duc_tu_thien_di_tich.md': 'Công đức & Từ thiện minh bạch',
  'le_chua_thap_huong.md': 'Văn hóa đi chùa & Nghi lễ',
  'ngay_ram_mong_mot.md': 'Ngày Rằm & Mồng Một',
  'tin_nguong_tho_mau_hau_dong.md': 'Phật giáo & Tín ngưỡng Thờ Mẫu',
  'huong_dan_hoat_dong_pagoda.md': 'Hướng dẫn sinh hoạt Pagoda'
}

const conversationId = ref<string>('')
const entries = ref<ChatEntry[]>([])
const suggestedQuestions = ref<string[]>([])
const customOptionLabel = ref<string>('Con muốn hỏi điều khác')
const currentEmotion = ref<AbbotNpcEmotion>('smile')
const questionInput = ref('')
const isLoading = ref(false)
const hasGreeted = ref(false)
const feedRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

function formatSourceTitle(rawPath: string): string {
  const fileName = rawPath.split('/').pop() || rawPath
  return SOURCE_LABELS[fileName] || 'Tủ sách Thiền môn'
}

function scrollToBottom() {
  nextTick(() => {
    if (feedRef.value) {
      feedRef.value.scrollTop = feedRef.value.scrollHeight
    }
  })
}

async function initGreeting() {
  if (isLoading.value) return
  isLoading.value = true
  try {
    const res = await $fetch<GreetResponse>('/api/npc/abbot/greet', {
      method: 'POST',
      body: { conversationId: conversationId.value || undefined }
    })
    conversationId.value = res.conversationId
    currentEmotion.value = res.emotion
    suggestedQuestions.value = res.suggested_questions || []
    customOptionLabel.value = res.custom_option_label || 'Con muốn hỏi điều khác'
    entries.value = [
      {
        id: `abbot_${Date.now()}`,
        role: 'abbot',
        text: res.reply,
        emotion: res.emotion,
        sources: res.sources || []
      }
    ]
    hasGreeted.value = true
    emit('emotion', res.emotion)
    scrollToBottom()
  } catch {
    entries.value = [
      {
        id: `abbot_fallback_${Date.now()}`,
        role: 'abbot',
        text: 'A Di Đà Phật, thầy chào con. Con muốn hỏi thầy điều gì về Phật pháp, nghi lễ hay sinh hoạt trong chùa?',
        emotion: 'smile'
      }
    ]
  } finally {
    isLoading.value = false
  }
}

async function submitQuestion(text: string, mode: 'preset' | 'free' = 'free') {
  const clean = text.trim()
  if (!clean || isLoading.value) return

  entries.value.push({
    id: `user_${Date.now()}`,
    role: 'user',
    text: clean
  })
  if (mode === 'free') {
    questionInput.value = ''
  }
  scrollToBottom()
  isLoading.value = true

  try {
    const res = await $fetch<AskResponse>('/api/npc/abbot/ask', {
      method: 'POST',
      body: {
        conversationId: conversationId.value || undefined,
        question: clean,
        mode
      }
    })
    conversationId.value = res.conversationId
    currentEmotion.value = res.emotion
    suggestedQuestions.value = res.suggested_questions || []
    entries.value.push({
      id: `abbot_${Date.now()}`,
      role: 'abbot',
      text: res.reply,
      emotion: res.emotion,
      sources: res.sources || []
    })
    emit('emotion', res.emotion)
  } catch {
    entries.value.push({
      id: `abbot_err_${Date.now()}`,
      role: 'abbot',
      text: 'A Di Đà Phật, tín hiệu chốn thiền môn vừa chập chờn đôi chút. Con vui lòng hỏi lại giúp thầy nhé.',
      emotion: 'calm'
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

async function handleFarewell() {
  if (isLoading.value) return
  isLoading.value = true
  try {
    const res = await $fetch<AskResponse>('/api/npc/abbot/ask', {
      method: 'POST',
      body: {
        conversationId: conversationId.value || undefined,
        question: 'Con xin phép chắp tay chào thầy.',
        mode: 'farewell'
      }
    })
    currentEmotion.value = res.emotion
    suggestedQuestions.value = []
    entries.value.push({
      id: `abbot_bye_${Date.now()}`,
      role: 'abbot',
      text: res.reply,
      emotion: res.emotion
    })
    emit('emotion', res.emotion)
    scrollToBottom()
    setTimeout(() => {
      emit('update:modelValue', false)
    }, 1400)
  } catch {
    emit('update:modelValue', false)
  } finally {
    isLoading.value = false
  }
}

function focusCustomInput() {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && !hasGreeted.value) {
      void initGreeting()
    } else if (open) {
      scrollToBottom()
    }
  }
)
</script>

<template>
  <aside
    v-if="modelValue"
    class="binance-drawer-anim fixed top-0 right-0 bottom-0 w-full max-w-[440px] z-40 flex flex-col bg-[#100e0c] border-l border-[#332d26] shadow-2xl font-sans text-white"
    aria-label="Hỏi đáp cùng Thầy Trụ Trì"
  >
    <!-- Header -->
    <header class="px-4 py-3 bg-[#1a1714] border-b border-[#332d26] flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <ZenIcon name="lotus" :size="20" class="text-[#c9a24b] shrink-0" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold text-white truncate">Thầy Trụ Trì</h2>
            <UiBadge :variant="EMOTION_META[currentEmotion].variant">
              {{ EMOTION_META[currentEmotion].label }}
            </UiBadge>
          </div>
          <p class="text-xs text-[#a89c88] leading-snug">Hiên Tiền Điện, hỏi đáp Phật pháp</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          @click="handleFarewell"
          :disabled="isLoading"
          class="px-2.5 py-1.5 rounded bg-[#26221d] hover:bg-[#332d26] text-xs font-medium text-[#ede4d3] transition cursor-pointer ui-focus-ring flex items-center gap-1.5"
          title="Chắp tay chào tạm biệt thầy"
        >
          <ZenIcon name="hand-bow" :size="16" class="text-[#c9a24b]" />
          <span>Chào thầy</span>
        </button>
        <button
          type="button"
          @click="emit('update:modelValue', false)"
          aria-label="Đóng khung trò chuyện (ESC)"
          title="Đóng (ESC)"
          class="w-8 h-8 rounded flex items-center justify-center text-[#a89c88] hover:text-white hover:bg-[#26221d] transition cursor-pointer ui-focus-ring"
        >
          <ZenIcon name="x" :size="16" />
        </button>
      </div>
    </header>

    <!-- Gợi ý đi bộ lại gần thầy nếu người chơi mở từ menu từ xa -->
    <div
      v-if="!isNearAbbot"
      class="px-4 py-2 bg-[#1a1714]/80 border-b border-[#332d26] flex items-center justify-between gap-2 text-xs shrink-0"
    >
      <span class="text-[#a89c88]">Thầy đang đứng ngoài thềm Hiên Tiền Điện.</span>
      <button
        type="button"
        @click="emit('walk-to-abbot')"
        class="text-[#c9a24b] hover:underline font-semibold shrink-0 cursor-pointer"
      >
        {{ t('btn.walkToAbbot') }}
      </button>
    </div>

    <!-- Lưu ý văn hóa - giáo dục -->
    <div class="px-4 py-2 bg-[#14120f] border-b border-[#332d26] flex items-start gap-2 text-xs text-[#a89c88] shrink-0">
      <ZenIcon name="info" :size="16" class="text-[#c9a24b] shrink-0 mt-0.5" />
      <span>{{ t('desc.abbotNote') }}</span>
    </div>

    <!-- Feed hội thoại -->
    <div ref="feedRef" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div
        v-for="item in entries"
        :key="item.id"
        class="flex flex-col"
        :class="item.role === 'user' ? 'items-end' : 'items-start'"
      >
        <div
          class="max-w-[92%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed border"
          :class="
            item.role === 'user'
              ? 'bg-[#26221d] border-[#4a4237] text-white'
              : 'bg-[#1a1714] border-[#332d26] text-[#ede4d3]'
          "
        >
          <p class="whitespace-pre-line">{{ item.text }}</p>

          <!-- Nhãn tài liệu tham khảo (dạng tên dễ đọc, không phơi cấu trúc thư mục nội bộ) -->
          <div
            v-if="item.role === 'abbot' && item.sources && item.sources.length > 0"
            class="mt-2 pt-2 border-t border-[#332d26] flex flex-wrap items-center gap-1.5"
          >
            <span class="text-xs text-[#a89c88]">Tham khảo:</span>
            <span
              v-for="src in item.sources"
              :key="src"
              class="px-2 py-0.5 rounded bg-[#26221d] text-xs text-[#c9a24b]"
            >
              {{ formatSourceTitle(src) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex items-center gap-2 text-xs text-[#a89c88] px-1">
        <ZenIcon name="loader-circle" :size="16" class="text-[#c9a24b]" />
        <span>Thầy đang suy ngẫm...</span>
      </div>

      <!-- Câu hỏi gợi ý (tối đa 6 câu ở lượt đầu, 2-3 câu sau mỗi câu trả lời) -->
      <div v-if="!isLoading && suggestedQuestions.length > 0" class="pt-1 space-y-2">
        <div class="text-xs font-semibold text-[#a89c88]">
          Gợi ý cho con
        </div>
        <div class="flex flex-col gap-1.5">
          <button
            v-for="q in suggestedQuestions"
            :key="q"
            type="button"
            @click="submitQuestion(q, 'preset')"
            class="w-full text-left px-3 py-2 rounded-md bg-[#1a1714] hover:bg-[#26221d] border border-[#332d26] hover:border-[#c9a24b]/70 text-xs font-medium text-[#ede4d3] transition flex items-center justify-between gap-2 cursor-pointer ui-focus-ring"
          >
            <span class="leading-snug">{{ q }}</span>
            <ZenIcon name="chevron-right" :size="16" class="text-[#a89c88] shrink-0" />
          </button>

          <button
            type="button"
            @click="focusCustomInput"
            class="w-full text-left px-3 py-2 rounded-md bg-[#14120f] hover:bg-[#26221d] border border-dashed border-[#4a4237] text-xs font-semibold text-[#c9a24b] transition flex items-center justify-between gap-2 cursor-pointer ui-focus-ring"
          >
            <span>{{ customOptionLabel }}</span>
            <ZenIcon name="message" :size="16" class="text-[#c9a24b] shrink-0" />
          </button>
        </div>
      </div>
    </div>

    <!-- Thanh nhập câu hỏi tự do -->
    <form
      @submit.prevent="submitQuestion(questionInput, 'free')"
      class="p-3 bg-[#1a1714] border-t border-[#332d26] flex items-center gap-2 shrink-0"
    >
      <input
        ref="inputRef"
        v-model="questionInput"
        type="text"
        maxlength="400"
        :disabled="isLoading"
        placeholder="Con muốn thưa hỏi thầy điều gì..."
        class="flex-1 min-w-0 h-10 px-3 rounded-md bg-[#100e0c] border border-[#332d26] focus:border-[#c9a24b] focus:ring-1 focus:ring-primary focus:outline-none text-sm text-white placeholder-[#a89c88]"
      />
      <UiButton
        type="submit"
        variant="primary"
        :disabled="isLoading || !questionInput.trim()"
        class="h-10 px-3 shrink-0"
      >
        <ZenIcon name="send" :size="16" />
        <span>Hỏi thầy</span>
      </UiButton>
    </form>
  </aside>
</template>

