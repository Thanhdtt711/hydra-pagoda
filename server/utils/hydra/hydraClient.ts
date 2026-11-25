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
    private hasSnapshotUtxo = false

    connected = false
    headStatus: HydraHeadStatus = 'Disconnected'
    headId: string | null = null
    latestSnapshotNo = 0
    totalL2Txs = 0
    confirmedL2Txs = 0
    invalidL2Txs = 0
    private confirmMsTotal = 0
    private confirmMsCount = 0
    private confirmLatencyByTx = new Map<string, number>()

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

    /** Thời gian xác nhận L2 (ms) gần nhất của một txId (từ lúc gửi NewTx tới TxValid/SnapshotConfirmed). */
    confirmLatencyOf(txId: string): number | null {
        return this.confirmLatencyByTx.get(txId.toLowerCase()) ?? null
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
        this.hasSnapshotUtxo = false
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
                if (msg.snapshotUtxo && typeof msg.snapshotUtxo === 'object') {
                    this.snapshotUtxo = normalizeUtxo(msg.snapshotUtxo)
                    this.hasSnapshotUtxo = true
                }
                break
            }
            case 'HeadIsInitializing': this.setHead('Initializing', msg.headId); break
            case 'HeadIsOpen':
                if (msg.utxo && typeof msg.utxo === 'object') {
                    this.snapshotUtxo = normalizeUtxo(msg.utxo)
                    this.hasSnapshotUtxo = true
                }
                this.setHead('Open', msg.headId)
                break
            case 'NodeDisconnected':
            case 'NodeStopped': {
                this.markDisconnected(String(msg.tag))
                break
            }
            case 'HeadIsAborted':
                this.snapshotUtxo = {}
                this.setHead('Idle', msg.headId)
                break
            case 'HeadIsClosed':
                this.setHead('Closed', msg.headId)
                break
            case 'ReadyToFanout':
                this.setHead('FanoutPossible', msg.headId)
                break
            case 'HeadIsFinalized':
                this.snapshotUtxo = {}
                this.setHead('Final', msg.headId)
                break
            case 'GetUTxOResponse': {
                const u = normalizeUtxo(msg.utxo)
                this.snapshotUtxo = u
                this.hasSnapshotUtxo = true
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
                const now = Date.now()
                const t0 = this.sentAt.get(txId)
                if (t0) {
                    const ms = Math.max(1, now - t0)
                    this.confirmLatencyByTx.set(txId, ms)
                    while (this.confirmLatencyByTx.size > 500) {
                        const k = this.confirmLatencyByTx.keys().next().value
                        if (k === undefined) break
                        this.confirmLatencyByTx.delete(k)
                    }
                }
                const p = this.pending.get(txId)
                if (p) {
                    clearTimeout(p.timer)
                    this.pending.delete(txId)
                    p.resolve({ txId, validAt: now })
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
                const number = Number(snap.number ?? snap.snapshotNumber ?? 0)
                if (number > this.latestSnapshotNo) this.latestSnapshotNo = number
                if (snap.utxo && typeof snap.utxo === 'object') {
                    this.snapshotUtxo = normalizeUtxo(snap.utxo)
                    this.hasSnapshotUtxo = true
                }
                const ids: string[] = []
                const rawList = Array.isArray(snap.confirmed)
                    ? snap.confirmed
                    : (Array.isArray(snap.confirmedTransactions) ? snap.confirmedTransactions : [])
                for (const c of rawList) {
                    const id = typeof c === 'string' ? c : (c?.txId ?? c?.id ?? c?.transactionId)
                    if (typeof id === 'string') ids.push(id.toLowerCase())
                }
                const now = Date.now()
                for (const id of ids) {
                    this.confirmedCache.set(id, number)
                    this.confirmedL2Txs++
                    const t0 = this.sentAt.get(id)
                    if (t0) {
                        const ms = Math.max(1, now - t0)
                        this.confirmMsTotal += ms
                        this.confirmMsCount++
                        this.confirmLatencyByTx.set(id, ms)
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
            case 'CommitFinalized':
            case 'CommitApproved':
            case 'CommitRecorded':
            case 'DepositRecorded':
            case 'DepositApproved':
            case 'DepositFinalized': {
                if (msg.utxo && typeof msg.utxo === 'object') {
                    this.snapshotUtxo = normalizeUtxo(msg.utxo)
                    this.hasSnapshotUtxo = true
                } else {
                    void this.resolveWaitersViaHttpOrSnapshot()
                }
                this.emit('utxoUpdated')
                break
            }
            case 'InvalidInput':
            case 'CommandFailed':
            case 'PostTxOnChainFailed':
                // hydra-node >= 0.20 đã bỏ lệnh GetUTxO qua WebSocket (trả InvalidInput) -> dùng HTTP /snapshot/utxo hoặc snapshotUtxo từ Greetings
                if (this.utxoWaiters.length > 0 && (msg.tag === 'InvalidInput' || msg.tag === 'CommandFailed')) {
                    void this.resolveWaitersViaHttpOrSnapshot()
                } else {
                    console.warn(`[hydra:l2] ${msg.tag}:`, JSON.stringify(msg).slice(0, 300))
                }
                break
            default:
                break
        }
    }

    private buildSnapshotUtxoHttpUrl(): { url: string; headers: Record<string, string> } | null {
        try {
            const u = new URL(this.url)
            u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'
            // Hexcore định tuyến HTTP REST dưới .../socket/snapshot/utxo; local hydra-node dùng .../snapshot/utxo
            u.pathname = u.pathname.replace(/\/$/, '') + '/snapshot/utxo'
            u.searchParams.delete('history')
            const headers: Record<string, string> = { Accept: 'application/json' }
            const apiKey = u.searchParams.get('X-Api-Key')
            if (apiKey) headers['X-Api-Key'] = apiKey
            return { url: u.toString(), headers }
        } catch {
            return null
        }
    }

    private async resolveWaitersViaHttpOrSnapshot(): Promise<void> {
        const httpTarget = this.buildSnapshotUtxoHttpUrl()
        if (httpTarget) {
            try {
                const res = await fetch(httpTarget.url, { headers: httpTarget.headers })
                if (res.ok) {
                    const raw = await res.json()
                    const norm = normalizeUtxo(raw)
                    this.snapshotUtxo = norm
                    this.hasSnapshotUtxo = true
                }
            } catch {
                // Bỏ qua lỗi HTTP, dùng snapshotUtxo từ Greetings
            }
        }
        if (Object.keys(this.snapshotUtxo).length > 0 || this.hasSnapshotUtxo) {
            for (const w of this.utxoWaiters.splice(0)) {
                clearTimeout(w.timer)
                w.resolve(this.snapshotUtxo)
            }
        }
    }

    private sendJson(obj: unknown) {
        if (!this.ws || !this.connected) throw new Error('hydra_unavailable')
        this.ws.send(JSON.stringify(obj))
    }

    /** Lấy bản sao UTxO snapshot gần nhất đang lưu trong bộ nhớ. */
    getSnapshotUtxo(): HydraUtxoMap {
        return this.snapshotUtxo
    }

    /** Lấy UTxO set hiện tại của Head (ưu tiên snapshotUtxo đã nhận từ Greetings/SnapshotConfirmed, hoặc gọi GetUTxO / HTTP). */
    async getUTxO(timeoutMs = 800): Promise<HydraUtxoMap> {
        if (!this.connected) throw new Error('hydra_unavailable')
        // Nếu đã có sẵn UTxO từ Greetings / HeadIsOpen / SnapshotConfirmed trên remote node (Hexcore), trả ngay trong 0ms
        // để không bao giờ vượt quá ngưỡng chờ 1500ms của getHydraProof().
        const isLocalMock = this.url.includes('127.0.0.1') || this.url.includes('localhost')
        if (!isLocalMock && (Object.keys(this.snapshotUtxo).length > 0 || this.hasSnapshotUtxo)) {
            if (Object.keys(this.snapshotUtxo).length === 0) {
                await this.resolveWaitersViaHttpOrSnapshot()
            }
            return this.snapshotUtxo
        }
        return new Promise((resolve, reject) => {
            if (!this.connected) return reject(new Error('hydra_unavailable'))
            const timer = setTimeout(() => {
                const i = this.utxoWaiters.findIndex(w => w.timer === timer)
                if (i >= 0) this.utxoWaiters.splice(i, 1)
                if (Object.keys(this.snapshotUtxo).length > 0 || this.hasSnapshotUtxo) resolve(this.snapshotUtxo)
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

const KEY = '__hydraPagodaClient_v2'

/** Singleton theo process (an toàn khi Nitro dev reload). Trả null và tự đóng WS nếu HYDRA_L2_ENABLED=false. */
export function getHydraClient(): HydraClient | null {
    const cfg = getHydraConfig()
    const g = globalThis as any
    // Dọn instance cũ (nếu có từ bản trước khi HMR)
    if (g.__hydraPagodaClient) {
        try { g.__hydraPagodaClient.stop() } catch { /* ignore */ }
        delete g.__hydraPagodaClient
    }
    if (!cfg.enabled) {
        if (g[KEY]) {
            try { g[KEY].stop() } catch { /* ignore */ }
            delete g[KEY]
        }
        return null
    }
    let c: HydraClient | undefined = g[KEY]
    if (!c || c.getStatus().wsUrl !== cfg.wsUrl) {
        if (c) {
            try { c.stop() } catch { /* ignore */ }
        }
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
