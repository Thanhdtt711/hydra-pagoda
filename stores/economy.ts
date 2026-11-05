import { defineStore } from 'pinia'
import { useCardsStore } from './cards'
import { useWalletStore } from './wallet'

export interface ShopCatalogItemDto {
  id: string
  name: string
  subname: string
  category: 'attire' | 'offering' | 'heritage_card'
  countryCode: string
  countryId?: string
  priceMc: number
  consumable: boolean
  defaultUnlocked: boolean
  icon: string
}

export interface InventoryItemDto {
  itemId: string
  category: 'attire' | 'offering' | 'heritage_card'
  quantity: number
  unlockedAt: number
}

export interface MeritLeaderboardEntry {
  displayName: string
  address: string
  totalMc: number
  donationCount: number
  lastAt: number
}

export interface RecentDonationDto {
  id: number
  displayName: string
  amountMc: number
  prayer: string
  rewardItemId: string | null
  receiptHash: string
  createdAt: number
}

export function createClientRequestId(prefix = 'req'): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

export const useEconomyStore = defineStore('economy', {
  state: () => ({
    /** Số dư MC thật trên server (1 ADA = 1.000 MC). Client không bao giờ tự cộng/trừ. */
    meritCoins: 0,
    karmaPoints: 0,
    globalMeritTotal: 1_084_200,
    globalDonationCount: 0,
    shopCatalog: [] as ShopCatalogItemDto[],
    fortuneTiers: {
      basic: { id: 'basic', name: 'Sơ Tâm Tùy Duyên', badge: 'Quẻ Cơ Bản', description: 'Quẻ thường, lời khuyên chánh niệm cơ bản', costMc: 10 },
      auspicious: { id: 'auspicious', name: 'Linh Tự Chiêu Tài', badge: 'Phổ Biến', description: 'Luận giải chi tiết 4 phương diện & phương pháp chuyển hóa', costMc: 50 },
      golden: { id: 'golden', name: 'Thượng Thượng Hoàng Kim', badge: 'Kim Quyển', description: 'Dấu triện khai quang đỏ, ưu tiên quẻ đại cát & biên nhận sổ cái', costMc: 100 }
    } as Record<'basic' | 'auspicious' | 'golden', { id: string; name: string; badge: string; description: string; costMc: number }>,
    meritConfig: {
      minMc: 10,
      maxMc: 1_000_000,
      suggestedAmountsMc: [50, 100, 500, 1000] as number[]
    },
    inventory: [
      { itemId: 'vietnam', category: 'attire', quantity: 1, unlockedAt: 0 },
      { itemId: 'japan', category: 'attire', quantity: 1, unlockedAt: 0 },
      { itemId: 'card_vn_truclam', category: 'heritage_card', quantity: 1, unlockedAt: 0 },
      { itemId: 'card_jp_ichigo', category: 'heritage_card', quantity: 1, unlockedAt: 0 },
      { itemId: 'card_vn_motcot', category: 'heritage_card', quantity: '1' as unknown as number, unlockedAt: 0 }
    ] as InventoryItemDto[],
    leaderboard: [] as MeritLeaderboardEntry[],
    recentDonations: [] as RecentDonationDto[],
    fortuneHistory: [] as Array<Record<string, any>>,
    ledgerHistory: [] as Array<Record<string, any>>,
    isLoadingCatalog: false,
    isSpending: false,
    /** Tín hiệu mở modal Ví Cardano ở tab "Mua MC" khi bấm nút "Nạp MC" từ các màn hình khác */
    topUpModalSignal: 0
  }),

  getters: {
    attireCatalog: (state) => state.shopCatalog.filter(i => i.category === 'attire'),
    offeringCatalog: (state) => state.shopCatalog.filter(i => i.category === 'offering'),
    heritageCardCatalog: (state) => state.shopCatalog.filter(i => i.category === 'heritage_card'),
    cardCatalog: (state) => state.shopCatalog.filter(i => i.category === 'heritage_card'),
    ownedItemIds: (state) => new Set(state.inventory.filter(i => i.quantity > 0).map(i => i.itemId))
  },

  actions: {
    openTopUpModal() {
      this.topUpModalSignal++
    },

    async fetchCatalog() {
      return this.loadCatalog()
    },

    isItemUnlocked(item: { id: string; defaultUnlocked?: boolean }): boolean {
      if (item.defaultUnlocked) return true
      return this.isUnlocked(item.id)
    },

    syncBalanceFromServer(mcBalance: number) {
      if (Number.isFinite(mcBalance) && mcBalance >= 0) {
        this.meritCoins = Math.floor(mcBalance)
        const wallet = useWalletStore()
        wallet.mcBalance = this.meritCoins
      }
    },

    isUnlocked(itemId: string): boolean {
      const cat = this.shopCatalog.find(i => i.id === itemId)
      if (cat?.defaultUnlocked) return true
      return this.inventory.some(inv => inv.itemId === itemId && inv.quantity > 0)
    },

    getItemQuantity(itemId: string): number {
      const found = this.inventory.find(inv => inv.itemId === itemId)
      return found ? Number(found.quantity || 0) : 0
    },

    getItemPriceMc(itemId: string, fallback = 0): number {
      const found = this.shopCatalog.find(i => i.id === itemId)
      return found ? found.priceMc : fallback
    },

    syncCardsStore() {
      try {
        const cardsStore = useCardsStore()
        for (const c of cardsStore.allCards) {
          const owned = this.inventory.find(inv => inv.itemId === c.id)
          const catItem = this.shopCatalog.find(i => i.id === c.id)
          if (owned) {
            c.unlockedAt = owned.unlockedAt || Date.now()
          } else if (catItem && !catItem.defaultUnlocked) {
            c.unlockedAt = null
          }
        }
      } catch { /* ignore */ }
    },

    async loadCatalog() {
      this.isLoadingCatalog = true
      try {
        const data = await $fetch<{
          authenticated: boolean
          account: { mcBalance: number } | null
          shopCatalog: ShopCatalogItemDto[]
          fortuneTiers: Record<'basic' | 'auspicious' | 'golden', any>
          meritConfig: { minMc: number; maxMc: number; suggestedAmountsMc: number[] }
          globalMeritTotal: number
          globalDonationCount: number
          leaderboard: MeritLeaderboardEntry[]
          recentDonations: RecentDonationDto[]
          inventory: InventoryItemDto[]
          fortuneHistory: Array<Record<string, any>>
          ledgerHistory: Array<Record<string, any>>
        }>('/api/mc/catalog')

        if (Array.isArray(data.shopCatalog)) this.shopCatalog = data.shopCatalog
        if (data.fortuneTiers) this.fortuneTiers = data.fortuneTiers
        if (data.meritConfig) this.meritConfig = data.meritConfig
        if (typeof data.globalMeritTotal === 'number') this.globalMeritTotal = data.globalMeritTotal
        if (typeof data.globalDonationCount === 'number') this.globalDonationCount = data.globalDonationCount
        if (Array.isArray(data.leaderboard)) this.leaderboard = data.leaderboard
        if (Array.isArray(data.recentDonations)) this.recentDonations = data.recentDonations
        if (Array.isArray(data.inventory)) this.inventory = data.inventory
        if (Array.isArray(data.fortuneHistory)) this.fortuneHistory = data.fortuneHistory
        if (Array.isArray(data.ledgerHistory)) this.ledgerHistory = data.ledgerHistory
        if (data.account && typeof data.account.mcBalance === 'number') {
          this.syncBalanceFromServer(data.account.mcBalance)
        }
        this.syncCardsStore()
      } catch (e) {
        console.warn('[economy] Không tải được danh mục MC từ server:', e)
      } finally {
        this.isLoadingCatalog = false
      }
    },

    /**
     * Mua vật phẩm Cửa Hàng / Thẻ Bài Di Sản bằng MC trên server.
     * Bắt buộc đi qua `POST /api/mc/shop/buy` (hàm nguyên tử `spend`).
     */
    async buyShopItem(itemId: string, requestId?: string) {
      const reqId = requestId || createClientRequestId('shop')
      this.isSpending = true
      try {
        const res = await $fetch<{
          ok: boolean
          idempotentReplay: boolean
          ledgerId: number
          spentMc: number
          mcBalance: number
          item: ShopCatalogItemDto
          quantity: number
          unlockedAt: number
          inventory: InventoryItemDto[]
        }>('/api/mc/shop/buy', {
          method: 'POST',
          body: { itemId, requestId: reqId }
        })

        this.syncBalanceFromServer(res.mcBalance)
        if (Array.isArray(res.inventory)) {
          this.inventory = res.inventory
          this.syncCardsStore()
        }
        return res
      } finally {
        this.isSpending = false
      }
    },

    /**
     * Gieo quẻ Bói Quẻ & Cầu An 6 môn bằng MC trên server.
     * Kết quả sinh tại server qua `POST /api/mc/fortune/draw`.
     */
    async drawFortune(category: string, tier: 'basic' | 'auspicious' | 'golden', requestId?: string) {
      const reqId = requestId || createClientRequestId('fortune')
      this.isSpending = true
      try {
        const res = await $fetch<{
          ok: boolean
          idempotentReplay: boolean
          ledgerId: number
          spentMc: number
          mcBalance: number
          fortune: any
          receiptHash: string
        }>('/api/mc/fortune/draw', {
          method: 'POST',
          body: { category, tier, requestId: reqId }
        })

        this.syncBalanceFromServer(res.mcBalance)
        this.fortuneHistory.unshift({
          id: res.ledgerId,
          requestId: reqId,
          category,
          tier,
          costMc: res.spentMc,
          receiptHash: res.receiptHash,
          createdAt: Date.now(),
          fortune: res.fortune
        })
        return res
      } finally {
        this.isSpending = false
      }
    },

    /**
     * Cúng dường Hòm Công Đức bằng MC trên server (`POST /api/mc/merit/donate`).
     */
    async donateMerit(amountMc: number, prayer: string, requestId?: string) {
      const reqId = requestId || createClientRequestId('merit')
      this.isSpending = true
      try {
        const res = await $fetch<{
          ok: boolean
          idempotentReplay: boolean
          ledgerId: number
          spentMc: number
          mcBalance: number
          donation: {
            amountMc: number
            prayer: string
            receiptHash: string
            rewardItemId: string | null
            rewardItemName: string | null
            globalMeritTotal: number
            blessing: string
          }
          globalMeritTotal: number
          leaderboard: MeritLeaderboardEntry[]
          recentDonations: RecentDonationDto[]
          inventory: InventoryItemDto[]
        }>('/api/mc/merit/donate', {
          method: 'POST',
          body: { amountMc, prayer, requestId: reqId }
        })

        this.syncBalanceFromServer(res.mcBalance)
        this.karmaPoints += Math.max(1, Math.floor(res.spentMc / 10))
        if (typeof res.globalMeritTotal === 'number') this.globalMeritTotal = res.globalMeritTotal
        if (Array.isArray(res.leaderboard)) this.leaderboard = res.leaderboard
        if (Array.isArray(res.recentDonations)) this.recentDonations = res.recentDonations
        if (Array.isArray(res.inventory)) {
          this.inventory = res.inventory
          this.syncCardsStore()
        }
        return res
      } finally {
        this.isSpending = false
      }
    }
  }
})
