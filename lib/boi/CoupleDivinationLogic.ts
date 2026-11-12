// lib/boi/CoupleDivinationLogic.ts
// Thuật toán so khớp Bát Tự, Ngũ Hành Nạp Âm & Điểm Tương Hợp Cặp Đôi (Đài Tơ Duyên)

import { createHash } from 'node:crypto'
import { analyzeMetaphysics, formatQuanHeLabel } from './MetaphysicsService'
import type { PersonProfile, FortuneDrawResult } from './types'

export interface CoupleCompatibilityResult {
  score: number
  rankTitle: 'Duyên Tiền Định' | 'Tri Kỷ Tương Phùng' | 'Bằng Hữu Đồng Tâm' | 'Nghịch Duyên Tu Tâm'
  relation: 'tuong_sinh' | 'tuong_khac' | 'binh_hoa'
  relationLabel: string
  grounds: string[]
  partnerComparison: {
    partnerName: string
    partnerBirthYear: number
    partnerCanChi: string
    partnerNguHanh: string
    partnerNapAm: string
    partnerCungPhi: string
    relation: string
    summary: string
  }
}

export interface CoupleFortuneResultDto {
  ok: boolean
  spentMc: number
  paymentMode: 'free_daily' | 'mc'
  currentBalanceMc: number
  compatibility: CoupleCompatibilityResult
  fortune: FortuneDrawResult
  receiptHash: string
  awardedCharm: boolean
  inventory?: any[]
}

/**
 * Tính điểm tương hợp Bát Tự & danh vị duyên số giữa 2 người
 */
export function calculateCoupleCompatibility(
  profile: PersonProfile | null | undefined,
  partnerProfile: PersonProfile | null | undefined,
  dateStr = new Date().toISOString().slice(0, 10)
): CoupleCompatibilityResult {
  const meta = analyzeMetaphysics(profile, dateStr, 'to_duyen', partnerProfile)
  if (!meta || !meta.partnerComparison) {
    throw new Error('Hồ sơ bản thân và người thương không hợp lệ.')
  }

  const pComp = meta.partnerComparison
  const rel = pComp.relation as 'tuong_sinh' | 'tuong_khac' | 'binh_hoa'

  // Tính điểm tương hợp cơ sở
  let baseScore = 75
  if (rel === 'tuong_sinh') {
    baseScore = 88
  } else if (rel === 'tuong_khac') {
    baseScore = 65
  } else {
    baseScore = 76
  }

  // Jitter tất định dựa trên tên và ngày sinh
  const hash = createHash('sha256')
    .update(`${profile?.fullName}_${profile?.birthDate}_${partnerProfile?.fullName}_${partnerProfile?.birthDate}`)
    .digest('hex')
  const jitter = parseInt(hash.slice(0, 4), 16) % 9 // [0, 8]

  let score = baseScore + jitter
  if (rel === 'tuong_khac') {
    score = Math.min(score, 74) // Giữ tương khắc dưới 75
  }
  score = Math.max(60, Math.min(99, score))

  let rankTitle: CoupleCompatibilityResult['rankTitle'] = 'Bằng Hữu Đồng Tâm'
  if (score >= 90) {
    rankTitle = 'Duyên Tiền Định'
  } else if (score >= 80) {
    rankTitle = 'Tri Kỷ Tương Phùng'
  } else if (score >= 70) {
    rankTitle = 'Bằng Hữu Đồng Tâm'
  } else {
    rankTitle = 'Nghịch Duyên Tu Tâm'
  }

  return {
    score,
    rankTitle,
    relation: rel,
    relationLabel: formatQuanHeLabel(rel),
    grounds: meta.grounds,
    partnerComparison: pComp
  }
}

