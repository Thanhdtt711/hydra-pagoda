<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useHydraStore, type HydraActivityDto } from '~/stores/hydra'
import { tr } from '~/lib/ui/copy'
import ZenIcon from '~/components/ZenIcon.vue'

const hydra = useHydraStore()
const isOpen = ref(true)
const selectedTx = ref<HydraActivityDto | null>(null)
const copiedField = ref<string | null>(null)

onMounted(() => {
  hydra.startPolling()
})

onBeforeUnmount(() => {
  hydra.stopPolling()
})

function togglePanel() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    void hydra.refresh()
  }
}

function selectTx(tx: HydraActivityDto) {
  selectedTx.value = selectedTx.value?.id === tx.id ? null : tx
}

async function copyText(text: string, field: string) {
  if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    setTimeout(() => {
      if (copiedField.value === field) copiedField.value = null
    }, 1800)
  } catch {
    // ignore
  }
}

const status = computed(() => hydra.status)
const isHeadOpen = computed(() => Boolean(status.value?.enabled && status.value?.connected && status.value?.headStatus === 'Open'))
const isHeadTransitioning = computed(() => {
  if (!status.value?.enabled || !status.value?.connected) return false
  const hs = status.value?.headStatus
  return hs === 'Initializing' || hs === 'FanoutPossible' || hs === 'Closed'
})

const headStatusLabel = computed(() => {
  if (!status.value?.enabled) return 'OFF'
  if (!status.value?.connected) return 'OFFLINE'
  const hs = status.value?.headStatus || 'Disconnected'
  if (hs === 'Open') return 'OPEN'
  if (hs === 'Initializing') return 'INITIALIZING'
  if (hs === 'FanoutPossible') return 'FANOUT'
  if (hs === 'Closed') return 'CLOSED'
  if (hs === 'Idle' || hs === 'Final') return 'IDLE'
  return 'OFFLINE'
})

const shortHeadId = computed(() => {
  const raw = status.value?.headId || status.value?.fuelAddress || ''
  if (!raw) return '—'
  if (raw.length <= 16) return raw
  return `${raw.slice(0, 8)}...${raw.slice(-6)}`
})

const utxoCount = computed(() => {
  const c = status.value?.headUtxoCount ?? 0
  if (c > 0) return c
  return status.value?.ledger?.fuelPoolSize ?? 0
})

/** Hiển thị đúng đơn vị ADA (chia 1.000.000 từ lovelace) để gọn gàng, chính xác. */
const adaLockedFormatted = computed(() => {
  const lovelace = status.value?.adaLockedLovelace ?? 0
  if (lovelace <= 0) return '0'
  const ada = lovelace / 1_000_000
  return ada.toLocaleString('vi-VN', {
    minimumFractionDigits: Number.isInteger(ada) ? 0 : 2,
    maximumFractionDigits: 2
  })
})

const avgLatencyText = computed(() => {
  const ms = status.value?.avgConfirmMs
  return `~${ms && ms > 0 ? ms : 52}ms/tx`
})

const recentTxs = computed<HydraActivityDto[]>(() => {
  return status.value?.recentTxs ?? []
})

const totalTxCount = computed(() => {
  const total = status.value?.totalL2Txs ?? 0
  return Math.max(total, recentTxs.value.length)
})

const networkName = computed(() => {
  return status.value?.network || 'preprod'
})

const cardanoscanBaseUrl = computed(() => {
  return networkName.value === 'mainnet'
    ? 'https://cardanoscan.io'
    : 'https://preprod.cardanoscan.io'
})

type ActivityVisual = {
  labelVi: string
  labelEn: string
  kind: 'key' | 'flame' | 'flower' | 'spark' | 'board'
}

function getActivityVisual(reason: string): ActivityVisual {
  const r = reason.toLowerCase()
  if (r.includes('incense') || r.includes('offering') || r.includes('merit') || r.includes('hau_dong')) {
    return { labelVi: r.includes('merit') ? 'Công đức' : 'Dâng hương', labelEn: 'Candle', kind: 'flame' }
  }
  if (r.includes('fortune') || r.includes('stick') || r.includes('couple')) {
    return { labelVi: 'Gieo quẻ', labelEn: 'Divination', kind: 'flower' }
  }
  if (r.includes('shop') || r.includes('card') || r.includes('pack') || r.includes('garden') || r.includes('koi')) {
    return { labelVi: 'Pháp bảo', labelEn: 'Flower', kind: 'flower' }
  }
  if (r.includes('board_game') || r.includes('parkour')) {
    return { labelVi: r.includes('parkour') ? 'Hành hương' : 'Kỳ đài', labelEn: 'Challenge', kind: 'board' }
  }
  if (r.includes('meditation') || r.includes('streak') || r.includes('deed')) {
    return { labelVi: 'Tọa thiền', labelEn: 'Meditation', kind: 'spark' }
  }
  return { labelVi: 'Khởi tạo', labelEn: 'Register', kind: 'key' }
}

function formatTimeAgo(ts: number): string {
  if (!ts) return 'vừa xong'
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return `${diffSec}s trước`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}p trước`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}g trước`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} ngày trước`
  try {
    return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return `${diffDays} ngày trước`
  }
}

function formatExactTime(ts: number): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('vi-VN', { hour12: false })
  } catch {
    return ''
  }
}

function shortTxHash(hash: string): string {
  if (!hash) return ''
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

function shortAddress(addr: string): string {
  if (!addr) return 'addr_test…'
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 9)}…${addr.slice(-4)}`
}
</script>

<template>
  <div class="hydra-widget-root pointer-events-auto select-none">
    <!-- Nút thu gọn dạng thanh dọc bám sát mép phải màn hình -->
    <button
      v-if="!isOpen"
      type="button"
      class="hydra-rail-btn"
      :class="isHeadOpen ? 'hydra-rail-btn--open' : (isHeadTransitioning ? 'hydra-rail-btn--warn' : 'hydra-rail-btn--off')"
      :title="isHeadOpen
        ? tr('Hydra Head L2 đang mở (OPEN) – Nhấp để xem sổ cái L2', 'Hydra Head L2 is OPEN – Click to open live ledger')
        : tr(`Hydra Head L2 hiện đang tắt (${headStatusLabel}) – Nhấp để xem chi tiết`, `Hydra Head L2 is currently inactive (${headStatusLabel}) – Click for details`)"
      @click="togglePanel"
    >
      <span
        class="hydra-rail-dot"
        :class="isHeadOpen ? 'hydra-rail-dot--open' : (isHeadTransitioning ? 'hydra-rail-dot--warn' : 'hydra-rail-dot--off')"
      />
      <span class="hydra-rail-text" :class="{ 'hydra-rail-text--off': !isHeadOpen }">HYDRA HEAD</span>
      <svg
        class="hydra-rail-wave"
        :class="isHeadOpen ? 'hydra-rail-wave--open' : 'hydra-rail-wave--off'"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    </button>

    <!-- Bảng chi tiết HYDRA HEAD: Phong cách Sơn mài & Vàng thếp, rộng rãi và sắc nét -->
    <div v-else class="hydra-panel shadow-2xl" :class="{ 'hydra-panel--off': !isHeadOpen }">
      <!-- Header -->
      <div class="hydra-panel__header">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="hydra-brand-mark" :class="{ 'hydra-brand-mark--off': !isHeadOpen }">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 12 12 17 22 12" />
              <polyline points="2 17 12 22 22 17" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-bold leading-none" :class="isHeadOpen ? 'text-[#ede4d3]' : 'text-[#a89c88]'">
                Hydra Head
              </span>
              <span
                class="text-[#968b79] hover:text-[#ede4d3] cursor-help"
                :title="tr('Kênh trạng thái Cardano Hydra Layer-2 xử lý giao dịch tức thời với phí bằng 0', 'Cardano Hydra Layer-2 state channel for instant zero-fee transactions')"
              >
                <ZenIcon name="info" :size="16" />
              </span>
            </div>
            <div class="text-xs font-numbers text-[#968b79] leading-tight mt-0.5">
              Cardano L2 · {{ networkName }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span
            class="hydra-status-pill font-numbers text-xs font-semibold"
            :class="isHeadOpen ? 'hydra-status-pill--open' : (isHeadTransitioning ? 'hydra-status-pill--warn' : 'hydra-status-pill--off')"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="isHeadOpen ? 'bg-[#0ecb81]' : (isHeadTransitioning ? 'bg-[#c9a24b]' : 'bg-[#6b6252]')"
            />
            {{ headStatusLabel }}
          </span>
          <button
            type="button"
            class="hydra-close-btn"
            :aria-label="tr('Thu gọn bảng Hydra Head', 'Collapse Hydra Head panel')"
            @click="isOpen = false"
          >
            <ZenIcon name="x" :size="16" />
          </button>
        </div>
      </div>

      <!-- Khối thông số Head -->
      <div class="hydra-panel__metrics">
        <!-- Head ID row -->
        <div class="flex items-center justify-between text-xs mb-3">
          <span class="font-medium text-[#a89c88]">{{ tr('Mã Head / Ví mồi', 'Head / Fuel ID') }}</span>
          <button
            type="button"
            class="font-numbers text-[#ede4d3] hover:text-[#c9a24b] cursor-pointer transition-colors"
            :title="tr('Nhấp để sao chép Head ID / Địa chỉ Fuel', 'Click to copy Head ID / Fuel address')"
            @click="copyText(status?.headId || status?.fuelAddress || '', 'headId')"
          >
            {{ copiedField === 'headId' ? tr('Đã chép!', 'Copied!') : shortHeadId }}
          </button>
        </div>

        <!-- 2 Ô Chỉ Số: UTxO & ADA đang khóa (tỷ lệ thoáng, chuẩn đơn vị ADA) -->
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div class="hydra-metric-box">
            <div class="flex items-center justify-between text-xs text-[#a89c88] mb-1.5">
              <span>UTxO</span>
              <span
                class="text-[#968b79] hover:text-[#ede4d3] cursor-help"
                :title="tr('Tổng số UTxO đang hoạt động trong Snapshot hiện tại của Hydra Head', 'Total active UTxOs in the current Hydra Head snapshot')"
              >
                <ZenIcon name="info" :size="16" />
              </span>
            </div>
            <div class="font-numbers text-xl font-semibold text-[#ede4d3] leading-none">
              {{ utxoCount }}
            </div>
          </div>

          <div class="hydra-metric-box">
            <div class="flex items-center justify-between text-xs text-[#a89c88] mb-1.5">
              <span>{{ tr('Khóa L2', 'ADA Locked') }}</span>
              <span
                class="text-[#968b79] hover:text-[#ede4d3] cursor-help"
                :title="tr('Tổng lượng tADA đã nạp từ Cardano L1 vào trong Hydra Head', 'Total ADA locked inside the Hydra Head from Cardano L1')"
              >
                <ZenIcon name="info" :size="16" />
              </span>
            </div>
            <div class="font-numbers text-xl font-semibold text-[#ede4d3] leading-none flex items-baseline gap-1.5">
              <span>{{ adaLockedFormatted }}</span>
              <span class="text-xs font-medium text-[#c9a24b]">ADA</span>
            </div>
          </div>
        </div>

        <!-- Dải thông số kỹ thuật gọn nhẹ (1 hàng sạch sẽ) -->
        <div class="hydra-spec-strip font-numbers text-xs">
          <span class="text-[#0ecb81] font-medium">Fee 0</span>
          <span class="hydra-spec-sep" />
          <span class="text-[#ede4d3]">Layer-2</span>
          <span class="hydra-spec-sep" />
          <span class="text-[#c9a24b] font-medium">{{ avgLatencyText }}</span>
        </div>
      </div>

      <!-- Đầu mục danh sách giao dịch -->
      <div class="hydra-panel__activity-header">
        <div class="flex items-center gap-2 text-xs font-semibold text-[#ede4d3]">
          <svg class="w-3.5 h-3.5 text-[#0ecb81] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>{{ tr('Hoạt động trong Head', 'In-Head Activity') }}</span>
        </div>
        <span class="font-numbers text-xs text-[#a89c88]">{{ totalTxCount }} tx</span>
      </div>

      <!-- Hộp kiểm chứng bằng chứng giao dịch L2 (Khi nhấp vào 1 dòng) -->
      <div v-if="selectedTx" class="hydra-inspector">
        <div class="flex items-center justify-between mb-2.5 pb-2 border-b border-[#332d26]">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#0ecb81]" />
            <span class="text-xs font-bold text-[#ede4d3]">
              {{ tr('Chứng thực L2', 'L2 Proof') }} #{{ selectedTx.id }}
            </span>
          </div>
          <button
            type="button"
            class="text-xs text-[#a89c88] hover:text-[#ede4d3] cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#26221d]"
            @click="selectedTx = null"
          >
            {{ tr('Đóng', 'Close') }}
          </button>
        </div>

        <div class="space-y-2 text-xs font-numbers">
          <div class="hydra-inspector__row">
            <span class="text-[#a89c88]">TxHash</span>
            <button
              type="button"
              class="text-[#0ecb81] hover:underline cursor-pointer truncate max-w-[205px]"
              :title="selectedTx.txHash"
              @click="copyText(selectedTx.txHash, 'txHash')"
            >
              {{ copiedField === 'txHash' ? tr('Đã chép TxHash!', 'Copied TxHash!') : `${selectedTx.txHash.slice(0, 12)}…${selectedTx.txHash.slice(-8)}` }}
            </button>
          </div>

          <div class="hydra-inspector__row">
            <span class="text-[#a89c88]">State UTxO</span>
            <button
              type="button"
              class="text-[#ede4d3] hover:text-[#c9a24b] cursor-pointer truncate max-w-[205px]"
              :title="selectedTx.stateUtxoRef || `${selectedTx.txHash}#0`"
              @click="copyText(selectedTx.stateUtxoRef || `${selectedTx.txHash}#0`, 'utxoRef')"
            >
              {{ copiedField === 'utxoRef' ? tr('Đã chép UTxO!', 'Copied UTxO!') : `${selectedTx.txHash.slice(0, 10)}…#0` }}
            </button>
          </div>

          <div class="hydra-inspector__row">
            <span class="text-[#a89c88]">Inline Datum</span>
            <span :class="selectedTx.deltaMc >= 0 ? 'text-[#0ecb81]' : 'text-[#c9a24b]'">
              {{ selectedTx.deltaMc >= 0 ? `+${selectedTx.deltaMc}` : selectedTx.deltaMc }} MC
              <span v-if="selectedTx.balanceAfter !== undefined" class="text-[#a89c88]">
                · {{ tr('Dư', 'Bal') }} {{ selectedTx.balanceAfter }}
              </span>
            </span>
          </div>

          <div class="hydra-inspector__row">
            <span class="text-[#a89c88]">{{ tr('Xác thực', 'Status') }}</span>
            <span class="text-[#0ecb81]">
              {{ selectedTx.snapshotNo ? `Snapshot #${selectedTx.snapshotNo}` : 'TxValid' }} · {{ selectedTx.latencyMs }}ms
            </span>
          </div>

          <div v-if="selectedTx.l1Address" class="hydra-inspector__row">
            <span class="text-[#a89c88]">{{ tr('Ví L1 neo', 'L1 Wallet') }}</span>
            <a
              :href="`${cardanoscanBaseUrl}/address/${selectedTx.l1Address}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[#c9a24b] hover:underline truncate max-w-[195px]"
              :title="tr('Mở ví trên Cardanoscan Preprod', 'Open address on Cardanoscan')"
            >
              {{ shortAddress(selectedTx.l1Address) }}
            </a>
          </div>

          <div v-if="selectedTx.cip20Lines?.length" class="pt-1">
            <div class="text-[#a89c88] mb-1">CIP-20 Metadata (674)</div>
            <div class="p-2.5 rounded-[2px] bg-[#100e0c] border border-[#332d26] text-[#ede4d3] space-y-0.5 break-all leading-relaxed">
              <div v-for="(line, idx) in selectedTx.cip20Lines" :key="idx">
                {{ line }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 text-[#968b79]">
            <span>{{ formatExactTime(selectedTx.createdAt) }}</span>
            <a
              v-if="status?.fuelAddress"
              :href="`${cardanoscanBaseUrl}/address/${status.fuelAddress}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[#c9a24b] hover:underline"
            >
              {{ tr('Xem Cardanoscan Fuel L1', 'View Cardanoscan Fuel L1') }}
            </a>
          </div>
        </div>
      </div>

      <!-- Danh sách giao dịch -->
      <div class="hydra-panel__list">
        <div v-if="recentTxs.length === 0" class="px-5 py-10 text-center text-xs text-[#968b79] leading-relaxed">
          {{ tr('Chưa có giao dịch L2 nào trong phiên này. Hãy gieo quẻ hoặc dâng hương để trải nghiệm!', 'No L2 transactions yet. Draw a fortune or offer incense to see live settlement!') }}
        </div>

        <button
          v-for="tx in recentTxs"
          :key="tx.id"
          type="button"
          class="hydra-tx-row w-full text-left cursor-pointer"
          :class="{ 'hydra-tx-row--active': selectedTx?.id === tx.id }"
          :title="tr('Nhấp để kiểm tra bằng chứng Hydra L2', 'Click to inspect Hydra L2 proof')"
          @click="selectTx(tx)"
        >
          <!-- Icon tối giản tinh tế -->
          <div class="hydra-tx-icon" :class="`hydra-tx-icon--${getActivityVisual(tx.reason).kind}`">
            <svg v-if="getActivityVisual(tx.reason).kind === 'flame'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 2c1.8 3.6 5 5.8 5 10a5 5 0 1 1-10 0c0-2.4 1.3-4.2 2.5-6-.4 2.2 1.2 3.2 2.5 3.2s1.6-2.4 0-7.2z" />
            </svg>
            <svg v-else-if="getActivityVisual(tx.reason).kind === 'flower'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <svg v-else-if="getActivityVisual(tx.reason).kind === 'spark' || getActivityVisual(tx.reason).kind === 'board'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m21 2-9.6 9.6" />
              <path d="m15.5 7.5 3 3L22 7l-3-3" />
            </svg>
          </div>

          <!-- Nội dung chính -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-[#ede4d3] truncate">
                {{ tr(getActivityVisual(tx.reason).labelVi, getActivityVisual(tx.reason).labelEn) }}
              </span>
              <span class="font-numbers text-xs text-[#968b79] shrink-0">
                {{ formatTimeAgo(tx.createdAt) }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 font-numbers text-xs text-[#a89c88] mt-1 truncate">
              <span class="text-[#ede4d3]/75">{{ shortTxHash(tx.txHash) }}</span>
              <span class="text-[#4a4237]">·</span>
              <span class="truncate">{{ shortAddress(tx.address) }}</span>
            </div>
          </div>

          <!-- Tốc độ & Phí -->
          <div class="text-right shrink-0 pl-2">
            <div class="font-numbers text-xs font-semibold text-[#0ecb81]">
              {{ tx.latencyMs }}ms
            </div>
            <div class="font-numbers text-xs text-[#968b79] mt-0.5">
              Fee 0
            </div>
          </div>
        </button>
      </div>

      <!-- Footer tinh gọn -->
      <div class="hydra-panel__footer text-xs text-[#968b79]">
        {{ tr('Nhấp một dòng để xem chứng thực', 'Select a row to inspect proof') }} ·
        <span class="text-[#ede4d3]">Hydra L2</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hydra-widget-root {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
}

/* Thanh dọc thu gọn mép phải */
.hydra-rail-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 8px;
  background-color: #1a1714;
  border: 1px solid #332d26;
  border-right: none;
  border-radius: 2px 0 0 2px;
  color: #ede4d3;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
}

.hydra-rail-btn--open {
  border-color: #4a4237;
}

.hydra-rail-btn--warn {
  border-color: rgba(201, 162, 75, 0.45);
}

.hydra-rail-btn--off {
  background-color: #12100e;
  border-color: #26221d;
  color: #6b6252;
  opacity: 0.7;
}

.hydra-rail-btn:hover {
  background-color: #26221d;
  border-color: #c9a24b;
  opacity: 1;
}

.hydra-rail-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
}

.hydra-rail-dot--open {
  background-color: #0ecb81;
}

.hydra-rail-dot--warn {
  background-color: #c9a24b;
}

.hydra-rail-dot--off {
  background-color: #4a4237;
}

.hydra-rail-text {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #ede4d3;
}

.hydra-rail-text--off {
  color: #6b6252;
}

.hydra-rail-wave--open {
  color: #0ecb81;
}

.hydra-rail-wave--off {
  color: #4a4237;
}

/* Panel mở rộng: Sơn mài và vàng thếp (góc 2px, viền chỉ mảnh, khoảng thở thoáng) */
.hydra-panel {
  width: 356px;
  max-height: calc(100vh - 136px);
  margin-right: 14px;
  background-color: #1a1714;
  border: 1px solid #332d26;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hydra-panel--off {
  border-color: #26221d;
}

.hydra-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #332d26;
  background-color: #100e0c;
}

.hydra-brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 2px;
  background-color: #1a1714;
  border: 1px solid #332d26;
  color: #0ecb81;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hydra-brand-mark--off {
  color: #6b6252;
}

.hydra-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 9999px;
}

.hydra-status-pill--open {
  background-color: rgba(14, 203, 129, 0.1);
  border: 1px solid rgba(14, 203, 129, 0.35);
  color: #0ecb81;
}

.hydra-status-pill--warn {
  background-color: rgba(201, 162, 75, 0.12);
  border: 1px solid rgba(201, 162, 75, 0.4);
  color: #c9a24b;
}

.hydra-status-pill--off {
  background-color: #1a1714;
  border: 1px solid #332d26;
  color: #968b79;
}

.hydra-close-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  color: #a89c88;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.hydra-close-btn:hover {
  background-color: #26221d;
  color: #ede4d3;
}

.hydra-panel__metrics {
  padding: 14px 16px;
  border-bottom: 1px solid #332d26;
}

.hydra-metric-box {
  padding: 10px 12px;
  background-color: #100e0c;
  border: 1px solid #332d26;
  border-radius: 2px;
}

.hydra-spec-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  background-color: #100e0c;
  border: 1px solid #332d26;
  border-radius: 2px;
}

.hydra-spec-sep {
  width: 1px;
  height: 12px;
  background-color: #332d26;
}

.hydra-panel__activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #332d26;
  background-color: #15120f;
}

.hydra-inspector {
  padding: 12px 16px;
  background-color: #151310;
  border-bottom: 1px solid #4a4237;
}

.hydra-inspector__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hydra-panel__list {
  flex: 1 1 auto;
  overflow-y: auto;
  max-height: 285px;
  scrollbar-width: thin;
  scrollbar-color: #332d26 #1a1714;
}

.hydra-panel__list::-webkit-scrollbar {
  width: 5px;
}

.hydra-panel__list::-webkit-scrollbar-track {
  background: #1a1714;
}

.hydra-panel__list::-webkit-scrollbar-thumb {
  background: #332d26;
  border-radius: 2px;
}

.hydra-panel__list::-webkit-scrollbar-thumb:hover {
  background: #4a4237;
}

.hydra-tx-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #26221d;
  transition: background-color 120ms ease;
}

.hydra-tx-row:hover {
  background-color: #26221d;
}

.hydra-tx-row--active {
  background-color: #26221d;
  border-left: 2px solid #c9a24b;
  padding-left: 14px;
}

.hydra-tx-icon {
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: #100e0c;
  border: 1px solid #332d26;
}

.hydra-tx-icon--flame {
  color: #c9a24b;
}

.hydra-tx-icon--flower {
  color: #0ecb81;
}

.hydra-tx-icon--spark,
.hydra-tx-icon--board {
  color: #c9a24b;
}

.hydra-tx-icon--key {
  color: #a89c88;
}

.hydra-panel__footer {
  padding: 10px 16px;
  text-align: center;
  border-top: 1px solid #332d26;
  background-color: #100e0c;
}
</style>
