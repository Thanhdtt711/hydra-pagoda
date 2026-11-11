import { defineStore } from 'pinia'
import { createClientRequestId, useEconomyStore } from './economy'

export interface HauDongDeityDto {
  id: string
  name: string
  palace: string
  colorName: string
  colorHex: string
  blessingTitle: string
  loreSummary: string
  isCustomSelectable: boolean
  giaIndex?: number
}

export interface HauDongActiveSessionDto {
  sessionId: string
  triggerType: 'scheduled_lunar' | 'sponsored_single' | 'sponsored_crowdfund' | 'inaugural_welcome'
  sponsorAccountId: number | null
  sponsorName: string
  prayerText: string
  totalPoolMc: number
  remainingPoolMc: number
  startedAt: number
  endsAt: number
  elapsedSec: number
  remainingSessionSec: number
  giaIndex: number
  secInGia: number
  stepId: number
  stepName: string
  stepProgress: number
  stepRemainingSec: number
  deityId: string
  deityName: string
  palace: string
  colorName: string
  colorHex: string
  blessingTitle: string
  loreSummary: string
  deitiesList: HauDongDeityDto[]
}

export interface HauDongAttendanceDto {
  watchSeconds: number
  isBowing: boolean
  claimedMc: number
  hasClaimedThisGia: boolean
  canClaimNow: boolean
}

export const useHauDongStore = defineStore('hauDong', {
  state: () => ({
    loaded: false,
    loading: false,
    submitting: false,
    error: null as string | null,
    notice: null as string | null,
    insideZone: false,
    isBowing: false,
    lastClaimHydra: null as any,
    config: {
      sessionDurationSec: 480,
      giaCount: 5,
      giaDurationSec: 96,
      sponsorThresholdMc: 2500,
      minCrowdfundMc: 50,
      baseRewardPerGiaMc: 25,
      bowingBonusMc: 5,
      sponsorBonusMc: 15,
      minWatchSecToClaim: 15,
      dailyMaxClaimMc: 250
    },
    lunarInfo: {
      solarDate: '',
      lunarDay: 1,
      lunarMonth: 1,
      lunarYear: 2026,
      isFestivalDay: false,
      festivalLabel: ''
    },
    scheduleInfo: {
      fixedHourStr: '11:00',
      timezone: 'GMT+7 (Giờ Hà Nội)',
      nextScheduledAt: 0,
      secondsUntilNextSchedule: 0,
      isToday: true,
      isHappeningNow: false
    },
    deityCatalog: [] as HauDongDeityDto[],
    activeSession: null as HauDongActiveSessionDto | null,
    myAttendance: null as HauDongAttendanceDto | null,
    dailyClaimedMc: 0,
    remainingDailyClaimMc: 250,
    crowdfund: {
      currentMc: 0,
      targetMc: 2500,
      remainingMc: 2500,
      contributorCount: 0,
      recentContributors: [] as Array<{ amount_mc: number; prayer_text: string; created_at: number; display_name: string }>
    },
    queue: [] as Array<{ session_id: string; trigger_type: string; sponsor_display_name: string; prayer_text: string; created_at: number }>,
    recentSessions: [] as Array<Record<string, any>>
  }),

  actions: {
    applyPayload(data: any) {
      if (!data) return
      this.loaded = true
      if (data.config) this.config = { ...this.config, ...data.config }
      if (data.lunarInfo) this.lunarInfo = data.lunarInfo
      if (data.scheduleInfo) this.scheduleInfo = data.scheduleInfo
      if (Array.isArray(data.deityCatalog)) this.deityCatalog = data.deityCatalog
      this.activeSession = data.activeSession || null
      this.myAttendance = data.myAttendance || null
      if (typeof data.dailyClaimedMc === 'number') this.dailyClaimedMc = data.dailyClaimedMc
      if (typeof data.remainingDailyClaimMc === 'number') this.remainingDailyClaimMc = data.remainingDailyClaimMc
      if (data.crowdfund) this.crowdfund = data.crowdfund
      if (Array.isArray(data.queue)) this.queue = data.queue
      if (Array.isArray(data.recentSessions)) this.recentSessions = data.recentSessions
    },

    async refreshStatus() {
      try {
        const data = await $fetch('/api/mc/hau-dong/status')
        this.applyPayload(data)
      } catch {
        // Bỏ qua lỗi mạng tạm thời
      }
    },

    async sendHeartbeat(insideZone: boolean, deltaSec = 2) {
      this.insideZone = insideZone
      try {
        const data = await $fetch('/api/mc/hau-dong/heartbeat', {
          method: 'POST',
          body: {
            insideZone,
            isBowing: this.isBowing,
            deltaSec
          }
        })
        this.applyPayload(data)
      } catch {
        // Bỏ qua lỗi mạng tạm thời
      }
    },

    async claimBlessing() {
      if (this.submitting) return null
      this.submitting = true
      this.error = null
      this.notice = null
      try {
        const res = await $fetch<{
          creditedMc: number
          balanceAfter: number
          giaIndex: number
          deityName: string
          blessingTitle: string
          status: any
          hydra?: any
        }>('/api/mc/hau-dong/claim', {
          method: 'POST',
          body: {
            isBowing: this.isBowing
          }
        })
        const economy = useEconomyStore()
        economy.meritCoins = res.balanceAfter
        this.lastClaimHydra = res.hydra || null
        this.applyPayload(res.status)
        this.notice = `Thỉnh lộc thành công +${res.creditedMc} MC (${res.blessingTitle}) từ giá ${res.deityName}!`
        return res
      } catch (e: any) {
        this.error = e?.data?.message || e?.statusMessage || 'Không thể thỉnh lộc lúc này'
        throw e
      } finally {
        this.submitting = false
      }
    },

    async sponsorSession(opts: {
      mode: 'single_open' | 'crowdfund'
      amountMc?: number
      customDeityId?: string | null
      prayerText?: string
    }) {
      if (this.submitting) return null
      this.submitting = true
      this.error = null
      this.notice = null
      try {
        const res = await $fetch<any>('/api/mc/hau-dong/donate', {
          method: 'POST',
          body: {
            requestId: createClientRequestId('haudong'),
            mode: opts.mode,
            amountMc: opts.amountMc,
            customDeityId: opts.customDeityId,
            prayerText: opts.prayerText
          }
        })
        const economy = useEconomyStore()
        if (typeof res.balanceAfter === 'number') {
          economy.meritCoins = res.balanceAfter
        }
        if (res.status) {
          this.applyPayload(res.status)
        }
        if (opts.mode === 'single_open') {
          this.notice =
            res.sessionStatus === 'active'
              ? 'Đã khai đàn Đặc Cách thành công! Danh vị của bạn đã khắc lên Cuốn Thư Vàng trên Chiếu Hầu.'
              : 'Đã ghi danh Mở Đàn Đặc Cách vào hàng chờ tiếp theo!'
        } else {
          this.notice = res.createdSessionId
            ? 'Quỹ Bách Gia đã đủ 2,500 MC và tự động Khai Đàn Hầu Đồng!'
            : `Đã góp ${opts.amountMc?.toLocaleString()} MC vào Quỹ Bách Gia Mở Đàn!`
        }
        return res
      } catch (e: any) {
        this.error = e?.data?.message || e?.statusMessage || 'Không thể thực hiện công đức mở đàn'
        throw e
      } finally {
        this.submitting = false
      }
    }
  }
})

