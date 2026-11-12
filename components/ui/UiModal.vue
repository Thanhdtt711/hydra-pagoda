<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import ZenIcon from '~/components/ZenIcon.vue'

interface Props {
  title: string
  subtitle?: string
  maxWidth?: 'md' | 'lg' | 'xl'
  theme?: 'dark' | 'light'
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: undefined,
  maxWidth: 'md',
  theme: 'dark'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  previouslyFocusedElement = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKeyDown)
  dialogRef.value?.focus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  previouslyFocusedElement?.focus?.()
})
</script>

<template>
  <!-- Transparent backdrop allows 3D canvas interaction / viewing while catching outside clicks -->
  <div class="fixed inset-0 z-50 flex justify-end bg-transparent pointer-events-auto" @click.self="emit('close')">
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-label="props.title"
      tabindex="-1"
      class="binance-drawer-anim w-full sm:w-[380px] lg:w-[420px] max-w-[440px] h-full h-dvh bg-surface-card border-l border-hairline flex flex-col text-primary font-sans outline-none shadow-2xl relative select-text"
    >
      <!-- Header -->
      <header class="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-hairline shrink-0 bg-surface-card">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2.5 flex-wrap">
            <h2 class="text-base font-bold text-primary m-0 truncate">{{ props.title }}</h2>
            <slot name="header-badge" />
          </div>
          <p v-if="props.subtitle" class="text-xs text-secondary mt-1 m-0 leading-normal line-clamp-2">
            {{ props.subtitle }}
          </p>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <slot name="header-actions" />
          <button
            type="button"
            aria-label="Đóng cửa sổ"
            class="w-[40px] h-[40px] shrink-0 inline-flex items-center justify-center rounded text-secondary hover:text-primary hover:bg-surface-elevated transition-colors ui-focus-ring cursor-pointer border-none bg-transparent"
            @click="emit('close')"
          >
            <ZenIcon name="x" :size="16" />
          </button>
        </div>
      </header>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <slot />
      </div>

      <!-- Footer -->
      <footer v-if="$slots.footer" class="p-3.5 border-t border-hairline bg-surface-card shrink-0">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .binance-drawer-anim {
    animation: none !important;
  }
}
</style>
