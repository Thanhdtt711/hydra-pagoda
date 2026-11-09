/**
 * Cấu hình lớp Hydra L2 (Hybrid): SQLite vẫn là nguồn sự thật, Hydra Head là lớp chứng thực UTxO.
 * Mọi giá trị đọc từ biến môi trường (HYDRA_* hoặc NUXT_HYDRA_*) hoặc runtimeConfig; mặc định TẮT.
 */
export interface HydraConfig {
    /** Công tắc tổng. false => không mở WebSocket, không dựng tx, toàn bộ luồng chạy SQLite như cũ. */
    enabled: boolean
    /** WebSocket API của hydra-node, mặc định ws://127.0.0.1:4001 */
    wsUrl: string
    /** Bí mật máy chủ để dẫn xuất Session Key / Fuel Key (để trống => tự sinh và lưu trong bảng hydra_kv). */
    sessionSecret: string
    /** Số lovelace khóa trong "state UTxO" của mỗi tài khoản trên L2 */
    stateLovelace: number
    /** Số UTxO mồi (Fuel Pool) mong muốn trong Head */
    fuelTarget: number
    /** Thời gian chờ TxValid/TxInvalid cho mỗi NewTx (ms) */
    submitTimeoutMs: number
}

function envBool(...vals: unknown[]): boolean {
    for (const v of vals) {
        if (v === undefined || v === null || v === '') continue
        const s = String(v).trim().toLowerCase()
        return s === 'true' || s === '1' || s === 'yes' || s === 'on'
    }
    return false
}

function firstString(...vals: unknown[]): string {
    for (const v of vals) {
        if (v === undefined || v === null) continue
        const s = String(v).trim()
        if (s) return s
    }
    return ''
}

function positiveInt(def: number, ...vals: unknown[]): number {
    for (const v of vals) {
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) return Math.floor(n)
    }
    return def
}

export function getHydraConfig(): HydraConfig {
    const rc = useRuntimeConfig() as Record<string, any>
    return {
        enabled: envBool(process.env.HYDRA_L2_ENABLED, process.env.NUXT_HYDRA_L2_ENABLED, rc.hydraL2Enabled),
        wsUrl: firstString(process.env.HYDRA_NODE_WS_URL, process.env.NUXT_HYDRA_NODE_WS_URL, rc.hydraNodeWsUrl) || 'ws://127.0.0.1:4001',
        sessionSecret: firstString(process.env.HYDRA_SESSION_SECRET, process.env.NUXT_HYDRA_SESSION_SECRET, rc.hydraSessionSecret),
        stateLovelace: positiveInt(2_000_000, process.env.NUXT_HYDRA_STATE_LOVELACE, rc.hydraStateLovelace),
        fuelTarget: positiveInt(10, process.env.NUXT_HYDRA_FUEL_TARGET, rc.hydraFuelTarget),
        submitTimeoutMs: positiveInt(8000, process.env.NUXT_HYDRA_SUBMIT_TIMEOUT_MS, rc.hydraSubmitTimeoutMs)
    }
}
