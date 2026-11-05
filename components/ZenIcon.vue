<script setup lang="ts">
interface Props {
  name: 
    | 'pagoda'
    | 'coin'
    | 'lotus'
    | 'cardano'
    | 'bell'
    | 'bell-off'
    | 'sun'
    | 'sunset'
    | 'moon'
    | 'camera'
    | 'cards'
    | 'meditation'
    | 'shield'
    | 'check'
    | 'close'
    | 'info'
    | 'incense'
    | 'sparkles'
    | 'users'
    | 'message'
    | 'hand-bow'
    | 'send'
    | 'radio'
  size?: number | string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 15,
  class: ''
})

const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <svg
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="['inline-block shrink-0 align-middle', props.class]"
  >
    <!-- Pagoda / Eastern Sanctuary Arch -->
    <template v-if="name === 'pagoda'">
      <path d="M2 20h20" />
      <path d="M4 20v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5" />
      <path d="M9 20v-5h6v5" />
      <path d="M1 11c3-2 6-2 11-5 5 3 8 3 11 5" />
      <path d="M6 7c2-2 4-2 6-4 2 2 4 2 6 4" />
      <path d="M12 1v2" />
    </template>

    <!-- Merit Coin / Tabular Currency -->
    <template v-else-if="name === 'coin'">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 7.5v1.5M12 15v1.5" />
    </template>

    <!-- Stylized Geometric Lotus -->
    <template v-else-if="name === 'lotus'">
      <path d="M12 4c-2 3.5-2 8 0 12 2-4 2-8.5 0-12z" />
      <path d="M12 16c-3-2-6.5-2-9 1 2.8 2.8 6.5 2.8 9-1z" />
      <path d="M12 16c3-2 6.5-2 9 1-2.8 2.8-6.5 2.8-9-1z" />
      <path d="M5 20c3.5-1 10.5-1 14 0" />
    </template>

    <!-- Cardano ADA Official Geometric Rings Glyph -->
    <template v-else-if="name === 'cardano'">
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="20" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="6.34" cy="6.34" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17.66" cy="17.66" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="6.34" cy="17.66" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17.66" cy="6.34" r="1.2" fill="currentColor" stroke="none" />
    </template>

    <!-- Temple Bell -->
    <template v-else-if="name === 'bell'">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </template>

    <!-- Temple Bell Off -->
    <template v-else-if="name === 'bell-off'">
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </template>

    <!-- Sun (Daytime) -->
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </template>

    <!-- Sunset (Dusk) -->
    <template v-else-if="name === 'sunset'">
      <path d="M12 9V2M4.93 9.93l1.41-1.41M2 17h2M20 17h2M19.07 9.93l-1.41-1.41M22 21H2" />
      <path d="M16 5l-4 4-4-4" />
      <path d="M16 17a4 4 0 0 0-8 0" />
    </template>

    <!-- Moon (Night) -->
    <template v-else-if="name === 'moon'">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </template>

    <!-- Camera (Minecraft Perspective Switch) -->
    <template v-else-if="name === 'camera'">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </template>

    <!-- Heritage Card Deck / Layers -->
    <template v-else-if="name === 'cards'">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5" />
      <path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5" />
    </template>

    <!-- Zen Meditation -->
    <template v-else-if="name === 'meditation'">
      <circle cx="12" cy="5" r="2.5" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M9 13l-3 4M15 13l3 4" />
    </template>

    <!-- Shield / Compliance & Governance -->
    <template v-else-if="name === 'shield'">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 9v3M12 15h.01" />
    </template>

    <!-- Incense Burner / Altar -->
    <template v-else-if="name === 'incense'">
      <path d="M5 14h14l-2 6H7l-2-6z" />
      <path d="M4 14h16" />
      <path d="M10 5v5M12 3v7M14 6v4" />
      <circle cx="10" cy="5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="6" r="0.75" fill="currentColor" stroke="none" />
    </template>

    <!-- Checkmark -->
    <template v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </template>

    <!-- Close Cross -->
    <template v-else-if="name === 'close'">
      <path d="M18 6 6 18M6 6l12 12" />
    </template>

    <!-- Info / Tooltip -->
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </template>

    <!-- Sparkles / Aura -->
    <template v-else-if="name === 'sparkles'">
      <path d="m12 3 1.91 5.09L19 10l-5.09 1.91L12 17l-1.91-5.09L5 10l5.09-1.91L12 3Z" />
    </template>

    <!-- Users / Sangha Online Community -->
    <template v-else-if="name === 'users'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </template>

    <!-- Message / Zen Chat -->
    <template v-else-if="name === 'message'">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </template>

    <!-- Hand Bow / Chắp tay chào (Namaste Anjali Mudra) -->
    <template v-else-if="name === 'hand-bow'">
      <path d="M12 3v18" />
      <path d="M8 8a4 4 0 0 1 4-4 4 4 0 0 1 4 4v7a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V8z" />
      <path d="M8 12H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3" />
      <path d="M16 12h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3" />
    </template>

    <!-- Send -->
    <template v-else-if="name === 'send'">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </template>

    <!-- Radio / Live Signal -->
    <template v-else-if="name === 'radio'">
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </template>
  </svg>
</template>

