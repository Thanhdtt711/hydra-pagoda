import { defineStore } from 'pinia'
import { watch } from 'vue'
import { getOrCreateEphemeralKey } from '~/lib/cardano/ephemeralKey'
import {
  classifyCip30Error, decodeLovelace, getInjected, hexToBech32, utf8ToHex, waitForInjected,
  WALLET_ERROR_TEXT, type Cip30Api, type WalletErrorCode
} from '~/lib/cardano/cip30'
import { useEconomyStore } from '~/stores/economy'
import { useHydraOneWallet } from '~/composables/useHydraOneWallet'

export interface WalletMeta {
  key: string
  name: string
  url: string
  accent: string
}

export const KNOWN_WALLETS: WalletMeta[] = [
  { key: 'eternl', name: 'Eternl', url: 'https://eternl.io/', accent: '#ff7a2f' },
  { key: 'lace', name: 'Lace', url: 'https://www.lace.io/', accent: '#7c6cff' },
  { key: 'nami', name: 'Nami', url: 'https://namiwallet.io/', accent: '#00d2aa' },
  { key: 'flint', name: 'Flint', url: 'https://flint-wallet.com/', accent: '#dc2626' },
  { key: 'vespr', name: 'Vespr (Mobile)', url: 'https://vespr.xyz/', accent: '#0284c7' }
]

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface AuthAccount {
  id: number
  address: string
  displayName: string
  mcBalance: number
}

export type OrderStatus =
  | 'pending'
  | 'signing'
  | 'submitted'
  | 'confirming'
  | 'completed'
  | 'expired'
  | 'underpaid'
  | 'expired_paid'
  | 'failed'

export interface ShopOrderDto {
  orderId: string
  accountId: number
  address: string
  treasuryAddress: string
  expectedLovelace: number
  expectedAda: number
  expectedMc: number
  receivedLovelace: number | null
  creditedMc: number | null
  txHash: string | null
  unsignedTxHash: string | null
  blockHeight: number | null
  confirmations: number
  confirmationsRequired: number
  status: OrderStatus
  failureReason: string | null
  createdAt: number
  expiresAt: number
  submittedAt: number | null
  completedAt: number | null
  explorerUrl: string | null
}

export type PurchasePhase =
  | 'idle'
  | 'creating_order'
  | 'awaiting_signature'
  | 'submitting_tx'
  | 'awaiting_confirmation'
  | 'completed'
  | 'error'

export interface WalletState {
  status: ConnectionStatus
  walletKey: string | null
  walletName: string | null
  /** Địa chỉ bech32 ĐÃ được server xác minh bằng chữ ký (rỗng khi chưa đăng nhập) */
  address: string | null
  stakeAddress: string | null
  /** Số dư ADA thật đọc từ ví (CIP-30 getBalance), chỉ để hiển thị */
  balanceLovelace: bigint
  networkId: number | null
  isHydraConnected: boolean
  lastTxHash: string | null
  accountId: number | null
  displayName: string | null
  /** Số dư MC thật từ server (số nguyên) */
  mcBalance: number
  errorCode: WalletErrorCode | null
  errorMessage: string | null
  /** 'preprod' | 'mainnet' theo cấu hình server */
  network: 'preprod' | 'mainnet'
  restored: boolean
  /** Danh sách đơn mua MC & lịch sử nạp từ server */
  orders: ShopOrderDto[]
  /** Đơn mua MC hiện tại đang theo dõi */
  activeOrder: ShopOrderDto | null
  purchasePhase: PurchasePhase
  purchaseStatusText: string
  treasuryAddress: string
  confirmationsRequired: number
  /** Chạy trong môi trường iframe của HydraOne Portal */
  isIframeMode: boolean
}

// Đối tượng không tuần tự hóa được: giữ ngoài state của Pinia.
let walletApi: Cip30Api | null = null
let watchTimer: ReturnType<typeof setInterval> | null = null
let focusCheck: (() => void) | null = null
let accountPollTimer: ReturnType<typeof setInterval> | null = null
let orderPollTimer: ReturnType<typeof setInterval> | null = null
let bridgeInitialized = false
const HINT_KEY = 'pagoda_wallet_hint' // chỉ là gợi ý tên ví để tự kết nối lại; KHÔNG phải token xác thực

export const useWalletStore = defineStore('wallet', {
  state: (): WalletState => ({
    status: 'disconnected',
    walletKey: null,
    walletName: null,
    address: null,
    stakeAddress: null,
    balanceLovelace: 0n,
    networkId: null,
    isHydraConnected: false,
    lastTxHash: null,
    accountId: null,
    displayName: null,
    mcBalance: 0,
    errorCode: null,
    errorMessage: null,
    network: 'preprod',
    restored: false,
    orders: [],
    activeOrder: null,
    purchasePhase: 'idle',
    purchaseStatusText: '',
    treasuryAddress: '',
    confirmationsRequired: 1,
    isIframeMode: typeof window !== 'undefined' && window.parent !== window
  }),

  getters: {
    adaBalance(state): string {
      const ada = Number(state.balanceLovelace) / 1_000_000
      return ada.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
    },
    shortAddress(state): string {
      if (!state.address) return ''
      return `${state.address.slice(0, 9)}...${state.address.slice(-4)}`
    },
    isConnected(state): boolean {
      return state.status === 'connected' && !!state.address
    },
    isAuthenticated(state): boolean {
      return state.status === 'connected' && !!state.address
    },
    isTestnet(state): boolean {
      return state.network !== 'mainnet'
    },
    expectedNetworkId(state): number {
      return state.network === 'mainnet' ? 1 : 0
    },
    networkLabel(state): string {
      return state.network === 'mainnet' ? 'MAINNET' : 'TESTNET'
    },
    explorerBase(state): string {
      return state.network === 'mainnet' ? 'https://cardanoscan.io' : 'https://preprod.cardanoscan.io'
    }
  },

  actions: {
    async detectInstalledWallets(): Promise<{ key: string; name: string; installed: boolean; icon?: string }[]> {
      if (typeof window === 'undefined') return []
      return KNOWN_WALLETS.map(w => {
        const injected = getInjected(w.key)
        return { key: w.key, name: w.name, installed: !!injected, icon: injected?.icon }
      })
    },

    setError(code: WalletErrorCode | null, extra?: string) {
      this.errorCode = code
      this.errorMessage = code ? (extra ? `${WALLET_ERROR_TEXT[code]} ${extra}` : WALLET_ERROR_TEXT[code]) : null
    },

    /** Áp dụng tài khoản server vào store + đồng bộ số dư MC sang economy (hiển thị thanh trên). */
    applyAccount(acc: AuthAccount) {
      this.accountId = acc.id
      this.address = acc.address
      this.displayName = acc.displayName
      this.mcBalance = acc.mcBalance
      this.status = 'connected'
      this.isHydraConnected = false
      useEconomyStore().meritCoins = acc.mcBalance
    },

    /** Đọc cấu hình mạng từ server (nguồn duy nhất) để client luôn khớp. */
    async loadNetwork() {
      try {
        const cfg = useRuntimeConfig()
        const n = String(cfg.public.cardanoNetwork || 'preprod')
        this.network = n === 'mainnet' ? 'mainnet' : 'preprod'
      } catch { /* giữ mặc định preprod */ }
    },

    /**
     * Kết nối + đăng nhập: enable() → kiểm tra mạng → xin nonce → signData → server verify.
     * Trả true nếu đã có phiên hợp lệ. Mọi lỗi thân thiện nằm ở `errorCode/errorMessage`.
     */
    async connectWallet(key: string): Promise<boolean> {
      await this.loadNetwork()
      this.setError(null)
      this.status = 'connecting'
      this.walletKey = key

      const injected = getInjected(key)
      if (!injected) {
        this.status = 'disconnected'
        this.setError('not_installed')
        return false
      }

      let api: Cip30Api
      try {
        api = await injected.enable()
      } catch (e: any) {
        this.status = 'disconnected'
        this.setError(classifyCip30Error(e, 'user_declined'))
        return false
      }

      try {
        const networkId = await api.getNetworkId()
        this.networkId = networkId
        if (networkId !== this.expectedNetworkId) {
          this.status = 'disconnected'
          this.setError('wrong_network', this.network === 'mainnet'
            ? 'Game đang chạy Mainnet; hãy chuyển ví sang Mainnet.'
            : 'Game đang chạy Preprod (testnet); hãy chuyển Eternl sang Preprod trong phần Cài đặt → Mạng.')
          return false
        }

        const used = await api.getUsedAddresses()
        const addrHex = used?.[0] || (await api.getChangeAddress())
        const address = hexToBech32(addrHex)

        // Địa chỉ chỉ là LỜI KHAI; server chỉ chấp nhận sau khi chữ ký chứng minh quyền sở hữu.
        const issued = await $fetch<{ nonce: string; message: string }>('/api/auth/nonce', { method: 'POST', body: { address } })

        let signed: { signature: string; key: string }
        try {
          signed = await api.signData(addrHex, utf8ToHex(issued.message))
        } catch (e: any) {
          this.status = 'disconnected'
          this.setError(classifyCip30Error(e, 'sign_failed'))
          return false
        }

        const res = await $fetch<{ account: AuthAccount }>('/api/auth/verify', {
          method: 'POST',
          body: { address, nonce: issued.nonce, signature: signed.signature, key: signed.key }
        })

        walletApi = api
        this.walletName = injected.name || key
        this.applyAccount(res.account)
        try { localStorage.setItem(HINT_KEY, key) } catch { /* bỏ qua */ }
        getOrCreateEphemeralKey()
        await this.refreshAdaBalance()
        await this.fetchOrders()
        await useEconomyStore().loadCatalog()
        this.startWatchers()
        return true
      } catch (e: any) {
        this.status = 'disconnected'
        const code = e?.data?.data?.code || e?.data?.code
        if (code === 'wrong_network') this.setError('wrong_network')
        else this.setError('server_error', code === 'rate_limited' ? '(Thao tác quá nhanh, hãy đợi một chút.)' : '')
        return false
      }
    },

    /**
     * Tự động đăng nhập qua HydraOne Wallet Bridge khi chạy trong Iframe.
     * Xin nonce từ server -> gọi bridge.signData -> server verify -> tạo phiên JWT.
     */
    async loginWithHydraBridge(targetAddress: string): Promise<boolean> {
      if (!targetAddress) return false
      await this.loadNetwork()
      this.setError(null)
      this.status = 'connecting'
      this.walletKey = 'hydraone'
      this.walletName = 'HydraOne'

      try {
        const issued = await $fetch<{ nonce: string; message: string }>('/api/auth/nonce', {
          method: 'POST',
          body: { address: targetAddress }
        })

        const bridge = useHydraOneWallet()
        let signed: { signature: string; key: string }
        try {
          signed = await bridge.signData(targetAddress, utf8ToHex(issued.message))
        } catch (signErr: any) {
          this.status = 'disconnected'
          this.setError('sign_failed')
          return false
        }

        const res = await $fetch<{ account: AuthAccount }>('/api/auth/verify', {
          method: 'POST',
          body: {
            address: targetAddress,
            nonce: issued.nonce,
            signature: signed.signature,
            key: signed.key
          }
        })

        this.applyAccount(res.account)
        if (bridge.balanceLovelace.value !== null) {
          this.balanceLovelace = bridge.balanceLovelace.value
        }
        getOrCreateEphemeralKey()
        await this.fetchOrders()
        await useEconomyStore().loadCatalog()
        this.startWatchers()
        return true
      } catch (err: any) {
        this.status = 'disconnected'
        this.setError('server_error')
        return false
      }
    },

    /**
     * Khởi tạo bộ lắng nghe sự kiện đổi ví hoặc ngắt kết nối từ Header của HydraOne.
     */
    initHydraBridgeWatcher() {
      if (typeof window === 'undefined' || !this.isIframeMode || bridgeInitialized) return
      bridgeInitialized = true
      const bridge = useHydraOneWallet()

      watch(
        () => [bridge.isWalletConnected.value, bridge.address.value] as const,
        async ([connected, newAddr]) => {
          if (connected && newAddr) {
            // Khi có ví mới trên Header mà khác với địa chỉ hiện tại trong game -> tự động đổi tài khoản
            if (this.address !== newAddr) {
              await this.loginWithHydraBridge(newAddr)
            } else if (bridge.balanceLovelace.value !== null) {
              this.balanceLovelace = bridge.balanceLovelace.value
            }
          } else if (!connected && this.walletKey === 'hydraone') {
            // Khi người dùng bấm ngắt kết nối trên Header HydraOne
            await this.disconnect()
          }
        },
        { immediate: true }
      )
    },

    /** Tự kết nối lại khi tải trang: khôi phục ngay phiên từ cookie httpOnly trên server, sau đó đồng bộ CIP-30 nền. */
    async restore() {
      await this.loadNetwork()
      if (this.restored) return

      // Nếu đang chạy trong Iframe của HydraOne Portal
      if (this.isIframeMode) {
        this.initHydraBridgeWatcher()
        try {
          const me = await $fetch<{ authenticated: boolean; account?: AuthAccount }>('/api/auth/me')
          const bridge = useHydraOneWallet()

          if (me.authenticated && me.account) {
            this.walletKey = 'hydraone'
            this.walletName = 'HydraOne'
            this.applyAccount(me.account)
            if (bridge.balanceLovelace.value !== null) {
              this.balanceLovelace = bridge.balanceLovelace.value
            }
            await this.fetchOrders()
            await useEconomyStore().loadCatalog()
            this.startWatchers()

            // Nếu ví trên Header HydraOne khác với session cũ -> tự đăng nhập theo ví Header
            if (bridge.address.value && bridge.address.value !== me.account.address) {
              await this.loginWithHydraBridge(bridge.address.value)
            }
          } else if (bridge.isWalletConnected.value && bridge.address.value) {
            await this.loginWithHydraBridge(bridge.address.value)
          }
        } catch {
          // Lỗi mạng tạm thời: không chặn tải trang
        } finally {
          this.restored = true
        }
        return
      }

      // Luồng Standalone (ngoài Iframe): Giữ nguyên logic CIP-30 hiện tại
      try {
        const me = await $fetch<{ authenticated: boolean; account?: AuthAccount }>('/api/auth/me')
        if (!me.authenticated || !me.account) return

        let key: string | null = null
        try { key = localStorage.getItem(HINT_KEY) } catch { /* bỏ qua */ }
        if (!key) {
          key = 'eternl'
          try { localStorage.setItem(HINT_KEY, key) } catch { /* bỏ qua */ }
        }

        // 1. Khôi phục NGAY tài khoản đã xác thực từ phiên server để tải lại trang (F5) không bao giờ mất ví
        this.walletKey = key
        this.walletName = KNOWN_WALLETS.find(w => w.key === key)?.name || 'Eternl'
        this.applyAccount(me.account)
        await this.fetchOrders()
        await useEconomyStore().loadCatalog()
        this.startWatchers()

        // 2. Thử kết nối lại CIP-30 extension ở hậu cảnh để đọc số dư ADA và kiểm tra đổi ví/mạng
        const injected = await waitForInjected(key, 4000)
        if (!injected) return

        try {
          const api = await injected.enable()
          const networkId = await api.getNetworkId()
          if (networkId !== this.expectedNetworkId) {
            await this.dropSession('network_changed')
            return
          }
          const ownership = await this.walletOwnsAddress(api, me.account.address)
          if (ownership === 'mismatch') {
            await this.dropSession('account_changed')
            return
          }
          walletApi = api
          this.walletName = injected.name || this.walletName
          this.networkId = networkId
          await this.refreshAdaBalance()
        } catch {
          // Service worker của Eternl có thể đang ngủ khi vừa F5: giữ nguyên phiên server, sẽ tự gắn lại khi thao tác
        }
      } catch {
        // Lỗi mạng tạm thời khi gọi /api/auth/me: không xóa phiên
      } finally {
        this.restored = true
      }
    },

    /**
     * Kiểm tra địa chỉ của phiên có còn thuộc tài khoản đang bật trong ví không.
     * Trả về:
     * - 'match': tìm thấy địa chỉ khớp
     * - 'unknown': ví chưa trả danh sách địa chỉ (đang khởi tạo) -> không tự ý đăng xuất
     * - 'mismatch': ví trả danh sách địa chỉ hợp lệ nhưng thuộc tài khoản khác -> đăng xuất an toàn
     */
    async walletOwnsAddress(api: Cip30Api, bech32Addr: string): Promise<'match' | 'unknown' | 'mismatch'> {
      const hexSet = new Set<string>()
      try {
        const used = await api.getUsedAddresses()
        for (const h of used || []) if (h) hexSet.add(h)
      } catch { /* bỏ qua */ }
      try {
        const unused = await api.getUnusedAddresses?.()
        for (const h of unused || []) if (h) hexSet.add(h)
      } catch { /* bỏ qua */ }
      try {
        const change = await api.getChangeAddress()
        if (change) hexSet.add(change)
      } catch { /* bỏ qua */ }

      if (hexSet.size === 0) return 'unknown'
      for (const h of hexSet) {
        try {
          if (hexToBech32(h) === bech32Addr) return 'match'
        } catch { /* bỏ qua địa chỉ lỗi định dạng */ }
      }
      return 'mismatch'
    },

    async refreshAdaBalance() {
      if (this.isIframeMode) {
        try {
          const bridge = useHydraOneWallet()
          await bridge.refreshBalance()
          if (bridge.balanceLovelace.value !== null) {
            this.balanceLovelace = bridge.balanceLovelace.value
          }
        } catch { /* không chặn vì lỗi hiển thị số dư */ }
        return
      }
      if (!walletApi) return
      try {
        this.balanceLovelace = decodeLovelace(await walletApi.getBalance())
      } catch { /* không chặn đăng nhập vì lỗi hiển thị số dư */ }
    },

    /**
     * Tải danh sách đơn mua MC & lịch sử nạp từ server.
     * Nếu có đơn đang ở trạng thái chờ xác nhận (kể cả khi người chơi vừa tải lại trang),
     * tự động khôi phục trạng thái hiển thị và bật bộ poll theo dõi.
     */
    async fetchOrders() {
      if (!this.accountId) return
      try {
        const res = await $fetch<{
          orders: ShopOrderDto[]
          packages: { treasuryAddress: string; confirmationsRequired: number }
          account: AuthAccount
        }>('/api/shop/orders')
        this.orders = res.orders || []
        this.treasuryAddress = res.packages?.treasuryAddress || ''
        this.confirmationsRequired = res.packages?.confirmationsRequired || 1
        if (res.account) {
          this.applyAccount(res.account)
        }
        const inFlight = this.orders.find(o => ['submitted', 'confirming'].includes(o.status))
        if (inFlight) {
          this.activeOrder = inFlight
          this.purchasePhase = 'awaiting_confirmation'
          this.purchaseStatusText = inFlight.status === 'confirming'
            ? `Đang chờ xác nhận trên chuỗi (${inFlight.confirmations}/${inFlight.confirmationsRequired})...`
            : 'Đã gửi giao dịch — đang chờ đưa vào block trên chuỗi...'
          this.startOrderPolling(inFlight.orderId)
        } else if (this.activeOrder) {
          const updated = this.orders.find(o => o.orderId === this.activeOrder!.orderId)
          if (updated) {
            this.activeOrder = updated
            if (updated.status === 'completed') {
              this.purchasePhase = 'completed'
              this.purchaseStatusText = `Hoàn tất! Đã cộng +${(updated.creditedMc ?? updated.expectedMc).toLocaleString()} MC vào tài khoản.`
            }
          }
        }
      } catch { /* bỏ qua lỗi mạng tạm thời */ }
    },

    /**
     * Thực hiện luồng mua MC coin bằng ADA (Bước 3):
     * 1. Tạo đơn trên server (`POST /api/shop/orders`).
     * 2. Lấy UTxO từ ví Eternl & nhờ server dựng giao dịch chưa ký bằng `@hydra-sdk/cardano-wasm` (`POST /build`).
     * 3. Yêu cầu người chơi ký giao dịch trong ví (`wallet.signTx(unsignedTxCbor, true)`).
     * 4. Ghép witness chữ ký trên server (`POST /witness`) & gửi lên mạng Cardano (`wallet.submitTx`).
     * 5. Báo `txHash` cho server (`POST /submit`) và theo dõi cho tới khi đủ xác nhận.
     */
    async buyMcWithAda(adaAmount: number): Promise<boolean> {
      this.setError(null)
      if (!this.isConnected) {
        this.setError('session_lost')
        return false
      }

      // Xử lý riêng cho chế độ Iframe HydraOne khi không có extension CIP-30 trực tiếp
      if (this.isIframeMode && !walletApi) {
        const bridge = useHydraOneWallet()
        if (!bridge.isWalletConnected.value || !bridge.address.value) {
          this.setError('wallet_locked')
          this.purchasePhase = 'error'
          this.purchaseStatusText = 'Vui lòng kết nối ví trên thanh Header của HydraOne để tiếp tục.'
          return false
        }

        const cleanAda = Math.floor(Number(adaAmount))
        if (!Number.isSafeInteger(cleanAda) || cleanAda < 2 || cleanAda > 100_000) {
          this.purchasePhase = 'error'
          this.purchaseStatusText = 'Số lượng mua tối thiểu là 2 ADA (số nguyên).'
          return false
        }

        try {
          // Bước 1: Tạo đơn trên server
          this.purchasePhase = 'creating_order'
          this.purchaseStatusText = 'Đang khởi tạo đơn hàng & dựng giao dịch Cardano...'
          const created = await $fetch<{ order: ShopOrderDto }>('/api/shop/orders', {
            method: 'POST',
            body: { adaAmount: cleanAda }
          })
          this.activeOrder = created.order

          // Bước 2: Đọc UTxO từ ví thông qua HydraOne Bridge
          const utxos = (await bridge.client.getUtxos()) ?? []
          if (!utxos.length) {
            this.purchasePhase = 'error'
            this.purchaseStatusText = 'Ví của bạn chưa có UTxO (ADA) nào để thanh toán.'
            this.setError('tx_insufficient_funds')
            return false
          }
          const changeAddress = bridge.address.value || (await bridge.client.getChangeAddress())

          const built = await $fetch<{
            order: ShopOrderDto
            unsignedTxCbor: string
            txHash: string
            feeLovelace: number
          }>(`/api/shop/orders/${created.order.orderId}/build`, {
            method: 'POST',
            body: { utxos, changeAddress }
          })
          this.activeOrder = built.order

          // Bước 3: Ký qua HydraOne Bridge
          this.purchasePhase = 'awaiting_signature'
          this.purchaseStatusText = `Đang chờ bạn ký xác nhận giao dịch ${cleanAda} ADA trên ví HydraOne...`
          let witnessHex = ''
          try {
            witnessHex = await bridge.signTx(built.unsignedTxCbor, true)
          } catch (signErr: any) {
            this.purchasePhase = 'error'
            const errCode = classifyCip30Error(signErr, 'tx_submit_failed')
            this.setError(errCode)
            this.purchaseStatusText = 'Ký giao dịch bị từ chối hoặc thất bại trên HydraOne.'
            return false
          }

          // Bước 4: Ghép witness trên server & submitTx qua bridge
          this.purchasePhase = 'submitting_tx'
          this.purchaseStatusText = 'Đã ký — đang phát tán giao dịch lên mạng Cardano...'
          const attached = await $fetch<{ signedTxCbor: string; txHash: string }>(
            `/api/shop/orders/${created.order.orderId}/witness`,
            { method: 'POST', body: { witnessHex } }
          )

          let submittedHash = ''
          try {
            submittedHash = await bridge.submitTx(attached.signedTxCbor)
          } catch (subErr: any) {
            this.purchasePhase = 'error'
            this.setError('tx_submit_failed')
            this.purchaseStatusText = `Gửi giao dịch lên mạng thất bại: ${subErr?.message || 'Lỗi mạng'}`
            return false
          }

          const finalHash = (submittedHash || attached.txHash).trim().toLowerCase()
          this.lastTxHash = finalHash

          // Bước 5: Ghi nhận txHash với server và theo dõi
          const subRes = await $fetch<{ order: ShopOrderDto; account: AuthAccount }>(
            `/api/shop/orders/${created.order.orderId}/submit`,
            { method: 'POST', body: { txHash: finalHash } }
          )
          this.activeOrder = subRes.order
          if (subRes.account) this.applyAccount(subRes.account)
          await this.fetchOrders()

          if (subRes.order.status === 'completed') {
            this.purchasePhase = 'completed'
            this.purchaseStatusText = `Hoàn tất! Đã cộng +${(subRes.order.creditedMc ?? subRes.order.expectedMc).toLocaleString()} MC.`
            await this.refreshAdaBalance()
            return true
          }

          this.purchasePhase = 'awaiting_confirmation'
          this.purchaseStatusText = `Đã gửi giao dịch (${finalHash.slice(0, 10)}...) — đang chờ xác nhận trên chuỗi (${subRes.order.confirmations}/${subRes.order.confirmationsRequired})...`
          this.startOrderPolling(subRes.order.orderId)
          return true
        } catch (e: any) {
          this.purchasePhase = 'error'
          const msg = e?.data?.data?.message || e?.data?.message || e?.message || 'Không thể xử lý đơn hàng'
          this.purchaseStatusText = msg
          return false
        }
      }

      // Luồng Standalone (CIP-30 trực tiếp qua extension)
      if (!walletApi) {
        const injected = getInjected(this.walletKey || 'eternl')
        if (injected) {
          try { walletApi = await injected.enable() } catch { /* xử lý bên dưới */ }
        }
      }
      if (!walletApi) {
        this.setError('wallet_locked')
        return false
      }
      const cleanAda = Math.floor(Number(adaAmount))
      if (!Number.isSafeInteger(cleanAda) || cleanAda < 2 || cleanAda > 100_000) {
        this.purchasePhase = 'error'
        this.purchaseStatusText = 'Số lượng mua tối thiểu là 2 ADA (số nguyên).'
        return false
      }

      try {
        // Bước 1: Tạo đơn trên server
        this.purchasePhase = 'creating_order'
        this.purchaseStatusText = 'Đang khởi tạo đơn hàng & dựng giao dịch Cardano...'
        const created = await $fetch<{ order: ShopOrderDto }>('/api/shop/orders', {
          method: 'POST',
          body: { adaAmount: cleanAda }
        })
        this.activeOrder = created.order

        // Bước 2: Đọc UTxO từ ví & dựng giao dịch chưa ký trên server
        const utxos = (await walletApi.getUtxos?.()) ?? []
        if (!utxos.length) {
          this.purchasePhase = 'error'
          this.purchaseStatusText = 'Ví của bạn chưa có UTxO (ADA) nào để thanh toán.'
          this.setError('tx_insufficient_funds')
          return false
        }
        const changeAddress = await walletApi.getChangeAddress()

        const built = await $fetch<{
          order: ShopOrderDto
          unsignedTxCbor: string
          txHash: string
          feeLovelace: number
        }>(`/api/shop/orders/${created.order.orderId}/build`, {
          method: 'POST',
          body: { utxos, changeAddress }
        })
        this.activeOrder = built.order

        // Bước 3: Yêu cầu người chơi ký trong ví Eternl
        this.purchasePhase = 'awaiting_signature'
        this.purchaseStatusText = `Đang chờ bạn ký xác nhận giao dịch ${cleanAda} ADA trong ví ${this.walletName || 'Eternl'}...`
        let witnessHex = ''
        try {
          witnessHex = await walletApi.signTx(built.unsignedTxCbor, true)
        } catch (signErr: any) {
          this.purchasePhase = 'error'
          const errCode = classifyCip30Error(signErr, 'tx_submit_failed')
          this.setError(errCode)
          this.purchaseStatusText = WALLET_ERROR_TEXT[errCode]
          return false
        }

        // Bước 4: Ghép witness trên server & submitTx qua ví
        this.purchasePhase = 'submitting_tx'
        this.purchaseStatusText = 'Đã ký — đang phát tán giao dịch lên mạng Cardano...'
        const attached = await $fetch<{ signedTxCbor: string; txHash: string }>(
          `/api/shop/orders/${created.order.orderId}/witness`,
          { method: 'POST', body: { witnessHex } }
        )

        let submittedHash = ''
        try {
          submittedHash = await walletApi.submitTx(attached.signedTxCbor)
        } catch (subErr: any) {
          this.purchasePhase = 'error'
          this.setError('tx_submit_failed')
          this.purchaseStatusText = `Gửi giao dịch lên mạng thất bại: ${subErr?.info || subErr?.message || 'Lỗi mạng'}`
          return false
        }

        const finalHash = (submittedHash || attached.txHash).trim().toLowerCase()
        this.lastTxHash = finalHash

        // Bước 5: Ghi nhận txHash với server và chuyển sang chờ xác nhận trên chuỗi
        const subRes = await $fetch<{ order: ShopOrderDto; account: AuthAccount }>(
          `/api/shop/orders/${created.order.orderId}/submit`,
          { method: 'POST', body: { txHash: finalHash } }
        )
        this.activeOrder = subRes.order
        if (subRes.account) this.applyAccount(subRes.account)
        await this.fetchOrders()

        if (subRes.order.status === 'completed') {
          this.purchasePhase = 'completed'
          this.purchaseStatusText = `Hoàn tất! Đã cộng +${(subRes.order.creditedMc ?? subRes.order.expectedMc).toLocaleString()} MC.`
          await this.refreshAdaBalance()
          return true
        }

        this.purchasePhase = 'awaiting_confirmation'
        this.purchaseStatusText = `Đã gửi giao dịch (${finalHash.slice(0, 10)}...) — đang chờ xác nhận trên chuỗi (${subRes.order.confirmations}/${subRes.order.confirmationsRequired})...`
        this.startOrderPolling(subRes.order.orderId)
        return true
      } catch (e: any) {
        this.purchasePhase = 'error'
        const msg = e?.data?.data?.message || e?.data?.message || e?.message || 'Không thể xử lý đơn hàng'
        this.purchaseStatusText = msg
        return false
      }
    },

    /** Theo dõi đơn hàng đang chờ xác nhận mỗi 5 giây cho tới khi hoàn tất hoặc lỗi. */
    startOrderPolling(orderId: string) {
      this.stopOrderPolling()
      const poll = async () => {
        if (!this.accountId) return this.stopOrderPolling()
        try {
          const res = await $fetch<{ order?: ShopOrderDto; account?: AuthAccount }>(`/api/shop/orders/${orderId}`)
          if (res.account) this.applyAccount(res.account)
          if (res.order) {
            this.activeOrder = res.order
            const idx = this.orders.findIndex(o => o.orderId === res.order!.orderId)
            if (idx >= 0) this.orders[idx] = res.order
            else this.orders.unshift(res.order)

            if (res.order.status === 'completed') {
              this.purchasePhase = 'completed'
              this.purchaseStatusText = `Hoàn tất! Đã cộng +${(res.order.creditedMc ?? res.order.expectedMc).toLocaleString()} MC vào tài khoản.`
              this.stopOrderPolling()
              await this.refreshAdaBalance()
            } else if (['underpaid', 'expired', 'expired_paid', 'failed'].includes(res.order.status)) {
              this.purchasePhase = 'error'
              this.purchaseStatusText = res.order.failureReason || `Đơn hàng kết thúc với trạng thái: ${res.order.status}`
              this.stopOrderPolling()
            } else {
              this.purchasePhase = 'awaiting_confirmation'
              this.purchaseStatusText = res.order.status === 'confirming'
                ? `Đang chờ đủ xác nhận trên chuỗi (${res.order.confirmations}/${res.order.confirmationsRequired})...`
                : 'Đã gửi giao dịch — đang chờ đưa vào block trên chuỗi...'
            }
          }
        } catch { /* mất mạng tạm thời: giữ bộ đếm để tự thử lại ở chu kỳ sau */ }
      }
      orderPollTimer = setInterval(poll, 5000)
    },

    stopOrderPolling() {
      if (orderPollTimer) clearInterval(orderPollTimer)
      orderPollTimer = null
    },

    /** Poll nhẹ: phát hiện đổi tài khoản/mạng (CIP-30 không có sự kiện chuẩn) + cập nhật số dư MC. */
    startWatchers() {
      this.stopWatchers()
      const check = async () => {
        if (!this.address) return
        try {
          if (!walletApi) {
            const injected = getInjected(this.walletKey || 'eternl')
            if (injected) walletApi = await injected.enable()
          }
          if (!walletApi) return
          const networkId = await walletApi.getNetworkId()
          if (networkId !== this.expectedNetworkId) return void (await this.dropSession('network_changed'))
          const ownership = await this.walletOwnsAddress(walletApi, this.address)
          if (ownership === 'mismatch') return void (await this.dropSession('account_changed'))
          await this.refreshAdaBalance()
        } catch {
          // Service worker ví tạm nghỉ (MV3 idle): không tự hủy phiên server của người chơi
          walletApi = null
        }
      }
      watchTimer = setInterval(check, 8000)
      if (typeof window !== 'undefined') window.addEventListener('focus', check)
      focusCheck = check
      accountPollTimer = setInterval(() => { void this.refreshAccount() }, 15000)
    },

    stopWatchers() {
      if (watchTimer) clearInterval(watchTimer)
      if (accountPollTimer) clearInterval(accountPollTimer)
      watchTimer = null
      accountPollTimer = null
      this.stopOrderPolling()
      if (focusCheck && typeof window !== 'undefined') window.removeEventListener('focus', focusCheck)
      focusCheck = null
    },

    /** Làm mới số dư MC thật từ server; phát hiện phiên hết hạn. */
    async refreshAccount() {
      try {
        const me = await $fetch<{ authenticated: boolean; account?: AuthAccount }>('/api/auth/me')
        if (!me.authenticated || !me.account) return void (await this.dropSession('session_lost'))
        this.mcBalance = me.account.mcBalance
        useEconomyStore().meritCoins = me.account.mcBalance
      } catch { /* lỗi mạng tạm thời: giữ nguyên, thử lại lần sau */ }
    },

    /** Xin vé WS một lần để server gắn kết nối đa người chơi với tài khoản đã xác thực. */
    async fetchWsTicket(): Promise<string | null> {
      if (!this.accountId) return null
      try {
        return (await $fetch<{ ticket: string }>('/api/auth/ws-ticket', { method: 'POST' })).ticket
      } catch { return null }
    },

    /** Đăng xuất do sự cố (đổi tài khoản/mạng, ví khóa, phiên hết hạn) kèm lý do thân thiện. */
    async dropSession(reason: WalletErrorCode) {
      await this.disconnect()
      this.setError(reason)
    },

    /** Ngắt kết nối: hủy phiên server + xóa trạng thái cục bộ. */
    async disconnect() {
      this.stopWatchers()
      try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch { /* vẫn xóa cục bộ */ }
      walletApi = null
      try { localStorage.removeItem(HINT_KEY) } catch { /* bỏ qua */ }
      this.status = 'disconnected'
      this.walletKey = null
      this.walletName = null
      this.address = null
      this.stakeAddress = null
      this.accountId = null
      this.displayName = null
      this.mcBalance = 0
      this.balanceLovelace = 0n
      this.orders = []
      this.activeOrder = null
      this.purchasePhase = 'idle'
      this.purchaseStatusText = ''
      useEconomyStore().meritCoins = 0
      void useEconomyStore().loadCatalog()
    }
  }
})
