import assert from 'node:assert/strict'
import { getActiveFestival, getLunarDateFromDayKey } from '../../lib/festival/festivalCalendar.ts'
import { getVietnamDayKey } from '../../lib/time/vietnamDay.ts'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`PASS: ${name}`)
}

test('Mùng 1 Tết Ất Tỵ 2025 (2025-01-29)', () => {
  const f = getActiveFestival('2025-01-29')
  assert.ok(f)
  assert.equal(f.id, 'mung_1')
  assert.equal(f.lunarDay, 1)
  assert.equal(f.lunarMonth, 1)
  assert.equal(f.lunarYear, 2025)
  assert.equal(f.badgeLabel, 'Mùng 1 · 1/1 ÂL')
})

test('Rằm tháng Giêng 2025 (2025-02-12)', () => {
  const f = getActiveFestival('2025-02-12')
  assert.ok(f)
  assert.equal(f.id, 'ram')
  assert.equal(f.lunarDay, 15)
  assert.equal(f.lunarMonth, 1)
  assert.equal(f.lunarYear, 2025)
  assert.equal(f.badgeLabel, 'Rằm · 15/1 ÂL')
})

test('Mùng 1 Tết Bính Ngọ 2026 (2026-02-17)', () => {
  const f = getActiveFestival('2026-02-17')
  assert.ok(f)
  assert.equal(f.id, 'mung_1')
  assert.equal(f.lunarDay, 1)
  assert.equal(f.lunarMonth, 1)
  assert.equal(f.lunarYear, 2026)
})

test('Rằm tháng Giêng 2026 (2026-03-03)', () => {
  const f = getActiveFestival('2026-03-03')
  assert.ok(f)
  assert.equal(f.id, 'ram')
  assert.equal(f.lunarDay, 15)
  assert.equal(f.lunarMonth, 1)
  assert.equal(f.lunarYear, 2026)
})

test('Tháng nhuận không kích hoạt lễ lần 2 (1/6 nhuận 2025 = 2025-07-25, 15/6 nhuận = 2025-08-08)', () => {
  const leap1 = getLunarDateFromDayKey('2025-07-25')
  assert.ok(leap1)
  assert.equal(leap1.day, 1)
  assert.equal(leap1.month, 6)
  assert.equal(leap1.isLeap, true)
  assert.equal(getActiveFestival('2025-07-25'), null)

  const leap15 = getLunarDateFromDayKey('2025-08-08')
  assert.ok(leap15)
  assert.equal(leap15.day, 15)
  assert.equal(leap15.month, 6)
  assert.equal(leap15.isLeap, true)
  assert.equal(getActiveFestival('2025-08-08'), null)
})

test('Ngày thường và dayKey không hợp lệ trả về null', () => {
  assert.equal(getActiveFestival('2025-01-28'), null)
  assert.equal(getActiveFestival('2026-03-04'), null)
  assert.equal(getActiveFestival('invalid'), null)
  assert.equal(getActiveFestival('2026-13-01'), null)
})

test('Ranh giới nửa đêm giờ Việt Nam (UTC+7)', () => {
  const beforeMidnightVn = Date.parse('2026-02-16T16:59:59Z') // 23:59:59 VN -> 2026-02-16
  const atMidnightVn = Date.parse('2026-02-16T17:00:00Z')     // 00:00:00 VN -> 2026-02-17 (Mùng 1)
  assert.equal(getActiveFestival(getVietnamDayKey(beforeMidnightVn)), null)
  assert.equal(getActiveFestival(getVietnamDayKey(atMidnightVn))?.id, 'mung_1')
})

console.log(`ALL ${passed}/${passed} FESTIVAL CALENDAR TESTS PASSED`)

