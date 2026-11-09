import * as THREE from 'three'
import { Palette, type TimeOfDayMode } from '../style/Palette'
import { SkyDome } from '../style/SkyDome'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'

export type { TimeOfDayMode }

/**
 * AtmosphereManager (Low-poly Minimalist):
 * Vòm trời gradient phẳng + sương mù nhiều lớp + ánh sáng mặt trời/bán cầu + bóng đổ mềm.
 * Không còn Preetham Sky, không IBL/PMREM. Toàn bộ thông số lấy từ Palette.
 */
export class AtmosphereManager {
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  public skyDome: SkyDome
  public sunVector = new THREE.Vector3()

  public keyLight: THREE.DirectionalLight
  public hemiLight: THREE.HemisphereLight
  public rimLight: THREE.DirectionalLight

  public currentMode: TimeOfDayMode = 'day'

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene
    this.renderer = renderer

    // Màu thật của vật liệu phẳng được giữ nguyên, không ép tone mapping.
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1.0

    this.skyDome = new SkyDome(scene)

    // Ánh sáng bán cầu: nền tảng của vẻ ngoài phẳng, sáng đều
    this.hemiLight = new THREE.HemisphereLight(0xcfe7f2, 0xb7c6a0, 1.9)
    this.scene.add(this.hemiLight)

    // Mặt trời / trăng: đổ bóng mềm bám theo người chơi
    this.keyLight = new THREE.DirectionalLight(0xfff4de, 1.6)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(2048, 2048)
    this.keyLight.shadow.camera.near = 1.0
    this.keyLight.shadow.camera.far = 110
    const d = 30
    this.keyLight.shadow.camera.left = -d
    this.keyLight.shadow.camera.right = d
    this.keyLight.shadow.camera.top = d
    this.keyLight.shadow.camera.bottom = -d
    this.keyLight.shadow.bias = -0.0004
    this.keyLight.shadow.normalBias = 0.04
    this.keyLight.shadow.radius = 3
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)

    // Ánh sáng viền nhẹ, giúp tách hình khối khỏi nền
    this.rimLight = new THREE.DirectionalLight(0xa9d0e0, 0.35)
    this.rimLight.position.set(-18, 24, -28)
    this.scene.add(this.rimLight)

    // Sương mù tuyến tính, màu sẽ được set theo palette
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(0xdce8e0, 60, 260)
    if (!(this.scene.background instanceof THREE.Color)) this.scene.background = new THREE.Color(0xdce8e0)

    this.setTimeOfDay('day')
  }

  /** Đổi thời điểm trong ngày: cập nhật palette vật liệu, trời, sương mù, ánh sáng. */
  public setTimeOfDay(mode: TimeOfDayMode) {
    this.currentMode = mode
    const pal = Palette.get(mode)

    const phi = THREE.MathUtils.degToRad(90 - pal.sun.elevation)
    const theta = THREE.MathUtils.degToRad(pal.sun.azimuth)
    this.sunVector.setFromSphericalCoords(1, phi, theta)

    FlatMaterialFactory.getInstance().setPalette(mode)
    this.skyDome.setPalette(pal, this.sunVector, mode)

    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = pal.exposure.outdoor

    this.keyLight.color.setHex(pal.sun.color)
    this.keyLight.intensity = pal.sun.intensity
      ; (this.keyLight.shadow as any).intensity = pal.shadowStrength

    this.hemiLight.color.setHex(pal.hemi.skyColor)
    this.hemiLight.groundColor.setHex(pal.hemi.groundColor)
    this.hemiLight.intensity = pal.hemi.intensity

    this.rimLight.color.setHex(pal.rim.color)
    this.rimLight.intensity = pal.rim.intensity

    const fog = this.scene.fog as THREE.Fog
    fog.color.setHex(pal.fog.color)
    fog.near = pal.fog.near
    fog.far = pal.fog.far
      ; (this.scene.background as THREE.Color).setHex(pal.fog.color)
  }

  /** Giữ API cũ (không còn IBL). */
  public updateEnvironmentMap() {
    /* no-op: phong cách phẳng không dùng môi trường phản xạ */
  }

  /** Đưa vòm trời bám theo camera. Gọi mỗi khung hình. */
  public updateSky(cameraPos: THREE.Vector3) {
    this.skyDome.update(cameraPos)
  }

  /** Bóng đổ bám theo người chơi. */
  public updateShadowFollower(playerPos: THREE.Vector3) {
    const sunDist = 60
    // Với mặt trời thấp (hoàng hôn), nâng nguồn sáng để bóng không bị cắt cụt
    const posX = playerPos.x + this.sunVector.x * sunDist
    const posY = Math.max(playerPos.y + this.sunVector.y * sunDist, 22)
    const posZ = playerPos.z + this.sunVector.z * sunDist

    this.keyLight.position.set(posX, posY, posZ)
    this.keyLight.target.position.set(playerPos.x, playerPos.y + 1.0, playerPos.z)
    this.keyLight.target.updateMatrixWorld()
  }

  /**
   * Chất lượng bóng đổ theo mức đồ họa:
   * low = tắt bóng (giảm ~1 lượt vẽ cảnh), medium = 1024, high/ultra = 2048.
   */
  public setShadowQuality(quality: 'low' | 'medium' | 'high' | 'ultra') {
    const size = quality === 'high' || quality === 'ultra' ? 2048 : 1024
    const enabled = quality !== 'low'
    const shadow = this.keyLight.shadow
    if (shadow.mapSize.x !== size) {
      shadow.mapSize.set(size, size)
      shadow.map?.dispose()
      shadow.map = null
    }
    this.keyLight.castShadow = enabled
  }

  public dispose() {
    this.skyDome.dispose()
    this.scene.remove(this.keyLight, this.keyLight.target, this.hemiLight, this.rimLight)
    this.keyLight.shadow.map?.dispose()
  }
}
