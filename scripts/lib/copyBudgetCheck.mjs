// Kiểm ngân sách trên chính tệp copy.ts (nguồn chuỗi duy nhất): khóa theo tiền tố.
//   btn.*  <= 3 từ    title.* <= 3 từ    toast.* <= 6 từ    tip.* / desc.* <= 12 từ
import fs from 'fs'
import { countWords } from './copyScan.mjs'

const LIMITS = { btn: 3, title: 3, toast: 6, tip: 12, desc: 12 }

const TOAST_LIMIT = 6
const TOAST_FILES = ['components/TempleCanvas.vue', 'stores/meditation.ts']

// Quét các lời gọi showToast( / pushNotice( : mỗi chuỗi literal trong lời gọi <= 6 từ.
// Lấy phần đối số tới dấu ')' cân bằng, bỏ chuỗi rỗng và biểu thức không phải literal.
export function TOAST_BUDGET_VIOLATIONS() {
  const out = []
  for (const file of TOAST_FILES) {
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    const re = /\b(showToast|pushNotice)\(/g
    let m
    while ((m = re.exec(src))) {
      if (src.slice(Math.max(0, m.index - 9), m.index) === 'function ') continue
      let depth = 1
      let i = re.lastIndex
      while (i < src.length && depth > 0) {
        const c = src[i]
        if (c === '(') depth++
        else if (c === ')') depth--
        else if (c === "'" || c === '"' || c === '`') {
          const q = c
          i++
          while (i < src.length && src[i] !== q) {
            if (src[i] === '\\') i++
            i++
          }
        }
        i++
      }
      const args = src.slice(re.lastIndex, i - 1)
      const line = src.slice(0, m.index).split('\n').length
      const lit = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g
      let s
      let idx = 0
      // pushNotice(kind, title, message, ...): tiêu đề <= 6 từ, nội dung hiện trong drawer <= 12 từ.
      // showToast(title, desc, ...): mọi chuỗi <= 6 từ.
      const isNotice = m[1] === 'pushNotice'
      while ((s = lit.exec(args))) {
        const text = (s[1] ?? s[2] ?? s[3] ?? '').replace(/\$\{[^}]*\}/g, '0')
        if (!/\p{L}{2,}/u.test(text)) continue
        if (/^(info|warning|error|success|incense|pagoda|coin|lotus|sparkles|wallet|fortune|sunset|hand-bow|meditation|guide_to_hall)$/.test(text)) continue
        const limit = isNotice && idx >= 1 ? 12 : TOAST_LIMIT
        idx++
        const n = countWords(text)
        if (n > limit) out.push(`[VƯỢT ${isNotice ? 'notice' : 'toast'} ${n}/${limit}] ${file}:${line} -> ${text.slice(0, 80)}`)
      }
    }
  }
  return out
}

export function COPY_BUDGET_VIOLATIONS(file = 'lib/ui/copy.ts') {
  if (!fs.existsSync(file)) return []
  const src = fs.readFileSync(file, 'utf8')
  const out = []
  const re = /^\s*'?((btn|title|toast|tip|desc)\.[\w.]+)'?\s*:\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/gm
  let m
  while ((m = re.exec(src))) {
    const key = m[1]
    const kind = m[2]
    const text = (m[3] ?? m[4] ?? m[5] ?? '').replace(/\{\w+\}/g, '0')
    const n = countWords(text)
    if (n > LIMITS[kind]) out.push(`[VƯỢT copy ${key} ${n}/${LIMITS[kind]}] ${file} -> ${text.slice(0, 80)}`)
  }
  return out
}
