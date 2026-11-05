import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { LightingConfig, type TimeOfDayMode, type TimePresetConfig } from './LightingConfig'

export type { TimeOfDayMode }

/**
 * AtmosphereManager:
 * Physical Preetham Sky, dynamic PMREM Environment Map (IBL reflections for PBR materials),
 * and player-following Cascaded Sun Shadow.
 * Configured via unified LightingConfig.
 */
export class AtmosphereManager {
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  public sky: Sky
  private bakerSky: Sky
  private skyScene: THREE.Scene
  public sunVector = new THREE.Vector3()

  public keyLight: THREE.DirectionalLight
  public hemiLight: THREE.HemisphereLight
  public rimLight: THREE.DirectionalLight

  private pmremGenerator: THREE.PMREMGenerator
  private currentEnvRenderTarget: THREE.WebGLRenderTarget | null = null
  public currentMode: TimeOfDayMode = 'day'

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene
    this.renderer = renderer
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    this.pmremGenerator.compileCubemapShader()

    // 1. Preetham Physical Sky
    this.sky = new Sky()
    this.sky.scale.setScalar(450)
    this.scene.add(this.sky)

    // Dedicated sky scene for clean PMREM environment map baking
    this.skyScene = new THREE.Scene()
    this.bakerSky = new Sky()
    this.bakerSky.scale.setScalar(450)
    this.skyScene.add(this.bakerSky)

    // 2. Hemisphere Ambient Light
    this.hemiLight = new THREE.HemisphereLight(0x98c7f0, 0x484236, 0.38)
    this.scene.add(this.hemiLight)

    // 3. Key Sunlight (Cascaded Follower Shadow)
    this.keyLight = new THREE.DirectionalLight(0xfff6ea, 1.10)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.width = 2048
    this.keyLight.shadow.mapSize.height = 2048
    this.keyLight.shadow.camera.near = 1.0
    this.keyLight.shadow.camera.far = 95

    const d = 26
    this.keyLight.shadow.camera.left = -d
    this.keyLight.shadow.camera.right = d
    this.keyLight.shadow.camera.top = d
    this.keyLight.shadow.camera.bottom = -d
    this.keyLight.shadow.bias = -0.0003
    this.keyLight.shadow.normalBias = 0.032
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)

    // 4. Rim light for silhouette definition
    this.rimLight = new THREE.DirectionalLight(0x78a4c8, 0.20)
    this.rimLight.position.set(-18, 24, -28)
    this.scene.add(this.rimLight)

    // Initialize with default daytime
    this.setTimeOfDay('day')
  }

  /**
   * Set Time of Day: updates Sky uniforms, sun vector, lighting colors, and regenerates IBL PMREM map
   */
  public setTimeOfDay(mode: TimeOfDayMode) {
    this.currentMode = mode
    const cfg = LightingConfig.getPreset(mode)

    // Compute sun direction from spherical angles
    const phi = THREE.MathUtils.degToRad(90 - cfg.sun.elevation)
    const theta = THREE.MathUtils.degToRad(cfg.sun.azimuth)
    this.sunVector.setFromSphericalCoords(1, phi, theta)

    // Update Sky Uniforms
    const uniforms = this.sky.material.uniforms as any
    uniforms.turbidity.value = cfg.sky.turbidity
    uniforms.rayleigh.value = cfg.sky.rayleigh
    uniforms.mieCoefficient.value = cfg.sky.mieCoefficient
    uniforms.mieDirectionalG.value = cfg.sky.mieDirectionalG
    uniforms.sunPosition.value.copy(this.sunVector)

    // Sync baker sky uniforms for PMREM environment map
    const bakerUniforms = this.bakerSky.material.uniforms as any
    bakerUniforms.turbidity.value = cfg.sky.turbidity
    bakerUniforms.rayleigh.value = cfg.sky.rayleigh
    bakerUniforms.mieCoefficient.value = cfg.sky.mieCoefficient
    bakerUniforms.mieDirectionalG.value = cfg.sky.mieDirectionalG
    bakerUniforms.sunPosition.value.copy(this.sunVector)

    if (mode === 'night') {
      if (uniforms.cloudCoverage) uniforms.cloudCoverage.value = 0.0
      if (uniforms.cloudDensity) uniforms.cloudDensity.value = 0.0
      this.sky.visible = true
      this.bakerSky.visible = true
    } else if (mode === 'sunset') {
      this.sky.visible = true
      this.bakerSky.visible = true
      if (uniforms.cloudCoverage) uniforms.cloudCoverage.value = 0.15
      if (uniforms.cloudDensity) uniforms.cloudDensity.value = 0.20
    } else {
      this.sky.visible = true
      this.bakerSky.visible = true
      if (uniforms.cloudCoverage) uniforms.cloudCoverage.value = 0.08
      if (uniforms.cloudDensity) uniforms.cloudDensity.value = 0.12
    }

    // Update Tone Mapping & Exposure
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = cfg.exposure.outdoor

    // Update Lights
    this.keyLight.color.setHex(cfg.sun.color)
    this.keyLight.intensity = cfg.sun.intensity

    this.hemiLight.color.setHex(cfg.hemi.skyColor)
    this.hemiLight.groundColor.setHex(cfg.hemi.groundColor)
    this.hemiLight.intensity = cfg.hemi.intensity

    this.rimLight.color.setHex(cfg.rim.color)
    this.rimLight.intensity = cfg.rim.intensity

    // Update Fog
    const fog = this.scene.fog as THREE.Fog
    if (fog) {
      fog.color.setHex(cfg.fog.color)
      fog.near = cfg.fog.near
      fog.far = cfg.fog.far
    }
    this.scene.background = new THREE.Color(cfg.fog.color)

    // Regenerate PMREM IBL environment map with gentle, balanced intensity
    this.updateEnvironmentMap()
  }

  /**
   * Bake the current physical sky into PMREM cubemap for IBL specular reflections on PBR materials
   */
  public updateEnvironmentMap() {
    if (this.currentEnvRenderTarget) {
      this.currentEnvRenderTarget.dispose()
      this.currentEnvRenderTarget = null
    }

    const cfg = LightingConfig.getPreset(this.currentMode)

    try {
      this.currentEnvRenderTarget = this.pmremGenerator.fromScene(this.skyScene)
      this.scene.environment = this.currentEnvRenderTarget.texture
      ;(this.scene as any).environmentIntensity = cfg.ibl.intensity
    } catch (e) {
      console.warn('[AtmosphereManager] PMREM IBL generation fallback:', e)
      this.scene.environment = null
    }
  }

  /**
   * Follower Sun Shadow: keeps shadow camera focused around the player's position
   */
  public updateShadowFollower(playerPos: THREE.Vector3) {
    // Offset direction from sun vector
    const sunDist = 55
    const posX = playerPos.x + this.sunVector.x * sunDist
    const posY = Math.max(playerPos.y + this.sunVector.y * sunDist, 25)
    const posZ = playerPos.z + this.sunVector.z * sunDist

    this.keyLight.position.set(posX, posY, posZ)
    this.keyLight.target.position.set(playerPos.x, playerPos.y + 1.0, playerPos.z)
    this.keyLight.target.updateMatrixWorld()
  }

  public dispose() {
    if (this.currentEnvRenderTarget) {
      this.currentEnvRenderTarget.dispose()
      this.currentEnvRenderTarget = null
    }
    this.pmremGenerator.dispose()
    this.bakerSky.geometry.dispose()
    ;(this.bakerSky.material as THREE.Material).dispose()
    this.sky.geometry.dispose()
    ;(this.sky.material as THREE.Material).dispose()
  }
}
