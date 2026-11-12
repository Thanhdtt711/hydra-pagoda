import * as THREE from 'three'
import { CollisionWorld, CylinderCollider } from '../collision'
import { createPilgrimNameplate } from '../NameplateHelper'
import { ABBOT_PALETTE } from './AvatarGeometry'
import { LowPolyAvatarModel } from './LowPolyAvatarModel'

export type AbbotNpcEmotion = 'calm' | 'smile' | 'thoughtful' | 'serious'

/**
 * AbbotNpc:
 * NPC Thầy Trụ Trì đứng điềm đạm bên ngoài Hiên Tiền Điện (Phương án 2),
 * tái sử dụng LowPolyAvatarModel với tạo hình sư thầy áo nâu sòng, đầu trọc (`shaved_monk`).
 */
export class AbbotNpc {
  public readonly root = new THREE.Group()
  private readonly model: LowPolyAvatarModel
  private readonly nameplate: THREE.Sprite
  private readonly baseYaw: number
  private currentYaw: number
  private readonly origin = new THREE.Vector3()

  constructor(
    collisionWorld: CollisionWorld,
    pos: { x: number; y: number; z: number; yaw: number; colliderRadius?: number }
  ) {
    this.baseYaw = pos.yaw
    this.currentYaw = pos.yaw
    this.origin.set(pos.x, pos.y, pos.z)

    this.root.name = 'abbot_npc'
    this.root.position.set(pos.x, pos.y, pos.z)
    this.root.rotation.y = pos.yaw

    // Dáng sư thầy cao tuổi: đầu trọc, râu tóc bạc, mặc áo cà sa trang nghiêm
    this.model = new LowPolyAvatarModel('thailand', 'male')
    this.model.setCustomPalette(ABBOT_PALETTE)
    this.model.root.scale.setScalar(1.04)
    this.model.play('idle')
    this.root.add(this.model.root)

    // Bảng tên trên đầu
    this.nameplate = createPilgrimNameplate('Thầy Trụ Trì', 'Hiên Tiền Điện', 'vietnam', {
      variant: 'npc',
      hideCountry: true
    })
    this.nameplate.position.set(0, 2.26, 0)
    this.root.add(this.nameplate)

    // Collider trụ để người chơi không đi xuyên qua thầy
    if (!collisionWorld.has('abbot_npc_collider')) {
      const r = pos.colliderRadius ?? 0.48
      collisionWorld.add(
        new CylinderCollider('abbot_npc_collider', new THREE.Vector3(pos.x, pos.y + 0.9, pos.z), r, 1.8, false)
      )
    }
  }

  public setEmotion(emotion: AbbotNpcEmotion) {
    if (emotion === 'smile') {
      this.model.setExpression('smile')
      this.model.play('bow', 1.6, 0.4)
    } else if (emotion === 'thoughtful') {
      this.model.setExpression('meditating')
      this.model.play('pray')
    } else if (emotion === 'serious') {
      this.model.setExpression('serene')
      this.model.play('idle')
    } else {
      this.model.setExpression('serene')
      this.model.play('idle')
    }
  }

  public update(delta: number, _elapsed: number, playerPos: THREE.Vector3) {
    const dx = playerPos.x - this.origin.x
    const dz = playerPos.z - this.origin.z
    const dist = Math.hypot(dx, dz)

    // Hơi xoay nhẹ về phía người chơi khi bước tới gần trên thềm chùa
    let targetYaw = this.baseYaw
    if (dist <= 4.5 && dist > 0.25) {
      targetYaw = Math.atan2(dx, dz)
    }

    let diff = targetYaw - this.currentYaw
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.currentYaw += diff * Math.min(delta * 4.0, 1.0)
    this.root.rotation.y = this.currentYaw

    // Tham số thứ 2 của LowPolyAvatarModel.update là isMoving (boolean), không phải elapsed
    this.model.update(delta, false)
  }
}

