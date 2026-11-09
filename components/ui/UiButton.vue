<script setup lang="ts">
import ZenIcon from '~/components/ZenIcon.vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'secondary-light' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  pill?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  block: false,
  pill: false,
  ariaLabel: undefined
})
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled || props.loading"
    :aria-label="props.ariaLabel"
    :aria-busy="props.loading ? 'true' : undefined"
    class="ui-btn ui-focus-ring inline-flex items-center justify-center font-sans font-semibold tracking-normal whitespace-nowrap cursor-pointer select-none transition-colors border box-border"
    :class="[
      `ui-btn--${props.variant}`,
      `ui-btn--${props.size}`,
      props.block ? 'w-full' : '',
      props.pill ? 'rounded-full px-6' : 'rounded-[6px]'
    ]"
  >
    <ZenIcon v-if="props.loading" name="loader-circle" :size="16" class="animate-spin mr-1.5" />
    <slot />
  </button>
</template>

<style scoped>
.ui-btn--md {
  height: 40px;
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
}

.ui-btn--sm {
  height: 28px;
  min-height: 28px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 4px;
}

.ui-btn--lg {
  height: 48px;
  min-height: 48px;
  padding: 0 24px;
  font-size: 16px;
}

/* Primary CTA: Nút vàng duy nhất mỗi màn, chữ đen #181a20 */
.ui-btn--primary {
  background-color: var(--primary, #fcd535);
  color: var(--on-primary, #181a20);
  border-color: var(--primary, #fcd535);
}

.ui-btn--primary:hover:not(:disabled) {
  background-color: var(--primary-active, #f0b90b);
  border-color: var(--primary-active, #f0b90b);
}

.ui-btn--primary:active:not(:disabled) {
  background-color: var(--primary-active, #f0b90b);
}

.ui-btn--primary:disabled {
  background-color: var(--primary-disabled, #3a3a1f) !important;
  color: var(--muted, #707a8a) !important;
  border-color: var(--primary-disabled, #3a3a1f) !important;
  cursor: not-allowed;
}

/* Secondary CTA: Thẻ elevated phẳng */
.ui-btn--secondary,
.ui-btn--secondary-light {
  background-color: var(--surface-card-dark, #1e2329);
  color: var(--body, #eaecef);
  border-color: var(--hairline-on-dark, #2b3139);
}

.ui-btn--secondary:hover:not(:disabled),
.ui-btn--secondary-light:hover:not(:disabled) {
  background-color: var(--surface-elevated-dark, #2b3139);
  border-color: var(--surface-elevated-dark, #2b3139);
  color: var(--on-dark, #ffffff);
}

.ui-btn--secondary:disabled,
.ui-btn--secondary-light:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Ghost */
.ui-btn--ghost {
  background-color: transparent;
  color: var(--text-secondary, #929aa5);
  border-color: transparent;
}

.ui-btn--ghost:hover:not(:disabled) {
  background-color: var(--surface-card-dark, #1e2329);
  color: var(--body, #eaecef);
}

.ui-btn--ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Link */
.ui-btn--link {
  background-color: transparent;
  color: var(--primary, #fcd535);
  border-color: transparent;
  padding: 0;
  height: auto;
  min-height: auto;
}

.ui-btn--link:hover:not(:disabled) {
  text-decoration: underline;
}
</style>
