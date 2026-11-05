import * as THREE from 'three'
import { CollisionWorld } from './CollisionWorld'

export class CameraSpringArm {
  public world: CollisionWorld
  public cameraRadius = 0.28 // Bán kính đệm an toàn để near-plane camera không bị cắt vào tường
  public minDistance = 0.45
  public currentDistance = 4.2

  constructor(world: CollisionWorld) {
    this.world = world
  }

  /**
   * Tính toán vị trí camera an toàn không bao giờ xuyên tường, cột, trần.
   */
  public computePosition(
    targetFocus: THREE.Vector3,
    direction: THREE.Vector3, // Vector từ Focus hướng về phía camera
    desiredDistance: number,
    delta: number
  ): THREE.Vector3 {
    // 1. Bắn tia kiểm tra từ vị trí nhân vật (Focus) theo hướng camera
    const maxDist = Math.max(this.minDistance, desiredDistance)
    const hit = this.world.raycast(targetFocus, direction, maxDist)

    let targetDist = maxDist
    if (hit) {
      // Co khoảng cách lại ngay lập tức trước bề mặt va chạm với khoảng đệm an toàn
      targetDist = Math.max(this.minDistance, hit.distance - this.cameraRadius)
    }

    // 2. Nội suy mượt mà: Thu vào tức thì (để không lộ xuyên tường), nhả ra êm ái
    if (targetDist < this.currentDistance) {
      // Thu vào nhanh chóng (snappy response khi đụng tường)
      this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetDist, Math.min(delta * 25.0, 1.0))
    } else {
      // Nhả ra êm ái khi ra khoảng trống
      this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetDist, Math.min(delta * 8.0, 1.0))
    }

    // 3. Vị trí camera cuối cùng
    return new THREE.Vector3()
      .copy(targetFocus)
      .addScaledVector(direction, this.currentDistance)
  }
}

