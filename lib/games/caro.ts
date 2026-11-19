export type CaroCell = 'X' | 'O' | null
export type CaroBoard = CaroCell[][] // 15 x 15

export interface CaroPos {
  r: number
  c: number
}

export const CARO_SIZE = 15

export function createCaroBoard(): CaroBoard {
  return Array.from({ length: CARO_SIZE }, () => Array<CaroCell>(CARO_SIZE).fill(null))
}

export function cloneCaroBoard(board: CaroBoard): CaroBoard {
  return board.map((row) => [...row])
}

const DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
]

export function checkCaroWinner(board: CaroBoard): { winner: 'X' | 'O' | 'draw' | null; line: CaroPos[] } {
  let hasEmpty = false
  for (let r = 0; r < CARO_SIZE; r++) {
    for (let c = 0; c < CARO_SIZE; c++) {
      const cell = board[r]![c]
      if (!cell) {
        hasEmpty = true
        continue
      }
      for (const [dr, dc] of DIRS) {
        const line: CaroPos[] = [{ r, c }]
        for (let k = 1; k < 5; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= CARO_SIZE || nc < 0 || nc >= CARO_SIZE || board[nr]![nc] !== cell) break
          line.push({ r: nr, c: nc })
        }
        if (line.length === 5) {
          return { winner: cell, line }
        }
      }
    }
  }
  return { winner: hasEmpty ? null : 'draw', line: [] }
}

function scoreLinePattern(count: number, openEnds: number): number {
  if (count >= 5) return 100_000
  if (count === 4) {
    if (openEnds === 2) return 25_000
    if (openEnds === 1) return 4_500
  }
  if (count === 3) {
    if (openEnds === 2) return 3_200
    if (openEnds === 1) return 450
  }
  if (count === 2) {
    if (openEnds === 2) return 280
    if (openEnds === 1) return 45
  }
  if (count === 1 && openEnds === 2) return 12
  return 0
}

function evaluateCellForSide(board: CaroBoard, r: number, c: number, side: 'X' | 'O'): number {
  let total = 0
  for (const [dr, dc] of DIRS) {
    let count = 1
    let openEnds = 0

    let nr = r + dr
    let nc = c + dc
    while (nr >= 0 && nr < CARO_SIZE && nc >= 0 && nc < CARO_SIZE && board[nr]![nc] === side) {
      count++
      nr += dr
      nc += dc
    }
    if (nr >= 0 && nr < CARO_SIZE && nc >= 0 && nc < CARO_SIZE && board[nr]![nc] === null) {
      openEnds++
    }

    nr = r - dr
    nc = c - dc
    while (nr >= 0 && nr < CARO_SIZE && nc >= 0 && nc < CARO_SIZE && board[nr]![nc] === side) {
      count++
      nr -= dr
      nc -= dc
    }
    if (nr >= 0 && nr < CARO_SIZE && nc >= 0 && nc < CARO_SIZE && board[nr]![nc] === null) {
      openEnds++
    }

    total += scoreLinePattern(count, openEnds)
  }
  return total
}

export function chooseBestCaroMove(board: CaroBoard, aiSide: 'O' | 'X' = 'O'): CaroPos | null {
  const humanSide: 'X' | 'O' = aiSide === 'O' ? 'X' : 'O'
  const candidates: CaroPos[] = []

  let anyStone = false
  for (let r = 0; r < CARO_SIZE; r++) {
    for (let c = 0; c < CARO_SIZE; c++) {
      if (board[r]![c] !== null) {
        anyStone = true
        break
      }
    }
    if (anyStone) break
  }
  if (!anyStone) return { r: 7, c: 7 }

  for (let r = 0; r < CARO_SIZE; r++) {
    for (let c = 0; c < CARO_SIZE; c++) {
      if (board[r]![c] !== null) continue
      let near = false
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < CARO_SIZE && nc >= 0 && nc < CARO_SIZE && board[nr]![nc] !== null) {
            near = true
            break
          }
        }
      }
      if (near) candidates.push({ r, c })
    }
  }

  if (candidates.length === 0) return null

  let best = candidates[0]!
  let bestScore = -Infinity

  for (const pos of candidates) {
    const attack = evaluateCellForSide(board, pos.r, pos.c, aiSide)
    const defense = evaluateCellForSide(board, pos.r, pos.c, humanSide)
    const centerBias = 14 - (Math.abs(pos.r - 7) + Math.abs(pos.c - 7))
    const score = attack * 1.08 + defense + centerBias * 0.5
    if (score > bestScore) {
      bestScore = score
      best = pos
    }
  }

  return best
}
