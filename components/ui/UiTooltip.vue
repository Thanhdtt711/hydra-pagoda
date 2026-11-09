<script setup lang="ts">
import { ref } from 'vue'
import ZenIcon from '~/components/ZenIcon.vue'

interface Props {
  text: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Thông tin lưu ý'
})

const open = ref(false)
</script>

<template>
  <div
    class="ui-tooltip-wrap relative inline-flex items-center"
    @mouseenter="open = true"
    @mouseleave="open = false"
  >
    <button
      type="button"
      :aria-label="props.label"
      :aria-expanded="open ? 'true' : 'false'"
      class="ui-tooltip-btn ui-focus-ring inline-flex items-center justify-center w-8 h-8 rounded-[4px] bg-transparent border-none text-secondary hover:text-primary hover:bg-surface-elevated cursor-pointer transition-colors"
      @click="open = !open"
      @focus="open = true"
      @blur="open = false"
    >
      <ZenIcon name="info" :size="16" />
    </button>

    <div
      v-if="open"
      role="tooltip"
      class="ui-tooltip-content absolute top-[calc(100%+8px)] right-0 z-50 w-64 p-3 rounded-[6px] bg-surface-elevated border border-hairline font-sans text-xs text-primary leading-normal shadow-xl select-text"
    >
      {{ props.text }}
    </div>
  </div>
</template>
