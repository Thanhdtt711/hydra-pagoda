import fs from 'node:fs'
import path from 'node:path'

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

let cachedEnvMtime = 0
let cachedEnvMap: Record<string, string> = {}

function readLiveDotEnv(): Record<string, string> {
    try {
        const p = path.join(process.cwd(), '.env')
        const st = fs.statSync(p)
        if (st.mtimeMs !== cachedEnvMtime) {
            cachedEnvMtime = st.mtimeMs
            const out: Record<string, string> = {}
            for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
                const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
                if (m && m[1]) out[m[1]] = (m[2] ?? '').replace(/^['"]|['"]$/g, '').trim()
            }
            cachedEnvMap = out
        }
    } catch {
        // Bỏ qua nếu không có file .env
    }
    return cachedEnvMap
}

export function getHydraConfig(): HydraConfig {
    const rc: Record<string, any> = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {}
    const live = readLiveDotEnv()
    return {
        enabled: envBool(
            live.HYDRA_L2_ENABLED,
            live.NUXT_HYDRA_L2_ENABLED,
            process.env.HYDRA_L2_ENABLED,
            process.env.NUXT_HYDRA_L2_ENABLED,
            rc.hydraL2Enabled
        ),
        wsUrl: firstString(
            live.HYDRA_NODE_WS_URL,
            live.NUXT_HYDRA_NODE_WS_URL,
            process.env.HYDRA_NODE_WS_URL,
            process.env.NUXT_HYDRA_NODE_WS_URL,
            rc.hydraNodeWsUrl
        ) || 'ws://127.0.0.1:4001',
        sessionSecret: firstString(
            live.HYDRA_SESSION_SECRET,
            live.NUXT_HYDRA_SESSION_SECRET,
            process.env.HYDRA_SESSION_SECRET,
            process.env.NUXT_HYDRA_SESSION_SECRET,
            rc.hydraSessionSecret
        ),
        stateLovelace: positiveInt(2_000_000, live.NUXT_HYDRA_STATE_LOVELACE, process.env.NUXT_HYDRA_STATE_LOVELACE, rc.hydraStateLovelace),
        fuelTarget: positiveInt(10, live.NUXT_HYDRA_FUEL_TARGET, process.env.NUXT_HYDRA_FUEL_TARGET, rc.hydraFuelTarget),
        submitTimeoutMs: positiveInt(8000, live.NUXT_HYDRA_SUBMIT_TIMEOUT_MS, process.env.NUXT_HYDRA_SUBMIT_TIMEOUT_MS, rc.hydraSubmitTimeoutMs)
    }
}
