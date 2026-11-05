// NetProtocol.ts - Binary Network Protocol for High-Performance MMO Movement
// Compact, zero-allocation binary encoder/decoder for 20Hz movement delta streaming.

export const MSG_MOVE = 0x01
export const MSG_HEARTBEAT = 0x02
export const MSG_EMOTE = 0x03
export const MSG_DELTA = 0x04

export type MovementAction = 'standing' | 'walking' | 'bowing' | 'meditating'

export const ACTION_TO_CODE: Record<MovementAction, number> = {
  standing: 0,
  walking: 1,
  bowing: 2,
  meditating: 3
}

export const CODE_TO_ACTION: Record<number, MovementAction> = {
  0: 'standing',
  1: 'walking',
  2: 'bowing',
  3: 'meditating'
}

export interface DecodedMovePacket {
  id: string
  action: MovementAction
  position: [number, number, number]
  yaw: number
  timestamp: number
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/**
 * Binary Move Packet Layout (Total: 24 + ID.length bytes):
 * - [0]: u8 - Message Type (0x01)
 * - [1]: u8 - Action Code (0: standing, 1: walking, 2: bowing, 3: meditating)
 * - [2]: u8 - ID string byte length (L)
 * - [3]: u8 - Flags/Reserved
 * - [4..7]: f32 - Position X
 * - [8..11]: f32 - Position Y
 * - [12..15]: f32 - Position Z
 * - [16..19]: f32 - Yaw (radians)
 * - [20..23]: u32 - Timestamp (epoch ms % 2^32)
 * - [24..24+L-1]: u8[L] - UTF-8 encoded ID
 */
export function encodeMovePacket(
  id: string,
  position: [number, number, number],
  yaw: number,
  action: MovementAction,
  timestamp: number = Date.now()
): Uint8Array {
  const idBytes = textEncoder.encode(id)
  const idLen = Math.min(idBytes.length, 64)
  const totalLength = 24 + idLen

  const buffer = new Uint8Array(totalLength)
  const view = new DataView(buffer.buffer)

  view.setUint8(0, MSG_MOVE)
  view.setUint8(1, ACTION_TO_CODE[action] ?? 0)
  view.setUint8(2, idLen)
  view.setUint8(3, 0) // Reserved

  view.setFloat32(4, position[0], true)
  view.setFloat32(8, position[1], true)
  view.setFloat32(12, position[2], true)
  view.setFloat32(16, yaw, true)
  view.setUint32(20, timestamp >>> 0, true)

  buffer.set(idBytes.subarray(0, idLen), 24)
  return buffer
}

export function decodeMovePacket(data: ArrayBuffer | Uint8Array): DecodedMovePacket | null {
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (buffer.length < 25) return null

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const msgType = view.getUint8(0)
  if (msgType !== MSG_MOVE) return null

  const actionCode = view.getUint8(1)
  const idLen = view.getUint8(2)
  if (buffer.length < 24 + idLen) return null

  const posX = view.getFloat32(4, true)
  const posY = view.getFloat32(8, true)
  const posZ = view.getFloat32(12, true)
  const yaw = view.getFloat32(16, true)
  const timestamp = view.getUint32(20, true)

  const idBytes = buffer.subarray(24, 24 + idLen)
  const id = textDecoder.decode(idBytes)

  return {
    id,
    action: CODE_TO_ACTION[actionCode] || 'standing',
    position: [posX, posY, posZ],
    yaw,
    timestamp
  }
}

/**
 * Spatial Grid Hash Calculation (40x40m AoI cells)
 */
export const GRID_CELL_SIZE = 40.0

export function getCellCoords(x: number, z: number): [number, number] {
  return [Math.floor(x / GRID_CELL_SIZE), Math.floor(z / GRID_CELL_SIZE)]
}

export function getCellKey(cx: number, cz: number): string {
  return `cell_${cx}_${cz}`
}

/**
 * Returns the 9 neighboring cell keys centered around (cx, cz)
 */
export function getNeighborCellKeys(cx: number, cz: number): string[] {
  const keys: string[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      keys.push(`cell_${cx + dx}_${cz + dz}`)
    }
  }
  return keys
}

