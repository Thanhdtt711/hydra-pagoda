import * as THREE from 'three'

export interface PlaqueTextureOptions {
    text: string
    /** Màu nền biển (gốc sơn mài) */
    background: string
    /** Màu viền và chữ */
    border: string
    textColor: string
    /** Kích thước canvas (px). Tỷ lệ nên khớp tỷ lệ mặt phẳng để chữ không bị méo. */
    width?: number
    height?: number
    /** Hệ số nhân độ phân giải nội bộ (mặc định 2 để siêu nét ở mọi góc nhìn) */
    resolutionScale?: number
    /** Cỡ chữ tối đa (px theo kích thước logic), chữ tự co nếu dài hơn khung */
    maxFontSize?: number
    /** Lề trong giữa viền và chữ (px theo kích thước logic) */
    padding?: number
    /** Độ dày viền ngoài (px theo kích thước logic) */
    borderWidth?: number
    /** Dùng để kiểm soát anisotropy */
    maxAnisotropy?: number
}

function adjustHexColor(hex: string, amount: number): string {
    const clean = hex.replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex
    const num = parseInt(clean, 16)
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
    return `rgb(${r}, ${g}, ${b})`
}

/**
 * Vẽ khung sơn mài & vàng thếp (có nền gradient chiều sâu, viền vàng ánh kim 2 lớp và họa tiết góc hồi văn).
 */
export function drawLacquerPlaqueFrame(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    background: string,
    border: string,
    bw: number
): void {
    // 1. Nền sơn mài có chiều sâu (sáng nhẹ ở giữa trên, trầm xuống ở cạnh)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, adjustHexColor(background, 10))
    bgGrad.addColorStop(0.45, background)
    bgGrad.addColorStop(1, adjustHexColor(background, -12))
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // Ánh lụa nhẹ ở tâm bảng giúp chữ nổi khối
    const radial = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.1, W * 0.5, H * 0.5, W * 0.58)
    radial.addColorStop(0, 'rgba(255, 226, 150, 0.07)')
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.28)')
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, W, H)

    // 2. Viền vàng thếp ánh kim
    const goldGrad = ctx.createLinearGradient(0, 0, W, H)
    goldGrad.addColorStop(0, '#f7df94')
    goldGrad.addColorStop(0.28, border)
    goldGrad.addColorStop(0.5, '#fae6a2')
    goldGrad.addColorStop(0.75, adjustHexColor(border, -28))
    goldGrad.addColorStop(1, '#f3d47d')

    const outerPad = bw * 0.9
    ctx.strokeStyle = goldGrad
    ctx.lineWidth = bw
    ctx.strokeRect(outerPad, outerPad, W - outerPad * 2, H - outerPad * 2)

    const innerPad = bw * 2.15
    const innerLw = Math.max(2, Math.round(bw * 0.34))
    ctx.lineWidth = innerLw
    ctx.strokeStyle = 'rgba(246, 207, 116, 0.72)'
    ctx.strokeRect(innerPad, innerPad, W - innerPad * 2, H - innerPad * 2)

    // 3. Họa tiết góc chữ Triện (Hồi văn cổ) ở 4 góc
    const cornerSize = Math.max(18, Math.round(H * 0.14))
    const cOff = innerPad + innerLw * 0.5
    ctx.strokeStyle = goldGrad
    ctx.lineWidth = Math.max(2, Math.round(bw * 0.42))

    const drawCorner = (cx: number, cy: number, sx: number, sy: number) => {
        ctx.beginPath()
        ctx.moveTo(cx + sx * cornerSize, cy)
        ctx.lineTo(cx + sx * cornerSize, cy + sy * (cornerSize * 0.48))
        ctx.lineTo(cx + sx * (cornerSize * 0.48), cy + sy * (cornerSize * 0.48))
        ctx.lineTo(cx + sx * (cornerSize * 0.48), cy + sy * cornerSize)
        ctx.lineTo(cx, cy + sy * cornerSize)
        ctx.stroke()

        // Điểm nhấn hạt vàng nhỏ ở góc
        ctx.fillStyle = '#fae6a2'
        ctx.fillRect(
            cx + sx * (cornerSize * 0.2) - innerLw * 0.5,
            cy + sy * (cornerSize * 0.2) - innerLw * 0.5,
            innerLw,
            innerLw
        )
    }

    drawCorner(cOff, cOff, 1, 1)
    drawCorner(W - cOff, cOff, -1, 1)
    drawCorner(cOff, H - cOff, 1, -1)
    drawCorner(W - cOff, H - cOff, -1, -1)
}

/**
 * Tạo CanvasTexture cho biển hoành phi & bảng tên trạm:
 * - Siêu lấy mẫu 2x + mipmap + anisotropy 16 giúp chữ sắc nét ở mọi góc nhìn.
 * - Tự động co chữ theo chiều rộng để không bao giờ bị cắt.
 */
export function createPlaqueTexture(opts: PlaqueTextureOptions): THREE.CanvasTexture {
    const scale = opts.resolutionScale ?? 2
    const baseW = opts.width ?? 1024
    const baseH = opts.height ?? 256
    const W = Math.round(baseW * scale)
    const H = Math.round(baseH * scale)
    const pad = (opts.padding ?? Math.round(baseH * 0.16)) * scale
    const bw = (opts.borderWidth ?? Math.max(6, Math.round(baseH * 0.04))) * scale

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (ctx) {
        drawLacquerPlaqueFrame(ctx, W, H, opts.background, opts.border, bw)

        const family = '"Be Vietnam Pro", "IBM Plex Sans", "Segoe UI", system-ui, sans-serif'
        const maxW = W - (pad + bw * 2.4) * 2
        let size = (opts.maxFontSize ?? Math.round(baseH * 0.48)) * scale
        ctx.font = `800 ${size}px ${family}`
        if ('letterSpacing' in ctx) {
            ;(ctx as any).letterSpacing = `${Math.max(1, Math.round(size * 0.04))}px`
        }
        const measured = ctx.measureText(opts.text).width
        if (measured > maxW && measured > 0) {
            size = Math.floor(size * (maxW / measured))
            ctx.font = `800 ${size}px ${family}`
            if ('letterSpacing' in ctx) {
                ;(ctx as any).letterSpacing = `${Math.max(1, Math.round(size * 0.03))}px`
            }
        }

        // Vàng thếp gradient trên từng dòng chữ
        const textGrad = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.78)
        textGrad.addColorStop(0, '#fff4cc')
        textGrad.addColorStop(0.5, opts.textColor)
        textGrad.addColorStop(1, adjustHexColor(opts.textColor, -26))

        ctx.fillStyle = textGrad
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
        ctx.shadowBlur = Math.round(size * 0.08)
        ctx.shadowOffsetY = Math.round(size * 0.04)
        ctx.fillText(opts.text, W / 2, H / 2 + size * 0.03)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = opts.maxAnisotropy ?? 16
    tex.needsUpdate = true
    return tex
}

/**
 * Tạo CanvasTexture cho Câu Đối dọc (gắn trên cột cổng Tam Quan hoặc cột điện thờ).
 * Mỗi từ/âm tiết xếp dọc từ trên xuống dưới theo lối câu đối Việt cổ.
 */
export function createVerticalCoupletTexture(
    words: string[],
    opts?: {
        background?: string
        border?: string
        textColor?: string
        width?: number
        height?: number
        referenceWords?: string[]
    }
): THREE.CanvasTexture {
    const scale = 2
    const baseW = opts?.width ?? 192
    const baseH = opts?.height ?? 640
    const W = baseW * scale
    const H = baseH * scale
    const bw = 7 * scale
    const bg = opts?.background ?? '#6e1a16'
    const border = opts?.border ?? '#e0b04a'
    const textColor = opts?.textColor ?? '#f6cf74'

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (ctx) {
        drawLacquerPlaqueFrame(ctx, W, H, bg, border, bw)

        const count = Math.max(1, words.length)
        const topPad = H * 0.13
        const usableH = H - topPad * 2
        const stepY = usableH / count
        const family = '"Be Vietnam Pro", "IBM Plex Sans", "Segoe UI", system-ui, sans-serif'
        const maxWordW = W * 0.72

        // Tính 1 cỡ chữ đồng nhất theo từ dài nhất để không bị chữ to chữ nhỏ hay bóp ngang
        let fontSize = Math.min(Math.round(W * 0.30), Math.round(stepY * 0.52))
        const allWords = opts?.referenceWords?.length ? opts.referenceWords : words
        ctx.font = `800 ${fontSize}px ${family}`
        let widest = 0
        for (const w of allWords) {
            widest = Math.max(widest, ctx.measureText(w).width)
        }
        if (widest > maxWordW && widest > 0) {
            fontSize = Math.floor(fontSize * (maxWordW / widest))
        }

        ctx.font = `800 ${fontSize}px ${family}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
        ctx.shadowBlur = Math.round(fontSize * 0.1)
        ctx.shadowOffsetY = Math.round(fontSize * 0.04)

        words.forEach((word, idx) => {
            const cy = topPad + stepY * (idx + 0.5)
            const textGrad = ctx.createLinearGradient(0, cy - fontSize * 0.5, 0, cy + fontSize * 0.5)
            textGrad.addColorStop(0, '#fff4cc')
            textGrad.addColorStop(0.5, textColor)
            textGrad.addColorStop(1, adjustHexColor(textColor, -24))
            ctx.fillStyle = textGrad
            ctx.fillText(word, W / 2, cy)
        })
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 16
    tex.needsUpdate = true
    return tex
}
