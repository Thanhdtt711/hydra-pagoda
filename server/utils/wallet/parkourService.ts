/**
 * Dịch vụ Thử Thách Parkour Leo Núi (Đường Lên Đỉnh Phù Vân).
 * - Mỗi ngày 1 lần MIỄN PHÍ: nhận +50 MC Free khi bắt đầu.
 * - Lượt thứ 2 trở đi trong ngày: 5 MC / lượt.
 * - Lên tới đỉnh núi: nhận thưởng +30 MC, cập nhật kỷ lục thời gian leo tốt nhất.
 */
import { randomBytes } from 'node:crypto'
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import { getDb, withTransaction, type DbConn } from './db'
import { credit, spend } from './mcService'
import { apiError } from './auth'

async function getAccountBalance(db: DbConn, accountId: number): Promise<number> {
  const row = await db.prepare(`SELECT mc_balance FROM accounts WHERE id = ?`).get(accountId) as { mc_balance: number } | undefined
  return row ? Number(row.mc_balance) : 0
}

export interface ParkourStatusDto {
  canClaimFreeToday: boolean
  attemptsToday: number
  bestTimeSec: number | null
  currentCostMc: number
  grantRewardMc: number
  completionRewardMc: number
}

export interface ParkourStartResultDto {
  runToken: string
  isFreeRun: boolean
  grantedMc: number
  chargedMc: number
  currentBalanceMc: number
  startedAt: number
}

export interface ParkourCompleteResultDto {
  rewardMc: number
  timeTakenSec: number
  isNewRecord: boolean
  bestTimeSec: number
  currentBalanceMc: number
  ledgerId?: number
}

function getTodayKey(): string {
  return getVietnamDayKey()
}

/**
 * Lấy trạng thái thử thách Parkour hôm nay của tài khoản
 */
export async function getParkourStatus(accountId: number | null): Promise<ParkourStatusDto> {
  const defaultStatus: ParkourStatusDto = {
    canClaimFreeToday: true,
    attemptsToday: 0,
    bestTimeSec: null,
    currentCostMc: 0,
    grantRewardMc: 0,
    completionRewardMc: 100
  }

  if (!accountId) return defaultStatus

  const db = await getDb()
  const today = getTodayKey()
  const row = await db
    .prepare(
      `SELECT attempts_count, has_free_claimed, best_time_sec 
         FROM parkour_records 
        WHERE account_id = ? AND day_key = ?`
    )
    .get(accountId, today) as { attempts_count: number; has_free_claimed: number; best_time_sec: number | null } | undefined

  // Lấy kỷ lục trọn đời
  const allTimeBest = await db
    .prepare(`SELECT MIN(best_time_sec) as min_time FROM parkour_records WHERE account_id = ? AND best_time_sec IS NOT NULL`)
    .get(accountId) as { min_time: number | null } | undefined

  const hasClaimed = Boolean(row?.has_free_claimed)
  const attempts = row?.attempts_count ?? 0

  return {
    canClaimFreeToday: !hasClaimed,
    attemptsToday: attempts,
    bestTimeSec: allTimeBest?.min_time ?? null,
    currentCostMc: hasClaimed ? 5 : 0,
    grantRewardMc: 0,
    completionRewardMc: 100
  }
}

/**
 * Bắt đầu một lượt Parkour:
 * - Lượt 1 trong ngày: Miễn phí tham gia (0 MC)
 * - Lượt 2 trở đi: Trừ 5 MC
 * - Thưởng +50 MC khi leo lên tới đỉnh núi
 */
export async function startParkourRun(accountId: number): Promise<ParkourStartResultDto> {
  const today = getTodayKey()
  const now = Date.now()
  const runToken = 'pk_' + randomBytes(12).toString('hex')

  return withTransaction(async (db) => {
    let rec = await db
      .prepare(`SELECT * FROM parkour_records WHERE account_id = ? AND day_key = ?`)
      .get(accountId, today) as { id: number; attempts_count: number; has_free_claimed: number } | undefined

    if (!rec) {
      await db.prepare(
        `INSERT INTO parkour_records (account_id, day_key, attempts_count, has_free_claimed, completed_count, updated_at)
         VALUES (?, ?, 0, 0, 0, ?)`
      ).run(accountId, today, now)
      rec = { id: 0, attempts_count: 0, has_free_claimed: 0 }
    }

    const isFree = rec.has_free_claimed === 0
    let granted = 0
    let charged = 0
    let ledgerId: number | null = null

    if (isFree) {
      // Lượt miễn phí hôm nay: không thu phí tham gia (0 MC), lên đỉnh mới nhận thưởng 50 MC
      await db.prepare(`UPDATE parkour_records SET has_free_claimed = 1, attempts_count = attempts_count + 1, updated_at = ? WHERE account_id = ? AND day_key = ?`).run(
        now,
        accountId,
        today
      )
    } else {
      charged = 5
      const currentBal = await getAccountBalance(db, accountId)
      if (currentBal < 5) {
        throw apiError(400, 'insufficient_mc', 'Số dư không đủ 5 MC để tham gia lượt tiếp theo.')
      }
      const spendRes = await spend(
        accountId,
        5,
        'custom_service',
        runToken,
        {
          refType: 'parkour_fee',
          metadata: {
            note: 'Phí thử thách Parkour Đường Lên Đỉnh Phù Vân',
            runToken
          }
        }
      )
      ledgerId = spendRes.ledgerId
      await db.prepare(`UPDATE parkour_records SET attempts_count = attempts_count + 1, updated_at = ? WHERE account_id = ? AND day_key = ?`).run(
        now,
        accountId,
        today
      )
    }

    await db.prepare(
      `INSERT INTO parkour_runs (run_token, account_id, day_key, fee_mc, grant_mc, started_at, ledger_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(runToken, accountId, today, charged, granted, now, ledgerId)

    return {
      runToken,
      isFreeRun: isFree,
      grantedMc: granted,
      chargedMc: charged,
      currentBalanceMc: await getAccountBalance(db, accountId),
      startedAt: now
    }
  })
}

/**
 * Hoàn thành thử thách khi lên tới đỉnh núi:
 * - Kiểm tra thời gian leo hợp lệ (tối thiểu 8s, tránh gian lận teleport)
 * - Trao thưởng +30 MC vinh danh
 */
export async function completeParkourRun(accountId: number, runToken: string): Promise<ParkourCompleteResultDto> {
  const today = getTodayKey()
  const now = Date.now()

  return withTransaction(async (db) => {
    const run = await db
      .prepare(`SELECT * FROM parkour_runs WHERE run_token = ? AND account_id = ?`)
      .get(runToken, accountId) as { run_token: string; started_at: number; completed_at: number | null } | undefined

    if (!run) {
      throw apiError(404, 'run_not_found', 'Phiên Parkour không tồn tại hoặc đã hết hạn.')
    }

    if (run.completed_at) {
      const best = ((await db.prepare(`SELECT MIN(best_time_sec) as min_time FROM parkour_records WHERE account_id = ?`).get(accountId)) as any)?.min_time || 0
      return {
        rewardMc: 0,
        timeTakenSec: Math.round((run.completed_at - run.started_at) / 1000),
        isNewRecord: false,
        bestTimeSec: best,
        currentBalanceMc: await getAccountBalance(db, accountId)
      }
    }

    const elapsedMs = now - run.started_at
    const timeTakenSec = Math.max(1, Math.round(elapsedMs / 1000))

    // Kiểm tra an toàn: đường leo núi cao 70m với 66 bệ nhảy cần tối thiểu 45 giây (chống hack teleport)
    if (timeTakenSec < 45) {
      throw apiError(400, 'too_fast', 'Thời gian leo núi Phù Vân không hợp lệ (tối thiểu 45 giây).')
    }

    const reward = 100
    const creditRes = await credit(
      accountId,
      reward,
      'custom_service',
      {
        refType: 'parkour_summit_reward',
        refId: `pk_win_${runToken}`,
        metadata: {
          note: `Vinh danh chinh phục Thiên Đỉnh Phù Vân 70M thành công (+100 MC) trong ${timeTakenSec}s`,
          runToken,
          timeTakenSec
        }
      }
    )

    await db.prepare(
      `UPDATE parkour_runs 
          SET completed_at = ?, time_taken_sec = ?, reward_mc = ?, ledger_id = ? 
        WHERE run_token = ?`
    ).run(now, timeTakenSec, reward, creditRes.ledgerId, runToken)

    const rec = await db
      .prepare(`SELECT best_time_sec FROM parkour_records WHERE account_id = ? AND day_key = ?`)
      .get(accountId, today) as { best_time_sec: number | null } | undefined

    let isNewRecord = false
    let newBest = rec?.best_time_sec ?? null
    if (!newBest || timeTakenSec < newBest) {
      isNewRecord = true
      newBest = timeTakenSec
    }

    await db.prepare(
      `UPDATE parkour_records 
          SET completed_count = completed_count + 1, best_time_sec = ?, updated_at = ?
        WHERE account_id = ? AND day_key = ?`
    ).run(newBest, now, accountId, today)

    return {
      rewardMc: reward,
      timeTakenSec,
      isNewRecord,
      bestTimeSec: newBest ?? timeTakenSec,
      currentBalanceMc: await getAccountBalance(db, accountId),
      ledgerId: creditRes.ledgerId
    }
  })
}

