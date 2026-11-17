/**
 * Dịch vụ chăm sóc đàn cá Koi tại Hồ Sen Bát Nhã (Mục 13):
 * - 5 cá chép (`koi_index` 0..4) với sắc màu và danh tính riêng.
 * - Mỗi ngày tài khoản có 1 lượt cho cá ăn miễn phí; các lượt tiếp theo tiêu 1 `koi_food` trong túi đồ.
 * - Giới hạn tối đa 2 lần ăn / con cá / ngày để chống farm.
 * - Cá lớn dần từ cấp 1 đến cấp 5 theo tổng số lần được cho ăn (`level = min(5, 1 + floor(total_feeds / 3))`).
 * - Mỗi con cá được đổi tên miễn phí một lần (`rename_used = 0 -> 1`).
 */
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import { apiError } from './auth.ts'
import { getDb, withTransaction, type DbConn } from './db.ts'
import { getAccountInventory } from './mcService.ts'

export const KOI_FOOD_ITEM_ID = 'koi_food'
export const KOI_COUNT = 5
export const MAX_FEEDS_PER_KOI_PER_DAY = 2

export interface KoiMeta {
  koiIndex: number
  defaultName: string
  colorLabel: string
}

export const KOI_DEFAULTS: readonly KoiMeta[] = [
  { koiIndex: 0, defaultName: 'Bạch Liên', colorLabel: 'Trắng Đỏ Kohaku' },
  { koiIndex: 1, defaultName: 'Hoàng Kim', colorLabel: 'Vàng Yamabuki' },
  { koiIndex: 2, defaultName: 'Cẩm Lý', colorLabel: 'Tam Sắc Showa' },
  { koiIndex: 3, defaultName: 'Hồng Ngọc', colorLabel: 'Đỏ Hi Utsuri' },
  { koiIndex: 4, defaultName: 'Thanh Vân', colorLabel: 'Trắng Vàng Tancho' }
]

export interface KoiItemDto {
  koiIndex: number
  defaultName: string
  customName: string | null
  displayName: string
  colorLabel: string
  totalFeeds: number
  level: number
  fedToday: number
  maxDailyFeeds: number
  renameUsed: boolean
}

export interface KoiStatusDto {
  authenticated: boolean
  todayKey: string
  freeFeedAvailable: boolean
  koiFoodQty: number
  koiList: KoiItemDto[]
}

function assertAccountId(accountId: number): void {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
}

function assertKoiIndex(idx: unknown): number {
  const n = Number(idx)
  if (!Number.isInteger(n) || n < 0 || n >= KOI_COUNT) {
    apiError(400, 'invalid_koi_index', 'Chỉ số cá Koi không hợp lệ (0..4)')
  }
  return n
}

export function computeKoiLevel(totalFeeds: number): number {
  return Math.min(5, 1 + Math.floor(Math.max(0, totalFeeds) / 3))
}

async function consumeOneInventoryItem(conn: DbConn, accountId: number, itemId: string, now: number): Promise<boolean> {
  const upd = await conn
    .prepare(
      `UPDATE account_inventory
          SET quantity = quantity - 1, updated_at = ?
        WHERE account_id = ? AND item_id = ? AND quantity > 1`
    )
    .run(now, accountId, itemId)
  if (Number(upd.changes || 0) > 0) return true

  const del = await conn
    .prepare(
      `DELETE FROM account_inventory
        WHERE account_id = ? AND item_id = ? AND quantity = 1`
    )
    .run(accountId, itemId)
  return Number(del.changes || 0) > 0
}

async function buildKoiStatus(conn: DbConn, accountId: number | null, now: number): Promise<KoiStatusDto> {
  const todayKey = getVietnamDayKey(now)
  if (accountId == null) {
    return {
      authenticated: false,
      todayKey,
      freeFeedAvailable: false,
      koiFoodQty: 0,
      koiList: KOI_DEFAULTS.map((meta) => ({
        koiIndex: meta.koiIndex,
        defaultName: meta.defaultName,
        customName: null,
        displayName: meta.defaultName,
        colorLabel: meta.colorLabel,
        totalFeeds: 0,
        level: 1,
        fedToday: 0,
        maxDailyFeeds: MAX_FEEDS_PER_KOI_PER_DAY,
        renameUsed: false
      }))
    }
  }

  const rows = await conn
    .prepare(
      `SELECT koi_index, custom_name, rename_used, total_feeds, level, last_fed_day, fed_today
         FROM koi_state
        WHERE account_id = ?`
    )
    .all<{
      koi_index: number
      custom_name: string | null
      rename_used: number
      total_feeds: number
      level: number
      last_fed_day: string | null
      fed_today: number
    }>(accountId)

  const byIndex = new Map<number, (typeof rows)[number]>()
  for (const r of rows) {
    byIndex.set(Number(r.koi_index), r)
  }

  const freeUsed = await conn
    .prepare('SELECT 1 AS ok FROM koi_daily_free_feeds WHERE account_id = ? AND day_key = ?')
    .get(accountId, todayKey)

  const foodRow = await conn
    .prepare('SELECT quantity FROM account_inventory WHERE account_id = ? AND item_id = ?')
    .get<{ quantity: number }>(accountId, KOI_FOOD_ITEM_ID)

  const koiList: KoiItemDto[] = KOI_DEFAULTS.map((meta) => {
    const r = byIndex.get(meta.koiIndex)
    const customName = r?.custom_name ? String(r.custom_name) : null
    const totalFeeds = Number(r?.total_feeds ?? 0)
    const level = computeKoiLevel(totalFeeds)
    const fedToday = r?.last_fed_day === todayKey ? Number(r.fed_today ?? 0) : 0
    return {
      koiIndex: meta.koiIndex,
      defaultName: meta.defaultName,
      customName,
      displayName: customName || meta.defaultName,
      colorLabel: meta.colorLabel,
      totalFeeds,
      level,
      fedToday,
      maxDailyFeeds: MAX_FEEDS_PER_KOI_PER_DAY,
      renameUsed: Boolean(r?.rename_used)
    }
  })

  return {
    authenticated: true,
    todayKey,
    freeFeedAvailable: !freeUsed,
    koiFoodQty: Number(foodRow?.quantity ?? 0),
    koiList
  }
}

export async function getKoiStatus(accountId: number | null, now = Date.now()): Promise<KoiStatusDto> {
  if (accountId != null) assertAccountId(accountId)
  const conn = await getDb()
  return buildKoiStatus(conn, accountId, now)
}

export async function feedKoi(accountId: number, rawKoiIndex: unknown, now = Date.now()) {
  assertAccountId(accountId)
  const koiIndex = assertKoiIndex(rawKoiIndex)
  const todayKey = getVietnamDayKey(now)

  const res = await withTransaction(async (conn) => {
    const existing = await conn
      .prepare('SELECT total_feeds, last_fed_day, fed_today FROM koi_state WHERE account_id = ? AND koi_index = ?')
      .get<{ total_feeds: number; last_fed_day: string | null; fed_today: number }>(accountId, koiIndex)

    const fedToday = existing?.last_fed_day === todayKey ? Number(existing.fed_today ?? 0) : 0
    if (fedToday >= MAX_FEEDS_PER_KOI_PER_DAY) {
      apiError(400, 'koi_full_today', 'Cá Koi này đã no trong hôm nay. Hãy quay lại vào ngày mai!')
    }

    // Ưu tiên dùng lượt miễn phí trong ngày trước; nếu đã dùng thì trừ 1 Thức Ăn Cá Koi trong túi đồ.
    const freeIns = await conn
      .prepare('INSERT INTO koi_daily_free_feeds (account_id, day_key, used_at) VALUES (?, ?, ?) ON CONFLICT(account_id, day_key) DO NOTHING')
      .run(accountId, todayKey, now)

    const usedFree = Number(freeIns.changes || 0) > 0
    if (!usedFree) {
      const consumed = await consumeOneInventoryItem(conn, accountId, KOI_FOOD_ITEM_ID, now)
      if (!consumed) {
        apiError(400, 'no_koi_food', 'Bạn chưa có Thức Ăn Cá Koi. Hãy thỉnh tại Cửa Hàng (20 MC)!')
      }
    }

    const nextTotalFeeds = Number(existing?.total_feeds ?? 0) + 1
    const nextFedToday = fedToday + 1
    const nextLevel = computeKoiLevel(nextTotalFeeds)

    await conn
      .prepare(
        `INSERT INTO koi_state (account_id, koi_index, custom_name, rename_used, total_feeds, level, last_fed_day, fed_today, updated_at)
         VALUES (?, ?, NULL, 0, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, koi_index) DO UPDATE SET
           total_feeds = excluded.total_feeds,
           level = excluded.level,
           last_fed_day = excluded.last_fed_day,
           fed_today = excluded.fed_today,
           updated_at = excluded.updated_at`
      )
      .run(accountId, koiIndex, nextTotalFeeds, nextLevel, todayKey, nextFedToday, now)

    const status = await buildKoiStatus(conn, accountId, now)
    return { usedFree, status }
  })

  const inventory = await getAccountInventory(accountId)
  return { ok: true, usedFree: res.usedFree, status: res.status, inventory }
}

export async function renameKoi(accountId: number, rawKoiIndex: unknown, rawName: unknown, now = Date.now()) {
  assertAccountId(accountId)
  const koiIndex = assertKoiIndex(rawKoiIndex)
  const cleanName = String(rawName ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')

  if (cleanName.length < 2 || cleanName.length > 24) {
    apiError(400, 'invalid_koi_name', 'Tên cá Koi cần từ 2 đến 24 ký tự.')
  }
  if (!/^[\p{L}\p{N}\s'-]+$/u.test(cleanName)) {
    apiError(400, 'invalid_koi_name', 'Tên cá Koi chỉ gồm chữ cái, số và khoảng trắng.')
  }

  return withTransaction(async (conn) => {
    const existing = await conn
      .prepare('SELECT rename_used FROM koi_state WHERE account_id = ? AND koi_index = ?')
      .get<{ rename_used: number }>(accountId, koiIndex)

    if (existing && Number(existing.rename_used) > 0) {
      apiError(400, 'rename_already_used', 'Mỗi chú cá Koi chỉ được đặt tên miễn phí 1 lần.')
    }

    await conn
      .prepare(
        `INSERT INTO koi_state (account_id, koi_index, custom_name, rename_used, total_feeds, level, last_fed_day, fed_today, updated_at)
         VALUES (?, ?, ?, 1, 0, 1, NULL, 0, ?)
         ON CONFLICT(account_id, koi_index) DO UPDATE SET
           custom_name = excluded.custom_name,
           rename_used = 1,
           updated_at = excluded.updated_at`
      )
      .run(accountId, koiIndex, cleanName, now)

    const status = await buildKoiStatus(conn, accountId, now)
    return { ok: true, status }
  })
}

