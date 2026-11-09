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

export interface MeditationPlanDto {
  durationMin: number
  durationSec: number
  rewardMc: number
}

export interface MeditationStatusDto {
  plans: MeditationPlanDto[]
  dailyCapMc: number
  dailyEarnedMc: number
  remainingDailyMc: number
  occupiedSlotIds: number[]
  totalSlots: number
}

export interface MeditationStartDto {
  ok: boolean
  sessionToken: string
  slotId: number | null
  durationMin: number
  durationSec: number
  rewardMc: number
  startedAt: number
  targetEndAt: number
  dailyCapMc: number
  dailyEarnedMc: number
  remainingDailyMc: number
}

export interface MeditationCompleteDto {
  ok: boolean
  sessionToken: string
  durationMin: number
  expectedRewardMc: number
  creditedMc: number
  dailyCapReached: boolean
  ledgerId: number | null
  mcBalance: number
  dailyEarnedMc: number
  dailyCapMc: number
  idempotentReplay: boolean
  hydra?: { enabled: boolean; status: string; txHash: string | null; snapshotNo: number | null } | null
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
    globalMeritTotal: 0,
    globalDonationCount: 0,
    shopCatalog: [] as ShopCatalogItemDto[],
    fortuneTiers: {
      basic: { id: 'basic', name: 'Thỉnh Quẻ Cầu An', badge: '50 MC / Lượt', description: 'Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày', costMc: 50 },
      auspicious: { id: 'auspicious', name: 'Thỉnh Quẻ Cầu An', badge: '50 MC / Lượt', description: 'Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày', costMc: 50 },
      golden: { id: 'golden', name: 'Thỉnh Quẻ Cầu An', badge: '50 MC / Lượt', description: 'Luận giải chi tiết 4 khối & phương pháp chuyển hóa theo Seed ngày', costMc: 50 }
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
    lastFortuneHydra: null as null | { enabled: boolean; status: string; txHash: string | null; snapshotNo: number | null; receiptHash: string },
    lastMeritHydra: null as null | { enabled: boolean; status: string; txHash: string | null; snapshotNo: number | null; receiptHash: string },
    lastShopHydra: null as null | { enabled: boolean; status: string; txHash: string | null; snapshotNo: number | null },
    recentDonations: [] as RecentDonationDto[],
    fortuneHistory: [] as Array<Record<string, any>>,
    ledgerHistory: [] as Array<Record<string, any>>,
    dailyFreeUsedByCategory: {
      stick: 0,
      love: 0,
      family: 0,
      wealth: 0,
      health: 0,
      star: 0
    } as Record<string, number>,
    isLoadingCatalog: false,
    isSpending: false,
    /** Tọa thiền nhận MC: gói thời lượng, trần ngày & tiến độ do server quyết định (client chỉ hiển thị). */
    meditation: {
      plans: [
        { durationMin: 3, durationSec: 180, rewardMc: 15 },
        { durationMin: 5, durationSec: 300, rewardMc: 30 },
        { durationMin: 15, durationSec: 900, rewardMc: 80 },
        { durationMin: 30, durationSec: 1800, rewardMc: 150 }
      ] as MeditationPlanDto[],
      dailyCapMc: 200,
      dailyEarnedMc: 0,
      occupiedSlotIds: [] as number[],
      totalSlots: 0
    },
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
          dailyFreeUsedByCategory?: Record<string, number>
          meditation?: MeditationStatusDto
        }>('/api/mc/catalog')

        if (data.meditation) this.applyMeditationStatus(data.meditation)
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
        if (data.dailyFreeUsedByCategory && typeof data.dailyFreeUsedByCategory === 'object') {
          this.dailyFreeUsedByCategory = {
            ...this.dailyFreeUsedByCategory,
            ...data.dailyFreeUsedByCategory
          }
        }
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
        this.lastShopHydra = (res as any).hydra ?? null
        return res
      } finally {
        this.isSpending = false
      }
    },

    /**
     * Gieo quẻ Bói Quẻ & Cầu An 6 môn bằng MC trên server.
     * Kết quả sinh tại server qua `POST /api/mc/fortune/draw`.
     */
    async drawFortune(
      category: string,
      tier: 'basic' | 'auspicious' | 'golden',
      requestId?: string,
      boiOptions?: {
        mode?: 'quick' | 'preset' | 'profile' | 'custom'
        questionId?: string
        customQuestion?: string
        profile?: Record<string, any> | null
        partnerProfile?: Record<string, any> | null
        paymentMode?: 'free_daily' | 'offering_item' | 'mc'
        offeringItemId?: string
      }
    ) {
      const reqId = requestId || createClientRequestId('fortune')
      this.isSpending = true
      try {
        const res = await $fetch<{
          ok: boolean
          idempotentReplay: boolean
          ledgerId: number
          spentMc: number
          paymentMode?: 'free_daily' | 'offering_item' | 'mc'
          offeringItemId?: string | null
          mcBalance: number
          fortune: any
          receiptHash: string
          inventory?: InventoryItemDto[]
          dailyFreeUsedByCategory?: Record<string, number>
        }>('/api/mc/fortune/draw', {
          method: 'POST',
          body: {
            category,
            tier,
            requestId: reqId,
            ...(boiOptions || {})
          }
        })

        this.syncBalanceFromServer(res.mcBalance)
        if (Array.isArray(res.inventory)) {
          this.inventory = res.inventory
        }
        if (res.dailyFreeUsedByCategory && typeof res.dailyFreeUsedByCategory === 'object') {
          this.dailyFreeUsedByCategory = {
            ...this.dailyFreeUsedByCategory,
            ...res.dailyFreeUsedByCategory
          }
        }
        const hy = (res as any).hydra
        this.lastFortuneHydra = hy ? { ...hy, receiptHash: res.receiptHash } : null
        this.fortuneHistory.unshift({
          id: res.ledgerId,
          hydra: hy ?? null,
          requestId: reqId,
          category,
          tier,
          costMc: res.spentMc,
          paymentMode: res.paymentMode || 'mc',
          offeringItemId: res.offeringItemId || null,
          receiptHash: res.receiptHash,
          createdAt: Date.now(),
          fortune: res.fortune
        })
        if (this.fortuneHistory.length > 30) {
          this.fortuneHistory = this.fortuneHistory.slice(0, 30)
        }
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
        const hy = (res as any).hydra
        this.lastMeritHydra = hy ? { ...hy, receiptHash: res.donation.receiptHash } : null
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
    },

    /* ======================= TỌA THIỀN NHẬN MC ======================= */

    applyMeditationStatus(status: Partial<MeditationStatusDto>) {
      const m = this.meditation
      if (Array.isArray(status.plans) && status.plans.length > 0) m.plans = status.plans
      if (typeof status.dailyCapMc === 'number') m.dailyCapMc = status.dailyCapMc
      if (typeof status.dailyEarnedMc === 'number') m.dailyEarnedMc = status.dailyEarnedMc
      if (Array.isArray(status.occupiedSlotIds)) m.occupiedSlotIds = status.occupiedSlotIds
      if (typeof status.totalSlots === 'number') m.totalSlots = status.totalSlots
    },

    /** Tải hạn mức MC thiền trong ngày và danh sách bồ đoàn đang có đồng tu ngồi (khách cũng gọi được). */
    async loadMeditationStatus() {
      const data = await $fetch<MeditationStatusDto & { authenticated: boolean }>('/api/mc/meditation/status')
      this.applyMeditationStatus(data)
      return data
    },

    /** Mở phiên tọa thiền trên server (giữ bồ đoàn + bắt đầu đồng hồ chống tua giờ). */
    async startMeditation(durationMin: number, slotId: number | null) {
      const res = await $fetch<MeditationStartDto>('/api/mc/meditation/start', {
        method: 'POST',
        body: { durationMin, ...(slotId !== null ? { slotId } : {}) }
      })
      this.meditation.dailyCapMc = res.dailyCapMc
      this.meditation.dailyEarnedMc = res.dailyEarnedMc
      return res
    },

    /** Nhận thưởng khi hết giờ: số MC do server quyết định, client chỉ đồng bộ lại số dư. */
    async completeMeditation(sessionToken: string) {
      const res = await $fetch<MeditationCompleteDto>('/api/mc/meditation/complete', {
        method: 'POST',
        body: { sessionToken }
      })
      this.syncBalanceFromServer(res.mcBalance)
      this.meditation.dailyEarnedMc = res.dailyEarnedMc
      this.meditation.dailyCapMc = res.dailyCapMc
      if (res.creditedMc > 0) this.karmaPoints += Math.max(1, Math.floor(res.creditedMc / 10))
      return res
    },

    /** Xả thiền sớm: server hủy phiên, nhả chỗ ngồi, không cộng MC. */
    async cancelMeditation(sessionToken: string) {
      return await $fetch<{ ok: boolean; cancelled: boolean }>('/api/mc/meditation/cancel', {
        method: 'POST',
        body: { sessionToken }
      })
    }
  }
})
