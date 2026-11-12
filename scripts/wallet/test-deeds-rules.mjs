// Kiểm thử phần thuần của Ba Việc Lành (lib/streak/deedCatalog.ts): chọn việc theo hạt giống tài khoản + ngày.
// Chạy: node --experimental-strip-types scripts/wallet/test-deeds-rules.mjs
import { DAILY_DEED_COUNT, DEED_CATALOG, findVisitDeed, pickDailyDeeds } from '../../lib/streak/deedCatalog.ts'
import fs from 'node:fs'

// MapLayout.ts dùng import không đuôi nên Node thuần không nạp được; đọc mã nguồn để đối chiếu khóa và mã điểm.
const mapLayoutSrc = fs.readFileSync(new URL('../../lib/world3d/world/MapLayout.ts', import.meta.url), 'utf8')
const landmarkIdOf = key => mapLayoutSrc.match(new RegExp(`\\n    ${key}: \\{\\s*\\n\\s*id: '([a-z_]+)'`))?.[1] ?? null

const results = []
const check = (name, ok, info = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' - ' + info : ''}`)
}
const ids = list => list.map(d => d.id).join(',')

const a = pickDailyDeeds(1, '2026-11-12')
check('mỗi bộ có đúng 3 việc', a.length === DAILY_DEED_COUNT && DAILY_DEED_COUNT === 3)
check('cùng tài khoản cùng ngày ra cùng bộ việc', ids(a) === ids(pickDailyDeeds(1, '2026-11-12')))
check('không trùng việc trong một bộ', new Set(a.map(d => d.id)).size === a.length)

let sameAcrossDays = 0
let sameAcrossAccounts = 0
const seenIds = new Set()
let allUnique = true
for (let i = 0; i < 60; i++) {
  const day = `2026-12-${String((i % 28) + 1).padStart(2, '0')}`
  const set = pickDailyDeeds(100 + i, day)
  if (new Set(set.map(d => d.id)).size !== set.length) allUnique = false
  set.forEach(d => seenIds.add(d.id))
  if (ids(pickDailyDeeds(7, `2027-01-${String((i % 28) + 1).padStart(2, '0')}`)) === ids(pickDailyDeeds(7, '2027-01-01'))) sameAcrossDays++
  if (ids(pickDailyDeeds(1000 + i, '2026-11-12')) === ids(pickDailyDeeds(1000, '2026-11-12'))) sameAcrossAccounts++
}
check('60 bộ ngẫu nhiên đều không trùng việc', allUnique)
check('đổi ngày thì bộ việc thay đổi (không đứng yên)', sameAcrossDays < 30, `giống ngày mẫu ${sameAcrossDays}/60`)
check('đổi tài khoản thì bộ việc khác nhau', sameAcrossAccounts < 30, `giống tài khoản mẫu ${sameAcrossAccounts}/60`)
check('mọi việc trong danh mục đều có cơ hội xuất hiện', seenIds.size === DEED_CATALOG.length, `${seenIds.size}/${DEED_CATALOG.length}`)

check('mã việc trong danh mục không trùng nhau', new Set(DEED_CATALOG.map(d => d.id)).size === DEED_CATALOG.length)
check(
  'việc auto có autoKey, việc visit có landmark và mapKey',
  DEED_CATALOG.every(d => (d.kind === 'auto' ? Boolean(d.autoKey) : Boolean(d.landmark && d.mapKey)))
)
check(
  'mọi mapKey của việc visit đều có trong MapLayout.LANDMARKS và khớp mã điểm',
  DEED_CATALOG.filter(d => d.kind === 'visit').every(d => landmarkIdOf(d.mapKey) === d.landmark)
)
check('findVisitDeed tìm đúng điểm và từ chối điểm lạ', findVisitDeed('lotus_pond')?.id === 'visit_lotus_pond' && findVisitDeed('khong_co') === null)
check('findVisitDeed không nhận việc auto', findVisitDeed('meditation') === null)

const failed = results.filter(ok => !ok).length
console.log(`\n${results.length - failed}/${results.length} PASS`)
if (failed > 0) process.exit(1)
