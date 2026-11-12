<script setup lang="ts">
import ZenIcon, { type WhitelistedIconName } from '~/components/ZenIcon.vue'

interface Props {
  name: WhitelistedIconName
  size?: number | string
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <ZenIcon :name="props.name" :size="props.size" :class="props.class" />
</template>

