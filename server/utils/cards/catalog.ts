import catalogData from '../../../data/cards/catalog.json' with { type: 'json' }

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CardCategory = 'wisdom' | 'architecture'

export interface BuddhistCardItem {
  id: string
  title: string
  subtitle: string
  country: string
  countryCode: string
  category: CardCategory
  rarity: CardRarity
  meaning: string
  lore: string
  scriptureText?: string
  audioNarrator?: string
  tags?: string[]
}

export interface CardPackItem {
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

export interface RarityRates {
  common: number
  rare: number
  epic: number
  legendary: number
}

const RARITY_ORDER: Record<CardRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4
}

export function getCardsCatalog(): BuddhistCardItem[] {
  return catalogData.cards as BuddhistCardItem[]
}

export function getCardPacks(): CardPackItem[] {
  return catalogData.packs as CardPackItem[]
}

export function getCardById(id: string): BuddhistCardItem | undefined {
  return (catalogData.cards as BuddhistCardItem[]).find(c => c.id === id)
}

export function getCardPackById(packId: string): CardPackItem | undefined {
  return (catalogData.packs as CardPackItem[]).find(p => p.id === packId)
}

/**
 * Rút bậc hiếm ngẫu nhiên theo trọng số xác suất chuẩn (RNG Weighted)
 */
export function rollRarity(rates: RarityRates = catalogData.rarityRates): CardRarity {
  const rand = Math.random()
  let accum = 0

  // Thử theo thứ tự từ hiếm nhất đến phổ thông nhất để đảm bảo độ chính xác
  accum += rates.legendary
  if (rand < accum) return 'legendary'

  accum += rates.epic
  if (rand < accum) return 'epic'

  accum += rates.rare
  if (rand < accum) return 'rare'

  return 'common'
}

/**
 * Rút bậc hiếm với điều kiện tối thiểu (Bảo hiểm phẩm cấp)
 */
export function rollGuaranteedRarity(minRarity: CardRarity, rates: RarityRates = catalogData.rarityRates): CardRarity {
  const minRank = RARITY_ORDER[minRarity]
  
  // Tính tổng trọng số của các bậc đạt yêu cầu
  const eligibleRarities: CardRarity[] = (['rare', 'epic', 'legendary'] as CardRarity[]).filter(
    r => RARITY_ORDER[r] >= minRank
  )

  let totalWeight = 0
  for (const r of eligibleRarities) {
    totalWeight += rates[r]
  }

  const rand = Math.random() * totalWeight
  let accum = 0
  for (const r of eligibleRarities) {
    accum += rates[r]
    if (rand < accum) return r
  }

  return minRarity
}

/**
 * Lấy ngẫu nhiên một thẻ bài theo phẩm cấp chỉ định
 */
export function pickRandomCardByRarity(rarity: CardRarity, excludeIds: Set<string> = new Set()): BuddhistCardItem {
  const allCards = getCardsCatalog()
  const matching = allCards.filter(c => c.rarity === rarity)
  
  if (matching.length === 0) {
    return allCards[Math.floor(Math.random() * allCards.length)]!
  }

  // Ưu tiên các thẻ chưa bị trùng trong lượt mở này
  const nonExcluded = matching.filter(c => !excludeIds.has(c.id))
  const pool = nonExcluded.length > 0 ? nonExcluded : matching
  
  const picked = pool[Math.floor(Math.random() * pool.length)]!
  return picked
}

/**
 * Thuật toán mở gói thẻ bài Gacha với cơ chế bảo hiểm
 */
export function rollCardGacha(packId: string): BuddhistCardItem[] {
  const pack = getCardPackById(packId)
  if (!pack) {
    throw new Error(`Gói thẻ không tồn tại: ${packId}`)
  }

  const results: BuddhistCardItem[] = []
  const pickedIds = new Set<string>()

  // 1. Rút các thẻ thông thường
  for (let i = 0; i < pack.cardCount; i++) {
    const rolledRarity = rollRarity()
    const card = pickRandomCardByRarity(rolledRarity, pickedIds)
    results.push(card)
    pickedIds.add(card.id)
  }

  // 2. Áp dụng cơ chế bảo hiểm (Guaranteed Rarity)
  if (pack.guaranteedRarity) {
    const requiredRank = RARITY_ORDER[pack.guaranteedRarity]
    const hasMetGuarantee = results.some(c => RARITY_ORDER[c.rarity] >= requiredRank)

    if (!hasMetGuarantee && results.length > 0) {
      // Thay thế thẻ cuối cùng bằng thẻ đạt chuẩn bảo hiểm
      const guaranteedRarity = rollGuaranteedRarity(pack.guaranteedRarity)
      const replacementCard = pickRandomCardByRarity(guaranteedRarity, pickedIds)
      results[results.length - 1] = replacementCard
    }
  }

  return results
}
