export type XiangqiSide = 'red' | 'black'
export type XiangqiPieceType = 'K' | 'A' | 'E' | 'R' | 'H' | 'C' | 'P'

export interface XiangqiPiece {
  side: XiangqiSide
  type: XiangqiPieceType
}

export type XiangqiBoard = (XiangqiPiece | null)[][] // 10 rows x 9 cols

export interface XiangqiPos {
  r: number
  c: number
}

export interface XiangqiMove {
  from: XiangqiPos
  to: XiangqiPos
  captured?: XiangqiPiece | null
}

export const XIANGQI_ROWS = 10
export const XIANGQI_COLS = 9

export function getPieceChar(piece: XiangqiPiece): string {
  const redMap: Record<XiangqiPieceType, string> = {
    K: '帥',
    A: '仕',
    E: '相',
    R: '俥',
    H: '傌',
    C: '炮',
    P: '兵'
  }
  const blackMap: Record<XiangqiPieceType, string> = {
    K: '將',
    A: '士',
    E: '象',
    R: '車',
    H: '馬',
    C: '砲',
    P: '卒'
  }
  return piece.side === 'red' ? redMap[piece.type] : blackMap[piece.type]
}

export function getPieceViName(piece: XiangqiPiece): string {
  const map: Record<XiangqiPieceType, string> = {
    K: 'Tướng',
    A: 'Sĩ',
    E: 'Tượng',
    R: 'Xe',
    H: 'Mã',
    C: 'Pháo',
    P: piece.side === 'red' ? 'Binh' : 'Tốt'
  }
  return map[piece.type]
}

export function createInitialXiangqiBoard(): XiangqiBoard {
  const b: XiangqiBoard = Array.from({ length: XIANGQI_ROWS }, () => Array(XIANGQI_COLS).fill(null))
  const put = (r: number, c: number, side: XiangqiSide, type: XiangqiPieceType) => {
    b[r]![c] = { side, type }
  }

  // Black (top: rows 0..4)
  put(0, 0, 'black', 'R')
  put(0, 1, 'black', 'H')
  put(0, 2, 'black', 'E')
  put(0, 3, 'black', 'A')
  put(0, 4, 'black', 'K')
  put(0, 5, 'black', 'A')
  put(0, 6, 'black', 'E')
  put(0, 7, 'black', 'H')
  put(0, 8, 'black', 'R')
  put(2, 1, 'black', 'C')
  put(2, 7, 'black', 'C')
  for (const c of [0, 2, 4, 6, 8]) put(3, c, 'black', 'P')

  // Red (bottom: rows 5..9)
  put(9, 0, 'red', 'R')
  put(9, 1, 'red', 'H')
  put(9, 2, 'red', 'E')
  put(9, 3, 'red', 'A')
  put(9, 4, 'red', 'K')
  put(9, 5, 'red', 'A')
  put(9, 6, 'red', 'E')
  put(9, 7, 'red', 'H')
  put(9, 8, 'red', 'R')
  put(7, 1, 'red', 'C')
  put(7, 7, 'red', 'C')
  for (const c of [0, 2, 4, 6, 8]) put(6, c, 'red', 'P')

  return b
}

export function cloneXiangqiBoard(board: XiangqiBoard): XiangqiBoard {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

export function applyXiangqiMove(board: XiangqiBoard, move: XiangqiMove): XiangqiBoard {
  const next = cloneXiangqiBoard(board)
  next[move.to.r]![move.to.c] = next[move.from.r]![move.from.c]!
  next[move.from.r]![move.from.c] = null
  return next
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < XIANGQI_ROWS && c >= 0 && c < XIANGQI_COLS
}

function inPalace(r: number, c: number, side: XiangqiSide): boolean {
  if (c < 3 || c > 5) return false
  return side === 'red' ? r >= 7 && r <= 9 : r >= 0 && r <= 2
}

function ownSideHalf(r: number, side: XiangqiSide): boolean {
  return side === 'red' ? r >= 5 : r <= 4
}

function generatePseudoMovesForPiece(board: XiangqiBoard, r: number, c: number): XiangqiPos[] {
  const piece = board[r]![c]
  if (!piece) return []
  const { side, type } = piece
  const targets: XiangqiPos[] = []

  const canLand = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false
    const t = board[nr]![nc]
    return !t || t.side !== side
  }

  switch (type) {
    case 'K': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]
      for (const [dr, dc] of dirs) {
        const nr = r + dr!
        const nc = c + dc!
        if (inPalace(nr, nc, side) && canLand(nr, nc)) {
          targets.push({ r: nr, c: nc })
        }
      }
      break
    }
    case 'A': {
      const dirs = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      ]
      for (const [dr, dc] of dirs) {
        const nr = r + dr!
        const nc = c + dc!
        if (inPalace(nr, nc, side) && canLand(nr, nc)) {
          targets.push({ r: nr, c: nc })
        }
      }
      break
    }
    case 'E': {
      const dirs = [
        [-2, -2],
        [-2, 2],
        [2, -2],
        [2, 2]
      ]
      for (const [dr, dc] of dirs) {
        const nr = r + dr!
        const nc = c + dc!
        const eyeR = r + dr! / 2
        const eyeC = c + dc! / 2
        if (inBounds(nr, nc) && ownSideHalf(nr, side) && !board[eyeR]![eyeC] && canLand(nr, nc)) {
          targets.push({ r: nr, c: nc })
        }
      }
      break
    }
    case 'H': {
      const steps: Array<[number, number, number, number]> = [
        [-2, -1, -1, 0],
        [-2, 1, -1, 0],
        [2, -1, 1, 0],
        [2, 1, 1, 0],
        [-1, -2, 0, -1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [1, 2, 0, 1]
      ]
      for (const [dr, dc, legR, legC] of steps) {
        const lr = r + legR
        const lc = c + legC
        const nr = r + dr
        const nc = c + dc
        if (inBounds(nr, nc) && !board[lr]![lc] && canLand(nr, nc)) {
          targets.push({ r: nr, c: nc })
        }
      }
      break
    }
    case 'R': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]
      for (const [dr, dc] of dirs) {
        let nr = r + dr!
        let nc = c + dc!
        while (inBounds(nr, nc)) {
          const t = board[nr]![nc]
          if (!t) {
            targets.push({ r: nr, c: nc })
          } else {
            if (t.side !== side) targets.push({ r: nr, c: nc })
            break
          }
          nr += dr!
          nc += dc!
        }
      }
      break
    }
    case 'C': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]
      for (const [dr, dc] of dirs) {
        let nr = r + dr!
        let nc = c + dc!
        let jumped = false
        while (inBounds(nr, nc)) {
          const t = board[nr]![nc]
          if (!jumped) {
            if (!t) {
              targets.push({ r: nr, c: nc })
            } else {
              jumped = true
            }
          } else if (t) {
            if (t.side !== side) targets.push({ r: nr, c: nc })
            break
          }
          nr += dr!
          nc += dc!
        }
      }
      break
    }
    case 'P': {
      const forward = side === 'red' ? -1 : 1
      if (canLand(r + forward, c)) targets.push({ r: r + forward, c })
      const crossedRiver = side === 'red' ? r <= 4 : r >= 5
      if (crossedRiver) {
        if (canLand(r, c - 1)) targets.push({ r, c: c - 1 })
        if (canLand(r, c + 1)) targets.push({ r, c: c + 1 })
      }
      break
    }
  }

  return targets
}

function findKing(board: XiangqiBoard, side: XiangqiSide): XiangqiPos | null {
  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 3; c <= 5; c++) {
      const p = board[r]![c]
      if (p && p.side === side && p.type === 'K') return { r, c }
    }
  }
  return null
}

function kingsFacing(board: XiangqiBoard): boolean {
  const redK = findKing(board, 'red')
  const blackK = findKing(board, 'black')
  if (!redK || !blackK || redK.c !== blackK.c) return false
  for (let r = blackK.r + 1; r < redK.r; r++) {
    if (board[r]![redK.c]) return false
  }
  return true
}

export function isInCheck(board: XiangqiBoard, side: XiangqiSide): boolean {
  if (kingsFacing(board)) return true
  const kingPos = findKing(board, side)
  if (!kingPos) return true
  const enemy: XiangqiSide = side === 'red' ? 'black' : 'red'

  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 0; c < XIANGQI_COLS; c++) {
      const p = board[r]![c]
      if (!p || p.side !== enemy) continue
      const targets = generatePseudoMovesForPiece(board, r, c)
      if (targets.some((t) => t.r === kingPos.r && t.c === kingPos.c)) {
        return true
      }
    }
  }
  return false
}

export function getLegalMovesForPiece(board: XiangqiBoard, r: number, c: number): XiangqiPos[] {
  const p = board[r]![c]
  if (!p) return []
  const pseudo = generatePseudoMovesForPiece(board, r, c)
  return pseudo.filter((to) => {
    const next = applyXiangqiMove(board, { from: { r, c }, to })
    return !isInCheck(next, p.side)
  })
}

export function getAllLegalMoves(board: XiangqiBoard, side: XiangqiSide): XiangqiMove[] {
  const moves: XiangqiMove[] = []
  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 0; c < XIANGQI_COLS; c++) {
      const p = board[r]![c]
      if (!p || p.side !== side) continue
      const targets = getLegalMovesForPiece(board, r, c)
      for (const to of targets) {
        moves.push({ from: { r, c }, to, captured: board[to.r]![to.c] })
      }
    }
  }
  return moves
}

const PIECE_VALUES: Record<XiangqiPieceType, number> = {
  K: 10000,
  R: 900,
  C: 450,
  H: 400,
  E: 200,
  A: 200,
  P: 100
}

function evaluateBoard(board: XiangqiBoard, aiSide: XiangqiSide): number {
  let score = 0
  for (let r = 0; r < XIANGQI_ROWS; r++) {
    for (let c = 0; c < XIANGQI_COLS; c++) {
      const p = board[r]![c]
      if (!p) continue
      let val = PIECE_VALUES[p.type]
      // Bonus for crossed-river soldiers and central control
      if (p.type === 'P') {
        const crossed = p.side === 'red' ? r <= 4 : r >= 5
        if (crossed) val += 75
        if (c >= 3 && c <= 5) val += 20
      } else if (p.type === 'H' || p.type === 'C') {
        if (c >= 2 && c <= 6) val += 15
      }
      score += p.side === aiSide ? val : -val
    }
  }
  return score
}

function orderMoves(moves: XiangqiMove[]): XiangqiMove[] {
  return moves.sort((a, b) => {
    const va = a.captured ? PIECE_VALUES[a.captured.type] : 0
    const vb = b.captured ? PIECE_VALUES[b.captured.type] : 0
    return vb - va
  })
}

function alphabeta(
  board: XiangqiBoard,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiSide: XiangqiSide
): number {
  const currentSide: XiangqiSide = maximizing ? aiSide : aiSide === 'red' ? 'black' : 'red'
  const moves = getAllLegalMoves(board, currentSide)
  if (moves.length === 0) {
    return maximizing ? -9000 - depth * 10 : 9000 + depth * 10
  }
  if (depth <= 0) {
    return evaluateBoard(board, aiSide)
  }

  orderMoves(moves)

  if (maximizing) {
    let maxEval = -Infinity
    for (const m of moves) {
      const next = applyXiangqiMove(board, m)
      const ev = alphabeta(next, depth - 1, alpha, beta, false, aiSide)
      if (ev > maxEval) maxEval = ev
      if (ev > alpha) alpha = ev
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const m of moves) {
      const next = applyXiangqiMove(board, m)
      const ev = alphabeta(next, depth - 1, alpha, beta, true, aiSide)
      if (ev < minEval) minEval = ev
      if (ev < beta) beta = ev
      if (beta <= alpha) break
    }
    return minEval
  }
}

export function chooseBestXiangqiMove(board: XiangqiBoard, aiSide: XiangqiSide = 'black', depth = 3): XiangqiMove | null {
  const moves = orderMoves(getAllLegalMoves(board, aiSide))
  if (moves.length === 0) return null

  let bestMove = moves[0]!
  let bestScore = -Infinity

  for (const m of moves) {
    const next = applyXiangqiMove(board, m)
    const score = alphabeta(next, depth - 1, -Infinity, Infinity, false, aiSide)
    if (score > bestScore) {
      bestScore = score
      bestMove = m
    }
  }
  return bestMove
}

