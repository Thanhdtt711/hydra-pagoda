<script setup lang="ts">
import type { PilgrimPresence } from '~/lib/network/MultiplayerClient'
import UiModal from '~/components/ui/UiModal.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import ZenIcon from '~/components/ZenIcon.vue'

interface Props {
  modelValue: boolean
  pilgrims: PilgrimPresence[]
  localName: string
  localTitle: string
  localCountry: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'bowTo', id: string): void
}>()

const COUNTRY_NAMES: Record<string, { name: string; code: string }> = {
  vietnam: { name: 'Việt Nam', code: 'VN' },
  japan: { name: 'Nhật Bản', code: 'JP' },
  thailand: { name: 'Thái Lan', code: 'TH' },
  korea: { name: 'Hàn Quốc', code: 'KR' },
  taiwan: { name: 'Đài Loan', code: 'TW' },
  singapore: { name: 'Singapore', code: 'SG' },
  india: { name: 'Ấn Độ', code: 'IN' },
  tibet: { name: 'Tây Tạng', code: 'TB' },
  western: { name: 'Làng Mai', code: 'LM' }
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'meditating': return 'Tọa thiền kiết già'
    case 'bowing': return 'Chắp tay cúi lạy'
    case 'walking': return 'Kinh hành an lạc'
    default: return 'Đứng trang nghiêm'
  }
}
</script>

<template>
  <UiModal
    v-if="modelValue"
    title="Đồng Tu Đang Trực Tuyến"
    subtitle="Đại chúng đồng tu hòa hợp · Đồng bộ mạng đa người chơi"
    @close="emit('update:modelValue', false)"
  >
    <!-- Live Count Stats Banner -->
    <div class="px-3 py-2 bg-surface-elevated border border-hairline rounded-[6px] flex items-center justify-between text-xs font-numbers">
      <div class="flex items-center gap-2 text-trading-up">
        <span class="w-2 h-2 rounded-full bg-trading-up"></span>
        <span class="font-bold">{{ pilgrims.length + 1 }} ĐỒNG TU ĐANG CÙNG CHIÊM BÁI</span>
      </div>
      <span class="text-secondary font-sans text-xs">20Hz</span>
    </div>

    <!-- Pilgrims List -->
    <div class="space-y-2 font-sans">
      <!-- Local User Entry (You) -->
      <div class="p-3 rounded-[6px] bg-surface-elevated border border-primary/40 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-[4px] bg-surface-card border border-hairline flex items-center justify-center font-numbers text-xs font-bold text-gold">
            {{ COUNTRY_NAMES[localCountry]?.code || 'VN' }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-primary">{{ localName }}</span>
              <span class="font-numbers text-xs px-1.5 py-0.5 rounded-[2px] bg-primary text-ink font-bold">BẠN</span>
            </div>
            <div class="text-xs text-gold font-sans mt-0.5">{{ localTitle }}</div>
          </div>
        </div>
        <UiBadge variant="success" dot>Trực Tuyến</UiBadge>
      </div>

      <!-- Remote Pilgrims -->
      <div 
        v-for="p in pilgrims" 
        :key="p.id"
        class="p-3 rounded-[6px] bg-surface-elevated border border-hairline flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-[4px] bg-surface-card border border-hairline flex items-center justify-center font-numbers text-xs font-bold text-secondary shrink-0">
            {{ COUNTRY_NAMES[p.country]?.code || 'VN' }}
          </div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-primary truncate">{{ p.name }}</div>
            <div class="text-xs text-secondary truncate mt-0.5">{{ p.title }} · {{ COUNTRY_NAMES[p.country]?.name || p.country }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs text-secondary">
            {{ getActionLabel(p.action) }}
          </span>
          <UiButton 
            variant="secondary"
            size="sm"
            @click="emit('bowTo', p.id)"
          >
            <ZenIcon name="hand-bow" :size="12" class="mr-1" />
            <span>Chào</span>
          </UiButton>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between text-xs text-secondary">
        <span>Đồng tu một cõi thanh tịnh</span>
        <UiButton 
          variant="secondary"
          size="sm"
          @click="emit('update:modelValue', false)"
        >
          Đóng
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>
