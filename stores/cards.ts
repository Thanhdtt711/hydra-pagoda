import { defineStore } from 'pinia'
import catalogData from '../data/cards/catalog.json' with { type: 'json' }
import { useEconomyStore } from './economy'

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CardCategory = 'wisdom' | 'architecture'
export type CountryFilter = 'all' | 'VN' | 'JP' | 'TH' | 'KR'
export type RarityFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary'
export type OwnershipFilter = 'all' | 'owned' | 'unowned'

export interface BuddhistCard {
  id: string
  title: string
  subtitle: string
  category: CardCategory
  country: string
  countryCode: string
  rarity: CardRarity
  imageUrl?: string
  scriptureText?: string
  meaning: string
  lore: string
  audioNarrator?: string
  tags?: string[]
  unlockedAt: number | null
}

export interface CardPack {
  id: string
  name: string
  subtitle: string
  cardCount: number
  priceMc: number
  originalPriceMc?: number
  discountPercent?: number
  guaranteedRarity?: CardRarity | null
  badge?: string
  description: string
}

export interface UserCardRecord {
  card_id: string
  rarity: CardRarity
  count: number
  first_unlocked_at: number
  last_unlocked_at: number
}

const STORAGE_KEY_OFFLINE_CARDS = 'van_canh_offline_cards_v1'

function loadOfflineUnlocked(): Set<string> {
  if (typeof window === 'undefined') return new Set(['card_vn_motcot', 'card_vn_truclam', 'card_jp_ichigo'])
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_CARDS)
    if (raw) {
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr : [])
    }
  } catch (_) {}
  return new Set(['card_vn_motcot', 'card_vn_truclam', 'card_jp_ichigo'])
}

function saveOfflineUnlocked(set: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_OFFLINE_CARDS, JSON.stringify(Array.from(set)))
  } catch (_) {}
}

export const useCardsStore = defineStore('cards', {
  state: () => ({
    catalogCards: (catalogData.cards as any[]).map(c => ({
      ...c,
      unlockedAt: null
    })) as BuddhistCard[],
    packs: catalogData.packs as CardPack[],
    userInventory: [] as UserCardRecord[],
    offlineUnlockedIds: loadOfflineUnlocked(),
    isLoading: false,
    isOpening: false,
    selectedCard: null as BuddhistCard | null,
    filterCountry: 'all' as CountryFilter,
    filterRarity: 'all' as RarityFilter,
    filterOwnership: 'all' as OwnershipFilter,
    lastRevealedCards: [] as BuddhistCard[],
    showRevealModal: false,
    lastHydraProof: null as any
  }),

  getters: {
    // Thuộc tính tương thích ngược cho các component cũ
    allCards: (state) => {
      const owned = new Set([
        ...state.userInventory.map(i => i.card_id),
        ...Array.from(state.offlineUnlockedIds)
      ])
      return state.catalogCards.map(c => ({
        ...c,
        unlockedAt: owned.has(c.id) ? Date.now() : null
      }))
    },

    ownedCardIds(state): Set<string> {
      return new Set([
        ...state.userInventory.map(i => i.card_id),
        ...Array.from(state.offlineUnlockedIds)
      ])
    },

    isUnlocked: (state) => (id: string): boolean => {
      return (
        state.userInventory.some(i => i.card_id === id) ||
        state.offlineUnlockedIds.has(id)
      )
    },

    getCardCount: (state) => (id: string): number => {
      const item = state.userInventory.find(i => i.card_id === id)
      if (item) return item.count
      return state.offlineUnlockedIds.has(id) ? 1 : 0
    },

    unlockedList(): BuddhistCard[] {
      return this.allCards.filter(c => this.isUnlocked(c.id))
    },

    lockedList(): BuddhistCard[] {
      return this.allCards.filter(c => !this.isUnlocked(c.id))
    },

    // Danh sách thẻ bài sau khi áp dụng bộ lọc (Country, Rarity, Ownership)
    filteredCards(): BuddhistCard[] {
      return this.allCards.filter(c => {
        if (this.filterCountry !== 'all' && c.countryCode !== this.filterCountry) {
          return false
        }
        if (this.filterRarity !== 'all' && c.rarity !== this.filterRarity) {
          return false
        }
        if (this.filterOwnership === 'owned' && !this.isUnlocked(c.id)) {
          return false
        }
        if (this.filterOwnership === 'unowned' && this.isUnlocked(c.id)) {
          return false
        }
        return true
      })
    },

    // Thống kê tiến độ sưu tập tổng và theo từng quốc gia
    collectionStats(): {
      total: number
      owned: number
      percent: number
      byCountry: Record<string, { total: number; owned: number; percent: number }>
    } {
      const total = this.allCards.length
      const owned = this.allCards.filter(c => this.isUnlocked(c.id)).length
      const percent = total > 0 ? Math.round((owned / total) * 100) : 0

      const byCountry: Record<string, { total: number; owned: number; percent: number }> = {
        VN: { total: 0, owned: 0, percent: 0 },
        JP: { total: 0, owned: 0, percent: 0 },
        TH: { total: 0, owned: 0, percent: 0 },
        KR: { total: 0, owned: 0, percent: 0 }
      }

      for (const c of this.allCards) {
        if (byCountry[c.countryCode]) {
          byCountry[c.countryCode]!.total++
          if (this.isUnlocked(c.id)) {
            byCountry[c.countryCode]!.owned++
          }
        }
      }

      for (const k of Object.keys(byCountry)) {
        const item = byCountry[k]!
        item.percent = item.total > 0 ? Math.round((item.owned / item.total) * 100) : 0
      }

      return { total, owned, percent, byCountry }
    }
  },

  actions: {
    /**
     * Nạp catalog và kho thẻ đã sở hữu từ server
     */
    async fetchInventory() {
      this.isLoading = true
      try {
        const res = await $fetch<any>('/api/mc/cards/inventory')
        if (res && res.ok) {
          if (Array.isArray(res.userInventory)) {
            this.userInventory = res.userInventory
          }
          if (Array.isArray(res.packs)) {
            this.packs = res.packs
          }
        }
      } catch (err) {
        console.warn('[cards] fetchInventory failed, using fallback:', err)
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Mua và mở gói thẻ Gacha Pack qua API server
     */
    async openPack(packId: string) {
      this.isOpening = true
      const economy = useEconomyStore()
      try {
        const requestId = 'pack_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
        const res = await $fetch<any>('/api/mc/cards/pack-buy', {
          method: 'POST',
          body: { packId, requestId }
        })

        if (res && res.ok) {
          // 1. Cập nhật số dư MC
          if (typeof res.mcBalance === 'number') {
            economy.meritCoins = res.mcBalance
          }
          // 2. Cập nhật kho thẻ server
          if (Array.isArray(res.userCardInventory)) {
            this.userInventory = res.userCardInventory
          }
          // 3. Đồng bộ offline set
          if (Array.isArray(res.cards)) {
            res.cards.forEach((c: any) => this.offlineUnlockedIds.add(c.id))
            saveOfflineUnlocked(this.offlineUnlockedIds)
            this.lastRevealedCards = res.cards
          }
          // 4. Lưu proof Hydra L2
          this.lastHydraProof = res.hydra || null
          this.showRevealModal = true

          return res
        }
        throw new Error(res?.message || 'Không thể mở gói thẻ lúc này.')
      } catch (err: any) {
        throw err
      } finally {
        this.isOpening = false
      }
    },

    /**
     * Mở khóa đơn lẻ (tương thích backward compatibility)
     */
    unlockCard(id: string) {
      this.offlineUnlockedIds.add(id)
      saveOfflineUnlocked(this.offlineUnlockedIds)
      const existing = this.userInventory.find(i => i.card_id === id)
      if (existing) {
        existing.count++
      } else {
        const found = this.catalogCards.find(c => c.id === id)
        this.userInventory.push({
          card_id: id,
          rarity: found?.rarity || 'common',
          count: 1,
          first_unlocked_at: Date.now(),
          last_unlocked_at: Date.now()
        })
      }
      return true
    },

    setSelectedCard(card: BuddhistCard | null) {
      this.selectedCard = card
    },

    setFilterCountry(c: CountryFilter) {
      this.filterCountry = c
    },

    setFilterRarity(r: RarityFilter) {
      this.filterRarity = r
    },

    setFilterOwnership(o: OwnershipFilter) {
      this.filterOwnership = o
    },

    closeRevealModal() {
      this.showRevealModal = false
      this.lastRevealedCards = []
    }
  }
})

export const useCardStore = useCardsStore
