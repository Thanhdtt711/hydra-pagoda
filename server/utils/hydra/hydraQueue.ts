/**
 * Hàng đợi giao dịch Hydra L2 (Hybrid):
 *  - SQLite `mc_ledger` luôn được ghi TRƯỚC (nguyên tử, idempotent). Sau khi commit, bút toán được xếp hàng để
 *    phản chiếu lên Hydra Head dưới dạng UTxO (NewTx -> TxValid -> SnapshotConfirmed).
 *  - Hàng đợi TUẦN TỰ theo từng tài khoản (mỗi account chỉ có 1 State UTxO nên các tx phải nối tiếp nhau).
 *  - Fuel Pool (10-20 UTxO nhỏ thuộc khóa Fuel) cho phép nhiều account chạy song song mà không tranh chấp
 *    cùng một input (tránh BadInputsUTxO).
 *  - Mọi lỗi chỉ để `hydra_status = 'offchain'`; KHÔNG BAO GIỜ ném lỗi ra ngoài luồng gameplay.
 */
import { getDb } from '../wallet/db'
import { getHydraConfig, type HydraConfig } from './config'
import { getHydraClient, type HydraClient, type HydraUtxoMap } from './hydraClient'
import { buildCip20Lines, buildFuelSplitTx, buildL2LedgerTx, type L2Key, type L2Utxo } from './l2TxBuilder'
import { ensureAccountSession, getFuelKey, getSessionKeyForAccount } from './sessionKey'

export type HydraLedgerStatus = 'offchain' | 'submitted' | 'valid' | 'snapshot_confirmed'

export interface HydraProof {
    enabled: boolean
    status: HydraLedgerStatus
    txHash: string | null
    snapshotNo: number | null
}

interface QueueState {
    chains: Map<number, Promise<void>>
    inflight: Map<number, Promise<void>>
    fuel: L2Utxo[]
    inUse: Set<string>
    state: Map<number, L2Utxo | null>
    stateLoaded: Set<number>
    poolReady: boolean
    poolInit: Promise<void> | null
    wiredClient: HydraClient | null
}

const GKEY = '__hydraPagodaQueue'
function S(): QueueState {
    const g = globalThis as any
    if (!g[GKEY]) {
        g[GKEY] = {
            chains: new Map(),
            inflight: new Map(),
            fuel: [],
            inUse: new Set(),
            state: new Map(),
            stateLoaded: new Set(),
            poolReady: false,
            poolInit: null,
            wiredClient: null
        } satisfies QueueState
    }
    return g[GKEY] as QueueState
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const OFFCHAIN: HydraProof = { enabled: false, status: 'offchain', txHash: null, snapshotNo: null }

interface LedgerRow {
    id: number
    account_id: number
    delta_mc: number
    balance_after: number
    reason: string
    ref_id: string
    hydra_tx_hash: string | null
    hydra_status: string | null
}

async function readLedger(ledgerId: number): Promise<LedgerRow | undefined> {
    const db = await getDb()
    return await db
        .prepare('SELECT id, account_id, delta_mc, balance_after, reason, ref_id, hydra_tx_hash, hydra_status FROM mc_ledger WHERE id = ?')
        .get(ledgerId) as LedgerRow | undefined
}

function entriesAt(utxo: HydraUtxoMap, address: string): L2Utxo[] {
    return Object.entries(utxo)
        .filter(([, v]) => v.address === address)
        .map(([ref, v]) => ({ ref, lovelace: Number(v.value.lovelace) }))
}

/** Gắn listener SnapshotConfirmed một lần cho mỗi client. */
function wire(client: HydraClient) {
    const st = S()
    if (st.wiredClient === client) return
    st.wiredClient = client
    client.on('snapshotConfirmed', async ({ number, txIds }: { number: number; txIds: string[] }) => {
        try {
            const db = await getDb()
            const stmt = db.prepare(
                "UPDATE mc_ledger SET hydra_status = 'snapshot_confirmed', hydra_snapshot_no = ? WHERE hydra_tx_hash = ?"
            )
            for (const id of txIds) await stmt.run(number, id)
        } catch (e: any) {
            console.warn('[hydra:l2] Không cập nhật được SnapshotConfirmed:', e?.message || e)
        }
    })
    client.on('disconnected', () => {
        // Trạng thái UTxO cục bộ không còn đáng tin sau khi mất kết nối -> nạp lại từ GetUTxO ở lần sau.
        const s = S()
        s.fuel = []
        s.poolReady = false
        s.state.clear()
        s.stateLoaded.clear()
    })
}

function invalidateCaches(accountId: number) {
    const st = S()
    st.fuel = []
    st.poolReady = false
    st.state.delete(accountId)
    st.stateLoaded.delete(accountId)
}

async function ensureFuelPool(client: HydraClient, fuelKey: L2Key, cfg: HydraConfig): Promise<void> {
    const st = S()
    if (st.poolReady) return
    if (st.poolInit) return st.poolInit
    st.poolInit = (async () => {
        const utxo = await client.getUTxO()
        const all = entriesAt(utxo, fuelKey.bech32).filter(u => !st.inUse.has(u.ref))
        st.fuel = all
        st.poolReady = true
        if (all.length === 0 || all.length >= cfg.fuelTarget) return

        // Chia UTxO lớn nhất thành nhiều UTxO nhỏ cho đủ Fuel Pool.
        const biggest = [...all].sort((a, b) => b.lovelace - a.lovelace)[0]!
        const count = cfg.fuelTarget - all.length + 1
        if (count < 2 || biggest.lovelace < count * (cfg.stateLovelace + 2_000_000)) return
        st.fuel = all.filter(u => u.ref !== biggest.ref)
        st.inUse.add(biggest.ref)
        try {
            const split = buildFuelSplitTx({ fuelKey, input: biggest, count })
            await client.submitTx(split.cborHex, split.txHash)
            split.outputs.forEach((lovelace, i) => st.fuel.push({ ref: `${split.txHash}#${i}`, lovelace }))
            console.log(`[hydra:l2] Fuel Pool: chia UTxO ${biggest.lovelace} lovelace thành ${count} UTxO (tx ${split.txHash.slice(0, 12)}…)`)
        } catch (e: any) {
            st.fuel.push(biggest)
            console.warn('[hydra:l2] Không chia được Fuel Pool:', e?.message || e)
        } finally {
            st.inUse.delete(biggest.ref)
        }
    })().finally(() => {
        st.poolInit = null
    })
    return st.poolInit
}

async function acquireFuel(client: HydraClient, fuelKey: L2Key, cfg: HydraConfig): Promise<L2Utxo> {
    const st = S()
    for (let i = 0; i < 80; i++) {
        await ensureFuelPool(client, fuelKey, cfg)
        const u = st.fuel.shift()
        if (u) {
            st.inUse.add(u.ref)
            return u
        }
        if (st.inUse.size === 0) {
            // Không còn fuel và không ai đang giữ -> thử nạp lại một lần rồi bỏ cuộc.
            st.poolReady = false
            await ensureFuelPool(client, fuelKey, cfg)
            const again = st.fuel.shift()
            if (again) {
                st.inUse.add(again.ref)
                return again
            }
            throw new Error('l2_no_fuel')
        }
        await sleep(50)
    }
    throw new Error('l2_fuel_exhausted')
}

async function getStateUtxo(client: HydraClient, accountId: number, l2Address: string): Promise<L2Utxo | null> {
    const st = S()
    if (st.stateLoaded.has(accountId)) return st.state.get(accountId) ?? null
    const utxo = await client.getUTxO()
    const found = entriesAt(utxo, l2Address)[0] ?? null
    st.state.set(accountId, found)
    st.stateLoaded.add(accountId)
    return found
}

async function processLedger(client: HydraClient, ledgerId: number): Promise<void> {
    const cfg = getHydraConfig()
    const st = S()
    const db = await getDb()
    if (!client.isOpen()) return
    const row = await readLedger(ledgerId)
    if (!row || row.hydra_tx_hash) return

    const { key: sessionKey, l1Address } = await getSessionKeyForAccount(row.account_id)
    await ensureAccountSession(row.account_id)
    const fuelKey = await getFuelKey()

    for (let attempt = 1; attempt <= 2; attempt++) {
        const fuel = await acquireFuel(client, fuelKey, cfg)
        try {
            const stateIn = await getStateUtxo(client, row.account_id, sessionKey.bech32)
            const built = buildL2LedgerTx({
                fuelKey,
                sessionKey,
                fuelInput: fuel,
                stateInput: stateIn,
                stateLovelace: cfg.stateLovelace,
                datumFields: [row.balance_after, row.id, row.delta_mc, row.account_id],
                metadataLines: buildCip20Lines({ reason: row.reason, deltaMc: row.delta_mc, l1Address, refId: row.ref_id })
            })

            // Ghi txHash TRƯỚC khi gửi để SnapshotConfirmed (đến rất nhanh) luôn tìm thấy bản ghi.
            await db.prepare("UPDATE mc_ledger SET hydra_tx_hash = ?, hydra_status = 'submitted' WHERE id = ?").run(built.txHash, row.id)
            try {
                await client.submitTx(built.cborHex, built.txHash)
            } catch (e) {
                await db.prepare("UPDATE mc_ledger SET hydra_tx_hash = NULL, hydra_status = 'offchain', hydra_snapshot_no = NULL WHERE id = ?").run(row.id)
                throw e
            }

            // TxValid: cập nhật bộ nhớ UTxO cục bộ và trạng thái sổ cái.
            if (built.changeLovelace > 0) st.fuel.push({ ref: `${built.txHash}#1`, lovelace: built.changeLovelace })
            st.state.set(row.account_id, { ref: `${built.txHash}#0`, lovelace: built.stateLovelace })
            st.stateLoaded.add(row.account_id)

            const snap = client.confirmedSnapshotOf(built.txHash)
            if (snap !== null) {
                await db.prepare("UPDATE mc_ledger SET hydra_status = 'snapshot_confirmed', hydra_snapshot_no = ? WHERE id = ?").run(snap, row.id)
            } else {
                await db.prepare("UPDATE mc_ledger SET hydra_status = 'valid' WHERE id = ? AND hydra_status = 'submitted'").run(row.id)
            }
            return
        } catch (e: any) {
            invalidateCaches(row.account_id)
            const msg = String(e?.message || e)
            if (attempt >= 2 || !msg.startsWith('hydra_tx_invalid')) throw e
            console.warn(`[hydra:l2] ledger #${row.id}: ${msg.slice(0, 160)} -> nạp lại UTxO và thử lại`)
        } finally {
            st.inUse.delete(fuel.ref)
        }
    }
}

/**
 * Xếp một bút toán `mc_ledger` đã COMMIT vào hàng đợi Hydra. Không bao giờ ném lỗi.
 * Trả về Promise hoàn tất khi xử lý xong (thành công hoặc fallback).
 */
export function scheduleHydraRecord(ledgerId: number): Promise<void> {
    try {
        if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0) return Promise.resolve()
        const client = getHydraClient()
        if (!client) return Promise.resolve()
        wire(client)
        if (!client.isOpen()) return Promise.resolve() // Fallback: giữ 'offchain'

        const st = S()
        const existing = st.inflight.get(ledgerId)
        if (existing) return existing

        const p: Promise<void> = (async () => {
            try {
                const row = await readLedger(ledgerId)
                if (!row || row.hydra_tx_hash || (row.hydra_status && row.hydra_status !== 'offchain')) return

                const prev = st.chains.get(row.account_id) ?? Promise.resolve()
                const chained = prev
                    .then(() => processLedger(client, ledgerId))
                    .catch((e: any) => {
                        console.warn(`[hydra:l2] ledger #${ledgerId} giữ ở SQLite (offchain): ${String(e?.message || e).slice(0, 200)}`)
                    })
                st.chains.set(row.account_id, chained)
                await chained
                if (st.chains.get(row.account_id) === chained) st.chains.delete(row.account_id)
            } finally {
                st.inflight.delete(ledgerId)
            }
        })()

        st.inflight.set(ledgerId, p)
        return p
    } catch (e: any) {
        console.warn('[hydra:l2] scheduleHydraRecord lỗi (bỏ qua):', e?.message || e)
        return Promise.resolve()
    }
}

/** Tiện ích cho các luồng chỉ biết (reason, refId), ví dụ nạp ADA. */
export async function scheduleHydraRecordByRef(reason: string, refId: string): Promise<void> {
    try {
        if (!getHydraConfig().enabled) return
        const db = await getDb()
        const row = await db.prepare('SELECT id FROM mc_ledger WHERE reason = ? AND ref_id = ?').get(reason, refId) as { id: number } | undefined
        if (row) return scheduleHydraRecord(row.id)
    } catch {
        // bỏ qua
    }
}

async function readProof(ledgerId: number): Promise<HydraProof> {
    const row = await readLedger(ledgerId)
    if (!row) return { ...OFFCHAIN, enabled: true }
    const db = await getDb()
    const snap = await db.prepare('SELECT hydra_snapshot_no AS n FROM mc_ledger WHERE id = ?').get(ledgerId) as { n: number | null }
    return {
        enabled: true,
        status: ((row.hydra_status as HydraLedgerStatus) || 'offchain'),
        txHash: row.hydra_tx_hash,
        snapshotNo: snap?.n ?? null
    }
}

/**
 * Lấy bằng chứng Hydra của một bút toán, chờ tối đa `waitMs` để L2 kịp xác nhận (mặc định 1.5s).
 * Khi Hydra tắt/không sẵn sàng trả ngay { status: 'offchain' } mà không chặn gameplay.
 */
export async function getHydraProof(ledgerId: number, waitMs = 1500): Promise<HydraProof> {
    try {
        if (!getHydraConfig().enabled) return { ...OFFCHAIN }
        const deadline = Date.now() + waitMs
        const inflight = S().inflight.get(ledgerId)
        if (inflight) await Promise.race([inflight, sleep(waitMs)])
        let proof = await readProof(ledgerId)
        while ((proof.status === 'valid' || proof.status === 'submitted') && Date.now() < deadline) {
            await sleep(25)
            proof = await readProof(ledgerId)
        }
        return proof
    } catch {
        return { ...OFFCHAIN, enabled: true }
    }
}

export async function getHydraStats() {
    const db = await getDb()
    const rows = await db
        .prepare("SELECT COALESCE(hydra_status, 'offchain') AS s, COUNT(*) AS n FROM mc_ledger GROUP BY s")
        .all() as Array<{ s: string; n: number }>
    const byStatus: Record<string, number> = { offchain: 0, submitted: 0, valid: 0, snapshot_confirmed: 0 }
    for (const r of rows) byStatus[r.s] = Number(r.n)
    const st = S()
    return { byStatus, fuelPoolSize: st.fuel.length, inFlight: st.inflight.size }
}
