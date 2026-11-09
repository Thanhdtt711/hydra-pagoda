/**
 * Kiểm thử Bộ Kết Xuất Ảnh Thẻ Quẻ Chia Sẻ (ShareCardRenderer.ts)
 * 8 Trường hợp kiểm tra toàn diện:
 * 1. Đại Cát
 * 2. Cát
 * 3. Bình
 * 4. Hung (bắt buộc có khối Hóa giải)
 * 5. Đại Hung (bắt buộc có khối Hóa giải)
 * 6. Tơ Duyên (2 hồ sơ song hành)
 * 7. Dâng Sao (sao Cửu Diệu)
 * 8. Ẩn ngày sinh chi tiết (hideExactBirthDate)
 */
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

// Thiết lập Mock document & HTMLCanvasElement trong môi trường Node.js
class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas
    this.font = '10px sans-serif'
    this.fillStyle = '#000000'
    this.strokeStyle = '#000000'
    this.lineWidth = 1
    this.textAlign = 'left'
    this.letterSpacing = '0px'
    this.recordedTexts = []
    this.recordedStrokes = []
    this.recordedRects = []
  }

  measureText(str) {
    // Giả lập độ rộng tương đối của chuỗi text dựa trên font size
    const fontSize = parseInt(this.font.match(/\d+/)?.[0] || '16', 10)
    return { width: String(str).length * (fontSize * 0.58) }
  }

  createLinearGradient() {
    return { addColorStop: () => {} }
  }

  fillRect(x, y, w, h) {
    this.recordedRects.push({ action: 'fill', x, y, w, h, fillStyle: this.fillStyle })
  }

  strokeRect(x, y, w, h) {
    this.recordedRects.push({ action: 'stroke', x, y, w, h, strokeStyle: this.strokeStyle })
  }

  fillText(text, x, y) {
    this.recordedTexts.push({ text: String(text), x, y, font: this.font, fillStyle: this.fillStyle })
  }

  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
}

class MockCanvas {
  constructor() {
    this.width = 1080
    this.height = 1920
    this._ctx = new MockCanvasRenderingContext2D(this)
  }
  getContext(type) {
    if (type === '2d') return this._ctx
    return null
  }
  toDataURL() {
    return `data:image/png;base64,MOCK_PNG_DATA_FOR_${this.width}x${this.height}`
  }
}

let lastCreatedCanvas = null
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      lastCreatedCanvas = new MockCanvas()
      return lastCreatedCanvas
    }
    return {}
  }
}

const { renderFortuneShareCardPng } = await import('../../lib/boi/ShareCardRenderer.ts')
const { generateFortune } = await import('../../lib/boi/FortuneEngine.ts')

console.log('\n======================================================================')
console.log('   BỘ TEST XUẤT ẢNH THẺ QUẺ: SẮC PHONG HOÀNG TRIỀU 1080px (8 TEST CASES)')
console.log('======================================================================\n')

// Dữ liệu mẫu hồ sơ cơ sở (Nam 13/06/2004)
const baseProfile = {
  fullName: 'Nguyễn Văn An',
  birthDate: '13/06/2004',
  birthHour: 'ty',
  gender: 'nam'
}

// 1. Ca 1: Quẻ Đại Cát
{
  const fortune = generateFortune({
    mon: 'xin_xam',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })
  fortune.muc = 'dai_cat' // Ép mức để kiểm thử bộ xuất
  fortune.title = 'Thẻ số 01 · Khai Thiên Đắc Lộc'

  const dataUrl = await renderFortuneShareCardPng(fortune, { profile: baseProfile })
  assert.equal(lastCreatedCanvas.width, 1080, 'Chiều ngang ảnh phải chuẩn 1080px')
  assert.ok(lastCreatedCanvas.height >= 1920, 'Chiều cao ảnh phải tối thiểu 1920px')
  
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('VẠN CẢNH THIỀN TỰ'), 'Ảnh phải có tên tự viện VẠN CẢNH THIỀN TỰ')
  assert.ok(allTexts.includes('SẮC QUẺ CHIÊM BÁI'), 'Ảnh phải có đại tự SẮC QUẺ CHIÊM BÁI')
  assert.ok(allTexts.includes('MỨC: ĐẠI CÁT'), 'Ảnh phải có huy hiệu chuẩn MỨC: ĐẠI CÁT')
  assert.ok(allTexts.includes('Nguyễn Văn An'), 'Ảnh phải có họ tên người xem quẻ')
  assert.ok(allTexts.includes('Tiền tài & Lộc pháp'), 'Ảnh phải có đủ khối Tiền tài')
  assert.ok(allTexts.includes('Duyên tình & Gia đạo'), 'Ảnh phải có đủ khối Duyên tình')
  assert.ok(allTexts.includes('Sức khỏe & Thân tâm'), 'Ảnh phải có đủ khối Sức khỏe')
  assert.ok(allTexts.includes('Sự nghiệp & Công danh'), 'Ảnh phải có đủ khối Sự nghiệp')
  assert.ok(allTexts.includes('Chỉ mang tính giải trí'), 'Ảnh phải có dòng disclaimer bắt buộc')
  console.log(`  ✅ PASS: Ca 1: Quẻ Đại Cát (1080x${lastCreatedCanvas.height}px, đủ 100% các khối)`)
}

// 2. Ca 2: Quẻ Cát (có giải trình Cung phi & yếu tố bù đắp)
{
  const fortune = generateFortune({
    mon: 'xin_xam',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })
  fortune.muc = 'cat'
  fortune.title = 'Thẻ số 12 · Thuận Buồm Xuôi Gió'

  await renderFortuneShareCardPng(fortune, { profile: baseProfile })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('MỨC: CÁT'), 'Ảnh phải có huy hiệu MỨC: CÁT')
  assert.ok(allTexts.includes('CĂN CỨ DỊCH LÝ & NGŨ HÀNH BÁT TỰ'), 'Ảnh phải có bảng căn cứ dịch lý')
  console.log(`  ✅ PASS: Ca 2: Quẻ Cát (1080x${lastCreatedCanvas.height}px, có đầy đủ căn cứ Bát Tự)`)
}

// 3. Ca 3: Quẻ Bình
{
  const fortune = generateFortune({
    mon: 'xin_xam',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })
  fortune.muc = 'binh'
  fortune.title = 'Thẻ số 05 · Tùy Duyên Đắc Lộ'

  await renderFortuneShareCardPng(fortune, { profile: baseProfile })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('MỨC: BÌNH'), 'Ảnh phải có huy hiệu MỨC: BÌNH')
  console.log(`  ✅ PASS: Ca 3: Quẻ Bình (1080x${lastCreatedCanvas.height}px)`)
}

// 4. Ca 4: Quẻ Hung (bắt buộc có Khối Hóa Giải)
{
  const fortune = generateFortune({
    mon: 'xin_xam',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })
  fortune.muc = 'hung'
  fortune.title = 'Thẻ số 17 · Trầm Tâm Định Trí'
  fortune.remediationText = 'Pháp Hóa Giải: Tọa thiền chánh niệm 432Hz 5 phút điều hòa tâm khí.'

  await renderFortuneShareCardPng(fortune, { profile: baseProfile })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('MỨC: HUNG'), 'Ảnh phải có huy hiệu MỨC: HUNG')
  assert.ok(allTexts.includes('PHÁP HÓA GIẢI VẬN HẠN & TỌA THIỀN 432HZ'), 'Quẻ Hung bắt buộc vẽ khối Hóa Giải trên ảnh')
  assert.ok(allTexts.includes('Tọa thiền chánh niệm 432Hz'), 'Khối Hóa Giải phải chứa lời hướng dẫn thiền')
  console.log(`  ✅ PASS: Ca 4: Quẻ Hung (1080x${lastCreatedCanvas.height}px, đã vẽ đủ khối Hóa Giải)`)
}

// 5. Ca 5: Quẻ Đại Hung (bắt buộc có Khối Hóa Giải Đại Hung)
{
  const fortune = generateFortune({
    mon: 'xin_xam',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })
  fortune.muc = 'dai_hung'
  fortune.title = 'Thẻ số 20 · Bĩ Cực Thái Lai'
  fortune.remediationText = 'Pháp Hóa Giải Đại Hung: Tạm dừng đầu tư lớn, thắp nén trầm an định bản tâm.'

  await renderFortuneShareCardPng(fortune, { profile: baseProfile })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('MỨC: ĐẠI HUNG'), 'Ảnh phải có huy hiệu MỨC: ĐẠI HUNG')
  assert.ok(allTexts.includes('PHÁP HÓA GIẢI VẬN HẠN & TỌA THIỀN 432HZ'), 'Quẻ Đại Hung bắt buộc vẽ khối Hóa Giải trên ảnh')
  console.log(`  ✅ PASS: Ca 5: Quẻ Đại Hung (1080x${lastCreatedCanvas.height}px, có khối Hóa Giải Đại Hung)`)
}

// 6. Ca 6: Môn Tơ Duyên (hiển thị hồ sơ 2 người song hành)
{
  const partnerProfile = {
    fullName: 'Trần Thị Mai',
    birthDate: '20/10/2005',
    gender: 'nu'
  }
  const fortune = generateFortune({
    mon: 'to_duyen',
    profile: baseProfile,
    partnerProfile,
    dateStr: '2026-11-06'
  })

  await renderFortuneShareCardPng(fortune, { profile: baseProfile, partnerProfile })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('Nguyễn Văn An'), 'Ảnh phải có tên người gieo')
  assert.ok(allTexts.includes('Trần Thị Mai'), 'Ảnh môn Tơ Duyên phải có tên người thương')
  assert.ok(allTexts.includes('Người thương:'), 'Ảnh phải có mục Người thương')
  console.log(`  ✅ PASS: Ca 6: Tơ Duyên (1080x${lastCreatedCanvas.height}px, đủ hồ sơ 2 người)`)
}

// 7. Ca 7: Môn Dâng Sao (hiển thị sao niên vận Cửu Diệu)
{
  const fortune = generateFortune({
    mon: 'dang_sao',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })

  await renderFortuneShareCardPng(fortune, { profile: baseProfile })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(allTexts.includes('Niên vận:') || allTexts.includes('Sao Thái Dương'), 'Môn Dâng Sao phải hiển thị sao niên vận')
  console.log(`  ✅ PASS: Ca 7: Dâng Sao (1080x${lastCreatedCanvas.height}px, có sao niên vận Cửu Diệu)`)
}

// 8. Ca 8: Bật công tắc Ẩn ngày sinh chi tiết
{
  const fortune = generateFortune({
    mon: 'xin_xam',
    profile: baseProfile,
    dateStr: '2026-11-06'
  })

  await renderFortuneShareCardPng(fortune, {
    profile: baseProfile,
    hideExactBirthDate: true
  })
  const allTexts = lastCreatedCanvas._ctx.recordedTexts.map(t => t.text).join(' | ')
  assert.ok(!allTexts.includes('13/06/2004'), 'Khi bật ẩn ngày sinh thì ngày sinh cụ thể 13/06/2004 không được xuất hiện')
  assert.ok(allTexts.includes('Sinh năm:'), 'Khi bật ẩn ngày sinh thì phải thay bằng thông tin năm âm')
  console.log(`  ✅ PASS: Ca 8: Công tắc Ẩn ngày sinh chi tiết (Bảo vệ quyền riêng tư người chơi)`)
}

console.log('\n======================================================================')
console.log('   KẾT QUẢ KIỂM THỬ XUẤT ẢNH: 8/8 TEST CASES PASS 100%')
console.log('======================================================================\n')
