<script setup lang="ts">
interface Props {
  value: string | number
  label?: string
  dotColor?: 'success' | 'warning' | 'danger' | 'info'
  interactive?: boolean
  hideLabelOnCompact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  dotColor: undefined,
  interactive: false,
  hideLabelOnCompact: true
})

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <component
    :is="props.interactive ? 'button' : 'div'"
    :type="props.interactive ? 'button' : undefined"
    class="ui-chip inline-flex items-center gap-2 min-h-[36px] px-3 rounded-[4px] bg-surface-elevated border border-hairline text-primary font-sans whitespace-nowrap"
    :class="props.interactive ? 'ui-chip--interactive ui-focus-ring cursor-pointer hover:border-[var(--border-strong,#474d57)] transition-colors' : ''"
    @click="props.interactive ? emit('click') : undefined"
  >
    <span
      v-if="props.dotColor"
      class="w-2 h-2 rounded-full shrink-0"
      :class="[
        props.dotColor === 'success' ? 'bg-trading-up' : '',
        props.dotColor === 'warning' ? 'bg-primary' : '',
        props.dotColor === 'danger' ? 'bg-trading-down' : '',
        props.dotColor === 'info' ? 'bg-info' : ''
      ]"
      aria-hidden="true"
    />
    <span class="font-numbers font-semibold text-sm text-primary">{{ props.value }}</span>
    <span
      v-if="props.label"
      class="text-xs text-secondary"
      :class="props.hideLabelOnCompact ? 'hidden xl:inline' : ''"
    >
      {{ props.label }}
    </span>
    <slot />
  </component>
</template>

<style scoped>
.ui-chip--interactive:hover {
  background-color: #333b44;
}
</style>
