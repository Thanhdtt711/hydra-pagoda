import * as THREE from 'three'
import { CollisionWorld } from './CollisionWorld'

export class CameraSpringArm {
  public world: CollisionWorld
  public cameraRadius = 0.28 // Bán kính đệm an toàn để near-plane camera không bị cắt vào tường
  public minDistance = 0.45
  public currentDistance = 4.2
  public minHeightAboveGround = 0.38 // Khoảng đệm an toàn tối thiểu trên mặt đất chống xuyên lòng đất

  constructor(world: CollisionWorld) {
    this.world = world
  }

  /**
   * Tính toán vị trí camera an toàn không bao giờ xuyên tường, cột, trần hoặc mặt đất.
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

    // 2. Kiểm tra va chạm với MẶT ĐẤT / ĐỊA HÌNH (Ground Collision Spring Arm)
    // Ước lượng vị trí camera nếu lùi ra khoảng cách targetDist
    const candX = targetFocus.x + direction.x * targetDist
    const candZ = targetFocus.z + direction.z * targetDist
    const groundY = this.world.getSurfaceY(candX, candZ, targetFocus.y)
    const minAllowedY = groundY + this.minHeightAboveGround

    // Nếu hướng lùi của camera chúc xuống đất (direction.y < 0) và có nguy cơ chui xuống dưới minAllowedY
    if (direction.y < -0.01 && targetFocus.y > minAllowedY) {
      const distToGround = (targetFocus.y - minAllowedY) / (-direction.y)
      const safeGroundDist = Math.max(this.minDistance, distToGround - this.cameraRadius)
      targetDist = Math.min(targetDist, safeGroundDist)
    }

    // 3. Nội suy mượt mà: Thu vào tức thì (để không lộ xuyên tường/đất), nhả ra êm ái
    if (targetDist < this.currentDistance) {
      // Thu vào nhanh chóng (snappy response khi đụng tường/đất)
      this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetDist, Math.min(delta * 25.0, 1.0))
    } else {
      // Nhả ra êm ái khi ra khoảng trống
      this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, targetDist, Math.min(delta * 8.0, 1.0))
    }

    // 4. Vị trí camera cuối cùng
    const finalPos = new THREE.Vector3()
      .copy(targetFocus)
      .addScaledVector(direction, this.currentDistance)

    // Chốt chặn an toàn tuyệt đối (Hard Floor Clamp): Camera không bao giờ được phép thấp hơn minAllowedY
    const finalGroundY = this.world.getSurfaceY(finalPos.x, finalPos.z, targetFocus.y)
    const finalMinY = finalGroundY + this.minHeightAboveGround
    if (finalPos.y < finalMinY) {
      finalPos.y = finalMinY
    }

    return finalPos
  }
}

