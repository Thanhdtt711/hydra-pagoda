// server/routes/_ws.ts - High-Performance Spatial Grid (AoI) WebSocket Route
// Ngân sách thiết kế: ~200 avatar đồng thời (binary packet 24 byte, AoI cell 40x40m).

import {
  MSG_MOVE,
  encodeMovePacket,
  decodeMovePacket,
  getCellCoords,
  getCellKey,
  getNeighborCellKeys,
  type MovementAction
} from '../../lib/network/NetProtocol'
import { consumeWsTicket } from '../utils/wallet/auth'

export interface PilgrimPresence {
  id: string
  name: string
  title: string
  country: string
  gender?: 'female' | 'male'
  position: [number, number, number]
  yaw: number
  action: MovementAction
  updatedAt: number
  /** true khi danh tính được gắn với địa chỉ ví đã xác thực chữ ký (tên do server đặt) */
  verified?: boolean
}

const ALLOWED_COUNTRIES = new Set(['vietnam', 'japan', 'thailand', 'korea', 'taiwan', 'singapore', 'india', 'tibet', 'western'])
const PILGRIM_ID_RE = /^[A-Za-z0-9_-]{3,40}$/

/** Cắt và làm sạch chuỗi hiển thị từ client (bỏ ký tự điều khiển). */
function cleanText(v: unknown, max: number, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
  return s || fallback
}

// Global server in-memory states
const pilgrims = new Map<string, PilgrimPresence>()
const peerPilgrimIds = new Map<string, string>()
const pilgrimCells = new Map<string, string>()
const peerSubscribedCells = new Map<string, Set<string>>()

// Rate limiting: maximum 25 packets/sec per peer (safety margin above 20Hz)
const peerLastMoveTime = new Map<string, number>()

export default defineWebSocketHandler({
  open(peer) {
    // Initial welcome packet with current active online count
    peer.send(
      JSON.stringify({
        type: 'server:welcome',
        onlineCount: pilgrims.size
      })
    )
  },

  async message(peer, message) {
    try {
      const raw = (message as any).rawData || message
      const isBinary =
        raw instanceof Uint8Array ||
        (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) ||
        (raw instanceof ArrayBuffer)

      // ==========================================
      // FAST PATH: HIGH-FREQUENCY BINARY MOVE (0x01)
      // ==========================================
      if (isBinary) {
        const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
        if (u8.length >= 24 && u8[0] === MSG_MOVE) {
          const now = Date.now()
          const peerId = peer.id

          // Enforce 20Hz-25Hz rate limiting (min 38ms between move ticks)
          const lastTime = peerLastMoveTime.get(peerId) || 0
          if (now - lastTime < 38) return
          peerLastMoveTime.set(peerId, now)

          const decoded = decodeMovePacket(u8)
          if (!decoded) return

          // Server-side validation against fake packets (NaN, Infinity, teleport > 15m/tick)
          if (
            !Number.isFinite(decoded.position[0]) ||
            !Number.isFinite(decoded.position[1]) ||
            !Number.isFinite(decoded.position[2]) ||
            !Number.isFinite(decoded.yaw)
          ) {
            return
          }

          // Chỉ chủ kết nối mới được điều khiển nhân vật của mình: id trong gói nhị phân
          // phải trùng id đã gắn với peer này lúc join (chặn giả mạo/điều khiển người khác).
          if (peerPilgrimIds.get(peerId) !== decoded.id) return

          const pilgrim = pilgrims.get(decoded.id)
          if (pilgrim) {
            // Anti-teleport / speed-hack protection (max 15m delta per tick ~ 300m/s threshold)
            const dx = decoded.position[0] - pilgrim.position[0]
            const dz = decoded.position[2] - pilgrim.position[2]
            if (dx * dx + dz * dz > 225.0) {
              return
            }

            pilgrim.position = decoded.position
            pilgrim.yaw = decoded.yaw
            pilgrim.action = decoded.action
            pilgrim.updatedAt = now

            // 1. Spatial Grid Partitioning (AoI)
            const [cx, cz] = getCellCoords(decoded.position[0], decoded.position[2])
            const currentCell = getCellKey(cx, cz)
            const oldCell = pilgrimCells.get(decoded.id)

            if (currentCell !== oldCell) {
              pilgrimCells.set(decoded.id, currentCell)
              updatePeerSubscriptions(peer, cx, cz)
            }

            // 2. Publish binary movement ONLY to current cell subscribers (radius ~60m)
            peer.publish(currentCell, u8)
          }
          return
        }
      }

      // ==========================================
      // STANDARD PATH: JSON CONTROL / CHAT / EMOTE
      // ==========================================
      const text = typeof message.text === 'function' ? message.text() : message.toString()
      if (!text || text[0] !== '{') return

      const data = JSON.parse(text)
      const now = Date.now()

      if (data.type === 'client:join') {
        // --- Xác thực danh tính ---
        // Có vé WS hợp lệ (đổi từ phiên đăng nhập ví) => tên do SERVER đặt theo tài khoản,
        // bỏ qua tên client gửi. Không có vé => khách, tên cố định "Khách xxxx" để không ai
        // mạo danh người chơi đã xác thực.
        const account = data.ticket ? await consumeWsTicket(data.ticket) : null
        if (data.ticket && !account) {
          peer.send(JSON.stringify({ type: 'server:error', code: 'bad_ticket', message: 'Vé kết nối không hợp lệ hoặc đã hết hạn' }))
        }

        const requestedId = typeof data.id === 'string' && PILGRIM_ID_RE.test(data.id) ? data.id : peer.id
        const prevId = peerPilgrimIds.get(peer.id)
        // Từ chối chiếm id đang do kết nối khác nắm giữ.
        if (pilgrims.has(requestedId) && requestedId !== prevId) {
          peer.send(JSON.stringify({ type: 'server:error', code: 'id_taken', message: 'Định danh này đang được dùng' }))
          return
        }

        // Join lại trên cùng kết nối (ví dụ vừa đăng nhập): gỡ hiện diện cũ trước.
        if (prevId && prevId !== requestedId) {
          const oldCell = pilgrimCells.get(prevId)
          pilgrims.delete(prevId)
          pilgrimCells.delete(prevId)
          if (oldCell) {
            peer.publish(oldCell, JSON.stringify({ type: 'server:leave', id: prevId, onlineCount: pilgrims.size }))
          }
        }

        const rawPos = Array.isArray(data.position) ? data.position : []
        const pos: [number, number, number] =
          rawPos.length === 3 && rawPos.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n as number) < 300)
            ? [rawPos[0], rawPos[1], rawPos[2]]
            : [0, 0, 10]

        const rawCountry = typeof data.country === 'string' ? data.country.split(':')[0] : 'vietnam'
        const rawGender =
          data.gender === 'male' || (typeof data.country === 'string' && data.country.endsWith(':male'))
            ? 'male'
            : 'female'

        const rawGuestFortune = cleanText(data.fortuneName, 40, '')
        const safeGuestFortune =
          rawGuestFortune &&
          !rawGuestFortune.startsWith('addr_') &&
          !/^khách\s/i.test(rawGuestFortune) &&
          rawGuestFortune !== 'Hành Giả Tâm An'
            ? rawGuestFortune
            : ''

        const presence: PilgrimPresence = {
          id: requestedId,
          name: account ? account.displayName : (safeGuestFortune || `Khách ${requestedId.slice(-4)}`),
          title: cleanText(data.title, 40, 'Sơ Tâm Nhập Đạo'),
          country: ALLOWED_COUNTRIES.has(rawCountry) ? rawCountry : 'vietnam',
          gender: rawGender,
          position: pos,
          yaw: typeof data.yaw === 'number' && Number.isFinite(data.yaw) ? data.yaw : 0,
          action: data.action || 'standing',
          updatedAt: now,
          verified: !!account
        }

        peerPilgrimIds.set(peer.id, presence.id)
          ; (peer as any).pilgrimId = presence.id
        pilgrims.set(presence.id, presence)

        const [cx, cz] = getCellCoords(presence.position[0], presence.position[2])
        const cell = getCellKey(cx, cz)
        pilgrimCells.set(presence.id, cell)

        // Subscribe peer to the 9 neighboring cells
        updatePeerSubscriptions(peer, cx, cz)
        peer.subscribe('sangha:global')

        // Gather localized snapshot of players within neighboring cells
        const neighborKeys = new Set(getNeighborCellKeys(cx, cz))
        const localPilgrims: PilgrimPresence[] = []
        for (const [pId, p] of pilgrims.entries()) {
          const pCell = pilgrimCells.get(pId)
          if (pCell && neighborKeys.has(pCell)) {
            localPilgrims.push(p)
          }
        }

        // Send localized snapshot back to joining peer
        peer.send(
          JSON.stringify({
            type: 'server:ack_join',
            id: presence.id,
            onlineCount: pilgrims.size,
            pilgrims: localPilgrims
          })
        )

        // Broadcast join only to nearby neighbors
        peer.publish(
          cell,
          JSON.stringify({
            type: 'server:join',
            pilgrim: presence,
            onlineCount: pilgrims.size
          })
        )
      } else if (data.type === 'client:ping') {
        peer.send(JSON.stringify({ type: 'server:pong', echoTime: data.echoTime, timestamp: now }))
      } else if (data.type === 'client:emote') {
        // Chỉ dùng id đã gắn với kết nối (không tin id client gửi kèm).
        const id = peerPilgrimIds.get(peer.id)
        const p = id ? pilgrims.get(id) : undefined
        if (id && p) {
          p.action = data.action
          p.updatedAt = now
          const cell = pilgrimCells.get(id) || 'cell_0_0'
          peer.publish(
            cell,
            JSON.stringify({
              type: 'server:emote',
              id,
              action: data.action,
              name: p.name
            })
          )
        }
      } else if (data.type === 'client:chat') {
        // Chat chỉ cho kết nối đã join; tên luôn lấy từ presence do server quản lý.
        const id = peerPilgrimIds.get(peer.id)
        const p = id ? pilgrims.get(id) : undefined
        if (!id || !p) return
        const text = cleanText(data.text, 140, '')
        if (!text) return
        const chatMsg = {
          type: 'server:chat',
          id,
          name: p.name,
          country: p.country,
          text,
          timestamp: now
        }
        // Chat is broadcast globally to all temple attendees
        peer.publish('sangha:global', JSON.stringify(chatMsg))
        peer.send(JSON.stringify(chatMsg))
      }
    } catch (err) {
      console.error('[WS] Error processing message:', err)
    }
  },

  close(peer) {
    const id = peerPilgrimIds.get(peer.id) || (peer as any).pilgrimId
    if (id) {
      const cell = pilgrimCells.get(id)
      pilgrims.delete(id)
      pilgrimCells.delete(id)
      peerPilgrimIds.delete(peer.id)
      peerLastMoveTime.delete(peer.id)

      const subs = peerSubscribedCells.get(peer.id)
      if (subs) {
        for (const c of subs) {
          try {
            peer.unsubscribe(c)
          } catch (e) { }
        }
        peerSubscribedCells.delete(peer.id)
      }

      if (cell) {
        peer.publish(
          cell,
          JSON.stringify({
            type: 'server:leave',
            id,
            onlineCount: pilgrims.size
          })
        )
      }
    }
  },

  error(peer, error) {
    console.error('[WS] Peer error:', error)
  }
})

/**
 * Updates a peer's subscriptions so they receive broadcasts only from the 9 adjacent 40x40m cells
 */
function updatePeerSubscriptions(peer: any, cx: number, cz: number) {
  const newNeighbors = getNeighborCellKeys(cx, cz)
  const currentSubs = peerSubscribedCells.get(peer.id) || new Set<string>()

  // Unsubscribe from cells that fell outside the 60m radius
  for (const c of currentSubs) {
    if (!newNeighbors.includes(c)) {
      try {
        peer.unsubscribe(c)
      } catch (e) { }
      currentSubs.delete(c)
    }
  }

  // Subscribe to newly entered adjacent cells
  for (const c of newNeighbors) {
    if (!currentSubs.has(c)) {
      try {
        peer.subscribe(c)
      } catch (e) { }
      currentSubs.add(c)
    }
  }

  peerSubscribedCells.set(peer.id, currentSubs)
}
