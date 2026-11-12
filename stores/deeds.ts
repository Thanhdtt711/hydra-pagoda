import { defineStore } from 'pinia'
import { useEconomyStore } from './economy'

/** Một việc lành trong bộ ba hôm nay, do server trả về. */
export interface DailyDeedDto {
  id: string
  label: string
  kind: 'auto' | 'visit'
  landmark: string | null
  mapKey: string | null
  done: boolean
}

export interface DailyDeedsStatusDto {
  authenticated: boolean
  todayKey: string
  deeds: DailyDeedDto[]
  doneCount: number
  total: number
  rewardClaimed: boolean
  canClaim: boolean
  reward: { itemId: string; label: string }
}

function errorMessage(e: any, fallback: string): string {
  return e?.data?.data?.message || e?.data?.message || e?.statusMessage || e?.message || fallback
}

/** Điểm đang chờ server trả lời, để việc đi bộ liên tục trong vùng không bắn nhiều yêu cầu. */
const reporting = new Set<string>()
const lastTry = new Map<string, number>()
const RETRY_COOLDOWN_MS = 5000

export const useDeedsStore = defineStore('deeds', {
  state: () => ({
    loaded: false,
    loading: false,
    claiming: false,
    error: null as string | null,
    status: null as DailyDeedsStatusDto | null,
    /** Quà vừa nhận ở lần gần nhất, để panel hiển thị nhẹ nhàng. */
    lastReward: null as { itemId: string; label: string } | null,
    /** Mã điểm đang được dẫn tới, để panel hiện trạng thái "đang đi". */
    walkingTo: null as string | null
  }),

  actions: {
    async refreshStatus() {
      this.loading = true
      try {
        this.status = await $fetch<DailyDeedsStatusDto>('/api/mc/deeds/status')
        this.loaded = true
      } catch {
        // Bỏ qua lỗi mạng tạm thời, giữ trạng thái cũ.
      } finally {
        this.loading = false
      }
    },

    /**
     * Báo đã tới một điểm trong chùa. Chỉ gửi khi điểm đó thuộc ba việc chưa xong của hôm nay,
     * nên đi ngang qua các điểm khác không tốn yêu cầu mạng.
     */
    async reportVisit(landmark: string) {
      const deed = this.status?.deeds.find(d => d.kind === 'visit' && d.landmark === landmark)
      if (!deed || deed.done || reporting.has(landmark)) return null
      // Lỗi mạng hoặc từ chối: đợi vài giây mới thử lại, vì hàm này được gọi liên tục khi người chơi đứng gần điểm.
      const now = Date.now()
      if (now - (lastTry.get(landmark) ?? 0) < RETRY_COOLDOWN_MS) return null
      lastTry.set(landmark, now)
      reporting.add(landmark)
      try {
        const res = await $fetch<{ ok: boolean; status: DailyDeedsStatusDto }>('/api/mc/deeds/visit', {
          method: 'POST',
          body: { landmark }
        })
        this.status = res.status
        return res.status
      } catch (e: any) {
        this.error = errorMessage(e, 'Chưa ghi được việc lành, thử lại sau.')
        return null
      } finally {
        reporting.delete(landmark)
      }
    },

    async claim() {
      if (this.claiming) return null
      this.claiming = true
      this.error = null
      try {
        const res = await $fetch<{
          ok: boolean
          granted: boolean
          reward: { itemId: string; label: string }
          status: DailyDeedsStatusDto
          inventory: Array<{ itemId: string; category: string; quantity: number; unlockedAt: number }>
        }>('/api/mc/deeds/claim', { method: 'POST' })
        this.status = res.status
        this.lastReward = res.granted ? res.reward : null
        const economy = useEconomyStore()
        if (Array.isArray(res.inventory)) {
          economy.inventory = res.inventory as typeof economy.inventory
          economy.syncCardsStore()
        }
        return res
      } catch (e: any) {
        this.error = errorMessage(e, 'Chưa nhận được quà, thử lại sau.')
        return null
      } finally {
        this.claiming = false
      }
    }
  }
})
