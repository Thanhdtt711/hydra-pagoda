/**
 * Quản lý Gameplay Bói Quẻ 6 Môn (Bước 5):
 * 1. Giới hạn miễn phí 1 lượt/môn/ngày (`dailyFreeDrawsPerSubject` từ `data/boi/config.json`).
 * 2. Trạng thái Buff / Debuff trong ngày (`dailyEffects` từ `data/boi/config.json`) và Nhiệm vụ Hóa Giải gỡ Debuff.
 * 3. Lịch sử quẻ tối đa 30 bản ghi (`maxHistoryRecords = 30`).
 */
import { getBoiConfig, getDailyEffectForMuc, resolveLegacyCategory, resolveMonId } from './ContentRepository'
import { getVietnamDateStr } from './SeedService'
import type { BuffDebuffEffect, LegacyCategoryId, MonId, MucQue } from './types'

const DAILY_QUOTA_STORAGE_KEY = 'van_canh_boi_daily_quota_v2'
const DAILY_EFFECT_STORAGE_KEY = 'van_canh_boi_daily_effect_v2'
const LOCAL_HISTORY_STORAGE_KEY = 'van_canh_boi_history_v2'

export interface ActiveDailyFortuneState {
  dateStr: string
  sourceMon: MonId
  sourceMuc: MucQue
  sourceTitle: string
  effect: BuffDebuffEffect
  resolved: boolean
  resolvedAt?: number
  resolvedBy?: string
}

export interface DailySubjectQuotaMap {
  dateStr: string
  /** Số lượt miễn phí đã dùng theo từng môn trong ngày */
  usedFreeByMon: Partial<Record<MonId, number>>
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage
  return null
}

export interface FortuneHistoryItem {
  id: string | number
  requestId: string
  category: string
  tier: string
  costMc: number
  paymentMode?: 'free_daily' | 'offering_item' | 'mc'
  offeringItemId?: string | null
  receiptHash: string
  createdAt: number
  fortune: Record<string, any>
}

export function getMaxHistoryRecords(): number {
  return Number(getBoiConfig().maxHistoryRecords || 30)
}

export function getDailyFreeLimitPerSubject(): number {
  return Number(getBoiConfig().dailyFreeDrawsPerSubject || 1)
}

/**
 * Đọc trạng thái lượt miễn phí đã dùng trong ngày từ localStorage (đồng bộ cùng dữ liệu server)
 */
export function loadDailyQuotaState(nowDateStr = getVietnamDateStr()): DailySubjectQuotaMap {
  const storage = getStorage()
  if (!storage) {
    return { dateStr: nowDateStr, usedFreeByMon: {} }
  }
  try {
    const raw = storage.getItem(DAILY_QUOTA_STORAGE_KEY)
    if (!raw) return { dateStr: nowDateStr, usedFreeByMon: {} }
    const parsed = JSON.parse(raw) as DailySubjectQuotaMap
    if (parsed.dateStr !== nowDateStr) {
      return { dateStr: nowDateStr, usedFreeByMon: {} }
    }
    return {
      dateStr: nowDateStr,
      usedFreeByMon: parsed.usedFreeByMon || {}
    }
  } catch {
    return { dateStr: nowDateStr, usedFreeByMon: {} }
  }
}

export function markDailyFreeUsed(monOrCategory: MonId | LegacyCategoryId | string, nowDateStr = getVietnamDateStr()): DailySubjectQuotaMap {
  const mon = resolveMonId(monOrCategory)
  const current = loadDailyQuotaState(nowDateStr)
  current.usedFreeByMon[mon] = (current.usedFreeByMon[mon] || 0) + 1
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(DAILY_QUOTA_STORAGE_KEY, JSON.stringify(current))
    } catch {
      // Ignore
    }
  }
  return current
}

export function getRemainingFreeDraws(
  monOrCategory: MonId | LegacyCategoryId | string,
  serverFreeUsedOrDateStr: number | string = 0,
  nowDateStr = getVietnamDateStr()
): number {
  const mon = resolveMonId(monOrCategory)
  const limit = getDailyFreeLimitPerSubject()
  const effectiveDateStr = typeof serverFreeUsedOrDateStr === 'string' ? serverFreeUsedOrDateStr : nowDateStr
  const serverFreeUsed = typeof serverFreeUsedOrDateStr === 'number' ? serverFreeUsedOrDateStr : 0
  const localState = loadDailyQuotaState(effectiveDateStr)
  const used = Math.max(Number(localState.usedFreeByMon[mon] || 0), Number(serverFreeUsed || 0))
  return Math.max(0, limit - used)
}

/**
 * Quản lý Buff / Debuff trong ngày của người chơi
 */
export function loadActiveDailyEffect(nowDateStr = getVietnamDateStr()): ActiveDailyFortuneState | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(DAILY_EFFECT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveDailyFortuneState
    if (!parsed || parsed.dateStr !== nowDateStr) return null
    return parsed
  } catch {
    return null
  }
}

export function applyFortuneDailyEffect(
  fortuneOrMon: Record<string, any> | MonId | LegacyCategoryId | string,
  mucArg?: MucQue,
  titleArg?: string,
  nowDateStr = getVietnamDateStr()
): ActiveDailyFortuneState {
  let mon: MonId
  let muc: MucQue
  let title: string
  let dateStr = nowDateStr

  if (typeof fortuneOrMon === 'object' && fortuneOrMon !== null) {
    mon = resolveMonId(fortuneOrMon.mon || fortuneOrMon.category || 'xin_xam')
    muc = (fortuneOrMon.muc || 'binh') as MucQue
    title = String(fortuneOrMon.title || 'Quẻ Cầu An')
    if (!fortuneOrMon.targetDateStr && typeof fortuneOrMon.dateStr === 'string' && fortuneOrMon.dateStr) {
      dateStr = fortuneOrMon.dateStr
    }
  } else {
    mon = resolveMonId(fortuneOrMon)
    muc = (mucArg || 'binh') as MucQue
    title = String(titleArg || 'Quẻ Cầu An')
  }

  const effect = getDailyEffectForMuc(muc)
  const state: ActiveDailyFortuneState = {
    dateStr,
    sourceMon: mon,
    sourceMuc: muc,
    sourceTitle: title,
    effect: JSON.parse(JSON.stringify(effect)),
    resolved: false
  }
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(DAILY_EFFECT_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore
    }
  }
  return state
}

/**
 * Hoàn thành nhiệm vụ hóa giải để gỡ Debuff từ quẻ Hung / Đại Hung
 */
export function resolveActiveDebuff(
  methodLabel = 'Tọa Thiền Chánh Niệm 432Hz',
  nowDateStr = getVietnamDateStr()
): ActiveDailyFortuneState | null {
  const current = loadActiveDailyEffect(nowDateStr)
  if (!current) return null
  if (current.effect.type !== 'debuff') return current

  const resolvedState: ActiveDailyFortuneState = {
    ...current,
    resolved: true,
    resolvedAt: Date.now(),
    resolvedBy: methodLabel,
    effect: {
      type: 'buff',
      id: 'resolved_blessing',
      name: 'Tâm Bình Khí Hòa (Đã Hóa Giải Vận Hạn · +5% Tâm An)',
      description: `Đã hoàn thành pháp hóa giải (${methodLabel}). Trạng thái Debuff đã được gỡ bỏ và chuyển hóa thành bình an.`,
      statModifier: { karmaBonusPct: 5, meditationCalmBonusPct: 5 },
      remediationQuest: null
    }
  }

  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(DAILY_EFFECT_STORAGE_KEY, JSON.stringify(resolvedState))
    } catch {
      // Ignore
    }
  }
  return resolvedState
}

/**
 * Lưu lịch sử quẻ cục bộ tối đa 30 bản ghi (đồng bộ với lịch sử server)
 */
export function loadLocalFortuneHistory(): FortuneHistoryItem[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(LOCAL_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.slice(0, getMaxHistoryRecords()) : []
  } catch {
    return []
  }
}

export function appendLocalFortuneHistory(entry: FortuneHistoryItem): FortuneHistoryItem[] {
  const max = getMaxHistoryRecords()
  const current = loadLocalFortuneHistory()
  const filtered = current.filter(item => item.requestId !== entry.requestId)
  const updated = [entry, ...filtered].slice(0, max)
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(LOCAL_HISTORY_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }
  return updated
}
