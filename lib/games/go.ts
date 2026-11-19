export type GoStone = 'B' | 'W' | null
export type GoBoard = GoStone[][] // 9x9

export interface GoPos {
  r: number
  c: number
}

export interface GoState {
  board: GoBoard
  turn: 'B' | 'W'
  capturesB: number // Black captured White stones
  capturesW: number // White captured Black stones
  consecutivePasses: number
  lastHash: string | null
  prevHash: string | null
  lastMove: GoPos | null
  gameOver: boolean
}

export const GO_SIZE = 9
export const GO_KOMI = 6.5

export function createGoState(): GoState {
  return {
    board: Array.from({ length: GO_SIZE }, () => Array<GoStone>(GO_SIZE).fill(null)),
    turn: 'B',
    capturesB: 0,
    capturesW: 0,
    consecutivePasses: 0,
    lastHash: null,
    prevHash: null,
    lastMove: null,
    gameOver: false
  }
}

export function cloneGoBoard(board: GoBoard): GoBoard {
  return board.map((row) => [...row])
}

function hashBoard(board: GoBoard): string {
  return board.map((row) => row.map((c) => c ?? '.').join('')).join('|')
}

function neighbors(r: number, c: number): GoPos[] {
  const res: GoPos[] = []
  if (r > 0) res.push({ r: r - 1, c })
  if (r < GO_SIZE - 1) res.push({ r: r + 1, c })
  if (c > 0) res.push({ r, c: c - 1 })
  if (c < GO_SIZE - 1) res.push({ r, c: c + 1 })
  return res
}

function getGroupAndLiberties(board: GoBoard, startR: number, startC: number): { group: GoPos[]; liberties: number } {
  const color = board[startR]![startC]
  if (!color) return { group: [], liberties: 0 }

  const visited = new Set<string>()
  const libSet = new Set<string>()
  const group: GoPos[] = []
  const queue: GoPos[] = [{ r: startR, c: startC }]
  visited.add(`${startR},${startC}`)

  while (queue.length > 0) {
    const cur = queue.pop()!
    group.push(cur)
    for (const n of neighbors(cur.r, cur.c)) {
      const key = `${n.r},${n.c}`
      const cell = board[n.r]![n.c]
      if (cell === null) {
        libSet.add(key)
      } else if (cell === color && !visited.has(key)) {
        visited.add(key)
        queue.push(n)
      }
    }
  }

  return { group, liberties: libSet.size }
}

export function tryPlayGoMove(
  state: GoState,
  r: number,
  c: number
): { ok: boolean; nextState?: GoState; capturedCount?: number } {
  if (state.gameOver || state.board[r]![c] !== null) return { ok: false }

  const side = state.turn
  const enemy: 'B' | 'W' = side === 'B' ? 'W' : 'B'
  const board = cloneGoBoard(state.board)
  board[r]![c] = side

  let capturedCount = 0
  for (const n of neighbors(r, c)) {
    if (board[n.r]![n.c] === enemy) {
      const { group, liberties } = getGroupAndLiberties(board, n.r, n.c)
      if (liberties === 0) {
        for (const g of group) {
          board[g.r]![g.c] = null
          capturedCount++
        }
      }
    }
  }

  // Suicide check
  const self = getGroupAndLiberties(board, r, c)
  if (self.liberties === 0) {
    return { ok: false }
  }

  // Simple Ko check
  const nextHash = hashBoard(board)
  if (state.prevHash && nextHash === state.prevHash) {
    return { ok: false }
  }

  return {
    ok: true,
    capturedCount,
    nextState: {
      board,
      turn: enemy,
      capturesB: state.capturesB + (side === 'B' ? capturedCount : 0),
      capturesW: state.capturesW + (side === 'W' ? capturedCount : 0),
      consecutivePasses: 0,
      prevHash: state.lastHash,
      lastHash: nextHash,
      lastMove: { r, c },
      gameOver: false
    }
  }
}

export function passGoTurn(state: GoState): GoState {
  const nextPasses = state.consecutivePasses + 1
  return {
    ...state,
    turn: state.turn === 'B' ? 'W' : 'B',
    consecutivePasses: nextPasses,
    lastMove: null,
    gameOver: nextPasses >= 2
  }
}

export function scoreGoArea(board: GoBoard): { black: number; white: number } {
  let black = 0
  let white = 0
  const visited = new Set<string>()

  for (let r = 0; r < GO_SIZE; r++) {
    for (let c = 0; c < GO_SIZE; c++) {
      const stone = board[r]![c]
      if (stone === 'B') black++
      else if (stone === 'W') white++
      else if (!visited.has(`${r},${c}`)) {
        // Flood-fill empty territory
        const queue: GoPos[] = [{ r, c }]
        visited.add(`${r},${c}`)
        let count = 0
        let touchesB = false
        let touchesW = false

        while (queue.length > 0) {
          const cur = queue.pop()!
          count++
          for (const n of neighbors(cur.r, cur.c)) {
            const nc = board[n.r]![n.c]
            if (nc === 'B') touchesB = true
            else if (nc === 'W') touchesW = true
            else if (!visited.has(`${n.r},${n.c}`)) {
              visited.add(`${n.r},${n.c}`)
              queue.push(n)
            }
          }
        }

        if (touchesB && !touchesW) black += count
        else if (touchesW && !touchesB) white += count
      }
    }
  }

  return { black, white: white + GO_KOMI }
}

function isOwnSimpleEye(board: GoBoard, r: number, c: number, side: 'B' | 'W'): boolean {
  const nbs = neighbors(r, c)
  if (!nbs.every((n) => board[n.r]![n.c] === side)) return false
  let enemyDiags = 0
  const enemy = side === 'B' ? 'W' : 'B'
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as Array<[number, number]>) {
    const nr = r + dr
    const nc = c + dc
    if (nr >= 0 && nr < GO_SIZE && nc >= 0 && nc < GO_SIZE && board[nr]![nc] === enemy) {
      enemyDiags++
    }
  }
  return enemyDiags <= 1
}

export function chooseBestGoMove(state: GoState): GoPos | null {
  const aiSide = state.turn
  const enemy: 'B' | 'W' = aiSide === 'B' ? 'W' : 'B'
  let bestPos: GoPos | null = null
  let bestScore = -Infinity

  const hoshi = new Set(['2,2', '2,6', '6,2', '6,6', '4,4'])

  for (let r = 0; r < GO_SIZE; r++) {
    for (let c = 0; c < GO_SIZE; c++) {
      if (state.board[r]![c] !== null) continue
      if (isOwnSimpleEye(state.board, r, c, aiSide)) continue

      const res = tryPlayGoMove(state, r, c)
      if (!res.ok || !res.nextState) continue

      let score = (res.capturedCount ?? 0) * 60
      const { liberties } = getGroupAndLiberties(res.nextState.board, r, c)
      score += Math.min(liberties, 4) * 4

      // Save own group in atari or put enemy in atari
      for (const n of neighbors(r, c)) {
        const beforeCell = state.board[n.r]![n.c]
        if (beforeCell === aiSide) {
          const gBefore = getGroupAndLiberties(state.board, n.r, n.c)
          if (gBefore.liberties === 1) score += 35
          else score += 6
        } else if (beforeCell === enemy) {
          const gAfter = getGroupAndLiberties(res.nextState.board, n.r, n.c)
          if (gAfter.liberties === 1) score += 28
          else score += 8
        }
      }

      if (hoshi.has(`${r},${c}`)) score += 10
      // Slight preference away from edge on early moves
      if (r === 0 || r === GO_SIZE - 1 || c === 0 || c === GO_SIZE - 1) score -= 4
      score += Math.random() * 1.5

      if (score > bestScore) {
        bestScore = score
        bestPos = { r, c }
      }
    }
  }

  return bestScore > 2 ? bestPos : null
}
