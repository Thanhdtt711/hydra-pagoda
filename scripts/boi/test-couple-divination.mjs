// scripts/boi/test-couple-divination.mjs
// Unit Test cho dịch vụ Bói Duyên Cặp Đôi (Đài Tơ Duyên Nguyệt Lão)

import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.js') &&
      !specifier.endsWith('.mjs') &&
      !specifier.endsWith('.json') &&
      context.parentURL
    ) {
      const parentDir = dirname(fileURLToPath(context.parentURL))
      const candidateTs = resolve(parentDir, `${specifier}.ts`)
      if (existsSync(candidateTs)) {
        return nextResolve(pathToFileURL(candidateTs).href, context)
      }
    }
    return nextResolve(specifier, context)
  }
})

const { calculateCoupleCompatibility } = await import('../../lib/boi/CoupleDivinationLogic.ts')

test('1. Tính điểm tương hợp cặp đôi Tương sinh (Hải Trung Kim sinh Giản Hạ Thủy)', () => {
  const p1 = { fullName: 'Nguyễn Văn An', birthDate: '1984-05-15', gender: 'nam' } // 1984 Giáp Tý (Hải Trung Kim)
  const p2 = { fullName: 'Trần Thị Mai', birthDate: '1996-08-20', gender: 'nu' }  // 1996 Bính Tý (Giản Hạ Thủy)

  const res = calculateCoupleCompatibility(p1, p2, '2026-11-10')
  assert.ok(res.score >= 80, `Điểm tương sinh phải >= 80, thực tế: ${res.score}`)
  assert.ok(['Duyên Tiền Định', 'Tri Kỷ Tương Phùng'].includes(res.rankTitle))
  assert.equal(res.relation, 'tuong_sinh')
})

test('2. Tính điểm tương hợp cặp đôi Tương khắc (Hải Trung Kim khắc Đại Lâm Mộc)', () => {
  const p1 = { fullName: 'Lê Hoàng', birthDate: '1984-05-15', gender: 'nam' } // 1984 Giáp Tý (Hải Trung Kim)
  const p2 = { fullName: 'Phạm Lan', birthDate: '1988-03-12', gender: 'nu' }  // 1988 Mậu Thìn (Đại Lâm Mộc)

  const res = calculateCoupleCompatibility(p1, p2, '2026-11-10')
  assert.ok(res.score >= 60 && res.score <= 75, `Điểm tương khắc nằm trong [60, 75], thực tế: ${res.score}`)
  assert.equal(res.relation, 'tuong_khac')
})

test('3. Điểm số tương hợp luôn nằm trong khoảng an toàn [60, 99]', () => {
  const pairs = [
    [{ fullName: 'A', birthDate: '1990-01-01', gender: 'nam' }, { fullName: 'B', birthDate: '1995-05-05', gender: 'nu' }],
    [{ fullName: 'C', birthDate: '2000-12-12', gender: 'nam' }, { fullName: 'D', birthDate: '2002-02-02', gender: 'nu' }],
    [{ fullName: 'E', birthDate: '1975-07-07', gender: 'nam' }, { fullName: 'F', birthDate: '1980-08-08', gender: 'nu' }]
  ]

  for (const [p1, p2] of pairs) {
    const res = calculateCoupleCompatibility(p1, p2, '2026-11-10')
    assert.ok(res.score >= 60 && res.score <= 99, `Điểm ngoài khoảng [60, 99]: ${res.score}`)
  }
})
