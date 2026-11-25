/**
 * Thưởng MC khi thắng cờ dưới Bóng Bồ Đề (xem quy tắc ở `lib/games/boardGameRewards.ts`).
 *
 * - Client gọi `start` khi bắt đầu một ván để nhận mã phiên, sau đó gọi `win` kèm mã phiên khi thắng.
 * - Server kiểm tra thời gian chơi tối thiểu, mỗi môn chỉ thưởng ván thắng đầu tiên trong ngày,
 *   thắng đủ 5 môn thì thưởng thêm một lần. Mọi khoản cộng đều có bút toán `mc_ledger` (idempotent).
 */
import { randomBytes } from 'node:crypto'
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import {
  BOARD_GAME_ALL_CLEAR_BONUS,
  BOARD_GAME_IDS,
  BOARD_GAME_MAX_DAILY_MC,
  BOARD_GAME_MIN_SECONDS,
  BOARD_GAME_REWARD_PER_GAME,
  isBoardGameId,
  type BoardGameId
} from '../../../lib/games/boardGameRewards'
import { apiError } from './auth'
import { getDb, withTransaction, type DbConn } from './db'
import { credit } from './mcService'

export interface BoardGameStatusDto {
  authenticated: boolean
  todayKey: string
  /** Các môn đã thắng và nhận thưởng hôm nay. */
  wonGames: BoardGameId[]
  wonCount: number
  /** Số ván đã chơi hôm nay theo từng môn. */
  playedCounts: Record<BoardGameId, number>
  totalGames: number
  rewardPerGame: number
  allClearBonus: number
  maxDailyMc: number
  bonusClaimed: boolean
  /** Tổng MC đã nhận hôm nay từ cờ. */
  earnedTodayMc: number
}

export interface BoardGameWinResultDto {
  gameId: BoardGameId
  /** MC nhận được ở ván này từ thắng môn (0 nếu môn này đã thưởng hôm nay). */
  rewardMc: number
  /** MC thưởng thêm nếu vừa thắng đủ 5 môn. */
  bonusMc: number
  alreadyRewarded: boolean
  ledgerId: number | null
  status: BoardGameStatusDto
}

function emptyPlayedCounts(): Record<BoardGameId, number> {
  return { xiangqi: 0, oanquan: 0, caro: 0, chess: 0, go: 0 }
}

async function buildStatus(conn: DbConn, accountId: number, dayKey: string): Promise<BoardGameStatusDto> {
  const rows = await conn
    .prepare('SELECT game_id, reward_mc FROM board_game_wins WHERE account_id = ? AND day_key = ?')
    .all<{ game_id: string; reward_mc: number }>(accountId, dayKey)
  const runRows = await conn
    .prepare('SELECT game_id, COUNT(*) AS cnt FROM board_game_runs WHERE account_id = ? AND day_key = ? GROUP BY game_id')
    .all<{ game_id: string; cnt: number }>(accountId, dayKey)
  const bonus = await conn
    .prepare('SELECT reward_mc FROM board_game_bonus WHERE account_id = ? AND day_key = ?')
    .get<{ reward_mc: number }>(accountId, dayKey)

  const playedCounts = emptyPlayedCounts()
  for (const r of runRows) {
    const gid = String(r.game_id)
    if (isBoardGameId(gid)) {
      playedCounts[gid] = Number(r.cnt) || 0
    }
  }

  const wonGames = rows.map(r => String(r.game_id)).filter(isBoardGameId)
  const earned = rows.reduce((s, r) => s + Number(r.reward_mc), 0) + (bonus ? Number(bonus.reward_mc) : 0)
  return {
    authenticated: true,
    todayKey: dayKey,
    wonGames,
    wonCount: wonGames.length,
    playedCounts,
    totalGames: BOARD_GAME_IDS.length,
    rewardPerGame: BOARD_GAME_REWARD_PER_GAME,
    allClearBonus: BOARD_GAME_ALL_CLEAR_BONUS,
    maxDailyMc: BOARD_GAME_MAX_DAILY_MC,
    bonusClaimed: Boolean(bonus),
    earnedTodayMc: earned
  }
}

export async function getBoardGameStatus(accountId: number | null, now = Date.now()): Promise<BoardGameStatusDto> {
  const dayKey = getVietnamDayKey(now)
  if (!accountId) {
    return {
      authenticated: false,
      todayKey: dayKey,
      wonGames: [],
      wonCount: 0,
      playedCounts: emptyPlayedCounts(),
      totalGames: BOARD_GAME_IDS.length,
      rewardPerGame: BOARD_GAME_REWARD_PER_GAME,
      allClearBonus: BOARD_GAME_ALL_CLEAR_BONUS,
      maxDailyMc: BOARD_GAME_MAX_DAILY_MC,
      bonusClaimed: false,
      earnedTodayMc: 0
    }
  }
  return buildStatus(await getDb(), accountId, dayKey)
}

/** Mở một ván mới, trả mã phiên để lát nữa báo thắng. */
export async function startBoardGame(accountId: number, gameIdRaw: unknown, now = Date.now()): Promise<{ runToken: string }> {
  if (!isBoardGameId(gameIdRaw)) throw apiError(400, 'invalid_game', 'Môn cờ không hợp lệ')
  const runToken = 'bg_' + randomBytes(12).toString('hex')
  const db = await getDb()
  await db
    .prepare('INSERT INTO board_game_runs (run_token, account_id, game_id, day_key, started_at, completed_at) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(runToken, accountId, gameIdRaw, getVietnamDayKey(now), now)
  return { runToken }
}

/** Báo thắng một ván. Idempotent theo mã phiên; mỗi môn chỉ thưởng một lần mỗi ngày. */
export async function winBoardGame(accountId: number, runTokenRaw: unknown, now = Date.now()): Promise<BoardGameWinResultDto> {
  const runToken = typeof runTokenRaw === 'string' ? runTokenRaw.trim() : ''
  if (!runToken) throw apiError(400, 'invalid_run', 'Thiếu mã phiên chơi')
  const today = getVietnamDayKey(now)

  return withTransaction(async (conn): Promise<BoardGameWinResultDto> => {
    const run = await conn
      .prepare('SELECT run_token, game_id, day_key, started_at, completed_at FROM board_game_runs WHERE run_token = ? AND account_id = ?')
      .get<{ run_token: string; game_id: string; day_key: string; started_at: number; completed_at: number | null }>(runToken, accountId)
    if (!run || !isBoardGameId(run.game_id)) throw apiError(404, 'run_not_found', 'Phiên chơi không tồn tại')
    const gameId = run.game_id

    const result = async (rewardMc: number, bonusMc: number, already: boolean, ledgerId: number | null = null): Promise<BoardGameWinResultDto> => ({
      gameId,
      rewardMc,
      bonusMc,
      alreadyRewarded: already,
      ledgerId,
      status: await buildStatus(conn, accountId, today)
    })

    // Phiên đã báo thắng rồi, hoặc phiên của ngày khác: không thưởng thêm.
    if (run.completed_at || run.day_key !== today) return result(0, 0, true)

    const elapsedSec = (now - Number(run.started_at)) / 1000
    if (elapsedSec < BOARD_GAME_MIN_SECONDS[gameId]) {
      throw apiError(400, 'too_fast', 'Ván cờ kết thúc quá nhanh, chưa thể tính thắng.')
    }

    await conn.prepare('UPDATE board_game_runs SET completed_at = ? WHERE run_token = ?').run(now, runToken)

    const ins = await conn
      .prepare(
        'INSERT INTO board_game_wins (account_id, day_key, game_id, reward_mc, claimed_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, day_key, game_id) DO NOTHING'
      )
      .run(accountId, today, gameId, BOARD_GAME_REWARD_PER_GAME, now)
    if (Number(ins.changes) === 0) return result(0, 0, true)

    const winCred = await credit(accountId, BOARD_GAME_REWARD_PER_GAME, 'custom_service', {
      refType: 'board_game_win',
      refId: `bgwin_${accountId}_${today}_${gameId}`,
      metadata: { note: `Thắng ${gameId} dưới Bóng Bồ Đề (+${BOARD_GAME_REWARD_PER_GAME} MC)`, gameId, dayKey: today }
    })

    let bonusMc = 0
    const wonRows = await conn
      .prepare('SELECT COUNT(*) AS n FROM board_game_wins WHERE account_id = ? AND day_key = ?')
      .get<{ n: number }>(accountId, today)
    if (Number(wonRows?.n ?? 0) >= BOARD_GAME_IDS.length) {
      const bIns = await conn
        .prepare('INSERT INTO board_game_bonus (account_id, day_key, reward_mc, claimed_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id, day_key) DO NOTHING')
        .run(accountId, today, BOARD_GAME_ALL_CLEAR_BONUS, now)
      if (Number(bIns.changes) > 0) {
        await credit(accountId, BOARD_GAME_ALL_CLEAR_BONUS, 'custom_service', {
          refType: 'board_game_all_clear',
          refId: `bgbonus_${accountId}_${today}`,
          metadata: { note: `Thắng đủ 5 môn cờ trong ngày (+${BOARD_GAME_ALL_CLEAR_BONUS} MC)`, dayKey: today }
        })
        bonusMc = BOARD_GAME_ALL_CLEAR_BONUS
      }
    }

    return result(BOARD_GAME_REWARD_PER_GAME, bonusMc, false, winCred.ledgerId)
  })
}
