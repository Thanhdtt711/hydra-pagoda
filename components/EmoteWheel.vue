<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'selectEmote', action: 'bow' | 'pray' | 'prostrate' | 'meditate' | 'incense' | 'lantern'): void
}>()

interface EmoteAction {
  id: 'bow' | 'pray' | 'prostrate' | 'meditate' | 'incense' | 'lantern'
  name: string
  subname: string
  icon: string
  hotkey: string
}

const emotes: EmoteAction[] = [
  { id: 'bow', name: 'Chắp Tay Chào', subname: 'Namaste / Gassho / Wai kính chào đồng tu', icon: 'hand-bow', hotkey: '1' },
  { id: 'pray', name: 'Niệm Phật Sen Nở', subname: 'Hiệu ứng sen vàng bừng nở dưới bước chân', icon: 'lotus', hotkey: '2' },
  { id: 'prostrate', name: 'Đảnh Lễ Tam Bảo', subname: 'Ba lạy ngũ thể đầu địa cung kính', icon: 'sparkles', hotkey: '3' },
  { id: 'meditate', name: 'Tọa Thiền Kiết Già', subname: 'Ngồi xếp bằng thanh tịnh, hào quang lan tỏa', icon: 'meditation', hotkey: '4' },
  { id: 'incense', name: 'Dâng 3 Nén Hương', subname: 'Tâm hương dâng cúng chư Phật mười phương', icon: 'incense', hotkey: '5' },
  { id: 'lantern', name: 'Thả Đèn Hoa Đăng', subname: 'Hoa đăng lung linh trôi theo dòng nước cầu an', icon: 'sunset', hotkey: '6' }
]

function choose(e: EmoteAction) {
  emit('selectEmote', e.id)
  emit('close')
}

function handleKey(e: KeyboardEvent) {
  const num = parseInt(e.key)
  if (num >= 1 && num <= emotes.length) {
    choose(emotes[num - 1])
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
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Emote Wheel Dialog: Binance Web3 Geometry -->
    <div class="relative w-full max-w-lg bg-[#181a20] border border-[#2b3139] rounded-[10px] shadow-2xl p-4 font-sans overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-[#2b3139]">
        <div class="flex items-center gap-2">
          <ZenIcon name="sparkles" :size="15" class="text-[#FCD535]" />
          <span class="text-xs font-bold text-white tracking-tight uppercase font-mono">BÁNH XE CỬ CHỈ TÂM LINH // SACRED EMOTE WHEEL [X]</span>
        </div>
        <button 
          @click="emit('close')"
          class="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#707a8a] hover:text-white hover:bg-[#2b3139] cursor-pointer"
        >
          <ZenIcon name="close" :size="13" />
        </button>
      </div>

      <!-- 6 Emote Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        <button 
          v-for="e in emotes" 
          :key="e.id"
          @click="choose(e)"
          class="p-3 rounded-[6px] bg-[#1e2329] border border-[#2b3139] hover:border-[#FCD535] hover:bg-[#2b3139] transition-all flex flex-col items-center text-center group cursor-pointer"
        >
          <div class="w-10 h-10 rounded-[6px] bg-[#0b0e11] border border-[#2b3139] flex items-center justify-center text-[#FCD535] group-hover:scale-110 transition-transform mb-2">
            <ZenIcon :name="e.icon as any" :size="20" />
          </div>
          <div class="text-xs font-bold text-white group-hover:text-[#FCD535] transition-colors flex items-center gap-1 font-display">
            <span class="font-mono text-[10px] text-[#707a8a]">[{{ e.hotkey }}]</span>
            <span>{{ e.name }}</span>
          </div>
          <div class="text-[10px] text-[#929aa5] mt-1 line-clamp-2 leading-tight">
            {{ e.subname }}
          </div>
        </button>
      </div>

      <!-- Footer Note -->
      <div class="mt-3 pt-2.5 border-t border-[#2b3139] flex items-center justify-between text-[10px] text-[#707a8a] font-mono">
        <span>Bấm phím 1 - 6 hoặc nhấp chuột để thực hiện cử chỉ</span>
        <span class="text-[#FCD535]">Phím tắt: [X]</span>
      </div>
    </div>
  </div>
</template>

