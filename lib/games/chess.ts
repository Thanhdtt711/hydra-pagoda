export type ChessSide = 'w' | 'b'
export type ChessPieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'

export interface ChessPiece {
  side: ChessSide
  type: ChessPieceType
}

export type ChessBoard = (ChessPiece | null)[][] // 8x8

export interface ChessPos {
  r: number
  c: number
}

export interface ChessMove {
  from: ChessPos
  to: ChessPos
  captured?: ChessPiece | null
  castle?: 'K' | 'Q'
  promote?: ChessPieceType
}

export interface ChessCastleRights {
  wK: boolean
  wQ: boolean
  bK: boolean
  bQ: boolean
}

export interface ChessState {
  board: ChessBoard
  turn: ChessSide
  rights: ChessCastleRights
}

export const CHESS_SIZE = 8

export function getChessSymbol(piece: ChessPiece): string {
  const whiteMap: Record<ChessPieceType, string> = {
    K: '♔',
    Q: '♕',
    R: '♖',
    B: '♗',
    N: '♘',
    P: '♙'
  }
  const blackMap: Record<ChessPieceType, string> = {
    K: '♚',
    Q: '♛',
    R: '♜',
    B: '♝',
    N: '♞',
    P: '♟'
  }
  return piece.side === 'w' ? whiteMap[piece.type] : blackMap[piece.type]
}

/** Biểu tượng quân cờ đặc ruột để tô màu Trắng/Đen tương phản cao trên bàn cờ Trắng - Đen */
export function getSolidChessSymbol(piece: ChessPiece): string {
  const solidMap: Record<ChessPieceType, string> = {
    K: '♚',
    Q: '♛',
    R: '♜',
    B: '♝',
    N: '♞',
    P: '♟'
  }
  return solidMap[piece.type]
}

export function createInitialChessState(): ChessState {
  const b: ChessBoard = Array.from({ length: 8 }, () => Array<ChessPiece | null>(8).fill(null))
  const back: ChessPieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  for (let c = 0; c < 8; c++) {
    b[0]![c] = { side: 'b', type: back[c]! }
    b[1]![c] = { side: 'b', type: 'P' }
    b[6]![c] = { side: 'w', type: 'P' }
    b[7]![c] = { side: 'w', type: back[c]! }
  }
  return {
    board: b,
    turn: 'w',
    rights: { wK: true, wQ: true, bK: true, bQ: true }
  }
}

export function cloneChessState(st: ChessState): ChessState {
  return {
    board: st.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    turn: st.turn,
    rights: { ...st.rights }
  }
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8
}

function generatePseudoMoves(st: ChessState, r: number, c: number, includeCastle = true): ChessMove[] {
  const p = st.board[r]![c]
  if (!p) return []
  const moves: ChessMove[] = []
  const { side, type } = p

  const addIfValid = (nr: number, nc: number, extra?: Partial<ChessMove>) => {
    if (!inBounds(nr, nc)) return false
    const t = st.board[nr]![nc]
    if (!t) {
      moves.push({ from: { r, c }, to: { r: nr, c: nc }, captured: null, ...extra })
      return true
    }
    if (t.side !== side) {
      moves.push({ from: { r, c }, to: { r: nr, c: nc }, captured: t, ...extra })
    }
    return false
  }

  switch (type) {
    case 'P': {
      const dir = side === 'w' ? -1 : 1
      const startRow = side === 'w' ? 6 : 1
      const promRow = side === 'w' ? 0 : 7
      if (inBounds(r + dir, c) && !st.board[r + dir]![c]) {
        moves.push({
          from: { r, c },
          to: { r: r + dir, c },
          promote: r + dir === promRow ? 'Q' : undefined
        })
        if (r === startRow && !st.board[r + dir * 2]![c]) {
          moves.push({ from: { r, c }, to: { r: r + dir * 2, c } })
        }
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir
        const nc = c + dc
        if (inBounds(nr, nc)) {
          const t = st.board[nr]![nc]
          if (t && t.side !== side) {
            moves.push({
              from: { r, c },
              to: { r: nr, c: nc },
              captured: t,
              promote: nr === promRow ? 'Q' : undefined
            })
          }
        }
      }
      break
    }
    case 'N': {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ]
      for (const [dr, dc] of jumps) addIfValid(r + dr!, c + dc!)
      break
    }
    case 'B':
    case 'R':
    case 'Q': {
      const dirs: Array<[number, number]> = []
      if (type === 'B' || type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1])
      if (type === 'R' || type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1])
      for (const [dr, dc] of dirs) {
        let nr = r + dr
        let nc = c + dc
        while (inBounds(nr, nc)) {
          const cont = addIfValid(nr, nc)
          if (!cont) break
          nr += dr
          nc += dc
        }
      }
      break
    }
    case 'K': {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) addIfValid(r + dr, c + dc)
        }
      }
      if (includeCastle && c === 4 && ((side === 'w' && r === 7) || (side === 'b' && r === 0))) {
        const canK = side === 'w' ? st.rights.wK : st.rights.bK
        const canQ = side === 'w' ? st.rights.wQ : st.rights.bQ
        if (canK && !st.board[r]![5] && !st.board[r]![6] && st.board[r]![7]?.type === 'R' && st.board[r]![7]?.side === side) {
          if (!isChessInCheck(st, side) && !isSquareAttacked(st, r, 5, side) && !isSquareAttacked(st, r, 6, side)) {
            moves.push({ from: { r, c }, to: { r, c: 6 }, castle: 'K' })
          }
        }
        if (canQ && !st.board[r]![3] && !st.board[r]![2] && !st.board[r]![1] && st.board[r]![0]?.type === 'R' && st.board[r]![0]?.side === side) {
          if (!isChessInCheck(st, side) && !isSquareAttacked(st, r, 3, side) && !isSquareAttacked(st, r, 2, side)) {
            moves.push({ from: { r, c }, to: { r, c: 2 }, castle: 'Q' })
          }
        }
      }
      break
    }
  }
  return moves
}

function isSquareAttacked(st: ChessState, tr: number, tc: number, victimSide: ChessSide): boolean {
  const enemy: ChessSide = victimSide === 'w' ? 'b' : 'w'
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = st.board[r]![c]
      if (!p || p.side !== enemy) continue
      const moves = generatePseudoMoves(st, r, c, false)
      if (moves.some((m) => m.to.r === tr && m.to.c === tc)) return true
    }
  }
  return false
}

export function isChessInCheck(st: ChessState, side: ChessSide): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = st.board[r]![c]
      if (p && p.side === side && p.type === 'K') {
        return isSquareAttacked(st, r, c, side)
      }
    }
  }
  return true
}

export function applyChessMove(st: ChessState, move: ChessMove): ChessState {
  const next = cloneChessState(st)
  const piece = next.board[move.from.r]![move.from.c]!
  next.board[move.to.r]![move.to.c] = move.promote ? { side: piece.side, type: move.promote } : piece
  next.board[move.from.r]![move.from.c] = null

  if (move.castle === 'K') {
    next.board[move.from.r]![5] = next.board[move.from.r]![7]!
    next.board[move.from.r]![7] = null
  } else if (move.castle === 'Q') {
    next.board[move.from.r]![3] = next.board[move.from.r]![0]!
    next.board[move.from.r]![0] = null
  }

  if (piece.type === 'K') {
    if (piece.side === 'w') {
      next.rights.wK = false
      next.rights.wQ = false
    } else {
      next.rights.bK = false
      next.rights.bQ = false
    }
  }
  if (piece.type === 'R') {
    if (move.from.r === 7 && move.from.c === 0) next.rights.wQ = false
    if (move.from.r === 7 && move.from.c === 7) next.rights.wK = false
    if (move.from.r === 0 && move.from.c === 0) next.rights.bQ = false
    if (move.from.r === 0 && move.from.c === 7) next.rights.bK = false
  }

  next.turn = piece.side === 'w' ? 'b' : 'w'
  return next
}

export function getLegalChessMovesForPiece(st: ChessState, r: number, c: number): ChessMove[] {
  const p = st.board[r]![c]
  if (!p) return []
  return generatePseudoMoves(st, r, c, true).filter((m) => {
    const next = applyChessMove(st, m)
    return !isChessInCheck(next, p.side)
  })
}

export function getAllLegalChessMoves(st: ChessState, side: ChessSide): ChessMove[] {
  const all: ChessMove[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = st.board[r]![c]
      if (!p || p.side !== side) continue
      all.push(...getLegalChessMovesForPiece(st, r, c))
    }
  }
  return all
}

const CHESS_VALUES: Record<ChessPieceType, number> = {
  K: 10000,
  Q: 900,
  R: 500,
  B: 330,
  N: 320,
  P: 100
}

function evaluateChess(st: ChessState, aiSide: ChessSide): number {
  let score = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = st.board[r]![c]
      if (!p) continue
      let val = CHESS_VALUES[p.type]
      if (p.type === 'P') {
        val += p.side === 'w' ? (6 - r) * 8 : (r - 1) * 8
      } else if (c >= 2 && c <= 5 && r >= 2 && r <= 5) {
        val += 14
      }
      score += p.side === aiSide ? val : -val
    }
  }
  return score
}

function orderChessMoves(moves: ChessMove[]): ChessMove[] {
  return moves.sort((a, b) => {
    const va = (a.captured ? CHESS_VALUES[a.captured.type] : 0) + (a.promote ? 800 : 0)
    const vb = (b.captured ? CHESS_VALUES[b.captured.type] : 0) + (b.promote ? 800 : 0)
    return vb - va
  })
}

function chessAlphaBeta(st: ChessState, depth: number, alpha: number, beta: number, maximizing: boolean, aiSide: ChessSide): number {
  const side: ChessSide = maximizing ? aiSide : aiSide === 'w' ? 'b' : 'w'
  const moves = getAllLegalChessMoves(st, side)
  if (moves.length === 0) {
    if (isChessInCheck(st, side)) {
      return maximizing ? -9500 - depth * 10 : 9500 + depth * 10
    }
    return 0 // stalemate
  }
  if (depth <= 0) return evaluateChess(st, aiSide)

  orderChessMoves(moves)

  if (maximizing) {
    let maxEval = -Infinity
    for (const m of moves) {
      const ev = chessAlphaBeta(applyChessMove(st, m), depth - 1, alpha, beta, false, aiSide)
      if (ev > maxEval) maxEval = ev
      if (ev > alpha) alpha = ev
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const m of moves) {
      const ev = chessAlphaBeta(applyChessMove(st, m), depth - 1, alpha, beta, true, aiSide)
      if (ev < minEval) minEval = ev
      if (ev < beta) beta = ev
      if (beta <= alpha) break
    }
    return minEval
  }
}

export function chooseBestChessMove(st: ChessState, aiSide: ChessSide = 'b', depth = 3): ChessMove | null {
  const moves = orderChessMoves(getAllLegalChessMoves(st, aiSide))
  if (moves.length === 0) return null
  let best = moves[0]!
  let bestScore = -Infinity
  for (const m of moves) {
    const sc = chessAlphaBeta(applyChessMove(st, m), depth - 1, -Infinity, Infinity, false, aiSide)
    if (sc > bestScore) {
      bestScore = sc
      best = m
    }
  }
  return best
}
