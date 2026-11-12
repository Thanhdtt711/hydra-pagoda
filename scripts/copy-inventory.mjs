// Kiểm kê chữ hiển thị. Chạy: node scripts/copy-inventory.mjs [--json]
import { scanAll, summarize, violations, CATEGORIES } from './lib/copyScan.mjs'

const all = scanAll('.')
const rows = Object.entries(all)
  .map(([file, items]) => ({ file, ...summarize(items), over: violations(items).length }))
  .filter((r) => r.strings > 0)
  .sort((a, b) => b.total - a.total)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  console.log(['file', 'tổng từ', 'chuỗi', ...CATEGORIES, 'vượt'].join('\t'))
  for (const r of rows) console.log([r.file, r.total, r.strings, ...CATEGORIES.map((c) => r[c]), r.over].join('\t'))
  const sum = rows.reduce((a, r) => a + r.total, 0)
  console.log(`TỔNG\t${sum}\t${rows.reduce((a, r) => a + r.strings, 0)}`)
}
