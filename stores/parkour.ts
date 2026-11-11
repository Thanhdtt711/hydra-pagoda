import { defineStore } from 'pinia'
import { useEconomyStore } from './economy'
import { useWalletStore } from './wallet'

export interface ParkourState {
  canClaimFreeToday: boolean
  attemptsToday: number
  bestTimeSec: number | null
  currentCostMc: number
  grantRewardMc: number
  completionRewardMc: number
  activeRunToken: string | null
  runStartedAt: number | null
  elapsedSec: number
  isClimbing: boolean
  isLoading: boolean
  noticeMessage: string | null
  lastSummitHydra: any
}

let timerInterval: ReturnType<typeof setInterval> | null = null

export const useParkourStore = defineStore('parkour', {
  state: (): ParkourState => ({
    canClaimFreeToday: true,
    attemptsToday: 0,
    bestTimeSec: null,
    currentCostMc: 0,
    grantRewardMc: 0,
    completionRewardMc: 100,
    activeRunToken: null,
    runStartedAt: null,
    elapsedSec: 0,
    isClimbing: false,
    isLoading: false,
    noticeMessage: null,
    lastSummitHydra: null
  }),

  actions: {
    async fetchStatus() {
      try {
        const res = await $fetch<{
          ok: boolean
          canClaimFreeToday: boolean
          attemptsToday: number
          bestTimeSec: number | null
          currentCostMc: number
          grantRewardMc: number
          completionRewardMc: number
        }>('/api/mc/parkour/status')
        if (res?.ok) {
          this.canClaimFreeToday = res.canClaimFreeToday
          this.attemptsToday = res.attemptsToday
          this.bestTimeSec = res.bestTimeSec
          this.currentCostMc = res.currentCostMc
          this.grantRewardMc = res.grantRewardMc
          this.completionRewardMc = res.completionRewardMc
        }
      } catch {
        // Guest mode fallback
      }
    },

    async startChallenge(): Promise<{ isFree: boolean; grantedMc: number; chargedMc: number } | null> {
      const wallet = useWalletStore()
      const economy = useEconomyStore()

      if (!wallet.isConnected) {
        this.noticeMessage = 'Vui lòng kết nối ví để nhận MC và ghi nhận kỷ lục!'
        return null
      }

      this.isLoading = true
      this.noticeMessage = null

      try {
        const res = await $fetch<{
          ok: boolean
          runToken: string
          isFreeRun: boolean
          grantedMc: number
          chargedMc: number
          currentBalanceMc: number
          startedAt: number
        }>('/api/mc/parkour/start', {
          method: 'POST'
        })

        if (res?.ok) {
          this.activeRunToken = res.runToken
          this.runStartedAt = res.startedAt
          this.elapsedSec = 0
          this.isClimbing = true
          this.canClaimFreeToday = false
          this.attemptsToday += 1
          this.currentCostMc = 5
          economy.meritCoins = res.currentBalanceMc

          if (timerInterval) clearInterval(timerInterval)
          timerInterval = setInterval(() => {
            if (this.isClimbing && this.runStartedAt) {
              this.elapsedSec = Math.floor((Date.now() - this.runStartedAt) / 1000)
            }
          }, 1000)

          return {
            isFree: res.isFreeRun,
            grantedMc: res.grantedMc,
            chargedMc: res.chargedMc
          }
        }
        return null
      } catch (e: any) {
        this.noticeMessage = e?.data?.message || 'Chưa thể bắt đầu thử thách leo núi.'
        return null
      } finally {
        this.isLoading = false
      }
    },

    async completeSummit(): Promise<{ rewardMc: number; timeTakenSec: number; isNewRecord: boolean; hydra?: any } | null> {
      if (!this.activeRunToken || !this.isClimbing) return null
      const economy = useEconomyStore()
      this.isLoading = true

      try {
        const res = await $fetch<{
          ok: boolean
          rewardMc: number
          timeTakenSec: number
          isNewRecord: boolean
          bestTimeSec: number
          currentBalanceMc: number
          hydra?: any
        }>('/api/mc/parkour/complete', {
          method: 'POST',
          body: { runToken: this.activeRunToken }
        })

        if (res?.ok) {
          this.stopTimer()
          economy.meritCoins = res.currentBalanceMc
          if (res.bestTimeSec) {
            this.bestTimeSec = res.bestTimeSec
          }
          this.lastSummitHydra = res.hydra || null
          return {
            rewardMc: res.rewardMc,
            timeTakenSec: res.timeTakenSec,
            isNewRecord: res.isNewRecord,
            hydra: res.hydra
          }
        }
        return null
      } catch (e: any) {
        this.noticeMessage = e?.data?.message || 'Chưa thể xác nhận hoàn thành leo núi.'
        return null
      } finally {
        this.isLoading = false
      }
    },

    stopTimer() {
      this.isClimbing = false
      this.activeRunToken = null
      this.runStartedAt = null
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }
  }
})

