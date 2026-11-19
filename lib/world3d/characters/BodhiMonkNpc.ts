import * as THREE from 'three'
import { createSpeechBubbleSprite } from '../NameplateHelper'
import { ABBOT_PALETTE } from './AvatarGeometry'
import { LowPolyAvatarModel } from './LowPolyAvatarModel'

type BubbleState = 'none' | 'invite' | 'seated'

/**
 * BodhiMonkNpc (Sư Thầy đối cờ):
 * - Ngồi kiết già trên đôn đá đối diện với người chơi tại Bàn Cờ Đá Dưới Bóng Bồ Đề.
 * - Khi người chơi đến gần mà chưa ngồi: cúi chào mời, hiện bong bóng lời mời.
 * - Khi người chơi ngồi xuống: mỉm cười, hiện lời mời chọn môn cờ.
 */
export class BodhiMonkNpc {
  public readonly root = new THREE.Group()
  private readonly model: LowPolyAvatarModel
  private bubble: THREE.Sprite | null = null
  private bubbleState: BubbleState = 'none'
  private monkNorth = true
  private inviteClock = 0
  private bowClock = 0
  private readonly tableX: number
  private readonly tableZ: number

  constructor(tableX: number, tableZ: number) {
    this.tableX = tableX
    this.tableZ = tableZ
    this.root.name = 'bodhi_monk_npc'

    this.model = new LowPolyAvatarModel('thailand', 'male')
    this.model.setCustomPalette(ABBOT_PALETTE)
    this.model.root.scale.setScalar(0.98)
    this.model.setExpression('serene')
    this.model.play('meditate')
    this.root.add(this.model.root)

    this.applySeat()
  }

  private applySeat(): void {
    const dz = this.monkNorth ? -1.05 : 1.05
    this.root.position.set(this.tableX, 0.3, this.tableZ + dz)
    // Mặt hướng về bàn cờ: ngồi phía Bắc nhìn về +z (yaw 0), phía Nam nhìn về -z (yaw PI)
    this.root.rotation.y = this.monkNorth ? 0 : Math.PI
  }

  private setBubble(state: BubbleState): void {
    if (state === this.bubbleState) return
    this.bubbleState = state
    if (this.bubble) {
      this.root.remove(this.bubble)
      ;(this.bubble.material as THREE.SpriteMaterial)?.map?.dispose()
      this.bubble.material?.dispose()
      this.bubble = null
    }
    if (state === 'none') return
    const text =
      state === 'invite'
        ? 'Mời đạo hữu ngồi xuống đối cờ cùng bần tăng!'
        : 'Đạo hữu muốn chơi môn cờ nào?'
    const sprite = createSpeechBubbleSprite(text)
    sprite.position.set(0, 2.55, 0)
    this.root.add(sprite)
    this.bubble = sprite
  }

  public update(delta: number, playerPos: THREE.Vector3, playerSeatedHere: boolean): void {
    const dx = playerPos.x - this.tableX
    const dz = playerPos.z - this.tableZ
    const dist = Math.hypot(dx, dz)

    // Thầy luôn ngồi ở đôn đối diện với phía người chơi đi tới
    if (!playerSeatedHere) {
      if (dz > 1.2 && !this.monkNorth) {
        this.monkNorth = true
        this.applySeat()
      } else if (dz < -1.2 && this.monkNorth) {
        this.monkNorth = false
        this.applySeat()
      }
    }

    if (playerSeatedHere) {
      this.setBubble('seated')
      this.model.setExpression('smile')
      this.model.play('meditate')
      this.inviteClock = 0
    } else if (dist < 7.5) {
      this.inviteClock += delta
      this.bowClock += delta
      // Chu kỳ 10s: 6s hiện lời mời, 4s nghỉ
      this.setBubble(this.inviteClock % 10 < 6 ? 'invite' : 'none')
      if (this.bowClock > 7) {
        this.bowClock = 0
        this.model.setExpression('smile')
        this.model.play('bow', 1.6, 0.5)
      }
    } else {
      this.setBubble('none')
      this.inviteClock = 0
      this.model.setExpression('serene')
    }

    this.model.update(delta, false)
    // Sau khi cúi chào (bow) mô hình tự về idle; ép trở lại ngồi thiền khi hết chào
    if (!playerSeatedHere && this.bowClock > 1.75 && this.bowClock < 1.95) {
      this.model.play('meditate')
    }
  }

  public dispose(): void {
    this.setBubble('none')
    this.model.dispose()
  }
}
