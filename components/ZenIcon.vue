<script setup lang="ts">
import { computed } from 'vue'

export type WhitelistedIconName =
  // 1. Nút đóng modal (X)
  | 'x'
  | 'close'
  // 2. Dấu tick cho trạng thái "đang chọn"
  | 'check'
  // 3. Mũi tên mở/đóng dropdown, accordion, cuộn tab
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'chevron-left'
  // 4. Spinner đang tải
  | 'loader-circle'
  // 5. Biểu tượng trạng thái lỗi / cảnh báo / thành công
  | 'circle-alert'
  | 'triangle-alert'
  | 'circle-check'
  // 6. Nút thông tin (i) mở tooltip
  | 'info'
  // 7. Nút hành động chỉ có icon (bật/tắt âm thanh)
  | 'volume-2'
  | 'volume-x'
  // 8. Huy hiệu 5 mức quẻ trên màn kết quả
  | 'muc-dai-cat'
  | 'muc-cat'
  | 'muc-binh'
  | 'muc-hung'
  | 'muc-dai-hung'
  // Tương thích ngược tạm thời cho các màn hình chưa chuyển đổi ở Bước 4-5
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
  | 'incense'
  | 'sparkles'
  | 'users'
  | 'message'
  | 'hand-bow'
  | 'send'
  | 'radio'

interface Props {
  name: WhitelistedIconName
  /** Kích thước cố định theo token: 16 | 20 | 24 */
  size?: 16 | 20 | 24 | number | string
  /** Nhãn cho icon đứng một mình (Mục 7). Nếu không truyền thì mặc định aria-hidden="true" */
  label?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  label: undefined,
  class: ''
})

const normalizedSize = computed(() => {
  const n = Number(props.size)
  if (n >= 22) return '24px'
  if (n >= 18) return '20px'
  return '16px'
})
</script>

<template>
  <svg
    :width="normalizedSize"
    :height="normalizedSize"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="props.label ? undefined : 'true'"
    :aria-label="props.label"
    :role="props.label ? 'img' : undefined"
    :class="['inline-block shrink-0 align-middle', props.name === 'loader-circle' ? 'animate-spin' : '', props.class]"
  >
    <!-- 1. Lucide: x (Close modal) -->
    <template v-if="name === 'x' || name === 'close'">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </template>

    <!-- 2. Lucide: check (Selected state) -->
    <template v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </template>

    <!-- 3. Lucide: chevrons (Dropdown / Accordion / Tab scroll) -->
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'chevron-up'">
      <path d="m18 15-6-6-6 6" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m9 18 6-6-6-6" />
    </template>
    <template v-else-if="name === 'chevron-left'">
      <path d="m15 18-6-6 6-6" />
    </template>

    <!-- 4. Lucide: loader-circle (Loading spinner) -->
    <template v-else-if="name === 'loader-circle'">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </template>

    <!-- 5. Lucide: Status alerts (circle-alert, triangle-alert, circle-check) -->
    <template v-else-if="name === 'circle-alert'">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </template>
    <template v-else-if="name === 'triangle-alert' || name === 'muc-hung'">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </template>
    <template v-else-if="name === 'circle-check'">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </template>

    <!-- 6. Lucide: info (Tooltip trigger) -->
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </template>

    <!-- 7. Lucide: volume-2 / volume-x (Standalone audio button) -->
    <template v-else-if="name === 'volume-2' || name === 'bell'">
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </template>
    <template v-else-if="name === 'volume-x' || name === 'bell-off'">
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </template>

    <!-- 8. Huy hiệu 5 mức quẻ trên màn kết quả (Lucide: sun, sparkles, cloud, triangle-alert, zap) -->
    <template v-else-if="name === 'muc-dai-cat' || name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </template>
    <template v-else-if="name === 'muc-cat' || name === 'sparkles'">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </template>
    <template v-else-if="name === 'muc-binh'">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </template>
    <template v-else-if="name === 'muc-dai-hung'">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </template>

    <!-- Fallback Lucide circle cho các tên cũ trong quá trình chuyển đổi -->
    <template v-else>
      <circle cx="12" cy="12" r="9" />
    </template>
  </svg>
</template>
