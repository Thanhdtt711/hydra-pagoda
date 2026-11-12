/**
 * Sổ Tu Tập: chuỗi ngày an lạc (đề xuất 3.1 trong docs/co_che_hoat_dong/DE_XUAT_TRO_CHOI_GIU_CHAN.md).
 *
 * - Server là nơi duy nhất quyết định: client chỉ gọi `claim`, server tự kiểm tra hôm nay đã có việc lành
 *   (thiền xong, thắp hương, bói quẻ, công đức) trong dữ liệu sẵn có rồi mới ghi dấu.
 * - Ngày tính theo giờ Việt Nam (`getVietnamDayKey`), cùng mốc với mọi hạn mức ngày khác.
 * - Quà cột mốc là vật phẩm, thẻ hoặc danh hiệu, KHÔNG cộng MC nên không đụng trần MC theo ngày và không cần
 *   bút toán `mc_ledger`.
 * - Mỗi cột mốc chỉ phát một lần mỗi tài khoản (`streak_rewards` khóa chính theo tài khoản + cột mốc).
 */
import {
  EMPTY_STREAK,
  STREAK_MILESTONES,
  computeStreakStep,
  nextMilestoneOf,
  type StreakMilestone,
  type StreakOutcome,
  type StreakState
} from '../../../lib/streak/streakRules'
import { getStartOfVietnamDayMs, getVietnamDayKey, getVietnamWeekKey } from '../../../lib/time/vietnamDay'
import { apiError } from './auth.ts'
import { getDb, withTransaction, type DbConn } from './db.ts'
import { pickRandomCardByRarity } from '../cards/catalog.ts'

const DAY_MS = 86_400_000

export interface StreakDeeds {
  meditation: boolean
  incense: boolean
  fortune: boolean
  merit: boolean
}

export interface StreakRewardGrant {
  milestone: number
  kind: StreakMilestone['kind']
  label: string
  itemId?: string
  cardId?: string
  cardTitle?: string
  title?: string
  /** Trang phục đã có sẵn nên không cộng thêm (vẫn tính là đã nhận cột mốc). */
  alreadyOwned?: boolean
}

interface StreakRow {
  account_id: number
  current_streak: number
  best_streak: number
  last_day_key: string | null
  rest_week_key: string | null
  title: string | null
}

function rowToState(row: StreakRow | undefined): StreakState {
  if (!row) return { ...EMPTY_STREAK }
  return {
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    lastDayKey: row.last_day_key,
    restWeekKey: row.rest_week_key
  }
}

async function loadStreakRow(conn: DbConn, accountId: number): Promise<StreakRow | undefined> {
  return conn
    .prepare('SELECT account_id, current_streak, best_streak, last_day_key, rest_week_key, title FROM account_streaks WHERE account_id = ?')
    .get<StreakRow>(accountId)
}

/** Đọc việc lành hôm nay từ các bảng đã có (không tạo thêm dữ liệu theo dõi). */
export async function getTodayDeeds(conn: DbConn, accountId: number, now = Date.now()): Promise<StreakDeeds> {
  const dayKey = getVietnamDayKey(now)
  const start = getStartOfVietnamDayMs(now)
  const end = start + DAY_MS
  const exists = async (sql: string, ...params: unknown[]) => Boolean(await conn.prepare(sql).get(...params))

  return {
    meditation: await exists(
      "SELECT 1 AS ok FROM meditation_sessions WHERE account_id = ? AND day_key = ? AND status = 'completed' LIMIT 1",
      accountId,
      dayKey
    ),
    incense: await exists(
      "SELECT 1 AS ok FROM mc_ledger WHERE reason = 'incense_daily' AND ref_id = ? LIMIT 1",
      `incense_${accountId}_${dayKey}`
    ),
    fortune: await exists(
      'SELECT 1 AS ok FROM fortune_records WHERE account_id = ? AND created_at >= ? AND created_at < ? LIMIT 1',
      accountId,
      start,
      end
    ),
    merit: await exists(
      'SELECT 1 AS ok FROM merit_donations WHERE account_id = ? AND created_at >= ? AND created_at < ? LIMIT 1',
      accountId,
      start,
      end
    )
  }
}

function anyDeed(d: StreakDeeds): boolean {
  return d.meditation || d.incense || d.fortune || d.merit
}

async function listGrantedMilestones(conn: DbConn, accountId: number): Promise<Set<number>> {
  const rows = await conn.prepare('SELECT milestone FROM streak_rewards WHERE account_id = ?').all<{ milestone: number }>(accountId)
  return new Set(rows.map(r => Number(r.milestone)))
}

function publicMilestones(granted: Set<number>, streak: number) {
  return STREAK_MILESTONES.map(m => ({
    milestone: m.milestone,
    label: m.label,
    kind: m.kind,
    reached: streak >= m.milestone,
    granted: granted.has(m.milestone)
  }))
}

/** Trạng thái Sổ Tu Tập. Khách chưa đăng nhập vẫn xem được danh sách cột mốc. */
export async function getStreakStatus(accountId: number | null, now = Date.now()) {
  const todayKey = getVietnamDayKey(now)
  if (!accountId) {
    return {
      authenticated: false,
      todayKey,
      currentStreak: 0,
      bestStreak: 0,
      todayDone: false,
      canClaim: false,
      restUsedThisWeek: false,
      title: null as string | null,
      deeds: { meditation: false, incense: false, fortune: false, merit: false } as StreakDeeds,
      nextMilestone: nextMilestoneOf(0),
      milestones: publicMilestones(new Set(), 0)
    }
  }

  const conn = await getDb()
  const row = await loadStreakRow(conn, accountId)
  const state = rowToState(row)
  const deeds = await getTodayDeeds(conn, accountId, now)
  const granted = await listGrantedMilestones(conn, accountId)
  const todayDone = state.lastDayKey === todayKey

  return {
    authenticated: true,
    todayKey,
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    todayDone,
    canClaim: !todayDone && anyDeed(deeds),
    // Chỉ để hiển thị nhẹ nhàng "ngày nghỉ tuần này đã dùng", không đếm ngược.
    restUsedThisWeek: state.restWeekKey === getVietnamWeekKey(now),
    title: row?.title ?? null,
    deeds,
    nextMilestone: nextMilestoneOf(state.currentStreak),
    milestones: publicMilestones(granted, state.currentStreak)
  }
}

async function grantMilestone(conn: DbConn, accountId: number, m: StreakMilestone, now: number): Promise<StreakRewardGrant> {
  const base: StreakRewardGrant = { milestone: m.milestone, kind: m.kind, label: m.label }

  if (m.kind === 'title') {
    await conn
      .prepare('UPDATE account_streaks SET title = ?, updated_at = ? WHERE account_id = ?')
      .run(m.title ?? null, now, accountId)
    return { ...base, title: m.title }
  }

  if (m.kind === 'card') {
    const owned = await conn
      .prepare('SELECT DISTINCT card_id FROM card_inventory WHERE account_id = ?')
      .all<{ card_id: string }>(accountId)
    // Ưu tiên thẻ hiếm chưa có; nếu đã đủ cả bậc này thì `pickRandomCardByRarity` tự rơi về thẻ cùng bậc bất kỳ.
    const card = pickRandomCardByRarity('rare', new Set(owned.map(r => r.card_id)))
    await conn
      .prepare(
        `INSERT INTO card_inventory (account_id, card_id, rarity, unlocked_at, is_nft_minted, nft_asset_id)
         VALUES (?, ?, ?, ?, 0, NULL)`
      )
      .run(accountId, card.id, card.rarity, now)
    await conn
      .prepare(
        `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
         VALUES (?, ?, 'heritage_card', 1, ?, ?)
         ON CONFLICT(account_id, item_id) DO UPDATE SET
           quantity = account_inventory.quantity + 1,
           updated_at = excluded.updated_at`
      )
      .run(accountId, card.id, now, now)
    return { ...base, cardId: card.id, cardTitle: card.title }
  }

  const itemId = m.itemId as string
  const category = m.category as 'attire' | 'offering'
  if (category === 'attire') {
    const have = await conn
      .prepare('SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = ?')
      .get(accountId, itemId)
    if (have) return { ...base, itemId, alreadyOwned: true }
  }
  await conn
    .prepare(
      `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(account_id, item_id) DO UPDATE SET
         quantity = account_inventory.quantity + 1,
         updated_at = excluded.updated_at`
    )
    .run(accountId, itemId, category, now, now)
  return { ...base, itemId }
}

export interface ClaimStreakResult {
  outcome: StreakOutcome
  rewards: StreakRewardGrant[]
}

/**
 * Ghi dấu hôm nay vào Sổ Tu Tập. Idempotent: gọi lại trong cùng ngày trả `outcome: 'already'`.
 * Lỗi 400 `no_good_deed` nếu hôm nay chưa có việc lành nào để ghi.
 */
export async function claimStreakMark(accountId: number, now = Date.now()): Promise<ClaimStreakResult> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
  const todayKey = getVietnamDayKey(now)

  return withTransaction(async (conn): Promise<ClaimStreakResult> => {
    const row = await loadStreakRow(conn, accountId)
    const state = rowToState(row)
    if (state.lastDayKey === todayKey) return { outcome: 'already', rewards: [] }

    const deeds = await getTodayDeeds(conn, accountId, now)
    if (!anyDeed(deeds)) {
      apiError(400, 'no_good_deed', 'Hôm nay chưa có việc lành nào để ghi vào sổ')
    }

    const { next, outcome } = computeStreakStep(state, todayKey)

    if (!row) {
      await conn
        .prepare(
          `INSERT INTO account_streaks (account_id, current_streak, best_streak, last_day_key, rest_week_key, title, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`
        )
        .run(accountId, next.currentStreak, next.bestStreak, next.lastDayKey, next.restWeekKey, now)
    } else {
      // Đã nằm trong transaction BEGIN IMMEDIATE nên không có hai lần ghi song song; điều kiện last_day_key là lớp bảo vệ thêm.
      const upd = await conn
        .prepare(
          `UPDATE account_streaks
              SET current_streak = ?, best_streak = ?, last_day_key = ?, rest_week_key = ?, updated_at = ?
            WHERE account_id = ? AND last_day_key = ?`
        )
        .run(next.currentStreak, next.bestStreak, next.lastDayKey, next.restWeekKey, now, accountId, state.lastDayKey)
      if (Number(upd.changes) === 0) return { outcome: 'already', rewards: [] }
    }

    const granted = await listGrantedMilestones(conn, accountId)
    const rewards: StreakRewardGrant[] = []
    for (const m of STREAK_MILESTONES) {
      if (m.milestone > next.currentStreak || granted.has(m.milestone)) continue
      const ins = await conn
        .prepare('INSERT INTO streak_rewards (account_id, milestone, granted_at) VALUES (?, ?, ?) ON CONFLICT(account_id, milestone) DO NOTHING')
        .run(accountId, m.milestone, now)
      if (Number(ins.changes) === 0) continue
      rewards.push(await grantMilestone(conn, accountId, m, now))
    }

    return { outcome, rewards }
  })
}
