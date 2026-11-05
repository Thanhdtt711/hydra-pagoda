import { defineStore } from 'pinia'
import { getOrCreateEphemeralKey } from '~/lib/cardano/ephemeralKey'
import {
  classifyCip30Error, decodeLovelace, getInjected, hexToBech32, utf8ToHex, waitForInjected,
  WALLET_ERROR_TEXT, type Cip30Api, type WalletErrorCode
} from '~/lib/cardano/cip30'
import { useEconomyStore } from '~/stores/economy'

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
}

// Đối tượng không tuần tự hóa được: giữ ngoài state của Pinia.
let walletApi: Cip30Api | null = null
let watchTimer: ReturnType<typeof setInterval> | null = null
let focusCheck: (() => void) | null = null
let accountPollTimer: ReturnType<typeof setInterval> | null = null
let orderPollTimer: ReturnType<typeof setInterval> | null = null
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
    confirmationsRequired: 1
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

    /** Tự kết nối lại khi tải trang: cần phiên server còn hạn VÀ ví vẫn bật cùng tài khoản. */
    async restore() {
      await this.loadNetwork()
      if (this.restored) return
      try {
        const me = await $fetch<{ authenticated: boolean; account?: AuthAccount }>('/api/auth/me')
        if (!me.authenticated || !me.account) return
        let key: string | null = null
        try { key = localStorage.getItem(HINT_KEY) } catch { /* bỏ qua */ }
        const injected = key ? await waitForInjected(key) : null
        if (!key || !injected) {
          await this.dropSession('session_lost')
          return
        }
        // enable() đã được người dùng cấp quyền trước đó sẽ không bật popup; bị khóa/tắt → ném lỗi.
        const api = await injected.enable()
        const networkId = await api.getNetworkId()
        const ok = networkId === this.expectedNetworkId && (await this.walletOwnsAddress(api, me.account.address))
        if (!ok) {
          await this.dropSession(networkId !== this.expectedNetworkId ? 'network_changed' : 'account_changed')
          return
        }
        walletApi = api
        this.walletKey = key
        this.walletName = injected.name || key
        this.networkId = networkId
        this.applyAccount(me.account)
        await this.refreshAdaBalance()
        await this.fetchOrders()
        await useEconomyStore().loadCatalog()
        this.startWatchers()
      } catch {
        await this.dropSession('session_lost')
      } finally {
        this.restored = true
      }
    },

    /** Địa chỉ của phiên có còn thuộc tài khoản đang bật trong ví? */
    async walletOwnsAddress(api: Cip30Api, bech32Addr: string): Promise<boolean> {
      const used = await api.getUsedAddresses()
      const list = [...(used || [])]
      try { list.push(await api.getChangeAddress()) } catch { /* bỏ qua */ }
      return list.some(h => hexToBech32(h) === bech32Addr)
    },

    async refreshAdaBalance() {
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
      if (!this.isConnected || !walletApi) {
        this.setError('session_lost')
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

    /** Poll nhẹ: phát hiện đổi tài khoản/mạng/khóa ví (CIP-30 không có sự kiện chuẩn) + cập nhật số dư MC. */
    startWatchers() {
      this.stopWatchers()
      const check = async () => {
        if (!walletApi || !this.address) return
        try {
          const networkId = await walletApi.getNetworkId()
          if (networkId !== this.expectedNetworkId) return void (await this.dropSession('network_changed'))
          if (!(await this.walletOwnsAddress(walletApi, this.address))) return void (await this.dropSession('account_changed'))
          await this.refreshAdaBalance()
        } catch {
          // Ví bị khóa/tắt extension: đăng xuất an toàn thay vì giữ phiên "ma".
          await this.dropSession('session_lost')
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
