<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  value?: string | number
  subvalue?: string
  clickable?: boolean
  dense?: boolean
  theme?: 'dark' | 'light'
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  subtitle: undefined,
  value: undefined,
  subvalue: undefined,
  clickable: false,
  dense: false,
  theme: 'dark'
})

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <div
    class="ui-data-row flex items-center justify-between gap-4 border-b border-hairline transition-colors text-primary font-sans"
    :class="[
      props.dense ? 'py-2 px-3 gap-3' : 'py-3 px-4',
      props.clickable ? 'cursor-pointer hover:bg-surface-elevated ui-focus-ring' : ''
    ]"
    role="row"
    :tabindex="props.clickable ? 0 : undefined"
    @click="props.clickable ? emit('click') : undefined"
    @keydown.enter="props.clickable ? emit('click') : undefined"
  >
    <!-- Left slot or Title/Subtitle -->
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <slot name="leading" />
      <div v-if="props.title || props.subtitle || $slots.title || $slots.subtitle" class="flex flex-col gap-0.5 min-w-0">
        <div class="text-sm font-semibold text-primary truncate leading-tight">
          <slot name="title">{{ props.title }}</slot>
        </div>
        <div v-if="props.subtitle || $slots.subtitle" class="text-xs text-secondary truncate leading-normal">
          <slot name="subtitle">{{ props.subtitle }}</slot>
        </div>
      </div>
    </div>

    <!-- Center content slot (e.g. badges, tags) -->
    <div v-if="$slots.center" class="flex items-center gap-2 shrink-0">
      <slot name="center" />
    </div>

    <!-- Right slot or Value/Subvalue/Action -->
    <div class="flex items-center gap-3 shrink-0 text-right">
      <div v-if="props.value || props.subvalue || $slots.value || $slots.subvalue" class="flex flex-col items-end gap-0.5">
        <span class="font-numbers font-semibold text-sm text-primary leading-tight">
          <slot name="value">{{ props.value }}</slot>
        </span>
        <span v-if="props.subvalue || $slots.subvalue" class="text-xs text-secondary leading-tight">
          <slot name="subvalue">{{ props.subvalue }}</slot>
        </span>
      </div>
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
.ui-data-row:last-child {
  border-bottom: none;
}
</style>
