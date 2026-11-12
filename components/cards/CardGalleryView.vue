<script setup lang="ts">
import { useCardsStore, type BuddhistCard, type CountryFilter, type RarityFilter, type OwnershipFilter } from '~/stores/cards'
import ZenIcon from '~/components/ZenIcon.vue'
import HeritageCardItem from '~/components/cards/HeritageCardItem.vue'

const cardsStore = useCardsStore()

const emit = defineEmits<{
  (e: 'select', card: BuddhistCard): void
}>()

const countries: Array<{ id: CountryFilter; label: string }> = [
  { id: 'all', label: 'Tất Cả' },
  { id: 'VN', label: 'Việt Nam' },
  { id: 'JP', label: 'Nhật Bản' },
  { id: 'TH', label: 'Thái Lan' },
  { id: 'KR', label: 'Hàn Quốc' }
]

const rarities: Array<{ id: RarityFilter; label: string }> = [
  { id: 'all', label: 'Tất Cả' },
  { id: 'legendary', label: 'Chân Như' },
  { id: 'epic', label: 'Giác Ngộ' },
  { id: 'rare', label: 'Tinh Tấn' },
  { id: 'common', label: 'Thường' }
]

const ownerships: Array<{ id: OwnershipFilter; label: string }> = [
  { id: 'all', label: 'Tất Cả' },
  { id: 'owned', label: 'Đã Có' },
  { id: 'unowned', label: 'Chưa Mở' }
]
</script>

<template>
  <div class="space-y-4 w-full overflow-hidden">
    <!-- KHUNG TIẾN ĐỘ SƯU TẬP TỔNG THỂ -->
    <div class="p-3.5 rounded-xl border border-hairline bg-surface-card space-y-2.5 shadow-sm">
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-white flex items-center gap-1.5">
          <ZenIcon name="sparkles" :size="14" class="text-gold" />
          <span>Tiến Độ Khai Quang Di Sản</span>
        </span>
        <span class="font-numbers text-gold font-bold">
          {{ cardsStore.collectionStats.owned }} / {{ cardsStore.collectionStats.total }} Thẻ ({{ cardsStore.collectionStats.percent }}%)
        </span>
      </div>

      <!-- Thanh tiến độ -->
      <div class="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          class="h-full bg-gold transition-all duration-500 rounded-full"
          :style="{ width: `${cardsStore.collectionStats.percent}%` }"
        />
      </div>

      <!-- Thống kê 4 quốc gia -->
      <div class="grid grid-cols-4 gap-1.5 pt-1 text-center font-numbers text-xs">
        <div class="p-1.5 rounded-lg bg-surface-elevated/70 border border-hairline/80">
          <div class="text-secondary font-medium">Việt Nam</div>
          <div class="text-white font-bold mt-0.5">
            {{ cardsStore.collectionStats.byCountry.VN?.owned }}/{{ cardsStore.collectionStats.byCountry.VN?.total }}
          </div>
        </div>
        <div class="p-1.5 rounded-lg bg-surface-elevated/70 border border-hairline/80">
          <div class="text-secondary font-medium">Nhật Bản</div>
          <div class="text-white font-bold mt-0.5">
            {{ cardsStore.collectionStats.byCountry.JP?.owned }}/{{ cardsStore.collectionStats.byCountry.JP?.total }}
          </div>
        </div>
        <div class="p-1.5 rounded-lg bg-surface-elevated/70 border border-hairline/80">
          <div class="text-secondary font-medium">Thái Lan</div>
          <div class="text-white font-bold mt-0.5">
            {{ cardsStore.collectionStats.byCountry.TH?.owned }}/{{ cardsStore.collectionStats.byCountry.TH?.total }}
          </div>
        </div>
        <div class="p-1.5 rounded-lg bg-surface-elevated/70 border border-hairline/80">
          <div class="text-secondary font-medium">Hàn Quốc</div>
          <div class="text-white font-bold mt-0.5">
            {{ cardsStore.collectionStats.byCountry.KR?.owned }}/{{ cardsStore.collectionStats.byCountry.KR?.total }}
          </div>
        </div>
      </div>
    </div>

    <!-- KHUNG BỘ LỌC ĐA CHIỀU (Không tràn lề, chuẩn Binance Dark) -->
    <div class="space-y-2.5 p-3 rounded-xl border border-hairline bg-surface-card w-full">
      <!-- 1. Hàng Lọc Quốc Gia -->
      <div class="space-y-1">
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span class="text-secondary text-xs shrink-0 font-medium w-14">Quốc gia:</span>
          <div class="flex items-center gap-1 shrink-0">
            <button
              v-for="c in countries"
              :key="c.id"
              type="button"
              class="px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors whitespace-nowrap"
              :class="cardsStore.filterCountry === c.id ? 'border-gold bg-gold/15 text-gold font-bold' : 'border-hairline bg-surface-elevated text-secondary hover:text-white'"
              @click="cardsStore.setFilterCountry(c.id)"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 2. Hàng Lọc Phẩm Cấp (Được tách riêng dòng độc lập, cuộn ngang) -->
      <div class="space-y-1 pt-1.5 border-t border-hairline/60">
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span class="text-secondary text-xs shrink-0 font-medium w-14">Phẩm cấp:</span>
          <div class="flex items-center gap-1 shrink-0">
            <button
              v-for="r in rarities"
              :key="r.id"
              type="button"
              class="px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors whitespace-nowrap"
              :class="cardsStore.filterRarity === r.id ? 'border-gold bg-gold/15 text-gold font-bold' : 'border-hairline bg-surface-elevated text-secondary hover:text-white'"
              @click="cardsStore.setFilterRarity(r.id)"
            >
              {{ r.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 3. Hàng Trạng Thái Sở Hữu (3 tab cân đối) -->
      <div class="pt-1.5 border-t border-hairline/60">
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="o in ownerships"
            :key="o.id"
            type="button"
            class="py-1 text-center rounded-lg border text-xs cursor-pointer transition-colors font-medium"
            :class="cardsStore.filterOwnership === o.id ? 'border-gold bg-gold/15 text-gold font-bold' : 'border-hairline bg-surface-elevated text-secondary hover:text-white'"
            @click="cardsStore.setFilterOwnership(o.id)"
          >
            {{ o.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- LƯỚI THẺ BÀI DI SẢN (2 CỘT CÂN ĐỐI TRONG DRAWER 440PX) -->
    <div
      v-if="cardsStore.filteredCards.length > 0"
      class="grid grid-cols-2 gap-3"
    >
      <div
        v-for="card in cardsStore.filteredCards"
        :key="card.id"
      >
        <HeritageCardItem
          :card="card"
          :is-owned="cardsStore.isUnlocked(card.id)"
          :copy-count="cardsStore.getCardCount(card.id)"
          :is-flipped="true"
          size="md"
          @click="emit('select', card)"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="py-12 text-center rounded-xl border border-dashed border-hairline p-6 bg-surface-card space-y-2"
    >
      <div class="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-secondary mx-auto">
        <ZenIcon name="sparkles" :size="20" />
      </div>
      <div class="text-xs font-semibold text-white">Không tìm thấy thẻ bài phù hợp</div>
      <div class="text-xs text-secondary">Hãy thử điều chỉnh bộ lọc Quốc gia hoặc Phẩm cấp</div>
    </div>
  </div>
</template>
