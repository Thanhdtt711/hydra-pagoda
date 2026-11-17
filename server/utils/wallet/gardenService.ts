/**
 * Dịch vụ Vườn Thiền Cá Nhân (Mục 14):
 * - 6 ô đất (`plot_index` 0..5) cạnh Hồ Sen Bát Nhã.
 * - 3 loại hạt giống mua tại Cửa Hàng (`seed_lotus`, `seed_bamboo`, `seed_bodhi`).
 * - Cây phát triển qua 4 giai đoạn (`stage` 1..4): Hạt Mầm -> Cây Non -> Trưởng Thành -> Viên Mãn.
 * - Mỗi ô tưới tối đa 1 lần/ngày theo giờ Việt Nam (`YYYY-MM-DD`). Nếu chuỗi tu tập (`account_streaks.current_streak`) >= 3 ngày,
 *   mỗi lần tưới tăng 2 bậc thay vì 1 bậc.
 * - Khi đạt giai đoạn 4, thu hoạch nhận lễ phẩm tương ứng (Hoa Đăng, Đàn Hương Kyoto, Bánh Oản) vào túi đồ và giải phóng ô đất.
 */
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import { apiError } from './auth.ts'
import { getDb, withTransaction, type DbConn } from './db.ts'
import { getAccountInventory } from './mcService.ts'

export const GARDEN_PLOT_COUNT = 6
export const GARDEN_MAX_STAGE = 4

export type GardenSeedId = 'seed_lotus' | 'seed_bamboo' | 'seed_bodhi'

export interface GardenSeedMeta {
  seedId: GardenSeedId
  name: string
  rewardItemId: string
  rewardCategory: 'offering'
  rewardLabel: string
}

export const GARDEN_SEEDS: Record<GardenSeedId, GardenSeedMeta> = {
  seed_lotus: {
    seedId: 'seed_lotus',
    name: 'Hạt Giống Sen Hồng',
    rewardItemId: 'lotus_lantern',
    rewardCategory: 'offering',
    rewardLabel: 'Hoa Đăng Cầu An'
  },
  seed_bamboo: {
    seedId: 'seed_bamboo',
    name: 'Mầm Trúc Quân Tử',
    rewardItemId: 'incense_japan',
    rewardCategory: 'offering',
    rewardLabel: 'Đàn Hương Kyoto'
  },
  seed_bodhi: {
    seedId: 'seed_bodhi',
    name: 'Hạt Bồ Đề Tâm',
    rewardItemId: 'oan_cake',
    rewardCategory: 'offering',
    rewardLabel: 'Bánh Oản Hoàng Cung'
  }
}

export interface GardenPlotDto {
  plotIndex: number
  seedId: GardenSeedId | null
  seedName: string | null
  stage: number
  waterCount: number
  lastWateredDay: string | null
  canWaterToday: boolean
  canHarvest: boolean
  rewardLabel: string | null
}

export interface GardenStatusDto {
  authenticated: boolean
  todayKey: string
  streakBoostActive: boolean
  seedCounts: Record<GardenSeedId, number>
  plots: GardenPlotDto[]
}

function assertAccountId(accountId: number): void {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    apiError(401, 'unauthorized', 'Tài khoản không hợp lệ')
  }
}

function assertPlotIndex(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n >= GARDEN_PLOT_COUNT) {
    apiError(400, 'invalid_plot_index', 'Ô đất không hợp lệ (0..5)')
  }
  return n
}

function assertSeedId(raw: unknown): GardenSeedId {
  const s = String(raw || '').trim() as GardenSeedId
  if (!GARDEN_SEEDS[s]) {
    apiError(400, 'invalid_seed_id', 'Loại hạt giống không hợp lệ')
  }
  return s
}

async function consumeOneSeed(conn: DbConn, accountId: number, seedId: GardenSeedId, now: number): Promise<boolean> {
  const upd = await conn
    .prepare(
      `UPDATE account_inventory
          SET quantity = quantity - 1, updated_at = ?
        WHERE account_id = ? AND item_id = ? AND quantity > 1`
    )
    .run(now, accountId, seedId)
  if (Number(upd.changes || 0) > 0) return true

  const del = await conn
    .prepare(
      `DELETE FROM account_inventory
        WHERE account_id = ? AND item_id = ? AND quantity = 1`
    )
    .run(accountId, seedId)
  return Number(del.changes || 0) > 0
}

async function buildGardenStatus(conn: DbConn, accountId: number | null, now: number): Promise<GardenStatusDto> {
  const todayKey = getVietnamDayKey(now)
  if (accountId == null) {
    return {
      authenticated: false,
      todayKey,
      streakBoostActive: false,
      seedCounts: { seed_lotus: 0, seed_bamboo: 0, seed_bodhi: 0 },
      plots: Array.from({ length: GARDEN_PLOT_COUNT }, (_, i) => ({
        plotIndex: i,
        seedId: null,
        seedName: null,
        stage: 0,
        waterCount: 0,
        lastWateredDay: null,
        canWaterToday: false,
        canHarvest: false,
        rewardLabel: null
      }))
    }
  }

  const plotRows = await conn
    .prepare(
      `SELECT plot_index, seed_id, stage, water_count, last_watered_day
         FROM garden_plots
        WHERE account_id = ?`
    )
    .all<{
      plot_index: number
      seed_id: string
      stage: number
      water_count: number
      last_watered_day: string
    }>(accountId)

  const byPlot = new Map<number, (typeof plotRows)[number]>()
  for (const r of plotRows) {
    byPlot.set(Number(r.plot_index), r)
  }

  const invRows = await conn
    .prepare(
      `SELECT item_id, quantity
         FROM account_inventory
        WHERE account_id = ? AND item_id IN ('seed_lotus', 'seed_bamboo', 'seed_bodhi')`
    )
    .all<{ item_id: string; quantity: number }>(accountId)

  const seedCounts: Record<GardenSeedId, number> = {
    seed_lotus: 0,
    seed_bamboo: 0,
    seed_bodhi: 0
  }
  for (const r of invRows) {
    const k = String(r.item_id) as GardenSeedId
    if (k in seedCounts) seedCounts[k] = Number(r.quantity || 0)
  }

  const streakRow = await conn
    .prepare('SELECT current_streak FROM account_streaks WHERE account_id = ?')
    .get<{ current_streak: number }>(accountId)
  const streakBoostActive = Number(streakRow?.current_streak ?? 0) >= 3

  const plots: GardenPlotDto[] = Array.from({ length: GARDEN_PLOT_COUNT }, (_, i) => {
    const r = byPlot.get(i)
    if (!r) {
      return {
        plotIndex: i,
        seedId: null,
        seedName: null,
        stage: 0,
        waterCount: 0,
        lastWateredDay: null,
        canWaterToday: false,
        canHarvest: false,
        rewardLabel: null
      }
    }
    const seedId = r.seed_id as GardenSeedId
    const meta = GARDEN_SEEDS[seedId]
    const stage = Number(r.stage || 1)
    const lastWateredDay = String(r.last_watered_day || '')
    const canHarvest = stage >= GARDEN_MAX_STAGE
    const canWaterToday = !canHarvest && lastWateredDay !== todayKey
    return {
      plotIndex: i,
      seedId,
      seedName: meta?.name ?? seedId,
      stage,
      waterCount: Number(r.water_count || 1),
      lastWateredDay,
      canWaterToday,
      canHarvest,
      rewardLabel: meta?.rewardLabel ?? null
    }
  })

  return {
    authenticated: true,
    todayKey,
    streakBoostActive,
    seedCounts,
    plots
  }
}

export async function getGardenStatus(accountId: number | null, now = Date.now()): Promise<GardenStatusDto> {
  if (accountId != null) assertAccountId(accountId)
  const conn = await getDb()
  return buildGardenStatus(conn, accountId, now)
}

export async function plantGardenSeed(accountId: number, rawPlotIndex: unknown, rawSeedId: unknown, now = Date.now()) {
  assertAccountId(accountId)
  const plotIndex = assertPlotIndex(rawPlotIndex)
  const seedId = assertSeedId(rawSeedId)
  const todayKey = getVietnamDayKey(now)

  const status = await withTransaction(async (conn) => {
    const existing = await conn
      .prepare('SELECT 1 AS ok FROM garden_plots WHERE account_id = ? AND plot_index = ?')
      .get(accountId, plotIndex)
    if (existing) {
      apiError(400, 'plot_occupied', 'Ô đất này đang có cây sinh trưởng.')
    }

    const consumed = await consumeOneSeed(conn, accountId, seedId, now)
    if (!consumed) {
      apiError(400, 'no_seed', `Bạn chưa có ${GARDEN_SEEDS[seedId].name}. Hãy thỉnh tại Cửa Hàng!`)
    }

    await conn
      .prepare(
        `INSERT INTO garden_plots (account_id, plot_index, seed_id, stage, water_count, planted_at, last_watered_day, updated_at)
         VALUES (?, ?, ?, 1, 1, ?, ?, ?)`
      )
      .run(accountId, plotIndex, seedId, now, todayKey, now)

    return buildGardenStatus(conn, accountId, now)
  })

  const inventory = await getAccountInventory(accountId)
  return { ok: true, status, inventory }
}

export async function waterGardenPlot(accountId: number, rawPlotIndex: unknown, now = Date.now()) {
  assertAccountId(accountId)
  const plotIndex = assertPlotIndex(rawPlotIndex)
  const todayKey = getVietnamDayKey(now)

  const status = await withTransaction(async (conn) => {
    const row = await conn
      .prepare('SELECT seed_id, stage, water_count, last_watered_day FROM garden_plots WHERE account_id = ? AND plot_index = ?')
      .get<{ seed_id: string; stage: number; water_count: number; last_watered_day: string }>(accountId, plotIndex)

    if (!row) {
      apiError(400, 'plot_empty', 'Ô đất này chưa gieo hạt.')
    }
    const curStage = Number(row.stage || 1)
    if (curStage >= GARDEN_MAX_STAGE) {
      apiError(400, 'already_mature', 'Cây đã viên mãn, hãy thu hoạch lễ phẩm!')
    }
    if (row.last_watered_day === todayKey) {
      apiError(400, 'already_watered_today', 'Ô đất này đã được tưới nước trong hôm nay.')
    }

    const streakRow = await conn
      .prepare('SELECT current_streak FROM account_streaks WHERE account_id = ?')
      .get<{ current_streak: number }>(accountId)
    const step = Number(streakRow?.current_streak ?? 0) >= 3 ? 2 : 1
    const nextWaterCount = Number(row.water_count || 1) + 1
    const nextStage = Math.min(GARDEN_MAX_STAGE, curStage + step)

    await conn
      .prepare(
        `UPDATE garden_plots
            SET stage = ?, water_count = ?, last_watered_day = ?, updated_at = ?
          WHERE account_id = ? AND plot_index = ?`
      )
      .run(nextStage, nextWaterCount, todayKey, now, accountId, plotIndex)

    return buildGardenStatus(conn, accountId, now)
  })

  return { ok: true, status }
}

export async function harvestGardenPlot(accountId: number, rawPlotIndex: unknown, now = Date.now()) {
  assertAccountId(accountId)
  const plotIndex = assertPlotIndex(rawPlotIndex)

  const res = await withTransaction(async (conn) => {
    const row = await conn
      .prepare('SELECT seed_id, stage FROM garden_plots WHERE account_id = ? AND plot_index = ?')
      .get<{ seed_id: string; stage: number }>(accountId, plotIndex)

    if (!row) {
      apiError(400, 'plot_empty', 'Ô đất này chưa có cây để thu hoạch.')
    }
    if (Number(row.stage) < GARDEN_MAX_STAGE) {
      apiError(400, 'not_mature', 'Cây chưa đạt độ viên mãn để thu hoạch.')
    }

    const seedId = row.seed_id as GardenSeedId
    const meta = GARDEN_SEEDS[seedId] || GARDEN_SEEDS.seed_lotus

    await conn
      .prepare('DELETE FROM garden_plots WHERE account_id = ? AND plot_index = ?')
      .run(accountId, plotIndex)

    await conn
      .prepare(
        `INSERT INTO account_inventory (account_id, item_id, category, quantity, unlocked_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(account_id, item_id) DO UPDATE SET
           quantity = account_inventory.quantity + 1,
           updated_at = excluded.updated_at`
      )
      .run(accountId, meta.rewardItemId, meta.rewardCategory, now, now)

    const status = await buildGardenStatus(conn, accountId, now)
    return {
      reward: { itemId: meta.rewardItemId, label: meta.rewardLabel },
      status
    }
  })

  const inventory = await getAccountInventory(accountId)
  return { ok: true, reward: res.reward, status: res.status, inventory }
}

