// server/utils/wallet/coupleFortuneService.ts
// Dịch vụ Bói Duyên Cặp Đôi (Đài Tơ Duyên Nguyệt Lão)

import { createHash } from 'node:crypto'
import {
  calculateCoupleCompatibility,
  type CoupleCompatibilityResult,
  type CoupleFortuneResultDto
} from '../../../lib/boi/CoupleDivinationLogic'
import { generateFortune } from '../../../lib/boi/FortuneEngine'
import type { PersonProfile } from '../../../lib/boi/types'
import { apiError } from './auth'
import { getDb, withTransaction } from './db'
import { spend, getAccountInventory } from './mcService'

function getAccountBalance(accountId: number): number {
  const db = getDb()
  const row = db.prepare(`SELECT mc_balance FROM accounts WHERE id = ?`).get(accountId) as { mc_balance: number } | undefined
  return row ? Number(row.mc_balance) : 0
}

export { calculateCoupleCompatibility, type CoupleCompatibilityResult, type CoupleFortuneResultDto }

/**
 * Bắt đầu nghi thức gieo quẻ cặp đôi:
 * - Lượt 1 trong ngày: Miễn phí (0 MC)
 * - Lượt 2 trở đi: 50 MC
 * - Tặng 1 Bùa Chỉ Đỏ Uyên Ương vào kho đồ
 */
export function drawCoupleFortune(
  accountId: number,
  profile: PersonProfile,
  partnerProfile: PersonProfile,
  paymentMode: 'free_daily' | 'mc',
  requestId = ''
): CoupleFortuneResultDto {
  const today = new Date().toISOString().slice(0, 10)
  const now = Date.now()
  const cleanReqId = requestId ? requestId.trim() : `pk_love_${now}_${accountId}`

  // 1. Tính độ tương hợp
  const compatibility = calculateCoupleCompatibility(profile, partnerProfile, today)

  // 2. Gieo quẻ Tơ Duyên bằng FortuneEngine
  const generated = generateFortune({
    mon: 'to_duyen',
    mode: 'profile',
    profile,
    partnerProfile,
    dateStr: today
  })

  return withTransaction((conn) => {
    // Kiểm tra idempotency
    const existing = conn
      .prepare(`SELECT fortune_json, receipt_hash, cost_mc FROM fortune_records WHERE request_id = ? AND account_id = ?`)
      .get(cleanReqId, accountId) as { fortune_json: string; receipt_hash: string; cost_mc: number } | undefined

    if (existing) {
      return {
        ok: true,
        spentMc: existing.cost_mc,
        paymentMode: existing.cost_mc === 0 ? 'free_daily' : 'mc',
        currentBalanceMc: getAccountBalance(accountId),
        compatibility,
        fortune: JSON.parse(existing.fortune_json),
        receiptHash: existing.receipt_hash,
        awardedCharm: false,
        inventory: getAccountInventory(accountId)
      }
    }

    // Kiểm tra lượt miễn phí hôm nay
    const dayStart = new Date(today + 'T00:00:00.000Z').getTime()
    const freeCount = conn
      .prepare(
        `SELECT COUNT(*) as count FROM fortune_records 
         WHERE account_id = ? AND category = 'love_couple' AND cost_mc = 0 AND created_at >= ?`
      )
      .get(accountId, dayStart) as { count: number }

    let spentMc = 0
    if (paymentMode === 'free_daily') {
      if ((freeCount?.count || 0) >= 1) {
        throw apiError(
          400,
          'daily_free_exhausted',
          'Bạn đã dùng hết 1 lượt miễn phí hôm nay cho Đài Tơ Duyên. Vui lòng thỉnh thêm lượt (50 MC)!'
        )
      }
    } else {
      spentMc = 50
      const bal = getAccountBalance(accountId)
      if (bal < 50) {
        throw apiError(400, 'insufficient_mc', 'Số dư không đủ 50 MC để thỉnh thêm lượt Tơ Duyên.')
      }
      spend(accountId, 50, 'custom_service', cleanReqId, {
        refType: 'couple_divination',
        metadata: {
          note: `Thỉnh quẻ Đài Tơ Duyên Nguyệt Lão: ${profile.fullName} & ${partnerProfile.fullName}`,
          partnerName: partnerProfile.fullName
        }
      })
    }

    // Tặng 1 Bùa Chỉ Đỏ Uyên Ương vào kho đồ
    conn.prepare(
      `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
       VALUES (?, 'love_knot_charm', 'charm', 1, ?, ?)
       ON CONFLICT(account_id, item_id) DO UPDATE SET
         quantity = account_inventory.quantity + 1,
         updated_at = excluded.updated_at`
    ).run(accountId, now, now)

    const receiptHash = 'mc_love_' + createHash('sha256')
      .update(`${accountId}:${cleanReqId}:${today}:${now}`)
      .digest('hex')
      .slice(0, 24)

    const fortunePayload = {
      ...generated,
      compatibility,
      receiptHash,
      createdAt: now
    }

    conn.prepare(
      `INSERT INTO fortune_records (account_id, request_id, category, tier, cost_mc, fortune_json, receipt_hash, created_at)
       VALUES (?, ?, 'love_couple', ?, ?, ?, ?, ?)`
    ).run(
      accountId,
      cleanReqId,
      paymentMode === 'free_daily' ? 'free_daily' : 'mc_couple',
      spentMc,
      JSON.stringify(fortunePayload),
      receiptHash,
      now
    )

    return {
      ok: true,
      spentMc,
      paymentMode,
      currentBalanceMc: getAccountBalance(accountId),
      compatibility,
      fortune: generated,
      receiptHash,
      awardedCharm: true,
      inventory: getAccountInventory(accountId)
    }
  })
}
