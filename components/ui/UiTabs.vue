<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import ZenIcon from '~/components/ZenIcon.vue'

export interface UiTabItem {
  id: string
  label: string
  count?: number
}

interface Props {
  modelValue: string
  tabs?: ReadonlyArray<UiTabItem>
  items?: ReadonlyArray<UiTabItem>
  layout?: 'horizontal' | 'segmented' | 'vertical'
  theme?: 'dark' | 'light'
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  tabs: undefined,
  items: undefined,
  layout: 'horizontal',
  theme: 'dark',
  ariaLabel: 'Điều hướng danh mục'
})

const tabList = computed(() => props.tabs || props.items || [])

const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
const tabButtonRefs = ref<Record<string, HTMLElement>>({})
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function checkScroll() {
  const el = scrollContainerRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function scroll(dir: 'left' | 'right') {
  const el = scrollContainerRef.value
  if (!el) return
  const delta = dir === 'left' ? -120 : 120
  el.scrollBy({ left: delta, behavior: 'smooth' })
}

function scrollToActiveTab() {
  nextTick(() => {
    const activeEl = tabButtonRefs.value[props.modelValue]
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
    checkScroll()
  })
}

function selectTab(id: string) {
  emit('update:modelValue', id)
}

function onKeyDown(e: KeyboardEvent, idx: number) {
  const total = tabList.value.length
  if (total === 0) return
  let nextIdx = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    nextIdx = (idx + 1) % total
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    nextIdx = (idx - 1 + total) % total
  }
  if (nextIdx >= 0 && tabList.value[nextIdx]) {
    emit('update:modelValue', tabList.value[nextIdx]!.id)
  }
}

watch(() => props.modelValue, () => {
  scrollToActiveTab()
})

onMounted(() => {
  checkScroll()
  scrollToActiveTab()
  window.addEventListener('resize', checkScroll)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScroll)
})
</script>

<template>
  <div class="relative w-full flex items-center">
    <!-- Left Scroll Chevron (only when scrolled right) -->
    <button
      v-if="props.layout === 'horizontal' && canScrollLeft"
      type="button"
      aria-label="Cuộn sang trái"
      class="absolute left-0 z-20 w-6 h-full flex items-center justify-center bg-gradient-to-r from-surface-card via-surface-card to-transparent text-secondary hover:text-white cursor-pointer"
      @click="scroll('left')"
    >
      <ZenIcon name="chevron-left" :size="13" />
    </button>

    <div
      ref="scrollContainerRef"
      role="tablist"
      :aria-label="props.ariaLabel"
      :aria-orientation="props.layout === 'vertical' ? 'vertical' : 'horizontal'"
      class="ui-tabs flex w-full"
      :class="[
        props.layout === 'horizontal' ? 'flex-row overflow-x-auto border-b border-hairline gap-1 sm:gap-2 no-scrollbar scroll-smooth px-0.5' : '',
        props.layout === 'segmented' ? 'grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-md bg-surface-card border border-hairline' : ''
      ]"
      @scroll="checkScroll"
    >
      <button
        v-for="(item, idx) in tabList"
        :key="item.id"
        :ref="(el) => { if (el) tabButtonRefs[item.id] = el as HTMLElement }"
        type="button"
        role="tab"
        :aria-selected="props.modelValue === item.id ? 'true' : 'false'"
        :tabindex="props.modelValue === item.id ? 0 : -1"
        class="ui-tabs__item ui-focus-ring cursor-pointer font-sans whitespace-nowrap transition-colors"
        :class="[
          props.layout === 'horizontal'
            ? [
                'relative inline-flex items-center justify-center px-2 py-1.5 min-h-[36px] text-xs bg-transparent border-none border-b-2 font-medium shrink-0',
                props.modelValue === item.id
                  ? 'text-gold font-bold !border-b-gold !border-b-2'
                  : 'text-secondary hover:text-white border-b-transparent'
              ]
            : [
                'min-h-[36px] px-3 rounded text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 border',
                props.modelValue === item.id
                  ? 'bg-surface-elevated text-gold font-bold border-gold'
                  : 'bg-transparent text-secondary hover:text-white hover:bg-surface-elevated border-transparent'
              ]
        ]"
        @click="selectTab(item.id)"
        @keydown="onKeyDown($event, idx)"
      >
        <ZenIcon
          v-if="props.layout === 'segmented' && props.modelValue === item.id"
          name="check"
          :size="14"
          class="text-gold"
        />
        <span>{{ item.label }}</span>
        <span v-if="typeof item.count === 'number'" class="font-numbers text-xs ml-1 text-secondary">
          ({{ item.count }})
        </span>
      </button>
    </div>

    <!-- Right Scroll Chevron (only when can scroll right) -->
    <button
      v-if="props.layout === 'horizontal' && canScrollRight"
      type="button"
      aria-label="Cuộn sang phải"
      class="absolute right-0 z-20 w-6 h-full flex items-center justify-center bg-gradient-to-l from-surface-card via-surface-card to-transparent text-secondary hover:text-white cursor-pointer"
      @click="scroll('right')"
    >
      <ZenIcon name="chevron-right" :size="13" />
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.ui-tabs::-webkit-scrollbar {
  display: none;
}
</style>
