/**
 * Dịch vụ Đấu Cờ PvP Cược MC (Cờ Tướng, Cờ Vua, Cờ Caro, Cờ Vây).
 *
 * Nguyên tắc an toàn tài chính & chống gian lận:
 * - Toàn bộ luật cờ và kiểm tra nước đi hợp lệ chạy 100% phía server bằng 4 engine thuần trong `lib/games/`.
 * - Escrow MC nguyên tử trong `withTransaction` + đẩy chứng thực lên Hydra Head L2 (`scheduleHydraRecord`).
 * - Hỗ trợ `HYDRA_L2_STRICT`: khi bật, bắt buộc Hydra Head đang Open mới cho khóa/trả cược MC.
 * - Thắng ăn 95% tổng cược (pot = wager * 2); 5% phí bàn (rake) tự động chảy vào `mc_fund_state` theo tỷ lệ 55/5/40.
 * - Hòa hoàn trả 100% tiền cược cho cả hai bên (0 phí).
 */
import { randomBytes } from 'node:crypto'
import {
  createInitialXiangqiBoard,
  getLegalMovesForPiece,
  applyXiangqiMove,
  getAllLegalMoves,
  isInCheck,
  type XiangqiBoard,
  type XiangqiSide
} from '../../../lib/games/xiangqi.ts'
import {
  createInitialChessState,
  getLegalChessMovesForPiece,
  applyChessMove,
  getAllLegalChessMoves,
  isChessInCheck,
  type ChessState,
  type ChessPieceType,
  type ChessSide
} from '../../../lib/games/chess.ts'
import {
  createCaroBoard,
  checkCaroWinner,
  CARO_SIZE,
  type CaroBoard
} from '../../../lib/games/caro.ts'
import {
  createGoState,
  tryPlayGoMove,
  passGoTurn,
  scoreGoArea,
  GO_SIZE,
  type GoState
} from '../../../lib/games/go.ts'
import { splitSpentMc } from '../../../lib/mc/tokenomics.ts'
import type { AuthenticatedAccount } from '../wallet/auth.ts'
import { getDb, onAfterCommit, withTransaction, type DbConn } from '../wallet/db.ts'

async function assertHydraStrict(actionLabel: string): Promise<void> {
  if (process.env.MC_TEST_MODE === '1') return
  const mod = await import('../hydra/hydraQueue')
  mod.assertHydraReadyIfStrict(actionLabel)
}

function enqueueHydra(job: { ledgerId: number; accountId: number; deltaMc: number; balanceAfter: number; reason: string; refId: string }): void {
  if (process.env.MC_TEST_MODE === '1') return
  void import('../hydra/hydraQueue').then(mod => mod.scheduleHydraRecord(job)).catch(() => {})
}

function apiError(statusCode: number, code: string, message: string): Error & { statusCode: number; statusMessage: string; data: { code: string; message: string } } {
  const err = new Error(message) as Error & { statusCode: number; statusMessage: string; data: { code: string; message: string } }
  err.statusCode = statusCode
  err.statusMessage = code
  err.data = { code, message }
  return err
}

export type PvpGameId = 'xiangqi' | 'chess' | 'caro' | 'go'
export type PvpSide = 'p1' | 'p2'
export type PvpStatus = 'waiting' | 'playing' | 'finished' | 'cancelled'

export const PVP_GAME_IDS: readonly PvpGameId[] = ['xiangqi', 'chess', 'caro', 'go'] as const
export const PVP_ALLOWED_WAGERS: readonly number[] = [50, 100, 200, 500, 1000] as const
export const PVP_RAKE_BPS = 500 // 5%
export const PVP_TURN_TIMEOUT_MS = 90_000 // 90 giây mỗi nước đi
export const PVP_WAITING_EXPIRE_MS = 30 * 60_000 // Bàn chờ tự hủy sau 30 phút

export interface PvpMatchRow {
  match_id: string
  room_code: string
  game_id: PvpGameId
  wager_mc: number
  rake_bps: number
  status: PvpStatus
  host_account_id: number
  host_address: string
  host_name: string
  guest_account_id: number | null
  guest_address: string | null
  guest_name: string | null
  turn_side: PvpSide
  state_json: string
  move_count: number
  last_move_json: string | null
  winner_side: PvpSide | 'draw' | null
  end_reason: string | null
  draw_offer_by: PvpSide | null
  payout_mc: number
  rake_mc: number
  turn_deadline_at: number | null
  created_at: number
  started_at: number | null
  finished_at: number | null
  updated_at: number
}

export interface PvpMatchView {
  matchId: string
  roomCode: string
  gameId: PvpGameId
  wagerMc: number
  potMc: number
  rakeBps: number
  expectedPayoutMc: number
  expectedRakeMc: number
  status: PvpStatus
  mySide: PvpSide | null
  host: { address: string; shortAddress: string; name: string }
  guest: { address: string; shortAddress: string; name: string } | null
  turnSide: PvpSide
  state: unknown
  moveCount: number
  lastMove: unknown
  winnerSide: PvpSide | 'draw' | null
  endReason: string | null
  drawOfferBy: PvpSide | null
  payoutMc: number
  rakeMc: number
  turnDeadlineAt: number | null
  serverNow: number
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  inCheckSide?: 'p1' | 'p2' | null
  goScore?: { black: number; white: number } | null
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 16) return addr || ''
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`
}

function displayPlayerName(acc: AuthenticatedAccount): string {
  const n = (acc.displayName || '').trim()
  if (n && n.length <= 24) return n
  return shortAddr(acc.address)
}

function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = randomBytes(6)
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[buf[i]! % chars.length]
  return out
}

function createInitialGameState(gameId: PvpGameId): unknown {
  switch (gameId) {
    case 'xiangqi':
      return createInitialXiangqiBoard()
    case 'chess':
      return createInitialChessState()
    case 'caro':
      return createCaroBoard()
    case 'go':
      return createGoState()
  }
}

export function calcPvpSettlement(wagerMc: number, rakeBps = PVP_RAKE_BPS): { potMc: number; rakeMc: number; payoutMc: number } {
  const potMc = wagerMc * 2
  const rakeMc = Math.floor((potMc * rakeBps) / 10_000)
  const payoutMc = potMc - rakeMc
  return { potMc, rakeMc, payoutMc }
}

function toMatchView(row: PvpMatchRow, viewerAccountId: number | null, includeState = true): PvpMatchView {
  const { potMc, rakeMc, payoutMc } = calcPvpSettlement(row.wager_mc, row.rake_bps)
  const mySide: PvpSide | null =
    viewerAccountId === row.host_account_id
      ? 'p1'
      : viewerAccountId !== null && viewerAccountId === row.guest_account_id
        ? 'p2'
        : null

  let state: unknown = null
  let inCheckSide: 'p1' | 'p2' | null = null
  let goScore: { black: number; white: number } | null = null

  if (includeState) {
    try {
      state = JSON.parse(row.state_json)
      if (row.game_id === 'xiangqi' && Array.isArray(state)) {
        const b = state as XiangqiBoard
        if (isInCheck(b, 'red')) inCheckSide = 'p1'
        else if (isInCheck(b, 'black')) inCheckSide = 'p2'
      } else if (row.game_id === 'chess' && state && typeof state === 'object') {
        const st = state as ChessState
        if (isChessInCheck(st, 'w')) inCheckSide = 'p1'
        else if (isChessInCheck(st, 'b')) inCheckSide = 'p2'
      } else if (row.game_id === 'go' && state && typeof state === 'object') {
        const st = state as GoState
        if (st.gameOver || row.status === 'finished') {
          goScore = scoreGoArea(st.board)
        }
      }
    } catch {
      state = null
    }
  }

  let lastMove: unknown = null
  if (row.last_move_json) {
    try { lastMove = JSON.parse(row.last_move_json) } catch { lastMove = null }
  }

  return {
    matchId: row.match_id,
    roomCode: row.room_code,
    gameId: row.game_id,
    wagerMc: row.wager_mc,
    potMc,
    rakeBps: row.rake_bps,
    expectedPayoutMc: payoutMc,
    expectedRakeMc: rakeMc,
    status: row.status,
    mySide,
    host: {
      address: row.host_address,
      shortAddress: shortAddr(row.host_address),
      name: row.host_name
    },
    guest: row.guest_address
      ? {
          address: row.guest_address,
          shortAddress: shortAddr(row.guest_address),
          name: row.guest_name || shortAddr(row.guest_address)
        }
      : null,
    turnSide: row.turn_side,
    state,
    moveCount: row.move_count,
    lastMove,
    winnerSide: row.winner_side,
    endReason: row.end_reason,
    drawOfferBy: row.draw_offer_by,
    payoutMc: row.payout_mc,
    rakeMc: row.rake_mc,
    turnDeadlineAt: row.turn_deadline_at,
    serverNow: Date.now(),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    inCheckSide,
    goScore
  }
}

/** Trừ MC nguyên tử trong transaction + đẩy Hydra L2 sau commit. */
async function debitAccountInTx(
  db: DbConn,
  accountId: number,
  amount: number,
  reason: string,
  refId: string,
  note: string
): Promise<{ ledgerId: number; balanceAfter: number }> {
  const upd = await db
    .prepare('UPDATE accounts SET mc_balance = mc_balance - ? WHERE id = ? AND mc_balance >= ?')
    .run(amount, accountId, amount)
  if (upd.changes !== 1) {
    throw apiError(402, 'insufficient_mc', `Số dư MC không đủ để đặt cược ${amount.toLocaleString()} MC.`)
  }
  const acc = (await db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId)) as { mc_balance: number }
  const now = Date.now()
  const ins = await db
    .prepare(
      'INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(accountId, -amount, acc.mc_balance, reason, 'pvp_match', refId, JSON.stringify({ note }), now)
  const ledgerId = Number(ins.lastInsertRowid)
  onAfterCommit(() => {
    enqueueHydra({
      ledgerId,
      accountId,
      deltaMc: -amount,
      balanceAfter: acc.mc_balance,
      reason,
      refId
    })
  })
  return { ledgerId, balanceAfter: acc.mc_balance }
}

/** Cộng MC nguyên tử trong transaction + đẩy Hydra L2 sau commit. */
async function creditAccountInTx(
  db: DbConn,
  accountId: number,
  amount: number,
  reason: string,
  refId: string,
  note: string
): Promise<{ ledgerId: number; balanceAfter: number }> {
  await db.prepare('UPDATE accounts SET mc_balance = mc_balance + ? WHERE id = ?').run(amount, accountId)
  const acc = (await db.prepare('SELECT mc_balance FROM accounts WHERE id = ?').get(accountId)) as { mc_balance: number }
  const now = Date.now()
  const ins = await db
    .prepare(
      'INSERT INTO mc_ledger (account_id, delta_mc, balance_after, reason, ref_type, ref_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(accountId, amount, acc.mc_balance, reason, 'pvp_match', refId, JSON.stringify({ note }), now)
  const ledgerId = Number(ins.lastInsertRowid)
  onAfterCommit(() => {
    enqueueHydra({
      ledgerId,
      accountId,
      deltaMc: amount,
      balanceAfter: acc.mc_balance,
      reason,
      refId
    })
  })
  return { ledgerId, balanceAfter: acc.mc_balance }
}

/** Kết thúc ván đấu và thanh toán MC nguyên tử (chống trả thưởng trùng bằng WHERE status = 'playing'). */
async function settleMatchInTx(
  db: DbConn,
  row: PvpMatchRow,
  winnerSide: PvpSide | 'draw',
  endReason: string,
  nextStateJson?: string,
  nextMoveCount?: number,
  nextLastMoveJson?: string | null
): Promise<PvpMatchRow> {
  const now = Date.now()
  const { rakeMc, payoutMc } = winnerSide === 'draw'
    ? { rakeMc: 0, payoutMc: row.wager_mc }
    : calcPvpSettlement(row.wager_mc, row.rake_bps)

  const stateJson = nextStateJson ?? row.state_json
  const moveCount = nextMoveCount ?? row.move_count
  const lastMoveJson = nextLastMoveJson !== undefined ? nextLastMoveJson : row.last_move_json

  const upd = await db
    .prepare(
      `UPDATE pvp_board_matches
       SET status = 'finished',
           winner_side = ?,
           end_reason = ?,
           draw_offer_by = NULL,
           state_json = ?,
           move_count = ?,
           last_move_json = ?,
           payout_mc = ?,
           rake_mc = ?,
           turn_deadline_at = NULL,
           finished_at = ?,
           updated_at = ?
       WHERE match_id = ? AND status = 'playing'`
    )
    .run(winnerSide, endReason, stateJson, moveCount, lastMoveJson, payoutMc, rakeMc, now, now, row.match_id)

  if (upd.changes !== 1) {
    // Ván đã được kết thúc bởi request khác -> đọc lại trạng thái mới nhất
    const latest = (await db.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(row.match_id)) as PvpMatchRow
    return latest
  }

  if (winnerSide === 'draw') {
    await creditAccountInTx(
      db,
      row.host_account_id,
      row.wager_mc,
      'pvp_match_draw_refund',
      `pvp_draw:${row.match_id}:p1`,
      `Hoàn cược 100% ván hòa ${row.game_id} (#${row.room_code})`
    )
    if (row.guest_account_id) {
      await creditAccountInTx(
        db,
        row.guest_account_id,
        row.wager_mc,
        'pvp_match_draw_refund',
        `pvp_draw:${row.match_id}:p2`,
        `Hoàn cược 100% ván hòa ${row.game_id} (#${row.room_code})`
      )
    }
  } else {
    const winnerAccountId = winnerSide === 'p1' ? row.host_account_id : row.guest_account_id!
    await creditAccountInTx(
      db,
      winnerAccountId,
      payoutMc,
      'pvp_match_win',
      `pvp_win:${row.match_id}`,
      `Thắng PvP ${row.game_id} (#${row.room_code}) - nhận ${payoutMc} MC (phí bàn ${rakeMc} MC)`
    )
    if (rakeMc > 0) {
      const { toQuest, toBurn, toOps } = splitSpentMc(rakeMc)
      await db
        .prepare(
          'UPDATE mc_fund_state SET quest_recycled = quest_recycled + ?, burned_mc = burned_mc + ?, ops_mc = ops_mc + ?, updated_at = ? WHERE id = 1'
        )
        .run(toQuest, toBurn, toOps, now)
    }
  }

  return (await db.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(row.match_id)) as PvpMatchRow
}

/** Dọn các bàn chờ quá hạn 30 phút và hoàn 100% cược cho chủ bàn. */
async function expireStaleWaitingMatches(): Promise<void> {
  const db = await getDb()
  const cutoff = Date.now() - PVP_WAITING_EXPIRE_MS
  const stale = (await db
    .prepare("SELECT * FROM pvp_board_matches WHERE status = 'waiting' AND created_at < ? LIMIT 10")
    .all(cutoff)) as PvpMatchRow[]
  for (const row of stale) {
    try {
      await withTransaction(async (tx) => {
        const upd = await tx
          .prepare("UPDATE pvp_board_matches SET status = 'cancelled', end_reason = 'expired', updated_at = ? WHERE match_id = ? AND status = 'waiting'")
          .run(Date.now(), row.match_id)
        if (upd.changes === 1) {
          await creditAccountInTx(
            tx,
            row.host_account_id,
            row.wager_mc,
            'pvp_escrow_refund',
            `pvp_refund:${row.match_id}`,
            `Hoàn cược bàn PvP quá hạn chờ (#${row.room_code})`
          )
        }
      })
    } catch {
      /* bỏ qua lỗi nhỏ khi dọn nền */
    }
  }
}

export async function createPvpMatch(
  account: AuthenticatedAccount,
  gameId: string,
  wagerMc: number
): Promise<PvpMatchView> {
  if (!PVP_GAME_IDS.includes(gameId as PvpGameId)) {
    throw apiError(400, 'invalid_game', 'Chỉ hỗ trợ PvP cho 4 môn: Cờ Tướng, Cờ Vua, Cờ Caro, Cờ Vây.')
  }
  const wager = Math.floor(Number(wagerMc))
  if (!PVP_ALLOWED_WAGERS.includes(wager)) {
    throw apiError(400, 'invalid_wager', `Mức cược không hợp lệ. Chọn: ${PVP_ALLOWED_WAGERS.join(', ')} MC.`)
  }
  await assertHydraStrict('tạo bàn đấu PvP cược MC')
  await expireStaleWaitingMatches()

  const gid = gameId as PvpGameId
  const matchId = `pvp_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
  const roomCode = genRoomCode()
  const stateJson = JSON.stringify(createInitialGameState(gid))
  const hostName = displayPlayerName(account)
  const now = Date.now()

  const row = await withTransaction(async (tx) => {
    const active = (await tx
      .prepare(
        `SELECT match_id, room_code, status FROM pvp_board_matches
         WHERE (host_account_id = ? OR guest_account_id = ?) AND status IN ('waiting', 'playing')
         LIMIT 1`
      )
      .get(account.id, account.id)) as { match_id: string; room_code: string; status: string } | undefined

    if (active) {
      throw apiError(
        409,
        'already_in_match',
        `Bạn đang ở trong bàn #${active.room_code} (${active.status === 'waiting' ? 'đang chờ' : 'đang đấu'}). Hãy hoàn tất hoặc hủy bàn cũ trước.`
      )
    }

    await debitAccountInTx(
      tx,
      account.id,
      wager,
      'pvp_escrow_lock',
      `pvp_lock:${matchId}:p1`,
      `Đặt cược tạo bàn PvP ${gid} (#${roomCode})`
    )

    await tx
      .prepare(
        `INSERT INTO pvp_board_matches (
          match_id, room_code, game_id, wager_mc, rake_bps, status,
          host_account_id, host_address, host_name, turn_side, state_json,
          move_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?, ?, 'p1', ?, 0, ?, ?)`
      )
      .run(matchId, roomCode, gid, wager, PVP_RAKE_BPS, account.id, account.address, hostName, stateJson, now, now)

    return (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(matchId)) as PvpMatchRow
  })

  return toMatchView(row, account.id, true)
}

export async function cancelPvpMatch(account: AuthenticatedAccount, matchId: string): Promise<PvpMatchView> {
  if (!matchId) throw apiError(400, 'invalid_match', 'Thiếu mã trận đấu.')
  await assertHydraStrict('hủy bàn đấu PvP')

  const row = await withTransaction(async (tx) => {
    const existing = (await tx
      .prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?')
      .get(matchId)) as PvpMatchRow | undefined
    if (!existing) throw apiError(404, 'match_not_found', 'Không tìm thấy bàn đấu.')
    if (existing.host_account_id !== account.id) {
      throw apiError(403, 'forbidden', 'Chỉ chủ bàn mới có thể hủy bàn đang chờ.')
    }
    if (existing.status !== 'waiting') {
      throw apiError(409, 'cannot_cancel', 'Bàn đấu đã bắt đầu hoặc đã kết thúc, không thể hủy.')
    }

    const now = Date.now()
    const upd = await tx
      .prepare("UPDATE pvp_board_matches SET status = 'cancelled', end_reason = 'cancelled', updated_at = ? WHERE match_id = ? AND status = 'waiting'")
      .run(now, matchId)
    if (upd.changes !== 1) {
      throw apiError(409, 'cannot_cancel', 'Bàn đấu vừa có người tham gia, không thể hủy.')
    }

    await creditAccountInTx(
      tx,
      account.id,
      existing.wager_mc,
      'pvp_escrow_refund',
      `pvp_refund:${matchId}`,
      `Hoàn 100% cược khi hủy bàn PvP (#${existing.room_code})`
    )

    return (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(matchId)) as PvpMatchRow
  })

  return toMatchView(row, account.id, false)
}

export async function joinPvpMatch(
  account: AuthenticatedAccount,
  opts: { matchId?: string; roomCode?: string }
): Promise<PvpMatchView> {
  const matchId = (opts.matchId || '').trim()
  const roomCode = (opts.roomCode || '').trim().toUpperCase()
  if (!matchId && !roomCode) {
    throw apiError(400, 'invalid_match', 'Vui lòng chọn bàn hoặc nhập mã phòng 6 ký tự.')
  }
  await assertHydraStrict('tham gia bàn đấu PvP cược MC')
  await expireStaleWaitingMatches()

  const guestName = displayPlayerName(account)

  const row = await withTransaction(async (tx) => {
    const target = (matchId
      ? await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(matchId)
      : await tx.prepare("SELECT * FROM pvp_board_matches WHERE room_code = ? AND status = 'waiting' ORDER BY created_at DESC LIMIT 1").get(roomCode)) as PvpMatchRow | undefined

    if (!target) throw apiError(404, 'match_not_found', 'Không tìm thấy bàn đang chờ với mã này.')
    if (target.status !== 'waiting') throw apiError(409, 'match_not_waiting', 'Bàn đấu đã đủ người hoặc đã hủy.')
    if (target.host_account_id === account.id) {
      throw apiError(400, 'cannot_join_own', 'Bạn không thể tự vào bàn của chính mình.')
    }

    const active = (await tx
      .prepare(
        `SELECT match_id, room_code FROM pvp_board_matches
         WHERE (host_account_id = ? OR guest_account_id = ?) AND status IN ('waiting', 'playing')
         LIMIT 1`
      )
      .get(account.id, account.id)) as { match_id: string; room_code: string } | undefined
    if (active) {
      throw apiError(409, 'already_in_match', `Bạn đang ở trong bàn #${active.room_code}. Hãy hoàn tất hoặc hủy trước.`)
    }

    const now = Date.now()
    const deadline = now + PVP_TURN_TIMEOUT_MS
    const upd = await tx
      .prepare(
        `UPDATE pvp_board_matches
         SET status = 'playing',
             guest_account_id = ?,
             guest_address = ?,
             guest_name = ?,
             started_at = ?,
             turn_deadline_at = ?,
             updated_at = ?
         WHERE match_id = ? AND status = 'waiting'`
      )
      .run(account.id, account.address, guestName, now, deadline, now, target.match_id)

    if (upd.changes !== 1) {
      throw apiError(409, 'match_already_taken', 'Bàn này vừa có người khác vào trước mất rồi.')
    }

    await debitAccountInTx(
      tx,
      account.id,
      target.wager_mc,
      'pvp_escrow_lock',
      `pvp_lock:${target.match_id}:p2`,
      `Đặt cược tham gia PvP ${target.game_id} (#${target.room_code})`
    )

    return (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(target.match_id)) as PvpMatchRow
  })

  return toMatchView(row, account.id, true)
}

/** Nếu bàn đang chơi đã quá `turn_deadline_at`, tự động xử thua hết giờ. */
async function checkAndSettleTimeout(row: PvpMatchRow): Promise<PvpMatchRow> {
  if (row.status !== 'playing' || !row.turn_deadline_at) return row
  if (Date.now() <= row.turn_deadline_at) return row
  const winnerSide: PvpSide = row.turn_side === 'p1' ? 'p2' : 'p1'
  return withTransaction(async (tx) => {
    const fresh = (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(row.match_id)) as PvpMatchRow
    if (!fresh || fresh.status !== 'playing' || !fresh.turn_deadline_at || Date.now() <= fresh.turn_deadline_at) {
      return fresh || row
    }
    return settleMatchInTx(tx, fresh, winnerSide, 'timeout')
  })
}

export async function getPvpMatchState(account: AuthenticatedAccount, matchId: string): Promise<PvpMatchView> {
  const db = await getDb()
  const row = (await db.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(matchId)) as PvpMatchRow | undefined
  if (!row) throw apiError(404, 'match_not_found', 'Không tìm thấy bàn đấu.')
  const checked = await checkAndSettleTimeout(row)
  return toMatchView(checked, account.id, true)
}

export async function listPvpLobby(account: AuthenticatedAccount): Promise<{
  activeMatch: PvpMatchView | null
  waitingMatches: PvpMatchView[]
  recentMatches: PvpMatchView[]
}> {
  await expireStaleWaitingMatches()
  const db = await getDb()

  const activeRow = (await db
    .prepare(
      `SELECT * FROM pvp_board_matches
       WHERE (host_account_id = ? OR guest_account_id = ?) AND status IN ('waiting', 'playing')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(account.id, account.id)) as PvpMatchRow | undefined

  const checkedActive = activeRow ? await checkAndSettleTimeout(activeRow) : null
  const activeMatch = checkedActive && (checkedActive.status === 'waiting' || checkedActive.status === 'playing')
    ? toMatchView(checkedActive, account.id, true)
    : null

  const waitingRows = (await db
    .prepare("SELECT * FROM pvp_board_matches WHERE status = 'waiting' ORDER BY created_at DESC LIMIT 30")
    .all()) as PvpMatchRow[]

  const recentRows = (await db
    .prepare(
      `SELECT * FROM pvp_board_matches
       WHERE (host_account_id = ? OR guest_account_id = ?) AND status = 'finished'
       ORDER BY finished_at DESC LIMIT 10`
    )
    .all(account.id, account.id)) as PvpMatchRow[]

  return {
    activeMatch,
    waitingMatches: waitingRows.map(r => toMatchView(r, account.id, false)),
    recentMatches: recentRows.map(r => toMatchView(r, account.id, false))
  }
}

export interface PvpMovePayload {
  from?: { r: number; c: number }
  to?: { r: number; c: number }
  r?: number
  c?: number
  pass?: boolean
  promote?: ChessPieceType
}

export async function submitPvpMove(
  account: AuthenticatedAccount,
  matchId: string,
  move: PvpMovePayload
): Promise<PvpMatchView> {
  if (!matchId) throw apiError(400, 'invalid_match', 'Thiếu mã bàn đấu.')

  const updated = await withTransaction(async (tx) => {
    const row = (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(matchId)) as PvpMatchRow | undefined
    if (!row) throw apiError(404, 'match_not_found', 'Không tìm thấy bàn đấu.')
    if (row.status !== 'playing') throw apiError(409, 'match_not_playing', 'Ván đấu chưa bắt đầu hoặc đã kết thúc.')

    const mySide: PvpSide | null =
      row.host_account_id === account.id ? 'p1' : row.guest_account_id === account.id ? 'p2' : null
    if (!mySide) throw apiError(403, 'not_a_player', 'Bạn không phải người chơi trong bàn này.')

    const now = Date.now()
    if (row.turn_deadline_at && now > row.turn_deadline_at) {
      const winnerSide: PvpSide = row.turn_side === 'p1' ? 'p2' : 'p1'
      return settleMatchInTx(tx, row, winnerSide, 'timeout')
    }

    if (row.turn_side !== mySide) {
      throw apiError(409, 'not_your_turn', 'Chưa tới lượt đi của bạn.')
    }

    const oppSide: PvpSide = mySide === 'p1' ? 'p2' : 'p1'
    let nextState: unknown
    let lastMoveObj: unknown
    let winnerSide: PvpSide | 'draw' | null = null
    let endReason: string | null = null

    if (row.game_id === 'xiangqi') {
      const board = JSON.parse(row.state_json) as XiangqiBoard
      const from = move.from
      const to = move.to
      if (!from || !to) throw apiError(400, 'invalid_move', 'Thiếu tọa độ nước đi Cờ Tướng.')
      const piece = board[from.r]?.[from.c]
      const expectedSide: XiangqiSide = mySide === 'p1' ? 'red' : 'black'
      if (!piece || piece.side !== expectedSide) {
        throw apiError(400, 'invalid_move', 'Quân cờ không thuộc phe của bạn.')
      }
      const legals = getLegalMovesForPiece(board, from.r, from.c)
      if (!legals.some(t => t.r === to.r && t.c === to.c)) {
        throw apiError(400, 'illegal_move', 'Nước đi Cờ Tướng không hợp lệ.')
      }
      const nextBoard = applyXiangqiMove(board, { from, to })
      nextState = nextBoard
      lastMoveObj = { from, to }
      const oppColor: XiangqiSide = oppSide === 'p1' ? 'red' : 'black'
      if (getAllLegalMoves(nextBoard, oppColor).length === 0) {
        winnerSide = mySide
        endReason = 'checkmate'
      }
    } else if (row.game_id === 'chess') {
      const st = JSON.parse(row.state_json) as ChessState
      const from = move.from
      const to = move.to
      if (!from || !to) throw apiError(400, 'invalid_move', 'Thiếu tọa độ nước đi Cờ Vua.')
      const expectedColor: ChessSide = mySide === 'p1' ? 'w' : 'b'
      if (st.turn !== expectedColor) throw apiError(409, 'not_your_turn', 'Sai lượt Cờ Vua.')
      const legals = getLegalChessMovesForPiece(st, from.r, from.c)
      const matched = legals.find(m => m.to.r === to.r && m.to.c === to.c && (!move.promote || m.promote === move.promote))
      if (!matched) {
        throw apiError(400, 'illegal_move', 'Nước đi Cờ Vua không hợp lệ.')
      }
      const nextSt = applyChessMove(st, matched)
      nextState = nextSt
      lastMoveObj = { from: matched.from, to: matched.to, castle: matched.castle, promote: matched.promote }
      const oppMoves = getAllLegalChessMoves(nextSt, nextSt.turn)
      if (oppMoves.length === 0) {
        if (isChessInCheck(nextSt, nextSt.turn)) {
          winnerSide = mySide
          endReason = 'checkmate'
        } else {
          winnerSide = 'draw'
          endReason = 'stalemate'
        }
      }
    } else if (row.game_id === 'caro') {
      const board = JSON.parse(row.state_json) as CaroBoard
      const r = Number(move.r)
      const c = Number(move.c)
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= CARO_SIZE || c < 0 || c >= CARO_SIZE) {
        throw apiError(400, 'invalid_move', 'Tọa độ Caro nằm ngoài bàn 15x15.')
      }
      if (board[r]![c] !== null) {
        throw apiError(400, 'illegal_move', 'Ô này đã có quân cờ.')
      }
      const mark = mySide === 'p1' ? 'X' : 'O'
      board[r]![c] = mark
      nextState = board
      lastMoveObj = { r, c, mark }
      const check = checkCaroWinner(board)
      if (check.winner === 'X' || check.winner === 'O') {
        winnerSide = check.winner === 'X' ? 'p1' : 'p2'
        endReason = 'five_in_row'
        lastMoveObj = { r, c, mark, winLine: check.line }
      } else if (check.winner === 'draw') {
        winnerSide = 'draw'
        endReason = 'board_full'
      }
    } else if (row.game_id === 'go') {
      const st = JSON.parse(row.state_json) as GoState
      const expectedColor = mySide === 'p1' ? 'B' : 'W'
      if (st.turn !== expectedColor) throw apiError(409, 'not_your_turn', 'Sai lượt Cờ Vây.')
      let nextSt: GoState
      if (move.pass) {
        nextSt = passGoTurn(st)
        lastMoveObj = { pass: true, side: expectedColor }
      } else {
        const r = Number(move.r)
        const c = Number(move.c)
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= GO_SIZE || c < 0 || c >= GO_SIZE) {
          throw apiError(400, 'invalid_move', 'Tọa độ Cờ Vây nằm ngoài bàn 9x9.')
        }
        const res = tryPlayGoMove(st, r, c)
        if (!res.ok || !res.nextState) {
          throw apiError(400, 'illegal_move', 'Nước đi Cờ Vây không hợp lệ (tự sát hoặc luật Ko).')
        }
        nextSt = res.nextState
        lastMoveObj = { r, c, side: expectedColor, capturedCount: res.capturedCount ?? 0 }
      }
      nextState = nextSt
      if (nextSt.gameOver) {
        const score = scoreGoArea(nextSt.board)
        winnerSide = score.black > score.white ? 'p1' : 'p2'
        endReason = 'area_score'
      }
    }

    const nextStateJson = JSON.stringify(nextState)
    const nextMoveCount = row.move_count + 1
    const nextLastMoveJson = JSON.stringify(lastMoveObj)

    if (winnerSide && endReason) {
      return settleMatchInTx(tx, row, winnerSide, endReason, nextStateJson, nextMoveCount, nextLastMoveJson)
    }

    const nextDeadline = now + PVP_TURN_TIMEOUT_MS
    await tx
      .prepare(
        `UPDATE pvp_board_matches
         SET state_json = ?,
             turn_side = ?,
             move_count = ?,
             last_move_json = ?,
             draw_offer_by = NULL,
             turn_deadline_at = ?,
             updated_at = ?
         WHERE match_id = ? AND status = 'playing'`
      )
      .run(nextStateJson, oppSide, nextMoveCount, nextLastMoveJson, nextDeadline, now, row.match_id)

    return (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(row.match_id)) as PvpMatchRow
  })

  return toMatchView(updated, account.id, true)
}

export async function performPvpAction(
  account: AuthenticatedAccount,
  matchId: string,
  action: 'resign' | 'offer_draw' | 'accept_draw' | 'reject_draw' | 'claim_timeout'
): Promise<PvpMatchView> {
  if (!matchId) throw apiError(400, 'invalid_match', 'Thiếu mã bàn đấu.')

  const updated = await withTransaction(async (tx) => {
    const row = (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(matchId)) as PvpMatchRow | undefined
    if (!row) throw apiError(404, 'match_not_found', 'Không tìm thấy bàn đấu.')
    if (row.status !== 'playing') throw apiError(409, 'match_not_playing', 'Ván đấu không còn đang diễn ra.')

    const mySide: PvpSide | null =
      row.host_account_id === account.id ? 'p1' : row.guest_account_id === account.id ? 'p2' : null
    if (!mySide) throw apiError(403, 'not_a_player', 'Bạn không phải người chơi trong bàn này.')
    const oppSide: PvpSide = mySide === 'p1' ? 'p2' : 'p1'
    const now = Date.now()

    if (action === 'resign') {
      return settleMatchInTx(tx, row, oppSide, 'resign')
    }
    if (action === 'claim_timeout') {
      if (!row.turn_deadline_at || now <= row.turn_deadline_at) {
        throw apiError(409, 'not_timed_out', 'Đối thủ vẫn còn thời gian suy nghĩ.')
      }
      const winner: PvpSide = row.turn_side === 'p1' ? 'p2' : 'p1'
      return settleMatchInTx(tx, row, winner, 'timeout')
    }
    if (action === 'offer_draw') {
      await tx
        .prepare('UPDATE pvp_board_matches SET draw_offer_by = ?, updated_at = ? WHERE match_id = ? AND status = ?')
        .run(mySide, now, row.match_id, 'playing')
      return (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(row.match_id)) as PvpMatchRow
    }
    if (action === 'accept_draw') {
      if (row.draw_offer_by !== oppSide) {
        throw apiError(409, 'no_draw_offer', 'Đối thủ chưa gửi đề nghị hòa.')
      }
      return settleMatchInTx(tx, row, 'draw', 'draw_agreement')
    }
    if (action === 'reject_draw') {
      await tx
        .prepare('UPDATE pvp_board_matches SET draw_offer_by = NULL, updated_at = ? WHERE match_id = ? AND status = ?')
        .run(now, row.match_id, 'playing')
      return (await tx.prepare('SELECT * FROM pvp_board_matches WHERE match_id = ?').get(row.match_id)) as PvpMatchRow
    }
    throw apiError(400, 'invalid_action', 'Hành động không hợp lệ.')
  })

  return toMatchView(updated, account.id, true)
}
