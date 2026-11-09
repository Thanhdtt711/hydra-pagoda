import * as THREE from 'three'
import { FootstepSystem } from './characters/FootstepSystem'
import { LowPolyAvatarModel } from './characters/LowPolyAvatarModel'
import { AVATAR_PALETTES, type AvatarHatKind } from './characters/AvatarGeometry'
import type { AvatarGender, PilgrimCountry } from './characters/AvatarModel'

export type { AvatarGender, PilgrimCountry } from './characters/AvatarModel'

export interface CostumePalette {
  robeColor: number
  trimColor: number
  innerColor: number
  sashColor: number
  skinColor: number
  hatKind: AvatarHatKind
  hatColor: number
}

/** Bảng màu trang phục theo quốc gia, lấy từ AvatarGeometry (nguồn dữ liệu duy nhất). */
export const PALETTES: Record<PilgrimCountry, CostumePalette> = Object.fromEntries(
  (Object.keys(AVATAR_PALETTES) as PilgrimCountry[]).map((country) => {
    const p = AVATAR_PALETTES[country]
    return [
      country,
      {
        robeColor: p.robeColor,
        trimColor: p.trimColor,
        innerColor: p.innerColor,
        sashColor: p.sashColor,
        skinColor: p.skinColor,
        hatKind: p.hatKind,
        hatColor: p.hatColor
      } satisfies CostumePalette
    ]
  })
) as Record<PilgrimCountry, CostumePalette>

/** Chiều cao nhân vật (m) – dùng để đặt camera, bảng tên, bong bóng chat. */
export const PILGRIM_HEIGHT = 1.75

/**
 * PilgrimAvatar:
 * Vỏ bọc điều khiển nhân vật người chơi / đồng tu lân cận (LOD0).
 * Mô hình bên trong là LowPolyAvatarModel (6 bộ phận rigid, không xương).
 */
export class PilgrimAvatar {
  public root = new THREE.Group()
  private model: LowPolyAvatarModel

  private currentAction: 'standing' | 'walking' | 'bowing' | 'meditating' = 'standing'

  /** Hành động hiện tại (chỉ đọc) để TempleStage tránh gọi lại animation mỗi frame. */
  public get action(): 'standing' | 'walking' | 'bowing' | 'meditating' {
    return this.currentAction
  }
  private currentCountry: PilgrimCountry = 'vietnam'
  private currentGender: AvatarGender = 'female'
  private bowTimer = 0
  private lastStepDist = 0
  private prevPos = new THREE.Vector3()

  constructor(country: PilgrimCountry = 'vietnam', gender: AvatarGender = 'female') {
    this.currentCountry = country
    this.currentGender = gender
    this.model = new LowPolyAvatarModel(country, gender)
    this.root.add(this.model.root)
  }

  public setCountryStyle(country: PilgrimCountry) {
    this.currentCountry = country
    this.model.setCountry(country)
  }

  public getCountry(): PilgrimCountry {
    return this.currentCountry
  }

  public setGender(gender: AvatarGender) {
    this.currentGender = gender
    this.model.setGender(gender)
  }

  public getGender(): AvatarGender {
    return this.currentGender
  }

  public setRobeColor(hexColor: number) {
    this.model.setOutfitColor(hexColor)
  }

  public triggerBow() {
    this.bowTimer = 1.8
    this.currentAction = 'bowing'
    this.model.play('bow')
  }

  public setAction(action: 'standing' | 'walking' | 'bowing' | 'meditating' | string) {
    if (action === 'bow' || action === 'bowing') {
      this.triggerBow()
    } else if (action === 'meditate' || action === 'meditating') {
      this.currentAction = 'meditating'
      this.model.play('meditate')
    } else if (action === 'walking' || action === 'walk') {
      this.currentAction = 'walking'
      this.model.play('walk')
    } else {
      this.currentAction = 'standing'
      this.model.play('idle')
    }
  }

  public setNetworkEmote(emote: 'bow' | 'meditate' | 'pray' | 'idle') {
    switch (emote) {
      case 'bow':
        this.triggerBow()
        break
      case 'meditate':
        this.setAction('meditating')
        break
      case 'pray':
        this.currentAction = 'standing'
        this.model.play('pray')
        break
      default:
        this.setAction('standing')
        break
    }
  }

  public update(delta: number, isMoving: boolean, moveSpeed: number, playerWorldPos?: THREE.Vector3) {
    const isActuallyMoving = isMoving || this.currentAction === 'walking'
    this.model.update(delta, isActuallyMoving, moveSpeed || 4.8, playerWorldPos)

    if (playerWorldPos) {
      const dist = playerWorldPos.distanceTo(this.prevPos)
      this.lastStepDist += dist
      if (this.lastStepDist > 1.0) {
        FootstepSystem.getInstance().addFootstep(playerWorldPos)
        this.lastStepDist = 0
      }
      this.prevPos.copy(playerWorldPos)
    }

    if (this.bowTimer > 0) {
      this.bowTimer -= delta
      if (this.bowTimer <= 0 && this.currentAction === 'bowing') {
        this.currentAction = 'standing'
        this.model.play('idle')
      }
    }
  }

  public dispose() {
    this.model.dispose()
    this.root.clear()
  }
}
