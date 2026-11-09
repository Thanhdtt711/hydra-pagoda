import * as THREE from 'three'

export type AvatarExpression = 'serene' | 'smile' | 'meditating' | 'surprised'
export type AvatarAnimation = 'idle' | 'walk' | 'bow' | 'meditate' | 'pray' | 'wave'
export type AvatarBodyShape = 'regular' | 'tall' | 'chubby'
export type AvatarGender = 'female' | 'male'

export type PilgrimCountry =
  | 'vietnam'
  | 'japan'
  | 'thailand'
  | 'korea'
  | 'taiwan'
  | 'singapore'
  | 'india'
  | 'tibet'
  | 'western'

/**
 * AvatarModel:
 * Common contract for 3D character avatars in "Vạn Cảnh Thiền Tự".
 * Allows seamless hot-swapping between LowPolyAvatarModel and future GLTFAvatarModel (.glb)
 * without touching TempleStage or TempleCanvas.vue.
 */
export interface AvatarModel {
  root: THREE.Group

  setCountry(country: PilgrimCountry): void
  setGender(gender: AvatarGender): void
  setOutfitColor(colorHex: number): void
  setExpression(expression: AvatarExpression): void
  setBodyShape(shape: AvatarBodyShape): void
  play(anim: AvatarAnimation): void
  update(delta: number, isMoving?: boolean, moveSpeed?: number, worldPos?: THREE.Vector3): void
  dispose(): void
}

