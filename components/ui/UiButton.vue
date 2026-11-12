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
      props.pill ? 'rounded-full px-6' : 'rounded-[2px]'
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

/* Primary CTA: ấn son, hành động chính duy nhất mỗi màn, chữ kem */
.ui-btn--primary {
  background-color: var(--seal, #b8372b);
  color: var(--on-seal, #f6ecd8);
  border-color: var(--seal, #b8372b);
}

.ui-btn--primary:hover:not(:disabled) {
  background-color: var(--seal-active, #9e2d22);
  border-color: var(--seal-active, #9e2d22);
}

.ui-btn--primary:active:not(:disabled) {
  background-color: var(--seal-active, #9e2d22);
}

.ui-btn--primary:disabled {
  background-color: var(--seal-disabled, #4a2622) !important;
  color: var(--muted, #968b79) !important;
  border-color: var(--seal-disabled, #4a2622) !important;
  cursor: not-allowed;
}

/* Secondary CTA: Thẻ elevated phẳng */
.ui-btn--secondary,
.ui-btn--secondary-light {
  background-color: var(--surface-card-dark, #1a1714);
  color: var(--body, #ede4d3);
  border-color: var(--hairline-on-dark, #26221d);
}

.ui-btn--secondary:hover:not(:disabled),
.ui-btn--secondary-light:hover:not(:disabled) {
  background-color: var(--surface-elevated-dark, #26221d);
  border-color: var(--surface-elevated-dark, #26221d);
  color: var(--on-dark, #f5eddc);
}

.ui-btn--secondary:disabled,
.ui-btn--secondary-light:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Ghost */
.ui-btn--ghost {
  background-color: transparent;
  color: var(--text-secondary, #a89c88);
  border-color: transparent;
}

.ui-btn--ghost:hover:not(:disabled) {
  background-color: var(--surface-card-dark, #1a1714);
  color: var(--body, #ede4d3);
}

.ui-btn--ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Link */
.ui-btn--link {
  background-color: transparent;
  color: var(--primary, #c9a24b);
  border-color: transparent;
  padding: 0;
  height: auto;
  min-height: auto;
}

.ui-btn--link:hover:not(:disabled) {
  text-decoration: underline;
}
</style>
