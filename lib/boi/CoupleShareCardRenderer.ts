/**
 * Bộ kết xuất Ảnh Thẻ Bài Song Duyên (PNG Canvas 2D) — Đài Tơ Duyên Nguyệt Lão
 * Khổ dọc chuẩn 1080 x 1920 (Mobile Story / Instagram / Facebook / TikTok)
 */

export interface CoupleShareCardRenderOptions {
  appName?: string
  receiptHash?: string
  selfName?: string
  partnerName?: string
  selfCanChi?: string
  partnerCanChi?: string
  score?: number
  rankTitle?: string
  relationLabel?: string
  summary?: string
  poemText?: string
  adviceText?: string
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const normalized = String(text || '').normalize('NFC')
  const paragraphs = normalized.split('\n')
  const lines: string[] = []

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) {
      lines.push('')
      continue
    }
    const words = trimmed.split(/\s+/).filter(Boolean)
    let currentLine = words[0] || ''
    for (let i = 1; i < words.length; i++) {
      const testLine = `${currentLine} ${words[i]}`
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine
      } else {
        lines.push(currentLine)
        currentLine = words[i]!
      }
    }
    lines.push(currentLine)
  }
  return lines
}

export async function renderCoupleShareCardPng(
  options: CoupleShareCardRenderOptions
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Tính năng xuất ảnh chỉ khả dụng trên trình duyệt.')
  }

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {}
  }

  const width = 1080
  const height = 1920

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D Context')
  }

  // 1. NỀN GRADIENT SẮC ĐỎ TƠ HỒNG & HOÀNG TRIỀU
  const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.4, 80, width * 0.5, height * 0.5, 950)
  bgGrad.addColorStop(0, '#2c0d15')
  bgGrad.addColorStop(0.5, '#17080c')
  bgGrad.addColorStop(1, '#0b0406')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // 2. KHUNG VIỀN ĐÔI VÀNG KIM THẮT GÚT ĐỒNG TÂM
  ctx.save()
  ctx.strokeStyle = '#fcd535'
  ctx.lineWidth = 6
  ctx.strokeRect(40, 40, width - 80, height - 80)

  ctx.strokeStyle = '#b33939'
  ctx.lineWidth = 2
  ctx.strokeRect(52, 52, width - 104, height - 104)

  // 4 góc hoa văn đồng tâm
  const cornerSize = 40
  const corners = [
    [40, 40],
    [width - 40, 40],
    [40, height - 40],
    [width - 40, height - 40]
  ]
  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = '#fcd535'
    ctx.beginPath()
    ctx.arc(cx, cy, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b33939'
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()

  // 3. TIÊU ĐỀ TRÊN CÙNG
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fcd535'
  ctx.font = 'bold 36px "Cinzel", "Noto Serif", "Times New Roman", serif'
  ctx.fillText('VẠN CẢNH CHÙA · VẠN CẢNH THIỀN TỰ', width * 0.5, 120)

  ctx.fillStyle = '#ff758c'
  ctx.font = 'bold 48px "Noto Serif", serif'
  ctx.fillText('ĐÀI TƠ DUYÊN NGUYỆT LÃO', width * 0.5, 185)

  ctx.fillStyle = '#fbc531'
  ctx.font = 'italic 26px "Noto Serif", serif'
  ctx.fillText('Nguyệt Lão Thắt Chỉ Hồng · Duyên Khởi Trăm Năm', width * 0.5, 230)

  // Dải phân cách hoa văn
  ctx.strokeStyle = '#fcd535'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(240, 260)
  ctx.lineTo(840, 260)
  ctx.stroke()

  // 4. KHỐI TÊN ĐÔI LỨA (2 BẢN MỆNH)
  const selfName = options.selfName || 'Bản Thân'
  const partnerName = options.partnerName || 'Người Thương'

  // Card Trái (Bản thân)
  ctx.fillStyle = 'rgba(40, 16, 24, 0.85)'
  ctx.strokeStyle = '#e84118'
  ctx.lineWidth = 2
  ctx.roundRect(100, 300, 380, 170, 16)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px "Noto Serif", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(selfName, 290, 365)

  ctx.fillStyle = '#fcd535'
  ctx.font = '26px "Noto Serif", sans-serif'
  ctx.fillText(options.selfCanChi || 'Bản Mệnh', 290, 420)

  // Biểu tượng sợi chỉ hồng nối giữa
  ctx.fillStyle = '#ff4757'
  ctx.font = 'bold 50px sans-serif'
  ctx.fillText('❤', width * 0.5, 395)

  // Card Phải (Người thương)
  ctx.fillStyle = 'rgba(40, 16, 24, 0.85)'
  ctx.strokeStyle = '#e84118'
  ctx.lineWidth = 2
  ctx.roundRect(600, 300, 380, 170, 16)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px "Noto Serif", sans-serif'
  ctx.fillText(partnerName, 790, 365)

  ctx.fillStyle = '#fcd535'
  ctx.font = '26px "Noto Serif", sans-serif'
  ctx.fillText(options.partnerCanChi || 'Bản Mệnh', 790, 420)

  // 5. KHỐI ĐIỂM TƯƠNG HỢP & DANH VỊ DUYÊN SỐ
  const score = options.score || 88
  const rank = options.rankTitle || 'Tri Kỷ Tương Phùng'

  // Vòng hào quang tròn
  ctx.save()
  const ringGrad = ctx.createLinearGradient(width * 0.5 - 130, 520, width * 0.5 + 130, 780)
  ringGrad.addColorStop(0, '#fcd535')
  ringGrad.addColorStop(0.5, '#e84118')
  ringGrad.addColorStop(1, '#ff758c')
  ctx.strokeStyle = ringGrad
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(width * 0.5, 620, 110, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 78px "Roboto Mono", "DIN", monospace'
  ctx.fillText(`${score}%`, width * 0.5, 635)

  ctx.fillStyle = '#fcd535'
  ctx.font = 'bold 24px "Noto Serif", sans-serif'
  ctx.fillText('ĐIỂM TƯƠNG HỢP', width * 0.5, 680)
  ctx.restore()

  // Danh vị duyên số (Huy hiệu)
  ctx.fillStyle = '#e84118'
  ctx.roundRect(width * 0.5 - 240, 760, 480, 68, 34)
  ctx.fill()
  ctx.strokeStyle = '#fcd535'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px "Noto Serif", serif'
  ctx.fillText(rank, width * 0.5, 808)

  // Nhãn quan hệ ngũ hành
  if (options.relationLabel || options.summary) {
    ctx.fillStyle = '#fbc531'
    ctx.font = 'italic 26px "Noto Serif", serif'
    ctx.fillText(options.summary || options.relationLabel || '', width * 0.5, 875)
  }

  // 6. KHỐI THƠ NGUYỆT LÃO 4 CÂU
  ctx.fillStyle = 'rgba(25, 10, 15, 0.92)'
  ctx.strokeStyle = '#fcd535'
  ctx.lineWidth = 2
  ctx.roundRect(100, 930, 880, 360, 20)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#fcd535'
  ctx.font = 'bold 28px "Noto Serif", serif'
  ctx.fillText('📜 THƠ TƠ DUYÊN THIÊNG LIÊNG', width * 0.5, 985)

  const defaultPoem = `Tơ hồng Nguyệt Lão khéo se dây,\nLoan phượng song phi giữa tầng mây,\nHai chữ đồng tâm bền tạc đá,\nTrăm năm hạnh phúc trọn sum vầy.`
  const poem = options.poemText || defaultPoem
  const poemLines = poem.split('\n')

  ctx.fillStyle = '#f5f6fa'
  ctx.font = 'italic 32px "Noto Serif", "Georgia", serif'
  let curY = 1045
  for (const line of poemLines) {
    ctx.fillText(line.trim(), width * 0.5, curY)
    curY += 52
  }

  // 7. KHỐI LỜI KHUYÊN DUNG HÒA ĐÔI LỨA
  ctx.fillStyle = 'rgba(25, 10, 15, 0.92)'
  ctx.strokeStyle = '#38ada9'
  ctx.lineWidth = 2
  ctx.roundRect(100, 1330, 880, 290, 20)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#38ada9'
  ctx.font = 'bold 28px "Noto Serif", serif'
  ctx.fillText('🪷 LỜI KHUYÊN DUNG HÒA CHÁNH NIỆM', width * 0.5, 1385)

  const defaultAdvice =
    'Hai bạn hãy cùng nhau nuôi dưỡng lòng thấu hiểu và bao dung. Khi gặp điều bất đồng, hãy ngồi lại hít thở sâu, cùng lắng nghe bằng trái tim để chuyển hóa vướng mắc thành duyên lành bền vững.'
  const advice = options.adviceText || defaultAdvice
  const adviceLines = wrapText(ctx, advice, 800)

  ctx.fillStyle = '#dcdde1'
  ctx.font = '28px "Noto Serif", sans-serif'
  let advY = 1445
  for (const l of adviceLines) {
    ctx.fillText(l, width * 0.5, advY)
    advY += 46
  }

  // 8. DẤU TRIỆN ĐỎ CHU SA "NGUYỆT LÃO THẮT CHỈ HỒNG"
  ctx.save()
  ctx.translate(860, 1720)
  ctx.strokeStyle = '#e84118'
  ctx.lineWidth = 4
  ctx.strokeRect(-55, -55, 110, 110)
  ctx.fillStyle = '#e84118'
  ctx.font = 'bold 22px "Noto Serif", serif'
  ctx.fillText('NGUYỆT LÃO', 0, -15)
  ctx.fillText('KẾT DUYÊN', 0, 18)
  ctx.restore()

  // 9. CHÂN TRANG & MÃ KIỂM CHỨNG
  ctx.fillStyle = '#718093'
  ctx.font = '22px "Roboto Mono", monospace'
  ctx.fillText(`Mã chứng nhận: ${options.receiptHash || 'MC_LOVE_NOTARY_2026'}`, 480, 1725)

  ctx.fillStyle = '#dcdde1'
  ctx.font = 'italic 24px "Noto Serif", serif'
  ctx.fillText('Nguyện chúc đôi lứa thuận hòa, trăm năm gắn kết, an lạc tròn đầy.', 480, 1765)

  return canvas.toDataURL('image/png')
}

