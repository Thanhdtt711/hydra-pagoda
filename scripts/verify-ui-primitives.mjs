import fs from 'fs'
import path from 'path'

function getFiles(dir, ext = '.vue') {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach(file => {
    file = path.join(dir, file)
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file, ext))
    } else if (file.endsWith(ext)) {
      results.push(file.replace(/\\/g, '/'))
    }
  })
  return results
}

const vueFiles = [
  ...getFiles('components', '.vue'),
  ...getFiles('pages', '.vue'),
  'assets/css/tokens.css',
  'assets/css/main.css'
]

const bannedPattern = /[✦✧◎◈☯☸✓✕×▶▼★●○→⚙⚠ℹ]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]/u
const smallFontPattern = /\bfont-size:\s*(?:[0-9]|10|11)px\b|text-\[(?:[0-9]|10|11)px\]/i

let hasError = false
for (const file of vueFiles) {
  if (!fs.existsSync(file)) {
    console.log('Missing:', file)
    hasError = true
    continue
  }
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    // Skip comments or ZenIcon internal definitions if any
    if (bannedPattern.test(line)) {
      console.log(`[BANNED SYMBOL] ${file}:${idx + 1} -> ${line.trim()}`)
      hasError = true
    }
    if (smallFontPattern.test(line)) {
      console.log(`[FONT < 12px] ${file}:${idx + 1} -> ${line.trim()}`)
      hasError = true
    }
  })
}

if (!hasError) {
  console.log(`ALL CHECKS PASSED: Scanned ${vueFiles.length} files. 0 banned symbols, 0 fonts < 12px.`)
} else {
  process.exit(1)
}
