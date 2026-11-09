/**
 * Client WebSocket tới hydra-node (mặc định ws://127.0.0.1:4001).
 *
 * - Dùng `WebSocket` toàn cục của Node >= 22 (không cần thêm dependency `ws`).
 * - Tự động kết nối lại (exponential backoff) và theo dõi HeadStatus:
 *   Idle | Initializing | Open | Closed | FanoutPossible | Final.
 * - Lệnh: GetUTxO, NewTx. Sự kiện: Greetings, HeadIs*, TxValid, TxInvalid, SnapshotConfirmed.
 * - KHÔNG BAO GIỜ ném lỗi ra ngoài luồng gameplay: mọi lỗi kết nối chỉ làm `isOpen() === false`.
 */
import { EventEmitter } from 'node:events'
import { getHydraConfig } from './config'

export type HydraHeadStatus = 'Disconnected' | 'Idle' | 'Initializing' | 'Open' | 'Closed' | 'FanoutPossible' | 'Final'

export interface HydraUtxoEntry {
    address: string
    value: { lovelace: number } & Record<string, unknown>
    inlineDatum?: unknown
    inlineDatumRaw?: string
    datum?: unknown
    datumhash?: string | null
    referenceScript?: unknown
}
export type HydraUtxoMap = Record<string, HydraUtxoEntry>

export interface HydraClientStatus {
    enabled: boolean
    connected: boolean
    headStatus: HydraHeadStatus
    headId: string | null
    latestSnapshotNo: number
    totalL2Txs: number
    confirmedL2Txs: number
    invalidL2Txs: number
    avgConfirmMs: number | null
    wsUrl: string
}

interface PendingTx {
    sentAt: number
    resolve: (v: { txId: string; validAt: number }) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
}

interface UtxoWaiter {
    resolve: (u: HydraUtxoMap) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
}

function pickTxId(msg: any): string | null {
    const t = msg?.transactionId ?? msg?.transaction?.txId ?? msg?.transaction?.id ?? msg?.txId
    return typeof t === 'string' ? t.toLowerCase() : null
}

function normalizeUtxo(raw: any): HydraUtxoMap {
    const out: HydraUtxoMap = {}
    if (!raw || typeof raw !== 'object') return out
    for (const [ref, v] of Object.entries(raw as Record<string, any>)) {
        if (!v || typeof v.address !== 'string') continue
        const lovelace = Number(v.value?.lovelace ?? v.value?.coin ?? 0)
        out[ref.toLowerCase()] = { ...v, value: { ...(v.value || {}), lovelace } }
    }
    return out
}

export class HydraClient extends EventEmitter {
    private ws: WebSocket | null = null
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private backoffMs = 1000
    private stopped = true
    private pending = new Map<string, PendingTx>()
    private sentAt = new Map<string, number>()
    private utxoWaiters: UtxoWaiter[] = []
    private confirmedCache = new Map<string, number>()
    private snapshotUtxo: HydraUtxoMap = {}

    connected = false
    headStatus: HydraHeadStatus = 'Disconnected'
    headId: string | null = null
    latestSnapshotNo = 0
    totalL2Txs = 0
    confirmedL2Txs = 0
    invalidL2Txs = 0
    private confirmMsTotal = 0
    private confirmMsCount = 0

    constructor(private readonly url: string) {
        super()
        this.setMaxListeners(50)
    }

    start() {
        if (!this.stopped) return
        this.stopped = false
        this.connect()
    }

    stop() {
        this.stopped = true
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        try { this.ws?.close() } catch { /* ignore */ }
        this.ws = null
        this.markDisconnected('stopped')
    }

    isOpen(): boolean {
        return this.connected && this.headStatus === 'Open'
    }

    /** snapshotNo đã xác nhận cho txId (nếu SnapshotConfirmed tới trước khi caller kịp xử lý) */
    confirmedSnapshotOf(txId: string): number | null {
        return this.confirmedCache.get(txId.toLowerCase()) ?? null
    }

    getStatus(): HydraClientStatus {
        return {
            enabled: true,
            connected: this.connected,
            headStatus: this.headStatus,
            headId: this.headId,
            latestSnapshotNo: this.latestSnapshotNo,
            totalL2Txs: this.totalL2Txs,
            confirmedL2Txs: this.confirmedL2Txs,
            invalidL2Txs: this.invalidL2Txs,
            avgConfirmMs: this.confirmMsCount ? Math.round(this.confirmMsTotal / this.confirmMsCount) : null,
            wsUrl: this.url
        }
    }

    private connect() {
        if (this.stopped) return
        try {
            const WS = (globalThis as any).WebSocket as typeof WebSocket | undefined
            if (!WS) {
                console.warn('[hydra:l2] Runtime không có WebSocket toàn cục (cần Node >= 22) -> chạy chế độ SQLite')
                return
            }
            const sep = this.url.includes('?') ? '&' : '?'
            const ws = new WS(this.url.includes('history=') ? this.url : `${this.url}${sep}history=no`)
            this.ws = ws
            ws.onopen = () => {
                this.connected = true
                this.backoffMs = 1000
                if (this.headStatus === 'Disconnected') this.headStatus = 'Idle'
                console.log(`[hydra:l2] Đã kết nối hydra-node ${this.url}`)
                this.emit('connected')
            }
            ws.onmessage = (ev: MessageEvent) => {
                try {
                    const text = typeof ev.data === 'string' ? ev.data : String(ev.data)
                    this.handleMessage(JSON.parse(text))
                } catch (e: any) {
                    console.warn('[hydra:l2] Bỏ qua message không đọc được:', e?.message || e)
                }
            }
            ws.onerror = () => { /* onclose sẽ xử lý */ }
            ws.onclose = () => {
                if (this.ws === ws) this.ws = null
                this.markDisconnected('closed')
                this.scheduleReconnect()
            }
        } catch (e: any) {
            console.warn('[hydra:l2] Không mở được WebSocket:', e?.message || e)
            this.markDisconnected('error')
            this.scheduleReconnect()
        }
    }

    private scheduleReconnect() {
        if (this.stopped || this.reconnectTimer) return
        const wait = this.backoffMs
        this.backoffMs = Math.min(this.backoffMs * 2, 30_000)
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, wait)
            ; (this.reconnectTimer as any).unref?.()
    }

    private markDisconnected(reason: string) {
        const was = this.connected
        this.connected = false
        this.headStatus = 'Disconnected'
        const err = new Error(`hydra_disconnected:${reason}`)
        for (const [txId, p] of this.pending) {
            clearTimeout(p.timer)
            p.reject(err)
            this.pending.delete(txId)
        }
        for (const w of this.utxoWaiters.splice(0)) {
            clearTimeout(w.timer)
            w.reject(err)
        }
        if (was) {
            console.warn(`[hydra:l2] Mất kết nối hydra-node (${reason}) -> fallback SQLite`)
            this.emit('disconnected')
        }
    }

    private setHead(status: HydraHeadStatus, headId?: string | null) {
        if (headId) this.headId = headId
        if (this.headStatus !== status) {
            this.headStatus = status
            console.log(`[hydra:l2] HeadStatus = ${status}`)
            this.emit('headStatus', status)
        }
    }

    private handleMessage(msg: any) {
        switch (msg?.tag) {
            case 'Greetings': {
                const hs = String(msg.headStatus || 'Idle') as HydraHeadStatus
                this.setHead(hs, msg.headId ?? null)
                if (msg.snapshotUtxo) this.snapshotUtxo = normalizeUtxo(msg.snapshotUtxo)
                break
            }
            case 'HeadIsInitializing': this.setHead('Initializing', msg.headId); break
            case 'HeadIsOpen':
                if (msg.utxo) this.snapshotUtxo = normalizeUtxo(msg.utxo)
                this.setHead('Open', msg.headId)
                break
            case 'HeadIsClosed': this.setHead('Closed', msg.headId); break
            case 'ReadyToFanout': this.setHead('FanoutPossible', msg.headId); break
            case 'HeadIsFinalized': this.setHead('Final', msg.headId); break
            case 'GetUTxOResponse': {
                const u = normalizeUtxo(msg.utxo)
                this.snapshotUtxo = u
                for (const w of this.utxoWaiters.splice(0)) {
                    clearTimeout(w.timer)
                    w.resolve(u)
                }
                break
            }
            case 'TxValid': {
                const txId = pickTxId(msg)
                this.totalL2Txs++
                if (!txId) break
                const p = this.pending.get(txId)
                if (p) {
                    clearTimeout(p.timer)
                    this.pending.delete(txId)
                    p.resolve({ txId, validAt: Date.now() })
                }
                this.emit('txValid', txId)
                break
            }
            case 'TxInvalid': {
                const txId = pickTxId(msg)
                this.invalidL2Txs++
                const reason = typeof msg.validationError?.reason === 'string'
                    ? msg.validationError.reason
                    : JSON.stringify(msg.validationError ?? 'TxInvalid')
                if (!txId) break
                this.sentAt.delete(txId)
                const p = this.pending.get(txId)
                if (p) {
                    clearTimeout(p.timer)
                    this.pending.delete(txId)
                    p.reject(new Error(`hydra_tx_invalid:${reason}`))
                }
                this.emit('txInvalid', txId, reason)
                break
            }
            case 'SnapshotConfirmed': {
                const snap = msg.snapshot || {}
                const number = Number(snap.number ?? 0)
                if (number > this.latestSnapshotNo) this.latestSnapshotNo = number
                if (snap.utxo) this.snapshotUtxo = normalizeUtxo(snap.utxo)
                const ids: string[] = []
                for (const c of Array.isArray(snap.confirmed) ? snap.confirmed : []) {
                    const id = typeof c === 'string' ? c : (c?.txId ?? c?.id)
                    if (typeof id === 'string') ids.push(id.toLowerCase())
                }
                const now = Date.now()
                for (const id of ids) {
                    this.confirmedCache.set(id, number)
                    this.confirmedL2Txs++
                    const t0 = this.sentAt.get(id)
                    if (t0) {
                        this.confirmMsTotal += now - t0
                        this.confirmMsCount++
                        this.sentAt.delete(id)
                    }
                }
                while (this.confirmedCache.size > 5000) {
                    const k = this.confirmedCache.keys().next().value
                    if (k === undefined) break
                    this.confirmedCache.delete(k)
                }
                this.emit('snapshotConfirmed', { number, txIds: ids })
                break
            }
            case 'CommandFailed':
            case 'PostTxOnChainFailed':
                console.warn(`[hydra:l2] ${msg.tag}:`, JSON.stringify(msg).slice(0, 300))
                break
            default:
                break
        }
    }

    private sendJson(obj: unknown) {
        if (!this.ws || !this.connected) throw new Error('hydra_unavailable')
        this.ws.send(JSON.stringify(obj))
    }

    /** Lấy UTxO set hiện tại của Head (GetUTxO). */
    getUTxO(timeoutMs = 3000): Promise<HydraUtxoMap> {
        return new Promise((resolve, reject) => {
            if (!this.connected) return reject(new Error('hydra_unavailable'))
            const timer = setTimeout(() => {
                const i = this.utxoWaiters.findIndex(w => w.timer === timer)
                if (i >= 0) this.utxoWaiters.splice(i, 1)
                // Dự phòng: dùng snapshot UTxO gần nhất nếu hydra-node phiên bản cũ không trả GetUTxOResponse
                if (Object.keys(this.snapshotUtxo).length) resolve(this.snapshotUtxo)
                else reject(new Error('hydra_getutxo_timeout'))
            }, timeoutMs)
            this.utxoWaiters.push({ resolve, reject, timer })
            try {
                this.sendJson({ tag: 'GetUTxO' })
            } catch (e: any) {
                clearTimeout(timer)
                this.utxoWaiters = this.utxoWaiters.filter(w => w.timer !== timer)
                reject(e)
            }
        })
    }

    /** Gửi NewTx và chờ TxValid (resolve) hoặc TxInvalid / timeout (reject). */
    submitTx(cborHex: string, txIdRaw: string, timeoutMs?: number): Promise<{ txId: string; validAt: number }> {
        const txId = txIdRaw.toLowerCase()
        const wait = timeoutMs ?? getHydraConfig().submitTimeoutMs
        return new Promise((resolve, reject) => {
            if (!this.isOpen()) return reject(new Error('hydra_head_not_open'))
            const timer = setTimeout(() => {
                this.pending.delete(txId)
                reject(new Error('hydra_submit_timeout'))
            }, wait)
            const sentAt = Date.now()
            this.pending.set(txId, { sentAt, resolve, reject, timer })
            this.sentAt.set(txId, sentAt)
            try {
                this.sendJson({
                    tag: 'NewTx',
                    transaction: { type: 'Tx ConwayEra', description: 'MC ledger L2 tx', cborHex, txId }
                })
            } catch (e: any) {
                clearTimeout(timer)
                this.pending.delete(txId)
                this.sentAt.delete(txId)
                reject(e)
            }
        })
    }
}

const KEY = '__hydraPagodaClient'

/** Singleton theo process (an toàn khi Nitro dev reload). Trả null nếu HYDRA_L2_ENABLED=false. */
export function getHydraClient(): HydraClient | null {
    const cfg = getHydraConfig()
    if (!cfg.enabled) return null
    const g = globalThis as any
    let c: HydraClient | undefined = g[KEY]
    if (!c) {
        c = new HydraClient(cfg.wsUrl)
        g[KEY] = c
    }
    c.start()
    return c
}

export function stopHydraClient() {
    const g = globalThis as any
    const c: HydraClient | undefined = g[KEY]
    if (c) {
        c.stop()
        delete g[KEY]
    }
}
