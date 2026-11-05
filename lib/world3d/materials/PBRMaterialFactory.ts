import * as THREE from 'three'

/**
 * PBRMaterialFactory:
 * Procedural generation of photorealistic PBR material sets (baseColor, normalMap, roughnessMap, aoMap)
 * with maximum GPU anisotropic filtering and physical micro-surface properties.
 */
export class PBRMaterialFactory {
  private maxAnisotropy: number
  private textureCache = new Map<string, THREE.CanvasTexture>()
  private materialCache = new Map<string, THREE.MeshStandardMaterial>()

  constructor(maxAnisotropy = 8) {
    this.maxAnisotropy = maxAnisotropy
  }

  public setMaxAnisotropy(anisotropy: number) {
    this.maxAnisotropy = anisotropy
    for (const tex of this.textureCache.values()) {
      tex.anisotropy = this.maxAnisotropy
      tex.needsUpdate = true
    }
  }

  /**
   * Helper to register texture into cache with anisotropy
   */
  private prepareTexture(key: string, canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
    const existing = this.textureCache.get(key)
    if (existing) {
      existing.dispose()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    tex.anisotropy = this.maxAnisotropy
    tex.colorSpace = THREE.SRGBColorSpace
    this.textureCache.set(key, tex)
    return tex
  }

  private prepareLinearTexture(key: string, canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
    const existing = this.textureCache.get(key)
    if (existing) {
      existing.dispose()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    tex.anisotropy = this.maxAnisotropy
    tex.colorSpace = THREE.NoColorSpace
    this.textureCache.set(key, tex)
    return tex
  }

  // ============================================================
  // 1. COURTYARD STONE PAVEMENT (Đá phiến sân chùa cổ kính)
  // ============================================================
  public createStonePavementMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_stone_pavement')
    if (cachedMat) return cachedMat

    const cached = this.textureCache.get('pave_base')
    if (cached) {
      const mat = new THREE.MeshStandardMaterial({
        map: this.textureCache.get('pave_base'),
        normalMap: this.textureCache.get('pave_normal'),
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: this.textureCache.get('pave_roughness'),
        aoMap: this.textureCache.get('pave_ao'),
        aoMapIntensity: 0.95,
        roughness: 0.82,
        metalness: 0.08
      })
      this.materialCache.set('mat_stone_pavement', mat)
      return mat
    }

    const size = 1024
    // 1A. BaseColor Map
    const canvasBase = document.createElement('canvas')
    canvasBase.width = size
    canvasBase.height = size
    const ctxB = canvasBase.getContext('2d')!

    // Aged slate dark charcoal tone
    ctxB.fillStyle = '#1c1f24'
    ctxB.fillRect(0, 0, size, size)

    // Flagstone flag grids (gạch đá xẻ so le)
    const rows = 16
    const cols = 16
    const cellH = size / rows
    const cellW = size / cols

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 0) ? 0 : cellW * 0.5
      for (let c = -1; c <= cols; c++) {
        const x = c * cellW + offsetX
        const y = r * cellH
        // Color variation per tile
        const toneVar = Math.floor((Math.sin(r * 4.3 + c * 7.1) + 1.0) * 12)
        const isMossy = (Math.sin(r * 2.1 + c * 3.7) > 0.55)
        
        ctxB.fillStyle = isMossy 
          ? `rgb(${24 + toneVar}, ${32 + toneVar + 6}, ${24 + toneVar})` 
          : `rgb(${28 + toneVar}, ${30 + toneVar}, ${34 + toneVar})`
        ctxB.fillRect(x + 2, y + 2, cellW - 4, cellH - 4)

        // Subtle stone chiseling / grain noise
        for (let k = 0; k < 18; k++) {
          const nx = x + 4 + Math.random() * (cellW - 8)
          const ny = y + 4 + Math.random() * (cellH - 8)
          ctxB.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'
          ctxB.fillRect(nx, ny, 2 + Math.random() * 4, 1 + Math.random() * 2)
        }
      }
    }

    // Mortar lines (khe vữa rãnh đá)
    ctxB.strokeStyle = '#0e1012'
    ctxB.lineWidth = 4
    for (let r = 0; r <= rows; r++) {
      ctxB.beginPath()
      ctxB.moveTo(0, r * cellH)
      ctxB.lineTo(size, r * cellH)
      ctxB.stroke()
    }

    // 1B. Normal Map (Vector Normal tangents: [128, 128, 255] flat base)
    const canvasNorm = document.createElement('canvas')
    canvasNorm.width = size
    canvasNorm.height = size
    const ctxN = canvasNorm.getContext('2d')!
    ctxN.fillStyle = '#8080ff'
    ctxN.fillRect(0, 0, size, size)

    // Mortar indentation in normal map (bevel edges)
    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 0) ? 0 : cellW * 0.5
      for (let c = -1; c <= cols; c++) {
        const x = c * cellW + offsetX
        const y = r * cellH
        // Top bevel: tilt up -> R=128, G=160
        ctxN.fillStyle = '#80a0ff'
        ctxN.fillRect(x + 2, y + 2, cellW - 4, 3)
        // Bottom bevel: tilt down -> R=128, G=96
        ctxN.fillStyle = '#8060ff'
        ctxN.fillRect(x + 2, y + cellH - 5, cellW - 4, 3)
        // Left bevel: tilt left -> R=96, G=128
        ctxN.fillStyle = '#6080ff'
        ctxN.fillRect(x + 2, y + 2, 3, cellH - 4)
        // Right bevel: tilt right -> R=160, G=128
        ctxN.fillStyle = '#a080ff'
        ctxN.fillRect(x + cellW - 5, y + 2, 3, cellH - 4)
      }
    }

    // 1C. Roughness Map (White = matte/rough, Dark = smooth/glossy)
    const canvasRough = document.createElement('canvas')
    canvasRough.width = size
    canvasRough.height = size
    const ctxR = canvasRough.getContext('2d')!
    ctxR.fillStyle = '#b8b8b8'
    ctxR.fillRect(0, 0, size, size)
    // Mortar is rougher
    ctxR.fillStyle = '#e5e5e5'
    for (let r = 0; r <= rows; r++) {
      ctxR.fillRect(0, r * cellH - 2, size, 4)
    }

    // 1D. Ambient Occlusion Map (Crevices are dark)
    const canvasAO = document.createElement('canvas')
    canvasAO.width = size
    canvasAO.height = size
    const ctxAO = canvasAO.getContext('2d')!
    ctxAO.fillStyle = '#ffffff'
    ctxAO.fillRect(0, 0, size, size)
    ctxAO.fillStyle = '#3a3a3a'
    for (let r = 0; r <= rows; r++) {
      ctxAO.fillRect(0, r * cellH - 2, size, 4)
    }

    const baseTex = this.prepareTexture('pave_base', canvasBase, 6, 6)
    const normTex = this.prepareLinearTexture('pave_normal', canvasNorm, 6, 6)
    const roughTex = this.prepareLinearTexture('pave_roughness', canvasRough, 6, 6)
    const aoTex = this.prepareLinearTexture('pave_ao', canvasAO, 6, 6)

    const mat = new THREE.MeshStandardMaterial({
      map: baseTex,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: roughTex,
      aoMap: aoTex,
      aoMapIntensity: 0.95,
      roughness: 0.82,
      metalness: 0.08
    })
    this.materialCache.set('mat_stone_pavement', mat)
    return mat
  }

  // ============================================================
  // 2. AGED GRANITE STEPS (Bậc thềm đá hoa cương cổ)
  // ============================================================
  public createGraniteStepMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_granite_step')
    if (cachedMat) return cachedMat

    const size = 512
    const canvasBase = document.createElement('canvas')
    canvasBase.width = size
    canvasBase.height = size
    const ctx = canvasBase.getContext('2d')!

    ctx.fillStyle = '#363940'
    ctx.fillRect(0, 0, size, size)

    // Granite salt-and-pepper flecks
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const lum = Math.random()
      ctx.fillStyle = lum > 0.65 ? 'rgba(230, 230, 235, 0.35)' : lum < 0.25 ? 'rgba(15, 18, 22, 0.5)' : 'rgba(80, 85, 92, 0.25)'
      ctx.fillRect(x, y, 1.5 + Math.random() * 2, 1.5 + Math.random() * 2)
    }

    const baseTex = this.prepareTexture('granite_base', canvasBase, 4, 2)
    const mat = new THREE.MeshStandardMaterial({
      map: baseTex,
      roughness: 0.86,
      metalness: 0.1
    })
    this.materialCache.set('mat_granite_step', mat)
    return mat
  }

  // ============================================================
  // 3. AGED IRONWOOD / TEAK (Gỗ Lim già đánh bóng dầu trẩu)
  // ============================================================
  public createIronwoodMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_ironwood')
    if (cachedMat) return cachedMat

    const size = 512
    const canvasBase = document.createElement('canvas')
    canvasBase.width = size
    canvasBase.height = size
    const ctx = canvasBase.getContext('2d')!

    // Deep red-brown ironwood core
    ctx.fillStyle = '#26140d'
    ctx.fillRect(0, 0, size, size)

    // Grain fibers running along vertical axis
    for (let x = 0; x < size; x += 3) {
      const varTone = Math.sin(x * 0.12) * 10
      ctx.fillStyle = `rgb(${38 + varTone}, ${20 + varTone * 0.5}, ${13 + varTone * 0.3})`
      ctx.fillRect(x, 0, 2, size)
    }

    // Subtle dark grain growth rings
    ctx.strokeStyle = '#180a06'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 12; i++) {
      const rx = i * 42 + 10
      ctx.beginPath()
      ctx.moveTo(rx, 0)
      ctx.bezierCurveTo(rx + 8, size * 0.3, rx - 8, size * 0.7, rx, size)
      ctx.stroke()
    }

    // Normal map for subtle wood ridge tactile relief
    const canvasNorm = document.createElement('canvas')
    canvasNorm.width = size
    canvasNorm.height = size
    const ctxN = canvasNorm.getContext('2d')!
    ctxN.fillStyle = '#8080ff'
    ctxN.fillRect(0, 0, size, size)

    for (let x = 0; x < size; x += 12) {
      ctxN.fillStyle = '#9580ff'
      ctxN.fillRect(x, 0, 2, size)
      ctxN.fillStyle = '#6b80ff'
      ctxN.fillRect(x + 2, 0, 2, size)
    }

    const baseTex = this.prepareTexture('wood_base', canvasBase, 2, 4)
    const normTex = this.prepareLinearTexture('wood_normal', canvasNorm, 2, 4)

    const mat = new THREE.MeshStandardMaterial({
      map: baseTex,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.62,
      metalness: 0.12
    })
    this.materialCache.set('mat_ironwood', mat)
    return mat
  }

  // ============================================================
  // 4. WEATHERED YIN-YANG TERRACOTTA ROOF TILES (Ngói âm dương cổ tự)
  // ============================================================
  public createYinYangRoofMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_yinyang_roof')
    if (cachedMat) return cachedMat

    const size = 512
    const canvasBase = document.createElement('canvas')
    canvasBase.width = size
    canvasBase.height = size
    const ctx = canvasBase.getContext('2d')!

    ctx.fillStyle = '#2d1418'
    ctx.fillRect(0, 0, size, size)

    // Terracotta curved tile ridge courses
    const tileH = 24
    for (let y = 0; y < size; y += tileH) {
      const shade = y % (tileH * 2) === 0 ? '#38181d' : '#250f13'
      ctx.fillStyle = shade
      ctx.fillRect(0, y, size, tileH - 3)

      // Concave curvature shadow
      ctx.fillStyle = 'rgba(10, 4, 6, 0.45)'
      ctx.fillRect(0, y + tileH - 4, size, 4)

      // Tile overlap edge
      ctx.fillStyle = 'rgba(255, 180, 160, 0.12)'
      ctx.fillRect(0, y, size, 2)
    }

    // Normal map for rounded tile cylindrical curve
    const canvasNorm = document.createElement('canvas')
    canvasNorm.width = size
    canvasNorm.height = size
    const ctxN = canvasNorm.getContext('2d')!
    ctxN.fillStyle = '#8080ff'
    ctxN.fillRect(0, 0, size, size)

    for (let y = 0; y < size; y += tileH) {
      // Top half curve tilts upward (G > 128)
      ctxN.fillStyle = '#80b5ff'
      ctxN.fillRect(0, y, size, tileH * 0.4)
      // Bottom half curve tilts downward (G < 128)
      ctxN.fillStyle = '#804aff'
      ctxN.fillRect(0, y + tileH * 0.5, size, tileH * 0.4)
    }

    const baseTex = this.prepareTexture('roof_base', canvasBase, 4, 4)
    const normTex = this.prepareLinearTexture('roof_normal', canvasNorm, 4, 4)

    const mat = new THREE.MeshStandardMaterial({
      map: baseTex,
      normalMap: normTex,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.76,
      metalness: 0.05
    })
    this.materialCache.set('mat_yinyang_roof', mat)
    return mat
  }

  // ============================================================
  // 5. ANTIQUE CAST BRONZE (Đồng thau cổ / Đại hồng chung & Lư hương)
  // ============================================================
  public createAntiqueBronzeMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_antique_bronze')
    if (cachedMat) return cachedMat

    const size = 256
    const canvasBase = document.createElement('canvas')
    canvasBase.width = size
    canvasBase.height = size
    const ctx = canvasBase.getContext('2d')!

    // Warm deep bronze
    ctx.fillStyle = '#7a5426'
    ctx.fillRect(0, 0, size, size)

    // Subtle green patina flecks in crevices
    for (let i = 0; i < 350; i++) {
      ctx.fillStyle = Math.random() > 0.6 ? 'rgba(75, 120, 95, 0.28)' : 'rgba(30, 20, 8, 0.35)'
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3)
    }

    const baseTex = this.prepareTexture('bronze_base', canvasBase, 2, 2)
    const mat = new THREE.MeshStandardMaterial({
      map: baseTex,
      roughness: 0.36,
      metalness: 0.82
    })
    this.materialCache.set('mat_antique_bronze', mat)
    return mat
  }

  // ============================================================
  // 6. SACRED GOLD LEAF (Vàng lá thếp Tam Bảo / Kim thân Phật)
  // ============================================================
  public createSacredGoldLeafMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_sacred_gold')
    if (cachedMat) return cachedMat

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf5d061,
      roughness: 0.22,
      metalness: 0.9,
      emissive: 0x5a3f0d,
      emissiveIntensity: 0.22
    })
    this.materialCache.set('mat_sacred_gold', mat)
    return mat
  }

  // ============================================================
  // 7. MULTI-LAYER MOSSY EARTH (Đất rêu phong tự nhiên ngoài sân)
  // ============================================================
  public createMossyEarthMaterial(): THREE.MeshStandardMaterial {
    const cachedMat = this.materialCache.get('mat_mossy_earth')
    if (cachedMat) return cachedMat

    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Dark forest mulch earth base
    ctx.fillStyle = '#1c2217'
    ctx.fillRect(0, 0, size, size)

    // Moss patches & loam variation
    for (let y = 0; y < size; y += 32) {
      for (let x = 0; x < size; x += 32) {
        const val = Math.sin(x * 0.05) + Math.cos(y * 0.05)
        if (val > 0.4) {
          ctx.fillStyle = 'rgba(42, 60, 30, 0.65)'
          ctx.beginPath()
          ctx.arc(x + 16, y + 16, 18, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const baseTex = this.prepareTexture('earth_base', canvas, 8, 8)
    const mat = new THREE.MeshStandardMaterial({
      map: baseTex,
      roughness: 0.96,
      metalness: 0.02
    })
    this.materialCache.set('mat_mossy_earth', mat)
    return mat
  }

  public dispose() {
    for (const mat of this.materialCache.values()) {
      mat.dispose()
    }
    this.materialCache.clear()

    for (const tex of this.textureCache.values()) {
      tex.dispose()
    }
    this.textureCache.clear()
  }
}

