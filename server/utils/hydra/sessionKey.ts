/**
 * Session Ephemeral Key (khóa phiên L2) gắn với account_id.
 *
 * - Sau khi đăng nhập CIP-8 thành công (`POST /api/auth/verify`), máy chủ dẫn xuất cặp khóa Ed25519
 *   từ (bí mật máy chủ, accountId, địa chỉ L1 đã chứng minh sở hữu) và lưu CHỈ phần công khai
 *   (`l2_session_vkey`, `l2_address`) vào bảng `accounts`.
 * - Khóa riêng không được lưu và không gửi xuống client; ký giao dịch L2 diễn ra hoàn toàn ở server
 *   nên người chơi không phải bật popup Eternl cho mỗi lần tiêu MC.
 */
import { randomBytes } from 'node:crypto'
import { getDb } from '../wallet/db'
import { getHydraConfig } from './config'
import { deriveFuelKey, deriveSessionKey, type L2Key } from './l2TxBuilder'

export interface AccountL2Session {
    sessionVkey: string
    l2Address: string
}

/** Bí mật dẫn xuất khóa: ưu tiên env, nếu không có thì tự sinh một lần và lưu trong `hydra_kv`. */
export async function getHydraSecret(): Promise<string> {
    const fromEnv = getHydraConfig().sessionSecret
    if (fromEnv) return fromEnv
    const db = await getDb()
    const row = await db.prepare("SELECT v FROM hydra_kv WHERE k = 'session_secret'").get<{ v: string }>()
    if (row?.v) return row.v
    const fresh = randomBytes(32).toString('hex')
    await db.prepare("INSERT INTO hydra_kv (k, v, updated_at) VALUES ('session_secret', ?, ?) ON CONFLICT (k) DO NOTHING").run(fresh, Date.now())
    const again = await db.prepare("SELECT v FROM hydra_kv WHERE k = 'session_secret'").get<{ v: string }>()
    return again!.v
}

export async function getFuelKey(): Promise<L2Key> {
    return deriveFuelKey(await getHydraSecret())
}

export async function getSessionKeyForAccount(accountId: number): Promise<{ key: L2Key; l1Address: string }> {
    const db = await getDb()
    const acc = await db.prepare('SELECT address FROM accounts WHERE id = ?').get<{ address: string }>(accountId)
    if (!acc) throw new Error('account_not_found')
    return { key: deriveSessionKey(await getHydraSecret(), accountId, acc.address), l1Address: acc.address }
}

/** Tạo (nếu chưa có) và trả về thông tin công khai của khóa phiên L2. Idempotent. */
export async function ensureAccountSession(accountId: number): Promise<AccountL2Session> {
    const { key } = await getSessionKeyForAccount(accountId)
    const db = await getDb()
    const row = await db.prepare('SELECT l2_session_vkey, l2_address FROM accounts WHERE id = ?').get<{
        l2_session_vkey: string | null
        l2_address: string | null
    }>(accountId)
    if (!row || row.l2_session_vkey !== key.vkeyHex || row.l2_address !== key.bech32) {
        await db.prepare('UPDATE accounts SET l2_session_vkey = ?, l2_address = ? WHERE id = ?').run(key.vkeyHex, key.bech32, accountId)
    }
    return { sessionVkey: key.vkeyHex, l2Address: key.bech32 }
}
