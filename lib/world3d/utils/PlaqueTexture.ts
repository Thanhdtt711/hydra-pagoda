import * as THREE from 'three'

export interface PlaqueTextureOptions {
    text: string
    /** Màu nền biển */
    background: string
    /** Màu viền và chữ */
    border: string
    textColor: string
    /** Kích thước canvas (px). Tỷ lệ nên khớp tỷ lệ mặt phẳng để chữ không bị méo. */
    width?: number
    height?: number
    /** Cỡ chữ tối đa (px), chữ tự co nếu dài hơn khung */
    maxFontSize?: number
    /** Lề trong giữa viền và chữ (px) */
    padding?: number
    /** Số khung viền */
    borderWidth?: number
    /** Dùng để kiểm soát anisotropy */
    maxAnisotropy?: number
}

/**
 * Tạo CanvasTexture cho biển hoành phi:
 * - Đo chiều rộng chữ bằng measureText rồi co cỡ chữ để luôn nằm trọn trong khung (không bao giờ bị cắt).
 * - Canvas độ phân giải cao + mipmap + anisotropy để chữ sắc nét khi nhìn từ xa / góc xiên.
 */
export function createPlaqueTexture(opts: PlaqueTextureOptions): THREE.CanvasTexture {
    const W = opts.width ?? 1024
    const H = opts.height ?? 256
    const pad = opts.padding ?? Math.round(H * 0.16)
    const bw = opts.borderWidth ?? Math.max(6, Math.round(H * 0.04))

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (ctx) {
        ctx.fillStyle = opts.background
        ctx.fillRect(0, 0, W, H)

        // Viền ngoài đậm + viền trong mảnh cho cảm giác khung biển
        ctx.strokeStyle = opts.border
        ctx.lineWidth = bw
        ctx.strokeRect(bw, bw, W - bw * 2, H - bw * 2)
        ctx.lineWidth = Math.max(2, Math.round(bw * 0.35))
        ctx.strokeRect(bw * 2.2, bw * 2.2, W - bw * 4.4, H - bw * 4.4)

        const family = '"Noto Serif", "Times New Roman", serif'
        const maxW = W - (pad + bw * 2) * 2
        let size = opts.maxFontSize ?? Math.round(H * 0.5)
        ctx.font = `bold ${size}px ${family}`
        const measured = ctx.measureText(opts.text).width
        if (measured > maxW) {
            size = Math.floor(size * (maxW / measured))
            ctx.font = `bold ${size}px ${family}`
        }

        ctx.fillStyle = opts.textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // Đổ bóng nhẹ cho chữ nổi trên nền
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = Math.round(size * 0.06)
        ctx.shadowOffsetY = Math.round(size * 0.03)
        ctx.fillText(opts.text, W / 2, H / 2 + size * 0.04)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = opts.maxAnisotropy ?? 8
    tex.needsUpdate = true
    return tex
}
