// Cổng ngân sách chữ (Giai đoạn 4). Chạy: node scripts/verify-copy-budget.mjs [--list]
// Ngân sách: nút <= 3 từ, tiêu đề <= 3 từ, mô tả/nhãn <= 12 từ, toast <= 6 từ (xem copy.ts).
// Bỏ qua pages/dev (trang nhà phát triển, không phải giao diện người chơi).
import { scanAll, violations, BUDGET } from './lib/copyScan.mjs'
import { COPY_BUDGET_VIOLATIONS, TOAST_BUDGET_VIOLATIONS } from './lib/copyBudgetCheck.mjs'

const all = scanAll('.')
let bad = 0
const lines = []
for (const [file, items] of Object.entries(all)) {
  if (file.startsWith('pages/dev/')) continue
  for (const v of violations(items)) {
    bad++
    lines.push(`[VƯỢT ${v.cat} ${v.words}/${BUDGET[v.cat]}] ${file}:${v.line} -> ${v.text.slice(0, 80)}`)
  }
}
for (const msg of [...COPY_BUDGET_VIOLATIONS(), ...TOAST_BUDGET_VIOLATIONS()]) {
  bad++
  lines.push(msg)
}
if (process.argv.includes('--list') || bad > 0) console.log(lines.join('\n'))
if (bad > 0) {
  console.log(`\nFAILED: ${bad} chuỗi vượt ngân sách chữ.`)
  process.exit(1)
}
console.log('ALL COPY BUDGET CHECKS PASSED')
