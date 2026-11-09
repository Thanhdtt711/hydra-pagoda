import { defineStore } from 'pinia'

export type HydraMode = 'hydra_l2' | 'local_ledger'

export interface HydraStatusDto {
    enabled: boolean
    connected: boolean
    mode: HydraMode
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
        /** Nhãn ngắn hiển thị trên HUD. */
        modeLabel(): string {
            return this.isL2Active ? 'Hydra L2' : 'SQLite'
        },
        /** Giải thích đầy đủ cho tooltip / trình đọc màn hình. */
        modeDescription(): string {
            const s = this.status
            if (!s || !this.loaded) return 'Đang kiểm tra chế độ sổ cái…'
            if (!s.enabled) return 'Sổ cái cục bộ (SQLite). Hydra L2 đang tắt.'
            if (!s.connected) return 'Sổ cái cục bộ (SQLite). Hydra L2 được bật nhưng chưa kết nối được hydra-node.'
            return `Hydra L2 đang chạy (Head: ${s.headStatus}, snapshot #${s.latestSnapshotNo}). SQLite vẫn là sổ cái gốc.`
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
