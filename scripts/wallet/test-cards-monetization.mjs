import test from 'node:test'
import assert from 'node:assert/strict'
import { getDb, withTransaction } from '../../server/utils/wallet/db.ts'
import { buyAndOpenCardPack, getUserCardInventory } from '../../server/utils/wallet/mcService.ts'
import { getCardPacks } from '../../server/utils/cards/catalog.ts'

test('1. Kiểm tra catalog gói thẻ phía server', () => {
  const packs = getCardPacks()
  assert.strictEqual(packs.length, 3, 'Phải có 3 gói thẻ')
  const nguUan = packs.find(p => p.id === 'pack_ngu_uan')
  assert.ok(nguUan, 'Phải có gói Ngũ Uẩn')
  assert.strictEqual(nguUan.priceMc, 2200)
  assert.strictEqual(nguUan.cardCount, 5)
  assert.strictEqual(nguUan.guaranteedRarity, 'rare')
})

test('2. Kịch bản mua và mở Gói Ngũ Uẩn (Gacha Loop & SQLite Ledger)', async () => {
  const db = await getDb()
  const now = Date.now()
  const testAddr = `addr_test_cards_${now}`

  // Tạo tài khoản test với số dư 5.000 MC
  const accRes = await db.prepare(`
    INSERT INTO accounts (address, display_name, mc_balance, created_at, last_login_at)
    VALUES (?, 'Test Pilgrim Cards', 5000, ?, ?)
  `).run(testAddr, now, now)

  const accountId = Number(accRes.lastInsertRowid)
  assert.ok(accountId > 0, 'Phải tạo được account test')

  // Mở gói Ngũ Uẩn (2.200 MC)
  const reqId = `req_pack_${now}`
  const openRes = await buyAndOpenCardPack(accountId, 'pack_ngu_uan', reqId)

  assert.strictEqual(openRes.spentMc, 2200, 'Phải trừ đúng 2.200 MC')
  assert.strictEqual(openRes.balanceAfter, 2800, 'Số dư sau mở phải còn 2.800 MC')
  assert.strictEqual(openRes.extra.cards.length, 5, 'Phải nhận đúng 5 thẻ')

  // Kiểm tra bảo hiểm ít nhất 1 thẻ Rare+
  const RARITY_RANK = { common: 1, rare: 2, epic: 3, legendary: 4 }
  const hasRarePlus = openRes.extra.cards.some(c => RARITY_RANK[c.rarity] >= 2)
  assert.ok(hasRarePlus, 'Phải đảm bảo ít nhất 1 thẻ Rare+')

  // Kiểm tra bảng card_inventory
  const invRows = await db.prepare('SELECT * FROM card_inventory WHERE account_id = ?').all(accountId)
  assert.strictEqual(invRows.length, 5, 'Bảng card_inventory phải có đúng 5 bản ghi')

  // Kiểm tra bảng mc_ledger
  const ledgerRow = await db.prepare(`
    SELECT * FROM mc_ledger WHERE account_id = ? AND reason = 'card_pack_purchase' AND ref_id = ?
  `).get(accountId, reqId)
  assert.ok(ledgerRow, 'Phải có bản ghi mc_ledger với reason card_pack_purchase')
  assert.strictEqual(ledgerRow.delta_mc, -2200)

  // Kiểm tra getUserCardInventory
  const userInv = await getUserCardInventory(accountId)
  assert.ok(userInv.length >= 1 && userInv.length <= 5, 'Inventory phải thống kê theo thẻ')

  // 3. Kiểm tra Idempotency (gửi lại cùng requestId)
  const replayRes = await buyAndOpenCardPack(accountId, 'pack_ngu_uan', reqId)
  assert.strictEqual(replayRes.idempotentReplay, true, 'Phải phát hiện replay')
  assert.strictEqual(replayRes.balanceAfter, 2800, 'Không bị trừ tiền lần 2')
  assert.strictEqual(replayRes.extra.cards.length, 5, 'Phải trả về đúng 5 thẻ cũ')

  // 4. Kiểm tra khi số dư không đủ (gói Bát Nhã 4.500 MC khi chỉ còn 2.800 MC)
  const reqFailId = `req_fail_${now}`
  let threwError = false
  try {
    await buyAndOpenCardPack(accountId, 'pack_bat_nha', reqFailId)
  } catch (err) {
    threwError = true
  }
  assert.ok(threwError, 'Phải ném lỗi khi không đủ MC')

  // Số dư vẫn phải nguyên vẹn 2.800 MC
  const accCheck = await db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId)
  assert.strictEqual(accCheck.mc_balance, 2800, 'Số dư không bị thay đổi khi transaction lỗi')
})

