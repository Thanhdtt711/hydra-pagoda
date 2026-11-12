<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useHauDongStore } from '~/stores/hauDong'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import UiButton from '~/components/ui/UiButton.vue'
import { t } from '~/lib/ui/copy'
import UiBadge from '~/components/ui/UiBadge.vue'
import ZenIcon from '~/components/ZenIcon.vue'

const props = defineProps<{
  isInsideHauDong?: boolean
}>()

const emit = defineEmits<{
  (e: 'guideToHauDong'): void
  (e: 'triggerBow'): void
}>()

const hauDong = useHauDongStore()
const economy = useEconomyStore()
const wallet = useWalletStore()

const activeSubTab = ref<'live' | 'sponsor' | 'crowdfund'>('live')
const selectedCustomDeity = ref<string>('default')
const sponsorAmountMc = ref<number>(2500)
const crowdfundAmountMc = ref<number>(100)
const prayerInput = ref<string>('Cầu Quốc Thái Dân An · Gia Đạo Cát Tường · Tâm Khai Trí Sáng · Tài Lộc Hanh Thông')
const confirmModal = ref<null | { mode: 'single_open' | 'crowdfund'; amountMc: number }>(null)

const session = computed(() => hauDong.activeSession)

const secondsUntilBlessing = computed(() => {
  if (!session.value) return 0
  if (session.value.stepId === 5) return 0
  if (session.value.secInGia < 70) return 70 - session.value.secInGia
  return 96 - session.value.secInGia + 70
})

const crowdfundPercent = computed(() => {
  const target = hauDong.crowdfund.targetMc || 2500
  return Math.min(100, Math.round((hauDong.crowdfund.currentMc / target) * 100))
})

function formatMinSec(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

function handleBowClick() {
  hauDong.isBowing = true
  emit('triggerBow')
  void hauDong.sendHeartbeat(Boolean(props.isInsideHauDong), 1)
}

async function handleClaimClick() {
  if (!wallet.isConnected) {
    hauDong.error = 'Vui lòng kết nối ví Cardano (góc phải trên) để thỉnh lộc MC vào tài khoản!'
    return
  }
  try {
    await hauDong.claimBlessing()
  } catch {
    // Đã hiển thị trong hauDong.error
  }
}

// Đồng hồ đếm ngược đến Khai Đàn 11h00 Trưa (Giờ Ngọ)
const nowTick = ref(Date.now())
let clockTicker: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  clockTicker = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (clockTicker) clearInterval(clockTicker)
})

const countdownTo11Am = computed(() => {
  const target = hauDong.scheduleInfo?.nextScheduledAt || 0
  const totalSec = Math.max(0, Math.ceil((target - nowTick.value) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return {
    totalSec,
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    isToday: hauDong.scheduleInfo?.isToday ?? true
  }
})

function askOpenConfirm(mode: 'single_open' | 'crowdfund') {
  hauDong.error = null
  hauDong.notice = null
  const amountMc = mode === 'single_open' ? sponsorAmountMc.value : crowdfundAmountMc.value

  if (!wallet.isConnected) {
    hauDong.error = 'Vui lòng kết nối ví Cardano trước khi công đức Mở Đàn!'
    return
  }
  if (economy.meritCoins < amountMc) {
    hauDong.error = `Số dư không đủ (${economy.meritCoins.toLocaleString()} / ${amountMc.toLocaleString()} MC). Hãy bấm "+ Nạp" trên thanh công cụ!`
    return
  }
  confirmModal.value = { mode, amountMc }
}

async function executeConfirmedSponsor() {
  if (!confirmModal.value) return
  const { mode, amountMc } = confirmModal.value
  confirmModal.value = null
  try {
    await hauDong.sponsorSession({
      mode,
      amountMc,
      customDeityId: selectedCustomDeity.value === 'default' ? null : selectedCustomDeity.value,
      prayerText: prayerInput.value
    })
    activeSubTab.value = 'live'
  } catch {
    // Đã lưu hauDong.error
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Banner Định Vị Không Gian Nhà Hầu Đồng (Hướng Đông Đại Hùng Bảo Điện) -->
    <div
      class="p-3.5 rounded-lg border flex items-center justify-between gap-3"
      :class="
        isInsideHauDong
          ? 'bg-surface-elevated border-[var(--primary,#c9a24b)]'
          : 'bg-surface-card border-hairline'
      "
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :class="isInsideHauDong ? 'bg-[var(--trading-up,#0ecb81)]' : 'bg-[var(--primary,#c9a24b)]'"
          />
          <span class="text-xs font-bold text-white">
            {{ isInsideHauDong ? 'Đang hiện diện tại Chiếu Hầu Tứ Phủ' : 'Vị trí: Hướng Đông Đại Hùng Bảo Điện' }}
          </span>
        </div>
        <p class="text-xs text-secondary mt-1 leading-relaxed">
          {{ isInsideHauDong ? t('desc.hdInside') : t('desc.hdOutside') }}
        </p>
      </div>
      <UiButton
        v-if="!isInsideHauDong"
        variant="primary"
        size="sm"
        class="shrink-0"
        @click="$emit('guideToHauDong')"
      >
        {{ t('btn.walkToHauDong') }}
      </UiButton>
      <UiButton
        v-else
        variant="secondary"
        size="sm"
        class="shrink-0"
        @click="handleBowClick"
      >
        {{ t('btn.bow') }}
      </UiButton>
    </div>

    <!-- Thanh chuyển Tab con -->
    <div class="grid grid-cols-3 gap-1.5 p-1 rounded-md bg-surface-card border border-hairline">
      <button
        type="button"
        class="py-2 px-2.5 rounded text-xs font-semibold transition cursor-pointer"
        :class="
          activeSubTab === 'live'
            ? 'bg-[var(--primary,#c9a24b)] text-[#1a1714] font-bold'
            : 'text-secondary hover:text-white hover:bg-surface-elevated'
        "
        @click="activeSubTab = 'live'"
      >
        {{ t('btn.hdLive') }}
      </button>
      <button
        type="button"
        class="py-2 px-2.5 rounded text-xs font-semibold transition cursor-pointer"
        :class="
          activeSubTab === 'sponsor'
            ? 'bg-[var(--primary,#c9a24b)] text-[#1a1714] font-bold'
            : 'text-secondary hover:text-white hover:bg-surface-elevated'
        "
        @click="activeSubTab = 'sponsor'"
      >
        {{ t('btn.hdOpen') }}
      </button>
      <button
        type="button"
        class="py-2 px-2.5 rounded text-xs font-semibold transition cursor-pointer"
        :class="
          activeSubTab === 'crowdfund'
            ? 'bg-[var(--primary,#c9a24b)] text-[#1a1714] font-bold'
            : 'text-secondary hover:text-white hover:bg-surface-elevated'
        "
        @click="activeSubTab = 'crowdfund'"
      >
        Góp Bách Gia
      </button>
    </div>

    <!-- Thông báo thành công / lỗi -->
    <div
      v-if="hauDong.notice"
      class="p-3 rounded-md bg-surface-elevated border border-[var(--trading-up,#0ecb81)] flex items-start gap-2.5"
    >
      <ZenIcon name="circle-check" :size="18" class="text-up shrink-0 mt-0.5" />
      <div class="space-y-1.5 flex-1">
        <div class="text-xs text-white leading-relaxed">{{ hauDong.notice }}</div>
        <HydraBadge v-if="hauDong.lastClaimHydra" :proof="hauDong.lastClaimHydra" compact />
      </div>
    </div>
    <div
      v-if="hauDong.error"
      class="p-3 rounded-md bg-surface-elevated border border-[var(--trading-down,#f6465d)] flex items-start gap-2.5"
    >
      <ZenIcon name="circle-alert" :size="18" class="text-danger shrink-0 mt-0.5" />
      <div class="text-xs text-white leading-relaxed">{{ hauDong.error }}</div>
    </div>

    <!-- Hộp xác nhận tiêu MC -->
    <div
      v-if="confirmModal"
      class="p-4 rounded-lg bg-surface-elevated border border-[var(--primary,#c9a24b)] space-y-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold text-white">Xác nhận Công Đức Mở Đàn</span>
        <UiBadge variant="warning">
          <span class="font-numbers">{{ confirmModal.amountMc.toLocaleString() }} MC</span>
        </UiBadge>
      </div>
      <p class="text-xs text-secondary leading-relaxed">
        {{ confirmModal.mode === 'single_open' ? t('desc.hdConfirmSingle') : t('desc.hdConfirmPool') }}
      </p>
      <div class="flex items-center justify-end gap-2">
        <UiButton variant="secondary" size="sm" @click="confirmModal = null">Hủy</UiButton>
        <UiButton variant="primary" size="sm" :disabled="hauDong.submitting" @click="executeConfirmedSponsor">
          {{ hauDong.submitting ? t('btn.processing') : t('btn.confirm') }}
        </UiButton>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 1: ĐÀN LỄ ĐANG MỞ (TIẾN TRÌNH 5 GIÁ X 96 GIÂY = 8 PHÚT)         -->
    <!-- =================================================================== -->
    <div v-if="activeSubTab === 'live'" class="space-y-4">
      <template v-if="session">
        <!-- Thẻ Giá Đồng Hiện Tại -->
        <div class="p-4 rounded-lg bg-surface-card border border-hairline space-y-3.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <UiBadge variant="warning">
                  <span class="font-numbers">GIÁ {{ session.giaIndex }} / 5</span>
                </UiBadge>
                <span class="text-xs text-secondary font-medium">{{ session.palace }}</span>
              </div>
              <h3 class="text-base font-bold text-white mt-1.5">{{ session.deityName }}</h3>
              <p class="text-xs text-primary font-semibold mt-0.5">{{ session.blessingTitle }}</p>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs text-secondary">Thời gian còn lại</div>
              <div class="text-base font-bold text-white font-numbers mt-0.5">
                {{ formatMinSec(session.remainingSessionSec) }}
              </div>
            </div>
          </div>

          <p class="text-xs text-secondary leading-relaxed border-t border-hairline pt-2.5">
            {{ session.loreSummary }}
          </p>

          <!-- Tiến trình Bước Nghi Lễ (1..6) -->
          <div class="p-3 rounded-md bg-surface-elevated border border-hairline space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-white">
                Bước <span class="font-numbers">{{ session.stepId }}/6</span>: {{ session.stepName }}
              </span>
              <span class="font-numbers text-primary font-semibold">{{ session.stepRemainingSec }}s</span>
            </div>
            <div class="w-full h-2 rounded-full bg-[#100e0c] overflow-hidden">
              <div
                class="h-full bg-[var(--primary,#c9a24b)] transition-all duration-300"
                :style="{ width: `${Math.round(session.stepProgress * 100)}%` }"
              />
            </div>
            <div class="flex items-center justify-between text-xs text-secondary pt-0.5">
              <span>Sắc phục: <strong class="text-white">{{ session.colorName }}</strong></span>
              <span>
                Quỹ lộc đàn lễ:
                <strong class="text-up font-numbers">{{ session.remainingPoolMc.toLocaleString() }} MC</strong>
              </span>
            </div>
          </div>

          <!-- Thông tin Thanh Đồng Mở Đàn & Lời Khấn -->
          <div class="p-3 rounded-md bg-[#100e0c] border border-hairline space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="text-secondary">Chủ lễ / Mở đàn:</span>
              <span class="font-bold text-primary">{{ session.sponsorName }}</span>
            </div>
            <div class="text-xs text-secondary italic leading-relaxed">
              "{{ session.prayerText }}"
            </div>
          </div>

          <!-- Cụm Nút Tương Tác Thỉnh Lộc & Chắp Tay -->
          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <UiButton
              variant="secondary"
              class="w-full justify-center"
              @click="handleBowClick"
            >
              <ZenIcon name="hand-bow" :size="16" />
              <span>{{ hauDong.isBowing ? 'Đã Khánh Hỷ (+5 MC)' : 'Chắp Tay Khánh Hỷ' }}</span>
            </UiButton>

            <UiButton
              variant="primary"
              class="w-full justify-center"
              :disabled="
                hauDong.submitting ||
                Boolean(hauDong.myAttendance?.hasClaimedThisGia) ||
                (session.stepId !== 5 && session.stepId !== 6)
              "
              @click="handleClaimClick"
            >
              <template v-if="hauDong.myAttendance?.hasClaimedThisGia">
                <span>Đã Thỉnh Lộc (+{{ hauDong.myAttendance.claimedMc }} MC)</span>
              </template>
              <template v-else-if="session.stepId === 5 || session.stepId === 6">
                <span>Thỉnh Lộc Ngay (+MC)</span>
              </template>
              <template v-else>
                <span>Ban Lộc sau <span class="font-numbers">{{ secondsUntilBlessing }}s</span></span>
              </template>
            </UiButton>

            <!-- Chứng thực Hydra L2 khi đã thỉnh lộc -->
            <div
              v-if="hauDong.lastClaimHydra && hauDong.myAttendance?.hasClaimedThisGia"
              class="p-2.5 rounded-md bg-surface-elevated/70 border border-hairline flex items-center justify-between text-xs"
            >
              <span class="text-secondary">Chứng thực L2:</span>
              <HydraBadge :proof="hauDong.lastClaimHydra" compact />
            </div>
          </div>
        </div>

        <!-- Danh sách 5 Giá Đồng trong vấn hầu hiện tại -->
        <div class="p-3.5 rounded-lg bg-surface-card border border-hairline space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-secondary">
              Trình Tự 5 Giá Đồng (8 Phút / Buổi)
            </span>
            <span class="text-xs text-secondary font-numbers">96 giây / Giá</span>
          </div>

          <div class="space-y-1.5">
            <div
              v-for="d in session.deitiesList"
              :key="d.id"
              class="px-3 py-2 rounded-md border flex items-center justify-between gap-2 text-xs"
              :class="
                d.giaIndex === session.giaIndex
                  ? 'bg-surface-elevated border-[var(--primary,#c9a24b)] text-white'
                  : (d.giaIndex || 0) < session.giaIndex
                    ? 'bg-[#100e0c] border-hairline text-secondary opacity-75'
                    : 'bg-[#100e0c] border-hairline text-secondary'
              "
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                  :style="{ backgroundColor: d.colorHex }"
                />
                <div class="truncate">
                  <span class="font-numbers font-bold mr-1">Giá {{ d.giaIndex }}:</span>
                  <span class="font-semibold text-white">{{ d.name }}</span>
                </div>
              </div>
              <UiBadge v-if="d.giaIndex === session.giaIndex" variant="warning">Đang ngự</UiBadge>
              <UiBadge v-else-if="(d.giaIndex || 0) < session.giaIndex" variant="success">Đã viên mãn</UiBadge>
              <span v-else class="text-xs text-secondary">Sắp hầu</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Trường hợp Điện đang nghỉ giữa hai vấn hầu (Tịnh Đàn) -->
      <div v-else class="p-5 rounded-lg bg-surface-card border border-hairline text-center space-y-4">
        <div class="w-12 h-12 rounded-full bg-surface-elevated border border-hairline flex items-center justify-center mx-auto text-primary">
          <ZenIcon name="lotus" :size="28" />
        </div>

        <div>
          <h4 class="text-sm font-bold text-white">{{ t('title.hdRest') }}</h4>
          <p class="text-xs text-secondary leading-relaxed mt-1 max-w-sm mx-auto">
            {{ t('desc.hdRest') }}
          </p>
        </div>

        <!-- Khung Đồng Hồ Đếm Ngược Khai Đàn 11h00 Trưa -->
        <div class="p-3.5 rounded-lg bg-surface-elevated border border-hairline space-y-2 max-w-sm mx-auto">
          <div class="flex items-center justify-between text-xs">
            <span class="text-secondary flex items-center gap-1.5 font-medium">
              <ZenIcon name="bell" :size="14" class="text-primary" />
              Lễ Khai Đàn Giờ Ngọ (11:00 Trưa)
            </span>
            <UiBadge variant="warning">
              {{ countdownTo11Am.isToday ? 'Hôm nay' : 'Ngày mai' }}
            </UiBadge>
          </div>

          <!-- 3 Ô Đếm Ngược Thời Gian: Giờ - Phút - Giây -->
          <div class="grid grid-cols-3 gap-2 py-1 text-center font-numbers">
            <div class="p-2 rounded bg-surface-card border border-hairline">
              <div class="text-base font-bold text-white">{{ countdownTo11Am.hours }}</div>
              <div class="text-xs text-secondary">Giờ</div>
            </div>
            <div class="p-2 rounded bg-surface-card border border-hairline">
              <div class="text-base font-bold text-white">{{ countdownTo11Am.minutes }}</div>
              <div class="text-xs text-secondary">Phút</div>
            </div>
            <div class="p-2 rounded bg-surface-card border border-hairline">
              <div class="text-base font-bold text-primary">{{ countdownTo11Am.seconds }}</div>
              <div class="text-xs text-secondary">Giây</div>
            </div>
          </div>

          <div class="text-xs text-secondary text-center pt-0.5">
            Thời lượng 8 phút · 5 Giá Thỉnh Lộc Thánh Ban
          </div>
        </div>

        <!-- 2 Nút Mở Đàn Thay Thế (Mở Đàn Đặc Cách & Góp Bách Gia) -->
        <div class="space-y-2 pt-1 max-w-sm mx-auto">
          <div class="text-xs font-semibold text-secondary">
            Hoặc Khai Mở Vấn Hầu Riêng Ngay Bây Giờ
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <UiButton
              variant="primary"
              size="sm"
              class="justify-center text-xs"
              @click="activeSubTab = 'sponsor'"
            >
              {{ t('btn.hdOpen') }}
              <span class="font-numbers ml-1">2,500 MC</span>
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              class="justify-center text-xs"
              @click="activeSubTab = 'crowdfund'"
            >
              {{ t('btn.hdPool') }}
              <span class="font-numbers ml-1">{{ crowdfundPercent }}%</span>
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Thống kê hạn mức nhận lộc cá nhân & Lịch Âm -->
      <div class="p-3.5 rounded-lg bg-surface-card border border-hairline flex items-center justify-between text-xs">
        <div>
          <div class="text-secondary">Lộc Hầu Đồng đã nhận hôm nay</div>
          <div class="text-white font-bold font-numbers mt-0.5">
            {{ hauDong.dailyClaimedMc }} / {{ hauDong.config.dailyMaxClaimMc }} MC
          </div>
        </div>
        <div class="text-right">
          <div class="text-secondary">Lịch Sóc Vọng (Âm Lịch)</div>
          <div class="text-primary font-semibold mt-0.5">{{ hauDong.lunarInfo.festivalLabel }}</div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 2: MỞ ĐÀN ĐẶC CÁCH (2,500 MC - GHI DANH CUỐN THƯ VÀNG)          -->
    <!-- =================================================================== -->
    <div v-else-if="activeSubTab === 'sponsor'" class="space-y-4">
      <div class="p-4 rounded-lg bg-surface-card border border-hairline space-y-3.5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-white">{{ t('title.hdSponsor') }}</h3>
            <p class="text-xs text-secondary mt-0.5">{{ t('desc.hdSponsor') }}</p>
          </div>
          <UiBadge variant="warning">
            <span class="font-numbers">2,500 MC</span>
          </UiBadge>
        </div>

        <!-- Phân bổ dòng tiền minh bạch 60 / 25 / 15 -->
        <div class="grid grid-cols-3 gap-2 text-center p-2.5 rounded-md bg-[#100e0c] border border-hairline">
          <div>
            <div class="text-xs text-secondary">60% Quỹ Ban Lộc</div>
            <div class="text-sm font-bold text-up font-numbers mt-0.5">1,500 MC</div>
          </div>
          <div class="border-x border-hairline">
            <div class="text-xs text-secondary">25% Tu Bổ (Burn)</div>
            <div class="text-sm font-bold text-white font-numbers mt-0.5">625 MC</div>
          </div>
          <div>
            <div class="text-xs text-secondary">15% Quỹ Rằm/M1</div>
            <div class="text-sm font-bold text-primary font-numbers mt-0.5">375 MC</div>
          </div>
        </div>

        <!-- Chọn Giá Đồng Tâm Nguyện -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-secondary">
            Chọn Giá Đồng Tâm Nguyện Chủ Đạo
          </label>
          <div class="space-y-1.5">
            <button
              type="button"
              class="w-full p-2.5 rounded-md border text-left text-xs transition cursor-pointer flex items-center justify-between"
              :class="
                selectedCustomDeity === 'default'
                  ? 'bg-surface-elevated border-[var(--primary,#c9a24b)] text-white'
                  : 'bg-[#100e0c] border-hairline text-secondary hover:text-white'
              "
              @click="selectedCustomDeity = 'default'"
            >
              <div>
                <div class="font-bold text-white">Ngũ Giá Tứ Phủ Truyền Thống (Mặc định)</div>
                <div class="text-xs text-secondary mt-0.5">Quan Đệ Tam · Chầu Đôi · Ông Hoàng Mười · Cô Đôi · Cậu Bé</div>
              </div>
              <ZenIcon v-if="selectedCustomDeity === 'default'" name="check" :size="16" class="text-primary shrink-0" />
            </button>

            <button
              type="button"
              class="w-full p-2.5 rounded-md border text-left text-xs transition cursor-pointer flex items-center justify-between"
              :class="
                selectedCustomDeity === 'duc_ong_tran_trieu'
                  ? 'bg-surface-elevated border-[var(--primary,#c9a24b)] text-white'
                  : 'bg-[#100e0c] border-hairline text-secondary hover:text-white'
              "
              @click="selectedCustomDeity = 'duc_ong_tran_trieu'"
            >
              <div>
                <div class="font-bold text-white">Thỉnh Giá Đức Ông Trần Triều (Hưng Đạo Đại Vương)</div>
                <div class="text-xs text-secondary mt-0.5">Khai đàn uy linh trừ tà, hộ quốc an dân &amp; định tâm</div>
              </div>
              <ZenIcon v-if="selectedCustomDeity === 'duc_ong_tran_trieu'" name="check" :size="16" class="text-primary shrink-0" />
            </button>

            <button
              type="button"
              class="w-full p-2.5 rounded-md border text-left text-xs transition cursor-pointer flex items-center justify-between"
              :class="
                selectedCustomDeity === 'ong_hoang_bay'
                  ? 'bg-surface-elevated border-[var(--primary,#c9a24b)] text-white'
                  : 'bg-[#100e0c] border-hairline text-secondary hover:text-white'
              "
              @click="selectedCustomDeity = 'ong_hoang_bay'"
            >
              <div>
                <div class="font-bold text-white">Thỉnh Giá Ông Hoàng Bảy Bảo Hà</div>
                <div class="text-xs text-secondary mt-0.5">Chiêu tài tấn bảo, thuận lợi đầu tư kinh doanh &amp; quý nhân</div>
              </div>
              <ZenIcon v-if="selectedCustomDeity === 'ong_hoang_bay'" name="check" :size="16" class="text-primary shrink-0" />
            </button>
          </div>
        </div>

        <!-- Lời Khấn Nguyện -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-secondary">
            Lời Khấn Nguyện Ghi Danh Lên Cuốn Thư Vàng
          </label>
          <textarea
            v-model="prayerInput"
            rows="2"
            maxlength="180"
            class="w-full rounded-md bg-[#100e0c] border border-hairline px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--primary,#c9a24b)] focus:ring-1 focus:ring-primary"
            :placeholder="t('desc.prayerHint')"
          />
        </div>

        <UiButton
          variant="primary"
          class="w-full justify-center"
          :disabled="hauDong.submitting"
          @click="askOpenConfirm('single_open')"
        >
          <span>Mở Đàn Đặc Cách (<span class="font-numbers">2,500 MC</span>)</span>
        </UiButton>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 3: GÓP QUỸ BÁCH GIA MỞ ĐÀN (CỘNG DỒN TỪ 50 MC)                  -->
    <!-- =================================================================== -->
    <div v-else class="space-y-4">
      <div class="p-4 rounded-lg bg-surface-card border border-hairline space-y-3.5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-white">{{ t('title.hdCrowd') }}</h3>
            <p class="text-xs text-secondary mt-0.5">{{ t('desc.hdCrowd') }}</p>
          </div>
          <UiBadge variant="neutral">
            <span class="font-numbers">{{ crowdfundPercent }}%</span>
          </UiBadge>
        </div>

        <!-- Thanh tiến độ Quỹ Bách Gia -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="text-secondary">Đã tích lũy:</span>
            <span class="font-numbers font-bold text-primary">
              {{ hauDong.crowdfund.currentMc.toLocaleString() }} / {{ hauDong.crowdfund.targetMc.toLocaleString() }} MC
            </span>
          </div>
          <div class="w-full h-2.5 rounded-full bg-[#100e0c] overflow-hidden border border-hairline">
            <div
              class="h-full bg-[var(--primary,#c9a24b)] transition-all duration-300"
              :style="{ width: `${crowdfundPercent}%` }"
            />
          </div>
          <div class="text-xs text-secondary">
            Còn thiếu <strong class="text-white font-numbers">{{ hauDong.crowdfund.remainingMc.toLocaleString() }} MC</strong> để tự động kích hoạt vấn hầu Bách Gia.
          </div>
        </div>

        <!-- Mức góp nhanh -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-secondary">
            Chọn Mức Công Đức Góp Quỹ (Tối thiểu 50 MC)
          </label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="amt in [50, 100, 250, 500]"
              :key="amt"
              type="button"
              class="py-2 rounded-md border text-xs font-bold font-numbers transition cursor-pointer"
              :class="
                crowdfundAmountMc === amt
                  ? 'bg-[var(--primary,#c9a24b)] text-[#1a1714] border-[var(--primary,#c9a24b)]'
                  : 'bg-[#100e0c] text-white border-hairline hover:bg-surface-elevated'
              "
              @click="crowdfundAmountMc = amt"
            >
              {{ amt }} MC
            </button>
          </div>
        </div>

        <UiButton
          variant="primary"
          class="w-full justify-center"
          :disabled="hauDong.submitting"
          @click="askOpenConfirm('crowdfund')"
        >
          <span>Góp Quỹ Bách Gia (<span class="font-numbers">{{ crowdfundAmountMc.toLocaleString() }} MC</span>)</span>
        </UiButton>

        <!-- Danh sách thiện tín vừa góp quỹ -->
        <div v-if="hauDong.crowdfund.recentContributors.length > 0" class="border-t border-hairline pt-3 space-y-2">
          <div class="text-xs font-bold text-secondary">
            Thiện Tín Vừa Góp Quỹ ({{ hauDong.crowdfund.contributorCount }})
          </div>
          <div class="space-y-1.5">
            <div
              v-for="(c, idx) in hauDong.crowdfund.recentContributors"
              :key="idx"
              class="px-3 py-2 rounded bg-[#100e0c] border border-hairline flex items-center justify-between text-xs"
            >
              <span class="font-semibold text-white truncate">{{ c.display_name }}</span>
              <span class="font-numbers font-bold text-up shrink-0">+{{ c.amount_mc.toLocaleString() }} MC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

