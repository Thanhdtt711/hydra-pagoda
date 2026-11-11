<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWalletStore, KNOWN_WALLETS, type OrderStatus } from '~/stores/wallet'
import { useHydraOneWallet } from '~/composables/useHydraOneWallet'
import UiModal from '~/components/ui/UiModal.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiSelectableCard from '~/components/ui/UiSelectableCard.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiInput from '~/components/ui/UiInput.vue'
import ZenIcon from '~/components/ZenIcon.vue'

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
const activeTab = ref<'buy' | 'history'>('buy')

const walletTabs = computed(() => [
  { id: 'buy', label: 'Nạp MC Coin' },
  { id: 'history', label: 'Lịch sử nạp', count: wallet.orders.length }
])

const eternlWallet = computed(() => KNOWN_WALLETS.find(w => w.key === 'eternl') || {
  key: 'eternl',
  name: 'Eternl',
  url: 'https://eternl.io',
  accent: '#ff7a2f'
})

const isEternlInstalled = computed(() =>
  installedList.value.some(w => w.key === 'eternl' && w.installed)
)

const parsedAda = computed<number>(() => {
  const n = Math.floor(Number(customAdaInput.value))
  return Number.isFinite(n) && n >= 2 ? n : 0
})

const previewMc = computed<number>(() => parsedAda.value * 1000)

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

const hydraStatus = ref<{ enabled: boolean; connected: boolean; headStatus: string; latestSnapshotNo: number; confirmedL2Txs: number; mode: string } | null>(null)
const hydraLabel = computed(() => {
  const s = hydraStatus.value
  if (!s || !s.enabled) return 'Sổ cái cục bộ (Hydra L2 tắt)'
  if (s.mode === 'hydra_l2') return `Hydra L2 - Head ${s.headStatus} - Snapshot #${s.latestSnapshotNo} - ${s.confirmedL2Txs} tx xác nhận`
  return `Hydra L2 chưa sẵn sàng (${s.headStatus}) - dùng sổ cái cục bộ`
})

onMounted(async () => {
  try {
    hydraStatus.value = await $fetch('/api/hydra/status')
  } catch { hydraStatus.value = null }
  installedList.value = await wallet.detectInstalledWallets()
  if (wallet.isConnected) {
    await wallet.fetchOrders()
  }
})

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
    const addr = await bridge.refreshAddress()
    if (addr) {
      await wallet.loginWithHydraBridge(addr)
      activeTab.value = 'buy'
    }
  } finally {
    isSyncingBridge.value = false
  }
}

async function handleDisconnect() {
  await wallet.disconnect()
}

async function handleBuyMc() {
  if (parsedAda.value < 2 || isBuying.value) return
  await wallet.buyMcWithAda(parsedAda.value)
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
    :title="wallet.isConnected ? 'Ví Cardano & Nạp MC' : 'Kết Nối Ví Cardano'"
    :subtitle="wallet.isConnected ? 'Quản lý số dư và nạp điểm chiêm nghiệm' : 'Mạng yêu cầu: PREPROD (TESTNET)'"
    @close="emit('close')"
  >
    <template #header-badge>
      <UiBadge :variant="wallet.isTestnet ? 'warning' : 'success'" dot>
        {{ wallet.isTestnet ? 'TESTNET (PREPROD)' : 'CARDANO MAINNET' }}
      </UiBadge>
    </template>

    <div class="space-y-4 font-sans text-primary">
      <!-- TRẠNG THÁI 1: CHƯA KẾT NỐI VÍ -->
      <div v-if="!wallet.isConnected" class="space-y-4">
        <!-- Khi chạy trong Iframe HydraOne: Hướng dẫn kết nối từ Header cha -->
        <div v-if="wallet.isIframeMode" class="p-4 rounded-lg bg-surface-elevated border border-hairline space-y-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded bg-[#181a20] border border-hairline flex items-center justify-center shrink-0 mt-0.5">
              <ZenIcon name="wallet" :size="20" class="text-binance-yellow" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-primary">Ví HydraOne</span>
                <UiBadge variant="warning">Iframe Host</UiBadge>
              </div>
              <p class="text-xs text-secondary mt-1 leading-normal">
                Vạn Cảnh Thiền Tự đang nhúng trong hệ sinh thái HydraOne. Vui lòng bấm nút <span class="text-primary font-semibold">"Kết nối"</span> ở góc trên bên phải thanh menu HydraOne để tự động đăng nhập.
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-hairline">
            <span class="text-xs text-muted font-numbers">Tự động đồng bộ số dư L1/L2</span>
            <UiButton
              variant="secondary"
              size="sm"
              :loading="isSyncingBridge"
              @click="handleSyncHydraBridge"
            >
              Làm Mới Trạng Thái Ví
            </UiButton>
          </div>
        </div>

        <!-- Khi chạy ngoài Iframe: Kết nối CIP-30 thông thường -->
        <template v-else>
          <p class="text-sm text-secondary leading-normal m-0">
            Chọn ví Cardano để kết nối. Bạn sẽ ký một thông điệp CIP-8 để xác minh quyền sở hữu ví — hoàn toàn không tốn phí, không gửi giao dịch on-chain.
          </p>

          <!-- Thông báo lỗi kết nối nếu có -->
          <div v-if="wallet.errorMessage" role="alert" class="p-3 rounded-[6px] bg-trading-down/10 border border-trading-down/30 text-xs">
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
              <div class="w-10 h-10 rounded bg-[#181a20] border border-hairline flex items-center justify-center shrink-0 overflow-hidden">
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
                class="inline-flex items-center justify-center px-3 h-8 rounded-[4px] bg-surface-card border border-hairline text-xs font-semibold text-primary hover:bg-surface-elevated transition-colors"
              >
                Cài Đặt
              </a>
            </div>
          </div>
        </template>

        <div class="p-3 rounded-[6px] bg-surface-elevated border border-hairline flex items-start gap-2.5">
          <ZenIcon name="info" :size="16" class="text-secondary shrink-0 mt-0.5" />
          <span class="text-xs text-secondary leading-normal">
            Hệ thống tuân thủ nghiêm ngặt bảo mật Non-Custodial: Tuyệt đối không giữ khóa riêng, không tự ý kích hoạt chuyển khoản khi chưa được bạn duyệt.
          </span>
        </div>
      </div>

      <!-- TRẠNG THÁI 2: ĐÃ KẾT NỐI VÍ -->
      <div v-else class="space-y-4">
        <!-- Identity Bar -->
        <div class="p-3 rounded-[6px] bg-surface-elevated border border-hairline flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <img v-if="wallet.walletKey !== 'hydraone'" src="/images/eternl-logo.png" alt="Eternl" class="w-7 h-7 rounded shrink-0 object-contain" />
            <div v-else class="w-7 h-7 rounded bg-[#181a20] border border-hairline flex items-center justify-center shrink-0">
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
          <div class="p-3 rounded-[6px] bg-surface-elevated border border-hairline">
            <span class="text-xs text-secondary block mb-1">Số dư ví Cardano</span>
            <span class="text-base font-bold font-numbers text-primary">{{ wallet.adaBalance }} ADA</span>
          </div>
          <div class="p-3 rounded-[6px] bg-surface-elevated border border-primary/40">
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
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-secondary uppercase tracking-wider">Chọn gói ADA nạp nhanh</span>
            <span class="text-xs font-numbers text-secondary">1 ADA = 1.000 MC</span>
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
              <div class="text-xs font-numbers text-secondary mt-0.5">{{ (pkg * 1000).toLocaleString() }} MC</div>
            </UiSelectableCard>
          </div>

          <!-- Custom Input -->
          <div>
            <label for="custom-ada-input" class="block text-xs font-semibold text-secondary mb-1.5">
              Hoặc nhập số ADA tùy ý (tối thiểu 2 ADA):
            </label>
            <UiInput
              id="custom-ada-input"
              v-model="customAdaInput"
              type="number"
              min="2"
              max="100000"
              step="1"
              placeholder="Nhập số ADA..."
              @change="onCustomAdaChange"
            >
              <template #suffix>
                <span class="text-xs font-bold text-secondary font-numbers">ADA</span>
              </template>
            </UiInput>
            <div v-if="parsedAda < 2" class="text-xs text-trading-down mt-1">
              Số ADA nạp tối thiểu là 2 ADA.
            </div>
          </div>

          <!-- Summary card -->
          <div class="p-3 rounded-[6px] bg-surface-elevated border border-hairline">
            <div class="text-sm text-primary leading-normal">
              Bạn trả <strong class="font-numbers">{{ parsedAda >= 2 ? parsedAda.toLocaleString() : '0' }} ADA</strong>
              <span class="text-xs text-secondary"> (chưa gồm phí mạng ~0.2 ADA)</span>
              để nhận <strong class="text-gold font-numbers">{{ parsedAda >= 2 ? previewMc.toLocaleString() : '0' }} MC</strong>
            </div>
            <p class="text-xs text-secondary mt-1 leading-normal m-0">
              Hệ thống cộng MC tự động sau khi giao dịch đạt đủ xác nhận trên chuỗi Cardano ({{ wallet.isTestnet ? 'Preprod' : 'Mainnet' }}).
            </p>
          </div>

          <!-- Tiến trình nạp -->
          <div v-if="wallet.purchasePhase !== 'idle'" class="p-3 rounded-[6px] bg-surface-elevated border border-hairline">
            <div class="grid grid-cols-4 gap-1.5 text-center text-xs font-medium text-secondary">
              <div
                class="py-1.5 px-1 rounded-[4px]"
                :class="['creating_order', 'awaiting_signature'].includes(wallet.purchasePhase) ? 'bg-primary/20 text-gold font-semibold' : 'bg-surface-card text-trading-up'"
              >
                1. Chờ ký
              </div>
              <div
                class="py-1.5 px-1 rounded-[4px]"
                :class="wallet.purchasePhase === 'submitting_tx' ? 'bg-primary/20 text-gold font-semibold' : ['awaiting_confirmation', 'completed'].includes(wallet.purchasePhase) ? 'bg-surface-card text-trading-up' : 'bg-surface-card text-secondary'"
              >
                2. Đã gửi
              </div>
              <div
                class="py-1.5 px-1 rounded-[4px]"
                :class="wallet.purchasePhase === 'awaiting_confirmation' ? 'bg-primary/20 text-gold font-semibold' : wallet.purchasePhase === 'completed' ? 'bg-surface-card text-trading-up' : 'bg-surface-card text-secondary'"
              >
                3. Xác nhận
              </div>
              <div
                class="py-1.5 px-1 rounded-[4px]"
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

          <!-- Single Primary Yellow CTA button (Ẩn khi đang đợi nạp / đang xử lý giao dịch) -->
          <UiButton
            v-if="wallet.purchasePhase === 'idle' || wallet.purchasePhase === 'error'"
            variant="primary"
            block
            :disabled="parsedAda < 2"
            @click="handleBuyMc"
          >
            {{ `Xác nhận nạp ${parsedAda >= 2 ? previewMc.toLocaleString() : 0} MC (${parsedAda >= 2 ? parsedAda : 0} ADA)` }}
          </UiButton>

          <UiButton
            v-else-if="wallet.purchasePhase === 'completed'"
            variant="secondary"
            block
            @click="handleResetPurchase"
          >
            Tiếp tục nạp đơn mới
          </UiButton>
        </div>

        <!-- TAB 2: LỊCH SỬ NẠP -->
        <div v-if="activeTab === 'history'" class="space-y-3 pt-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-secondary uppercase tracking-wider">Đơn nạp gần đây</span>
            <UiButton variant="ghost" size="sm" @click="wallet.fetchOrders()">Làm mới</UiButton>
          </div>

          <div v-if="wallet.orders.length === 0" class="text-center py-8 text-sm text-secondary">
            Chưa có giao dịch nạp MC nào.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="ord in wallet.orders"
              :key="ord.orderId"
              class="p-3 rounded-[6px] bg-surface-elevated border border-hairline"
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
      <div class="flex items-center justify-between text-xs text-secondary">
        <span>Non-Custodial — Không lưu khóa riêng</span>
        <span class="font-numbers">1 ADA = 1.000 MC</span>
      </div>
    </template>
  </UiModal>
</template>
