import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const catalogPath = resolve('data/cards/catalog.json')
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))

test('1. Kiểm tra cấu trúc Catalog Thẻ Bài Di Sản', () => {
  assert.ok(catalog.cards.length >= 16, `Số lượng thẻ phải >= 16, hiện có ${catalog.cards.length}`)
  
  const countries = new Set(catalog.cards.map(c => c.countryCode))
  assert.ok(countries.has('VN'), 'Phải có thẻ Việt Nam')
  assert.ok(countries.has('JP'), 'Phải có thẻ Nhật Bản')
  assert.ok(countries.has('TH'), 'Phải có thẻ Thái Lan')
  assert.ok(countries.has('KR'), 'Phải có thẻ Hàn Quốc')

  const rarities = new Set(catalog.cards.map(c => c.rarity))
  assert.ok(rarities.has('common'), 'Phải có thẻ Common')
  assert.ok(rarities.has('rare'), 'Phải có thẻ Rare')
  assert.ok(rarities.has('epic'), 'Phải có thẻ Epic')
  assert.ok(rarities.has('legendary'), 'Phải có thẻ Legendary')

  assert.strictEqual(catalog.packs.length, 3, 'Phải có đúng 3 gói thẻ Gacha')
})

function rollRarity(rates = catalog.rarityRates) {
  const rand = Math.random()
  let accum = 0
  accum += rates.legendary
  if (rand < accum) return 'legendary'
  accum += rates.epic
  if (rand < accum) return 'epic'
  accum += rates.rare
  if (rand < accum) return 'rare'
  return 'common'
}

test('2. Mô phỏng 10.000 lượt roll ngẫu nhiên (Phân phối xác suất)', () => {
  const runs = 10000
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 }

  for (let i = 0; i < runs; i++) {
    const r = rollRarity()
    counts[r]++
  }

  const pCommon = counts.common / runs
  const pRare = counts.rare / runs
  const pEpic = counts.epic / runs
  const pLegendary = counts.legendary / runs

  console.log(`\n--- KẾT QUẢ MÔ PHỎNG ${runs} LƯỢT ROLL ---`)
  console.log(`Common: ${(pCommon * 100).toFixed(2)}% (Mục tiêu: 60%)`)
  console.log(`Rare: ${(pRare * 100).toFixed(2)}% (Mục tiêu: 25%)`)
  console.log(`Epic: ${(pEpic * 100).toFixed(2)}% (Mục tiêu: 12%)`)
  console.log(`Legendary: ${(pLegendary * 100).toFixed(2)}% (Mục tiêu: 3%)`)

  assert.ok(Math.abs(pCommon - 0.60) < 0.03, 'Common nằm trong sai số cho phép ±3%')
  assert.ok(Math.abs(pRare - 0.25) < 0.025, 'Rare nằm trong sai số cho phép ±2.5%')
  assert.ok(Math.abs(pEpic - 0.12) < 0.02, 'Epic nằm trong sai số cho phép ±2%')
  assert.ok(Math.abs(pLegendary - 0.03) < 0.015, 'Legendary nằm trong sai số cho phép ±1.5%')
})

const RARITY_RANK = { common: 1, rare: 2, epic: 3, legendary: 4 }

function simulatePackRoll(cardCount, guaranteedRarity) {
  const results = []
  for (let i = 0; i < cardCount; i++) {
    results.push(rollRarity())
  }
  if (guaranteedRarity) {
    const minRank = RARITY_RANK[guaranteedRarity]
    const hasGuarantee = results.some(r => RARITY_RANK[r] >= minRank)
    if (!hasGuarantee) {
      results[results.length - 1] = guaranteedRarity
    }
  }
  return results
}

test('3. Kiểm tra bảo hiểm Gói Ngũ Uẩn (5 thẻ >= 1 Rare)', () => {
  const runs = 1000
  for (let i = 0; i < runs; i++) {
    const pack = simulatePackRoll(5, 'rare')
    const hasRarePlus = pack.some(r => RARITY_RANK[r] >= RARITY_RANK.rare)
    assert.ok(hasRarePlus, '100% gói Ngũ Uẩn phải có ít nhất 1 thẻ Rare+')
  }
})

test('4. Kiểm tra bảo hiểm Gói Bát Nhã Hoàng Kim (10 thẻ >= 1 Epic)', () => {
  const runs = 1000
  for (let i = 0; i < runs; i++) {
    const pack = simulatePackRoll(10, 'epic')
    const hasEpicPlus = pack.some(r => RARITY_RANK[r] >= RARITY_RANK.epic)
    assert.ok(hasEpicPlus, '100% gói Bát Nhã phải có ít nhất 1 thẻ Epic+')
  }
})

