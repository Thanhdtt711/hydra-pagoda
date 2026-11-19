export type OAnQuanSide = 'player' | 'ai'
export type OAnQuanDir = 1 | -1 // 1: clockwise (bottom->left, top->right), -1: counter-clockwise (bottom->right, top->left)

export interface OAnQuanCell {
  index: number
  isQuan: boolean
  small: number
  quan: number // 0 or 1 (worth 10 points)
}

export interface OAnQuanState {
  cells: OAnQuanCell[]
  playerScore: number
  aiScore: number
  turn: OAnQuanSide
  gameOver: boolean
  winner: OAnQuanSide | 'draw' | null
  lastMessage: string
}

export interface OAnQuanStepEvent {
  type: 'pickup' | 'drop' | 'capture' | 'reseed' | 'end'
  cellIndex: number
  handCount: number
  capturedPoints?: number
  side: OAnQuanSide
}

export const PLAYER_CELLS = [11, 10, 9, 8, 7] // Left-to-right on bottom row
export const AI_CELLS = [1, 2, 3, 4, 5] // Left-to-right on top row
export const QUAN_VALUE = 10

export function createOAnQuanState(): OAnQuanState {
  const cells: OAnQuanCell[] = Array.from({ length: 12 }, (_, i) => {
    const isQuan = i === 0 || i === 6
    return {
      index: i,
      isQuan,
      small: isQuan ? 0 : 5,
      quan: isQuan ? 1 : 0
    }
  })

  return {
    cells,
    playerScore: 0,
    aiScore: 0,
    turn: 'player',
    gameOver: false,
    winner: null,
    lastMessage: ''
  }
}

export function cloneOAnQuanState(state: OAnQuanState): OAnQuanState {
  return {
    ...state,
    cells: state.cells.map((c) => ({ ...c }))
  }
}

export function cellPoints(cell: OAnQuanCell): number {
  return cell.small + cell.quan * QUAN_VALUE
}

export function isCellEmpty(cell: OAnQuanCell): boolean {
  return cell.small === 0 && cell.quan === 0
}

export function nextIndex(idx: number, dir: OAnQuanDir): number {
  return (idx + dir + 12) % 12
}

export function isBothQuanEmpty(state: OAnQuanState): boolean {
  return isCellEmpty(state.cells[0]!) && isCellEmpty(state.cells[6]!)
}

export function getSideIndices(side: OAnQuanSide): number[] {
  return side === 'player' ? PLAYER_CELLS : AI_CELLS
}

export function getValidMoves(state: OAnQuanState, side: OAnQuanSide): Array<{ cellIndex: number; dir: OAnQuanDir }> {
  if (state.gameOver) return []
  const indices = getSideIndices(side)
  const moves: Array<{ cellIndex: number; dir: OAnQuanDir }> = []
  for (const idx of indices) {
    if (state.cells[idx]!.small > 0) {
      moves.push({ cellIndex: idx, dir: 1 })
      moves.push({ cellIndex: idx, dir: -1 })
    }
  }
  return moves
}

/**
 * Ensures the side about to play has at least 1 stone on their 5 cells (rải dân)
 * and checks for end-of-game (both Quan cells empty).
 */
export function prepareTurn(state: OAnQuanState): { state: OAnQuanState; reseeded: boolean } {
  const next = cloneOAnQuanState(state)
  if (isBothQuanEmpty(next)) {
    finalizeOAnQuan(next)
    return { state: next, reseeded: false }
  }

  const sideIndices = getSideIndices(next.turn)
  const totalOnSide = sideIndices.reduce((sum, i) => sum + next.cells[i]!.small, 0)
  if (totalOnSide === 0) {
    if (next.turn === 'player') {
      next.playerScore -= 5
    } else {
      next.aiScore -= 5
    }
    for (const i of sideIndices) {
      next.cells[i]!.small += 1
    }
    return { state: next, reseeded: true }
  }

  return { state: next, reseeded: false }
}

function finalizeOAnQuan(state: OAnQuanState): void {
  for (const i of PLAYER_CELLS) {
    state.playerScore += state.cells[i]!.small
    state.cells[i]!.small = 0
  }
  for (const i of AI_CELLS) {
    state.aiScore += state.cells[i]!.small
    state.cells[i]!.small = 0
  }
  state.gameOver = true
  if (state.playerScore > state.aiScore) {
    state.winner = 'player'
  } else if (state.aiScore > state.playerScore) {
    state.winner = 'ai'
  } else {
    state.winner = 'draw'
  }
}

/**
 * Executes a full move and records step-by-step animation events.
 */
export function executeOAnQuanMove(
  inputState: OAnQuanState,
  cellIndex: number,
  dir: OAnQuanDir
): { nextState: OAnQuanState; events: OAnQuanStepEvent[] } {
  const state = cloneOAnQuanState(inputState)
  const events: OAnQuanStepEvent[] = []
  const side = state.turn

  let cur = cellIndex
  let hand = state.cells[cur]!.small
  if (hand <= 0) {
    return { nextState: state, events }
  }

  state.cells[cur]!.small = 0
  events.push({ type: 'pickup', cellIndex: cur, handCount: hand, side })

  let safety = 0
  while (safety++ < 150) {
    while (hand > 0) {
      cur = nextIndex(cur, dir)
      state.cells[cur]!.small += 1
      hand -= 1
      events.push({ type: 'drop', cellIndex: cur, handCount: hand, side })
    }

    const nxt = nextIndex(cur, dir)
    const nxtCell = state.cells[nxt]!

    // If next cell is a Quan (non-empty or empty):
    if (nxtCell.isQuan) {
      if (!isCellEmpty(nxtCell)) {
        // Cannot pick up Quan -> turn ends
        break
      }
      // Next Quan is empty -> check if we can capture the cell after it
      let cEmpty = nxt
      let cTarget = nextIndex(cEmpty, dir)
      while (isCellEmpty(state.cells[cEmpty]!) && !isCellEmpty(state.cells[cTarget]!)) {
        const pts = cellPoints(state.cells[cTarget]!)
        state.cells[cTarget]!.small = 0
        state.cells[cTarget]!.quan = 0
        if (side === 'player') state.playerScore += pts
        else state.aiScore += pts
        events.push({ type: 'capture', cellIndex: cTarget, handCount: 0, capturedPoints: pts, side })
        cEmpty = nextIndex(cTarget, dir)
        cTarget = nextIndex(cEmpty, dir)
      }
      break
    }

    // Next cell is a dân cell with stones -> pick up and continue sowing
    if (nxtCell.small > 0) {
      cur = nxt
      hand = nxtCell.small
      nxtCell.small = 0
      events.push({ type: 'pickup', cellIndex: cur, handCount: hand, side })
      continue
    }

    // Next cell is empty dân cell -> check for capture(s)
    let cEmpty = nxt
    let cTarget = nextIndex(cEmpty, dir)
    while (isCellEmpty(state.cells[cEmpty]!) && !isCellEmpty(state.cells[cTarget]!)) {
      const pts = cellPoints(state.cells[cTarget]!)
      state.cells[cTarget]!.small = 0
      state.cells[cTarget]!.quan = 0
      if (side === 'player') state.playerScore += pts
      else state.aiScore += pts
      events.push({ type: 'capture', cellIndex: cTarget, handCount: 0, capturedPoints: pts, side })
      cEmpty = nextIndex(cTarget, dir)
      cTarget = nextIndex(cEmpty, dir)
    }
    break
  }

  state.turn = side === 'player' ? 'ai' : 'player'
  const prepared = prepareTurn(state)
  if (prepared.reseeded) {
    events.push({ type: 'reseed', cellIndex: -1, handCount: 0, side: prepared.state.turn })
  }
  if (prepared.state.gameOver) {
    events.push({ type: 'end', cellIndex: -1, handCount: 0, side })
  }

  return { nextState: prepared.state, events }
}

function evaluateStateForAI(state: OAnQuanState): number {
  if (state.gameOver) {
    return (state.aiScore - state.playerScore) * 100
  }
  const aiBoard = AI_CELLS.reduce((s, i) => s + state.cells[i]!.small, 0)
  const playerBoard = PLAYER_CELLS.reduce((s, i) => s + state.cells[i]!.small, 0)
  return (state.aiScore - state.playerScore) * 10 + (aiBoard - playerBoard) * 0.4
}

/**
 * 2-ply lookahead AI for Ô Ăn Quan.
 */
export function chooseBestOAnQuanMove(state: OAnQuanState): { cellIndex: number; dir: OAnQuanDir } | null {
  const moves = getValidMoves(state, 'ai')
  if (moves.length === 0) return null

  let bestMove = moves[0]!
  let bestVal = -Infinity

  for (const move of moves) {
    const { nextState } = executeOAnQuanMove(state, move.cellIndex, move.dir)
    if (nextState.gameOver) {
      const val = evaluateStateForAI(nextState)
      if (val > bestVal) {
        bestVal = val
        bestMove = move
      }
      continue
    }

    const playerMoves = getValidMoves(nextState, 'player')
    let worstForAi = Infinity
    if (playerMoves.length === 0) {
      worstForAi = evaluateStateForAI(nextState)
    } else {
      for (const pm of playerMoves) {
        const { nextState: afterPlayer } = executeOAnQuanMove(nextState, pm.cellIndex, pm.dir)
        const val = evaluateStateForAI(afterPlayer)
        if (val < worstForAi) worstForAi = val
      }
    }

    if (worstForAi > bestVal) {
      bestVal = worstForAi
      bestMove = move
    }
  }

  return bestMove
}

