import * as THREE from 'three'

type ShellType = 'chrysanthemum' | 'dual_ring' | 'willow' | 'strobe'

interface Rocket {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  primary: THREE.Color
  secondary: THREE.Color
  shellType: ShellType
  age: number
  fuse: number
}

interface Spark {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  r: number
  g: number
  b: number
  age: number
  life: number
  gravity: number
  drag: number
  leaveTrail: boolean
  strobe: boolean
  trailAccum: number
}

interface TrailEmber {
  x: number
  y: number
  z: number
  r: number
  g: number
  b: number
  age: number
  life: number
}

const FESTIVE_PALETTE: THREE.Color[] = [
  new THREE.Color(0xff2e55), // Đỏ ruby rực
  new THREE.Color(0xffd166), // Vàng kim
  new THREE.Color(0x00e5ff), // Xanh lam ngọc
  new THREE.Color(0xff4dff), // Hồng tím sen
  new THREE.Color(0x00f59b), // Lục bảo
  new THREE.Color(0xff7b00), // Cam hổ phách
  new THREE.Color(0xa855f7), // Tím hoàng gia
  new THREE.Color(0xfff5cc)  // Trắng ánh kim
]

const WILLOW_GOLD = FESTIVE_PALETTE[1]!
const WILLOW_AMBER = FESTIVE_PALETTE[5]!
const MAX_PARTICLES = 650

function createGlowTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const half = size / 2
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.28, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.28)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function pickRandomColor(exclude?: THREE.Color): THREE.Color {
  for (let attempt = 0; attempt < 6; attempt++) {
    const col = FESTIVE_PALETTE[Math.floor(Math.random() * FESTIVE_PALETTE.length)] ?? WILLOW_GOLD
    if (!exclude || col !== exclude) return col
  }
  return WILLOW_GOLD
}

function swapPop<T>(arr: T[], index: number) {
  const last = arr.length - 1
  if (index !== last) arr[index] = arr[last]!
  arr.pop()
}

/**
 * Pháo hoa chào mừng ngoài Cổng Tam Quan (z = 33..45, x = -15..15) vào ngày lễ âm lịch.
 * Tối ưu zero-GC (swap-pop, bảng màu dựng sẵn, không dùng PointLight để tránh recompile shader).
 */
export class FestivalFireworksSystem {
  public root = new THREE.Group()
  public onLaunch?: () => void
  public onBurst?: () => void

  private enabled = false
  private launchTimer = 0.25
  private prevDrawCount = 0
  private rockets: Rocket[] = []
  private sparks: Spark[] = []
  private trails: TrailEmber[] = []

  private geometry: THREE.BufferGeometry
  private material: THREE.PointsMaterial
  private glowTexture: THREE.CanvasTexture
  private points: THREE.Points

  private positions: Float32Array
  private colors: Float32Array

  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 15, 39), 34)
    this.geometry.setDrawRange(0, 0)

    this.glowTexture = createGlowTexture()
    this.material = new THREE.PointsMaterial({
      size: 0.62,
      map: this.glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = true
    this.root.add(this.points)
    this.root.visible = false
  }

  public setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    this.root.visible = enabled
    if (enabled) {
      this.launchTimer = 0.2
    } else {
      this.rockets.length = 0
      this.sparks.length = 0
      this.trails.length = 0
      this.prevDrawCount = 0
      this.geometry.setDrawRange(0, 0)
    }
  }

  private spawnRocket() {
    const primary = pickRandomColor()
    const secondary = pickRandomColor(primary)
    const types: ShellType[] = ['chrysanthemum', 'dual_ring', 'willow', 'strobe']
    const shellType = types[Math.floor(Math.random() * types.length)] ?? 'chrysanthemum'

    this.rockets.push({
      x: (Math.random() - 0.5) * 30,
      y: 0.8,
      z: 33 + Math.random() * 12,
      vx: (Math.random() - 0.5) * 3.0,
      vy: 18.5 + Math.random() * 5.5,
      vz: (Math.random() - 0.5) * 2.2,
      primary,
      secondary,
      shellType,
      age: 0,
      fuse: 1.15 + Math.random() * 0.45
    })
    this.onLaunch?.()
  }

  private burstRocket(r: Rocket) {
    // Chớp sáng lõi vụ nổ bằng hạt cộng sáng (không dùng PointLight để không recompile shader)
    for (let i = 0; i < 6 && this.trails.length < MAX_PARTICLES - 40; i++) {
      this.trails.push({
        x: r.x + (Math.random() - 0.5) * 0.6,
        y: r.y + (Math.random() - 0.5) * 0.6,
        z: r.z + (Math.random() - 0.5) * 0.6,
        r: 1.0,
        g: 0.96,
        b: 0.85,
        age: 0,
        life: 0.22
      })
    }

    if (r.shellType === 'dual_ring') {
      this.emitShellSparks(r, 34, 9.5, 12.0, r.primary, true, false, 6.0, 0.94)
      this.emitShellSparks(r, 20, 4.8, 6.8, r.secondary, false, true, 5.5, 0.93)
    } else if (r.shellType === 'willow') {
      this.emitShellSparks(r, 40, 6.5, 9.5, WILLOW_GOLD, true, false, 8.8, 0.91, WILLOW_AMBER)
    } else if (r.shellType === 'strobe') {
      this.emitShellSparks(r, 42, 7.5, 11.5, r.primary, true, true, 6.2, 0.93, r.secondary)
    } else {
      this.emitShellSparks(r, 44, 8.0, 12.5, r.primary, true, false, 6.2, 0.935, r.secondary)
    }

    this.onBurst?.()
  }

  private emitShellSparks(
    r: Rocket,
    count: number,
    minSpeed: number,
    maxSpeed: number,
    colorA: THREE.Color,
    leaveTrail: boolean,
    strobe: boolean,
    gravity: number,
    drag: number,
    colorB?: THREE.Color
  ) {
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX_PARTICLES - 100) break
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
      const col = colorB && i % 3 === 0 ? colorB : colorA

      this.sparks.push({
        x: r.x,
        y: r.y,
        z: r.z,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed + 1.4,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        r: Math.min(1, col.r * 1.25),
        g: Math.min(1, col.g * 1.25),
        b: Math.min(1, col.b * 1.25),
        age: 0,
        life: 1.35 + Math.random() * 0.75,
        gravity,
        drag,
        leaveTrail,
        strobe,
        trailAccum: 0
      })
    }
  }

  public update(delta: number) {
    if (!this.enabled) return
    const dt = Math.min(delta, 0.05)

    this.launchTimer -= dt
    if (this.launchTimer <= 0) {
      this.spawnRocket()
      if (Math.random() < 0.35) {
        this.spawnRocket()
      }
      this.launchTimer = 1.25 + Math.random() * 1.25
    }

    // 1. Cập nhật tên lửa đang bay lên
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]!
      r.age += dt
      r.vy -= 5.6 * dt
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.z += r.vz * dt

      if (this.trails.length < MAX_PARTICLES - 150) {
        this.trails.push({
          x: r.x + (Math.random() - 0.5) * 0.12,
          y: r.y,
          z: r.z + (Math.random() - 0.5) * 0.12,
          r: 1.0,
          g: 0.86,
          b: 0.52,
          age: 0,
          life: 0.32
        })
      }

      if (r.age >= r.fuse || r.vy <= 1.5) {
        this.burstRocket(r)
        swapPop(this.rockets, i)
      }
    }

    // 2. Cập nhật các tia chính + sinh đuôi lửa
    let drawCount = 0
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!
      s.age += dt
      if (s.age >= s.life) {
        swapPop(this.sparks, i)
        continue
      }

      const dragFactor = Math.pow(s.drag, dt * 60)
      s.vx *= dragFactor
      s.vz *= dragFactor
      s.vy = s.vy * dragFactor - s.gravity * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.z += s.vz * dt

      if (s.leaveTrail) {
        s.trailAccum += dt
        if (s.trailAccum >= 0.06 && this.trails.length < MAX_PARTICLES - 60) {
          s.trailAccum = 0
          const fade = Math.max(0, 1 - s.age / s.life)
          this.trails.push({
            x: s.x,
            y: s.y,
            z: s.z,
            r: s.r * fade * 0.9,
            g: s.g * fade * 0.9,
            b: s.b * fade * 0.9,
            age: 0,
            life: 0.34
          })
        }
      }

      if (drawCount < MAX_PARTICLES) {
        let fade = Math.max(0, 1 - s.age / s.life)
        if (s.strobe && s.age > s.life * 0.45) {
          fade *= Math.sin(s.age * 42) > 0 ? 1.25 : 0.2
        }
        const idx = drawCount * 3
        this.positions[idx] = s.x
        this.positions[idx + 1] = s.y
        this.positions[idx + 2] = s.z
        this.colors[idx] = Math.min(1, s.r * fade)
        this.colors[idx + 1] = Math.min(1, s.g * fade)
        this.colors[idx + 2] = Math.min(1, s.b * fade)
        drawCount++
      }
    }

    // 3. Cập nhật đuôi lửa mờ dần
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i]!
      tr.age += dt
      if (tr.age >= tr.life) {
        swapPop(this.trails, i)
        continue
      }
      if (drawCount < MAX_PARTICLES) {
        const fade = Math.pow(Math.max(0, 1 - tr.age / tr.life), 1.6)
        const idx = drawCount * 3
        this.positions[idx] = tr.x
        this.positions[idx + 1] = tr.y
        this.positions[idx + 2] = tr.z
        this.colors[idx] = tr.r * fade
        this.colors[idx + 1] = tr.g * fade
        this.colors[idx + 2] = tr.b * fade
        drawCount++
      }
    }

    // 4. Đầu tên lửa sáng
    for (let i = 0; i < this.rockets.length && drawCount < MAX_PARTICLES; i++) {
      const r = this.rockets[i]!
      const idx = drawCount * 3
      this.positions[idx] = r.x
      this.positions[idx + 1] = r.y
      this.positions[idx + 2] = r.z
      this.colors[idx] = 1.0
      this.colors[idx + 1] = 0.95
      this.colors[idx + 2] = 0.78
      drawCount++
    }

    if (drawCount > 0 || this.prevDrawCount > 0) {
      const posAttr = this.geometry.attributes.position as THREE.BufferAttribute
      const colAttr = this.geometry.attributes.color as THREE.BufferAttribute
      if (drawCount > 0) {
        posAttr.clearUpdateRanges()
        posAttr.addUpdateRange(0, drawCount * 3)
        colAttr.clearUpdateRanges()
        colAttr.addUpdateRange(0, drawCount * 3)
      }
      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
      this.geometry.setDrawRange(0, drawCount)
      this.prevDrawCount = drawCount
    }
  }

  public dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.glowTexture.dispose()
  }
}
