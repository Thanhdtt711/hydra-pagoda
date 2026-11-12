// NameplateHelper.ts - 3D Overhead Nameplate & Zen Speech Bubble Sprite Factory
// Follows Vercel Geist Minimalist Design System with High-DPI Canvas Rendering

import * as THREE from 'three'
import { fitText } from './utils/FitText'

const COUNTRY_CODES: Record<string, string> = {
  vietnam: 'VN',
  japan: 'JP',
  thailand: 'TH',
  korea: 'KR',
  taiwan: 'TW',
  singapore: 'SG',
  india: 'IN',
  tibet: 'TB',
  western: 'LM'
}

export interface NameplateOptions {
  variant?: 'pilgrim' | 'npc' | 'verified'
  hideCountry?: boolean
}

export function createPilgrimNameplate(
  name: string,
  title: string,
  country: string,
  options: NameplateOptions = {}
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const W = 640
  const H = 144
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Sprite()

  ctx.clearRect(0, 0, W, H)

  const variant = options.variant ?? 'pilgrim'
  const isNpc = variant === 'npc'
  const showCountry = !options.hideCountry && !isNpc && Boolean(country)
  const cleanName = (name || 'Hành Giả').trim()
  const cleanTitle = (title || '').trim()

  const nameFont = '600 {px}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const titleFont = '500 {px}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  const maxTextW = 450
  const displayName = fitText(ctx, cleanName, { maxWidth: maxTextW, maxPx: 27, minPx: 17, font: nameFont })
  const nameMetricsW = ctx.measureText(displayName).width

  let displayTitle = ''
  let titleMetricsW = 0
  if (cleanTitle) {
    displayTitle = fitText(ctx, cleanTitle, { maxWidth: maxTextW, maxPx: 18, minPx: 13, font: titleFont })
    titleMetricsW = ctx.measureText(displayTitle).width
  }

  const badgeW = showCountry ? 42 : isNpc ? 14 : 0
  const badgeGap = badgeW > 0 ? 12 : 0
  const topRowW = badgeW + badgeGap + nameMetricsW
  const contentW = Math.max(topRowW, titleMetricsW)

  const padX = 28
  const pillW = Math.max(180, Math.min(W - 24, Math.ceil(contentW + padX * 2)))
  const pillH = cleanTitle ? 94 : 62
  const pillX = (W - pillW) / 2
  const pillY = (H - pillH) / 2
  const radius = Math.round(pillH / 2)

  // Nền tối thanh thoát kiểu Binance Dark
  const grad = ctx.createLinearGradient(0, pillY, 0, pillY + pillH)
  grad.addColorStop(0, 'rgba(24, 29, 36, 0.86)')
  grad.addColorStop(1, 'rgba(11, 14, 17, 0.80)')

  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, radius)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.lineWidth = isNpc ? 2 : 1.5
  ctx.strokeStyle = isNpc
    ? 'rgba(201, 162, 75, 0.45)'
    : variant === 'verified'
      ? 'rgba(14, 203, 129, 0.35)'
      : 'rgba(255, 255, 255, 0.16)'
  ctx.stroke()

  const centerX = W / 2
  const topRowStartX = centerX - topRowW / 2
  const topRowY = cleanTitle ? pillY + 32 : pillY + pillH / 2

  if (showCountry) {
    const code = (COUNTRY_CODES[country] || country.slice(0, 2)).toUpperCase()
    const bH = 24
    const bY = topRowY - bH / 2
    ctx.beginPath()
    ctx.roundRect(topRowStartX, bY, badgeW, bH, 7)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '700 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(code, topRowStartX + badgeW / 2, topRowY + 0.5)
  } else if (isNpc) {
    // Chấm vàng nhỏ tinh tế cho Thầy Trụ Trì
    ctx.beginPath()
    ctx.arc(topRowStartX + 6, topRowY, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fcd535'
    ctx.fill()
  }

  // Đổ bóng chữ nhẹ giúp đọc rõ cả trên nền trời sáng lẫn gỗ tối
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1

  ctx.fillStyle = '#f8fafc'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  // Đo lại font chuẩn trước khi vẽ (fitText đã set ctx.font cuối cùng theo displayName)
  fitText(ctx, cleanName, { maxWidth: maxTextW, maxPx: 27, minPx: 17, font: nameFont })
  ctx.fillText(displayName, topRowStartX + badgeW + badgeGap, topRowY)

  if (cleanTitle) {
    ctx.fillStyle = isNpc ? '#fcd535' : '#e2c06b'
    ctx.textAlign = 'center'
    fitText(ctx, cleanTitle, { maxWidth: maxTextW, maxPx: 18, minPx: 13, font: titleFont })
    ctx.fillText(displayTitle, centerX, pillY + 64)
  }
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.36, 0.306, 1.0)
  return sprite
}

export function createSpeechBubbleSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Sprite()

  ctx.clearRect(0, 0, 512, 160)

  const bubbleX = 24
  const bubbleY = 12
  const bubbleW = 464
  const bubbleH = 105
  const radius = 12

  // Bubble Box
  ctx.beginPath()
  ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, radius)
  ctx.fillStyle = 'rgba(17, 17, 17, 0.95)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)' // Golden lotus accent
  ctx.stroke()

  // Small indicator pointer
  ctx.beginPath()
  ctx.moveTo(244, bubbleY + bubbleH)
  ctx.lineTo(256, bubbleY + bubbleH + 16)
  ctx.lineTo(268, bubbleY + bubbleH)
  ctx.closePath()
  ctx.fillStyle = 'rgba(17, 17, 17, 0.95)'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)'
  ctx.stroke()

  // Text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ededed'
  const display = fitText(ctx, text, { maxWidth: bubbleW - 40, maxPx: 24, minPx: 15, font: '500 {px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' })
  ctx.fillText(display, 256, bubbleY + bubbleH / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.8, 0.56, 1.0)
  return sprite
}

