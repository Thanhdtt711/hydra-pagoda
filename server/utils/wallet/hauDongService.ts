/**
 * Dịch vụ Nhà Hầu Đồng (Điện Thờ Tứ Phủ & Trần Triều).
 *
 * Thực thi đầy đủ thiết kế trong `docs/KE_HOACH_NHA_HAU_DONG.md`:
 * - Thời lượng 1 buổi hầu: 8 phút (480 giây) gồm 5 Giá đồng liên tiếp (96 giây / Giá).
 * - Trình tự 6 bước mỗi Giá đồng:
 *   1. Thay lễ phục (10s: 0..10s)
 *   2. Dâng hương (10s: 10..20s)
 *   3. Lễ Thánh giáng (10s: 20..30s)
 *   4. Múa đồng & Hát Chầu văn (40s: 30..70s)
 *   5. Ban lộc cho người tham dự (18s: 70..88s)
 *   6. Thánh thăng / Xe giá hồi cung (8s: 88..96s)
 * - Ngưỡng Công Đức Mở Đàn Đặc Cách: 2,500 MC / buổi
 *   + 60% (1,500 MC) -> Quỹ Ban Lộc trực tiếp (300 MC / Giá)
 *   + 25% (625 MC)   -> Quỹ Tu Bổ Điện Thờ (Burn tiêu hủy chống lạm phát)
 *   + 15% (375 MC)   -> Quỹ Dự Trữ Lễ Cố Định Rằm & Mồng 1
 * - Hỗ trợ cả:
 *   + Mở đàn riêng (single_open >= 2,500 MC): được chọn Giá đồng tâm nguyện & ghi danh Bảng Vàng Cuốn Thư.
 *   + Cộng dồn Bách Gia (crowdfund >= 50 MC): tích lũy đủ 2,500 MC tự động kích hoạt buổi hầu Bách Gia.
 */
import { randomBytes } from 'node:crypto'
import { convertSolarToLunar } from '../../../lib/boi/MetaphysicsService'
import { getVietnamDayKey } from '../../../lib/time/vietnamDay'
import { apiError } from './auth'
import { getDb, withTransaction, type DbConn } from './db'
import { credit, normalizeRequestId, spend } from './mcService'

export interface HauDongDeityInfo {
  id: string
  name: string
  palace: string
  colorName: string
  colorHex: string
  blessingTitle: string
  loreSummary: string
  isCustomSelectable: boolean
}

export const HAU_DONG_DEITIES: Record<string, HauDongDeityInfo> = {
  quan_lon_de_tam: {
    id: 'quan_lon_de_tam',
    name: 'Quan Lớn Đệ Tam Thoải Phủ',
    palace: 'Thoải Phủ (Miền Nước)',
    colorName: 'Bạch Y (Trắng Kim)',
    colorHex: '#f5f5f5',
    blessingTitle: 'Lộc Trí Tuệ & Thuận Buồm Xuôi Gió',
    loreSummary: 'Vị Thánh Quan trấn giữ miền sông nước Thoải Phủ, múa đôi song kiếm uy nghiêm, khai quang tẩy tịnh và độ trì hanh thông.',
    isCustomSelectable: true
  },
  chau_doi_thuong_ngan: {
    id: 'chau_doi_thuong_ngan',
    name: 'Chầu Đôi Thượng Ngàn',
    palace: 'Nhạc Phủ (Miền Rừng Núi)',
    colorName: 'Thanh Y (Xanh Lục)',
    colorHex: '#15803d',
    blessingTitle: 'Lộc Sức Khỏe & Sinh Khí Đại Ngàn',
    loreSummary: 'Nữ Thánh cai quản 81 cửa rừng Đông Cuông - Tuần Quán, múa mồi đuốc thiêng truyền sinh khí xanh tươi và bình an.',
    isCustomSelectable: true
  },
  ong_hoang_muoi: {
    id: 'ong_hoang_muoi',
    name: 'Ông Hoàng Mười (Nghệ An)',
    palace: 'Địa Phủ (Đất Nghệ Tĩnh)',
    colorName: 'Hoàng Y (Vàng Hoàng Kim)',
    colorHex: '#eab308',
    blessingTitle: 'Lộc Công Danh, Khoa Bảng & Tài Lộc',
    loreSummary: 'Vị Thánh Hoàng văn võ song toàn đất Nghệ An, múa quạt đề thơ ban lộc công danh sự nghiệp và phú quý.',
    isCustomSelectable: true
  },
  co_doi_thuong_ngan: {
    id: 'co_doi_thuong_ngan',
    name: 'Cô Đôi Thượng Ngàn',
    palace: 'Nhạc Phủ (Sơn Lâm)',
    colorName: 'Áo Lam / Xanh Ngọc',
    colorHex: '#16a34a',
    blessingTitle: 'Lộc Duyên Lành & Hòa Hợp Nhân Duyên',
    loreSummary: 'Nàng tiên nữ hầu cận Mẫu Thượng Ngàn, múa quạt lụa hái hoa rừng, ban duyên lành và niềm hoan hỷ.',
    isCustomSelectable: true
  },
  cau_be_hoang_tu: {
    id: 'cau_be_hoang_tu',
    name: 'Cậu Bé Hoàng Tử',
    palace: 'Thoải / Nhạc Phủ',
    colorName: 'Hoàng Y Khăn Rìu',
    colorHex: '#f59e0b',
    blessingTitle: 'Lộc Hỷ Tín, May Mắn & Khởi Sự',
    loreSummary: 'Vị Thánh Cậu thông minh lanh lợi, múa hèo hoa chuông nhạc rộn rã, ban lộc phát tài và tin vui cát tường.',
    isCustomSelectable: true
  },
  duc_ong_tran_trieu: {
    id: 'duc_ong_tran_trieu',
    name: 'Đức Ông Trần Triều (Hưng Đạo Đại Vương)',
    palace: 'Trần Triều Hiển Thánh',
    colorName: 'Hồng Bào Đỏ Thẫm Giáp Vàng',
    colorHex: '#b91c1c',
    blessingTitle: 'Chính Khí Hộ Thân & Trừ Tà Định Tâm',
    loreSummary: 'Quốc Công Tiết Chế Hưng Đạo Đại Vương Trần Quốc Tuấn, uy linh hộ quốc an dân, trừ tà ma và ban sức mạnh ý chí.',
    isCustomSelectable: true
  },
  ong_hoang_bay: {
    id: 'ong_hoang_bay',
    name: 'Ông Hoàng Bảy Bảo Hà',
    palace: 'Thượng Ngàn / Bảo Hà Lào Cai',
    colorName: 'Áo Tím Chàm Thêu Rồng',
    colorHex: '#5b21b6',
    blessingTitle: 'Lộc Kinh Doanh, Đầu Tư & Quý Nhân',
    loreSummary: 'Thần Vệ Quốc trấn giữ miền biên ải Bảo Hà - Lào Cai, ban lộc chiêu tài tấn bảo và quý nhân phù trợ.',
    isCustomSelectable: true
  }
}

export const DEFAULT_FIVE_DEITIES: readonly string[] = [
  'quan_lon_de_tam',
  'chau_doi_thuong_ngan',
  'ong_hoang_muoi',
  'co_doi_thuong_ngan',
  'cau_be_hoang_tu'
]

export interface HauDongStepConfig {
  stepId: number
  name: string
  startSec: number
  endSec: number
  durationSec: number
}

export const HAU_DONG_STEPS: readonly HauDongStepConfig[] = [
  { stepId: 1, name: 'Thay Lễ Phục (Sửa Lễ)', startSec: 0, endSec: 10, durationSec: 10 },
  { stepId: 2, name: 'Dâng Hương Thỉnh Thánh', startSec: 10, endSec: 20, durationSec: 10 },
  { stepId: 3, name: 'Lễ Thánh Giáng (Tung Khăn Phủ Diện)', startSec: 20, endSec: 30, durationSec: 10 },
  { stepId: 4, name: 'Múa Đồng & Hát Chầu Văn', startSec: 30, endSec: 70, durationSec: 40 },
  { stepId: 5, name: 'Ban Lộc Tứ Phủ (Thỉnh Lộc MC)', startSec: 70, endSec: 88, durationSec: 18 },
  { stepId: 6, name: 'Thánh Thăng (Xe Giá Hồi Cung)', startSec: 88, endSec: 96, durationSec: 8 }
]

export const HAU_DONG_CONFIG = {
  sessionDurationSec: 480, // 8 phút = 480 giây
  giaCount: 5,
  giaDurationSec: 96, // 96 giây / giá
  sponsorThresholdMc: 2500, // 2,500 MC / buổi đặc cách
  minCrowdfundMc: 50, // Góp Bách Gia tối thiểu 50 MC
  poolRatio: 0.6, // 60% = 1,500 MC vào Quỹ Ban Lộc
  burnRatio: 0.25, // 25% = 625 MC vào Quỹ Tu Bổ (Burn)
  reserveRatio: 0.15, // 15% = 375 MC vào Quỹ Dự Trữ Rằm/Mồng 1
  baseRewardPerGiaMc: 25, // Thưởng cơ bản mỗi giá cho người xem
  bowingBonusMc: 5, // Thưởng thêm khi bấm Chắp Tay Khánh Hỷ
  sponsorBonusMc: 15, // Thưởng thêm cho chính Thanh đồng mở đàn
  minWatchSecToClaim: 15, // Tối thiểu 15s hiện diện trong giá đồng (hoặc vào đúng lúc Ban Lộc)
  dailyMaxClaimMc: 250, // Hạn mức nhận lộc tối đa 250 MC / ngày / tài khoản
  cooldownBetweenSessionsSec: 20 // Nghỉ 20s giữa 2 buổi liên tiếp trong hàng chờ
}

interface SessionRow {
  session_id: string
  trigger_type: 'scheduled_lunar' | 'sponsored_single' | 'sponsored_crowdfund' | 'inaugural_welcome'
  sponsor_account_id: number | null
  sponsor_display_name: string
  prayer_text: string
  deities_json: string
  total_pool_mc: number
  remaining_pool_mc: number
  burned_mc: number
  reserve_mc: number
  status: 'queued' | 'active' | 'completed'
  started_at: number | null
  ends_at: number | null
  created_at: number
}

function getLunarDayInfo(now = Date.now()) {
  const vnDate = new Date(now + 7 * 3600 * 1000)
  const dateStr = vnDate.toISOString().slice(0, 10)
  const [yy, mm, dd] = dateStr.split('-').map(Number)
  const lunar = convertSolarToLunar(dd || 1, mm || 1, yy || 2026)
  const isFestivalDay = lunar.day === 1 || lunar.day === 14 || lunar.day === 15 || lunar.day === 29 || lunar.day === 30
  return {
    solarDate: dateStr,
    lunarDay: lunar.day,
    lunarMonth: lunar.month,
    lunarYear: lunar.year,
    isFestivalDay,
    festivalLabel:
      lunar.day === 1
        ? `Đại Lễ Sóc Vọng Mồng 1 Tháng ${lunar.month} Âm Lịch`
        : lunar.day === 15 || lunar.day === 14
          ? `Đại Lễ Vọng Nguyệt Rằm Tháng ${lunar.month} Âm Lịch`
          : `Ngày ${lunar.day}/${lunar.month} Âm Lịch`
  }
}

/**
 * Xây dựng danh sách 5 Giá đồng (nếu Thanh đồng chọn 1 vị Thánh đặc biệt như Đức Ông Trần Triều
 * hoặc Ông Hoàng Bảy thì đưa vào vị trí trang trọng tương ứng).
 */
/**
 * Tính toán mốc 11h00 trưa (Giờ Ngọ / GMT+7) kế tiếp:
 * - Khung giờ diễn ra: 11:00:00 - 11:08:00 (480 giây / 8 phút).
 * - Nếu hiện tại < 11:08:00 hôm nay -> mốc là 11:00 hôm nay.
 * - Nếu hiện tại >= 11:08:00 hôm nay -> mốc là 11:00 ngày mai.
 */
export function getNextScheduled11Am(now = Date.now()) {
  const vnOffset = 7 * 3600 * 1000
  const vnNow = new Date(now + vnOffset)
  const dateStr = vnNow.toISOString().slice(0, 10) // 'YYYY-MM-DD'

  // 11h00 hôm nay theo giờ Việt Nam
  const today11AmUtc = new Date(`${dateStr}T11:00:00+07:00`).getTime()
  const today11AmEndUtc = today11AmUtc + HAU_DONG_CONFIG.sessionDurationSec * 1000

  let nextScheduledAt: number
  let isToday: boolean

  if (now < today11AmEndUtc) {
    nextScheduledAt = today11AmUtc
    isToday = true
  } else {
    // 11:00 ngày mai
    nextScheduledAt = today11AmUtc + 24 * 3600 * 1000
    isToday = false
  }

  const secondsUntilNextSchedule = Math.max(0, Math.ceil((nextScheduledAt - now) / 1000))
  const isHappeningNow = now >= today11AmUtc && now < today11AmEndUtc

  return {
    fixedHourStr: '11:00',
    timezone: 'GMT+7 (Giờ Hà Nội)',
    nextScheduledAt,
    secondsUntilNextSchedule,
    isToday,
    isHappeningNow
  }
}

export function buildFiveDeitiesList(customDeityId?: string | null): string[] {
  const list = [...DEFAULT_FIVE_DEITIES]
  if (!customDeityId || !HAU_DONG_DEITIES[customDeityId]) return list
  if (list.includes(customDeityId)) return list

  if (customDeityId === 'duc_ong_tran_trieu') {
    // Đức Ông Trần Triều ngự Giá 1 khai đàn uy nghiêm
    list[0] = 'duc_ong_tran_trieu'
  } else if (customDeityId === 'ong_hoang_bay') {
    // Ông Hoàng Bảy ngự Giá 3 (hàng Ông Hoàng)
    list[2] = 'ong_hoang_bay'
  }
  return list
}

/**
 * Đồng bộ vòng đời phiên Hầu Đồng:
 * - Đóng các phiên `active` đã hết hạn (`now >= ends_at`).
 * - Kích hoạt phiên `queued` tiếp theo nếu hàng chờ có phiên.
 * - Nếu hoàn toàn chưa từng có phiên nào trong CSDL (lần đầu khởi chạy Nhà Hầu Đồng),
 *   tự động mở 1 phiên Khai Đàn Khánh Thành (`inaugural_welcome`) kéo dài 8 phút để người chơi
 *   bước sang Nhà Hầu Đồng thấy ngay nghi lễ sống động.
 */
async function advanceSessionLifecycle(conn: DbConn, now: number): Promise<SessionRow | null> {
  // 1. Hoàn tất các phiên active đã quá giờ
  await conn
    .prepare(
      `UPDATE hau_dong_sessions
          SET status = 'completed'
        WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= ?`
    )
    .run(now)

  // 2. Kiểm tra xem đang có phiên active nào không
  let active = await conn
    .prepare(`SELECT * FROM hau_dong_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`)
    .get() as SessionRow | undefined

  if (active) return active

  // 3. Nếu chưa có phiên active, kiểm tra hàng chờ queued
  const nextQueued = await conn
    .prepare(`SELECT * FROM hau_dong_sessions WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`)
    .get() as SessionRow | undefined

  if (nextQueued) {
    const endsAt = now + HAU_DONG_CONFIG.sessionDurationSec * 1000
    await conn
      .prepare(`UPDATE hau_dong_sessions SET status = 'active', started_at = ?, ends_at = ? WHERE session_id = ?`)
      .run(now, endsAt, nextQueued.session_id)
    return {
      ...nextQueued,
      status: 'active',
      started_at: now,
      ends_at: endsAt
    }
  }

  // 4. Tự động Khai Đàn Lễ Thường Nhật vào đúng khung giờ 11h00 Trưa (11:00 - 11:08 GMT+7)
  const sched = getNextScheduled11Am(now)
  if (sched.isHappeningNow) {
    const vnDayStr = getVietnamDayKey(now)
    const sessionId = `hd_scheduled_11am_${vnDayStr}`
    const existing = await conn.prepare(`SELECT * FROM hau_dong_sessions WHERE session_id = ?`).get(sessionId) as SessionRow | undefined
    if (!existing) {
      const lunar = getLunarDayInfo(now)
      const deities = buildFiveDeitiesList(null)
      await conn
        .prepare(
          `INSERT INTO hau_dong_sessions (
            session_id, trigger_type, sponsor_account_id, sponsor_display_name,
            prayer_text, deities_json, total_pool_mc, remaining_pool_mc,
            burned_mc, reserve_mc, status, started_at, ends_at, created_at
          ) VALUES (?, 'scheduled_lunar', NULL, ?, ?, ?, 900, 900, 0, 0, 'active', ?, ?, ?)
          ON CONFLICT(session_id) DO NOTHING`
        )
        .run(
          sessionId,
          'Bản Đền Tứ Phủ Vạn Cảnh',
          `${lunar.festivalLabel} · Khai Đàn Giờ Ngọ (11h00) · Cầu Quốc Thái Dân An · Bách Gia Hưởng Lộc`,
          JSON.stringify(deities),
          sched.nextScheduledAt,
          sched.nextScheduledAt + HAU_DONG_CONFIG.sessionDurationSec * 1000,
          now
        )
      active = await conn.prepare(`SELECT * FROM hau_dong_sessions WHERE session_id = ?`).get(sessionId) as SessionRow | undefined
      if (active && active.status === 'active') return active
    } else if (existing.status === 'active') {
      return existing
    }
  }

  return null
}

/**
 * Tính toán tiến độ Giá đồng (1..5) và Bước nghi lễ (1..6) từ `started_at`
 */
function computeLiveProgress(session: SessionRow, now: number) {
  const startedAt = session.started_at || now
  const elapsedSec = Math.max(0, Math.min(HAU_DONG_CONFIG.sessionDurationSec - 1, Math.floor((now - startedAt) / 1000)))
  const remainingSessionSec = Math.max(0, Math.ceil(((session.ends_at || now) - now) / 1000))

  const giaZeroIdx = Math.min(4, Math.floor(elapsedSec / HAU_DONG_CONFIG.giaDurationSec))
  const giaIndex = giaZeroIdx + 1 // 1..5
  const secInGia = elapsedSec % HAU_DONG_CONFIG.giaDurationSec // 0..95

  const stepConfig =
    HAU_DONG_STEPS.find(s => secInGia >= s.startSec && secInGia < s.endSec) || HAU_DONG_STEPS[HAU_DONG_STEPS.length - 1]
  const stepProgress = Math.max(0, Math.min(1, (secInGia - stepConfig.startSec) / stepConfig.durationSec))
  const stepRemainingSec = Math.max(0, stepConfig.endSec - secInGia)

  let deities: string[] = [...DEFAULT_FIVE_DEITIES]
  try {
    const parsed = JSON.parse(session.deities_json)
    if (Array.isArray(parsed) && parsed.length === 5) deities = parsed
  } catch {
    // giữ mặc định
  }

  const currentDeityId = deities[giaZeroIdx] || DEFAULT_FIVE_DEITIES[0]
  const deityInfo = HAU_DONG_DEITIES[currentDeityId] || HAU_DONG_DEITIES.quan_lon_de_tam

  return {
    elapsedSec,
    remainingSessionSec,
    giaIndex,
    secInGia,
    stepId: stepConfig.stepId,
    stepName: stepConfig.name,
    stepProgress,
    stepRemainingSec,
    deityId: deityInfo.id,
    deityName: deityInfo.name,
    palace: deityInfo.palace,
    colorName: deityInfo.colorName,
    colorHex: deityInfo.colorHex,
    blessingTitle: deityInfo.blessingTitle,
    loreSummary: deityInfo.loreSummary,
    deitiesList: deities.map((id, idx) => ({
      giaIndex: idx + 1,
      ...(HAU_DONG_DEITIES[id] || HAU_DONG_DEITIES.quan_lon_de_tam)
    }))
  }
}

async function getCrowdfundProgress(conn: DbConn) {
  const row = await conn
    .prepare(
      `SELECT COALESCE(SUM(amount_mc), 0) AS current_mc, COUNT(*) AS contributor_count
         FROM hau_dong_donations
        WHERE mode = 'crowdfund' AND session_id IS NULL`
    )
    .get() as { current_mc: number; contributor_count: number }

  const recentContributors = await conn
    .prepare(
      `SELECT d.amount_mc, d.prayer_text, d.created_at, a.display_name
         FROM hau_dong_donations d
         JOIN accounts a ON a.id = d.account_id
        WHERE d.mode = 'crowdfund' AND d.session_id IS NULL
        ORDER BY d.created_at DESC
        LIMIT 5`
    )
    .all() as Array<{ amount_mc: number; prayer_text: string; created_at: number; display_name: string }>

  return {
    currentMc: Number(row.current_mc || 0),
    targetMc: HAU_DONG_CONFIG.sponsorThresholdMc,
    remainingMc: Math.max(0, HAU_DONG_CONFIG.sponsorThresholdMc - Number(row.current_mc || 0)),
    contributorCount: Number(row.contributor_count || 0),
    recentContributors
  }
}

async function getAccountDailyClaimedMc(conn: DbConn, accountId: number, now: number): Promise<number> {
  const vnMidnight = new Date(getVietnamDayKey(now) + 'T00:00:00+07:00').getTime()
  const row = await conn
    .prepare(
      `SELECT COALESCE(SUM(claimed_mc), 0) AS total
         FROM hau_dong_attendance
        WHERE account_id = ? AND claimed_at IS NOT NULL AND claimed_at >= ?`
    )
    .get(accountId, vnMidnight) as { total: number }
  return Number(row.total || 0)
}

/**
 * Lấy toàn bộ trạng thái Nhà Hầu Đồng cho Frontend HUD, 3D TempleStage và Drawer UI.
 */
export async function getHauDongStatus(accountId: number | null) {
  const conn = await getDb()
  const now = Date.now()
  const activeSession = await advanceSessionLifecycle(conn, now)
  const lunarInfo = getLunarDayInfo(now)
  const crowdfund = await getCrowdfundProgress(conn)

  const queuedSessions = await conn
    .prepare(
      `SELECT session_id, trigger_type, sponsor_display_name, prayer_text, created_at
         FROM hau_dong_sessions
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 5`
    )
    .all() as Array<{
      session_id: string
      trigger_type: string
      sponsor_display_name: string
      prayer_text: string
      created_at: number
    }>

  const recentSessions = await conn
    .prepare(
      `SELECT session_id, trigger_type, sponsor_display_name, prayer_text, total_pool_mc, started_at
         FROM hau_dong_sessions
        WHERE status IN ('active', 'completed')
        ORDER BY created_at DESC
        LIMIT 6`
    )
    .all()

  let liveProgress = null
  let myAttendance = null

  if (activeSession) {
    liveProgress = computeLiveProgress(activeSession, now)
    if (accountId) {
      const att = await conn
        .prepare(
          `SELECT watch_seconds, is_bowing, claimed_mc, claimed_at
             FROM hau_dong_attendance
            WHERE session_id = ? AND gia_index = ? AND account_id = ?`
        )
        .get(activeSession.session_id, liveProgress.giaIndex, accountId) as
        | { watch_seconds: number; is_bowing: number; claimed_mc: number; claimed_at: number | null }
        | undefined

      const watchSeconds = att ? Number(att.watch_seconds) : 0
      const isBowing = att ? Boolean(att.is_bowing) : false
      const claimedMc = att ? Number(att.claimed_mc) : 0
      // Cho phép thỉnh lộc ngay ở Bước 5 (Ban Lộc) hoặc Bước 6 nếu đã hiện diện trong Nhà Hầu Đồng
      const canClaimNow =
        claimedMc === 0 &&
        (liveProgress.stepId === 5 || (liveProgress.stepId === 6 && watchSeconds >= HAU_DONG_CONFIG.minWatchSecToClaim)) &&
        activeSession.remaining_pool_mc > 0

      myAttendance = {
        watchSeconds,
        isBowing,
        claimedMc,
        hasClaimedThisGia: claimedMc > 0,
        canClaimNow
      }
    }
  }

  const dailyClaimedMc = accountId ? await getAccountDailyClaimedMc(conn, accountId, now) : 0

  return {
    serverTime: now,
    config: HAU_DONG_CONFIG,
    lunarInfo,
    scheduleInfo: getNextScheduled11Am(now),
    deityCatalog: Object.values(HAU_DONG_DEITIES),
    stepsCatalog: HAU_DONG_STEPS,
    activeSession: activeSession
      ? {
          sessionId: activeSession.session_id,
          triggerType: activeSession.trigger_type,
          sponsorAccountId: activeSession.sponsor_account_id,
          sponsorName: activeSession.sponsor_display_name,
          prayerText: activeSession.prayer_text,
          totalPoolMc: activeSession.total_pool_mc,
          remainingPoolMc: activeSession.remaining_pool_mc,
          startedAt: activeSession.started_at,
          endsAt: activeSession.ends_at,
          ...liveProgress!
        }
      : null,
    myAttendance,
    dailyClaimedMc,
    remainingDailyClaimMc: Math.max(0, HAU_DONG_CONFIG.dailyMaxClaimMc - dailyClaimedMc),
    crowdfund,
    queue: queuedSessions,
    recentSessions
  }
}

/**
 * Công đức Mở Đàn Đặc Cách (`single_open` >= 2,500 MC) hoặc Góp Quỹ Bách Gia (`crowdfund` >= 50 MC).
 */
export async function sponsorHauDongSession(
  accountId: number,
  input: {
    requestId?: unknown
    mode?: unknown
    amountMc?: unknown
    customDeityId?: unknown
    prayerText?: unknown
  }
) {
  const requestId = normalizeRequestId(input.requestId || `hd_don_${Date.now()}_${randomBytes(3).toString('hex')}`)
  const mode = input.mode === 'crowdfund' ? 'crowdfund' : 'single_open'
  const amountMc = Number(input.amountMc)

  if (!Number.isSafeInteger(amountMc) || amountMc <= 0) {
    apiError(400, 'invalid_amount', 'Số lượng MC công đức phải là số nguyên dương')
  }

  if (mode === 'single_open' && amountMc < HAU_DONG_CONFIG.sponsorThresholdMc) {
    apiError(
      400,
      'below_sponsor_threshold',
      `Mở Đàn Đặc Cách riêng cần tối thiểu ${HAU_DONG_CONFIG.sponsorThresholdMc.toLocaleString()} MC (hoặc chọn tab Góp Quỹ Bách Gia từ ${HAU_DONG_CONFIG.minCrowdfundMc} MC)`
    )
  }

  if (mode === 'crowdfund' && amountMc < HAU_DONG_CONFIG.minCrowdfundMc) {
    apiError(400, 'below_crowdfund_min', `Góp Quỹ Bách Gia Mở Đàn tối thiểu từ ${HAU_DONG_CONFIG.minCrowdfundMc} MC`)
  }

  const customDeityId =
    typeof input.customDeityId === 'string' && HAU_DONG_DEITIES[input.customDeityId] ? input.customDeityId : null

  const rawPrayer = typeof input.prayerText === 'string' ? input.prayerText.trim() : ''
  const prayerText = (rawPrayer || 'Cầu Quốc Thái Dân An · Gia Đạo Cát Tường · Tâm Khai Trí Sáng · Tài Lộc Hanh Thông').slice(
    0,
    180
  )

  const spendRes = await spend(accountId, amountMc, 'hau_dong_donation', requestId, {
    refType: 'hau_dong_donation',
    metadata: { mode, amountMc, customDeityId, prayerText },
    onSpent: async (conn, { ledgerId, now }) => {
      const acc = await conn.prepare('SELECT display_name FROM accounts WHERE id = ?').get(accountId) as
        | { display_name: string }
        | undefined
      const sponsorName = acc?.display_name || `Thiện Tín #${accountId}`

      await advanceSessionLifecycle(conn, now)
      const currentActive = await conn
        .prepare(`SELECT session_id FROM hau_dong_sessions WHERE status = 'active' LIMIT 1`)
        .get() as { session_id: string } | undefined

      let createdSessionId: string | null = null
      let sessionStatus: 'active' | 'queued' | 'crowdfunding' = 'crowdfunding'

      if (mode === 'single_open') {
        createdSessionId = `hd_sp_${now}_${randomBytes(3).toString('hex')}`
        const poolMc = Math.floor(amountMc * HAU_DONG_CONFIG.poolRatio)
        const burnedMc = Math.floor(amountMc * HAU_DONG_CONFIG.burnRatio)
        const reserveMc = amountMc - poolMc - burnedMc
        const deities = buildFiveDeitiesList(customDeityId)

        // Nếu đang là phiên inaugural_welcome (mặc định) thì nâng cấp luôn thành phiên Đặc cách của Thanh đồng!
        const activeFull = await conn
          .prepare(`SELECT session_id, trigger_type FROM hau_dong_sessions WHERE status = 'active' LIMIT 1`)
          .get() as { session_id: string; trigger_type: string } | undefined

        const startImmediately = !activeFull || activeFull.trigger_type === 'inaugural_welcome'
        if (activeFull && activeFull.trigger_type === 'inaugural_welcome') {
          await conn.prepare(`UPDATE hau_dong_sessions SET status = 'completed', ends_at = ? WHERE session_id = ?`).run(now, activeFull.session_id)
        }

        sessionStatus = startImmediately ? 'active' : 'queued'
        const startedAt = startImmediately ? now : null
        const endsAt = startImmediately ? now + HAU_DONG_CONFIG.sessionDurationSec * 1000 : null

        await conn
          .prepare(
            `INSERT INTO hau_dong_sessions (
              session_id, trigger_type, sponsor_account_id, sponsor_display_name,
              prayer_text, deities_json, total_pool_mc, remaining_pool_mc,
              burned_mc, reserve_mc, status, started_at, ends_at, created_at
            ) VALUES (?, 'sponsored_single', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            createdSessionId,
            accountId,
            sponsorName,
            prayerText,
            JSON.stringify(deities),
            poolMc,
            poolMc,
            burnedMc,
            reserveMc,
            sessionStatus,
            startedAt,
            endsAt,
            now
          )

        await conn
          .prepare(
            `INSERT INTO hau_dong_donations (request_id, account_id, session_id, mode, amount_mc, custom_deity_id, prayer_text, ledger_id, created_at)
             VALUES (?, ?, ?, 'single_open', ?, ?, ?, ?, ?)`
          )
          .run(requestId, accountId, createdSessionId, amountMc, customDeityId, prayerText, ledgerId, now)
      } else {
        // Ghi nhận khoản góp chung Bách Gia
        await conn
          .prepare(
            `INSERT INTO hau_dong_donations (request_id, account_id, session_id, mode, amount_mc, custom_deity_id, prayer_text, ledger_id, created_at)
             VALUES (?, ?, NULL, 'crowdfund', ?, ?, ?, ?, ?)`
          )
          .run(requestId, accountId, amountMc, customDeityId, prayerText, ledgerId, now)

        // Kiểm tra xem tổng quỹ Bách Gia đã đạt >= 2,500 MC chưa
        const sumRow = await conn
          .prepare(`SELECT COALESCE(SUM(amount_mc), 0) AS total FROM hau_dong_donations WHERE mode = 'crowdfund' AND session_id IS NULL`)
          .get() as { total: number }
        const totalCrowdfundMc = Number(sumRow.total || 0)

        if (totalCrowdfundMc >= HAU_DONG_CONFIG.sponsorThresholdMc) {
          createdSessionId = `hd_cf_${now}_${randomBytes(3).toString('hex')}`
          const poolMc = Math.floor(totalCrowdfundMc * HAU_DONG_CONFIG.poolRatio)
          const burnedMc = Math.floor(totalCrowdfundMc * HAU_DONG_CONFIG.burnRatio)
          const reserveMc = totalCrowdfundMc - poolMc - burnedMc
          const deities = buildFiveDeitiesList(customDeityId)

          const startImmediately = !currentActive
          sessionStatus = startImmediately ? 'active' : 'queued'
          const startedAt = startImmediately ? now : null
          const endsAt = startImmediately ? now + HAU_DONG_CONFIG.sessionDurationSec * 1000 : null

          await conn
            .prepare(
              `INSERT INTO hau_dong_sessions (
                session_id, trigger_type, sponsor_account_id, sponsor_display_name,
                prayer_text, deities_json, total_pool_mc, remaining_pool_mc,
                burned_mc, reserve_mc, status, started_at, ends_at, created_at
              ) VALUES (?, 'sponsored_crowdfund', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              createdSessionId,
              accountId,
              `Bách Gia Công Đức (${sponsorName} & Thiện Tín)`,
              prayerText,
              JSON.stringify(deities),
              poolMc,
              poolMc,
              burnedMc,
              reserveMc,
              sessionStatus,
              startedAt,
              endsAt,
              now
            )

          await conn
            .prepare(`UPDATE hau_dong_donations SET session_id = ? WHERE mode = 'crowdfund' AND session_id IS NULL`)
            .run(createdSessionId)
        }
      }

      return {
        createdSessionId,
        sessionStatus
      }
    }
  })

  return {
    ledgerId: spendRes.ledgerId,
    spentMc: spendRes.spentMc,
    balanceAfter: spendRes.balanceAfter,
    createdSessionId: spendRes.extra.createdSessionId,
    sessionStatus: spendRes.extra.sessionStatus,
    status: await getHauDongStatus(accountId)
  }
}

/**
 * Nghi lễ Khai Đàn định kỳ đã được cố định vào khung giờ 11h00 Trưa (Giờ Ngọ) hằng ngày.
 * Các yêu cầu mở đàn miễn phí ngoài giờ đều bị từ chối.
 */
export function startFreeRitualIfIdle(accountId: number | null) {
  apiError(
    400,
    'free_ritual_disabled',
    'Nghi lễ Khai Đàn định kỳ diễn ra vào đúng 11h00 Trưa (Giờ Ngọ) hằng ngày. Quý đạo hữu có thể hoan hỷ chờ hoặc Phát Tâm Mở Đàn Đặc Cách / Góp Bách Gia.'
  )
}

/**
 * Ghi nhận Heartbeat hiện diện trong khu vực Nhà Hầu Đồng & động tác Chắp Tay Khánh Hỷ (`isBowing`).
 */
export async function recordHauDongHeartbeat(
  accountId: number,
  input: {
    insideZone?: boolean
    isBowing?: boolean
    deltaSec?: number
  }
) {
  const conn = await getDb()
  const now = Date.now()
  const activeSession = await advanceSessionLifecycle(conn, now)
  if (!activeSession || !input.insideZone) {
    return getHauDongStatus(accountId)
  }

  const live = computeLiveProgress(activeSession, now)
  const requestedSec = Math.max(1, Math.min(15, Math.floor(Number(input.deltaSec) || 5)))
  const bowingFlag = input.isBowing ? 1 : 0

  // Không tin deltaSec của client: số giây cộng thêm không vượt quá thời gian thực đã trôi qua
  // kể từ heartbeat trước (tối thiểu 1 giây cho lần đầu), chặn bơm watch_seconds bằng cách gửi dồn.
  const prev = await conn
    .prepare(
      `SELECT last_heartbeat_at FROM hau_dong_attendance
        WHERE session_id = ? AND gia_index = ? AND account_id = ?`
    )
    .get(activeSession.session_id, live.giaIndex, accountId) as { last_heartbeat_at: number | null } | undefined
  const elapsedSec = prev?.last_heartbeat_at ? Math.floor((now - prev.last_heartbeat_at) / 1000) : requestedSec
  const addSec = Math.max(0, Math.min(requestedSec, elapsedSec))
  if (addSec === 0) {
    return getHauDongStatus(accountId)
  }

  await conn
    .prepare(
      `INSERT INTO hau_dong_attendance (session_id, gia_index, account_id, watch_seconds, is_bowing, claimed_mc, last_heartbeat_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(session_id, gia_index, account_id)
       DO UPDATE SET
         watch_seconds = CASE
           WHEN hau_dong_attendance.watch_seconds + excluded.watch_seconds > 96 THEN 96
           ELSE hau_dong_attendance.watch_seconds + excluded.watch_seconds
         END,
         is_bowing = CASE
           WHEN excluded.is_bowing > hau_dong_attendance.is_bowing THEN excluded.is_bowing
           ELSE hau_dong_attendance.is_bowing
         END,
         last_heartbeat_at = excluded.last_heartbeat_at`
    )
    .run(activeSession.session_id, live.giaIndex, accountId, addSec, bowingFlag, now)

  return getHauDongStatus(accountId)
}

/**
 * Thỉnh Lộc Thánh (Ban Lễ) ở Bước 5 của mỗi Giá đồng:
 * Cộng MC trực tiếp vào tài khoản người tham dự thông qua `credit()` nguyên tử.
 */
export async function claimHauDongBlessing(accountId: number, input?: { isBowing?: boolean }) {
  // Bọc cả kiểm tra hạn mức, ghi sổ cái, ghi điểm danh và trừ quỹ trong MỘT giao dịch:
  // nếu bước sau lỗi thì MC đã cộng cũng được hoàn tác (withTransaction lồng nhau dùng lại giao dịch ngoài).
  return withTransaction((conn) => claimHauDongBlessingTx(conn, accountId, input))
}

async function claimHauDongBlessingTx(conn: DbConn, accountId: number, input?: { isBowing?: boolean }) {
  const now = Date.now()
  const activeSession = await advanceSessionLifecycle(conn, now)

  if (!activeSession) {
    apiError(400, 'no_active_session', 'Hiện tại Điện Thờ chưa mở vấn hầu nào.')
  }

  const live = computeLiveProgress(activeSession, now)
  if (live.stepId !== 5 && live.stepId !== 6) {
    apiError(
      400,
      'not_blessing_step',
      `Hiện đang ở bước "${live.stepName}". Xin hoan hỷ đợi tới Bước 5 (Ban Lộc Tứ Phủ) của giá đồng để thỉnh lộc!`
    )
  }

  // Kiểm tra hạn mức ngày
  const dailyClaimed = await getAccountDailyClaimedMc(conn, accountId, now)
  const remainingDaily = Math.max(0, HAU_DONG_CONFIG.dailyMaxClaimMc - dailyClaimed)
  if (remainingDaily <= 0) {
    apiError(400, 'daily_cap_reached', `Bạn đã thỉnh tối đa ${HAU_DONG_CONFIG.dailyMaxClaimMc} MC lộc Hầu Đồng trong hôm nay.`)
  }

  // Kiểm tra xem đã nhận lộc ở Giá này chưa
  const existingAtt = await conn
    .prepare(
      `SELECT watch_seconds, is_bowing, claimed_mc
         FROM hau_dong_attendance
        WHERE session_id = ? AND gia_index = ? AND account_id = ?`
    )
    .get(activeSession.session_id, live.giaIndex, accountId) as
    | { watch_seconds: number; is_bowing: number; claimed_mc: number }
    | undefined

  if (existingAtt && existingAtt.claimed_mc > 0) {
    apiError(400, 'already_claimed_this_gia', `Bạn đã thỉnh lộc của Giá thứ ${live.giaIndex} (${live.deityName}) rồi!`)
  }

  const isBowing = Boolean(input?.isBowing || (existingAtt && existingAtt.is_bowing))
  const isSponsor = activeSession.sponsor_account_id === accountId

  let rewardMc = HAU_DONG_CONFIG.baseRewardPerGiaMc
  if (isBowing) rewardMc += HAU_DONG_CONFIG.bowingBonusMc
  if (isSponsor) rewardMc += HAU_DONG_CONFIG.sponsorBonusMc
  rewardMc = Math.min(rewardMc, remainingDaily, Math.max(10, activeSession.remaining_pool_mc))

  const refId = `hd_loc_${activeSession.session_id}_gia${live.giaIndex}_u${accountId}`
  const creditRes = await credit(accountId, rewardMc, 'hau_dong_blessing', {
    refType: 'hau_dong_blessing',
    refId,
    metadata: {
      sessionId: activeSession.session_id,
      giaIndex: live.giaIndex,
      deityId: live.deityId,
      deityName: live.deityName,
      isBowing,
      isSponsor
    }
  })

  await withTransaction(async txConn => {
    await txConn
      .prepare(
        `INSERT INTO hau_dong_attendance (
          session_id, gia_index, account_id, watch_seconds, is_bowing, claimed_mc, ledger_id, last_heartbeat_at, claimed_at
        ) VALUES (?, ?, ?, 20, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id, gia_index, account_id)
        DO UPDATE SET
          is_bowing = CASE
            WHEN excluded.is_bowing > hau_dong_attendance.is_bowing THEN excluded.is_bowing
            ELSE hau_dong_attendance.is_bowing
          END,
          claimed_mc = excluded.claimed_mc,
          ledger_id = excluded.ledger_id,
          claimed_at = excluded.claimed_at`
      )
      .run(activeSession.session_id, live.giaIndex, accountId, isBowing ? 1 : 0, rewardMc, creditRes.ledgerId, now, now)

    // Lần gọi lặp lại (idempotent replay) không được trừ quỹ thêm lần nữa.
    if (!creditRes.idempotentReplay) {
      await txConn
        .prepare(
          `UPDATE hau_dong_sessions
              SET remaining_pool_mc = CASE
                WHEN remaining_pool_mc - ? < 0 THEN 0
                ELSE remaining_pool_mc - ?
              END
            WHERE session_id = ?`
        )
        .run(rewardMc, rewardMc, activeSession.session_id)
    }
  })

  return {
    ledgerId: creditRes.ledgerId,
    creditedMc: creditRes.creditedMc,
    balanceAfter: creditRes.balanceAfter,
    giaIndex: live.giaIndex,
    deityName: live.deityName,
    blessingTitle: live.blessingTitle,
    status: await getHauDongStatus(accountId)
  }
}

