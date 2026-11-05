import * as THREE from 'three'
import { WindSystem } from './WindSystem'
import { SeededPRNG } from '../utils/SeededPRNG'
import { MapLayout } from '../world/MapLayout'

/**
 * PetalParticleSystem (Hệ Thống Hạt Tự Nhiên GPU Không Tiêu Tốn CPU):
 * 100% GPU-driven via custom vertex shaders.
 * Zero CPU array iterations and zero `needsUpdate` per frame.
 * Includes:
 * 1. Bodhi Petals: Falling sacred petals drifting with global WindSystem.
 * 2. Spiritual Zen Motes: Floating glowing golden light specks near Pond and Bodhi Tree.
 * 3. Incense Smoke: Gentle rising smoke curls from the central Altar urn.
 */
export class PetalParticleSystem {
  public root: THREE.Group
  private windSystem: WindSystem
  private materials: THREE.ShaderMaterial[] = []
  private geometries: THREE.BufferGeometry[] = []

  constructor(windSystem?: WindSystem) {
    this.root = new THREE.Group()
    this.root.name = 'PetalParticleSystem'
    this.windSystem = windSystem || WindSystem.getInstance()

    // 1. Cánh hoa Bồ Đề / Anh Đào rơi lay động theo gió (Bodhi Petals)
    this.buildGpuPetals()

    // 2. Đom đóm & Điểm quang minh thanh tịnh quanh hồ sen & cội bồ đề (Zen Motes)
    this.buildGpuZenMotes()

    // 3. Khói hương trầm uốn lượn tại Đỉnh Trầm Hương (GPU Incense Smoke)
    this.buildGpuIncenseSmoke()
  }

  /**
   * 1. Cánh hoa Bồ Đề GPU
   */
  private buildGpuPetals() {
    const count = 420
    const prng = new SeededPRNG(123456)

    const origins = new Float32Array(count * 3)
    const variations = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Phân bố rộng quanh cội Bồ Đề (-11, 12) và sân chùa
      origins[i * 3 + 0] = prng.range(-28, 18)
      origins[i * 3 + 1] = prng.range(3.0, 14.0)
      origins[i * 3 + 2] = prng.range(-15, 25)

      variations[i * 3 + 0] = prng.range(-3.0, 3.0)
      variations[i * 3 + 1] = prng.range(0.7, 1.4) // Size factor
      variations[i * 3 + 2] = prng.range(-3.0, 3.0)

      speeds[i * 3] = prng.range(0.7, 1.25)
      phases[i * 3] = prng.range(0, Math.PI * 2)
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
        uColor: { value: new THREE.Color(0xf6b9b3) } // Cánh sen/bồ đề ửng hồng trang nhã
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
          float heightRange = 13.5;
          float y = heightRange - mod(t * 1.15, heightRange) + 0.3;

          // Độ trôi theo gió & lốc xoáy nhẹ
          float travel = t * 0.9 * (uWindStrength + uWindGust * 0.4);
          float swirl = sin(t * 2.2 + aPhase) * 0.55;

          float x = position.x + uWindDirection.x * travel + swirl + aVariation.x;
          float z = position.z + uWindDirection.y * travel + cos(t * 1.8 + aPhase) * 0.45 + aVariation.z;

          // Bo vòng trong bán kính bản đồ [-40, 40]
          x = mod(x + 40.0, 80.0) - 40.0;
          z = mod(z + 40.0, 80.0) - 40.0;

          // Mờ dần ở sát đất và lúc bắt đầu sinh ra trên ngọn cây
          vAlpha = smoothstep(0.2, 1.8, y) * smoothstep(13.8, 11.5, y) * 0.85;

          vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_PointSize = (24.0 * aVariation.y) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          float alpha = (1.0 - smoothstep(0.10, 0.25, distSq)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
    this.materials.push(mat)

    const points = new THREE.Points(geo, mat)
    this.root.add(points)
  }

  /**
   * 2. Đom đóm & Điểm quang minh GPU quanh Hồ Sen và Cây Bồ Đề
   */
  private buildGpuZenMotes() {
    const count = 75
    const prng = new SeededPRNG(654321)

    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // 50% quanh Hồ Sen (-14, 0), 50% quanh Cây Bồ Đề (-11, 12)
      const isPond = i % 2 === 0
      const cx = isPond ? -14.0 : -11.0
      const cz = isPond ? 0.0 : 12.0
      const radius = prng.range(1.5, 7.5)
      const angle = prng.range(0, Math.PI * 2)

      positions[i * 3 + 0] = cx + Math.cos(angle) * radius
      positions[i * 3 + 1] = prng.range(0.8, 4.2)
      positions[i * 3 + 2] = cz + Math.sin(angle) * radius

      phases[i * 3] = prng.range(0, Math.PI * 2)
      speeds[i * 3] = prng.range(0.8, 1.6)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    this.geometries.push(geo)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uWindTime: this.windSystem.uniforms.uWindTime,
        uColor: { value: new THREE.Color(0xf5a623) } // Ánh vàng hổ phách thiền định
      },
      vertexShader: `
        uniform float uWindTime;
        attribute float aPhase;
        attribute float aSpeed;
        varying float vAlpha;

        void main() {
          float t = uWindTime * aSpeed + aPhase;
          float y = position.y + sin(t * 1.8) * 0.35;
          float x = position.x + cos(t * 1.2) * 0.45;
          float z = position.z + sin(t * 1.5) * 0.45;

          // Xung nhịp ánh sáng đom đóm
          vAlpha = (0.5 + 0.45 * sin(t * 2.8 + aPhase)) * 0.85;

          vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_PointSize = 28.0 / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          // Core phát sáng rực rỡ với quầng mờ xung quanh
          float core = 1.0 - smoothstep(0.02, 0.22, distSq);
          gl_FragColor = vec4(uColor, core * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    this.materials.push(mat)

    const points = new THREE.Points(geo, mat)
    this.root.add(points)
  }

  /**
   * 3. Khói Hương Trầm GPU tại Đỉnh Hương Sân Chùa (Single Source of Truth từ MapLayout)
   */
  private buildGpuIncenseSmoke() {
    const count = 180
    const prng = new SeededPRNG(987654)
    const urnPos = MapLayout.LANDMARKS.INCENSE_BURNER.center

    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = urnPos.x + prng.range(-0.12, 0.12)
      positions[i * 3 + 1] = urnPos.y + prng.range(2.3, 6.8)
      positions[i * 3 + 2] = urnPos.z + prng.range(-0.12, 0.12)

      phases[i * 3] = prng.range(0, Math.PI * 2)
      speeds[i * 3] = prng.range(0.85, 1.35)
    }

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
        uColor: { value: new THREE.Color(0xdce1e8) }
      },
      vertexShader: `
        uniform float uWindTime;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;

        attribute float aPhase;
        attribute float aSpeed;
        varying float vAlpha;

        void main() {
          float t = uWindTime * aSpeed + aPhase;
          float heightRange = 4.5;
          float y = 2.3 + mod(t * 0.9, heightRange);

          float hNorm = (y - 2.3) / heightRange;

          // Khói uốn lượn hình chữ S và nghiêng theo gió
          float curl = sin(y * 3.2 + t * 2.0) * 0.15 * hNorm;
          float windDrift = hNorm * 0.35 * uWindStrength;

          float x = position.x + curl + uWindDirection.x * windDrift;
          float z = position.z + cos(y * 2.8 + t * 1.7) * 0.12 * hNorm + uWindDirection.y * windDrift;

          // Khói bắt đầu mỏng, dày ở giữa và tan biến ở trên đỉnh
          vAlpha = smoothstep(0.0, 0.15, hNorm) * (1.0 - smoothstep(0.55, 1.0, hNorm)) * 0.55;

          vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_PointSize = (26.0 * (1.0 + hNorm * 2.2)) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          float alpha = (1.0 - smoothstep(0.05, 0.25, distSq)) * vAlpha;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
    this.materials.push(mat)

    const points = new THREE.Points(geo, mat)
    this.root.add(points)
  }

  public update(delta: number) {
    // Wind uniforms are automatically driven by WindSystem
  }

  public dispose() {
    for (const geo of this.geometries) {
      geo.dispose()
    }
    for (const mat of this.materials) {
      mat.dispose()
    }
    this.geometries = []
    this.materials = []
  }
}

