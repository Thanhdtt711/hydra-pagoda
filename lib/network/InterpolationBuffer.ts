// InterpolationBuffer.ts - Client-Side Hermite & Lerp Snapshot Interpolation
// Smooths network jitter with 100ms interpolation buffer and 200ms safe extrapolation.

export interface TransformSnapshot {
  timestamp: number
  position: [number, number, number]
  yaw: number
  action: 'standing' | 'walking' | 'bowing' | 'meditating'
}

export interface InterpolatedTransform {
  position: [number, number, number]
  yaw: number
  action: 'standing' | 'walking' | 'bowing' | 'meditating'
  isExtrapolating: boolean
}

export class EntityInterpolationBuffer {
  private snapshots: TransformSnapshot[] = []
  private readonly maxBufferSize = 30
  private readonly bufferDelayMs = 100 // 100ms interpolation window
  private readonly maxExtrapolationMs = 200 // 200ms extrapolation ceiling

  public pushSnapshot(snap: TransformSnapshot) {
    // Insert sorted by timestamp
    if (this.snapshots.length === 0 || snap.timestamp >= this.snapshots[this.snapshots.length - 1].timestamp) {
      this.snapshots.push(snap)
    } else {
      let idx = this.snapshots.length - 1
      while (idx >= 0 && this.snapshots[idx].timestamp > snap.timestamp) {
        idx--
      }
      this.snapshots.splice(idx + 1, 0, snap)
    }

    // Prune stale snapshots older than 1.0 second
    const cutoff = snap.timestamp - 1000
    while (this.snapshots.length > 2 && this.snapshots[0].timestamp < cutoff) {
      this.snapshots.shift()
    }

    if (this.snapshots.length > this.maxBufferSize) {
      this.snapshots.shift()
    }
  }

  /**
   * Sample the interpolated transform at the current client time
   */
  public sample(nowMs: number = Date.now()): InterpolatedTransform | null {
    if (this.snapshots.length === 0) return null
    if (this.snapshots.length === 1) {
      const single = this.snapshots[0]
      return {
        position: [...single.position],
        yaw: single.yaw,
        action: single.action,
        isExtrapolating: false
      }
    }

    const renderTime = nowMs - this.bufferDelayMs

    // Case 1: Target time is older than our oldest snapshot -> clamp to oldest
    if (renderTime <= this.snapshots[0].timestamp) {
      const oldest = this.snapshots[0]
      return {
        position: [...oldest.position],
        yaw: oldest.yaw,
        action: oldest.action,
        isExtrapolating: false
      }
    }

    // Case 2: Target time is between two snapshots -> Hermite / Linear interpolation
    for (let i = 0; i < this.snapshots.length - 1; i++) {
      const s0 = this.snapshots[i]
      const s1 = this.snapshots[i + 1]

      if (renderTime >= s0.timestamp && renderTime <= s1.timestamp) {
        const span = s1.timestamp - s0.timestamp
        const alpha = span > 0 ? (renderTime - s0.timestamp) / span : 0

        // Smooth Hermite blend factor: 3a^2 - 2a^3
        const smoothAlpha = alpha * alpha * (3 - 2 * alpha)

        const x = s0.position[0] + (s1.position[0] - s0.position[0]) * smoothAlpha
        const y = s0.position[1] + (s1.position[1] - s0.position[1]) * smoothAlpha
        const z = s0.position[2] + (s1.position[2] - s0.position[2]) * smoothAlpha

        // Shortest-arc yaw interpolation
        let diffYaw = s1.yaw - s0.yaw
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2
        const yaw = s0.yaw + diffYaw * smoothAlpha

        return {
          position: [x, y, z],
          yaw,
          action: alpha > 0.5 ? s1.action : s0.action,
          isExtrapolating: false
        }
      }
    }

    // Case 3: Target time is newer than latest snapshot -> Extrapolation
    const latest = this.snapshots[this.snapshots.length - 1]
    const prev = this.snapshots[this.snapshots.length - 2]
    const overdueMs = renderTime - latest.timestamp

    if (overdueMs <= this.maxExtrapolationMs) {
      // Extrapolate linearly using recent velocity
      const dt = (latest.timestamp - prev.timestamp) / 1000.0
      if (dt > 0.001) {
        const vx = (latest.position[0] - prev.position[0]) / dt
        const vy = (latest.position[1] - prev.position[1]) / dt
        const vz = (latest.position[2] - prev.position[2]) / dt

        const extrapolateDt = overdueMs / 1000.0
        return {
          position: [
            latest.position[0] + vx * extrapolateDt,
            latest.position[1] + vy * extrapolateDt,
            latest.position[2] + vz * extrapolateDt
          ],
          yaw: latest.yaw,
          action: latest.action,
          isExtrapolating: true
        }
      }
    }

    // Case 4: Packet loss exceeded 200ms -> Snap to latest and stop walking
    return {
      position: [...latest.position],
      yaw: latest.yaw,
      action: 'standing',
      isExtrapolating: false
    }
  }

  public clear() {
    this.snapshots = []
  }
}

