<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useWalletStore, KNOWN_WALLETS, type OrderStatus } from '~/stores/wallet'
import { useHydraStore } from '~/stores/hydra'
import { useHydraOneWallet } from '~/composables/useHydraOneWallet'
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'
import { t } from '~/lib/ui/copy'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiSelectableCard from '~/components/ui/UiSelectableCard.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiInput from '~/components/ui/UiInput.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { quoteByLovelace } from '~/lib/mc/pricing'
import { LOVELACE_PER_ADA } from '~/lib/mc/tokenomics'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const wallet = useWalletStore()
const installedList = ref<{ key: string; name: string; installed: boolean; icon?: string }[]>([])
const isConnectingKey = ref<string | null>(null)
const isSyncingBridge = ref(false)

const quickPackages = [5, 10, 50, 100] as const
const selectedAda = ref<number>(5)
const customAdaInput = ref<string>('5')
const activeTab = ref<'buy' | 'withdraw' | 'history'>('buy')

const walletTabs = computed(() => [
  { id: 'buy', label: 'Mua MC (L2)' },
  { id: 'withdraw', label: 'Rút về ví (L1)' },
  { id: 'history', label: 'Lịch sử', count: wallet.orders.length }
])

const MIN_WITHDRAW_MC = 500
const withdrawAmountInput = ref<string>('1000')
const isWithdrawing = ref(false)
const withdrawResult = ref<{ ok: boolean; txHash?: string; explorerUrl?: string; mcAmount?: number; error?: string } | null>(null)

const parsedWithdrawMc = computed<number>(() => {
  const n = Math.floor(Number(withdrawAmountInput.value))
  return Number.isFinite(n) && n >= MIN_WITHDRAW_MC ? n : 0
})

async function handleWithdrawMc() {
  if (isWithdrawing.value || parsedWithdrawMc.value < MIN_WITHDRAW_MC || parsedWithdrawMc.value > wallet.mcBalance) return
  isWithdrawing.value = true
  withdrawResult.value = null
  try {
    withdrawResult.value = await wallet.withdrawMcToL1(parsedWithdrawMc.value)
  } finally {
    isWithdrawing.value = false
  }
}

const eternlWallet = computed(() => KNOWN_WALLETS.find(w => w.key === 'eternl') || {
  key: 'eternl',
  name: 'Eternl',
  url: 'https://eternl.io',
  accent: '#ff7a2f'
})

const isEternlInstalled = computed(() =>
  installedList.value.some(w => w.key === 'eternl' && w.installed)
)

const MIN_BUY_ADA = 5
const market = ref<{
  salePool: string
  saleSold: string
  saleRemaining: string
  salePercent: number
  tierNumber: number
  priceLovelace: string
  remainingInTier: string
  soldOut: boolean
} | null>(null)

const questFund = ref<{
  questPool: string
  questPaid: string
  questRecycled: string
  burnedMc: string
  opsMc: string
  questRemaining: string
  remainingPct: number
  lowPoolAlert: boolean
  exhausted: boolean
} | null>(null)

const parsedAda = computed<number>(() => {
  const n = Math.floor(Number(customAdaInput.value))
  return Number.isFinite(n) && n >= MIN_BUY_ADA ? n : 0
})

const previewQuote = computed(() => {
  if (parsedAda.value < MIN_BUY_ADA || market.value?.soldOut) return null
  try {
    const sold = BigInt(market.value?.saleSold ?? '0')
    return quoteByLovelace(sold, BigInt(parsedAda.value) * LOVELACE_PER_ADA)
  } catch {
    return null
  }
})

const previewMc = computed<number>(() => (previewQuote.value ? Number(previewQuote.value.totalMc) : 0))

const currentMcPerAda = computed<number>(() => {
  const price = BigInt(market.value?.priceLovelace || '1000')
  return price > 0n ? Number(LOVELACE_PER_ADA / price) : 0
})

async function loadMarketInfo() {
  if (!wallet.isAuthenticated) return
  try {
    const res = (await $fetch('/api/mc/funds')) as { sale: typeof market.value; quest: typeof questFund.value }
    if (res?.sale) market.value = res.sale
    if (res?.quest) questFund.value = res.quest
  } catch { /* giữ mặc định */ }
}

const isBuying = computed(() =>
  ['creating_order', 'awaiting_signature', 'submitting_tx'].includes(wallet.purchasePhase)
)

function selectQuickAda(ada: number) {
  selectedAda.value = ada
  customAdaInput.value = String(ada)
}

function onCustomAdaChange() {
  const n = Math.floor(Number(customAdaInput.value))
  selectedAda.value = n
}

const hydra = useHydraStore()
const hydraStatus = ref<{ enabled: boolean; connected: boolean; headStatus: string; latestSnapshotNo: number; confirmedL2Txs: number; mode: string; dbEngine?: 'postgres' | 'sqlite' } | null>(null)
const hydraLabel = computed(() => {
  const s = hydraStatus.value
  const isPg = s?.dbEngine ? s.dbEngine === 'postgres' : hydra.isPostgres
  const dbText = isPg ? 'CSDL: PostgreSQL (Supabase)' : 'CSDL: SQLite (cục bộ)'
  if (!s || !s.enabled) return `${dbText} · Hydra L2 tắt`
  if (s.mode === 'hydra_l2') return `${dbText} · Hydra L2 - Head ${s.headStatus} - Snapshot #${s.latestSnapshotNo} - ${s.confirmedL2Txs} tx xác nhận`
  return `${dbText} · Hydra L2 chưa sẵn sàng (${s.headStatus})`
})

onMounted(async () => {
  try {
    hydraStatus.value = (await $fetch<unknown>('/api/hydra/status' as string)) as typeof hydraStatus.value
  } catch { hydraStatus.value = null }
  installedList.value = await wallet.detectInstalledWallets()
  if (wallet.isConnected) {
    await Promise.all([wallet.fetchOrders(), loadMarketInfo()])
  }
})

watch(
  () => wallet.purchasePhase,
  (phase) => {
    if (phase === 'completed') {
      void loadMarketInfo()
    }
  }
)

async function handleConnectEternl() {
  isConnectingKey.value = 'eternl'
  try {
    const ok = await wallet.connectWallet('eternl')
    if (ok) {
      activeTab.value = 'buy'
    }
  } finally {
    isConnectingKey.value = null
  }
}

async function handleSyncHydraBridge() {
  isSyncingBridge.value = true
  try {
    const bridge = useHydraOneWallet()
    await bridge.init().catch(() => {})
    const addr = await bridge.refreshAddress().catch(() => null)
    if (addr) {
      wallet.address = addr
      wallet.status = 'connected'
      wallet.walletKey = 'hydraone'
      wallet.walletName = 'HydraOne'
      await bridge.refreshBalance().catch(() => {})
      if (bridge.balanceLovelace.value !== null) {
        wallet.balanceLovelace = bridge.balanceLovelace.value
      }
      // Xác thực chữ ký CIP-8 qua HydraOne Bridge để mở phiên server (isAuthenticated = true)
      const ok = await wallet.loginWithHydraBridge(addr)
      if (ok) {
        await Promise.all([wallet.fetchOrders(), loadMarketInfo()])
        try {
          hydraStatus.value = (await $fetch<unknown>('/api/hydra/status' as string)) as typeof hydraStatus.value
        } catch { /* bỏ qua */ }
        activeTab.value = 'buy'
      }
    }
  } finally {
    isSyncingBridge.value = false
  }
}

async function handleDisconnect() {
  await wallet.disconnect()
}

async function handleBuyMc() {
  if (parsedAda.value < MIN_BUY_ADA || isBuying.value || market.value?.soldOut) return
  await wallet.buyMcWithAda(parsedAda.value)
  await loadMarketInfo()
}

function handleResetPurchase() {
  wallet.purchasePhase = 'idle'
  wallet.purchaseStatusText = ''
}

function statusBadge(status: OrderStatus): { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' | 'danger' } {
  switch (status) {
    case 'completed':
      return { label: 'Hoàn tất', variant: 'success' }
    case 'confirming':
      return { label: 'Đang xác nhận', variant: 'warning' }
    case 'submitted':
      return { label: 'Đã gửi lên chuỗi', variant: 'info' }
    case 'signing':
    case 'pending':
      return { label: 'Đang chờ ký', variant: 'neutral' }
    case 'underpaid':
      return { label: 'Trả thiếu (Đối soát)', variant: 'danger' }
    case 'expired_paid':
      return { label: 'Quá hạn có tiền', variant: 'danger' }
    case 'expired':
      return { label: 'Đã hết hạn', variant: 'neutral' }
    default:
      return { label: 'Lỗi', variant: 'danger' }
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <UiModal
    :title="wallet.isAuthenticated ? 'Ví Cardano & Nạp MC' : 'Kết Nối & Xác Thực Ví Cardano'"
    :subtitle="wallet.isAuthenticated ? 'Quản lý số dư và nạp điểm chiêm nghiệm' : 'Mạng yêu cầu: PREPROD (TESTNET)'"
    @close="emit('close')"
  >
    <template #header-badge>
      <UiBadge :variant="wallet.isTestnet ? 'warning' : 'success'" dot>
        {{ wallet.isTestnet ? 'TESTNET (PREPROD)' : 'CARDANO MAINNET' }}
      </UiBadge>
    </template>

    <div class="space-y-4 font-sans text-primary">
      <!-- TRẠNG THÁI 1: CHƯA XÁC THỰC PHIÊN VÍ -->
      <div v-if="!wallet.isAuthenticated" class="space-y-4">
        <!-- Khi chạy trong Iframe HydraOne: Ví đã nối ở Header cha, chỉ cần ký xác thực CIP-8 để mở khóa toàn bộ chùa -->
        <div v-if="wallet.isIframeMode" class="p-4 rounded-[2px] bg-surface-elevated border border-hairline space-y-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-[2px] bg-[#1a1714] border border-hairline flex items-center justify-center shrink-0 mt-0.5">
              <ZenIcon name="wallet" :size="20" class="text-binance-yellow" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-primary">Ví HydraOne</span>
                <UiBadge :variant="wallet.address ? 'success' : 'warning'">
                  {{ wallet.address ? 'Đã nhận địa chỉ' : 'Chưa nối ở Header' }}
                </UiBadge>
              </div>
              <p class="text-xs text-secondary mt-1 leading-normal">
                {{
                  wallet.address
                    ? 'Ví HydraOne đã kết nối ở thanh trên. Bấm xác thực chữ ký (miễn phí, không gửi giao dịch) để mở khóa số dư MC và toàn bộ tính năng.'
                    : t('desc.walletIframe')
                }}
              </p>
              <div v-if="wallet.address" class="text-xs text-muted font-numbers truncate mt-1">
                {{ wallet.address }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-hairline gap-2">
            <span class="text-xs text-muted font-numbers">Xác thực CIP-8 · 0 phí gas</span>
            <UiButton
              variant="primary"
              size="sm"
              :loading="isSyncingBridge"
              @click="handleSyncHydraBridge"
            >
              {{ wallet.address ? 'Ký xác thực ví' : t('btn.refreshWallet') }}
            </UiButton>
          </div>
        </div>

        <!-- Khi chạy ngoài Iframe: Kết nối CIP-30 thông thường -->
        <template v-else>
          <p class="text-sm text-secondary leading-normal m-0">
            {{ t('desc.walletConnect') }}
          </p>

          <!-- Thông báo lỗi kết nối nếu có -->
          <div v-if="wallet.errorMessage" role="alert" class="p-3 rounded-[2px] bg-trading-down/10 border border-trading-down/30 text-xs">
            <div class="flex items-start gap-2.5">
              <ZenIcon name="circle-alert" :size="16" class="text-trading-down shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-trading-down">Không thể kết nối ví</div>
                <p class="text-xs text-secondary mt-0.5 leading-normal">{{ wallet.errorMessage }}</p>
              </div>
            </div>
            <UiButton variant="secondary" size="sm" class="mt-2" @click="handleConnectEternl">
              Thử lại
            </UiButton>
          </div>

          <!-- THẺ VÍ ETERNL DUY NHẤT -->
          <div class="p-3.5 rounded-lg bg-surface-elevated border border-hairline flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded bg-[#1a1714] border border-hairline flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/images/eternl-logo.png"
                  alt="Eternl"
                  class="w-7 h-7 object-contain"
                />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-primary">Eternl</span>
                  <UiBadge variant="warning">Khuyên dùng</UiBadge>
                </div>
                <p class="text-xs text-secondary leading-tight mt-0.5 truncate">
                  {{ isEternlInstalled ? 'Đã phát hiện tiện ích Eternl' : 'Chưa cài đặt tiện ích Eternl' }}
                </p>
                <div class="text-xs text-muted leading-tight mt-0.5 font-numbers">Chuẩn CIP-30 / CIP-8 Verified</div>
              </div>
            </div>

            <div class="shrink-0">
              <UiButton
                v-if="isEternlInstalled"
                variant="primary"
                size="sm"
                :loading="isConnectingKey === 'eternl'"
                :disabled="Boolean(isConnectingKey)"
                @click="handleConnectEternl"
              >
                {{ isConnectingKey === 'eternl' ? 'Đang chờ...' : 'Kết Nối' }}
              </UiButton>
              <a
                v-else
                :href="eternlWallet.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center px-3 h-[40px] shrink-0 rounded-[2px] bg-surface-card border border-hairline text-xs font-semibold text-primary hover:bg-surface-elevated transition-colors"
              >
                Cài Đặt
              </a>
            </div>
          </div>
        </template>

        <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline flex items-start gap-2.5">
          <ZenIcon name="info" :size="16" class="text-secondary shrink-0 mt-0.5" />
          <span class="text-xs text-secondary leading-normal">
            {{ t('desc.nonCustodial') }}
          </span>
        </div>
      </div>

      <!-- TRẠNG THÁI 2: ĐÃ KẾT NỐI VÍ -->
      <div v-else class="space-y-4">
        <!-- Identity Bar -->
        <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <img v-if="wallet.walletKey !== 'hydraone'" src="/images/eternl-logo.png" alt="Eternl" class="w-7 h-7 rounded shrink-0 object-contain" />
            <div v-else class="w-7 h-7 rounded bg-[#1a1714] border border-hairline flex items-center justify-center shrink-0">
              <ZenIcon name="wallet" :size="14" class="text-binance-yellow" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-primary">{{ wallet.walletName }}</span>
                <UiBadge variant="success" dot>Đã kết nối</UiBadge>
                <UiBadge v-if="wallet.isIframeMode" variant="warning">Host Header</UiBadge>
              </div>
              <div class="text-xs text-secondary font-numbers truncate mt-0.5">
                {{ wallet.address }}
              </div>
            </div>
          </div>
          <UiButton v-if="!wallet.isIframeMode" variant="ghost" size="sm" @click="handleDisconnect">
            Ngắt
          </UiButton>
          <UiButton v-else variant="ghost" size="sm" :loading="isSyncingBridge" @click="handleSyncHydraBridge">
            Làm mới
          </UiButton>
        </div>

        <!-- Balances Grid -->
        <div class="grid grid-cols-2 gap-2.5">
          <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline">
            <span class="text-xs text-secondary block mb-1">Số dư ví Cardano</span>
            <span class="text-base font-bold font-numbers text-primary">{{ wallet.adaBalance }} ADA</span>
          </div>
          <div class="p-3 rounded-[2px] bg-surface-elevated border border-primary/40">
            <span class="text-xs text-secondary block mb-1">Số dư MC trong game</span>
            <span class="text-base font-bold font-numbers text-gold">{{ wallet.mcBalance.toLocaleString() }} MC</span>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <UiTabs
          :model-value="activeTab"
          :items="walletTabs"
          layout="horizontal"
          aria-label="Chức năng ví Cardano"
          @update:model-value="(val) => { activeTab = val as any; if (val === 'history') wallet.fetchOrders() }"
        />

        <div class="text-xs text-secondary font-numbers" data-testid="hydra-status-line">
          {{ hydraLabel }}
        </div>

        <!-- TAB 1: NẠP MC COIN -->
        <div v-if="activeTab === 'buy'" class="space-y-4 pt-1">
          <!-- Thanh tiến độ quỹ bán & giá bậc hiện tại -->
          <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-primary">
                Bậc {{ market?.tierNumber ?? 1 }} / 10 ·
                <span class="text-gold font-numbers">{{ Number(market?.priceLovelace ?? 1000).toLocaleString() }} lovelace/MC</span>
              </span>
              <UiBadge :variant="market?.soldOut ? 'danger' : 'success'">
                {{ market?.soldOut ? 'Hết MC' : `1 ADA ≈ ${currentMcPerAda.toLocaleString()} MC` }}
              </UiBadge>
            </div>
            <div class="w-full h-2 bg-[#14110e] border border-hairline rounded-[2px] overflow-hidden">
              <div
                class="h-full bg-[#c9a24b] transition-all duration-300"
                :style="{ width: `${market?.salePercent ?? 0}%` }"
              ></div>
            </div>
            <div class="flex items-center justify-between text-xs text-secondary font-numbers">
              <span>Còn lại: <strong class="text-primary">{{ Number(market?.saleRemaining ?? 850000000).toLocaleString() }} MC</strong></span>
              <span>Đã bán {{ market?.salePercent ?? 0 }}% / 850M</span>
            </div>
          </div>

          <!-- Quỹ Thưởng 150M MC & Phân bổ 3 giỏ chi tiêu minh bạch -->
          <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-primary">
                Quỹ Thưởng &amp; Sự Kiện (15%)
              </span>
              <UiBadge :variant="questFund?.exhausted ? 'danger' : questFund?.lowPoolAlert ? 'warning' : 'neutral'">
                {{ questFund?.exhausted ? 'Hết thưởng' : `Còn ${questFund?.remainingPct ?? 100}% / 150M` }}
              </UiBadge>
            </div>
            <div class="flex items-center justify-between text-xs text-secondary font-numbers">
              <span>Quỹ hiện có: <strong class="text-gold">{{ Number(questFund?.questRemaining ?? 150000000).toLocaleString() }} MC</strong></span>
              <span>Đã phát: {{ Number(questFund?.questPaid ?? 0).toLocaleString() }} MC</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-hairline text-xs">
              <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] px-2 py-1">
                <div class="text-secondary">Tái cấp (55%)</div>
                <div class="font-bold font-numbers text-[#0ecb81]">+{{ Number(questFund?.questRecycled ?? 0).toLocaleString() }}</div>
              </div>
              <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] px-2 py-1">
                <div class="text-secondary">Đốt (5%)</div>
                <div class="font-bold font-numbers text-[#f6465d]">{{ Number(questFund?.burnedMc ?? 0).toLocaleString() }}</div>
              </div>
              <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] px-2 py-1">
                <div class="text-secondary">Vận hành (40%)</div>
                <div class="font-bold font-numbers text-primary">{{ Number(questFund?.opsMc ?? 0).toLocaleString() }}</div>
              </div>
            </div>
          </div>

          <div v-if="market?.soldOut" class="p-3 rounded-[2px] bg-[#26221d] border border-[#f6465d]/70 text-xs font-semibold text-[#f6465d]">
            Quỹ bán 850.000.000 MC đã bán hết. Chức năng mua MC tạm khóa.
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-secondary">Chọn gói ADA nạp nhanh</span>
            <span class="text-xs font-numbers text-secondary">Tối thiểu {{ MIN_BUY_ADA }} ADA</span>
          </div>

          <!-- Quick Packages -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Chọn gói ADA">
            <UiSelectableCard
              v-for="pkg in quickPackages"
              :key="pkg"
              :selected="parsedAda === pkg"
              @select="selectQuickAda(pkg)"
            >
              <div class="text-sm font-bold font-numbers text-primary">{{ pkg }} ADA</div>
              <div class="text-xs font-numbers text-secondary mt-0.5">{{ (pkg * currentMcPerAda).toLocaleString() }} MC</div>
            </UiSelectableCard>
          </div>

          <!-- Custom Input -->
          <div>
            <label for="custom-ada-input" class="block text-xs font-semibold text-secondary mb-1.5">
              Hoặc nhập số ADA tùy ý (tối thiểu {{ MIN_BUY_ADA }} ADA):
            </label>
            <UiInput
              id="custom-ada-input"
              v-model="customAdaInput"
              type="number"
              :min="MIN_BUY_ADA"
              max="100000"
              step="1"
              placeholder="Nhập số ADA..."
              @change="onCustomAdaChange"
            >
              <template #suffix>
                <span class="text-xs font-bold text-secondary font-numbers">ADA</span>
              </template>
            </UiInput>
            <div v-if="parsedAda < MIN_BUY_ADA" class="text-xs text-trading-down mt-1">
              Số ADA mua tối thiểu là {{ MIN_BUY_ADA }} ADA (tránh vướng min UTxO).
            </div>
          </div>

          <!-- Summary card -->
          <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline">
            <div class="text-sm text-primary leading-normal">
              Bạn trả <strong class="font-numbers">{{ parsedAda >= MIN_BUY_ADA ? parsedAda.toLocaleString() : '0' }} ADA</strong>
              <span class="text-xs text-secondary"> (chưa gồm phí mạng ~0.2 ADA)</span>
              để nhận <strong class="text-gold font-numbers">{{ parsedAda >= MIN_BUY_ADA ? previewMc.toLocaleString() : '0' }} MC</strong>
            </div>
            <p class="text-xs text-secondary mt-1 leading-normal m-0">
              {{ t('desc.walletTopup') }} ({{ wallet.isTestnet ? 'Preprod' : 'Mainnet' }})
            </p>
          </div>

          <!-- Tiến trình nạp -->
          <div v-if="wallet.purchasePhase !== 'idle'" class="p-3 rounded-[2px] bg-surface-elevated border border-hairline">
            <div class="grid grid-cols-4 gap-1.5 text-center text-xs font-medium text-secondary">
              <div
                class="py-1.5 px-1 rounded-[2px]"
                :class="['creating_order', 'awaiting_signature'].includes(wallet.purchasePhase) ? 'bg-primary/20 text-gold font-semibold' : 'bg-surface-card text-trading-up'"
              >
                1. Chờ ký
              </div>
              <div
                class="py-1.5 px-1 rounded-[2px]"
                :class="wallet.purchasePhase === 'submitting_tx' ? 'bg-primary/20 text-gold font-semibold' : ['awaiting_confirmation', 'completed'].includes(wallet.purchasePhase) ? 'bg-surface-card text-trading-up' : 'bg-surface-card text-secondary'"
              >
                2. Đã gửi
              </div>
              <div
                class="py-1.5 px-1 rounded-[2px]"
                :class="wallet.purchasePhase === 'awaiting_confirmation' ? 'bg-primary/20 text-gold font-semibold' : wallet.purchasePhase === 'completed' ? 'bg-surface-card text-trading-up' : 'bg-surface-card text-secondary'"
              >
                3. Xác nhận
              </div>
              <div
                class="py-1.5 px-1 rounded-[2px]"
                :class="wallet.purchasePhase === 'completed' ? 'bg-surface-card text-trading-up' : wallet.purchasePhase === 'error' ? 'bg-trading-down/20 text-trading-down font-semibold' : 'bg-surface-card text-secondary'"
              >
                {{ wallet.purchasePhase === 'error' ? '4. Lỗi' : '4. Xong' }}
              </div>
            </div>

            <div class="flex items-center gap-2 text-xs text-primary mt-2.5">
              <ZenIcon
                v-if="wallet.purchasePhase === 'error'"
                name="circle-alert"
                :size="16"
                class="text-trading-down shrink-0"
              />
              <ZenIcon
                v-else-if="wallet.purchasePhase === 'completed'"
                name="circle-check"
                :size="16"
                class="text-trading-up shrink-0"
              />
              <ZenIcon
                v-else
                name="loader-circle"
                :size="16"
                class="text-secondary animate-spin shrink-0"
              />
              <span class="truncate">{{ wallet.purchaseStatusText }}</span>
            </div>
          </div>
        </div>

        <!-- TAB 2: RÚT MC VỀ VÍ L1 (CO-SIGN eUTxO) -->
        <div v-if="activeTab === 'withdraw'" class="space-y-4 pt-1">
          <div class="p-3 rounded-[2px] bg-surface-elevated border border-hairline space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-secondary">Số dư MC trên Hydra L2:</span>
              <span class="font-bold font-numbers text-gold">{{ wallet.mcBalance.toLocaleString() }} MC</span>
            </div>
            <p class="text-xs text-secondary leading-normal m-0">
              Giao dịch ký 2 bên (Co-sign eUTxO): MC thật chuyển thẳng từ Ví Quỹ về ví Eternl của bạn. Bạn chỉ trả ~0,18 ADA phí mạng — phần ~1,2 ADA min-UTxO vẫn nằm trong ví bạn, Chùa tốn 0 ADA.
            </p>
          </div>

          <div class="grid grid-cols-4 gap-2">
            <UiButton variant="secondary" size="sm" @click="withdrawAmountInput = '1000'">1.000</UiButton>
            <UiButton variant="secondary" size="sm" @click="withdrawAmountInput = '5000'">5.000</UiButton>
            <UiButton variant="secondary" size="sm" @click="withdrawAmountInput = '10000'">10.000</UiButton>
            <UiButton variant="secondary" size="sm" @click="withdrawAmountInput = String(wallet.mcBalance)">Tất cả</UiButton>
          </div>

          <div>
            <label for="withdraw-mc-input" class="block text-xs font-semibold text-secondary mb-1.5">
              Số MC muốn rút về ví Eternl (tối thiểu {{ MIN_WITHDRAW_MC }} MC):
            </label>
            <UiInput
              id="withdraw-mc-input"
              v-model="withdrawAmountInput"
              type="number"
              :min="MIN_WITHDRAW_MC"
              :max="wallet.mcBalance"
              step="100"
              placeholder="Nhập số MC..."
            >
              <template #suffix>
                <span class="text-xs font-bold text-gold font-numbers">MC</span>
              </template>
            </UiInput>
            <div v-if="parsedWithdrawMc > wallet.mcBalance" class="text-xs text-trading-down mt-1">
              Vượt quá số dư MC trên L2 hiện có ({{ wallet.mcBalance.toLocaleString() }} MC).
            </div>
          </div>

          <div
            v-if="withdrawResult"
            class="p-3 rounded-[2px] border text-xs space-y-1"
            :class="withdrawResult.ok ? 'bg-surface-elevated border-[#0ecb81]/70 text-primary' : 'bg-[#26221d] border-[#f6465d]/70 text-[#f6465d]'"
          >
            <template v-if="withdrawResult.ok">
              <div class="font-bold text-[#0ecb81]">
                Đã gửi lệnh rút {{ withdrawResult.mcAmount?.toLocaleString() }} MC về ví Eternl!
              </div>
              <div class="font-numbers text-secondary truncate">Tx: {{ withdrawResult.txHash }}</div>
              <a
                v-if="withdrawResult.explorerUrl"
                :href="withdrawResult.explorerUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block text-gold font-semibold hover:underline"
              >
                Xem giao dịch trên Cardanoscan
              </a>
            </template>
            <template v-else>
              <div class="font-semibold">{{ withdrawResult.error }}</div>
            </template>
          </div>
        </div>

        <!-- TAB 3: LỊCH SỬ NẠP -->
        <div v-if="activeTab === 'history'" class="space-y-3 pt-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-secondary">Đơn nạp gần đây</span>
            <UiButton variant="ghost" size="sm" @click="wallet.fetchOrders()">Làm mới</UiButton>
          </div>

          <div v-if="wallet.orders.length === 0" class="text-center py-8 text-sm text-secondary">
            Chưa có giao dịch nạp MC nào.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="ord in wallet.orders"
              :key="ord.orderId"
              class="p-3 rounded-[2px] bg-surface-elevated border border-hairline"
            >
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm font-bold font-numbers text-primary">
                  {{ ord.expectedAda }} ADA -> +{{ (ord.creditedMc ?? ord.expectedMc).toLocaleString() }} MC
                </span>
                <UiBadge :variant="statusBadge(ord.status).variant">
                  {{ statusBadge(ord.status).label }}
                </UiBadge>
              </div>

              <div class="flex items-center justify-between text-xs text-secondary font-numbers">
                <span>{{ formatTime(ord.createdAt) }} · Đơn #{{ ord.orderId.slice(-8) }}</span>
                <span v-if="['submitted', 'confirming'].includes(ord.status)">
                  Xác nhận: {{ ord.confirmations }}/{{ ord.confirmationsRequired }}
                </span>
              </div>

              <div v-if="ord.txHash" class="text-xs text-secondary font-numbers mt-1.5 flex items-center justify-between">
                <span>Tx: {{ ord.txHash.slice(0, 10) }}...{{ ord.txHash.slice(-6) }}</span>
                <a
                  :href="ord.explorerUrl || `${wallet.explorerBase}/transaction/${ord.txHash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-info hover:underline"
                >
                  Xem Cardanoscan
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="space-y-2.5">
        <!-- Nút hành động chính ghim cố định ở đáy (không bị trôi khi scroll nội dung) -->
        <template v-if="wallet.isAuthenticated && activeTab === 'buy'">
          <UiButton
            v-if="wallet.purchasePhase === 'idle' || wallet.purchasePhase === 'error'"
            variant="primary"
            block
            :disabled="parsedAda < MIN_BUY_ADA || Boolean(market?.soldOut)"
            @click="handleBuyMc"
          >
            {{ t('btn.topupConfirm', { mc: parsedAda >= MIN_BUY_ADA ? previewMc.toLocaleString() : 0 }) }}
            <span class="font-numbers ml-1">{{ parsedAda >= MIN_BUY_ADA ? parsedAda : 0 }} ADA</span>
          </UiButton>
          <UiButton
            v-else-if="wallet.purchasePhase === 'awaiting_confirmation'"
            variant="secondary"
            block
            @click="handleResetPurchase"
          >
            Tạo đơn mới (đơn cũ vẫn tự xác nhận ngầm)
          </UiButton>
          <UiButton
            v-else-if="wallet.purchasePhase === 'completed'"
            variant="secondary"
            block
            @click="handleResetPurchase"
          >
            {{ t('btn.newTopup') }}
          </UiButton>
        </template>

        <template v-else-if="wallet.isAuthenticated && activeTab === 'withdraw'">
          <UiButton
            variant="primary"
            block
            :loading="isWithdrawing"
            :disabled="isWithdrawing || parsedWithdrawMc < MIN_WITHDRAW_MC || parsedWithdrawMc > wallet.mcBalance"
            @click="handleWithdrawMc"
          >
            {{ isWithdrawing ? 'Đang ký Co-sign & gửi L1...' : `Rút ${parsedWithdrawMc ? parsedWithdrawMc.toLocaleString() : '0'} MC về ví Eternl` }}
          </UiButton>
        </template>

        <div class="flex items-center justify-between text-xs text-secondary">
          <span>Non-Custodial — Không lưu khóa riêng</span>
          <span class="font-numbers">1 ADA ≈ {{ currentMcPerAda.toLocaleString() }} MC</span>
        </div>
      </div>
    </template>
  </UiModal>
</template>
