import * as THREE from 'three'
import type { AvatarExpression } from './AvatarModel'

/**
 * FaceAtlas:
 * Procedural 512x512 Canvas texture atlas with 4 cute chibi facial expressions:
 * - serene (bình thản, mắt mở tròn long lanh)
 * - smile (cười tươi mắt cong ^ ^)
 * - meditating (nhắm mắt thiền định an nhiên)
 * - surprised (ngạc nhiên, mắt to tròn lấp lánh)
 *
 * Switching expression modifies the material UV offset with 0 extra meshes.
 */
export class FaceAtlas {
  private static instance: FaceAtlas | null = null
  public texture: THREE.CanvasTexture

  private constructor() {
    this.texture = this.createAtlasTexture()
  }

  public static getInstance(): FaceAtlas {
    if (!FaceAtlas.instance) {
      FaceAtlas.instance = new FaceAtlas()
    }
    return FaceAtlas.instance
  }

  private createAtlasTexture(): THREE.CanvasTexture {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Clear with fully transparent background
    ctx.clearRect(0, 0, size, size)

    // Grid: 2x2 cells, each 256x256
    // Cell 0,0: serene (top-left) -> UV [0, 0.5] to [0.5, 1.0] in Canvas Y, mapped to Three.js UV
    this.drawExpression(ctx, 0, 0, 256, 'serene')
    // Cell 1,0: smile (top-right)
    this.drawExpression(ctx, 256, 0, 256, 'smile')
    // Cell 0,1: meditating (bottom-left)
    this.drawExpression(ctx, 0, 256, 256, 'meditating')
    // Cell 1,1: surprised (bottom-right)
    this.drawExpression(ctx, 256, 256, 256, 'surprised')

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(0.5, 0.5)
    return tex
  }

  private drawExpression(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    w: number,
    expr: AvatarExpression
  ) {
    const cx = ox + w / 2
    const cy = oy + w / 2

    // 1. Cute Rosy Blush Cheeks (Đôi má hồng đào dễ thương)
    const blushRadius = 26
    const leftBlushX = cx - 58
    const rightBlushX = cx + 58
    const blushY = cy + 22

    const drawBlush = (bx: number) => {
      const grad = ctx.createRadialGradient(bx, blushY, 2, bx, blushY, blushRadius)
      grad.addColorStop(0, 'rgba(255, 110, 140, 0.55)')
      grad.addColorStop(0.6, 'rgba(255, 140, 160, 0.30)')
      grad.addColorStop(1, 'rgba(255, 160, 180, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(bx, blushY, blushRadius, 0, Math.PI * 2)
      ctx.fill()
    }
    drawBlush(leftBlushX)
    drawBlush(rightBlushX)

    // 2. Cute tiny nose (Mũi nhỏ xíu)
    ctx.fillStyle = 'rgba(200, 120, 100, 0.55)'
    ctx.beginPath()
    ctx.arc(cx, cy + 8, 3.5, 0, Math.PI * 2)
    ctx.fill()

    // 3. Eyes, Brows & Mouth based on expression
    ctx.strokeStyle = '#2c1e1a' // Soft warm dark brown for anime lineart
    ctx.fillStyle = '#2c1e1a'
    ctx.lineWidth = 4.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const eyeSpacing = 44
    const eyeY = cy - 8

    if (expr === 'serene') {
      // Mắt to tròn tĩnh lặng, long lanh điểm sáng
      const drawEye = (ex: number) => {
        // Tròng mắt
        ctx.fillStyle = '#2a2228'
        ctx.beginPath()
        ctx.ellipse(ex, eyeY, 15, 20, 0, 0, Math.PI * 2)
        ctx.fill()

        // Highlight lớn
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.ellipse(ex - 4, eyeY - 6, 6, 8, 0, 0, Math.PI * 2)
        ctx.fill()

        // Highlight nhỏ
        ctx.beginPath()
        ctx.arc(ex + 5, eyeY + 6, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      drawEye(cx - eyeSpacing)
      drawEye(cx + eyeSpacing)

      // Lông mày mềm mại
      ctx.beginPath()
      ctx.moveTo(cx - eyeSpacing - 14, eyeY - 26)
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 32, cx - eyeSpacing + 14, eyeY - 28)
      ctx.moveTo(cx + eyeSpacing - 14, eyeY - 28)
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 32, cx + eyeSpacing + 14, eyeY - 26)
      ctx.stroke()

      // Miệng mỉm cười nhẹ an lạc
      ctx.beginPath()
      ctx.arc(cx, cy + 32, 10, 0.2, Math.PI - 0.2)
      ctx.stroke()
    } else if (expr === 'smile') {
      // Mắt cười cong tít hình vầng trăng khuyết (^ ^)
      const drawSmileEye = (ex: number) => {
        ctx.beginPath()
        ctx.arc(ex, eyeY + 4, 16, Math.PI * 1.15, Math.PI * 1.85)
        ctx.stroke()
      }
      drawSmileEye(cx - eyeSpacing)
      drawSmileEye(cx + eyeSpacing)

      // Lông mày vui tươi
      ctx.beginPath()
      ctx.moveTo(cx - eyeSpacing - 12, eyeY - 28)
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 35, cx - eyeSpacing + 14, eyeY - 28)
      ctx.moveTo(cx + eyeSpacing - 14, eyeY - 28)
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 35, cx + eyeSpacing + 12, eyeY - 28)
      ctx.stroke()

      // Miệng cười mở tươi vui
      ctx.fillStyle = '#d94b62'
      ctx.beginPath()
      ctx.arc(cx, cy + 32, 14, 0, Math.PI)
      ctx.fill()
      ctx.stroke()
    } else if (expr === 'meditating') {
      // Mắt nhắm thiền định thanh tịnh, lông mi dài dịu dàng
      const drawMeditateEye = (ex: number) => {
        ctx.beginPath()
        ctx.arc(ex, eyeY - 4, 16, Math.PI * 0.15, Math.PI * 0.85)
        ctx.stroke()

        // Hàng mi cong nhẹ
        ctx.beginPath()
        ctx.moveTo(ex + 12, eyeY + 5)
        ctx.lineTo(ex + 18, eyeY + 2)
        ctx.stroke()
      }
      drawMeditateEye(cx - eyeSpacing)
      drawMeditateEye(cx + eyeSpacing)

      // Lông mày an nhiên
      ctx.beginPath()
      ctx.moveTo(cx - eyeSpacing - 12, eyeY - 25)
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 29, cx - eyeSpacing + 12, eyeY - 25)
      ctx.moveTo(cx + eyeSpacing - 12, eyeY - 25)
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 29, cx + eyeSpacing + 12, eyeY - 25)
      ctx.stroke()

      // Miệng mỉm cười vi tiếu
      ctx.beginPath()
      ctx.arc(cx, cy + 32, 9, 0.3, Math.PI - 0.3)
      ctx.stroke()
    } else if (expr === 'surprised') {
      // Mắt to tròn mở lớn kinh ngạc / ngộ đạo
      const drawSurprisedEye = (ex: number) => {
        ctx.fillStyle = '#221a24'
        ctx.beginPath()
        ctx.ellipse(ex, eyeY, 17, 22, 0, 0, Math.PI * 2)
        ctx.fill()

        // Highlight sao sáng
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(ex - 5, eyeY - 7, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(ex + 5, eyeY + 7, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      drawSurprisedEye(cx - eyeSpacing)
      drawSurprisedEye(cx + eyeSpacing)

      // Lông mày nhướng cao
      ctx.beginPath()
      ctx.moveTo(cx - eyeSpacing - 14, eyeY - 34)
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 40, cx - eyeSpacing + 14, eyeY - 32)
      ctx.moveTo(cx + eyeSpacing - 14, eyeY - 32)
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 40, cx + eyeSpacing + 14, eyeY - 34)
      ctx.stroke()

      // Miệng chữ 'O' nhỏ xinh
      ctx.fillStyle = '#d94b62'
      ctx.beginPath()
      ctx.ellipse(cx, cy + 34, 8, 12, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  /**
   * Áp dụng offset UV cho material biểu cảm
   */
  public applyExpressionOffset(texture: THREE.Texture, expr: AvatarExpression) {
    switch (expr) {
      case 'serene':
        // Top-left: U = 0, V = 0.5 (trong Three.js V = 1 - Y)
        texture.offset.set(0, 0.5)
        break
      case 'smile':
        // Top-right: U = 0.5, V = 0.5
        texture.offset.set(0.5, 0.5)
        break
      case 'meditating':
        // Bottom-left: U = 0, V = 0
        texture.offset.set(0, 0)
        break
      case 'surprised':
        // Bottom-right: U = 0.5, V = 0
        texture.offset.set(0.5, 0)
        break
    }
    texture.needsUpdate = true
  }

  public dispose() {
    this.texture.dispose()
    FaceAtlas.instance = null
  }
}

