import { defineStore } from 'pinia'

export type HydraMode = 'hydra_l2' | 'local_ledger'
export type DbEngine = 'postgres' | 'sqlite'

export interface HydraStatusDto {
    enabled: boolean
    connected: boolean
    mode: HydraMode
    dbEngine?: DbEngine
    headStatus: string
    latestSnapshotNo: number
    totalL2Txs: number
    confirmedL2Txs: number
    avgConfirmMs: number | null
}

const POLL_MS = 15_000

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollRefs = 0

/**
 * Trạng thái chế độ sổ cái toàn cục: đang chạy Hydra L2 hay chỉ SQLite (sổ cái cục bộ).
 * Nguồn: GET /api/hydra/status (công khai). Thăm dò định kỳ khi có ít nhất một component đang theo dõi.
 */
export const useHydraStore = defineStore('hydra', {
    state: () => ({
        status: null as HydraStatusDto | null,
        loaded: false,
        failed: false
    }),

    getters: {
        /** true khi Hydra L2 bật VÀ node đang kết nối. */
        isL2Active: (state): boolean => Boolean(state.status?.enabled && state.status?.connected && state.status?.mode === 'hydra_l2'),
        /** true khi server đang dùng Supabase PostgreSQL (đã cấu hình DATABASE_URL). */
        isPostgres: (state): boolean => state.status?.dbEngine === 'postgres',
        /** Nhãn ngắn hiển thị động cơ CSDL trên HUD. */
        dbLabel(): string {
            if (!this.loaded) return '…'
            return this.isPostgres ? 'PostgreSQL' : 'SQLite'
        },
        /** Giải thích khi nào dùng PostgreSQL vs SQLite. */
        dbDescription(): string {
            if (!this.loaded) return 'Đang kiểm tra cơ sở dữ liệu…'
            if (this.isPostgres) {
                return 'Cơ sở dữ liệu: Supabase PostgreSQL (đang dùng DATABASE_URL — dữ liệu bền vững qua các lần deploy).'
            }
            return 'Cơ sở dữ liệu: SQLite cục bộ (fallback khi chưa cấu hình DATABASE_URL).'
        },
        /** Nhãn ngắn hiển thị trên HUD cho lớp sổ cái. */
        modeLabel(): string {
            return this.isL2Active ? 'Hydra L2' : this.dbLabel
        },
        /** Giải thích đầy đủ cho tooltip / trình đọc màn hình. */
        modeDescription(): string {
            const s = this.status
            if (!s || !this.loaded) return 'Đang kiểm tra chế độ sổ cái…'
            if (!s.enabled) return `${this.dbDescription} Hydra L2 đang tắt.`
            if (!s.connected) return `${this.dbDescription} Hydra L2 được bật nhưng chưa kết nối được hydra-node.`
            return `Hydra L2 đang chạy (Head: ${s.headStatus}, snapshot #${s.latestSnapshotNo}). ${this.dbLabel} vẫn là sổ cái gốc.`
        }
    },

    actions: {
        async refresh() {
            try {
                this.status = await $fetch<HydraStatusDto>('/api/hydra/status')
                this.failed = false
            } catch {
                this.failed = true
            } finally {
                this.loaded = true
            }
        },

        /** Bắt đầu thăm dò (đếm tham chiếu để nhiều component dùng chung một bộ hẹn giờ). */
        startPolling() {
            if (typeof window === 'undefined') return
            pollRefs++
            if (pollTimer) return
            void this.refresh()
            pollTimer = setInterval(() => { void this.refresh() }, POLL_MS)
        },

        stopPolling() {
            if (pollRefs > 0) pollRefs--
            if (pollRefs === 0 && pollTimer) {
                clearInterval(pollTimer)
                pollTimer = null
            }
        }
    }
})
