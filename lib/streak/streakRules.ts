/**
 * Quy tắc thuần của Sổ Tu Tập (chuỗi ngày an lạc), dùng chung cho server và test.
 * Không đụng DB, không đọc đồng hồ: mọi hàm nhận khóa ngày `YYYY-MM-DD` giờ Việt Nam.
 *
 * Luật chuỗi:
 *  - Mỗi ngày ghi dấu một lần. Ghi liên tiếp thì chuỗi tăng 1.
 *  - Bỏ lỡ đúng 1 ngày: nếu tuần của ngày bị lỡ chưa dùng "ngày nghỉ" thì chuỗi được giữ nguyên và tăng 1.
 *  - Bỏ lỡ nhiều hơn (hoặc đã dùng ngày nghỉ tuần đó): chuỗi về nửa (làm tròn xuống) rồi cộng dấu hôm nay.
 *    Không bao giờ về 0.
 */
import { addDaysToDayKey, daysBetweenDayKeys, getWeekKeyOfDayKey } from '../time/vietnamDay.ts'

export type StreakRewardKind = 'item' | 'card' | 'title'

export interface StreakMilestone {
  /** Số ngày chuỗi cần đạt. */
  milestone: number
  kind: StreakRewardKind
  /** Mã vật phẩm trong kho (item) hoặc loại trang phục; thẻ chọn ở server. */
  itemId?: string
  category?: 'attire' | 'offering'
  /** Danh hiệu hiển thị cạnh tên (kind = title). */
  title?: string
  /** Nhãn quà hiển thị cho người chơi. */
  label: string
}

export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  { milestone: 3, kind: 'item', itemId: 'incense_japan', category: 'offering', label: 'Đàn Hương Kyoto' },
  { milestone: 7, kind: 'item', itemId: 'lotus_lantern', category: 'offering', label: 'Hoa Đăng Cầu An' },
  { milestone: 21, kind: 'card', label: 'Một thẻ di sản hiếm' },
  { milestone: 49, kind: 'item', itemId: 'western', category: 'attire', label: 'Pháp Phục Nâu Làng Mai' },
  { milestone: 108, kind: 'title', title: 'Hành Giả Bền Tâm', label: 'Danh hiệu Hành Giả Bền Tâm' }
]

export interface StreakState {
  currentStreak: number
  bestStreak: number
  lastDayKey: string | null
  /** Khóa tuần (thứ Hai) đã dùng "ngày nghỉ" bảo vệ chuỗi. */
  restWeekKey: string | null
}

export type StreakOutcome = 'first' | 'continued' | 'rested' | 'halved' | 'already'

export interface StreakStep {
  next: StreakState
  outcome: StreakOutcome
}

export const EMPTY_STREAK: StreakState = { currentStreak: 0, bestStreak: 0, lastDayKey: null, restWeekKey: null }

/** Ngày nghỉ của tuần chứa ngày bị lỡ còn dùng được không (chỉ có nghĩa khi lỡ đúng 1 ngày). */
export function isRestAvailableFor(state: StreakState, today: string): boolean {
  if (!state.lastDayKey) return false
  if (daysBetweenDayKeys(state.lastDayKey, today) !== 2) return false
  const missedDay = addDaysToDayKey(state.lastDayKey, 1)
  return state.restWeekKey !== getWeekKeyOfDayKey(missedDay)
}

/** Tính trạng thái chuỗi sau khi ghi dấu cho ngày `today`. Không đổi `state` đầu vào. */
export function computeStreakStep(state: StreakState, today: string): StreakStep {
  if (!state.lastDayKey) {
    return {
      outcome: 'first',
      next: { currentStreak: 1, bestStreak: Math.max(1, state.bestStreak), lastDayKey: today, restWeekKey: state.restWeekKey }
    }
  }

  const gap = daysBetweenDayKeys(state.lastDayKey, today)
  if (gap <= 0) return { outcome: 'already', next: { ...state } }

  let streak = state.currentStreak
  let restWeekKey = state.restWeekKey
  let outcome: StreakOutcome

  if (gap === 1) {
    streak += 1
    outcome = 'continued'
  } else if (isRestAvailableFor(state, today)) {
    restWeekKey = getWeekKeyOfDayKey(addDaysToDayKey(state.lastDayKey, 1))
    streak += 1
    outcome = 'rested'
  } else {
    streak = Math.floor(streak / 2) + 1
    outcome = 'halved'
  }

  return {
    outcome,
    next: {
      currentStreak: streak,
      bestStreak: Math.max(state.bestStreak, streak),
      lastDayKey: today,
      restWeekKey
    }
  }
}

/** Cột mốc đầu tiên còn phía trước (lớn hơn chuỗi hiện tại), hoặc null khi đã qua hết. */
export function nextMilestoneOf(streak: number): StreakMilestone | null {
  return STREAK_MILESTONES.find(m => m.milestone > streak) ?? null
}
