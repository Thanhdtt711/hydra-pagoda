import { defineStore } from 'pinia'
import { useEconomyStore } from './economy'

export type OnboardingStep = 'welcome' | 'move' | 'menu' | 'incense' | 'done'
export type OnboardingEvent = 'move' | 'menu' | 'incense'

const STORAGE_KEY = 'van_canh_onboarding_v1'
const ORDER: OnboardingStep[] = ['welcome', 'move', 'menu', 'incense', 'done']

function readFinished(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === 'finished'
  } catch {
    return false
  }
}

function writeFinished(v: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (v) localStorage.setItem(STORAGE_KEY, 'finished')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Bỏ qua khi trình duyệt chặn localStorage.
  }
}

export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({
    /** Đã hoàn tất hoặc bỏ qua: không hiện lại cho tới khi người chơi chọn xem lại. */
    finished: readFinished(),
    active: false,
    step: 'welcome' as OnboardingStep,
    claiming: false,
    rewardGranted: false,
    needWallet: false
  }),

  getters: {
    stepIndex: (s) => ORDER.indexOf(s.step),
    stepCount: () => ORDER.length
  },

  actions: {
    /** Bắt đầu tự động cho người mới (chưa từng hoàn tất). */
    startIfNew() {
      if (this.finished || this.active) return
      this.active = true
      this.step = 'welcome'
    },

    /** Xem lại từ menu Hiển thị. */
    restart() {
      this.finished = false
      writeFinished(false)
      this.rewardGranted = false
      this.needWallet = false
      this.active = true
      this.step = 'welcome'
    },

    next() {
      const i = ORDER.indexOf(this.step)
      if (i >= 0 && i < ORDER.length - 1) this.step = ORDER[i + 1]!
    },

    /** Gameplay báo sự kiện; chỉ tiến khi đúng bước đang chờ. */
    notify(ev: OnboardingEvent) {
      if (!this.active || this.step !== ev) return
      this.next()
    },

    skip() {
      this.active = false
      this.finished = true
      writeFinished(true)
    },

    /** Nhận quà chào mừng (cần ví) rồi đóng hướng dẫn. */
    async finish(isAuthenticated: boolean) {
      if (this.claiming) return
      if (!isAuthenticated) {
        this.needWallet = true
        return
      }
      this.claiming = true
      try {
        const res = await $fetch<{
          ok: boolean
          granted: boolean
          inventory: Array<{ itemId: string; category: string; quantity: number; unlockedAt: number }>
        }>('/api/mc/onboarding/complete', { method: 'POST' })
        this.rewardGranted = res.granted
        const economy = useEconomyStore()
        if (Array.isArray(res.inventory)) {
          economy.inventory = res.inventory as typeof economy.inventory
          economy.syncCardsStore()
        }
        this.active = false
        this.finished = true
        writeFinished(true)
      } catch {
        // Giữ hướng dẫn mở để người chơi thử lại.
      } finally {
        this.claiming = false
      }
    },

    /** Khách không có ví: đóng hướng dẫn, quà vẫn nhận được sau khi kết nối ví và xem lại. */
    closeWithoutReward() {
      this.active = false
      this.needWallet = false
      this.finished = true
      writeFinished(true)
    }
  }
})

