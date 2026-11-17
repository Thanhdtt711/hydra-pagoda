import { defineStore } from 'pinia'
import { useEconomyStore } from './economy'
import { useWalletStore } from './wallet'

export interface KoiItemDto {
  koiIndex: number
  defaultName: string
  customName: string | null
  displayName: string
  colorLabel: string
  totalFeeds: number
  level: number
  fedToday: number
  maxDailyFeeds: number
  renameUsed: boolean
}

export interface KoiStatusDto {
  authenticated: boolean
  todayKey: string
  freeFeedAvailable: boolean
  koiFoodQty: number
  koiList: KoiItemDto[]
}

export type GardenSeedId = 'seed_lotus' | 'seed_bamboo' | 'seed_bodhi'

export interface GardenPlotDto {
  plotIndex: number
  seedId: GardenSeedId | null
  seedName: string | null
  stage: number
  waterCount: number
  lastWateredDay: string | null
  canWaterToday: boolean
  canHarvest: boolean
  rewardLabel: string | null
}

export interface GardenStatusDto {
  authenticated: boolean
  todayKey: string
  streakBoostActive: boolean
  seedCounts: Record<GardenSeedId, number>
  plots: GardenPlotDto[]
}

const LOCAL_STORAGE_KEY = 'van_canh_local_koi_garden_v1'

const SEED_META: Record<GardenSeedId, { name: string; rewardItemId: string; rewardLabel: string }> = {
  seed_lotus: { name: 'Hạt Giống Sen Hồng', rewardItemId: 'lotus_lantern', rewardLabel: 'Hoa Đăng Cầu An' },
  seed_bamboo: { name: 'Mầm Trúc Quân Tử', rewardItemId: 'incense_japan', rewardLabel: 'Đàn Hương Kyoto' },
  seed_bodhi: { name: 'Hạt Bồ Đề Tâm', rewardItemId: 'oan_cake', rewardLabel: 'Bánh Oản Hoàng Cung' }
}

function getTodayKey(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

function defaultKoiList(): KoiItemDto[] {
  const defaults = [
    { koiIndex: 0, defaultName: 'Bạch Liên', colorLabel: 'Trắng Đỏ Kohaku' },
    { koiIndex: 1, defaultName: 'Hoàng Kim', colorLabel: 'Vàng Yamabuki' },
    { koiIndex: 2, defaultName: 'Cẩm Lý', colorLabel: 'Tam Sắc Showa' },
    { koiIndex: 3, defaultName: 'Hồng Ngọc', colorLabel: 'Đỏ Hi Utsuri' },
    { koiIndex: 4, defaultName: 'Thanh Vân', colorLabel: 'Trắng Vàng Tancho' }
  ]
  return defaults.map(d => ({
    ...d,
    customName: null,
    displayName: d.defaultName,
    totalFeeds: 0,
    level: 1,
    fedToday: 0,
    maxDailyFeeds: 2,
    renameUsed: false
  }))
}

function defaultPlots(): GardenPlotDto[] {
  return Array.from({ length: 6 }, (_, i) => ({
    plotIndex: i,
    seedId: null,
    seedName: null,
    stage: 0,
    waterCount: 0,
    lastWateredDay: null,
    canWaterToday: false,
    canHarvest: false,
    rewardLabel: null
  }))
}

function errMsg(e: any, fallback: string): string {
  return e?.data?.data?.message || e?.data?.message || e?.statusMessage || e?.message || fallback
}

export const useKoiGardenStore = defineStore('koiGarden', {
  state: () => ({
    koiStatus: {
      authenticated: false,
      todayKey: getTodayKey(),
      freeFeedAvailable: true,
      koiFoodQty: 2,
      koiList: defaultKoiList()
    } as KoiStatusDto,
    gardenStatus: {
      authenticated: false,
      todayKey: getTodayKey(),
      streakBoostActive: false,
      seedCounts: { seed_lotus: 2, seed_bamboo: 1, seed_bodhi: 1 },
      plots: defaultPlots()
    } as GardenStatusDto,
    loading: false,
    busyKoi: false,
    busyGarden: false,
    koiNotice: null as string | null,
    gardenNotice: null as string | null
  }),

  actions: {
    loadLocalState() {
      if (typeof window === 'undefined') return
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (parsed?.koiStatus?.koiList) this.koiStatus = parsed.koiStatus
        if (parsed?.gardenStatus?.plots) this.gardenStatus = parsed.gardenStatus
      } catch {
        // Bỏ qua lỗi đọc localStorage
      }
    },

    saveLocalState() {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            koiStatus: this.koiStatus,
            gardenStatus: this.gardenStatus
          })
        )
      } catch {
        // Bỏ qua lỗi lưu localStorage
      }
    },

    syncScene3D() {
      if (typeof window === 'undefined') return
      const stage = (window as any).__TEMPLE_STAGE__
      if (!stage) return
      if (this.koiStatus?.koiList) {
        stage.syncKoiLevels?.(this.koiStatus.koiList.map(k => k.level))
      }
      if (this.gardenStatus?.plots) {
        stage.syncZenGarden?.(this.gardenStatus.plots)
      }
    },

    async refreshAll() {
      this.loadLocalState()
      const wallet = useWalletStore()
      if (!wallet.isConnected) {
        this.syncScene3D()
        return
      }
      this.loading = true
      try {
        const [k, g] = await Promise.all([
          $fetch<KoiStatusDto>('/api/mc/koi/status'),
          $fetch<GardenStatusDto>('/api/mc/garden/status')
        ])
        if (k?.authenticated) this.koiStatus = k
        if (g?.authenticated) this.gardenStatus = g
        this.syncScene3D()
      } catch {
        // Giữ trạng thái cục bộ nếu mất kết nối
      } finally {
        this.loading = false
      }
    },

    async feed(koiIndex: number) {
      if (this.busyKoi) return null
      this.koiNotice = null
      const wallet = useWalletStore()

      // Chế độ khách (chưa kết nối ví): cho ăn trực tiếp trên trạng thái cục bộ để người chơi trải nghiệm ngay
      if (!wallet.isConnected) {
        const k = this.koiStatus.koiList[koiIndex]
        if (!k) return null
        if (k.fedToday >= k.maxDailyFeeds) {
          this.koiNotice = 'Cá Koi này đã no trong hôm nay. Hãy quay lại vào ngày mai!'
          return null
        }
        if (this.koiStatus.freeFeedAvailable) {
          this.koiStatus.freeFeedAvailable = false
        } else if (this.koiStatus.koiFoodQty > 0) {
          this.koiStatus.koiFoodQty--
        } else {
          this.koiNotice = 'Bạn đã hết Thức Ăn Cá Koi. Hãy thỉnh thêm tại Cửa Hàng!'
          return null
        }
        k.fedToday++
        k.totalFeeds++
        k.level = Math.min(5, 1 + Math.floor(k.totalFeeds / 3))
        this.saveLocalState()
        this.syncScene3D()
        if (typeof window !== 'undefined') {
          ;(window as any).__TEMPLE_STAGE__?.triggerKoiFeed?.()
        }
        this.koiNotice = `Đã cho ${k.displayName} ăn! (Lv.${k.level})`
        return { ok: true }
      }

      this.busyKoi = true
      try {
        const res = await $fetch<{
          ok: boolean
          usedFree: boolean
          status: KoiStatusDto
          inventory: Array<{ itemId: string; category: string; quantity: number; unlockedAt: number }>
        }>('/api/mc/koi/feed', {
          method: 'POST',
          body: { koiIndex }
        })
        this.koiStatus = res.status
        const economy = useEconomyStore()
        if (Array.isArray(res.inventory)) {
          economy.inventory = res.inventory as typeof economy.inventory
        }
        this.syncScene3D()
        if (typeof window !== 'undefined') {
          ;(window as any).__TEMPLE_STAGE__?.triggerKoiFeed?.()
        }
        const fedKoi = this.koiStatus.koiList[koiIndex]
        if (fedKoi) {
          this.koiNotice = `Đã cho ${fedKoi.displayName} ăn! (Lv.${fedKoi.level})`
        }
        return res
      } catch (e: any) {
        this.koiNotice = errMsg(e, 'Chưa thể cho cá ăn lúc này.')
        return null
      } finally {
        this.busyKoi = false
      }
    },

    async rename(koiIndex: number, name: string) {
      if (this.busyKoi) return null
      this.koiNotice = null
      const clean = name.trim().replace(/\s+/g, ' ')
      if (clean.length < 2 || clean.length > 24) {
        this.koiNotice = 'Tên cá Koi cần từ 2 đến 24 ký tự.'
        return null
      }

      const wallet = useWalletStore()
      if (!wallet.isConnected) {
        const k = this.koiStatus.koiList[koiIndex]
        if (!k) return null
        k.customName = clean
        k.displayName = clean
        k.renameUsed = true
        this.saveLocalState()
        this.koiNotice = `Đã đặt tên cá Koi: ${clean}`
        return { ok: true }
      }

      this.busyKoi = true
      try {
        const res = await $fetch<{ ok: boolean; status: KoiStatusDto }>('/api/mc/koi/rename', {
          method: 'POST',
          body: { koiIndex, name: clean }
        })
        this.koiStatus = res.status
        this.koiNotice = `Đã đặt tên cá Koi: ${clean}`
        return res
      } catch (e: any) {
        this.koiNotice = errMsg(e, 'Chưa thể đổi tên cá Koi.')
        return null
      } finally {
        this.busyKoi = false
      }
    },

    async plant(plotIndex: number, seedId: GardenSeedId) {
      if (this.busyGarden) return null
      this.gardenNotice = null
      const wallet = useWalletStore()

      if (!wallet.isConnected) {
        const plot = this.gardenStatus.plots[plotIndex]
        if (!plot || plot.seedId) return null
        const have = this.gardenStatus.seedCounts[seedId] ?? 0
        if (have <= 0) {
          this.gardenNotice = `Bạn đã hết ${SEED_META[seedId].name}. Hãy thỉnh thêm tại Cửa Hàng!`
          return null
        }
        this.gardenStatus.seedCounts[seedId] = have - 1
        plot.seedId = seedId
        plot.seedName = SEED_META[seedId].name
        plot.stage = 1
        plot.waterCount = 1
        plot.lastWateredDay = null
        plot.canWaterToday = true
        plot.canHarvest = false
        plot.rewardLabel = SEED_META[seedId].rewardLabel
        this.saveLocalState()
        this.syncScene3D()
        this.gardenNotice = `Đã trồng ${SEED_META[seedId].name} tại Ô đất #${plotIndex + 1}!`
        return { ok: true }
      }

      this.busyGarden = true
      try {
        const res = await $fetch<{
          ok: boolean
          status: GardenStatusDto
          inventory: Array<{ itemId: string; category: string; quantity: number; unlockedAt: number }>
        }>('/api/mc/garden/plant', {
          method: 'POST',
          body: { plotIndex, seedId }
        })
        this.gardenStatus = res.status
        const economy = useEconomyStore()
        if (Array.isArray(res.inventory)) {
          economy.inventory = res.inventory as typeof economy.inventory
        }
        this.syncScene3D()
        this.gardenNotice = `Đã trồng ${SEED_META[seedId].name} tại Ô đất #${plotIndex + 1}!`
        return res
      } catch (e: any) {
        this.gardenNotice = errMsg(e, 'Chưa thể gieo hạt lúc này.')
        return null
      } finally {
        this.busyGarden = false
      }
    },

    async water(plotIndex: number) {
      if (this.busyGarden) return null
      this.gardenNotice = null
      const wallet = useWalletStore()

      if (!wallet.isConnected) {
        const plot = this.gardenStatus.plots[plotIndex]
        if (!plot || !plot.seedId || plot.stage >= 4) return null
        plot.waterCount++
        plot.stage = Math.min(4, plot.stage + 1)
        plot.canHarvest = plot.stage >= 4
        plot.canWaterToday = !plot.canHarvest
        this.saveLocalState()
        this.syncScene3D()
        this.gardenNotice = plot.canHarvest
          ? `Cây tại Ô đất #${plotIndex + 1} đã viên mãn! Hãy bấm Thu hoạch.`
          : `Đã tưới nước Ô đất #${plotIndex + 1} (Bậc ${plot.stage}/4).`
        return { ok: true }
      }

      this.busyGarden = true
      try {
        const res = await $fetch<{ ok: boolean; status: GardenStatusDto }>('/api/mc/garden/water', {
          method: 'POST',
          body: { plotIndex }
        })
        this.gardenStatus = res.status
        this.syncScene3D()
        return res
      } catch (e: any) {
        this.gardenNotice = errMsg(e, 'Chưa thể tưới cây lúc này.')
        return null
      } finally {
        this.busyGarden = false
      }
    },

    async harvest(plotIndex: number) {
      if (this.busyGarden) return null
      this.gardenNotice = null
      const wallet = useWalletStore()

      if (!wallet.isConnected) {
        const plot = this.gardenStatus.plots[plotIndex]
        if (!plot || !plot.seedId || plot.stage < 4) return null
        const rewardLabel = plot.rewardLabel || 'Hoa Đăng Cầu An'
        plot.seedId = null
        plot.seedName = null
        plot.stage = 0
        plot.waterCount = 0
        plot.lastWateredDay = null
        plot.canWaterToday = false
        plot.canHarvest = false
        plot.rewardLabel = null
        this.saveLocalState()
        this.syncScene3D()
        this.gardenNotice = `Đã thu hoạch: ${rewardLabel}`
        return { ok: true }
      }

      this.busyGarden = true
      try {
        const res = await $fetch<{
          ok: boolean
          reward: { itemId: string; label: string }
          status: GardenStatusDto
          inventory: Array<{ itemId: string; category: string; quantity: number; unlockedAt: number }>
        }>('/api/mc/garden/harvest', {
          method: 'POST',
          body: { plotIndex }
        })
        this.gardenStatus = res.status
        const economy = useEconomyStore()
        if (Array.isArray(res.inventory)) {
          economy.inventory = res.inventory as typeof economy.inventory
        }
        this.syncScene3D()
        this.gardenNotice = `Đã thu hoạch: ${res.reward.label}`
        return res
      } catch (e: any) {
        this.gardenNotice = errMsg(e, 'Chưa thể thu hoạch lúc này.')
        return null
      } finally {
        this.busyGarden = false
      }
    }
  }
})
