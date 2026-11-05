import * as THREE from 'three'
import { FootstepSystem } from './characters/FootstepSystem'
import { ProceduralAvatarModel, CHIBI_PALETTES } from './characters/ProceduralAvatarModel'
import type { PilgrimCountry } from './characters/AvatarModel'

export type { PilgrimCountry } from './characters/AvatarModel'

export interface CostumePalette {
  robeColor: number
  trimColor: number
  innerColor: number
  sashColor: number
  skinColor: number
  rosaryColor: number
  hatKind: 'non_la' | 'man_velvet' | 'kasa_japan' | 'gat_korea' | 'shaved_monk' | 'tibet_cowl'
  hatColor: number
  auraColor: number
}

export const PALETTES: Record<PilgrimCountry, CostumePalette> = {
  vietnam: {
    robeColor: CHIBI_PALETTES.vietnam.robeColor,
    trimColor: CHIBI_PALETTES.vietnam.trimColor,
    innerColor: CHIBI_PALETTES.vietnam.innerColor,
    sashColor: CHIBI_PALETTES.vietnam.sashColor,
    skinColor: CHIBI_PALETTES.vietnam.skinColor,
    rosaryColor: 0x4a2c11,
    hatKind: 'non_la',
    hatColor: CHIBI_PALETTES.vietnam.hatColor,
    auraColor: 0xffd166
  },
  japan: {
    robeColor: CHIBI_PALETTES.japan.robeColor,
    trimColor: CHIBI_PALETTES.japan.trimColor,
    innerColor: CHIBI_PALETTES.japan.innerColor,
    sashColor: CHIBI_PALETTES.japan.sashColor,
    skinColor: CHIBI_PALETTES.japan.skinColor,
    rosaryColor: 0x2b2d42,
    hatKind: 'kasa_japan',
    hatColor: CHIBI_PALETTES.japan.hatColor,
    auraColor: 0xedf2f4
  },
  thailand: {
    robeColor: CHIBI_PALETTES.thailand.robeColor,
    trimColor: CHIBI_PALETTES.thailand.trimColor,
    innerColor: CHIBI_PALETTES.thailand.innerColor,
    sashColor: CHIBI_PALETTES.thailand.sashColor,
    skinColor: CHIBI_PALETTES.thailand.skinColor,
    rosaryColor: 0x8a3324,
    hatKind: 'shaved_monk',
    hatColor: 0x000000,
    auraColor: 0xffbe0b
  },
  korea: {
    robeColor: CHIBI_PALETTES.korea.robeColor,
    trimColor: CHIBI_PALETTES.korea.trimColor,
    innerColor: CHIBI_PALETTES.korea.innerColor,
    sashColor: CHIBI_PALETTES.korea.sashColor,
    skinColor: CHIBI_PALETTES.korea.skinColor,
    rosaryColor: 0x3e2723,
    hatKind: 'gat_korea',
    hatColor: CHIBI_PALETTES.korea.hatColor,
    auraColor: 0x90e0ef
  },
  taiwan: {
    robeColor: CHIBI_PALETTES.taiwan.robeColor,
    trimColor: CHIBI_PALETTES.taiwan.trimColor,
    innerColor: CHIBI_PALETTES.taiwan.innerColor,
    sashColor: CHIBI_PALETTES.taiwan.sashColor,
    skinColor: CHIBI_PALETTES.taiwan.skinColor,
    rosaryColor: 0x582f0e,
    hatKind: 'man_velvet',
    hatColor: CHIBI_PALETTES.taiwan.hatColor,
    auraColor: 0xffe6a7
  },
  singapore: {
    robeColor: CHIBI_PALETTES.singapore.robeColor,
    trimColor: CHIBI_PALETTES.singapore.trimColor,
    innerColor: CHIBI_PALETTES.singapore.innerColor,
    sashColor: CHIBI_PALETTES.singapore.sashColor,
    skinColor: CHIBI_PALETTES.singapore.skinColor,
    rosaryColor: 0x331800,
    hatKind: 'man_velvet',
    hatColor: CHIBI_PALETTES.singapore.hatColor,
    auraColor: 0xffe3a8
  },
  india: {
    robeColor: CHIBI_PALETTES.india.robeColor,
    trimColor: CHIBI_PALETTES.india.trimColor,
    innerColor: CHIBI_PALETTES.india.innerColor,
    sashColor: CHIBI_PALETTES.india.sashColor,
    skinColor: CHIBI_PALETTES.india.skinColor,
    rosaryColor: 0x472d30,
    hatKind: 'shaved_monk',
    hatColor: 0x000000,
    auraColor: 0xff9f1c
  },
  tibet: {
    robeColor: CHIBI_PALETTES.tibet.robeColor,
    trimColor: CHIBI_PALETTES.tibet.trimColor,
    innerColor: CHIBI_PALETTES.tibet.innerColor,
    sashColor: CHIBI_PALETTES.tibet.sashColor,
    skinColor: CHIBI_PALETTES.tibet.skinColor,
    rosaryColor: 0x261447,
    hatKind: 'tibet_cowl',
    hatColor: CHIBI_PALETTES.tibet.hatColor,
    auraColor: 0xffba08
  },
  western: {
    robeColor: CHIBI_PALETTES.western.robeColor,
    trimColor: CHIBI_PALETTES.western.trimColor,
    innerColor: CHIBI_PALETTES.western.innerColor,
    sashColor: CHIBI_PALETTES.western.sashColor,
    skinColor: CHIBI_PALETTES.western.skinColor,
    rosaryColor: 0x381d0f,
    hatKind: 'shaved_monk',
    hatColor: 0x000000,
    auraColor: 0xddb892
  }
}

/**
 * PilgrimAvatar:
 * Wrapper lớp nhân vật Hành Giả Cổ Tự chuẩn Chibi 3.8 đầu (~1.38m).
 * Kế thừa toàn bộ giao diện điều khiển của TempleStage & MultiplayerClient.
 */
export class PilgrimAvatar {
  public root: THREE.Group = new THREE.Group()
  public model: ProceduralAvatarModel

  public currentAction: 'standing' | 'walking' | 'bowing' | 'meditating' = 'standing'
  public bowTimer = 0
  private currentCountry: PilgrimCountry = 'vietnam'

  // Dấu chân hoa sen nở theo bước (Bộ bộ sinh liên)
  private lastStepDist = 0
  private prevPos = new THREE.Vector3()

  constructor() {
    this.model = new ProceduralAvatarModel('vietnam')
    this.root.add(this.model.root)
  }

  public setCountryStyle(country: PilgrimCountry) {
    this.currentCountry = country
    this.model.setCountry(country)
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
        this.setAction('standing')
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
