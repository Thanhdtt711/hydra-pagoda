<script setup lang="ts">
interface Props {
  label?: string
  value: string | number
  unit?: string
  highlight?: boolean
  variant?: 'neutral' | 'gold' | 'success' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  theme?: 'dark' | 'light'
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  unit: undefined,
  highlight: false,
  variant: 'neutral',
  size: 'md',
  theme: 'dark'
})
</script>

<template>
  <div
    class="ui-stat-cell inline-flex items-center gap-2 font-sans"
    :class="{ 'is-highlight': props.highlight }"
  >
    <div class="inline-flex flex-col gap-0.5">
      <span
        class="font-numbers font-semibold tabular-nums inline-flex items-baseline gap-1 tracking-tight"
        :class="[
          props.size === 'sm' ? 'text-sm' : '',
          props.size === 'md' ? 'text-base' : '',
          props.size === 'lg' ? 'text-xl' : '',
          props.highlight || props.variant === 'gold' ? 'text-gold' : '',
          props.variant === 'success' ? 'text-up' : '',
          props.variant === 'danger' ? 'text-down' : '',
          props.variant === 'neutral' && !props.highlight ? 'text-primary' : ''
        ]"
      >
        {{ props.value }}
        <span v-if="props.unit" class="font-sans text-xs font-medium text-secondary">{{ props.unit }}</span>
      </span>
      <span v-if="props.label || $slots.label" class="text-xs text-secondary leading-tight">
        <slot name="label">{{ props.label }}</slot>
      </span>
    </div>
    <div v-if="$slots.action" class="inline-flex items-center">
      <slot name="action" />
    </div>
  </div>
</template>
