<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { useWalletStore, KNOWN_WALLETS } from '~/stores/wallet'
import { useHydraOneWallet } from '~/composables/useHydraOneWallet'

/**
 * Wallet Gate: màn hình DUY NHẤT hiển thị khi chưa có phiên ví hợp lệ.
 * Chưa kết nối thì không dựng thế giới 3D, không hiện số dư MC, không gọi bất kỳ API nội bộ nào.
 */
const props = defineProps<{
  /** true trong lúc đang khôi phục phiên từ cookie (tải lại trang) */
  restoring?: boolean
}>()

const wallet = useWalletStore()
const installed = ref<{ key: string; name: string; installed: boolean; icon?: string }[]>([])
const busyKey = ref<string | null>(null)
const bridgeBusy = ref(false)

const installedWallets = computed(() => installed.value.filter((w) => w.installed))
const primaryKey = computed(() => installedWallets.value[0]?.key ?? 'eternl')
const otherInstalled = computed(() => installedWallets.value.slice(1))
const hasNoWallet = computed(() => installed.value.length > 0 && installedWallets.value.length === 0)
const eternlMeta = computed(() => KNOWN_WALLETS.find((w) => w.key === 'eternl'))

const isIframeBridge = computed(() => wallet.isIframeMode)
const bridgeHasAddress = computed(() => wallet.walletKey === 'hydraone' && !!wallet.address)

const isBusy = computed(() => props.restoring || wallet.status === 'connecting' || busyKey.value !== null || bridgeBusy.value)
const networkText = computed(() => (wallet.network === 'mainnet' ? 'Mainnet' : 'Preprod (Testnet)'))

onMounted(async () => {
  installed.value = await wallet.detectInstalledWallets()
})

async function connect(key: string) {
  if (isBusy.value) return
  busyKey.value = key
  try {
    await wallet.connectWallet(key)
  } finally {
    busyKey.value = null
  }
}

/** Trong iframe HydraOne: ví đã kết nối ở thanh trên, chỉ cần ký xác thực để mở phiên. */
async function authenticateBridge() {
  if (isBusy.value) return
  bridgeBusy.value = true
  try {
    wallet.setError(null)
    const bridge = useHydraOneWallet()
    await bridge.init().catch(() => {})
    const addr = wallet.address || (await bridge.refreshAddress().catch(() => null))
    if (!addr) {
      wallet.setError('wallet_locked')
      return
    }
    const ok = await wallet.loginWithHydraBridge(addr)
    if (!ok) wallet.setError('sign_failed')
  } finally {
    bridgeBusy.value = false
  }
}
</script>

<template>
  <div class="w-full h-full bg-[#100e0c] flex items-center justify-center px-4 select-none">
    <div class="w-full max-w-[440px] bg-[#1a1714] border border-[#332d26] rounded-[2px] shadow-2xl p-6 space-y-5">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full border border-[#c9a24b] flex items-center justify-center shrink-0">
          <ZenIcon name="wallet" :size="20" class="text-[#c9a24b]" />
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-bold text-[#f0e6d2] m-0 leading-snug">Vạn Cảnh Thiền Tự</h1>
          <p class="text-xs text-[#9c9283] mt-1 m-0 leading-relaxed">
            Kết nối ví Cardano để vào chùa. Chữ ký chỉ chứng minh quyền sở hữu ví, không tốn phí và không gửi giao dịch.
          </p>
        </div>
      </div>

      <div
        v-if="wallet.errorMessage"
        class="bg-[#26221d] border border-[#f6465d]/70 rounded-[2px] px-3 py-2 flex items-start gap-2"
        role="alert"
      >
        <ZenIcon name="circle-alert" :size="16" class="text-[#f6465d] shrink-0 mt-0.5" />
        <span class="text-xs font-semibold text-[#f6465d] leading-snug">{{ wallet.errorMessage }}</span>
      </div>

      <!-- Đang khôi phục phiên -->
      <div v-if="props.restoring" class="flex items-center gap-2 text-xs text-[#f0e6d2]">
        <ZenIcon name="loader-circle" :size="16" class="text-[#c9a24b]" />
        <span>Đang kiểm tra phiên đăng nhập ví...</span>
      </div>

      <!-- Luồng iframe HydraOne -->
      <template v-else-if="isIframeBridge">
        <p class="text-xs text-[#f0e6d2] leading-relaxed m-0">
          <template v-if="bridgeHasAddress">
            Ví HydraOne đã kết nối. Bấm bên dưới để ký xác thực và vào chùa.
          </template>
          <template v-else>
            Hãy kết nối ví ở thanh HydraOne phía trên, sau đó bấm xác thực.
          </template>
        </p>
        <UiButton variant="primary" block :loading="bridgeBusy" @click="authenticateBridge">
          Xác thực chữ ký ví
        </UiButton>
      </template>

      <!-- Luồng ví trình duyệt (CIP-30) -->
      <template v-else>
        <div v-if="hasNoWallet" class="bg-[#26221d] border border-[#332d26] rounded-[2px] px-3 py-2.5 space-y-1.5">
          <p class="text-xs text-[#f0e6d2] leading-relaxed m-0">
            Chưa phát hiện ví Cardano trong trình duyệt. Cài đặt Eternl hoặc Lace rồi tải lại trang.
          </p>
          <a
            v-if="eternlMeta"
            :href="eternlMeta.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs font-semibold text-[#c9a24b] hover:text-[#b58f3a]"
          >
            Tải ví {{ eternlMeta.name }}
          </a>
        </div>

        <UiButton
          variant="primary"
          block
          :loading="busyKey === primaryKey || wallet.status === 'connecting'"
          :disabled="isBusy && busyKey !== primaryKey"
          @click="connect(primaryKey)"
        >
          Kết nối ví
        </UiButton>

        <div v-if="otherInstalled.length" class="space-y-2">
          <p class="text-xs text-[#9c9283] m-0">Hoặc chọn ví khác</p>
          <div class="grid grid-cols-2 gap-2">
            <UiButton
              v-for="w in otherInstalled"
              :key="w.key"
              variant="secondary"
              :loading="busyKey === w.key"
              :disabled="isBusy && busyKey !== w.key"
              @click="connect(w.key)"
            >
              {{ w.name }}
            </UiButton>
          </div>
        </div>
      </template>

      <div class="flex items-center justify-between gap-2 pt-1 border-t border-[#332d26]">
        <span class="text-xs text-[#9c9283]">Mạng: <span class="text-[#f0e6d2] font-semibold">{{ networkText }}</span></span>
        <span class="text-xs text-[#9c9283] inline-flex items-center gap-1">
          <ZenIcon name="shield" :size="12" />
          Không lưu khóa riêng
        </span>
      </div>
    </div>
  </div>
</template>
