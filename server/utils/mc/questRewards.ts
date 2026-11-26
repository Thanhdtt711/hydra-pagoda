/**
 * Cổng phát thưởng nhiệm vụ duy nhất từ Quỹ Nhiệm Vụ 150.000.000 MC (KHÔNG ảnh hưởng giá quỹ bán).
 * - Gắn chặt với `wallet_address` đã xác thực.
 * - Chống trùng theo UNIQUE(quest_key, wallet_address, period_key).
 * - Chống spam: hỗ trợ cooldown giữa các lần và trần tổng 1.000 MC/ví/ngày (giờ Việt Nam).
 * - Cảnh báo khi quỹ nhiệm vụ còn dưới 10%. Khi quỹ cạn -> trả grantedMc = 0, poolExhausted = true ("hết thưởng").
 */
import {
  MC_QUEST_POOL,
  QUEST_DAILY_CAP_PER_WALLET,
  QUEST_POOL_LOW_WATERMARK_PCT
} from '../../../lib/mc/tokenomics'
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import { apiError } from '../wallet/auth'
import { getDb, onAfterCommit, withTransaction } from '../wallet/db'
import { scheduleHydraRecord } from '../hydra/hydraQueue'

export interface QuestRewardOptions {
  questKey: string
  periodKey: string
  reason: string
  refId: string
  cooldownMs?: number
  metadata?: Record<string, unknown>
  now?: number
}

export interface QuestRewardResult {
  walletAddress: string
  requestedMc: number
  grantedMc: number
  dailyUsedAfter: number
  dailyCap: number
  balanceAfter: number
  ledgerId: number | null
  duplicate: boolean
  capReached: boolean
  poolExhausted: boolean
  lowPoolAlert: boolean
  message: string
}

export interface QuestFundStatus {
  questPool: string
  questPaid: string
  questRecycled: string
  burnedMc: string
  opsMc: string
  questRemaining: string
  remainingPct: number
  lowPoolAlert: boolean
  exhausted: boolean
}

export async function getQuestFundStatus(): Promise<QuestFundStatus> {
  const db = await getDb()
  const row = (await db.prepare('SELECT quest_paid, quest_recycled, burned_mc, ops_mc FROM mc_fund_state WHERE id = 1').get()) as
    | { quest_paid: number; quest_recycled: number; burned_mc?: number; ops_mc?: number }
    | undefined
  const paid = BigInt(row?.quest_paid ?? 0)
  const recycled = BigInt(row?.quest_recycled ?? 0)
  const burned = BigInt(row?.burned_mc ?? 0)
  const ops = BigInt(row?.ops_mc ?? 0)
  const effectivePool = MC_QUEST_POOL + recycled
  const remaining = effectivePool > paid ? effectivePool - paid : 0n
  const remainingPct = Number((remaining * 100n) / MC_QUEST_POOL)
  return {
    questPool: MC_QUEST_POOL.toString(),
    questPaid: paid.toString(),
    questRecycled: recycled.toString(),
    burnedMc: burned.toString(),
    opsMc: ops.toString(),
    questRemaining: remaining.toString(),
    remainingPct,
    lowPoolAlert: remainingPct < Number(QUEST_POOL_LOW_WATERMARK_PCT),
    exhausted: remaining === 0n
  }
}

export async function grantQuestReward(
  accountId: number,
  requestedMc: number,
  opts: QuestRewardOptions
): Promise<QuestRewardResult> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Cần đăng nhập ví để nhận thưởng nhiệm vụ')
  }
  if (!Number.isSafeInteger(requestedMc) || requestedMc <= 0) {
    apiError(400, 'invalid_amount', 'Số MC thưởng phải là số nguyên dương')
  }

  const now = opts.now ?? Date.now()
  const dayKey = getVietnamDayKey(new Date(now))
  const dailyCap = Number(QUEST_DAILY_CAP_PER_WALLET)

  return withTransaction(async (conn): Promise<QuestRewardResult> => {
    const acc = (await conn.prepare('SELECT id, address, mc_balance FROM accounts WHERE id = ?').get(accountId)) as
      | { id: number; address: string; mc_balance: number }
      | undefined
    if (!acc) apiError(404, 'account_not_found', 'Không tìm thấy tài khoản ví')

    // 1. Chống trùng theo (quest_key, wallet_address, period_key)
    const dup = (await conn
      .prepare('SELECT granted_mc, ledger_id FROM mc_quest_grants WHERE quest_key = ? AND wallet_address = ? AND period_key = ?')
      .get(opts.questKey, acc.address, opts.periodKey)) as { granted_mc: number; ledger_id: number | null } | undefined

    const usedRow = (await conn
      .prepare('SELECT COALESCE(SUM(granted_mc), 0) AS used FROM mc_quest_grants WHERE wallet_address = ? AND day_key = ?')
      .get(acc.address, dayKey)) as { used: number }
    const usedToday = Number(usedRow?.used ?? 0)

    if (dup) {
      return {
        walletAddress: acc.address,
        requestedMc,
        grantedMc: 0,
        dailyUsedAfter: usedToday,
        dailyCap,
        balanceAfter: acc.mc_balance,
        ledgerId: dup.ledger_id,
        duplicate: true,
        capReached: usedToday >= dailyCap,
        poolExhausted: false,
        lowPoolAlert: false,
        message: 'Nhiệm vụ này đã được nhận thưởng trước đó.'
      }
    }

    // 2. Kiểm tra cooldown giữa các lần cùng nhiệm vụ (nếu có cấu hình)
    if (opts.cooldownMs && opts.cooldownMs > 0) {
      const last = (await conn
        .prepare('SELECT created_at FROM mc_quest_grants WHERE wallet_address = ? AND quest_key = ? ORDER BY created_at DESC LIMIT 1')
        .get(acc.address, opts.questKey)) as { created_at: number } | undefined
      if (last && now - Number(last.created_at) < opts.cooldownMs) {
        apiError(429, 'quest_cooldown', 'Vui lòng chờ hết thời gian hồi trước khi nhận thưởng tiếp')
      }
    }

    // 3. Kiểm tra trần tổng 1.000 MC / ví / ngày
    const remainingDaily = Math.max(0, dailyCap - usedToday)
    const afterCap = Math.min(requestedMc, remainingDaily)
    const capReached = afterCap < requestedMc || remainingDaily === 0

    // 4. Kiểm tra quỹ nhiệm vụ 150M MC (+ MC tái chế từ chi tiêu trong game)
    const fund = (await conn.prepare('SELECT quest_paid, quest_recycled FROM mc_fund_state WHERE id = 1').get()) as {
      quest_paid: number
      quest_recycled: number
    }
    const effectivePool = MC_QUEST_POOL + BigInt(fund.quest_recycled)
    const alreadyPaid = BigInt(fund.quest_paid)
    const poolLeft = effectivePool > alreadyPaid ? effectivePool - alreadyPaid : 0n

    const grantedBig = poolLeft > BigInt(afterCap) ? BigInt(afterCap) : poolLeft
    const grantedMc = Number(grantedBig)
    const poolExhausted = afterCap > 0 && grantedMc === 0
    const remainingAfter = poolLeft - grantedBig
    const remainingPct = Number((remainingAfter * 100n) / MC_QUEST_POOL)
    const lowPoolAlert = remainingPct < Number(QUEST_POOL_LOW_WATERMARK_PCT)

    if (lowPoolAlert) {
      console.warn(`[quest-fund] Cảnh báo: quỹ thưởng nhiệm vụ còn ${remainingPct}% (${remainingAfter.toString()} MC)`)
    }

    let balanceAfter = acc.mc_balance
    let ledgerId: number | null = null

    if (grantedMc > 0) {
      await conn
        .prepare('UPDATE mc_fund_state SET quest_paid = quest_paid + ?, updated_at = ? WHERE id = 1')
        .run(grantedMc, now)
      await conn.prepare('UPDATE accounts SET mc_balance = mc_balance + ? WHERE id = ?').run(grantedMc, accountId)
      const afterAcc = (await conn.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId)) as { mc_balance: number }
      balanceAfter = afterAcc.mc_balance

      const insLedger = await conn
        .prepare(
          `INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, tx_hash, metadata_json, created_at)
           VALUES (?, ?, ?, ?, 'quest', ?, NULL, ?, ?)`
        )
        .run(
          accountId,
          grantedMc,
          balanceAfter,
          opts.reason,
          opts.refId,
          opts.metadata ? JSON.stringify(opts.metadata) : null,
          now
        )
      ledgerId = Number(insLedger.lastInsertRowid)
      onAfterCommit(() => {
        if (ledgerId && ledgerId > 0) void scheduleHydraRecord(ledgerId)
      })
    }

    await conn
      .prepare(
        `INSERT INTO mc_quest_grants
          (account_id, wallet_address, quest_key, period_key, day_key, requested_mc, granted_mc, reason, ref_id, ledger_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        accountId,
        acc.address,
        opts.questKey,
        opts.periodKey,
        dayKey,
        requestedMc,
        grantedMc,
        opts.reason,
        opts.refId,
        ledgerId,
        now
      )

    const message = poolExhausted
      ? 'Quỹ thưởng nhiệm vụ đã hết. Nhiệm vụ vẫn được ghi nhận nhưng không còn MC thưởng.'
      : grantedMc === 0 && capReached
        ? `Bạn đã đạt trần thưởng ${dailyCap.toLocaleString()} MC trong ngày hôm nay.`
        : `Đã nhận +${grantedMc.toLocaleString()} MC từ quỹ nhiệm vụ.`

    return {
      walletAddress: acc.address,
      requestedMc,
      grantedMc,
      dailyUsedAfter: usedToday + grantedMc,
      dailyCap,
      balanceAfter,
      ledgerId,
      duplicate: false,
      capReached: capReached || usedToday + grantedMc >= dailyCap,
      poolExhausted,
      lowPoolAlert,
      message
    }
  })
}
