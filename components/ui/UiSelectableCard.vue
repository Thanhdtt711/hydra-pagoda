<script setup lang="ts">
import ZenIcon from '~/components/ZenIcon.vue'

interface Props {
  selected?: boolean
  disabled?: boolean
  title?: string
  description?: string
  roleType?: 'radio' | 'button'
  theme?: 'dark' | 'light'
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  disabled: false,
  title: undefined,
  description: undefined,
  roleType: 'radio',
  theme: 'dark'
})

const emit = defineEmits<{
  (e: 'select'): void
}>()

function handleClick() {
  if (!props.disabled) {
    emit('select')
  }
}
</script>

<template>
  <button
    type="button"
    :role="props.roleType"
    :aria-checked="props.roleType === 'radio' ? (props.selected ? 'true' : 'false') : undefined"
    :aria-pressed="props.roleType === 'button' ? (props.selected ? 'true' : 'false') : undefined"
    :disabled="props.disabled"
    class="ui-selectable-card ui-focus-ring relative flex items-start justify-between gap-2.5 w-full min-h-[44px] p-3 rounded-md font-sans text-left cursor-pointer transition-colors border box-border"
    :class="[
      props.selected
        ? 'bg-surface-elevated !border-gold shadow-sm'
        : 'bg-surface-card border-hairline hover:bg-surface-elevated hover:border-hairline',
      props.disabled ? 'opacity-50 cursor-not-allowed' : ''
    ]"
    @click="handleClick"
  >
    <div class="flex-1 min-w-0">
      <template v-if="props.title || props.description">
        <div
          v-if="props.title"
          class="text-sm leading-tight transition-colors"
          :class="props.selected ? 'font-bold text-gold' : 'font-semibold text-white'"
        >
          {{ props.title }}
        </div>
        <div v-if="props.description" class="text-xs text-secondary mt-1 leading-normal">
          {{ props.description }}
        </div>
      </template>
      <slot />
    </div>

    <!-- Whitelist SVG tick icon for selected state -->
    <span
      v-if="props.selected"
      class="inline-flex items-center justify-center w-4 h-4 text-gold shrink-0 mt-0.5"
      aria-hidden="true"
    >
      <ZenIcon name="check" :size="15" />
    </span>
  </button>
</template>
