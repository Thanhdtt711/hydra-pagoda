<script setup lang="ts">
interface Props {
  variant?: 'subtle' | 'card-dark' | 'elevated-dark' | 'card-light' | 'card' | 'elevated'
  rounded?: 'sm' | 'md' | 'lg' | 'xl'
  padding?: 'sm' | 'md' | 'lg' | 'xl' | 'none'
  interactive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'card-dark',
  rounded: 'lg',
  padding: 'md',
  interactive: false
})
</script>

<template>
  <div
    class="ui-card box-border transition-colors border"
    :class="[
      `ui-card--${props.variant}`,
      `ui-card--r-${props.rounded}`,
      `ui-card--p-${props.padding}`,
      props.interactive ? 'ui-card--interactive' : ''
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.ui-card--subtle,
.ui-card--card-dark,
.ui-card--card,
.ui-card--card-light {
  background-color: var(--surface-card-dark, #1a1714);
  border-color: var(--hairline-on-dark, #26221d);
  color: var(--body, #ede4d3);
}

.ui-card--elevated-dark,
.ui-card--elevated {
  background-color: var(--surface-elevated-dark, #26221d);
  border-color: var(--hairline-on-dark, #26221d);
  color: var(--body, #ede4d3);
}

.ui-card--r-sm { border-radius: var(--radius-sm, 4px); }
.ui-card--r-md { border-radius: var(--radius-md, 6px); }
.ui-card--r-lg { border-radius: var(--radius-lg, 8px); }
.ui-card--r-xl { border-radius: var(--radius-xl, 12px); }

.ui-card--p-none { padding: 0; }
.ui-card--p-sm { padding: var(--space-sm, 12px); }
.ui-card--p-md { padding: var(--space-md, 16px); }
.ui-card--p-lg { padding: var(--space-lg, 24px); }
.ui-card--p-xl { padding: var(--space-xl, 32px); }

.ui-card--interactive {
  cursor: pointer;
}

.ui-card--interactive:hover {
  background-color: var(--surface-elevated-dark, #26221d);
  border-color: var(--border-strong, #4a4237);
}
</style>
