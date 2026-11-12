<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import UiModal from '~/components/ui/UiModal.vue'
import UiKeycap from '~/components/ui/UiKeycap.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'selectEmote', action: 'bow' | 'pray' | 'prostrate' | 'meditate' | 'incense' | 'lantern'): void
}>()

interface EmoteAction {
  id: 'bow' | 'pray' | 'prostrate' | 'meditate' | 'incense' | 'lantern'
  name: string
  subname: string
  hotkey: string
}

const emotes: EmoteAction[] = [
  { id: 'bow', name: 'Chắp Tay Chào', subname: 'Kính chào đồng tu chánh niệm', hotkey: '1' },
  { id: 'pray', name: 'Niệm Phật Sen Nở', subname: 'Hoa sen bừng nở dưới bước chân', hotkey: '2' },
  { id: 'prostrate', name: 'Đảnh Lễ Tam Bảo', subname: 'Ngũ thể đầu địa cung kính', hotkey: '3' },
  { id: 'meditate', name: 'Tọa Thiền Kiết Già', subname: 'Thân tâm bất động, hơi thở tự nhiên', hotkey: '4' },
  { id: 'incense', name: 'Dâng 3 Nén Hương', subname: 'Tâm hương dâng cúng Tam Bảo', hotkey: '5' },
  { id: 'lantern', name: 'Thả Đèn Hoa Đăng', subname: 'Hoa đăng lung linh trôi theo dòng nước', hotkey: '6' }
]

function choose(e: EmoteAction) {
  emit('selectEmote', e.id)
  emit('close')
}

function handleKey(e: KeyboardEvent) {
  const num = parseInt(e.key)
  if (num >= 1 && num <= emotes.length) {
    choose(emotes[num - 1]!)
  } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
})
</script>

<template>
  <UiModal
    title="Bảng Cử Chỉ Tâm Linh"
    subtitle="Hành trì thân giáo — Phím tắt 1 - 6"
    @close="emit('close')"
  >
    <div class="space-y-2">
      <button 
        v-for="e in emotes" 
        :key="e.id"
        type="button"
        @click="choose(e)"
        class="w-full p-3 rounded-[2px] bg-surface-elevated border border-hairline hover:border-primary transition-colors flex items-center justify-between text-left cursor-pointer ui-focus-ring"
      >
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-primary">
            {{ e.name }}
          </div>
          <div class="text-xs text-secondary mt-0.5 truncate leading-tight">
            {{ e.subname }}
          </div>
        </div>
        <UiKeycap class="ml-2 shrink-0">{{ e.hotkey }}</UiKeycap>
      </button>
    </div>

    <template #footer>
      <div class="flex items-center justify-between text-xs text-secondary">
        <span>Bấm phím 1 - 6 hoặc nhấp chọn</span>
        <div class="flex items-center gap-1.5">
          <span>Phím tắt:</span>
          <UiKeycap>X</UiKeycap>
        </div>
      </div>
    </template>
  </UiModal>
</template>
