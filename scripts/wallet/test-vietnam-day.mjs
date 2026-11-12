// Kiểm thử helper ngày giờ Việt Nam dùng chung (lib/time/vietnamDay.ts).
// Chạy: node --experimental-strip-types scripts/wallet/test-vietnam-day.mjs
import { getStartOfVietnamDayMs, getVietnamDayKey } from '../../lib/time/vietnamDay.ts'

const results = []
const check = (name, ok, info = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' - ' + info : ''}`)
}

// 16:59:59 UTC ngày 10/11 = 23:59:59 giờ VN ngày 10/11
const beforeMidnight = Date.UTC(2026, 10, 10, 16, 59, 59)
// 17:00:00 UTC ngày 10/11 = 00:00:00 giờ VN ngày 11/11
const afterMidnight = Date.UTC(2026, 10, 10, 17, 0, 0)

check('trước nửa đêm VN vẫn là ngày 2026-11-10', getVietnamDayKey(beforeMidnight) === '2026-11-10', getVietnamDayKey(beforeMidnight))
check('qua nửa đêm VN sang ngày 2026-11-11 (UTC vẫn là 10/11)', getVietnamDayKey(afterMidnight) === '2026-11-11', getVietnamDayKey(afterMidnight))
check('mốc đầu ngày VN = 17:00 UTC hôm trước', getStartOfVietnamDayMs(afterMidnight) === afterMidnight, String(getStartOfVietnamDayMs(afterMidnight)))
check('mốc đầu ngày VN của 23:59:59 là 17:00 UTC cùng ngày UTC trước đó', getStartOfVietnamDayMs(beforeMidnight) === Date.UTC(2026, 10, 9, 17, 0, 0))
check(
  'khóa ngày khớp mốc đầu ngày',
  getVietnamDayKey(getStartOfVietnamDayMs(beforeMidnight)) === getVietnamDayKey(beforeMidnight)
)
check('khóa ngày hiện tại đúng định dạng YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(getVietnamDayKey()))

const failed = results.filter(ok => !ok).length
console.log(`\n${results.length - failed}/${results.length} test PASS`)
process.exit(failed ? 1 : 0)
