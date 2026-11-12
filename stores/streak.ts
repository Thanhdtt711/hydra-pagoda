import { defineStore } from 'pinia'
import { useEconomyStore } from './economy'

/** Một cột mốc của Sổ Tu Tập, do server trả về. */
export interface StreakMilestoneDto {
  milestone: number
  label: string
  kind: 'item' | 'card' | 'title'
  reached: boolean
  granted: boolean
}

export interface StreakDeedsDto {
  meditation: boolean
  incense: boolean
  fortune: boolean
  merit: boolean
}

export interface StreakStatusDto {
  authenticated: boolean
  todayKey: string
  currentStreak: number
  bestStreak: number
  todayDone: boolean
  canClaim: boolean
  restUsedThisWeek: boolean
  title: string | null
  deeds: StreakDeedsDto
  nextMilestone: { milestone: number; label: string } | null
  milestones: StreakMilestoneDto[]
}

export interface StreakRewardDto {
  milestone: number
  kind: 'item' | 'card' | 'title'
  label: string
  itemId?: string
  cardId?: string
  cardTitle?: string
  title?: string
  alreadyOwned?: boolean
}

export type StreakOutcome = 'first' | 'continued' | 'rested' | 'halved' | 'already'

function errorMessage(e: any, fallback: string): string {
  return e?.data?.data?.message || e?.data?.message || e?.statusMessage || e?.message || fallback
}

export const useStreakStore = defineStore('streak', {
  state: () => ({
    loaded: false,
    loading: false,
    claiming: false,
    error: null as string | null,
    status: null as StreakStatusDto | null,
    /** Quà vừa nhận ở lần ghi dấu gần nhất, để panel hiển thị nhẹ nhàng. */
    lastRewards: [] as StreakRewardDto[],
    lastOutcome: null as StreakOutcome | null
  }),

  getters: {
    deedCount(state): number {
      const d = state.status?.deeds
      return d ? Number(d.meditation) + Number(d.incense) + Number(d.fortune) + Number(d.merit) : 0
    }
  },

  actions: {
    async refreshStatus() {
      this.loading = true
      try {
        this.status = await $fetch<StreakStatusDto>('/api/mc/streak/status')
        this.loaded = true
      } catch {
        // Bỏ qua lỗi mạng tạm thời, giữ trạng thái cũ.
      } finally {
        this.loading = false
      }
    },

    /** Ghi dấu hôm nay. Server tự kiểm tra việc lành; client không gửi gì. */
    async claim() {
      if (this.claiming) return null
      this.claiming = true
      this.error = null
      try {
        const res = await $fetch<{
          ok: boolean
          outcome: StreakOutcome
          rewards: StreakRewardDto[]
          status: StreakStatusDto
          inventory: Array<{ itemId: string; category: string; quantity: number; unlockedAt: number }>
        }>('/api/mc/streak/claim', { method: 'POST' })
        this.status = res.status
        this.lastOutcome = res.outcome
        this.lastRewards = res.rewards
        const economy = useEconomyStore()
        if (Array.isArray(res.inventory)) {
          economy.inventory = res.inventory as typeof economy.inventory
          economy.syncCardsStore()
        }
        return res
      } catch (e: any) {
        this.error = errorMessage(e, 'Chưa ghi được dấu, thử lại sau.')
        return null
      } finally {
        this.claiming = false
      }
    }
  }
})
