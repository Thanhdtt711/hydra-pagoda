import * as THREE from 'three'
import type { CollisionWorld } from './CollisionWorld'

export interface PathPoint {
  x: number
  z: number
}

/**
 * GridPathfinder:
 * Tìm đường 2D trên lưới (A* + làm mượt đường đi) đọc trực tiếp từ các collider trong CollisionWorld.
 * Giúp nhân vật tự động né tường Chánh Điện, tường Nhà Hầu Đồng, cột Tam Quan, Lư Hương, Hồ Sen,
 * cây cối và các vật cản khi tự di chuyển từ xa hoặc từ bên trong điện ra ngoài sân.
 */
export class GridPathfinder {
  private readonly minX = -38
  private readonly maxX = 56
  private readonly minZ = -42
  private readonly maxZ = 42
  private readonly cellSize = 0.75
  private readonly agentRadius = 0.42

  private readonly cols: number
  private readonly rows: number
  private blocked: Uint8Array

  private static readonly MIN_OUT = new THREE.Vector3()
  private static readonly MAX_OUT = new THREE.Vector3()

  constructor() {
    this.cols = Math.ceil((this.maxX - this.minX) / this.cellSize)
    this.rows = Math.ceil((this.maxZ - this.minZ) / this.cellSize)
    this.blocked = new Uint8Array(this.cols * this.rows)
  }

  private worldToCol(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.minX) / this.cellSize)))
  }

  private worldToRow(z: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.minZ) / this.cellSize)))
  }

  private cellToWorld(col: number, row: number): PathPoint {
    return {
      x: this.minX + (col + 0.5) * this.cellSize,
      z: this.minZ + (row + 0.5) * this.cellSize
    }
  }

  private isBlocked(col: number, row: number): boolean {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true
    return this.blocked[row * this.cols + col] === 1
  }

  /**
   * Đồng bộ lưới vật cản từ CollisionWorld (mất < 0.5ms).
   */
  public refreshGrid(world: CollisionWorld): void {
    this.blocked.fill(0)
    const colliders = world.getPotentialColliders(this.minX, this.maxX, this.minZ, this.maxZ)
    const minOut = GridPathfinder.MIN_OUT
    const maxOut = GridPathfinder.MAX_OUT
    const pad = this.agentRadius

    colliders.forEach((col) => {
      if (!col.enabled || col.isWalkable || col.isTrigger) return
      // Bỏ qua collider cánh cửa để lộ trình đi xuyên qua ngưỡng cửa (TempleStage tự mở cửa)
      if (col.id.includes('door')) return

      col.getBounds(minOut, maxOut)
      // Bỏ qua các khối mái/xà trên cao hoặc nền thấp dưới chân
      if (minOut.y > 2.6 || maxOut.y < 0.25) return

      const cMin = this.worldToCol(minOut.x - pad)
      const cMax = this.worldToCol(maxOut.x + pad)
      const rMin = this.worldToRow(minOut.z - pad)
      const rMax = this.worldToRow(maxOut.z + pad)

      const maybeCyl = col as unknown as { center?: THREE.Vector3; radius?: number }
      if (typeof maybeCyl.radius === 'number' && maybeCyl.center) {
        const cx = maybeCyl.center.x
        const cz = maybeCyl.center.z
        const rSq = (maybeCyl.radius + pad) * (maybeCyl.radius + pad)
        for (let r = rMin; r <= rMax; r++) {
          const wz = this.minZ + (r + 0.5) * this.cellSize
          for (let c = cMin; c <= cMax; c++) {
            const wx = this.minX + (c + 0.5) * this.cellSize
            const dx = wx - cx
            const dz = wz - cz
            if (dx * dx + dz * dz <= rSq) {
              this.blocked[r * this.cols + c] = 1
            }
          }
        }
      } else {
        const bMinX = minOut.x - pad
        const bMaxX = maxOut.x + pad
        const bMinZ = minOut.z - pad
        const bMaxZ = maxOut.z + pad
        for (let r = rMin; r <= rMax; r++) {
          const wz = this.minZ + (r + 0.5) * this.cellSize
          if (wz < bMinZ || wz > bMaxZ) continue
          for (let c = cMin; c <= cMax; c++) {
            const wx = this.minX + (c + 0.5) * this.cellSize
            if (wx >= bMinX && wx <= bMaxX) {
              this.blocked[r * this.cols + c] = 1
            }
          }
        }
      }
    })
  }

  public isPointWalkable(x: number, z: number): boolean {
    return !this.isBlocked(this.worldToCol(x), this.worldToRow(z))
  }

  private findNearestWalkable(startCol: number, startRow: number, maxRadius = 10): [number, number] | null {
    if (!this.isBlocked(startCol, startRow)) return [startCol, startRow]
    for (let rad = 1; rad <= maxRadius; rad++) {
      let best: [number, number] | null = null
      let bestDistSq = Infinity
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue
          const c = startCol + dc
          const r = startRow + dr
          if (!this.isBlocked(c, r)) {
            const dSq = dc * dc + dr * dr
            if (dSq < bestDistSq) {
              bestDistSq = dSq
              best = [c, r]
            }
          }
        }
      }
      if (best) return best
    }
    return null
  }

  /**
   * Kiểm tra đường thẳng nối 2 ô trên lưới có bị vật cản cắt ngang không (Supercover Bresenham).
   */
  private hasLineOfSight(c0: number, r0: number, c1: number, r1: number): boolean {
    let x = c0
    let y = r0
    const dx = Math.abs(c1 - c0)
    const dy = Math.abs(r1 - r0)
    const sx = c0 < c1 ? 1 : -1
    const sy = r0 < r1 ? 1 : -1
    let err = dx - dy

    while (true) {
      if (this.isBlocked(x, y)) return false
      if (x === c1 && y === r1) return true
      const e2 = 2 * err
      const stepX = e2 > -dy
      const stepY = e2 < dx
      if (stepX && stepY) {
        if (this.isBlocked(x + sx, y) || this.isBlocked(x, y + sy)) return false
      }
      if (stepX) {
        err -= dy
        x += sx
      }
      if (stepY) {
        err += dx
        y += sy
      }
    }
  }

  /**
   * Tìm lộ trình ngắn nhất né vật cản từ (startX, startZ) tới (goalX, goalZ).
   */
  public findPath(world: CollisionWorld, startX: number, startZ: number, goalX: number, goalZ: number): PathPoint[] {
    this.refreshGrid(world)

    const rawStart = [this.worldToCol(startX), this.worldToRow(startZ)] as const
    const rawGoal = [this.worldToCol(goalX), this.worldToRow(goalZ)] as const

    const startCell = this.findNearestWalkable(rawStart[0], rawStart[1])
    const goalCell = this.findNearestWalkable(rawGoal[0], rawGoal[1])

    if (!startCell || !goalCell) {
      return [{ x: goalX, z: goalZ }]
    }

    const [sc, sr] = startCell
    const [gc, gr] = goalCell

    if (sc === gc && sr === gr) {
      return [{ x: goalX, z: goalZ }]
    }

    // Nếu đường thẳng trực tiếp thông thoáng hoàn toàn thì đi thẳng luôn
    if (this.hasLineOfSight(sc, sr, gc, gr)) {
      return [{ x: goalX, z: goalZ }]
    }

    const total = this.cols * this.rows
    const gScore = new Float32Array(total)
    gScore.fill(Infinity)
    const cameFrom = new Int32Array(total)
    cameFrom.fill(-1)
    const closed = new Uint8Array(total)

    const startIdx = sr * this.cols + sc
    const goalIdx = gr * this.cols + gc
    gScore[startIdx] = 0

    // Binary min-heap lưu [idx, fScore]
    const heapIdx: number[] = [startIdx]
    const heapF: number[] = [Math.hypot(gc - sc, gr - sr)]

    const pushHeap = (idx: number, f: number) => {
      heapIdx.push(idx)
      heapF.push(f)
      let i = heapIdx.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heapF[p]! <= heapF[i]!) break
        ;[heapIdx[p], heapIdx[i]] = [heapIdx[i]!, heapIdx[p]!]
        ;[heapF[p], heapF[i]] = [heapF[i]!, heapF[p]!]
        i = p
      }
    }

    const popHeap = (): number => {
      const top = heapIdx[0]!
      const lastIdx = heapIdx.pop()!
      const lastF = heapF.pop()!
      if (heapIdx.length > 0) {
        heapIdx[0] = lastIdx
        heapF[0] = lastF
        let i = 0
        const n = heapIdx.length
        while (true) {
          let smallest = i
          const l = 2 * i + 1
          const r = 2 * i + 2
          if (l < n && heapF[l]! < heapF[smallest]!) smallest = l
          if (r < n && heapF[r]! < heapF[smallest]!) smallest = r
          if (smallest === i) break
          ;[heapIdx[i], heapIdx[smallest]] = [heapIdx[smallest]!, heapIdx[i]!]
          ;[heapF[i], heapF[smallest]] = [heapF[smallest]!, heapF[i]!]
          i = smallest
        }
      }
      return top
    }

    const dirs: Array<[number, number, number]> = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2]
    ]

    let found = false
    while (heapIdx.length > 0) {
      const curr = popHeap()
      if (curr === goalIdx) {
        found = true
        break
      }
      if (closed[curr] === 1) continue
      closed[curr] = 1

      const cr = Math.floor(curr / this.cols)
      const cc = curr - cr * this.cols
      const currG = gScore[curr]!

      for (const [dc, dr, cost] of dirs) {
        const nc = cc + dc
        const nr = cr + dr
        if (this.isBlocked(nc, nr)) continue
        // Không cắt góc tường khi đi chéo
        if (dc !== 0 && dr !== 0) {
          if (this.isBlocked(cc + dc, cr) || this.isBlocked(cc, cr + dr)) continue
        }

        const nIdx = nr * this.cols + nc
        if (closed[nIdx] === 1) continue

        const tentativeG = currG + cost
        if (tentativeG < gScore[nIdx]!) {
          cameFrom[nIdx] = curr
          gScore[nIdx] = tentativeG
          const h = Math.hypot(gc - nc, gr - nr)
          pushHeap(nIdx, tentativeG + h)
        }
      }
    }

    if (!found) {
      return [{ x: goalX, z: goalZ }]
    }

    // Truy vết lại chuỗi ô
    const rawCells: Array<[number, number]> = []
    let cur = goalIdx
    while (cur !== -1) {
      const r = Math.floor(cur / this.cols)
      const c = cur - r * this.cols
      rawCells.push([c, r])
      if (cur === startIdx) break
      cur = cameFrom[cur]!
    }
    rawCells.reverse()

    // Làm mượt bằng String-Pulling trên lưới
    const smoothed: Array<[number, number]> = [rawCells[0]!]
    let anchor = 0
    while (anchor < rawCells.length - 1) {
      let furthest = anchor + 1
      for (let next = rawCells.length - 1; next > anchor + 1; next--) {
        if (this.hasLineOfSight(rawCells[anchor]![0], rawCells[anchor]![1], rawCells[next]![0], rawCells[next]![1])) {
          furthest = next
          break
        }
      }
      smoothed.push(rawCells[furthest]!)
      anchor = furthest
    }

    // Chuyển sang tọa độ thế giới (bỏ điểm đầu nếu trùng vị trí đứng, thay điểm cuối bằng tọa độ đích chính xác)
    const waypoints: PathPoint[] = []
    for (let i = 1; i < smoothed.length - 1; i++) {
      waypoints.push(this.cellToWorld(smoothed[i]![0], smoothed[i]![1]))
    }
    waypoints.push({ x: goalX, z: goalZ })
    return waypoints
  }
}

