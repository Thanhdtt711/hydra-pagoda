<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiSelectableCard from '~/components/ui/UiSelectableCard.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { tr } from '~/lib/ui/copy'
import { useKoiGardenStore, type GardenSeedId } from '~/stores/koiGarden'

const emit = defineEmits<{
  (e: 'openShop'): void
  (e: 'guideToPond'): void
  (e: 'guideToGarden'): void
}>()

const store = useKoiGardenStore()

const activeSection = ref<'koi' | 'garden'>('koi')
const selectedSeed = ref<GardenSeedId>('seed_lotus')
const editingKoiIndex = ref<number | null>(null)
const koiNameDraft = ref<string>('')

const SEED_OPTIONS = computed<Array<{ id: GardenSeedId; shortVi: string; shortEn: string; count: number }>>(() => [
  { id: 'seed_lotus', shortVi: 'Sen Hồng', shortEn: 'Lotus', count: store.gardenStatus.seedCounts.seed_lotus ?? 0 },
  { id: 'seed_bamboo', shortVi: 'Trúc', shortEn: 'Bamboo', count: store.gardenStatus.seedCounts.seed_bamboo ?? 0 },
  { id: 'seed_bodhi', shortVi: 'Bồ Đề', shortEn: 'Bodhi', count: store.gardenStatus.seedCounts.seed_bodhi ?? 0 }
])

function startRename(idx: number, currentName: string) {
  editingKoiIndex.value = idx
  koiNameDraft.value = currentName
}

async function submitRename(idx: number) {
  const clean = koiNameDraft.value.trim()
  if (!clean) return
  const res = await store.rename(idx, clean)
  if (res?.ok) {
    editingKoiIndex.value = null
    koiNameDraft.value = ''
  }
}

function stageLabel(stage: number): string {
  switch (stage) {
    case 1:
      return tr('Hạt mầm', 'Sprout')
    case 2:
      return tr('Cây non', 'Sapling')
    case 3:
      return tr('Trưởng thành', 'Growing')
    case 4:
      return tr('Viên mãn', 'Blooming')
    default:
      return tr('Trống', 'Empty')
  }
}

function shortSeedName(seedId: GardenSeedId | null): string {
  if (seedId === 'seed_bamboo') return tr('Trúc Quân Tử', 'Noble Bamboo')
  if (seedId === 'seed_bodhi') return tr('Bồ Đề Tâm', 'Sacred Bodhi')
  return tr('Sen Hồng', 'Pink Lotus')
}

onMounted(() => {
  void store.refreshAll()
})
</script>

<template>
  <div class="space-y-3 text-left">
    <!-- Thanh chuyển đổi nhanh: Đàn Cá Koi <-> Vườn Thiền -->
    <div class="grid grid-cols-2 gap-1.5 p-1 rounded-[2px] bg-surface-elevated border border-hairline text-xs font-semibold">
      <button
        type="button"
        class="py-2 px-2 rounded-[2px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        :class="activeSection === 'koi' ? 'bg-gold text-canvas-dark font-bold' : 'text-secondary hover:text-white'"
        @click="activeSection = 'koi'"
      >
        <ZenIcon name="lotus" :size="14" />
        <span>{{ tr('Đàn Cá Koi', 'Sanctuary Koi') }}</span>
      </button>
      <button
        type="button"
        class="py-2 px-2 rounded-[2px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        :class="activeSection === 'garden' ? 'bg-gold text-canvas-dark font-bold' : 'text-secondary hover:text-white'"
        @click="activeSection = 'garden'"
      >
        <ZenIcon name="sparkles" :size="14" />
        <span>{{ tr('Vườn Thiền', 'Zen Garden') }}</span>
      </button>
    </div>

    <!-- ==================== MỤC 13: ĐÀN CÁ KOI ==================== -->
    <div v-if="activeSection === 'koi'" class="rounded-[2px] border border-hairline bg-surface-card p-4 space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h4 class="text-sm font-bold text-white">{{ tr('Đàn Cá Koi', 'Sanctuary Koi') }}</h4>
          <p class="text-xs text-secondary leading-relaxed mt-0.5">
            {{ tr('Cho ăn mỗi ngày để 5 cá Koi lớn dần trên hồ.', 'Feed daily to help the 5 Koi grow in the pond.') }}
          </p>
        </div>
        <UiBadge :variant="store.koiStatus.freeFeedAvailable ? 'gold' : 'neutral'" class="shrink-0">
          {{ store.koiStatus.freeFeedAvailable ? tr('1 lượt miễn phí', '1 free feed') : `${store.koiStatus.koiFoodQty} ${tr('túi cám', 'food')}` }}
        </UiBadge>
      </div>

      <div class="flex items-center gap-2">
        <UiButton variant="secondary" size="sm" @click="emit('guideToPond')">
          {{ tr('Tới Hồ Sen', 'Go to Pond') }}
        </UiButton>
        <UiButton variant="ghost" size="sm" @click="emit('openShop')">
          {{ tr('Thỉnh cám cá', 'Buy Food') }}
        </UiButton>
      </div>

      <div class="space-y-2">
        <div
          v-for="k in store.koiStatus.koiList"
          :key="k.koiIndex"
          class="rounded-[2px] border border-hairline bg-surface-elevated p-3 space-y-2"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-white truncate">{{ k.displayName }}</span>
                <UiBadge variant="gold" class="shrink-0">Lv.{{ k.level }}</UiBadge>
              </div>
              <div class="text-xs text-secondary mt-0.5 truncate">
                {{ k.colorLabel }} · <span class="font-numbers">{{ k.fedToday }}/{{ k.maxDailyFeeds }}</span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <UiButton
                v-if="!k.renameUsed && editingKoiIndex !== k.koiIndex"
                variant="secondary"
                size="sm"
                @click="startRename(k.koiIndex, k.displayName)"
              >
                {{ tr('Đặt tên', 'Rename') }}
              </UiButton>
              <UiButton
                variant="secondary-light"
                size="sm"
                :loading="store.busyKoi"
                :disabled="k.fedToday >= k.maxDailyFeeds"
                @click="store.feed(k.koiIndex)"
              >
                {{ k.fedToday >= k.maxDailyFeeds ? tr('Đã no', 'Full') : tr('Cho ăn', 'Feed') }}
              </UiButton>
            </div>
          </div>

          <div v-if="editingKoiIndex === k.koiIndex" class="flex items-center gap-1.5 pt-1 border-t border-hairline">
            <input
              v-model="koiNameDraft"
              type="text"
              maxlength="24"
              :placeholder="tr('Nhập tên cá Koi...', 'Enter Koi name...')"
              class="flex-1 min-w-0 bg-[#100e0c] border border-hairline rounded-[2px] px-2.5 py-1.5 text-xs text-white"
            />
            <UiButton variant="secondary-light" size="sm" @click="submitRename(k.koiIndex)">
              {{ tr('Lưu tên', 'Save') }}
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="editingKoiIndex = null">
              {{ tr('Hủy', 'Cancel') }}
            </UiButton>
          </div>
        </div>
      </div>

      <p v-if="store.koiNotice" class="text-xs font-semibold text-primary">{{ store.koiNotice }}</p>
    </div>

    <!-- ==================== MỤC 14: VƯỜN THIỀN (6 Ô ĐẤT) ==================== -->
    <div v-else class="rounded-[2px] border border-hairline bg-surface-card p-4 space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h4 class="text-sm font-bold text-white">{{ tr('Vườn Thiền', 'Zen Garden') }}</h4>
          <p class="text-xs text-secondary leading-relaxed mt-0.5">
            {{ tr('Chọn giống cây rồi bấm Trồng cây ở ô trống.', 'Pick a seed below, then plant on an empty plot.') }}
          </p>
        </div>
        <UiBadge v-if="store.gardenStatus.streakBoostActive" variant="gold" class="shrink-0">
          {{ tr('Chuỗi x2', '2x Boost') }}
        </UiBadge>
      </div>

      <div class="flex items-center gap-2">
        <UiButton variant="secondary" size="sm" @click="emit('guideToGarden')">
          {{ tr('Tới Vườn Thiền', 'Go to Garden') }}
        </UiButton>
        <UiButton variant="ghost" size="sm" @click="emit('openShop')">
          {{ tr('Thỉnh hạt giống', 'Buy Seeds') }}
        </UiButton>
      </div>

      <!-- Chọn giống cây 1 chạm (không dùng <select> bị cắt chữ) -->
      <div class="space-y-1.5">
        <div class="text-xs font-semibold text-secondary">{{ tr('Giống cây đang chọn:', 'Selected seed:') }}</div>
        <div class="grid grid-cols-3 gap-2">
          <UiSelectableCard
            v-for="seed in SEED_OPTIONS"
            :key="seed.id"
            :selected="selectedSeed === seed.id"
            @click="selectedSeed = seed.id"
          >
            <div class="text-xs font-bold text-white truncate">{{ tr(seed.shortVi, seed.shortEn) }}</div>
            <div class="text-xs font-numbers text-primary mt-0.5">x{{ seed.count }}</div>
          </UiSelectableCard>
        </div>
      </div>

      <!-- Lưới 6 ô đất thoáng, không cắt chữ -->
      <div class="grid grid-cols-2 gap-2.5">
        <div
          v-for="plot in store.gardenStatus.plots"
          :key="plot.plotIndex"
          class="rounded-[2px] border border-hairline bg-surface-elevated p-3 flex flex-col justify-between gap-2.5 min-h-[108px]"
        >
          <div class="flex items-center justify-between gap-1.5">
            <span class="text-xs font-bold text-white shrink-0">
              {{ tr('Ô', 'Plot') }} <span class="font-numbers">#{{ plot.plotIndex + 1 }}</span>
            </span>
            <UiBadge :variant="plot.canHarvest ? 'gold' : plot.seedId ? 'success' : 'neutral'" class="shrink-0">
              {{ stageLabel(plot.stage) }}
            </UiBadge>
          </div>

          <div v-if="!plot.seedId" class="text-xs text-secondary truncate">
            {{ tr(SEED_OPTIONS.find(s => s.id === selectedSeed)?.shortVi || 'Sen Hồng', SEED_OPTIONS.find(s => s.id === selectedSeed)?.shortEn || 'Lotus') }}
          </div>
          <div v-else class="space-y-1">
            <div class="text-xs font-semibold text-white truncate">{{ shortSeedName(plot.seedId) }}</div>
            <div class="w-full h-1.5 bg-[#100e0c] rounded-[2px] overflow-hidden border border-hairline">
              <div class="h-full bg-primary transition-all duration-300" :style="{ width: `${(plot.stage / 4) * 100}%` }" />
            </div>
            <div class="text-xs font-numbers text-secondary">{{ plot.stage }}/4</div>
          </div>

          <UiButton
            v-if="!plot.seedId"
            variant="secondary-light"
            size="sm"
            block
            :loading="store.busyGarden"
            @click="store.plant(plot.plotIndex, selectedSeed)"
          >
            {{ tr('Trồng cây', 'Plant') }}
          </UiButton>
          <UiButton
            v-else-if="plot.canHarvest"
            variant="secondary-light"
            size="sm"
            block
            :loading="store.busyGarden"
            @click="store.harvest(plot.plotIndex)"
          >
            {{ tr('Thu hoạch', 'Harvest') }}
          </UiButton>
          <UiButton
            v-else
            variant="secondary"
            size="sm"
            block
            :loading="store.busyGarden"
            :disabled="!plot.canWaterToday"
            @click="store.water(plot.plotIndex)"
          >
            {{ plot.canWaterToday ? tr('Tưới nước', 'Water') : tr('Đã tưới', 'Watered') }}
          </UiButton>
        </div>
      </div>

      <p v-if="store.gardenNotice" class="text-xs font-semibold text-primary">{{ store.gardenNotice }}</p>
    </div>
  </div>
</template>
