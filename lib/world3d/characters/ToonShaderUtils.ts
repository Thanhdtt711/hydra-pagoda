import * as THREE from 'three'

/**
 * ToonShaderUtils:
 * Gradient ramps and cartoon stylized material helpers for cozy anime/chibi aesthetics.
 * Uses a smooth 4-step velvety cel ramp with LinearFilter to eliminate facet artifacts.
 */
export class ToonShaderUtils {
  private static gradientMap: THREE.DataTexture | null = null

  public static get3ToneGradientMap(): THREE.DataTexture {
    if (!this.gradientMap) {
      // 4-step soft velvety cel ramp
      const colors = new Uint8Array([85, 145, 205, 255])
      const tex = new THREE.DataTexture(colors, 4, 1, THREE.RedFormat)
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.needsUpdate = true
      this.gradientMap = tex
    }
    return this.gradientMap
  }

  /**
   * Tạo vật liệu Toon Material mềm mại phong cách Cozy Anime Cel-Shading
   */
  public static createToonMaterial(parameters: {
    color: number
    map?: THREE.Texture | null
    normalMap?: THREE.Texture | null
    normalScale?: THREE.Vector2
    side?: THREE.Side
  }): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({
      color: parameters.color,
      map: parameters.map || null,
      normalMap: parameters.normalMap || null,
      normalScale: parameters.normalScale || new THREE.Vector2(0.15, 0.15),
      gradientMap: this.get3ToneGradientMap(),
      side: parameters.side ?? THREE.FrontSide
    })
  }

  /**
   * Tạo viền nét Inverted-Hull mềm mại cho nhân vật hoạt hình
   */
  public static createOutlineMesh(
    geometry: THREE.BufferGeometry,
    thickness = 0.015,
    color = 0x2e1f18
  ): THREE.Mesh {
    const outlineMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.BackSide
    })
    const outline = new THREE.Mesh(geometry, outlineMat)
    outline.scale.setScalar(1 + thickness)
    return outline
  }
}
