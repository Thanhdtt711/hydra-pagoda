/**
 * Ba Việc Lành mỗi ngày (đề xuất 3.2 trong docs/co_che_hoat_dong/DE_XUAT_TRO_CHOI_GIU_CHAN.md).
 *
 * - Bộ ba việc chọn bằng hạt giống `accountId + khóa ngày` (`pickDailyDeeds`), không lưu danh sách.
 * - Việc `auto` (thiền, thắp hương, gieo quẻ) tự tính từ bảng sẵn có qua `getTodayDeeds` của Sổ Tu Tập.
 * - Việc `visit` (đến điểm trong chùa) do client báo, server chỉ nhận mã điểm nằm trong bộ ba của hôm nay.
 *   Quà là vật phẩm nhẹ, không cộng MC, nên không đụng trần MC và không cần bút toán `mc_ledger`.
 * - Quà nhận tối đa một lần mỗi tài khoản mỗi ngày (`daily_deed_rewards` khóa chính theo tài khoản + ngày).
 */
import {
  DAILY_DEED_COUNT,
  DAILY_DEED_REWARD,
  findVisitDeed,
  pickDailyDeeds,
  type DeedDef
} from '../../../lib/streak/deedCatalog'
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import { apiError } from './auth.ts'
import { getDb, withTransaction, type DbConn } from './db.ts'
import { getTodayDeeds } from './streakService.ts'

export interface DailyDeedItemDto {
  id: string
  label: string
  kind: 'auto' | 'visit'
  /** Việc `visit`: mã điểm đến để client dẫn đường và báo lại. */
  landmark: string | null
  mapKey: string | null
  done: boolean
}

export interface DailyDeedsStatusDto {
  authenticated: boolean
  todayKey: string
  deeds: DailyDeedItemDto[]
  doneCount: number
  total: number
  rewardClaimed: boolean
  canClaim: boolean
  reward: { itemId: string; label: string }
}

function assertAccountId(accountId: number): void {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
}

async function listVisitedToday(conn: DbConn, accountId: number, dayKey: string): Promise<Set<string>> {
  const rows = await conn
    .prepare('SELECT deed_id FROM daily_deeds WHERE account_id = ? AND day_key = ?')
    .all<{ deed_id: string }>(accountId, dayKey)
  return new Set(rows.map(r => String(r.deed_id)))
}

async function isRewardClaimed(conn: DbConn, accountId: number, dayKey: string): Promise<boolean> {
  const row = await conn
    .prepare('SELECT 1 AS ok FROM daily_deed_rewards WHERE account_id = ? AND day_key = ?')
    .get(accountId, dayKey)
  return Boolean(row)
}

async function buildStatus(conn: DbConn, accountId: number, now: number): Promise<DailyDeedsStatusDto> {
  const dayKey = getVietnamDayKey(now)
  const picked = pickDailyDeeds(accountId, dayKey)
  const auto = await getTodayDeeds(conn, accountId, now)
  const visited = await listVisitedToday(conn, accountId, dayKey)
  const rewardClaimed = await isRewardClaimed(conn, accountId, dayKey)

  const deeds: DailyDeedItemDto[] = picked.map((d: DeedDef) => ({
    id: d.id,
    label: d.label,
    kind: d.kind,
    landmark: d.landmark ?? null,
    mapKey: d.mapKey ?? null,
    done: d.kind === 'auto' ? Boolean(d.autoKey && auto[d.autoKey]) : visited.has(d.id)
  }))
  const doneCount = deeds.filter(d => d.done).length

  return {
    authenticated: true,
    todayKey: dayKey,
    deeds,
    doneCount,
    total: DAILY_DEED_COUNT,
    rewardClaimed,
    canClaim: !rewardClaimed && doneCount === DAILY_DEED_COUNT,
    reward: { itemId: DAILY_DEED_REWARD.itemId, label: DAILY_DEED_REWARD.label }
  }
}

/** Ba việc hôm nay và tiến độ. Khách chưa đăng nhập chỉ thấy khung rỗng. */
export async function getDailyDeedsStatus(accountId: number | null, now = Date.now()): Promise<DailyDeedsStatusDto> {
  if (!accountId) {
    return {
      authenticated: false,
      todayKey: getVietnamDayKey(now),
      deeds: [],
      doneCount: 0,
      total: DAILY_DEED_COUNT,
      rewardClaimed: false,
      canClaim: false,
      reward: { itemId: DAILY_DEED_REWARD.itemId, label: DAILY_DEED_REWARD.label }
    }
  }
  assertAccountId(accountId)
  return buildStatus(await getDb(), accountId, now)
}

/**
 * Ghi nhận đã đến một điểm trong chùa. Idempotent. Chỉ nhận điểm nằm trong bộ ba việc hôm nay của chính tài khoản
 * (lỗi 400 `deed_not_today` nếu không), để không ai điền sẵn việc ngày khác.
 */
export async function recordVisitDeed(accountId: number, landmarkRaw: unknown, now = Date.now()): Promise<DailyDeedsStatusDto> {
  assertAccountId(accountId)
  const landmark = typeof landmarkRaw === 'string' ? landmarkRaw.trim() : ''
  const deed = landmark ? findVisitDeed(landmark) : null
  if (!deed) apiError(400, 'invalid_landmark', 'Điểm đến không hợp lệ')

  const dayKey = getVietnamDayKey(now)
  const todays = pickDailyDeeds(accountId, dayKey)
  if (!todays.some(d => d.id === deed.id)) {
    apiError(400, 'deed_not_today', 'Điểm này không nằm trong ba việc lành hôm nay')
  }

  return withTransaction(async (conn) => {
    await conn
      .prepare(
        'INSERT INTO daily_deeds (account_id, day_key, deed_id, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id, day_key, deed_id) DO NOTHING'
      )
      .run(accountId, dayKey, deed.id, now)
    return buildStatus(conn, accountId, now)
  })
}

export interface ClaimDeedRewardResult {
  granted: boolean
  itemId: string
  label: string
}

/** Nhận quà khi đủ ba việc. Idempotent: gọi lại trong cùng ngày trả `granted: false`. */
export async function claimDailyDeedReward(accountId: number, now = Date.now()): Promise<ClaimDeedRewardResult> {
  assertAccountId(accountId)
  const dayKey = getVietnamDayKey(now)
  const reward = DAILY_DEED_REWARD

  return withTransaction(async (conn): Promise<ClaimDeedRewardResult> => {
    const result = { granted: false, itemId: reward.itemId, label: reward.label }
    if (await isRewardClaimed(conn, accountId, dayKey)) return result

    const status = await buildStatus(conn, accountId, now)
    if (status.doneCount < DAILY_DEED_COUNT) {
      apiError(400, 'deeds_incomplete', 'Chưa đủ ba việc lành hôm nay')
    }

    const ins = await conn
      .prepare('INSERT INTO daily_deed_rewards (account_id, day_key, item_id, claimed_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id, day_key) DO NOTHING')
      .run(accountId, dayKey, reward.itemId, now)
    if (Number(ins.changes) === 0) return result

    await conn
      .prepare(
        `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(account_id, item_id) DO UPDATE SET
           quantity = account_inventory.quantity + 1,
           updated_at = excluded.updated_at`
      )
      .run(accountId, reward.itemId, reward.category, now, now)

    return { ...result, granted: true }
  })
}

