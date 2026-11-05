import * as THREE from 'three'

export interface CollisionResult {
  hasCollision: boolean
  penetration: number
  normal: THREE.Vector3
  contactPoint: THREE.Vector3
  isFloor: boolean
  floorY?: number
}

export interface RayHit {
  distance: number
  point: THREE.Vector3
  normal: THREE.Vector3
  collider: Collider
}

export interface Capsule {
  base: THREE.Vector3 // Tâm bán cầu đáy (feet + radius)
  tip: THREE.Vector3  // Tâm bán cầu đỉnh (head - radius)
  radius: number
  height: number      // Chiều cao tổng từ chân tới đầu
}

export abstract class Collider {
  public id: string
  public isWalkable: boolean
  public isTrigger: boolean
  public enabled: boolean = true
  public customFloorY?: number

  constructor(id: string, isWalkable = false, isTrigger = false, enabled = true, customFloorY?: number) {
    this.id = id
    this.isWalkable = isWalkable
    this.isTrigger = isTrigger
    this.enabled = enabled
    this.customFloorY = customFloorY
  }

  abstract testCapsule(capsule: Capsule, stepHeight: number): CollisionResult | null
  abstract raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RayHit | null
  abstract getDebugMesh(): THREE.Object3D
  abstract getBounds(minOut: THREE.Vector3, maxOut: THREE.Vector3): void
}

export class BoxCollider extends Collider {
  public center: THREE.Vector3
  public size: THREE.Vector3
  public min: THREE.Vector3
  public max: THREE.Vector3

  constructor(
    id: string,
    center: THREE.Vector3,
    size: THREE.Vector3,
    isWalkable = false,
    isFloor = false,
    floorY?: number
  ) {
    super(id, isWalkable || isFloor, false, true, floorY)
    this.center = center.clone()
    this.size = size.clone()
    this.min = new THREE.Vector3(
      center.x - size.x / 2,
      center.y - size.y / 2,
      center.z - size.z / 2
    )
    this.max = new THREE.Vector3(
      center.x + size.x / 2,
      center.y + size.y / 2,
      center.z + size.z / 2
    )
  }

  getBounds(minOut: THREE.Vector3, maxOut: THREE.Vector3): void {
    minOut.copy(this.min)
    maxOut.copy(this.max)
  }

  testCapsule(capsule: Capsule, stepHeight: number): CollisionResult | null {
    if (!this.enabled) return null

    const feetY = capsule.base.y - capsule.radius
    const r = capsule.radius

    // Kiểm tra AABB sơ bộ
    if (
      capsule.base.x + r < this.min.x ||
      capsule.base.x - r > this.max.x ||
      capsule.base.z + r < this.min.z ||
      capsule.base.z - r > this.max.z ||
      capsule.tip.y + r < this.min.y ||
      feetY > this.max.y
    ) {
      return null
    }

    // 1. Kiểm tra mặt sàn bước lên được (Step-up / Stair climbing / Floor)
    if (this.isWalkable) {
      const topY = this.customFloorY !== undefined ? this.customFloorY : this.max.y
      const heightDiff = topY - feetY
      // Nếu chân ở gần mặt trên của hộp và trong khoảng stepHeight cho phép
      if (heightDiff > -0.05 && heightDiff <= stepHeight + 0.12) {
        // Kiểm tra xem hình chiếu ngang của capsule có tiếp xúc với mặt phẳng hộp không (biên độ r)
        const margin = r
        if (
          capsule.base.x >= this.min.x - margin &&
          capsule.base.x <= this.max.x + margin &&
          capsule.base.z >= this.min.z - margin &&
          capsule.base.z <= this.max.z + margin
        ) {
          return {
            hasCollision: true,
            penetration: heightDiff,
            normal: new THREE.Vector3(0, 1, 0),
            contactPoint: new THREE.Vector3(capsule.base.x, topY, capsule.base.z),
            isFloor: true,
            floorY: topY
          }
        }
        // Bậc thang thấp hơn stepHeight tuyệt đối không cản trở ngang như một bức tường đứng
        return null
      }
    }

    // 2. Va chạm tường / trần (Wall & Ceiling collision)
    // Tìm điểm gần nhất trên AABB với đoạn thẳng capsule [base, tip]
    let closestPointOnSegment = new THREE.Vector3()
    let closestPointOnBox = new THREE.Vector3()
    let minDistanceSq = Infinity

    // Lấy 5 mẫu dọc theo trục capsule
    const samples = 5
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const p = new THREE.Vector3().lerpVectors(capsule.base, capsule.tip, t)
      const q = new THREE.Vector3(
        THREE.MathUtils.clamp(p.x, this.min.x, this.max.x),
        THREE.MathUtils.clamp(p.y, this.min.y, this.max.y),
        THREE.MathUtils.clamp(p.z, this.min.z, this.max.z)
      )
      const distSq = p.distanceToSquared(q)
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq
        closestPointOnSegment.copy(p)
        closestPointOnBox.copy(q)
      }
    }

    const dist = Math.sqrt(minDistanceSq)

    // Nếu điểm nằm hoàn toàn bên trong hộp (deep penetration)
    if (dist < 0.0001) {
      // Tìm mặt gần nhất để đẩy ra
      const dx1 = closestPointOnSegment.x - this.min.x
      const dx2 = this.max.x - closestPointOnSegment.x
      const dy1 = closestPointOnSegment.y - this.min.y
      const dy2 = this.max.y - closestPointOnSegment.y
      const dz1 = closestPointOnSegment.z - this.min.z
      const dz2 = this.max.z - closestPointOnSegment.z

      const minPen = Math.min(dx1, dx2, dy1, dy2, dz1, dz2)
      const normal = new THREE.Vector3()

      if (minPen === dx1) normal.set(-1, 0, 0)
      else if (minPen === dx2) normal.set(1, 0, 0)
      else if (minPen === dy1) normal.set(0, -1, 0)
      else if (minPen === dy2) normal.set(0, 1, 0)
      else if (minPen === dz1) normal.set(0, 0, -1)
      else normal.set(0, 0, 1)

      return {
        hasCollision: true,
        penetration: minPen + r,
        normal,
        contactPoint: closestPointOnBox,
        isFloor: normal.y > 0.7,
        floorY: normal.y > 0.7 ? this.max.y : undefined
      }
    }

    if (dist < r) {
      const penetration = r - dist
      const normal = new THREE.Vector3()
        .subVectors(closestPointOnSegment, closestPointOnBox)
        .normalize()

      return {
        hasCollision: true,
        penetration,
        normal,
        contactPoint: closestPointOnBox,
        isFloor: normal.y > 0.7,
        floorY: normal.y > 0.7 ? this.max.y : undefined
      }
    }

    return null
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RayHit | null {
    if (!this.enabled) return null
    const ray = new THREE.Ray(origin, direction)
    const box = new THREE.Box3(this.min, this.max)
    const hitPoint = new THREE.Vector3()

    if (ray.intersectBox(box, hitPoint)) {
      const dist = origin.distanceTo(hitPoint)
      if (dist <= maxDistance) {
        // Tính pháp tuyến tại điểm va chạm
        const normal = new THREE.Vector3()
        const eps = 0.001
        if (Math.abs(hitPoint.x - this.min.x) < eps) normal.set(-1, 0, 0)
        else if (Math.abs(hitPoint.x - this.max.x) < eps) normal.set(1, 0, 0)
        else if (Math.abs(hitPoint.y - this.min.y) < eps) normal.set(0, -1, 0)
        else if (Math.abs(hitPoint.y - this.max.y) < eps) normal.set(0, 1, 0)
        else if (Math.abs(hitPoint.z - this.min.z) < eps) normal.set(0, 0, -1)
        else normal.set(0, 0, 1)

        return {
          distance: dist,
          point: hitPoint,
          normal,
          collider: this
        }
      }
    }
    return null
  }

  getDebugMesh(): THREE.Object3D {
    const geo = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z)
    const wireframe = new THREE.WireframeGeometry(geo)
    const mat = new THREE.LineBasicMaterial({
      color: this.isWalkable ? 0x0ecb81 : 0x00ffff,
      linewidth: 1
    })
    const line = new THREE.LineSegments(wireframe, mat)
    line.position.copy(this.center)
    return line
  }
}

export class CylinderCollider extends Collider {
  public center: THREE.Vector3
  public radius: number
  public height: number
  public minY: number
  public maxY: number

  constructor(id: string, center: THREE.Vector3, radius: number, height: number, isWalkable = false) {
    super(id, isWalkable)
    this.center = center.clone()
    this.radius = radius
    this.height = height
    this.minY = center.y - height / 2
    this.maxY = center.y + height / 2
  }

  getBounds(minOut: THREE.Vector3, maxOut: THREE.Vector3): void {
    minOut.set(this.center.x - this.radius, this.minY, this.center.z - this.radius)
    maxOut.set(this.center.x + this.radius, this.maxY, this.center.z + this.radius)
  }

  testCapsule(capsule: Capsule, stepHeight: number): CollisionResult | null {
    if (!this.enabled) return null
    const feetY = capsule.base.y - capsule.radius
    const headY = capsule.tip.y + capsule.radius

    // Kiểm tra độ cao
    if (headY < this.minY || feetY > this.maxY) {
      return null
    }

    // Khoảng cách ngang XZ
    const dx = capsule.base.x - this.center.x
    const dz = capsule.base.z - this.center.z
    const distXZ = Math.hypot(dx, dz)
    const combinedRadius = this.radius + capsule.radius

    // 1. Kiểm tra bước lên mặt trên hình trụ (nếu walkable)
    if (this.isWalkable) {
      const heightDiff = this.maxY - feetY
      if (heightDiff > -0.05 && heightDiff <= stepHeight + 0.12 && distXZ <= this.radius + capsule.radius * 0.7) {
        return {
          hasCollision: true,
          penetration: heightDiff,
          normal: new THREE.Vector3(0, 1, 0),
          contactPoint: new THREE.Vector3(capsule.base.x, this.maxY, capsule.base.z),
          isFloor: true,
          floorY: this.maxY
        }
      }
    }

    // 2. Va chạm thành trụ (Tránh đi xuyên cột, đèn đá, thân cây)
    if (distXZ < combinedRadius) {
      const penetration = combinedRadius - distXZ
      const normal = new THREE.Vector3(dx, 0, dz)
      if (distXZ > 0.0001) {
        normal.normalize()
      } else {
        normal.set(1, 0, 0)
      }

      const contactPoint = new THREE.Vector3(
        this.center.x + normal.x * this.radius,
        THREE.MathUtils.clamp(capsule.base.y, this.minY, this.maxY),
        this.center.z + normal.z * this.radius
      )

      return {
        hasCollision: true,
        penetration,
        normal,
        contactPoint,
        isFloor: false
      }
    }

    return null
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RayHit | null {
    if (!this.enabled) return null
    // Giao cắt tia ray với hình trụ dọc
    const ox = origin.x - this.center.x
    const oz = origin.z - this.center.z
    const dx = direction.x
    const dz = direction.z

    const a = dx * dx + dz * dz
    if (Math.abs(a) < 1e-6) return null

    const b = 2 * (ox * dx + oz * dz)
    const c = ox * ox + oz * oz - this.radius * this.radius
    const discriminant = b * b - 4 * a * c

    if (discriminant < 0) return null

    const sqrtDisc = Math.sqrt(discriminant)
    const t1 = (-b - sqrtDisc) / (2 * a)
    const t2 = (-b + sqrtDisc) / (2 * a)

    const t = t1 > 0 ? t1 : t2
    if (t <= 0 || t > maxDistance) return null

    const hitY = origin.y + direction.y * t
    if (hitY >= this.minY && hitY <= this.maxY) {
      const hitPoint = new THREE.Vector3().copy(direction).multiplyScalar(t).add(origin)
      const normal = new THREE.Vector3(hitPoint.x - this.center.x, 0, hitPoint.z - this.center.z).normalize()
      return {
        distance: t,
        point: hitPoint,
        normal,
        collider: this
      }
    }

    return null
  }

  getDebugMesh(): THREE.Object3D {
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16)
    const wireframe = new THREE.WireframeGeometry(geo)
    const mat = new THREE.LineBasicMaterial({
      color: 0xff00ff,
      linewidth: 1
    })
    const line = new THREE.LineSegments(wireframe, mat)
    line.position.copy(this.center)
    return line
  }
}

