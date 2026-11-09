/**
 * Bộ kết xuất Ảnh Thẻ Quẻ Cầu An (PNG Canvas 2D) — Chuẩn Sắc Phong Hoàng Triều (Hướng A)
 *
 * Khổ dọc chuẩn:
 * - Chiều rộng cố định: 1080px
 * - Chiều cao tự co giãn theo nội dung: tối thiểu 1920px (tỷ lệ 9:16 mobile story), tối đa 3200px
 * - Bố cục: Viền đôi hoàng gia, con dấu chu sa, đầy đủ 100% các khối như trên game
 * - Hỗ trợ công tắc ẩn ngày sinh chi tiết bảo vệ quyền riêng tư
 * - Khắc phục triệt để lỗi font tiếng Việt (chuẩn NFC), lỗi tràn viền, đè chữ hồ sơ
 */

export interface ShareCardRenderOptions {
  userName?: string
  appName?: string
  receiptHash?: string
  hideExactBirthDate?: boolean
  profile?: any
  partnerProfile?: any
}

function toTitleCase(raw: string | undefined | null): string {
  if (!raw) return ''
  return String(raw)
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function formatDisplayDate(raw: string | undefined | null): string {
  if (!raw) return 'Chưa rõ'
  const trimmed = String(raw).trim()
  const comp = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (comp) {
    return `${comp[3]!.padStart(2, '0')}/${comp[2]!.padStart(2, '0')}/${comp[1]}`
  }
  return trimmed
}

function wrapTextNfc(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

function getMucBadgeColors(muc?: string): { border: string; bg: string; text: string; label: string } {
  switch (muc) {
    case 'dai_cat':
      return { border: '#FCD535', bg: 'rgba(252, 213, 53, 0.22)', text: '#FCD535', label: 'ĐẠI CÁT' }
    case 'cat':
      return { border: '#0ECB81', bg: 'rgba(14, 203, 129, 0.22)', text: '#0ECB81', label: 'CÁT' }
    case 'binh':
      return { border: '#60A5FA', bg: 'rgba(96, 165, 250, 0.22)', text: '#93C5FD', label: 'BÌNH' }
    case 'hung':
      return { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.22)', text: '#FBBF24', label: 'HUNG' }
    case 'dai_hung':
      return { border: '#F6465D', bg: 'rgba(246, 70, 93, 0.28)', text: '#F87171', label: 'ĐẠI HUNG' }
    default:
      return { border: '#C9A24B', bg: 'rgba(201, 162, 75, 0.22)', text: '#F3E7C8', label: 'BÌNH' }
  }
}

export async function renderFortuneShareCardPng(
  fortuneResult: Record<string, any>,
  options: ShareCardRenderOptions = {}
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Tính năng xuất ảnh chỉ khả dụng trên trình duyệt.')
  }

  // Đợi toàn bộ font chữ của trình duyệt nạp xong trước khi vẽ canvas
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {}
  }

  const width = 1080
  const marginX = 64
  const contentWidth = width - marginX * 2 // 952px
  const innerPadding = 36
  const boxWidth = contentWidth - innerPadding * 2 // 880px
  const textSafeWidth = boxWidth - 80 // 800px (luôn chừa 40px lề mỗi bên chống tràn chữ)

  // 1. Trích xuất dữ liệu Bát Tự đầy đủ từ fortuneResult.metaphysics và profile
  const meta = fortuneResult.metaphysics || {}
  const rawProfile = options.profile || fortuneResult.profile || {}
  const rawPartner = options.partnerProfile || fortuneResult.partnerProfile

  const displayName = toTitleCase(rawProfile.fullName || fortuneResult.userName || 'Khách Thập Phương')
  const gender = rawProfile.gender || fortuneResult.gender || 'nam'
  const genderLabel = gender === 'nu' ? 'Nữ Mệnh' : 'Nam Mệnh'

  const rawBirth = rawProfile.birthDate || fortuneResult.birthDate || ''
  const displayBirthDate = formatDisplayDate(rawBirth)
  const tuoiMuVal = rawProfile.tuoiMu || meta.ageLunar || fortuneResult.ageLunar || ''

  const canChiNam = rawProfile.canChiNam || meta.canChiNam || fortuneResult.canChiNam || ''
  const napAmName = rawProfile.napAmName || meta.napAmName || fortuneResult.napAmName || ''
  const nguHanhMenh = rawProfile.nguHanhMenh || meta.nguHanhMenh || fortuneResult.nguHanhMenh || ''
  const menhDisplay = napAmName ? `${napAmName}${nguHanhMenh ? ` (${nguHanhMenh})` : ''}` : (nguHanhMenh || 'Chưa rõ')

  const cungPhi = rawProfile.cungPhi || meta.cungPhi || fortuneResult.cungPhi || ''
  const cungPhiHanh = rawProfile.cungPhiHanh || meta.cungPhiHanh || fortuneResult.cungPhiHanh || ''
  const cungPhiDisplay = cungPhi ? `${cungPhi}${cungPhiHanh ? ` (${cungPhiHanh})` : ''}` : 'Chưa rõ'

  const gioStr = rawProfile.birthHourLabel || (rawProfile.canChiGio ? `Giờ ${rawProfile.canChiGio}` : (rawProfile.birthHour ? `Giờ ${rawProfile.birthHour}` : 'Không rõ giờ sinh'))
  const saoName = rawProfile.saoChieuMenh?.name || meta.cuuDieuStar?.name || ''
  const saoHanh = rawProfile.saoChieuMenh?.element || meta.cuuDieuStar?.element || ''
  const saoDisplay = saoName ? `Sao ${saoName}${saoHanh ? ` (${saoHanh})` : ''}` : 'Bình thường'

  const lunarDateStr = rawProfile.lunarDateStr || (canChiNam ? `Năm ${canChiNam} (Âm lịch)` : 'Chưa rõ')

  const birthDateLabel = options.hideExactBirthDate ? 'Sinh năm:' : 'Sinh nhật:'
  const birthDateField = options.hideExactBirthDate
    ? `${canChiNam || 'Âm lịch'} (${tuoiMuVal ? `${tuoiMuVal} tuổi mụ` : ''})`
    : `${displayBirthDate} (Dương lịch)`

  const grounds: string[] = Array.isArray(fortuneResult.grounds) ? fortuneResult.grounds : []
  const poemText = String(fortuneResult.blocks?.tho?.text || fortuneResult.poem || '').normalize('NFC')
  const luanGiaiText = String(fortuneResult.blocks?.luangiai?.text || fortuneResult.meaning || '').normalize('NFC')
  const loiKhuyenText = String(fortuneResult.blocks?.loikhuyen?.text || fortuneResult.advice || '').normalize('NFC')
  const hoaGiaiText = String(fortuneResult.blocks?.hoagiai?.text || fortuneResult.remediationText || '').normalize('NFC')

  const wealthText = String(fortuneResult.aspects?.wealth || fortuneResult.wealth || '').normalize('NFC')
  const loveText = String(fortuneResult.aspects?.love || fortuneResult.love || '').normalize('NFC')
  const healthText = String(fortuneResult.aspects?.health || fortuneResult.health || '').normalize('NFC')
  const careerText = String(fortuneResult.aspects?.career || fortuneResult.career || '').normalize('NFC')

  // Canvas ảo đo đạc chính xác
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = width
  measureCanvas.height = 100
  const mctx = measureCanvas.getContext('2d')!

  // Font stacks hỗ trợ tiếng Việt chuẩn
  const FONT_SERIF_TITLE = '"Playfair Display", "Cinzel", "Noto Serif", Georgia, serif'
  const FONT_POEM = 'italic 25px "Noto Serif", "Times New Roman", Georgia, serif'
  const FONT_BODY = '21px "Noto Serif", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const FONT_LABEL = 'bold 18px "Noto Serif", -apple-system, sans-serif'
  const FONT_HEADING = 'bold 22px "Playfair Display", "Noto Serif", serif'

  // Ước lượng chiều cao các khối
  const headerH = 150
  const isCouple = Boolean(rawPartner?.fullName && fortuneResult.mon === 'to_duyen')
  const profileH = isCouple ? 310 : 230

  // Chiều cao khối Thơ
  mctx.font = FONT_POEM
  const poemLines = wrapTextNfc(mctx, poemText, textSafeWidth)
  const poemBoxH = Math.max(120, poemLines.length * 42 + 54)

  // Chiều cao khối Căn cứ Bát Tự
  mctx.font = FONT_BODY
  let groundsLinesCount = 0
  const parsedGroundLines: string[] = []
  for (const g of grounds) {
    const wrapped = wrapTextNfc(mctx, `• ${g}`, textSafeWidth)
    groundsLinesCount += wrapped.length
    parsedGroundLines.push(...wrapped)
  }
  const groundsBoxH = grounds.length > 0 ? groundsLinesCount * 32 + 76 : 0

  // Chiều cao Luận giải
  mctx.font = FONT_BODY
  const lgLines = wrapTextNfc(mctx, luanGiaiText, textSafeWidth)
  const lgBoxH = lgLines.length * 34 + 80

  // Chiều cao 4 Phương diện (2 cột x 2 dòng)
  mctx.font = '19px "Noto Serif", sans-serif'
  const aspectTextWidth = (boxWidth - 40) / 2 - 36
  const maxWLines = Math.max(
    wrapTextNfc(mctx, wealthText, aspectTextWidth).length,
    wrapTextNfc(mctx, loveText, aspectTextWidth).length
  )
  const maxHLines = Math.max(
    wrapTextNfc(mctx, healthText, aspectTextWidth).length,
    wrapTextNfc(mctx, careerText, aspectTextWidth).length
  )
  const row1H = maxWLines * 28 + 66
  const row2H = maxHLines * 28 + 66
  const aspectsBoxH = row1H + row2H + 18

  // Chiều cao Lời khuyên
  mctx.font = FONT_BODY
  const lkLines = wrapTextNfc(mctx, loiKhuyenText, textSafeWidth)
  const lkBoxH = lkLines.length * 34 + 80

  // Chiều cao Hóa giải (nếu quẻ Hung/Đại Hung)
  let hgBoxH = 0
  let hgLines: string[] = []
  if (hoaGiaiText && (fortuneResult.muc === 'hung' || fortuneResult.muc === 'dai_hung')) {
    hgLines = wrapTextNfc(mctx, hoaGiaiText, textSafeWidth)
    hgBoxH = hgLines.length * 34 + 84
  }

  const titleCardH = 154
  const footerH = 140

  // Tổng chiều cao tự co giãn
  const rawTotalHeight =
    marginX * 2 +
    innerPadding * 2 +
    headerH + 24 +
    profileH + 24 +
    titleCardH + 24 +
    poemBoxH + 24 +
    (groundsBoxH > 0 ? groundsBoxH + 24 : 0) +
    lgBoxH + 24 +
    aspectsBoxH + 24 +
    lkBoxH + 24 +
    (hgBoxH > 0 ? hgBoxH + 24 : 0) +
    footerH

  const height = Math.max(1920, Math.min(3200, Math.ceil(rawTotalHeight)))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Không thể khởi tạo ngữ cảnh vẽ Canvas 2D.')
  }

  // ==================== 1. NỀN SẮC PHONG HOÀNG TRIỀU ====================
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
  bgGrad.addColorStop(0, '#420B0E')   // Đỏ son trầm hoàng triều
  bgGrad.addColorStop(0.5, '#280608') // Đỏ sẫm trung tâm
  bgGrad.addColorStop(1, '#150304')   // Đáy sẫm trang nghiêm
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // Họa tiết gấm chìm
  ctx.fillStyle = 'rgba(201, 162, 75, 0.025)'
  for (let i = 0; i < width; i += 60) {
    for (let j = 0; j < height; j += 60) {
      if ((i + j) % 120 === 0) {
        ctx.fillRect(i, j, 30, 30)
      }
    }
  }

  // ==================== 2. VIỀN ĐÔI HOÀNG GIA & GÓC HỒI VĂN ====================
  const outerLeft = marginX
  const outerTop = marginX
  const outerW = width - marginX * 2
  const outerH = height - marginX * 2

  // Viền ngoài 4px
  ctx.strokeStyle = '#C9A24B'
  ctx.lineWidth = 4
  ctx.strokeRect(outerLeft, outerTop, outerW, outerH)

  // Viền trong 1.5px
  const innerOffset = 12
  ctx.strokeStyle = '#C9A24B'
  ctx.lineWidth = 1.5
  ctx.strokeRect(outerLeft + innerOffset, outerTop + innerOffset, outerW - innerOffset * 2, outerH - innerOffset * 2)

  // 4 Góc Hồi Văn
  const drawCorner = (x: number, y: number, flipX: number, flipY: number) => {
    ctx.strokeStyle = '#C9A24B'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x + 24 * flipX, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + 24 * flipY)
    ctx.stroke()
  }
  drawCorner(outerLeft + 6, outerTop + 6, 1, 1)
  drawCorner(outerLeft + outerW - 6, outerTop + 6, -1, 1)
  drawCorner(outerLeft + 6, outerTop + outerH - 6, 1, -1)
  drawCorner(outerLeft + outerW - 6, outerTop + outerH - 6, -1, -1)

  let curY = outerTop + innerOffset + innerPadding
  const drawLeft = outerLeft + innerOffset + innerPadding

  // ==================== 3. HÀNG TIÊU ĐỀ HOÀNG TRIỀU + CON DẤU CHU SA ====================
  ctx.textAlign = 'center'
  ctx.fillStyle = '#C9A24B'
  ctx.font = 'bold 24px "Cinzel", "Playfair Display", serif'
  ctx.letterSpacing = '3px'
  ctx.fillText('VẠN CẢNH THIỀN TỰ', width / 2, curY + 28)

  ctx.fillStyle = '#F3E7C8'
  ctx.font = '900 44px "Playfair Display", "Cinzel", serif'
  ctx.letterSpacing = '1px'
  ctx.fillText('SẮC QUẺ CHIÊM BÁI', width / 2, curY + 78)

  ctx.fillStyle = '#E2D1A8'
  ctx.font = '20px "Noto Serif", serif'
  ctx.letterSpacing = '0px'
  const subTitleStr = `${fortuneResult.monName || 'Xin Xăm Bát Quái'} · ${fortuneResult.matchedTagLabel || 'Tổng Quan'} · ${fortuneResult.dateStr || ''}`.normalize('NFC')
  ctx.fillText(subTitleStr, width / 2, curY + 114)

  // Con Dấu Chu Sa VẠN CẢNH THIỀN TỰ
  const sealX = outerLeft + outerW - innerOffset - innerPadding - 90
  const sealY = curY + 10
  ctx.save()
  ctx.translate(sealX + 42, sealY + 42)
  ctx.rotate(-0.04)
  ctx.strokeStyle = '#B3261E'
  ctx.lineWidth = 3.5
  ctx.strokeRect(-42, -42, 84, 84)
  ctx.fillStyle = 'rgba(179, 38, 30, 0.12)'
  ctx.fillRect(-42, -42, 84, 84)
  ctx.fillStyle = '#B3261E'
  ctx.font = '900 15px "Noto Serif", serif'
  ctx.textAlign = 'center'
  ctx.fillText('VẠN CẢNH', 0, -8)
  ctx.fillText('THIỀN TỰ', 0, 18)
  ctx.restore()

  curY += headerH + 16

  // Đường gạch ngang phân cách
  ctx.strokeStyle = 'rgba(201, 162, 75, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(drawLeft, curY)
  ctx.lineTo(drawLeft + boxWidth, curY)
  ctx.stroke()
  curY += 24

  // ==================== 4. KHỐI HỒ SƠ NGƯỜI XEM QUẺ (CỘT RÕ RÀNG, KHÔNG ĐÈ CHỮ) ====================
  ctx.fillStyle = 'rgba(20, 10, 12, 0.45)'
  ctx.fillRect(drawLeft, curY, boxWidth, profileH)
  ctx.strokeStyle = '#C9A24B'
  ctx.lineWidth = 1.5
  ctx.strokeRect(drawLeft, curY, boxWidth, profileH)

  // Tên người xem quẻ (Title Case chuẩn)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#F3E7C8'
  ctx.font = '900 36px "Playfair Display", "Noto Serif", serif'
  ctx.fillText(displayName, drawLeft + 24, curY + 44)

  const badgeStr = `${genderLabel}${tuoiMuVal ? ` · ${tuoiMuVal} Tuổi Mụ` : ''}`
  ctx.textAlign = 'right'
  ctx.fillStyle = '#C9A24B'
  ctx.font = 'bold 20px "Noto Serif", serif'
  ctx.fillText(badgeStr, drawLeft + boxWidth - 24, curY + 42)

  // Đường phân cách trong thẻ
  ctx.strokeStyle = 'rgba(201, 162, 75, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(drawLeft + 24, curY + 58)
  ctx.lineTo(drawLeft + boxWidth - 24, curY + 58)
  ctx.stroke()

  // Bảng 2 cột thông tin Bát Tự
  const col1X = drawLeft + 24
  const col2X = drawLeft + boxWidth / 2 + 10
  const labelW = 120 // Chừa 120px cho nhãn, giá trị bắt đầu từ x + 120 không bao giờ đè
  let py = curY + 92

  const drawProfileRow = (colX: number, y: number, label: string, val: string) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#C9A24B'
    ctx.font = FONT_LABEL
    ctx.fillText(label, colX, y)

    ctx.fillStyle = '#F3E7C8'
    ctx.font = FONT_BODY
    ctx.fillText(String(val).normalize('NFC'), colX + labelW, y)
  }

  // Cột 1
  drawProfileRow(col1X, py, birthDateLabel, birthDateField)
  drawProfileRow(col1X, py + 38, 'Bản mệnh:', menhDisplay)
  drawProfileRow(col1X, py + 76, 'Giờ sinh:', gioStr)

  // Cột 2
  drawProfileRow(col2X, py, 'Âm lịch:', lunarDateStr)
  drawProfileRow(col2X, py + 38, 'Cung phi:', cungPhiDisplay)
  drawProfileRow(col2X, py + 76, 'Niên vận:', saoDisplay)

  if (isCouple) {
    const ppy = py + 122
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.35)'
    ctx.beginPath()
    ctx.moveTo(drawLeft + 24, ppy - 16)
    ctx.lineTo(drawLeft + boxWidth - 24, ppy - 16)
    ctx.stroke()

    drawProfileRow(col1X, ppy, 'Người thương:', `${toTitleCase(rawPartner.fullName)} (${rawPartner.gender === 'nu' ? 'Nữ' : 'Nam'})`)
    drawProfileRow(col2X, ppy, 'Sinh nhật:', options.hideExactBirthDate ? 'Đã ẩn ngày sinh' : formatDisplayDate(rawPartner.birthDate))
  }

  curY += profileH + 24

  // ==================== 5. QUẺ & MỨC QUẺ (TIÊU ĐỀ TỰ CO GIÃN CHỐNG TRÀN VIỀN) ====================
  ctx.fillStyle = 'rgba(201, 162, 75, 0.08)'
  ctx.fillRect(drawLeft, curY, boxWidth, titleCardH)
  ctx.strokeStyle = '#C9A24B'
  ctx.lineWidth = 2
  ctx.strokeRect(drawLeft, curY, boxWidth, titleCardH)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#C9A24B'
  ctx.font = 'bold 22px "Noto Serif", serif'
  const subCategoryName = fortuneResult.monName || 'Xin Xăm Bát Quái'
  ctx.fillText(`${subCategoryName} · VẬN KHÍ CHIÊM BÁI`, width / 2, curY + 34)

  // Đo đạc và tự động co nhỏ font nếu tiêu đề quẻ dài để không bao giờ tràn viền
  const titleStr = String(fortuneResult.title || 'Thẻ Quẻ Cầu An').normalize('NFC')
  let titleFontSize = 38
  ctx.font = `900 ${titleFontSize}px ${FONT_SERIF_TITLE}`
  while (ctx.measureText(titleStr).width > boxWidth - 60 && titleFontSize > 22) {
    titleFontSize -= 2
    ctx.font = `900 ${titleFontSize}px ${FONT_SERIF_TITLE}`
  }
  ctx.fillStyle = '#F3E7C8'
  ctx.fillText(titleStr, width / 2, curY + 84)

  // Huy hiệu Mức Quẻ
  const mucMeta = getMucBadgeColors(fortuneResult.muc)
  const pillW = 260
  const pillH = 38
  const pillX = (width - pillW) / 2
  const pillY = curY + 102

  ctx.fillStyle = mucMeta.bg
  ctx.fillRect(pillX, pillY, pillW, pillH)
  ctx.strokeStyle = mucMeta.border
  ctx.lineWidth = 2
  ctx.strokeRect(pillX, pillY, pillW, pillH)

  ctx.fillStyle = mucMeta.text
  ctx.font = '900 22px "Noto Serif", serif'
  ctx.letterSpacing = '2px'
  ctx.fillText(`MỨC: ${mucMeta.label}`, width / 2, pillY + 27)
  ctx.letterSpacing = '0px'

  curY += titleCardH + 24

  // ==================== 6. KHỐI 1: CÂU SẤM / BÀI THƠ ====================
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(drawLeft, curY, boxWidth, poemBoxH)
  ctx.strokeStyle = 'rgba(201, 162, 75, 0.6)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(drawLeft, curY, boxWidth, poemBoxH)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#F3E7C8'
  ctx.font = FONT_POEM
  let poemY = curY + 44
  for (const pl of poemLines) {
    ctx.fillText(pl, width / 2, poemY)
    poemY += 42
  }
  curY += poemBoxH + 24

  // ==================== 7. BẢNG CĂN CỨ BÁT TỰ & NGŨ HÀNH (KHÔNG TRÀN CHỮ) ====================
  if (groundsBoxH > 0) {
    ctx.fillStyle = 'rgba(201, 162, 75, 0.05)'
    ctx.fillRect(drawLeft, curY, boxWidth, groundsBoxH)
    ctx.strokeStyle = '#C9A24B'
    ctx.lineWidth = 1.5
    ctx.strokeRect(drawLeft, curY, boxWidth, groundsBoxH)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#C9A24B'
    ctx.font = FONT_HEADING
    ctx.fillText('CĂN CỨ DỊCH LÝ & NGŨ HÀNH BÁT TỰ', drawLeft + 24, curY + 36)

    ctx.strokeStyle = 'rgba(201, 162, 75, 0.4)'
    ctx.beginPath()
    ctx.moveTo(drawLeft + 24, curY + 48)
    ctx.lineTo(drawLeft + boxWidth - 24, curY + 48)
    ctx.stroke()

    ctx.font = FONT_BODY
    let gy = curY + 78
    for (const line of parsedGroundLines) {
      if (line.includes('[Thuận]') || line.includes('[Thuận Bù]')) {
        ctx.fillStyle = '#8BE3B2'
      } else if (line.includes('[Nghịch]')) {
        ctx.fillStyle = '#F89B9B'
      } else {
        ctx.fillStyle = '#F3E7C8'
      }
      ctx.fillText(line, drawLeft + 24, gy)
      gy += 32
    }
    curY += groundsBoxH + 24
  }

  // ==================== 8. KHỐI 2: LUẬN GIẢI CHỦ ĐỀ ====================
  ctx.fillStyle = 'rgba(20, 10, 12, 0.35)'
  ctx.fillRect(drawLeft, curY, boxWidth, lgBoxH)
  ctx.strokeStyle = '#C9A24B'
  ctx.lineWidth = 1.2
  ctx.strokeRect(drawLeft, curY, boxWidth, lgBoxH)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#C9A24B'
  ctx.font = FONT_HEADING
  const lgTagLabel = String(fortuneResult.matchedTagLabel || 'TỔNG QUAN').toUpperCase().normalize('NFC')
  ctx.fillText(`LUẬN GIẢI CHỦ ĐỀ (${lgTagLabel})`, drawLeft + 24, curY + 36)

  ctx.strokeStyle = 'rgba(201, 162, 75, 0.4)'
  ctx.beginPath()
  ctx.moveTo(drawLeft + 24, curY + 48)
  ctx.lineTo(drawLeft + boxWidth - 24, curY + 48)
  ctx.stroke()

  ctx.fillStyle = '#F3E7C8'
  ctx.font = FONT_BODY
  let lgy = curY + 80
  for (const line of lgLines) {
    ctx.fillText(line, drawLeft + 24, lgy)
    lgy += 34
  }
  curY += lgBoxH + 24

  // ==================== 9. KHỐI 4 PHƯƠNG DIỆN (TIỀN TÀI, DUYÊN TÌNH, SỨC KHỎE, SỰ NGHIỆP) ====================
  const colHalfW = (boxWidth - 18) / 2
  const rightColX = drawLeft + colHalfW + 18

  const drawAspectCard = (title: string, bodyText: string, x: number, y: number, cardH: number) => {
    ctx.fillStyle = 'rgba(201, 162, 75, 0.06)'
    ctx.fillRect(x, y, colHalfW, cardH)
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.5)'
    ctx.lineWidth = 1.2
    ctx.strokeRect(x, y, colHalfW, cardH)

    ctx.fillStyle = '#C9A24B'
    ctx.font = FONT_HEADING
    ctx.fillText(title, x + 18, y + 28)

    ctx.fillStyle = '#F3E7C8'
    ctx.font = '19px "Noto Serif", -apple-system, sans-serif'
    const wrapped = wrapTextNfc(mctx, bodyText, colHalfW - 36)
    let ay = y + 56
    for (const l of wrapped) {
      ctx.fillText(l, x + 18, ay)
      ay += 28
    }
  }

  // Dòng 1: Tiền tài & Duyên tình
  drawAspectCard('Tiền tài & Lộc pháp', wealthText, drawLeft, curY, row1H)
  drawAspectCard('Duyên tình & Gia đạo', loveText, rightColX, curY, row1H)

  // Dòng 2: Sức khỏe & Sự nghiệp
  const row2Y = curY + row1H + 18
  drawAspectCard('Sức khỏe & Thân tâm', healthText, drawLeft, row2Y, row2H)
  drawAspectCard('Sự nghiệp & Công danh', careerText, rightColX, row2Y, row2H)

  curY += aspectsBoxH + 24

  // ==================== 10. KHỐI 3: LỜI KHUYÊN HÀNH TRÌ ====================
  ctx.fillStyle = 'rgba(20, 10, 12, 0.35)'
  ctx.fillRect(drawLeft, curY, boxWidth, lkBoxH)
  ctx.strokeStyle = '#C9A24B'
  ctx.lineWidth = 1.2
  ctx.strokeRect(drawLeft, curY, boxWidth, lkBoxH)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#C9A24B'
  ctx.font = FONT_HEADING
  ctx.fillText('LỜI KHUYÊN HÀNH TRÌ & CHÁNH NIỆM', drawLeft + 24, curY + 36)

  ctx.strokeStyle = 'rgba(201, 162, 75, 0.4)'
  ctx.beginPath()
  ctx.moveTo(drawLeft + 24, curY + 48)
  ctx.lineTo(drawLeft + boxWidth - 24, curY + 48)
  ctx.stroke()

  ctx.fillStyle = '#F3E7C8'
  ctx.font = FONT_BODY
  let lky = curY + 80
  for (const line of lkLines) {
    ctx.fillText(line, drawLeft + 24, lky)
    lky += 34
  }
  curY += lkBoxH + 24

  // ==================== 11. KHỐI 4: PHÁP HÓA GIẢI (NẾU HUNG / ĐẠI HUNG) ====================
  if (hgBoxH > 0) {
    ctx.fillStyle = 'rgba(179, 38, 30, 0.15)'
    ctx.fillRect(drawLeft, curY, boxWidth, hgBoxH)
    ctx.strokeStyle = '#B3261E'
    ctx.lineWidth = 1.5
    ctx.strokeRect(drawLeft, curY, boxWidth, hgBoxH)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#F89B9B'
    ctx.font = FONT_HEADING
    ctx.fillText('PHÁP HÓA GIẢI VẬN HẠN & TỌA THIỀN 432HZ', drawLeft + 24, curY + 36)

    ctx.strokeStyle = 'rgba(179, 38, 30, 0.5)'
    ctx.beginPath()
    ctx.moveTo(drawLeft + 24, curY + 48)
    ctx.lineTo(drawLeft + boxWidth - 24, curY + 48)
    ctx.stroke()

    ctx.fillStyle = '#F3E7C8'
    ctx.font = FONT_BODY
    let hgy = curY + 80
    for (const line of hgLines) {
      ctx.fillText(line, drawLeft + 24, hgy)
      hgy += 34
    }
    curY += hgBoxH + 24
  }

  // ==================== 12. CHÂN TRANG HOÀNG TRIỀU & DISCLAIMER ====================
  const footY = height - marginX - innerOffset - innerPadding - 70

  ctx.strokeStyle = 'rgba(201, 162, 75, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(drawLeft, footY)
  ctx.lineTo(drawLeft + boxWidth, footY)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#E2D1A8'
  ctx.font = '19px "Noto Serif", serif'
  const receiptStr = options.receiptHash || fortuneResult.receiptHash || 'VCT_CARDANO_HYDRA_L2'
  const seedNum = fortuneResult.seed ? `#${fortuneResult.seed}` : 'NOTARY'
  ctx.fillText(`Mã biên nhận: ${receiptStr} · Mã Seed: ${seedNum}`, width / 2, footY + 34)

  ctx.fillStyle = '#C9A24B'
  ctx.font = 'italic 18px "Noto Serif", serif'
  ctx.fillText(
    'Chỉ mang tính giải trí — Triết lý di sản văn hóa dân gian & hướng dẫn chánh niệm.',
    width / 2,
    footY + 64
  )

  return canvas.toDataURL('image/png')
}
