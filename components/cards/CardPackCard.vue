<script setup lang="ts">
import type { CardPack } from '~/stores/cards'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import ZenIcon from '~/components/ZenIcon.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

const props = defineProps<{
  pack: CardPack
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', packId: string): void
}>()

const economy = useEconomyStore()
const wallet = useWalletStore()

const canAfford = computed(() => {
  return economy.meritCoins >= props.pack.priceMc
})

const rarityLabel = computed(() => {
  if (props.pack.guaranteedRarity === 'rare') return 'Bảo hiểm 1 thẻ Tinh Tấn (Rare+)'
  if (props.pack.guaranteedRarity === 'epic') return 'Bảo hiểm 1 thẻ Giác Ngộ (Epic+)'
  return 'Xác suất ngẫu nhiên 4 bậc hiếm'
})

const rarityColor = computed(() => {
  if (props.pack.guaranteedRarity === 'epic') return 'text-gold'
  if (props.pack.guaranteedRarity === 'rare') return 'text-sky-400'
  return 'text-secondary'
})
</script>

<template>
  <div
    class="rounded-lg border border-hairline bg-surface-card p-4 flex flex-col justify-between gap-3.5 transition-all hover:border-gold/40 relative overflow-hidden group"
  >
    <!-- Background Gradient mờ ảo khi hover -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
    />

    <div class="relative space-y-2.5">
      <!-- Header gói thẻ: Tên & Badge -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <ZenIcon name="cards" :size="18" class="text-gold shrink-0" />
          <span class="text-xs font-bold text-white">{{ pack.name }}</span>
        </div>
        <UiBadge v-if="pack.badge" :variant="pack.discountPercent ? 'warning' : 'gold'">
          {{ pack.badge }}
        </UiBadge>
      </div>

      <!-- Mô tả & Quyền lợi -->
      <p class="text-xs text-secondary leading-relaxed m-0">
        {{ pack.description }}
      </p>

      <!-- Khung thông tin bảo hiểm tỷ lệ -->
      <div class="p-2.5 rounded bg-surface-elevated/70 border border-hairline flex items-center gap-2">
        <ZenIcon name="sparkles" :size="14" :class="rarityColor" class="shrink-0" />
        <span class="text-xs font-medium" :class="rarityColor">
          {{ rarityLabel }}
        </span>
      </div>
    </div>

    <!-- Footer: Giá MC & Nút Mở Gói -->
    <div class="relative pt-2 border-t border-hairline flex items-center justify-between gap-3">
      <div>
        <div class="text-xs text-secondary font-medium">Chi phí mở hộp</div>
        <div class="flex items-baseline gap-1.5 font-numbers">
          <span class="text-sm font-bold text-gold">{{ pack.priceMc.toLocaleString('vi-VN') }} MC</span>
          <span
            v-if="pack.originalPriceMc"
            class="text-xs text-secondary line-through"
          >
            {{ pack.originalPriceMc.toLocaleString('vi-VN') }} MC
          </span>
        </div>
      </div>

      <UiButton
        variant="primary"
        size="sm"
        :disabled="loading || (!canAfford && wallet.isConnected)"
        class="text-xs font-semibold px-4 shrink-0"
        @click="emit('open', pack.id)"
      >
        <ZenIcon v-if="!loading" name="sparkles" :size="14" class="mr-1" />
        <span>{{ loading ? 'Đang mở...' : `Mở (${pack.cardCount} thẻ)` }}</span>
      </UiButton>
    </div>
  </div>
</template>

