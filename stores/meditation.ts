import { defineStore } from 'pinia'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { HallLayout, type MeditationSlot } from '~/lib/world3d/world/HallLayout'
import { useEconomyStore } from './economy'
import { useUserStore } from './user'
import { useWalletStore } from './wallet'

/**
 * Luồng Tọa Thiền Chánh Điện (Meditate-to-Earn):
 *   Bắt đầu -> phải đang đứng trong Chánh Điện -> tìm bồ đoàn trống gần nhất (hết chỗ thì báo)
 *   -> nhân vật tự đi tới, ngồi quay mặt về tôn tượng -> đếm giờ -> hết giờ nhận MC (server xác thực).
 *
 * Store này giữ toàn bộ trạng thái hiển thị + điều phối nghiệp vụ; cảnh 3D được cắm vào qua `MeditationStageAdapter`
 * (do TempleCanvas đăng ký) nên store không phụ thuộc trực tiếp vào Three.js.
 */

export type MeditationPhase = 'idle' | 'finding' | 'guiding' | 'walking' | 'seated' | 'completing'
export type MeditationNoticeKind = 'error' | 'warning' | 'success' | 'info'

export interface MeditationNotice {
  kind: MeditationNoticeKind
  title: string
  message: string
  /** Nút hành động đi kèm thông báo (ví dụ dẫn nhân vật vào Chánh Điện). */
  action?: 'guide_to_hall'
  /** Mã tăng dần để UI/Toast phân biệt các thông báo liên tiếp. */
  seq: number
}

export interface MeditationStageAdapter {
  isInsideSanctuary(): boolean
  getPlayerXZ(): { x: number; z: number }
  /** Tự đi tới bồ đoàn, quay mặt về tượng và ngồi. `onArrive` gọi khi đã ngồi xong. */
  walkToSlot(slot: MeditationSlot, onArrive: () => void, onAbort: () => void): void
  /** Dẫn nhân vật từ ngoài sân vào trong Chánh Điện (tự mở cửa nếu đang đóng). */
  guideToEntrance(onArrive: () => void, onAbort: () => void): void
  standUp(): void
  cancelWalk(): void
}

/** Định danh chỗ ngồi của người chơi cục bộ trong HallLayout (tách biệt với chỗ 'remote' do server báo). */
const LOCAL_SEAT_OWNER = 'local-player'
const MAX_SLOT_RETRIES = 3

// Trạng thái không cần phản ứng (reactive) giữ ở ngoài state để Pinia không bọc proxy.
let stageAdapter: MeditationStageAdapter | null = null
let ticker: ReturnType<typeof setInterval> | null = null
let noticeSeq = 0

function errorMessage(e: any, fallback: string): string {
  return e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || fallback
}

function errorCode(e: any): string {
  return String(e?.data?.data?.code || e?.data?.code || '')
}

export const useMeditationStore = defineStore('meditation', {
  state: () => ({
    phase: 'idle' as MeditationPhase,
    selectedDurationMin: 5,
    notice: null as MeditationNotice | null,
    /** Số giây còn lại của thời khóa đang ngồi (0 khi chưa ngồi). */
    remainingSec: 0,
    totalSec: 0,
    /** Thưởng dự kiến của phiên hiện tại (0 với khách chưa kết nối ví). */
    expectedRewardMc: 0,
    slotId: null as number | null,
    sessionToken: null as string | null,
    /** Số bồ đoàn còn trống / tổng (cập nhật khi mở tab Thiền và mỗi lần bắt đầu). */
    availableSlots: 0,
    totalSlots: 0,
    endsAt: 0
  }),

  getters: {
    isBusy: (state) => state.phase !== 'idle',
    isSeated: (state) => state.phase === 'seated' || state.phase === 'completing',
    isInsideSanctuary: () => stageAdapter?.isInsideSanctuary() ?? false,
    /** Hiện bảng HUD trên màn hình 3D khi đang tìm chỗ / ngồi thiền. */
    hudVisible: (state) => state.phase !== 'idle',
    remainingLabel: (state) => {
      const s = Math.max(0, state.remainingSec)
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
    },
    progressPct: (state) =>
      state.totalSec > 0 ? Math.min(100, Math.max(0, ((state.totalSec - state.remainingSec) / state.totalSec) * 100)) : 0
  },

  actions: {
    attachStage(adapter: MeditationStageAdapter) {
      stageAdapter = adapter
    },

    detachStage() {
      this.disposeSession()
      stageAdapter = null
    },

    setDuration(min: number) {
      if (this.phase === 'idle') this.selectedDurationMin = min
    },

    pushNotice(kind: MeditationNoticeKind, title: string, message: string, action?: MeditationNotice['action']) {
      this.notice = { kind, title, message, action, seq: ++noticeSeq }
    },

    clearNotice() {
      this.notice = null
    },

    /** Cập nhật số chỗ trống từ danh sách bồ đoàn đang có người ngồi (server) và chỗ của chính mình. */
    async refreshOccupancy() {
      const economy = useEconomyStore()
      try {
        const status = await economy.loadMeditationStatus()
        HallLayout.syncRemoteOccupancy(status.occupiedSlotIds, LOCAL_SEAT_OWNER)
      } catch {
        // Mất kết nối server: dùng trạng thái chỗ hiện có trong bộ nhớ.
      }
      this.totalSlots = HallLayout.getTotalSlotCount()
      this.availableSlots = HallLayout.getAvailableSlotCount()
    },

    async refreshStatus() {
      await this.refreshOccupancy()
    },

    /** Dẫn nhân vật vào Chánh Điện khi bấm nút trong thông báo "cần vào trong điện". */
    guideToHall() {
      if (this.phase !== 'idle' || !stageAdapter) return
      this.phase = 'guiding'
      this.pushNotice('info', 'Đang dẫn bước vào Chánh Điện', 'Nhân vật đang tự đi qua Chính Môn vào trong điện.')
      stageAdapter.guideToEntrance(
        () => {
          this.phase = 'idle'
          this.pushNotice('success', 'Đã vào Chánh Điện', 'Bạn đang ở trong điện. Bấm "Bắt Đầu Tọa Thiền" để nhân vật tìm bồ đoàn.')
        },
        () => {
          this.phase = 'idle'
          this.pushNotice('warning', 'Chưa thể tự dẫn bước', 'Có vật cản trên đường. Xin tự điều khiển nhân vật bước vào Chánh Điện.')
        }
      )
    },

    async begin() {
      if (this.phase !== 'idle') return
      this.clearNotice()
      const stage = stageAdapter
      if (!stage) {
        this.pushNotice('error', 'Cảnh 3D chưa sẵn sàng', 'Xin đợi cảnh chùa tải xong rồi thử lại.')
        return
      }

      // 1. Phải đang ở bên trong Chánh Điện mới được bắt đầu.
      if (!stage.isInsideSanctuary()) {
        this.pushNotice(
          'warning',
          'Cần vào bên trong Chánh Điện',
          'Đạo hữu cần bước vào bên trong Đại Hùng Bảo Điện (khu vực bồ đoàn) mới có thể bắt đầu thời khóa tọa thiền.',
          'guide_to_hall'
        )
        return
      }

      this.phase = 'finding'
      const wallet = useWalletStore()
      const economy = useEconomyStore()
      const hasAccount = wallet.isConnected

      try {
        let slot: MeditationSlot | null = null
        let session: Awaited<ReturnType<typeof economy.startMeditation>> | null = null

        // 2. Tìm bồ đoàn trống gần nhất; nếu vừa bị người khác giành (409) thì chọn lại, tối đa vài lần.
        for (let attempt = 0; attempt < MAX_SLOT_RETRIES; attempt++) {
          await this.refreshOccupancy()
          const pos = stage.getPlayerXZ()
          slot = HallLayout.findNearestAvailableSlot(pos.x, pos.z)
          if (!slot) {
            this.phase = 'idle'
            this.pushNotice(
              'error',
              'Hết chỗ ngồi',
              `Hiện tại toàn bộ ${this.totalSlots} bồ đoàn tọa thiền trong Chánh Điện đều đã có đồng tu tĩnh tọa. Kính mong đạo hữu hoan hỷ chờ giây lát hoặc quay lại sau.`
            )
            return
          }
          if (!hasAccount) break
          try {
            session = await economy.startMeditation(this.selectedDurationMin, slot.id)
            break
          } catch (e: any) {
            if (errorCode(e) === 'slot_taken') {
              slot = null
              continue
            }
            throw e
          }
        }

        if (!slot) {
          this.phase = 'idle'
          this.pushNotice('warning', 'Bồ đoàn vừa có người ngồi', 'Các chỗ gần bạn vừa có đồng tu ngồi trước. Xin bấm bắt đầu lại để chọn chỗ khác.')
          return
        }

        // 3. Giữ chỗ và để nhân vật tự đi tới đệm, ngồi quay mặt về tượng.
        HallLayout.occupySlot(slot.id, LOCAL_SEAT_OWNER)
        this.availableSlots = HallLayout.getAvailableSlotCount()
        this.slotId = slot.id
        this.sessionToken = session?.sessionToken ?? null
        const plan = economy.meditation.plans.find(p => p.durationMin === this.selectedDurationMin)
        this.totalSec = session?.durationSec ?? plan?.durationSec ?? this.selectedDurationMin * 60
        this.expectedRewardMc = session?.rewardMc ?? 0
        this.remainingSec = this.totalSec
        this.phase = 'walking'
        this.pushNotice('info', 'Đang đến bồ đoàn', `Nhân vật đang tự bước tới bồ đoàn gần nhất (#${slot.id + 1}) và sẽ ngồi quay mặt lên tôn tượng.`)

        stage.walkToSlot(
          slot,
          () => this.onSeated(),
          () => this.abortWalk()
        )
      } catch (e: any) {
        this.releaseSeat(false)
        this.phase = 'idle'
        this.pushNotice('error', 'Không thể bắt đầu tọa thiền', errorMessage(e, 'Có lỗi xảy ra, xin thử lại.'))
      }
    },

    /** Nhân vật đã ngồi vào đệm: bắt đầu đếm giờ và tạo không khí thiền. */
    onSeated() {
      if (this.phase !== 'walking') return
      this.phase = 'seated'
      this.endsAt = Date.now() + this.totalSec * 1000
      this.remainingSec = this.totalSec
      zenAudio.playSingingBowl()
      const wallet = useWalletStore()
      this.pushNotice(
        'success',
        'Đang tọa thiền',
        wallet.isConnected
          ? `Thân tâm bất động, hơi thở theo nhịp 4-4-6. Viên mãn thời khóa bạn sẽ nhận +${this.expectedRewardMc} MC.`
          : 'Bạn đang thiền ở chế độ khách. Hãy kết nối ví để nhận MC công đức ở thời khóa sau.'
      )
      this.startTicker()
    },

    startTicker() {
      this.stopTicker()
      ticker = setInterval(() => {
        const left = Math.ceil((this.endsAt - Date.now()) / 1000)
        this.remainingSec = Math.max(0, left)
        if (left <= 0) void this.finish()
      }, 250)
    },

    stopTicker() {
      if (ticker) {
        clearInterval(ticker)
        ticker = null
      }
    },

    /** Hết giờ: ngân chuông, nhờ server xác thực & cộng MC, rồi cho nhân vật đứng dậy. */
    async finish() {
      if (this.phase !== 'seated') return
      this.phase = 'completing'
      this.stopTicker()
      zenAudio.playTempleBell()

      const economy = useEconomyStore()
      const user = useUserStore()
      const token = this.sessionToken
      const minutes = this.selectedDurationMin
      let notice: { kind: MeditationNoticeKind; title: string; message: string } = {
        kind: 'success',
        title: 'Viên mãn thời khóa tọa thiền',
        message: 'Thời khóa đã được ghi nhận. Hãy kết nối ví để nhận MC công đức ở thời khóa sau.'
      }

      if (token) {
        try {
          const res = await economy.completeMeditation(token)
          if (res.creditedMc > 0) {
            const partial = res.creditedMc < res.expectedRewardMc
            notice = {
              kind: 'success',
              title: 'Viên mãn thời khóa tọa thiền',
              message: partial
                ? `Bạn nhận +${res.creditedMc} MC công đức (chạm giới hạn ${res.dailyCapMc} MC/ngày nên phần còn lại không được cộng).`
                : `Bạn được ban tặng +${res.creditedMc} MC công đức${res.ledgerId ? ` (mã sổ cái #${res.ledgerId})` : ''}.`
            }
            zenAudio.playCoinDrop()
          } else {
            notice = {
              kind: 'info',
              title: 'Đã đạt giới hạn công đức hôm nay',
              message: `Hôm nay bạn đã nhận đủ ${res.dailyCapMc} MC từ tọa thiền. Thời khóa vẫn được ghi nhận vào chuỗi tu tập.`
            }
          }
          void economy.loadMeditationStatus().catch(() => undefined)
        } catch (e: any) {
          notice = {
            kind: 'error',
            title: 'Chưa nhận được thưởng MC',
            message: errorMessage(e, 'Không thể xác nhận phiên thiền với máy chủ.')
          }
        }
      }

      user.recordMeditation(minutes)
      this.releaseSeat(true)
      this.phase = 'idle'
      this.pushNotice(notice.kind, notice.title, notice.message)
    },

    /** Xả thiền sớm: đứng dậy, nhả chỗ, không nhận MC. */
    async stopEarly() {
      if (this.phase !== 'walking' && this.phase !== 'seated') return
      const economy = useEconomyStore()
      const token = this.sessionToken
      this.stopTicker()
      stageAdapter?.cancelWalk()
      this.releaseSeat(true)
      this.phase = 'idle'
      this.pushNotice('info', 'Đã xả thiền sớm', 'Thời khóa chưa viên mãn nên chưa nhận MC. Khi sẵn sàng, bạn có thể bắt đầu lại.')
      if (token) {
        try {
          await economy.cancelMeditation(token)
        } catch {
          // Phiên sẽ tự hết hạn trên server; không cần báo lỗi cho người chơi.
        }
      }
    },

    /** Lộ trình đi bộ bị gián đoạn: hủy phiên để trả chỗ ngồi. */
    abortWalk() {
      if (this.phase !== 'walking') return
      const economy = useEconomyStore()
      const token = this.sessionToken
      this.releaseSeat(true)
      this.phase = 'idle'
      this.pushNotice('warning', 'Không đến được bồ đoàn', 'Có vật cản trên đường. Xin thử lại hoặc tự bước đến gần bồ đoàn trống.')
      if (token) void economy.cancelMeditation(token).catch(() => undefined)
    },

    /** Nhả bồ đoàn và (tuỳ chọn) cho nhân vật đứng dậy. */
    releaseSeat(standUp: boolean) {
      if (standUp) stageAdapter?.standUp()
      if (this.slotId !== null) HallLayout.releaseSlot(this.slotId)
      this.slotId = null
      this.sessionToken = null
      this.remainingSec = 0
      this.totalSec = 0
      this.expectedRewardMc = 0
      this.endsAt = 0
      this.availableSlots = HallLayout.getAvailableSlotCount()
    },

    /** Rời trang / hủy cảnh: dừng đồng hồ và hủy phiên đang chạy (best-effort). */
    disposeSession() {
      this.stopTicker()
      const token = this.sessionToken
      if (token && (this.phase === 'walking' || this.phase === 'seated')) {
        void useEconomyStore().cancelMeditation(token).catch(() => undefined)
      }
      if (this.slotId !== null) HallLayout.releaseSlot(this.slotId)
      this.slotId = null
      this.sessionToken = null
      this.phase = 'idle'
    }
  }
})

