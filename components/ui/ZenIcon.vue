<script setup lang="ts">
import ZenIcon from '~/components/ZenIcon.vue'

interface Props {
  name: string
  size?: number | string
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <ZenIcon :name="props.name" :size="props.size" :class="props.class" />
</template>

