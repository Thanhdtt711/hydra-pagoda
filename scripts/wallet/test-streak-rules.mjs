// Kiểm thử quy tắc thuần của Sổ Tu Tập (lib/streak/streakRules.ts) và helper tuần giờ Việt Nam.
// Chạy: node --experimental-strip-types scripts/wallet/test-streak-rules.mjs
import { EMPTY_STREAK, STREAK_MILESTONES, computeStreakStep, nextMilestoneOf } from '../../lib/streak/streakRules.ts'
import {
  addDaysToDayKey,
  daysBetweenDayKeys,
  getVietnamWeekKey,
  getWeekKeyOfDayKey
} from '../../lib/time/vietnamDay.ts'

const results = []
const check = (name, ok, info = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' - ' + info : ''}`)
}

// 2026-11-09 là thứ Hai.
const MON = '2026-11-09'
check('thứ Hai là đầu tuần của chính nó', getWeekKeyOfDayKey(MON) === MON)
check('chủ nhật 2026-11-15 cùng tuần với thứ Hai 2026-11-09', getWeekKeyOfDayKey('2026-11-15') === MON)
check('thứ Hai kế tiếp mở tuần mới', getWeekKeyOfDayKey('2026-11-16') === '2026-11-16')
check('cộng ngày qua ranh giới tháng', addDaysToDayKey('2026-11-30', 1) === '2026-12-01')
check('khoảng cách ngày qua ranh giới năm', daysBetweenDayKeys('2026-12-31', '2027-01-02') === 2)
// 16:59 UTC chủ nhật 15/11 = 23:59 VN chủ nhật; 17:00 UTC = 00:00 thứ Hai 16/11 giờ VN.
check('23:59 chủ nhật giờ VN vẫn là tuần cũ', getVietnamWeekKey(Date.UTC(2026, 10, 15, 16, 59, 59)) === MON)
check('00:00 thứ Hai giờ VN sang tuần mới', getVietnamWeekKey(Date.UTC(2026, 10, 15, 17, 0, 0)) === '2026-11-16')

const run = (days) => {
  let s = { ...EMPTY_STREAK }
  const outs = []
  for (const d of days) {
    const r = computeStreakStep(s, d)
    s = r.next
    outs.push(r.outcome)
  }
  return { s, outs }
}

let r = run(['2026-11-09'])
check('ngày đầu: chuỗi 1, outcome first', r.s.currentStreak === 1 && r.outs[0] === 'first')

r = run(['2026-11-09', '2026-11-10', '2026-11-11'])
check('3 ngày liên tiếp: chuỗi 3', r.s.currentStreak === 3 && r.s.bestStreak === 3 && r.outs[2] === 'continued')

r = run(['2026-11-09', '2026-11-09'])
check('ghi lại trong cùng ngày không tăng chuỗi', r.s.currentStreak === 1 && r.outs[1] === 'already')

r = run(['2026-11-09', '2026-11-10', '2026-11-12'])
check('lỡ 1 ngày, ngày nghỉ còn: chuỗi giữ và tăng 1 (rested)', r.s.currentStreak === 3 && r.outs[2] === 'rested' && r.s.restWeekKey === MON)

r = run(['2026-11-09', '2026-11-11', '2026-11-13'])
check('lỡ 1 ngày lần thứ hai cùng tuần: chuỗi về nửa (halved)', r.outs[1] === 'rested' && r.outs[2] === 'halved' && r.s.currentStreak === 2, `streak=${r.s.currentStreak}`)

r = run(['2026-11-14', '2026-11-15', '2026-11-17'])
check('ngày nghỉ tính theo tuần của NGÀY BỊ LỠ: lỡ thứ Hai tuần sau vẫn có ngày nghỉ mới', r.outs[2] === 'rested' && r.s.currentStreak === 3)

r = run(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-17'])
check('lỡ 2 ngày: chuỗi 6 về nửa còn 3 rồi cộng dấu hôm nay thành 4', r.outs[6] === 'halved' && r.s.currentStreak === 4, `streak=${r.s.currentStreak}`)

r = run(['2026-11-09', '2026-12-30'])
check('bỏ lâu: chuỗi 1 về nửa là 0 rồi cộng hôm nay thành 1, không bao giờ về 0', r.s.currentStreak === 1 && r.outs[1] === 'halved')

r = run(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-18'])
check('bestStreak giữ kỷ lục sau khi chuỗi bị giảm', r.s.bestStreak === 7 && r.s.currentStreak === 4, `best=${r.s.bestStreak}, cur=${r.s.currentStreak}`)

const before = { currentStreak: 5, bestStreak: 5, lastDayKey: '2026-11-09', restWeekKey: null }
const snapshot = JSON.stringify(before)
computeStreakStep(before, '2026-11-10')
check('computeStreakStep không đổi state đầu vào', JSON.stringify(before) === snapshot)

check('cột mốc đúng thứ tự 3, 7, 21, 49, 108', STREAK_MILESTONES.map(m => m.milestone).join(',') === '3,7,21,49,108')
check('cột mốc kế tiếp của chuỗi 0 là 3', nextMilestoneOf(0)?.milestone === 3)
check('cột mốc kế tiếp của chuỗi 3 là 7', nextMilestoneOf(3)?.milestone === 7)
check('qua hết cột mốc thì không còn cột mốc kế tiếp', nextMilestoneOf(108) === null)

const failed = results.filter(ok => !ok).length
console.log(`\n${results.length - failed}/${results.length} test PASS`)
process.exit(failed ? 1 : 0)
