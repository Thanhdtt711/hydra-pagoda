import * as THREE from 'three'

export interface WindUniforms {
  uWindTime: { value: number }
  uWindDirection: { value: THREE.Vector2 }
  uWindStrength: { value: number }
  uWindGust: { value: number }
}

/**
 * WindSystem (Hệ thống Gió Toàn cục Dùng chung):
 * Single Source of Truth for ambient wind simulation.
 * Drives synchronized sway for WindGrass, tree foliage, and incense smoke.
 */
export class WindSystem {
  private static instance: WindSystem | null = null

  public uniforms: WindUniforms
  private baseStrength = 0.22
  private gustAccumulator = 0
  private time = 0

  constructor(direction = new THREE.Vector2(0.85, 0.52).normalize(), baseStrength = 0.22) {
    this.baseStrength = baseStrength
    this.uniforms = {
      uWindTime: { value: 0 },
      uWindDirection: { value: direction.clone().normalize() },
      uWindStrength: { value: baseStrength },
      uWindGust: { value: 0.0 }
    }
  }

  public static getInstance(): WindSystem {
    if (!WindSystem.instance) {
      WindSystem.instance = new WindSystem()
    }
    return WindSystem.instance
  }

  public setWind(direction: THREE.Vector2, strength: number) {
    this.uniforms.uWindDirection.value.copy(direction).normalize()
    this.baseStrength = strength
    this.uniforms.uWindStrength.value = strength
  }

  public update(delta: number) {
    this.time += delta
    this.uniforms.uWindTime.value = this.time

    // Multi-harmonic natural gusting (gió thoảng từng cơn hữu cơ)
    const gust = 
      Math.sin(this.time * 0.55) * 0.35 +
      Math.sin(this.time * 0.21 + 1.2) * 0.25 +
      Math.sin(this.time * 1.15 + 2.7) * 0.15

    const currentGust = Math.max(0, gust)
    this.uniforms.uWindGust.value = currentGust
    this.uniforms.uWindStrength.value = this.baseStrength * (1.0 + currentGust * 1.2)
  }

  /**
   * Trả về vector độ lệch gió tức thời tại điểm (x, z)
   */
  public sampleWind(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const dir = this.uniforms.uWindDirection.value
    const str = this.uniforms.uWindStrength.value
    const wave = Math.sin(this.time * 2.0 + x * 0.2 + z * 0.2) * 0.3 + 0.7
    out.set(dir.x * str * wave, 0, dir.y * str * wave)
    return out
  }
}

