<script setup lang="ts">
interface Props {
  variant?: 'neutral' | 'gold' | 'warning' | 'success' | 'danger' | 'info'
  dot?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  dot: false
})
</script>

<template>
  <span class="ui-badge" :class="`ui-badge--${props.variant}`">
    <span v-if="props.dot" class="ui-badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-sans, 'Inter', sans-serif);
  font-size: var(--text-caption, 12px);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.ui-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: currentColor;
  flex-shrink: 0;
}

.ui-badge--neutral {
  background-color: var(--surface-elevated-dark, #26221d);
  color: var(--text-secondary, #a89c88);
  border: 1px solid var(--hairline-on-dark, #26221d);
}

.ui-badge--gold,
.ui-badge--warning {
  background-color: rgba(201,162,75, 0.15);
  color: var(--primary, #c9a24b);
  border: 1px solid rgba(201,162,75, 0.3);
}

.ui-badge--success {
  background-color: rgba(14, 203, 129, 0.15);
  color: var(--trading-up, #0ecb81);
  border: 1px solid rgba(14, 203, 129, 0.3);
}

.ui-badge--danger {
  background-color: rgba(246, 70, 93, 0.15);
  color: var(--trading-down, #f6465d);
  border: 1px solid rgba(246, 70, 93, 0.3);
}

.ui-badge--info {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--info, #3b82f6);
  border: 1px solid rgba(59, 130, 246, 0.3);
}
</style>
