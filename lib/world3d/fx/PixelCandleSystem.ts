import * as THREE from 'three'

export interface CandleOptions {
  parent: THREE.Object3D
  position: THREE.Vector3 | [number, number, number]
  height?: number
  withLight?: boolean
  lightDistance?: number
  lightIntensity?: number
  lightColor?: number
  timeOffset?: number
}

interface CandleInstance {
  sprite: THREE.Sprite
  material: THREE.SpriteMaterial
  texture: THREE.Texture
  timeOffset: number
  light?: THREE.PointLight
  baseIntensity: number
  lightLocalOffset?: THREE.Vector3
}

/**
 * PixelCandleSystem:
 * Quản lý hoạt ảnh pixel art cho các ngọn nến lung linh trong không gian thiền tự (Đại Hùng Bảo Điện, Án Thư, v.v.).
 * - Sử dụng sprite sheet pixel art 120 frame chất lượng cao từ pixelfx (56x76 px/frame, 13x10 grid).
 * - Render bằng THREE.Sprite billboard luôn hướng về camera với NearestFilter giữ độ sắc nét pixel art.
 * - Mô phỏng đốm lửa bập bùng ngẫu nhiên (asynchronous phase) + PointLight ánh sáng vàng cam ấm áp.
 */
export class PixelCandleSystem {
  private static instance: PixelCandleSystem | null = null
  private baseTexture: THREE.Texture | null = null
  private candles: CandleInstance[] = []
  private elapsed = 0
  private isDisposed = false

  // Thông số Sprite Sheet của fire/candle
  private readonly COLS = 13
  private readonly ROWS = 10
  private readonly TOTAL_FRAMES = 120
  private readonly FPS = 30
  private readonly FRAME_ASPECT = 56 / 76 // w / h = 0.7368
  // Origin trong pixelfx: [28, 64] -> đáy đĩa nến tại hàng pixel 64 / 76
  private readonly PIVOT_X = 28 / 56 // 0.5
  private readonly PIVOT_Y = (76 - 64) / 76 // 12 / 76 ≈ 0.1579

  public static getInstance(): PixelCandleSystem {
    if (!PixelCandleSystem.instance) {
      PixelCandleSystem.instance = new PixelCandleSystem()
    }
    return PixelCandleSystem.instance
  }

  constructor() {
    this.initBaseTexture()
  }

  private initBaseTexture() {
    const loader = new THREE.TextureLoader()
    this.baseTexture = loader.load('/fx/candle.png', (tex) => {
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      tex.needsUpdate = true
    })
  }

  /**
   * Tạo một ngọn nến pixel art lung linh gắn vào scene
   */
  public addCandle(opts: CandleOptions): CandleInstance | null {
    if (this.isDisposed || !this.baseTexture) return null

    // Clone texture để điều khiển UV độc lập (dùng chung WebGL texture buffer trên GPU)
    const tex = this.baseTexture.clone()
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.repeat.set(1 / this.COLS, 1 / this.ROWS)

    const initialOffset = opts.timeOffset ?? Math.random() * 4.0
    const frame = Math.floor((initialOffset * this.FPS) % this.TOTAL_FRAMES)
    const col = frame % this.COLS
    const row = Math.floor(frame / this.COLS)
    tex.offset.x = col / this.COLS
    tex.offset.y = 1.0 - (row + 1) / this.ROWS
    tex.needsUpdate = true

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      toneMapped: false // Giữ màu cam lửa ấm rực rỡ không bị bợt bởi tone mapping
    })

    const sprite = new THREE.Sprite(mat)
    // Thiết lập pivot trùng khớp với chân đế đĩa nến
    sprite.center.set(this.PIVOT_X, this.PIVOT_Y)

    const height = opts.height ?? 0.52
    const width = height * this.FRAME_ASPECT
    sprite.scale.set(width, height, 1.0)

    if (Array.isArray(opts.position)) {
      sprite.position.set(opts.position[0], opts.position[1], opts.position[2])
    } else {
      sprite.position.copy(opts.position)
    }

    opts.parent.add(sprite)

    let pointLight: THREE.PointLight | undefined
    const baseIntensity = opts.lightIntensity ?? 0.75

    if (opts.withLight !== false) {
      // Tâm lửa nến nằm ở khoảng 65% chiều cao ngọn nến
      const flameOffsetY = height * 0.45
      const lightColor = opts.lightColor ?? 0xffa036
      const lightDistance = opts.lightDistance ?? 4.5
      pointLight = new THREE.PointLight(lightColor, baseIntensity, lightDistance, 1.8)
      pointLight.position.set(
        sprite.position.x,
        sprite.position.y + flameOffsetY,
        sprite.position.z
      )
      opts.parent.add(pointLight)
    }

    const instance: CandleInstance = {
      sprite,
      material: mat,
      texture: tex,
      timeOffset: initialOffset,
      light: pointLight,
      baseIntensity
    }

    this.candles.push(instance)
    return instance
  }

  /**
   * Cập nhật animation khung hình và độ chớp nháy của ánh nến mỗi frame
   */
  public update(delta: number, elapsedOverride?: number) {
    if (this.isDisposed || this.candles.length === 0) return

    if (typeof elapsedOverride === 'number') {
      this.elapsed = elapsedOverride
    } else {
      this.elapsed += delta
    }

    const totalFrames = this.TOTAL_FRAMES
    const cols = this.COLS
    const rows = this.ROWS
    const fps = this.FPS

    for (let i = 0; i < this.candles.length; i++) {
      const c = this.candles[i]
      const t = this.elapsed + c.timeOffset
      const frame = Math.floor((t * fps) % totalFrames)
      const col = frame % cols
      const row = Math.floor(frame / cols)

      c.texture.offset.x = col / cols
      c.texture.offset.y = 1.0 - (row + 1) / rows

      if (c.light) {
        // Mô phỏng chập chờn tự nhiên của ngọn nến
        const flicker =
          0.88 +
          0.08 * Math.sin(t * 11.3 + c.timeOffset * 5.0) +
          0.04 * Math.sin(t * 23.7 + c.timeOffset * 8.3)
        c.light.intensity = c.baseIntensity * flicker
      }
    }
  }

  /**
   * Thu dọn tài nguyên
   */
  public dispose() {
    this.isDisposed = true
    for (const c of this.candles) {
      if (c.sprite.parent) c.sprite.parent.remove(c.sprite)
      if (c.light && c.light.parent) c.light.parent.remove(c.light)
      c.material.dispose()
      c.texture.dispose()
    }
    this.candles = []
    if (this.baseTexture) {
      this.baseTexture.dispose()
      this.baseTexture = null
    }
    PixelCandleSystem.instance = null
  }
}

