// MultiplayerClient.ts - Realtime Sangha Hub WebSocket Client
// Phase 3: Binary packet streaming, 40x40m AoI support, 5s heartbeat, and 100ms Hermite interpolation buffer.

import {
  encodeMovePacket,
  decodeMovePacket,
  MSG_MOVE,
  type MovementAction
} from './NetProtocol'
import { EntityInterpolationBuffer } from './InterpolationBuffer'

export interface PilgrimPresence {
  id: string
  name: string
  title: string
  country: string
  position: [number, number, number]
  yaw: number
  action: MovementAction
  updatedAt: number
}

export interface ZenChatMessage {
  id: string
  name: string
  country: string
  text: string
  timestamp: number
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface NetworkMetrics {
  pingMs: number
  bytesReceived: number
  bytesSent: number
  bandwidthKbps: number
}

export class MultiplayerClient {
  private ws: WebSocket | null = null
  private status: ConnectionStatus = 'disconnected'
  private localPilgrimId: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 15
  private reconnectTimer: any = null
  private shouldConnect = false
  private lastSentTime = 0
  private pendingMove: { pos: [number, number, number]; yaw: number; isMoving: boolean; action?: MovementAction } | null = null
  private throttleIntervalMs = 50 // 20Hz send rate

  // Heartbeat & Metrics
  private heartbeatTimer: any = null
  private lastPingSentTime = 0
  private currentPingMs = 0
  private bytesIn = 0
  private bytesOut = 0
  private bytesInLastSec = 0
  private lastBandwidthSampleTime = performance.now()
  private currentBandwidthKbps = 0

  // Client-Side Snapshot Interpolation Buffers (100ms Hermite buffer)
  private interpolationBuffers = new Map<string, EntityInterpolationBuffer>()
  private animTickId: any = null

  // Event callbacks
  public onStatusChange?: (status: ConnectionStatus) => void
  public onSnapshot?: (pilgrims: PilgrimPresence[], onlineCount: number) => void
  public onPilgrimJoin?: (pilgrim: PilgrimPresence, onlineCount: number) => void
  public onPilgrimMove?: (data: { id: string; position: [number, number, number]; yaw: number; action: string }) => void
  public onPilgrimEmote?: (data: { id: string; action: string; name: string }) => void
  public onPilgrimChat?: (msg: ZenChatMessage) => void
  public onPilgrimLeave?: (id: string, onlineCount: number) => void

  constructor(localPilgrimId?: string) {
    this.localPilgrimId = localPilgrimId || this.generatePilgrimId()
    this.startInterpolationLoop()
  }

  public get pilgrimId(): string {
    return this.localPilgrimId
  }

  public get connectionStatus(): ConnectionStatus {
    return this.status
  }

  public get metrics(): NetworkMetrics {
    return {
      pingMs: this.currentPingMs,
      bytesReceived: this.bytesIn,
      bytesSent: this.bytesOut,
      bandwidthKbps: this.currentBandwidthKbps
    }
  }

  private generatePilgrimId(): string {
    return 'pilgrim_' + Math.random().toString(36).substring(2, 8)
  }

  public connect(endpoint?: string) {
    if (typeof window === 'undefined') return
    this.shouldConnect = true

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.setStatus(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting')

    let wsUrl = endpoint
    if (!wsUrl) {
      const isHttps = window.location.protocol === 'https:'
      const wsProtocol = isHttps ? 'wss:' : 'ws:'
      wsUrl = `${wsProtocol}//${window.location.host}/_ws`
    }

    try {
      this.ws = new WebSocket(wsUrl)
      this.ws.binaryType = 'arraybuffer'

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.setStatus('connected')
        this.startHeartbeat()
        // Trước đây lệnh join gửi khi socket chưa mở bị bỏ rơi; nay join ngay khi kết nối mở.
        void this.rejoin()
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }

      this.ws.onclose = () => {
        this.ws = null
        this.stopHeartbeat()
        if (this.shouldConnect) {
          this.scheduleReconnect()
        } else {
          this.setStatus('disconnected')
        }
      }

      this.ws.onerror = (err) => {
        console.warn('[MultiplayerClient] WebSocket connection error:', err)
      }
    } catch (e) {
      console.error('[MultiplayerClient] Failed to create WebSocket:', e)
      this.scheduleReconnect()
    }
  }

  public disconnect() {
    this.shouldConnect = false
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.interpolationBuffers.clear()
    this.setStatus('disconnected')
  }

  private scheduleReconnect() {
    this.setStatus('reconnecting')
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('disconnected')
      return
    }

    const backoff = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000)
    this.reconnectAttempts++

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldConnect) {
        this.connect()
      }
    }, backoff)
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus
      this.onStatusChange?.(newStatus)
    }
  }

  // 5s Heartbeat keepalive ping/pong
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSentTime = performance.now()
        this.sendJson({ type: 'client:ping', timestamp: Date.now() })
      }
    }, 5000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // Continuous 60FPS Snapshot Interpolation Dispatcher
  private startInterpolationLoop() {
    const tick = () => {
      this.sampleInterpolations()
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animTickId = requestAnimationFrame(tick)
      } else {
        this.animTickId = setTimeout(tick, 16)
      }
    }
    tick()
  }

  private sampleInterpolations() {
    const now = Date.now()
    for (const [id, buffer] of this.interpolationBuffers.entries()) {
      const interpolated = buffer.sample(now)
      if (interpolated) {
        this.onPilgrimMove?.({
          id,
          position: interpolated.position,
          yaw: interpolated.yaw,
          action: interpolated.action
        })
      }
    }

    // Sample network bandwidth
    const perfNow = performance.now()
    if (perfNow - this.lastBandwidthSampleTime >= 1000) {
      this.currentBandwidthKbps = parseFloat(((this.bytesInLastSec * 8) / 1024).toFixed(1))
      this.bytesInLastSec = 0
      this.lastBandwidthSampleTime = perfNow
    }
  }

  // Send local pilgrim join payload
  // `ticket` (tùy chọn): vé một lần đổi từ phiên đăng nhập ví; có vé thì server đặt tên theo tài khoản.
  public joinSangha(meta: { name: string; title: string; country: string; position: [number, number, number]; yaw: number; ticket?: string | null }) {
    this.sendJson({
      type: 'client:join',
      id: this.localPilgrimId,
      name: meta.name,
      title: meta.title,
      country: meta.country,
      position: meta.position,
      yaw: meta.yaw,
      action: 'standing',
      ticket: meta.ticket || undefined
    })
  }

  /**
   * Nhà cung cấp dữ liệu join (gọi lại mỗi lần cần join: kết nối mở/mở lại, hoặc vừa đăng nhập/đăng xuất).
   * Vé WS dùng một lần nên phải xin mới mỗi lần.
   */
  public joinProvider: (() => Promise<{ name: string; title: string; country: string; position: [number, number, number]; yaw: number; ticket?: string | null }>) | null = null

  /** Join lại bằng `joinProvider` (an toàn khi ws chưa mở: sẽ tự gọi lại trong onopen). */
  public async rejoin() {
    if (!this.joinProvider || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.joinSangha(await this.joinProvider())
  }

  // Throttled movement stream (20Hz = 50ms interval) via BINARY packet
  public streamMove(position: [number, number, number], yaw: number, isMoving: boolean, action?: MovementAction) {
    const now = performance.now()
    const currentAction: MovementAction = action || (isMoving ? 'walking' : 'standing')
    this.pendingMove = { pos: position, yaw, isMoving, action: currentAction }

    if (now - this.lastSentTime >= this.throttleIntervalMs) {
      this.flushMove()
      this.lastSentTime = now
    }
  }

  public flushMove() {
    if (!this.pendingMove) return
    const action = this.pendingMove.action || (this.pendingMove.isMoving ? 'walking' : 'standing')

    // Fast-path: encode to 24+ bytes binary ArrayBuffer
    const binaryPacket = encodeMovePacket(
      this.localPilgrimId,
      this.pendingMove.pos,
      this.pendingMove.yaw,
      action
    )

    this.sendBinary(binaryPacket)
    this.pendingMove = null
  }

  // Trigger spiritual emote
  public triggerEmote(action: 'bow' | 'meditate' | 'pray', name: string) {
    this.sendJson({
      type: 'client:emote',
      id: this.localPilgrimId,
      action,
      name
    })
  }

  // Send mindfulness chat message
  public sendChat(name: string, text: string) {
    if (!text.trim()) return
    this.sendJson({
      type: 'client:chat',
      id: this.localPilgrimId,
      name,
      text: text.trim()
    })
  }

  private sendBinary(data: Uint8Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
      this.bytesOut += data.byteLength
    }
  }

  private sendJson(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const str = JSON.stringify(payload)
      this.ws.send(str)
      this.bytesOut += str.length
    }
  }

  private handleMessage(data: string | ArrayBuffer) {
    // 1. BINARY PATH (High-frequency movement delta)
    if (data instanceof ArrayBuffer) {
      this.bytesIn += data.byteLength
      this.bytesInLastSec += data.byteLength

      const decoded = decodeMovePacket(data)
      if (decoded && decoded.id !== this.localPilgrimId) {
        let buffer = this.interpolationBuffers.get(decoded.id)
        if (!buffer) {
          buffer = new EntityInterpolationBuffer()
          this.interpolationBuffers.set(decoded.id, buffer)
        }
        buffer.pushSnapshot({
          timestamp: decoded.timestamp,
          position: decoded.position,
          yaw: decoded.yaw,
          action: decoded.action
        })
      }
      return
    }

    // 2. JSON CONTROL / CHAT / EMOTE PATH
    try {
      this.bytesIn += (data as string).length
      this.bytesInLastSec += (data as string).length
      const msg = JSON.parse(data as string)

      switch (msg.type) {
        case 'server:pong':
          if (this.lastPingSentTime > 0) {
            this.currentPingMs = Math.round(performance.now() - this.lastPingSentTime)
          }
          break

        case 'server:welcome':
          break

        case 'server:snapshot':
        case 'server:ack_join':
          const remotePilgrims = (msg.pilgrims || []).filter((p: PilgrimPresence) => p.id !== this.localPilgrimId)
          for (const p of remotePilgrims) {
            let buf = this.interpolationBuffers.get(p.id)
            if (!buf) {
              buf = new EntityInterpolationBuffer()
              this.interpolationBuffers.set(p.id, buf)
            }
            buf.pushSnapshot({
              timestamp: p.updatedAt || Date.now(),
              position: p.position,
              yaw: p.yaw,
              action: p.action || 'standing'
            })
          }
          this.onSnapshot?.(remotePilgrims, msg.onlineCount || 1)
          break

        case 'server:join':
          if (msg.pilgrim && msg.pilgrim.id !== this.localPilgrimId) {
            this.onPilgrimJoin?.(msg.pilgrim, msg.onlineCount || 1)
          }
          break

        case 'server:emote':
          this.onPilgrimEmote?.({
            id: msg.id,
            action: msg.action,
            name: msg.name
          })
          break

        case 'server:chat':
          this.onPilgrimChat?.({
            id: msg.id,
            name: msg.name,
            country: msg.country,
            text: msg.text,
            timestamp: msg.timestamp
          })
          break

        case 'server:leave':
          if (msg.id && msg.id !== this.localPilgrimId) {
            this.interpolationBuffers.delete(msg.id)
            this.onPilgrimLeave?.(msg.id, msg.onlineCount || 1)
          }
          break
      }
    } catch (e) {
      console.warn('[MultiplayerClient] Message parse error:', e)
    }
  }

  public dispose() {
    this.disconnect()
    if (this.animTickId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animTickId)
      } else {
        clearTimeout(this.animTickId)
      }
      this.animTickId = null
    }
  }
}
