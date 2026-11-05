import * as THREE from 'three'

interface FootstepItem {
  active: boolean
  x: number
  y: number
  z: number
  scale: number
  life: number
  maxLife: number
}

/**
 * FootstepSystem (Hệ Thống Dấu Chân Hoa Sen Toàn Cục - Bộ Bộ Sinh Liên):
 * Replaces per-avatar footstep arrays with a single global InstancedMesh (1 draw call).
 * Manages up to 128 active lotus blossoms across all 500 pilgrims.
 */
export class FootstepSystem {
  private static instance: FootstepSystem | null = null

  public mesh: THREE.InstancedMesh
  private geometry: THREE.BufferGeometry
  private material: THREE.MeshStandardMaterial
  private maxCount = 128
  private pool: FootstepItem[] = []
  private dummy = new THREE.Object3D()

  constructor() {
    // Tạo cụm cánh hoa sen vàng cách điệu (6 cánh hoa sen nhẹ)
    const petalGeo = new THREE.ConeGeometry(0.04, 0.11, 4)
    petalGeo.rotateX(Math.PI / 2)
    petalGeo.translate(0, 0.015, 0.05)

    const geom = new THREE.BufferGeometry()
    // Tinh gọn geometry của 1 đài sen
    this.geometry = petalGeo

    this.material = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.45,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85
    })

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxCount)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let i = 0; i < this.maxCount; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        scale: 0.01,
        life: 0,
        maxLife: 1.8
      })
      this.dummy.position.set(0, -100, 0)
      this.dummy.scale.set(0.001, 0.001, 0.001)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  public static getInstance(): FootstepSystem {
    if (!FootstepSystem.instance) {
      FootstepSystem.instance = new FootstepSystem()
    }
    return FootstepSystem.instance
  }

  /**
   * Thêm một đóa sen bước chân tại vị trí thế giới (pos)
   */
  public addFootstep(pos: THREE.Vector3) {
    const item = this.pool.find((f) => !f.active) || this.pool[0]
    item.active = true
    item.x = pos.x
    item.y = 0.03
    item.z = pos.z
    item.scale = 0.3
    item.life = item.maxLife
  }

  public update(delta: number) {
    let needsUpdate = false

    for (let i = 0; i < this.maxCount; i++) {
      const item = this.pool[i]
      if (!item.active) continue

      item.life -= delta
      if (item.life <= 0) {
        item.active = false
        this.dummy.position.set(0, -100, 0)
        this.dummy.scale.set(0.001, 0.001, 0.001)
        this.dummy.updateMatrix()
        this.mesh.setMatrixAt(i, this.dummy.matrix)
        needsUpdate = true
      } else {
        const progress = 1.0 - item.life / item.maxLife
        // Hiệu ứng đài sen nở dần rồi tan biến
        const s = THREE.MathUtils.lerp(0.3, 1.15, Math.sin(progress * Math.PI))
        this.dummy.position.set(item.x, item.y + progress * 0.06, item.z)
        this.dummy.scale.set(s, s, s)
        this.dummy.updateMatrix()
        this.mesh.setMatrixAt(i, this.dummy.matrix)
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      this.mesh.instanceMatrix.needsUpdate = true
    }
  }

  public dispose() {
    this.geometry.dispose()
    this.material.dispose()
    FootstepSystem.instance = null
  }
}

