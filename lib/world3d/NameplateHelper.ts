// NameplateHelper.ts - 3D Overhead Nameplate & Zen Speech Bubble Sprite Factory
// Follows Vercel Geist Minimalist Design System with High-DPI Canvas Rendering

import * as THREE from 'three'

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

export function createPilgrimNameplate(name: string, title: string, country: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Sprite()

  ctx.clearRect(0, 0, 512, 128)

  const pillX = 36
  const pillY = 16
  const pillW = 440
  const pillH = 96
  const radius = 12

  // Background container
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, radius)
  ctx.fillStyle = 'rgba(10, 10, 10, 0.88)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.stroke()

  // Country badge
  const code = (COUNTRY_CODES[country] || country.slice(0, 2)).toUpperCase()
  const badgeW = 48
  const badgeH = 28
  const badgeX = pillX + 18
  const badgeY = pillY + (pillH - badgeH) / 2 - 12

  ctx.beginPath()
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 15px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(code, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1)

  // Pilgrim Name
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f5f5f5'
  ctx.font = '600 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const displayName = name.length > 18 ? name.slice(0, 17) + '…' : name
  ctx.fillText(displayName, badgeX + badgeW + 14, badgeY + 14)

  // Pilgrim Spiritual Title
  ctx.fillStyle = '#fbbf24'
  ctx.font = '500 15px monospace'
  const displayTitle = title.length > 22 ? title.slice(0, 21) + '…' : title
  ctx.fillText(displayTitle, badgeX + badgeW + 14, badgeY + 39)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.4, 0.35, 1.0)
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
  ctx.font = '500 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const display = text.length > 34 ? text.slice(0, 33) + '…' : text
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

