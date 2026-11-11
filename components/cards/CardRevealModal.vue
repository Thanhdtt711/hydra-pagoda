<script setup lang="ts">
import type { BuddhistCard } from '~/stores/cards'
import { zenAudio } from '~/lib/audio/ZenAudio'
import ZenIcon from '~/components/ZenIcon.vue'
import UiButton from '~/components/ui/UiButton.vue'
import HydraBadge from '~/components/HydraBadge.vue'
import HeritageCardItem from '~/components/cards/HeritageCardItem.vue'

const props = defineProps<{
  cards: BuddhistCard[]
  hydraProof?: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const revealedIndices = ref<Set<number>>(new Set())

function isRevealed(idx: number): boolean {
  return revealedIndices.value.has(idx)
}

function revealCard(idx: number) {
  if (revealedIndices.value.has(idx)) return
  revealedIndices.value.add(idx)
  
  const card = props.cards[idx]
  if (card?.rarity === 'legendary' || card?.rarity === 'epic') {
    zenAudio.playTempleBell()
  } else {
    zenAudio.playSingingBowl()
  }
}

function revealAll() {
  props.cards.forEach((_, idx) => revealedIndices.value.add(idx))
  const hasLegendaryOrEpic = props.cards.some(c => c.rarity === 'legendary' || c.rarity === 'epic')
  if (hasLegendaryOrEpic) {
    zenAudio.playTempleBell()
  } else {
    zenAudio.playSingingBowl()
  }
}

const allRevealed = computed(() => {
  return props.cards.length > 0 && revealedIndices.value.size >= props.cards.length
})

onMounted(() => {
  // Nếu chỉ mở 1 thẻ thì tự động lật sau 350ms
  if (props.cards.length === 1) {
    setTimeout(() => revealCard(0), 350)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      @click.self="allRevealed ? emit('close') : undefined"
    >
      <div
        class="w-full bg-surface-card border border-hairline rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto transition-all"
        :class="[
          cards.length === 1
            ? 'max-w-lg'
            : cards.length <= 5
              ? 'max-w-4xl'
              : 'max-w-5xl'
        ]"
      >
        <!-- Header Modal: Bố cục 2 tầng thoáng đãng, không bao giờ bị đè chữ hay rớt dòng vụn vặt -->
        <div class="border-b border-hairline pb-3.5 space-y-2">
          <!-- Hàng 1: Icon + Tiêu đề + Hydra Badge -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-surface-elevated border border-gold/40 flex items-center justify-center text-gold shadow-[0_0_14px_rgba(252,213,53,0.25)] shrink-0">
                <ZenIcon name="sparkles" :size="18" />
              </div>
              <h3 class="text-sm sm:text-base font-bold text-white tracking-wide truncate m-0">
                Khai Quang Hộp Mù Di Sản Cổ Tự
              </h3>
            </div>

            <div v-if="hydraProof" class="shrink-0">
              <HydraBadge :proof="hydraProof" />
            </div>
          </div>

          <!-- Hàng 2: Huy hiệu trạng thái đếm thẻ & Hướng dẫn thao tác -->
          <div class="flex items-center justify-between text-xs text-secondary gap-2 pt-0.5">
            <p class="m-0 text-xs text-secondary truncate">
              Chạm vào bảo vật để giải trừ phong ấn hoặc bấm "Lật Tất Cả"
            </p>
            <span class="px-2.5 py-0.5 rounded-full bg-surface-elevated text-gold border border-gold/30 font-numbers text-xs font-semibold shrink-0">
              Đã mở: {{ revealedIndices.size }} / {{ cards.length }} Thẻ
            </span>
          </div>
        </div>

        <!-- Vùng hiển thị thẻ bài -->
        <div class="py-2">
          <!-- MỞ 1 THẺ: Hiển thị 1 thẻ to trang trọng ở giữa màn hình -->
          <div
            v-if="cards.length === 1"
            class="max-w-[280px] sm:max-w-[300px] mx-auto py-2"
          >
            <HeritageCardItem
              :card="cards[0]"
              :is-owned="true"
              :is-flipped="isRevealed(0)"
              size="lg"
              @click="revealCard(0)"
            />
          </div>

          <!-- MỞ 5 THẺ: 5 thẻ xếp ngang hàng cân đối trên desktop/tablet -->
          <div
            v-else-if="cards.length <= 5"
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 max-w-4xl mx-auto"
          >
            <div
              v-for="(card, idx) in cards"
              :key="card.id + '_' + idx"
              class="w-full"
            >
              <HeritageCardItem
                :card="card"
                :is-owned="true"
                :is-flipped="isRevealed(idx)"
                size="md"
                @click="revealCard(idx)"
              />
            </div>
          </div>

          <!-- MỞ 10 THẺ: 2 hàng x 5 cột rộng rãi (mỗi thẻ rộng ~160px) -->
          <div
            v-else
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-3.5 max-w-5xl mx-auto"
          >
            <div
              v-for="(card, idx) in cards"
              :key="card.id + '_' + idx"
              class="w-full"
            >
              <HeritageCardItem
                :card="card"
                :is-owned="true"
                :is-flipped="isRevealed(idx)"
                size="md"
                @click="revealCard(idx)"
              />
            </div>
          </div>
        </div>

        <!-- Footer Hành Động -->
        <div class="pt-3 border-t border-hairline flex items-center justify-between gap-3">
          <UiButton
            v-if="!allRevealed"
            variant="secondary"
            size="sm"
            class="text-xs font-semibold px-4"
            @click="revealAll"
          >
            <ZenIcon name="sparkles" :size="14" class="mr-1.5" />
            <span>Lật Tất Cả ({{ cards.length - revealedIndices.size }})</span>
          </UiButton>
          <div v-else class="text-xs text-trading-up font-medium flex items-center gap-1.5">
            <ZenIcon name="circle-check" :size="14" />
            <span>Đã giải trừ phong ấn toàn bộ bảo vật di sản!</span>
          </div>

          <UiButton
            variant="primary"
            size="sm"
            class="text-xs font-semibold px-6 ml-auto"
            @click="emit('close')"
          >
            <ZenIcon name="sparkles" :size="14" class="mr-1.5" />
            <span>Nhận & Cất Vào Kho</span>
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
