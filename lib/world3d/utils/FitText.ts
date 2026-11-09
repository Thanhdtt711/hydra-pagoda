// FitText.ts - Đo và co chữ vừa khung cho mọi texture canvas (nameplate, bong bóng chat, biển).
// Dùng chung để tên dài / có dấu tiếng Việt không bao giờ bị tràn hoặc cắt cụt giữa chữ.

export interface FitTextOptions {
    /** Độ rộng tối đa cho phép (px canvas). */
    maxWidth: number
    /** Cỡ chữ lớn nhất (px). */
    maxPx: number
    /** Cỡ chữ nhỏ nhất (px). Dưới mức này sẽ cắt bằng dấu ba chấm. */
    minPx: number
    /** Mẫu font, `{px}` sẽ được thay bằng cỡ chữ. Ví dụ: `600 {px}px sans-serif`. */
    font: string
}

/** Cắt chuỗi theo độ rộng đo thực tế, thêm dấu ba chấm; dùng Array.from để không cắt đôi ký tự. */
export function ellipsizeToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text
    const chars = Array.from(text)
    let lo = 0
    let hi = chars.length
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (ctx.measureText(chars.slice(0, mid).join('') + '…').width <= maxWidth) lo = mid
        else hi = mid - 1
    }
    return chars.slice(0, lo).join('').trimEnd() + '…'
}

/**
 * Đặt `ctx.font` về cỡ lớn nhất còn vừa `maxWidth` (không nhỏ hơn `minPx`),
 * trả về chuỗi sẵn sàng vẽ (đã cắt bằng dấu ba chấm nếu chạm cỡ nhỏ nhất vẫn dài).
 */
export function fitText(ctx: CanvasRenderingContext2D, text: string, opts: FitTextOptions): string {
    const clean = (text || '').normalize('NFC').replace(/\s+/g, ' ').trim()
    const setFont = (px: number) => {
        ctx.font = opts.font.replace('{px}', String(px))
    }
    let px = opts.maxPx
    setFont(px)
    while (px > opts.minPx && ctx.measureText(clean).width > opts.maxWidth) {
        px -= 1
        setFont(px)
    }
    return ellipsizeToWidth(ctx, clean, opts.maxWidth)
}
