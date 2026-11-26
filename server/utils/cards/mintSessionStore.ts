/**
 * Kho lưu tạm các phiên Mint CIP-68 đang chờ ký / xác nhận (TTL 10 phút) để chống tráo đổi txHash.
 */
export interface PendingCardMintSession {
  mintId: string
  accountId: number
  cardInventoryId: number
  cardId: string
  serialNo: number
  unsignedTxCbor: string
  txHash: string
  policyId: string
  refAssetId: string
  userAssetId: string
  createdAt: number
}

const KEY = '__hydraPagodaCardMintSessions_v1'
const TTL_MS = 10 * 60 * 1000

function storeMap(): Map<string, PendingCardMintSession> {
  const g = globalThis as any
  if (!g[KEY]) g[KEY] = new Map<string, PendingCardMintSession>()
  return g[KEY] as Map<string, PendingCardMintSession>
}

export function savePendingMint(session: PendingCardMintSession) {
  const map = storeMap()
  const now = Date.now()
  for (const [k, v] of map) {
    if (now - v.createdAt > TTL_MS) map.delete(k)
  }
  map.set(session.mintId, session)
}

export function getPendingMint(mintId: string): PendingCardMintSession | undefined {
  const map = storeMap()
  const s = map.get(mintId)
  if (!s) return undefined
  if (Date.now() - s.createdAt > TTL_MS) {
    map.delete(mintId)
    return undefined
  }
  return s
}

export function deletePendingMint(mintId: string) {
  storeMap().delete(mintId)
}
