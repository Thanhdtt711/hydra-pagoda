import * as THREE from 'three'
import { CollisionWorld } from './CollisionWorld'
import type { Capsule } from './Collider'

export interface ControllerState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  isGrounded: boolean
  isSneaking: boolean
  isSprinting: boolean
}

export class CharacterController {
  public world: CollisionWorld
  public radius = 0.38
  public standingHeight = 1.75
  public sneakingHeight = 1.40
  public stepHeight = 0.45 // Leo tam cấp đá 0.45m mượt mà

  public gravity = -22.0
  public jumpStrength = 7.2

  public position = new THREE.Vector3(0, 0, 10)
  public velocity = new THREE.Vector3()
  public isGrounded = true
  public isSneaking = false
  public isSprinting = false

  // Reusable scratch objects to eliminate per-frame GC allocations
  private scratchCapsule: Capsule = {
    base: new THREE.Vector3(),
    tip: new THREE.Vector3(),
    radius: 0.38,
    height: 1.75
  }
  private static readonly SCRATCH_DISPLACEMENT = new THREE.Vector3()
  private static readonly SCRATCH_NORMAL_XZ = new THREE.Vector3()

  constructor(world: CollisionWorld) {
    this.world = world
  }

  public getCapsule(): Capsule {
    const currentHeight = this.isSneaking ? this.sneakingHeight : this.standingHeight
    const r = this.radius
    this.scratchCapsule.base.set(this.position.x, this.position.y + r, this.position.z)
    this.scratchCapsule.tip.set(this.position.x, this.position.y + currentHeight - r, this.position.z)
    this.scratchCapsule.radius = r
    this.scratchCapsule.height = currentHeight
    return this.scratchCapsule
  }

  public jump(): boolean {
    if (this.isGrounded) {
      this.velocity.y = this.jumpStrength
      this.isGrounded = false
      return true
    }
    return false
  }

  /**
   * Cập nhật chuyển động vật lý với Sub-stepping và Wall-Sliding liên tục.
   */
  public update(delta: number, moveDirection: THREE.Vector3, speed: number): void {
    // Giới hạn delta time để tránh lag-spike làm xuyên tường
    const dt = Math.min(delta, 0.05)

    // 1. Áp dụng trọng lực
    if (!this.isGrounded) {
      this.velocity.y += this.gravity * dt
    } else {
      this.velocity.y = Math.max(0, this.velocity.y)
    }

    // 2. Vận tốc ngang mong muốn (trực tiếp không clone)
    this.velocity.x = moveDirection.x * speed
    this.velocity.z = moveDirection.z * speed

    // 3. Sub-stepping (3 bước mỗi frame) đảm bảo không xuyên vật thể kể cả khi Sprint chạy nhanh
    const subSteps = 3
    const subDt = dt / subSteps

    for (let step = 0; step < subSteps; step++) {
      this.integrateSubStep(subDt)
    }

    // 4. Ground Snapping khi đang đi trên bậc thang / dốc xuống
    if (this.isGrounded && this.velocity.y <= 0) {
      const surfaceY = this.world.getSurfaceY(this.position.x, this.position.z, this.position.y, 1.2)
      // Nếu mặt đất bên dưới trong khoảng cho phép bước xuống
      const drop = this.position.y - surfaceY
      if (drop > 0 && drop <= 0.6) {
        this.position.y = surfaceY
      }
    }

    // 5. Fall Protection & World Boundary Guard (Bảo vệ thung lũng mở rộng R = 115m)
    if (this.position.y < -3.0 || Math.hypot(this.position.x, this.position.z) > 135.0) {
      this.respawn()
    }
  }

  public respawn(spawnPoint?: THREE.Vector3): void {
    const sp = spawnPoint || new THREE.Vector3(0, 0.08, 14.0)
    this.position.copy(sp)
    this.velocity.set(0, 0, 0)
    this.isGrounded = true
  }

  private integrateSubStep(dt: number): void {
    // Dự đoán vị trí mới bằng scratch vector
    CharacterController.SCRATCH_DISPLACEMENT.copy(this.velocity).multiplyScalar(dt)

    // A. Di chuyển theo trục ngang (XZ) trước để xử lý trượt tường & bước lên bậc thang
    this.position.x += CharacterController.SCRATCH_DISPLACEMENT.x
    this.position.z += CharacterController.SCRATCH_DISPLACEMENT.z

    // Giải quyết va chạm ngang (lặp tối đa 3 lần để xử lý góc kẹt)
    for (let iter = 0; iter < 3; iter++) {
      const capsule = this.getCapsule()
      const collisions = this.world.testCapsule(capsule, this.stepHeight)

      if (collisions.length === 0) break

      let resolvedAny = false
      for (const col of collisions) {
        // Nếu là mặt sàn bước lên được (Step-up)
        if (col.isFloor && col.floorY !== undefined) {
          const feetY = this.position.y
          if (col.floorY > feetY && col.floorY <= feetY + this.stepHeight + 0.05) {
            this.position.y = col.floorY
            this.isGrounded = true
            resolvedAny = true
            continue
          }
        }

        // Nếu là va chạm với tường / cột / vật cản bên hông
        if (!col.isFloor || col.normal.y < 0.5) {
          // Chỉ lấy thành phần pháp tuyến ngang qua scratch vector
          const normalXZ = CharacterController.SCRATCH_NORMAL_XZ.set(col.normal.x, 0, col.normal.z)
          if (normalXZ.lengthSq() > 0.0001) {
            normalXZ.normalize()
            // Đẩy capsule ra khỏi vật cản
            this.position.x += normalXZ.x * col.penetration
            this.position.z += normalXZ.z * col.penetration

            // Wall Sliding: Triệt tiêu thành phần vận tốc đâm vào tường
            const dot = this.velocity.x * normalXZ.x + this.velocity.z * normalXZ.z
            if (dot < 0) {
              this.velocity.x -= dot * normalXZ.x
              this.velocity.z -= dot * normalXZ.z
            }
            resolvedAny = true
          }
        }
      }

      if (!resolvedAny) break
    }

    // B. Di chuyển theo trục đứng (Y)
    this.position.y += CharacterController.SCRATCH_DISPLACEMENT.y

    // Giải quyết va chạm trần & sàn
    let groundedThisStep = false
    const capsuleY = this.getCapsule()
    const verticalCollisions = this.world.testCapsule(capsuleY, this.stepHeight)

    for (const col of verticalCollisions) {
      // Đụng sàn / mặt trên
      if (col.normal.y > 0.5) {
        this.position.y += col.penetration
        this.velocity.y = 0
        groundedThisStep = true
      }
      // Đụng trần / mái chùa (Ceiling hit)
      else if (col.normal.y < -0.5) {
        this.position.y -= col.penetration
        this.velocity.y = Math.min(0, this.velocity.y) // Triệt tiêu ngay vận tốc nhảy lên
      }
    }

    // Đảm bảo không rơi xuống vô tận dưới lòng đất (Fall protection / Void safety net)
    if (this.position.y <= -3.0) {
      this.respawn()
      groundedThisStep = true
    } else {
      // Đụng mặt đất tự nhiên (TerrainSystem) ngoài khuôn viên chùa hoặc trên đồi cỏ
      const terrainY = this.world.getSurfaceY(this.position.x, this.position.z, this.position.y, 2.0)
      if (this.position.y <= terrainY) {
        this.position.y = terrainY
        this.velocity.y = 0
        groundedThisStep = true
      }
    }

    this.isGrounded = groundedThisStep
  }
}

