// copyScan.mjs - Bộ quét chuỗi hiển thị cho kiểm kê chữ và ngân sách chữ (Giai đoạn 4).
// Dùng regex, không phụ thuộc compiler-sfc. Là ước lượng, không phải phân tích cú pháp đầy đủ.
import fs from 'fs'
import path from 'path'

const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

export const CATEGORIES = ['heading', 'button', 'label', 'description', 'script']

export function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, ext, out)
    else if (ext.some((e) => p.endsWith(e))) out.push(p.replace(/\\/g, '/'))
  }
  return out
}

export function countWords(s) {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

function lineOf(src, index) {
  let n = 1
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) n++
  return n
}

function clean(s) {
  return s.replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

// Lấy các chuỗi literal có chữ trong biểu thức ({{ }} hoặc thuộc tính bind).
function literalsIn(expr) {
  const out = []
  const re = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g
  let m
  while ((m = re.exec(expr))) {
    const s = clean((m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' '))
    if (/\p{L}{2,}/u.test(s) && (VI.test(s) || s.split(' ').length >= 2)) out.push(s)
  }
  return out
}

function classify(tag) {
  const t = tag.toLowerCase()
  if (/^h[1-6]$/.test(t)) return 'heading'
  if (t === 'button' || t === 'uibutton') return 'button'
  if (t === 'p') return 'description'
  return 'label'
}

/** Trả về danh sách { cat, text, words, line } cho một file .vue. */
export function scanVue(file) {
  const src = fs.readFileSync(file, 'utf8')
  const items = []
  const tpl = src.match(/<template>([\s\S]*)<\/template>\s*(?:<script|<style|$)/)
  if (tpl) {
    const base = src.indexOf(tpl[1])
    // Lớp thứ hai: nội dung trong <details> do người chơi chủ động mở, không tính vào chữ mặc định.
    const body = tpl[1].replace(/<details[\s\S]*?<\/details>/g, (blk) => blk.replace(/[^\n]/g, ' '))
    // Text node nằm trực tiếp trong thẻ: <tag ...>text</...
    const tagRe = /<([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^<>"'])*)>([^<]*)/g
    let m
    while ((m = tagRe.exec(body))) {
      const [, tag, , inner] = m
      const idx = base + m.index
      const mustaches = [...inner.matchAll(/\{\{([\s\S]*?)\}\}/g)]
      const plain = clean(inner.replace(/\{\{[\s\S]*?\}\}/g, ' '))
      const cat = classify(tag)
      if (/\p{L}{2,}/u.test(plain)) items.push({ cat, text: plain, raw: inner.trim(), line: lineOf(src, idx) })
      for (const mu of mustaches) {
        for (const s of literalsIn(mu[1])) items.push({ cat, text: s, line: lineOf(src, idx) })
      }
    }
    // Thuộc tính tĩnh có chữ hiển thị
    const attrRe = /\s(placeholder|title|aria-label|label|alt)="([^"]{2,})"/g
    while ((m = attrRe.exec(body))) {
      const s = clean(m[2])
      if (/\p{L}{2,}/u.test(s)) items.push({ cat: 'label', text: s, line: lineOf(src, base + m.index) })
    }
    // Thuộc tính bind chứa literal chữ (nhãn, tooltip)
    const bindRe = /\s:(placeholder|title|aria-label|label)="([^"]+)"/g
    while ((m = bindRe.exec(body))) {
      for (const s of literalsIn(m[2])) items.push({ cat: 'label', text: s, line: lineOf(src, base + m.index) })
    }
  }
  const scr = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  if (scr) {
    const base = src.indexOf(scr[1])
    const re = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g
    let m
    while ((m = re.exec(scr[1]))) {
      const s = clean((m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' '))
      if (VI.test(s) && /\p{L}{2,}/u.test(s)) items.push({ cat: 'script', text: s, line: lineOf(src, base + m.index) })
    }
  }
  return items.map((i) => ({ ...i, words: countWords(i.text) }))
}

/** Quét chuỗi tiếng Việt trong file .ts (store, lib/ui). */
export function scanTs(file) {
  const src = fs.readFileSync(file, 'utf8')
  const items = []
  const re = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g
  let m
  while ((m = re.exec(src))) {
    const s = clean((m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' '))
    if (VI.test(s) && /\p{L}{2,}/u.test(s)) items.push({ cat: 'script', text: s, line: lineOf(src, m.index) })
  }
  return items.map((i) => ({ ...i, words: countWords(i.text) }))
}

export function scanAll(root = '.') {
  const files = [
    ...walk(path.join(root, 'components'), ['.vue']),
    ...walk(path.join(root, 'pages'), ['.vue']),
    path.join(root, 'app.vue').replace(/\\/g, '/')
  ].filter((f) => fs.existsSync(f))
  const tsFiles = [
    ...walk(path.join(root, 'stores'), ['.ts']),
    ...walk(path.join(root, 'lib/ui'), ['.ts'])
  ]
  const result = {}
  for (const f of files) result[f] = scanVue(f)
  for (const f of tsFiles) result[f] = scanTs(f)
  return result
}

/** Ngân sách theo loại (số từ tối đa cho một chuỗi). */
export const BUDGET = { button: 3, heading: 3, description: 12, label: 12 }

export function summarize(items) {
  const s = { total: 0, strings: 0 }
  for (const c of CATEGORIES) s[c] = 0
  for (const i of items) {
    s.total += i.words
    s.strings += 1
    s[i.cat] += i.words
  }
  return s
}

export function violations(items) {
  return items.filter((i) => BUDGET[i.cat] !== undefined && i.words > BUDGET[i.cat])
}
