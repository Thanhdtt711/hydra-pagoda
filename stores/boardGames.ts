import { defineStore } from 'pinia'
import { useEconomyStore } from './economy'
import {
  BOARD_GAME_ALL_CLEAR_BONUS,
  BOARD_GAME_IDS,
  BOARD_GAME_REWARD_PER_GAME,
  type BoardGameId
} from '~/lib/games/boardGameRewards'

export interface BoardGameStatusDto {
  authenticated: boolean
  todayKey: string
  wonGames: BoardGameId[]
  wonCount: number
  playedCounts?: Record<BoardGameId, number>
  totalGames: number
  rewardPerGame: number
  allClearBonus: number
  maxDailyMc: number
  bonusClaimed: boolean
  earnedTodayMc: number
}

export interface BoardGameWinResult {
  gameId: BoardGameId
  rewardMc: number
  bonusMc: number
  alreadyRewarded: boolean
}

function errorMessage(e: any, fallback: string): string {
  return e?.data?.data?.message || e?.data?.message || e?.statusMessage || e?.message || fallback
}

function getLocalVietnamDayKey(): string {
  const vnMs = Date.now() + 7 * 3600 * 1000
  return new Date(vnMs).toISOString().slice(0, 10)
}

function emptyPlayed(): Record<BoardGameId, number> {
  return { xiangqi: 0, oanquan: 0, caro: 0, chess: 0, go: 0 }
}

const LOCAL_STORAGE_KEY = 'pagoda_bodhi_games_daily_v1'

/** Mã phiên đang chơi theo từng môn (chỉ giữ ở bộ nhớ, mất khi tải lại trang). */
const runTokens = new Map<BoardGameId, string>()

export const useBoardGamesStore = defineStore('boardGames', {
  state: () => ({
    loaded: false,
    error: null as string | null,
    status: null as BoardGameStatusDto | null,
    localDayKey: getLocalVietnamDayKey(),
    localPlayedCounts: emptyPlayed() as Record<BoardGameId, number>,
    localWonGames: [] as BoardGameId[],
    /** Kết quả thưởng của ván vừa thắng gần nhất, để màn hình hiển thị. */
    lastWin: null as BoardGameWinResult | null
  }),

  getters: {
    hasWonToday: (state) => (id: BoardGameId): boolean => {
      return Boolean(state.status?.wonGames.includes(id) || state.localWonGames.includes(id))
    },

    getPlayedCount: (state) => (id: BoardGameId): number => {
      const serverCnt = state.status?.playedCounts?.[id] ?? 0
      const localCnt = state.localPlayedCounts[id] ?? 0
      return Math.max(serverCnt, localCnt)
    },

    mergedWonCount(state): number {
      const set = new Set<BoardGameId>([
        ...(state.status?.wonGames ?? []),
        ...state.localWonGames
      ])
      return set.size
    },

    mergedPlayedGamesCount(state): number {
      let count = 0
      for (const id of BOARD_GAME_IDS) {
        const s = state.status?.playedCounts?.[id] ?? 0
        const l = state.localPlayedCounts[id] ?? 0
        if (Math.max(s, l) > 0) count++
      }
      return count
    },

    mergedEarnedMc(state): number {
      if (state.status?.authenticated) {
        return state.status.earnedTodayMc
      }
      const won = new Set<BoardGameId>(state.localWonGames).size
      const bonus = won >= BOARD_GAME_IDS.length ? BOARD_GAME_ALL_CLEAR_BONUS : 0
      return won * BOARD_GAME_REWARD_PER_GAME + bonus
    }
  },

  actions: {
    loadLocalDaily() {
      if (typeof window === 'undefined') return
      const today = this.status?.todayKey || getLocalVietnamDayKey()
      this.localDayKey = today
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (parsed && parsed.dayKey === today) {
          this.localPlayedCounts = { ...emptyPlayed(), ...(parsed.playedCounts || {}) }
          this.localWonGames = Array.isArray(parsed.wonGames) ? parsed.wonGames : []
        } else {
          this.localPlayedCounts = emptyPlayed()
          this.localWonGames = []
        }
      } catch {
        // Ignore storage errors
      }
    },

    saveLocalDaily() {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            dayKey: this.localDayKey,
            playedCounts: this.localPlayedCounts,
            wonGames: this.localWonGames
          })
        )
      } catch {
        // Ignore storage errors
      }
    },

    recordLocalPlay(gameId: BoardGameId) {
      this.loadLocalDaily()
      this.localPlayedCounts[gameId] = (this.localPlayedCounts[gameId] || 0) + 1
      this.saveLocalDaily()
    },

    recordLocalWin(gameId: BoardGameId) {
      this.loadLocalDaily()
      if (!this.localWonGames.includes(gameId)) {
        this.localWonGames.push(gameId)
      }
      if ((this.localPlayedCounts[gameId] || 0) === 0) {
        this.localPlayedCounts[gameId] = 1
      }
      this.saveLocalDaily()
    },

    async refreshStatus() {
      this.loadLocalDaily()
      try {
        const res = await $fetch<{ ok: boolean; status: BoardGameStatusDto }>('/api/mc/games/status')
        this.status = res.status
        this.loaded = true
        this.loadLocalDaily()
      } catch {
        // Giữ trạng thái cũ khi lỗi mạng tạm thời.
      }
    },

    /** Bắt đầu một ván: nhận mã phiên từ server. Khách chưa đăng nhập vẫn chơi được nhưng không nhận MC. */
    async startRun(gameId: BoardGameId, force = false): Promise<boolean> {
      this.recordLocalPlay(gameId)
      if (!this.status?.authenticated) return false
      if (force) runTokens.delete(gameId)
      else if (runTokens.has(gameId)) return true
      try {
        const res = await $fetch<{ ok: boolean; runToken: string }>('/api/mc/games/start', {
          method: 'POST',
          body: { gameId }
        })
        runTokens.set(gameId, res.runToken)
        return true
      } catch (e: any) {
        this.error = errorMessage(e, 'Chưa mở được ván cờ tính thưởng.')
        return false
      }
    },

    /** Báo thắng. Server quyết định số MC; client chỉ hiển thị kết quả. */
    async reportWin(gameId: BoardGameId): Promise<BoardGameWinResult | null> {
      this.recordLocalWin(gameId)
      const token = runTokens.get(gameId)
      if (!token) return null
      runTokens.delete(gameId)
      try {
        const res = await $fetch<{
          ok: boolean
          gameId: BoardGameId
          rewardMc: number
          bonusMc: number
          alreadyRewarded: boolean
          status: BoardGameStatusDto
          currentBalanceMc: number | null
        }>('/api/mc/games/win', { method: 'POST', body: { runToken: token } })
        this.status = res.status
        if (typeof res.currentBalanceMc === 'number') {
          useEconomyStore().syncBalanceFromServer(res.currentBalanceMc)
        }
        const out: BoardGameWinResult = {
          gameId: res.gameId,
          rewardMc: res.rewardMc,
          bonusMc: res.bonusMc,
          alreadyRewarded: res.alreadyRewarded
        }
        this.lastWin = out
        return out
      } catch (e: any) {
        this.error = errorMessage(e, 'Chưa ghi được kết quả thắng.')
        return null
      }
    }
  }
})
