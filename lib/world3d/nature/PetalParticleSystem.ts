import * as THREE from 'three'
import { WindSystem } from './WindSystem'
import { SeededPRNG } from '../utils/SeededPRNG'
import { MapLayout } from '../world/MapLayout'
import { getMapleLeafColor } from './TreeSpecies'
import { Palette, type TimeOfDayMode } from '../style/Palette'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'

/**
 * PetalParticleSystem (Low-poly Minimalist, 100% GPU):
 * - Hạt là mảnh phẳng cạnh cứng (thoi / lục giác) thay vì chấm mờ, một màu duy nhất.
 * - Gồm 3 lớp, mỗi lớp 1 draw call (tổng 3):
 *   1. Cánh hoa / lá rơi theo gió, màu đổi theo quốc gia (mùa hoa anh đào / lá phong) và giờ trong ngày.
 *   2. Đom đóm vàng quanh hồ sen và cội bồ đề (cộng sáng, sáng hơn về đêm).
 *   3. Khói hương trầm uốn lượn tại lư hương.
 * - Zero CPU mỗi frame: chuyển động hoàn toàn trong vertex shader từ uniform gió dùng chung.
 */
export class PetalParticleSystem {
  public root: THREE.Group
  private windSystem: WindSystem
  private mode: TimeOfDayMode
  private materials: THREE.ShaderMaterial[] = []
  private geometries: THREE.BufferGeometry[] = []

  private petalMat!: THREE.ShaderMaterial
  private moteMat!: THREE.ShaderMaterial
  private smokeMat!: THREE.ShaderMaterial
  private petalBase = new THREE.Color(getMapleLeafColor('vietnam'))
  private smokeBase = new THREE.Color(0xdce1e8)

  constructor(windSystem?: WindSystem) {
    this.root = new THREE.Group()
    this.root.name = 'PetalParticleSystem'
    this.windSystem = windSystem || WindSystem.getInstance()
    this.mode = FlatMaterialFactory.getInstance().currentMode

    this.buildGpuPetals()
    this.buildGpuZenMotes()
    this.buildGpuIncenseSmoke()
    this.applyColors()
  }

  /** 1. Cánh hoa / lá rơi, hạt thoi cạnh cứng. */
  private buildGpuPetals() {
    const count = 320
    const prng = new SeededPRNG(123456)

    const origins = new Float32Array(count * 3)
    const variations = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Phân bố quanh sân chùa và cội bồ đề (-11, 12)
      origins[i * 3 + 0] = prng.range(-28, 18)
      origins[i * 3 + 1] = prng.range(3.0, 14.0)
      origins[i * 3 + 2] = prng.range(-15, 25)

      variations[i * 3 + 0] = prng.range(-3.0, 3.0)
      variations[i * 3 + 1] = prng.range(0.8, 1.4) // hệ số kích thước
      variations[i * 3 + 2] = prng.range(-3.0, 3.0)

      speeds[i] = prng.range(0.7, 1.25)
      phases[i] = prng.range(0, Math.PI * 2)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(origins, 3))
    geo.setAttribute('aVariation', new THREE.BufferAttribute(variations, 3))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    this.geometries.push(geo)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uWindTime: this.windSystem.uniforms.uWindTime,
        uWindDirection: this.windSystem.uniforms.uWindDirection,
        uWindStrength: this.windSystem.uniforms.uWindStrength,
        uWindGust: this.windSystem.uniforms.uWindGust,
        uColor: { value: new THREE.Color(0xc8452f) }
      },
      vertexShader: `
        uniform float uWindTime;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uWindGust;

        attribute vec3 aVariation;
        attribute float aSpeed;
        attribute float aPhase;
        varying float vAlpha;

        void main() {
          float t = uWindTime * aSpeed + aPhase;
          float gust = 1.0 + uWindGust * 0.8;

          // Rơi tuần hoàn từ tán cây xuống đất
          float y = mod(position.y - uWindTime * aSpeed * 1.1, 13.8);

          // Trôi theo hướng gió + lắc lư nhẹ
          float drift = (0.9 + uWindStrength * 2.2 * gust) * uWindTime * aSpeed * 0.55;
          float x = position.x + uWindDirection.x * drift + sin(t * 0.9) * 0.55 + aVariation.x * 0.1;
          float z = position.z + uWindDirection.y * drift + cos(t * 0.8) * 0.45 + aVariation.z * 0.1;

          // Bọc vào vùng [-40, 40]
          x = mod(x + 40.0, 80.0) - 40.0;
          z = mod(z + 40.0, 80.0) - 40.0;

          // Mờ dần sát đất và lúc mới sinh trên ngọn
          vAlpha = smoothstep(0.2, 1.6, y) * smoothstep(13.8, 12.0, y);

          vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_PointSize = (30.0 * aVariation.y) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          // Hình thoi cạnh cứng
          if (abs(c.x) + abs(c.y) > 0.5) discard;
          if (vAlpha < 0.05) discard;
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
    this.petalMat = mat
    this.materials.push(mat)

    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.name = 'petals'
    this.root.add(points)
  }

  /** 2. Đom đóm vàng quanh hồ sen và cội bồ đề, hạt thoi cộng sáng. */
  private buildGpuZenMotes() {
    const count = 60
    const prng = new SeededPRNG(654321)

    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // 50% quanh hồ (-14, 0), 50% quanh cội bồ đề (-11, 12)
      const nearPond = i % 2 === 0
      const cx = nearPond ? -14.0 : -11.0
      const cz = nearPond ? 0.0 : 12.0
      const radius = prng.range(1.5, 7.5)
      const angle = prng.range(0, Math.PI * 2)

      positions[i * 3 + 0] = cx + Math.cos(angle) * radius
      positions[i * 3 + 1] = prng.range(0.8, 4.2)
      positions[i * 3 + 2] = cz + Math.sin(angle) * radius

      phases[i] = prng.range(0, Math.PI * 2)
      speeds[i] = prng.range(0.8, 1.6)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    this.geometries.push(geo)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uWindTime: this.windSystem.uniforms.uWindTime,
        uColor: { value: new THREE.Color(0xf5c36a) },
        uGlow: { value: 0.6 }
      },
      vertexShader: `
        uniform float uWindTime;
        uniform float uGlow;
        attribute float aPhase;
        attribute float aSpeed;
        varying float vAlpha;

        void main() {
          float t = uWindTime * aSpeed + aPhase;
          float y = position.y + sin(t * 1.8) * 0.35;
          float x = position.x + cos(t * 1.2) * 0.45;
          float z = position.z + sin(t * 1.5) * 0.45;

          // Xung nhịp ánh sáng nhấp nháy
          vAlpha = (0.45 + 0.4 * sin(t * 2.8 + aPhase)) * uGlow;

          vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_PointSize = 34.0 / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          if (abs(c.x) + abs(c.y) > 0.5) discard;
          gl_FragColor = vec4(uColor * vAlpha, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    this.moteMat = mat
    this.materials.push(mat)

    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.name = 'zen_motes'
    this.root.add(points)
  }

  /** 3. Khói hương trầm lục giác cạnh cứng tại lư hương (tọa độ từ MapLayout). */
  private buildGpuIncenseSmoke() {
    const count = 120
    const prng = new SeededPRNG(987654)
    const urnPos = MapLayout.LANDMARKS.INCENSE_BURNER.center

    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = urnPos.x + prng.range(-0.12, 0.12)
      positions[i * 3 + 1] = urnPos.y + prng.range(2.3, 6.8)
      positions[i * 3 + 2] = urnPos.z + prng.range(-0.12, 0.12)

      phases[i] = prng.range(0, Math.PI * 2)
      speeds[i] = prng.range(0.85, 1.35)
    }

    const baseY = urnPos.y + 2.3

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    this.geometries.push(geo)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uWindTime: this.windSystem.uniforms.uWindTime,
        uWindDirection: this.windSystem.uniforms.uWindDirection,
        uWindStrength: this.windSystem.uniforms.uWindStrength,
        uColor: { value: new THREE.Color(0xdce1e8) },
        uBaseY: { value: baseY }
      },
      vertexShader: `
        uniform float uWindTime;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uBaseY;
        attribute float aPhase;
        attribute float aSpeed;
        varying float vAlpha;

        void main() {
          float t = uWindTime * aSpeed + aPhase;
          float rise = 4.5;

          // Bốc lên tuần hoàn trong dải cao 4.5 m phía trên miệng lư
          float hNorm = fract(t * 0.12 + aPhase * 0.159);
          float y = uBaseY + hNorm * rise;

          // Uốn lượn và dạt theo gió ở phần ngọn
          float curl = sin(y * 2.3 + t * 1.4) * 0.14 * hNorm;
          float windDrift = pow(hNorm, 2.0) * (0.9 + uWindStrength * 3.2) * 0.9;
          float x = position.x + curl + uWindDirection.x * windDrift;
          float z = position.z + cos(y * 2.3 + t * 1.2) * 0.12 * hNorm + uWindDirection.y * windDrift;

          // Mỏng ở gốc, dày ở giữa, tan ở đỉnh
          vAlpha = smoothstep(0.0, 0.15, hNorm) * (1.0 - smoothstep(0.55, 1.0, hNorm)) * 0.5;

          vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_PointSize = (30.0 * (1.0 + hNorm * 2.0)) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          // Lục giác cạnh cứng
          vec2 a = abs(c);
          if (max(a.x * 0.866 + a.y * 0.5, a.y) > 0.43) discard;
          if (vAlpha < 0.03) discard;
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
    this.smokeMat = mat
    this.materials.push(mat)

    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.name = 'incense_smoke'
    this.root.add(points)
  }

  /** Tỉ lệ sáng/tối của bảng màu hiện tại so với ban ngày. */
  private tintRatio(minValue: number): THREE.Color {
    const cur = new THREE.Color(Palette.slot(this.mode, 'leaf'))
    const ref = new THREE.Color(Palette.slot('day', 'leaf'))
    const f = (a: number, b: number) => Math.min(Math.max(a / Math.max(b, 0.001), minValue), 1.15)
    return new THREE.Color(f(cur.r, ref.r), f(cur.g, ref.g), f(cur.b, ref.b))
  }

  private applyColors() {
    const petalTint = this.tintRatio(0.5)
      ; (this.petalMat.uniforms.uColor.value as THREE.Color).copy(this.petalBase).multiply(petalTint)

    const smokeTint = this.tintRatio(0.45)
      ; (this.smokeMat.uniforms.uColor.value as THREE.Color).copy(this.smokeBase).multiply(smokeTint)

    // Đom đóm sáng rõ hơn khi trời tối
    this.moteMat.uniforms.uGlow.value = this.mode === 'night' ? 1.0 : this.mode === 'sunset' ? 0.75 : 0.5
  }

  /** Nhật/Hàn = cánh anh đào hồng phấn, còn lại = lá phong đỏ (cùng màu với tán cây). */
  public setCountry(countryCode: string) {
    this.petalBase.setHex(getMapleLeafColor(countryCode))
    this.applyColors()
  }

  /** Đổi bảng màu theo thời điểm trong ngày (không tạo lại vật liệu). */
  public setPalette(mode: TimeOfDayMode) {
    this.mode = mode
    this.applyColors()
  }

  public update(_delta: number) {
    // Uniform gió được WindSystem cập nhật dùng chung, không cần cập nhật mỗi frame
  }

  public dispose() {
    for (const geo of this.geometries) geo.dispose()
    for (const mat of this.materials) mat.dispose()
    this.geometries = []
    this.materials = []
    this.root.parent?.remove(this.root)
  }
}
