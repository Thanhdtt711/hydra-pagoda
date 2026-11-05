<script setup lang="ts">
import { useWalletStore, KNOWN_WALLETS, type OrderStatus } from '~/stores/wallet'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const wallet = useWalletStore()
const installedList = ref<{ key: string; name: string; installed: boolean; icon?: string }[]>([])
const isConnectingKey = ref<string | null>(null)

// Chọn gói mua MC bằng ADA (tối thiểu 2 ADA; gói nhanh 5 / 10 / 50 / 100 ADA)
const quickPackages = [5, 10, 50, 100] as const
const selectedAda = ref<number>(5)
const customAdaInput = ref<string>('5')
const activeTab = ref<'buy' | 'history' | 'wallets'>('buy')

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

onMounted(async () => {
  installedList.value = await wallet.detectInstalledWallets()
  if (wallet.isConnected) {
    await wallet.fetchOrders()
  }
})

async function handleConnect(key: string) {
  isConnectingKey.value = key
  try {
    const ok = await wallet.connectWallet(key)
    if (ok) {
      activeTab.value = 'buy'
    }
  } finally {
    isConnectingKey.value = null
  }
}

async function handleDisconnect() {
  await wallet.disconnect()
}

async function handleBuyMc() {
  if (parsedAda.value < 2 || isBuying.value) return
  await wallet.buyMcWithAda(parsedAda.value)
}

const isInstalled = (key: string) => installedList.value.some(w => w.key === key && w.installed)
const eternl = KNOWN_WALLETS.find(w => w.key === 'eternl')!

function statusBadge(status: OrderStatus): { label: string; cls: string } {
  switch (status) {
    case 'completed':
      return { label: 'Hoàn tất', cls: 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/30' }
    case 'confirming':
      return { label: 'Đang chờ xác nhận', cls: 'bg-[#FCD535]/15 text-[#FCD535] border-[#FCD535]/30' }
    case 'submitted':
      return { label: 'Đã gửi lên chuỗi', cls: 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30' }
    case 'signing':
    case 'pending':
      return { label: 'Đang chờ ký', cls: 'bg-white/10 text-[#eaecef] border-white/20' }
    case 'underpaid':
      return { label: 'Trả thiếu (Chờ đối soát)', cls: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30' }
    case 'expired_paid':
      return { label: 'Quá hạn có tiền (Đối soát)', cls: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30' }
    case 'expired':
      return { label: 'Đã hết hạn', cls: 'bg-white/5 text-[#707a8a] border-white/10' }
    default:
      return { label: 'Lỗi', cls: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30' }
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
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Box: Binance Web3 Geometry -->
    <div class="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#181a20] border border-[#2b3139] rounded-[10px] shadow-2xl overflow-hidden font-sans">
      <!-- Header -->
      <div class="p-4 bg-[#1e2329] border-b border-[#2b3139] flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-[6px] bg-[#3b82f6]/15 border border-[#3b82f6]/30 flex items-center justify-center text-[#3b82f6]">
            <ZenIcon name="cardano" :size="16" />
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="mono-eyebrow text-[#707a8a] text-[10px]">CARDANO CIP-30 // ETERNL & MC COIN</span>
              <span
                class="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] font-bold"
                :class="wallet.isTestnet ? 'bg-[#FCD535]/15 text-[#FCD535]' : 'bg-[#0ecb81]/15 text-[#0ecb81]'"
              >
                {{ wallet.isTestnet ? 'TESTNET (PREPROD)' : 'MAINNET' }}
              </span>
            </div>
            <h3 class="text-sm font-bold text-white tracking-tight font-display">
              {{ wallet.isConnected ? 'Ví Cardano & Nạp MC Coin' : 'Kết Nối Ví Cardano (Eternl)' }}
            </h3>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#707a8a] hover:text-white hover:bg-[#2b3139] transition-colors cursor-pointer"
        >
          <ZenIcon name="close" :size="15" />
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="overflow-y-auto flex-1 divide-y divide-[#2b3139]">
        <!-- Connected State Banner -->
        <div v-if="wallet.isConnected" class="p-4 bg-[#1e2329]/60 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#0ecb81] animate-pulse"></span>
              <span class="text-xs font-bold text-white">{{ wallet.walletName }}</span>
              <span class="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#0ecb81]/15 text-[#0ecb81] font-semibold">CIP-8 ĐÃ XÁC THỰC</span>
            </div>
            <button
              @click="handleDisconnect"
              class="text-[11px] font-mono text-[#f6465d] hover:underline cursor-pointer"
            >
              Ngắt Kết Nối
            </button>
          </div>

          <div class="p-2.5 bg-[#0b0e11] border border-[#2b3139] rounded-[6px] space-y-1">
            <div class="text-[10px] text-[#707a8a] font-mono uppercase">Địa chỉ ví đã xác thực (Bech32):</div>
            <div class="font-mono text-[11px] text-[#eaecef] break-all select-all">{{ wallet.address }}</div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs font-mono">
            <div class="p-2.5 bg-[#1e2329] rounded-[6px] border border-[#2b3139]">
              <div class="text-[10px] text-[#707a8a]">SỐ DƯ VÍ CARDANO:</div>
              <div class="text-sm font-bold text-[#3b82f6] mt-0.5">{{ wallet.adaBalance }} ADA</div>
            </div>
            <div class="p-2.5 bg-[#1e2329] rounded-[6px] border border-[#2b3139]">
              <div class="text-[10px] text-[#707a8a]">SỐ DƯ MC TRONG GAME:</div>
              <div class="text-sm font-bold text-[#FCD535] mt-0.5">{{ wallet.mcBalance.toLocaleString() }} MC</div>
            </div>
          </div>

          <!-- Sub-navigation Tabs -->
          <div class="grid grid-cols-3 gap-1.5 pt-1">
            <button
              @click="activeTab = 'buy'"
              class="py-1.5 px-2 rounded-[5px] text-[11px] font-mono font-bold transition cursor-pointer"
              :class="activeTab === 'buy' ? 'bg-[#FCD535] text-[#0b0e11]' : 'bg-[#0b0e11] text-[#929aa5] hover:text-white'"
            >
              + Nạp MC Coin
            </button>
            <button
              @click="activeTab = 'history'; wallet.fetchOrders()"
              class="py-1.5 px-2 rounded-[5px] text-[11px] font-mono font-bold transition cursor-pointer"
              :class="activeTab === 'history' ? 'bg-[#FCD535] text-[#0b0e11]' : 'bg-[#0b0e11] text-[#929aa5] hover:text-white'"
            >
              Lịch Sử ({{ wallet.orders.length }})
            </button>
            <button
              @click="activeTab = 'wallets'"
              class="py-1.5 px-2 rounded-[5px] text-[11px] font-mono font-bold transition cursor-pointer"
              :class="activeTab === 'wallets' ? 'bg-[#FCD535] text-[#0b0e11]' : 'bg-[#0b0e11] text-[#929aa5] hover:text-white'"
            >
              Đổi Ví Khác
            </button>
          </div>
        </div>

        <!-- TAB 1: MUA MC COIN BẰNG ADA (Chỉ hiện khi đã kết nối ví) -->
        <div v-if="wallet.isConnected && activeTab === 'buy'" class="p-4 space-y-3.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">Chọn gói ADA muốn nạp</span>
            <span class="text-[11px] font-mono text-[#FCD535] font-semibold">Tỷ giá: 1 ADA = 1.000 MC</span>
          </div>

          <!-- Quick Packages: 5 / 10 / 50 / 100 ADA -->
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="pkg in quickPackages"
              :key="pkg"
              type="button"
              @click="selectQuickAda(pkg)"
              class="p-2.5 rounded-[6px] border text-center transition cursor-pointer"
              :class="parsedAda === pkg ? 'border-[#FCD535] bg-[#FCD535]/15 text-white' : 'border-[#2b3139] bg-[#1e2329] text-[#929aa5] hover:border-[#474d57]'"
            >
              <div class="text-xs font-bold font-mono text-white">{{ pkg }} ADA</div>
              <div class="text-[10px] font-mono text-[#FCD535] mt-0.5">{{ (pkg * 1000).toLocaleString() }} MC</div>
            </button>
          </div>

          <!-- Custom ADA Input (min 2 ADA) -->
          <div class="space-y-1">
            <label class="text-[11px] text-[#929aa5] flex items-center justify-between">
              <span>Hoặc nhập số ADA tùy ý (số nguyên, tối thiểu 2 ADA):</span>
              <span v-if="parsedAda < 2" class="text-[#f6465d] font-mono text-[10px]">Tối thiểu 2 ADA</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model="customAdaInput"
                type="number"
                min="2"
                max="100000"
                step="1"
                @input="onCustomAdaChange"
                class="flex-1 bg-[#0b0e11] border border-[#2b3139] focus:border-[#FCD535] rounded-[6px] px-3 py-2 text-xs font-mono text-white outline-none"
                placeholder="Nhập số ADA (>= 2)"
              />
              <span class="text-xs font-mono text-[#707a8a] shrink-0">ADA</span>
            </div>
          </div>

          <!-- Clear Conversion Summary Required by Spec -->
          <div class="p-3 rounded-[6px] bg-[#0b0e11] border border-[#FCD535]/30 space-y-1.5">
            <div class="text-xs text-[#eaecef] font-medium">
              Bạn trả <b class="text-[#3b82f6] font-mono">{{ parsedAda >= 2 ? parsedAda.toLocaleString() : '—' }} ADA</b>
              <span class="text-[#929aa5] text-[11px]">(chưa gồm phí mạng ~0.2 ADA)</span>
              → nhận <b class="text-[#FCD535] font-mono">{{ parsedAda >= 2 ? previewMc.toLocaleString() : '0' }} MC</b>
            </div>
            <div class="text-[10px] text-[#707a8a] font-mono">
              Chỉ cộng MC sau khi giao dịch đạt ≥ {{ wallet.confirmationsRequired }} xác nhận trên chuỗi Cardano ({{ wallet.isTestnet ? 'Preprod' : 'Mainnet' }}).
            </div>
          </div>

          <!-- One-way Warning Box -->
          <div class="p-2.5 rounded-[6px] bg-[#FCD535]/10 border border-[#FCD535]/25 text-[11px] text-[#eaecef] leading-relaxed">
            <b class="text-[#FCD535]">Lưu ý quan trọng:</b> MC coin là điểm dùng trong game (mua vật phẩm Cửa Hàng/Di Sản, gieo quẻ Cầu An, cúng dường Hòm Công Đức) — <b>không phải tiền mã hóa và KHÔNG đổi ngược ra ADA</b> (chỉ nạp một chiều).
          </div>

          <!-- Transaction Progress Stepper -->
          <div v-if="wallet.purchasePhase !== 'idle'" class="p-3 rounded-[6px] bg-[#1e2329] border border-[#2b3139] space-y-2">
            <div class="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
              <div
                class="py-1 rounded"
                :class="['creating_order', 'awaiting_signature'].includes(wallet.purchasePhase) ? 'bg-[#FCD535] text-black font-bold' : 'bg-[#0b0e11] text-[#0ecb81]'"
              >
                1. Chờ ký
              </div>
              <div
                class="py-1 rounded"
                :class="wallet.purchasePhase === 'submitting_tx' ? 'bg-[#FCD535] text-black font-bold' : ['awaiting_confirmation', 'completed'].includes(wallet.purchasePhase) ? 'bg-[#0b0e11] text-[#0ecb81]' : 'bg-[#0b0e11] text-[#707a8a]'"
              >
                2. Đã gửi
              </div>
              <div
                class="py-1 rounded"
                :class="wallet.purchasePhase === 'awaiting_confirmation' ? 'bg-[#FCD535] text-black font-bold animate-pulse' : wallet.purchasePhase === 'completed' ? 'bg-[#0b0e11] text-[#0ecb81]' : 'bg-[#0b0e11] text-[#707a8a]'"
              >
                3. Xác nhận
              </div>
              <div
                class="py-1 rounded"
                :class="wallet.purchasePhase === 'completed' ? 'bg-[#0ecb81] text-black font-bold' : wallet.purchasePhase === 'error' ? 'bg-[#f6465d] text-white font-bold' : 'bg-[#0b0e11] text-[#707a8a]'"
              >
                {{ wallet.purchasePhase === 'error' ? '4. Lỗi' : '4. Hoàn tất' }}
              </div>
            </div>

            <div
              class="text-[11px] font-mono leading-relaxed"
              :class="wallet.purchasePhase === 'error' ? 'text-[#f6465d]' : wallet.purchasePhase === 'completed' ? 'text-[#0ecb81]' : 'text-[#FCD535]'"
            >
              {{ wallet.purchaseStatusText }}
            </div>

            <div v-if="wallet.activeOrder?.txHash" class="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-[#2b3139]">
              <span class="text-[#707a8a]">TxHash: {{ wallet.activeOrder.txHash.slice(0, 12) }}...{{ wallet.activeOrder.txHash.slice(-6) }}</span>
              <a
                :href="wallet.activeOrder.explorerUrl || `${wallet.explorerBase}/transaction/${wallet.activeOrder.txHash}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#3b82f6] hover:underline font-bold"
              >
                Xem trên Cardanoscan ↗
              </a>
            </div>
          </div>

          <button
            type="button"
            :disabled="parsedAda < 2 || isBuying"
            @click="handleBuyMc"
            class="w-full py-2.5 px-4 rounded-[6px] font-bold text-xs font-mono transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-[#FCD535] hover:bg-[#f0b90b] text-[#0b0e11]"
          >
            {{ isBuying ? 'Đang xử lý giao dịch trong ví...' : `Xác nhận mua ${parsedAda >= 2 ? previewMc.toLocaleString() : 0} MC bằng ${parsedAda >= 2 ? parsedAda : 0} ADA` }}
          </button>
        </div>

        <!-- TAB 2: LỊCH SỬ ĐƠN NẠP MC -->
        <div v-if="wallet.isConnected && activeTab === 'history'" class="p-4 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">Lịch sử đơn nạp ADA → MC</span>
            <button
              @click="wallet.fetchOrders()"
              class="text-[11px] font-mono text-[#3b82f6] hover:underline cursor-pointer"
            >
              Làm mới ↻
            </button>
          </div>

          <div v-if="wallet.orders.length === 0" class="p-6 text-center text-xs text-[#707a8a] font-mono">
            Chưa có giao dịch nạp MC nào.
          </div>

          <div v-else class="space-y-2 max-h-64 overflow-y-auto pr-1">
            <div
              v-for="ord in wallet.orders"
              :key="ord.orderId"
              class="p-2.5 rounded-[6px] bg-[#1e2329] border border-[#2b3139] space-y-1.5 text-xs font-mono"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-white">
                  {{ ord.expectedAda }} ADA → <span class="text-[#FCD535]">+{{ (ord.creditedMc ?? ord.expectedMc).toLocaleString() }} MC</span>
                </span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded border font-semibold"
                  :class="statusBadge(ord.status).cls"
                >
                  {{ statusBadge(ord.status).label }}
                </span>
              </div>

              <div class="flex items-center justify-between text-[10px] text-[#707a8a]">
                <span>{{ formatTime(ord.createdAt) }} · #{{ ord.orderId.slice(-8) }}</span>
                <span v-if="['submitted', 'confirming'].includes(ord.status)">
                  Xác nhận: {{ ord.confirmations }}/{{ ord.confirmationsRequired }}
                </span>
              </div>

              <div v-if="ord.txHash" class="flex items-center justify-between text-[10px] pt-1 border-t border-[#2b3139]/60">
                <span class="text-[#929aa5]">Tx: {{ ord.txHash.slice(0, 10) }}...{{ ord.txHash.slice(-6) }}</span>
                <a
                  :href="ord.explorerUrl || `${wallet.explorerBase}/transaction/${ord.txHash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[#3b82f6] hover:underline"
                >
                  Cardanoscan ↗
                </a>
              </div>

              <div v-if="ord.failureReason" class="text-[10px] text-[#f6465d]">
                {{ ord.failureReason }}
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3 (HOẶC KHI CHƯA KẾT NỐI): DANH SÁCH VÍ CIP-30 -->
        <div v-if="!wallet.isConnected || activeTab === 'wallets'" class="p-4 space-y-2">
          <div class="text-[11px] text-[#929aa5] mb-2">
            Chọn ví Cardano (khuyến nghị <b class="text-[#ff7a2f]">Eternl</b>). Bạn sẽ ký một thông điệp CIP-8 để xác minh quyền sở hữu ví — <b>không tốn phí, không gửi giao dịch</b>.
          </div>

          <!-- Thông báo lỗi thân thiện -->
          <div v-if="wallet.errorMessage" class="p-2.5 rounded-[6px] border border-[#f6465d]/40 bg-[#f6465d]/10 text-[11px] text-[#f6465d] leading-relaxed">
            {{ wallet.errorMessage }}
            <div v-if="wallet.errorCode === 'not_installed'" class="mt-1.5">
              <a :href="eternl.url" target="_blank" rel="noopener noreferrer" class="underline font-bold text-[#ff7a2f]">Cài ví Eternl (trang chính thức) →</a>
            </div>
          </div>

          <div class="text-[10px] font-mono text-[#707a8a]">
            Mạng yêu cầu: <span :class="wallet.isTestnet ? 'text-[#FCD535]' : 'text-[#0ecb81]'" class="font-bold">{{ wallet.isTestnet ? 'PREPROD (TESTNET)' : 'MAINNET' }}</span>
          </div>

          <div
            v-for="w in KNOWN_WALLETS"
            :key="w.key"
            @click="handleConnect(w.key)"
            :class="wallet.walletKey === w.key ? 'border-[#FCD535] bg-[#FCD535]/10' : 'border-[#2b3139] bg-[#1e2329] hover:border-[#474d57] hover:bg-[#2b3139]'"
            class="p-3 rounded-[6px] border cursor-pointer transition-all flex items-center justify-between group"
          >
            <div class="flex items-center gap-3">
              <div
                :style="{ backgroundColor: `${w.accent}20`, borderColor: `${w.accent}40`, color: w.accent }"
                class="w-8 h-8 rounded-[6px] border flex items-center justify-center font-bold text-xs font-mono"
              >
                {{ w.name.slice(0, 2).toUpperCase() }}
              </div>
              <div>
                <div class="text-xs font-bold text-white group-hover:text-[#FCD535] transition-colors">{{ w.name }}</div>
                <div class="text-[10px] text-[#707a8a] font-mono">Chuẩn CIP-30 / CIP-8 Verified</div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <span v-if="isConnectingKey === w.key" class="text-[10px] font-mono text-[#FCD535] animate-pulse">Đang chờ ví / chữ ký...</span>
              <span v-else-if="wallet.walletKey === w.key && wallet.isConnected" class="text-[10px] font-mono text-[#0ecb81] font-bold">✓ Đã kết nối</span>
              <span v-else-if="!isInstalled(w.key)" class="text-[10px] font-mono text-[#707a8a]">Chưa cài · Cài đặt →</span>
              <span v-else class="text-[11px] font-mono text-[#707a8a] group-hover:text-white transition-colors">Kết nối →</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Compliance Note -->
      <div class="p-3 bg-[#1e2329] border-t border-[#2b3139] flex items-center justify-between text-[10px] text-[#707a8a] font-mono shrink-0">
        <div class="flex items-center gap-1.5">
          <ZenIcon name="shield" :size="12" class="text-[#FCD535]" />
          <span>Non-Custodial · Không giữ khóa riêng · 1 ADA = 1.000 MC</span>
        </div>
        <span>Hydra Pagoda</span>
      </div>
    </div>
  </div>
</template>
