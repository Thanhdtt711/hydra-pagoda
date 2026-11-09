<script setup lang="ts">
interface Props {
  modelValue?: string | number
  type?: 'text' | 'number' | 'email' | 'password' | 'search'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  error?: string
  theme?: 'dark' | 'light'
  size?: 'md' | 'sm'
  name?: string
  id?: string
  min?: number | string
  max?: number | string
  step?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
  error: undefined,
  theme: 'dark',
  size: 'md',
  name: undefined,
  id: undefined,
  min: undefined,
  max: undefined,
  step: undefined
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: Event): void
  (e: 'focus', value: FocusEvent): void
  (e: 'blur', value: FocusEvent): void
}>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div
    class="ui-input-wrap flex items-center w-full rounded-[6px] border bg-surface-card border-hairline text-primary transition-colors font-sans"
    :class="[
      props.size === 'sm' ? 'min-h-[32px] px-2 gap-1.5' : 'min-h-[40px] px-3 gap-2',
      props.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#474d57]',
      props.error ? '!border-trading-down focus-within:!ring-1 focus-within:!ring-trading-down' : 'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
    ]"
  >
    <div v-if="$slots.prefix" class="inline-flex items-center shrink-0 text-sm text-secondary">
      <slot name="prefix" />
    </div>

    <input
      :id="props.id"
      :name="props.name"
      :type="props.type"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :readonly="props.readonly"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      class="ui-input-field flex-1 min-w-0 w-full h-full p-0 m-0 border-none bg-transparent outline-none text-sm text-primary placeholder:text-muted leading-normal disabled:cursor-not-allowed"
      @input="onInput"
      @change="emit('change', $event)"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />

    <div v-if="$slots.suffix" class="inline-flex items-center shrink-0 text-sm text-secondary">
      <slot name="suffix" />
    </div>
  </div>
</template>
