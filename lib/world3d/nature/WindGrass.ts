import * as THREE from 'three'
import { WindSystem } from './WindSystem'
import { SeededPRNG } from '../utils/SeededPRNG'
import { MapLayout } from '../world/MapLayout'
import { TerrainSystem } from '../world/TerrainSystem'

/**
 * WindGrass (Thảm Cỏ Tự Nhiên Instanced Lay Động Gió):
 * Uses THREE.InstancedMesh placed organically around the temple grounds.
 * Synchronized with global WindSystem for cohesive environmental motion.
 */
export class WindGrass {
  public mesh: THREE.InstancedMesh
  private geometry: THREE.BufferGeometry
  private material: THREE.ShaderMaterial
  private count = 2400
  private windSystem: WindSystem

  constructor(windSystem?: WindSystem) {
    this.windSystem = windSystem || WindSystem.getInstance()

    // 1. Tạo cụm khóm cỏ 3 nhánh đan chéo
    const bladeGeo = new THREE.PlaneGeometry(0.35, 0.65, 1, 3)
    bladeGeo.translate(0, 0.325, 0) // Dịch gốc về đáy để ngọn đung đưa quanh gốc
    this.geometry = bladeGeo

    // 2. Shader ngọn cỏ đồng bộ theo WindSystem toàn cục
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uWindTime: this.windSystem.uniforms.uWindTime,
        uWindDirection: this.windSystem.uniforms.uWindDirection,
        uWindStrength: this.windSystem.uniforms.uWindStrength,
        uWindGust: this.windSystem.uniforms.uWindGust,
        colorRoot: { value: new THREE.Color(0x1a2e1c) }, // Gốc cỏ rêu thẫm
        colorTip: { value: new THREE.Color(0x529143) }   // Ngọn cỏ non xanh mát
      },
      vertexShader: `
        uniform float uWindTime;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uWindGust;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);

          // Chỉ phần ngọn cỏ (uv.y cao) bị uốn lượn, gốc cố định chặt vào mặt đất
          float heightFactor = pow(uv.y, 1.4);

          // Sóng dao động gió chính
          float spatialPhase = worldPos.x * 0.35 + worldPos.z * 0.28;
          float sway = sin(uWindTime * 2.4 + spatialPhase) * 0.75 + cos(uWindTime * 4.2 + spatialPhase * 1.5) * 0.25;
          float displacement = sway * uWindStrength * heightFactor * (1.0 + uWindGust * 0.8);

          // Đẩy ngọn cỏ nghiêng theo hướng vector gió toàn cục
          worldPos.x += uWindDirection.x * displacement;
          worldPos.z += uWindDirection.y * displacement;

          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 colorRoot;
        uniform vec3 colorTip;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vec3 col = mix(colorRoot, colorTip, vUv.y);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.DoubleSide
    })

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.count)
    this.populateInstances()
  }

  private populateInstances() {
    const dummy = new THREE.Object3D()
    const prng = new SeededPRNG(888123)
    let instanceIndex = 0
    let attempts = 0
    const maxAttempts = 12000

    while (instanceIndex < this.count && attempts < maxAttempts) {
      attempts++
      const x = prng.range(-65, 65)
      const z = prng.range(-65, 65)

      // Kiểm tra vùng cấm từ MapLayout
      if (MapLayout.isInExclusionZone(x, z, 0.5)) {
        continue
      }

      const elev = TerrainSystem.computeElevation(x, z)
      dummy.position.set(x, elev + 0.02, z)
      dummy.rotation.y = prng.range(0, Math.PI * 2)
      const scale = prng.range(0.65, 1.15)
      dummy.scale.set(scale, scale * prng.range(0.85, 1.25), scale)
      dummy.updateMatrix()

      this.mesh.setMatrixAt(instanceIndex, dummy.matrix)
      instanceIndex++
    }

    this.mesh.count = instanceIndex
    this.mesh.instanceMatrix.needsUpdate = true
  }

  public update(delta: number, elapsed: number) {
    // Wind uniforms are updated automatically by WindSystem
  }

  public dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
