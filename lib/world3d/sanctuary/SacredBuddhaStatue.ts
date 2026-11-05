import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { PBRMaterialFactory } from '../materials/PBRMaterialFactory'

/**
 * SacredBuddhaStatue (Tôn tượng Đức Phật Thích Ca Mâu Ni 3D GLB - Đá Rêu Cổ Truyền):
 * Nạp model 3D điêu khắc thực tế từ /models/the_buddha_statue_in_a_mountain.glb,
 * chuẩn hóa kích thước 4.2m trang nghiêm, đổ bóng thể tích thực tế,
 * kết hợp vầng quang minh đại từ bi (Soft Radial Glow Aura) lan tỏa mờ dịu tự nhiên.
 */
export class SacredBuddhaStatue {
  public root: THREE.Group = new THREE.Group()
  private materials: PBRMaterialFactory
  public haloMesh: THREE.Mesh | null = null
  public auraLight: THREE.PointLight | null = null
  private modelGroup: THREE.Group | null = null
  public isLoaded: boolean = false
  private auraTime: number = 0

  constructor(materials: PBRMaterialFactory) {
    this.materials = materials

    // 1. Vầng quang minh đại từ bi mềm mại (Soft Radial Glow Aura)
    this.buildDharmaHalo()

    // 2. Nạp Tôn tượng Đức Phật 3D GLB đá rêu cổ truyền
    this.loadBuddhaGLB()
  }

  /**
   * Nạp model 3D GLB và tự động chuẩn hóa kích thước, căn chỉnh cao độ
   */
  private loadBuddhaGLB() {
    const loader = new GLTFLoader()
    const modelUrl = '/models/the_buddha_statue_in_a_mountain.glb'

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene

        // Đo bounding box chính xác của model
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const center = new THREE.Vector3()
        box.getCenter(center)

        // Chuẩn hóa chiều cao Tôn tượng đạt 4.2m (tương xứng với bệ Tam Bảo & Chánh Điện cao 15.5m)
        const targetHeight = 4.2
        const currentHeight = size.y > 0 ? size.y : 1
        const scaleFactor = targetHeight / currentHeight

        model.scale.setScalar(scaleFactor)

        // Căn giữa mặt phẳng X=0, Z=0 và đặt đáy đài sen tiếp xúc chính xác mặt trên bệ đá (Y = 0)
        model.position.x = -center.x * scaleFactor
        model.position.y = -box.min.y * scaleFactor
        model.position.z = -center.z * scaleFactor

        // Cấu hình vật liệu Đá rêu cổ truyền PBR & bật đổ bóng thể tích
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            mesh.castShadow = true
            mesh.receiveShadow = true

            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial
              mat.roughness = 0.82
              mat.metalness = 0.05
              mat.envMapIntensity = 0.85
              mat.needsUpdate = true
            }
          }
        })

        this.modelGroup = model
        this.root.add(model)
        this.isLoaded = true

        // Định vị vầng quang minh mềm mại ra hẳn phía sau đầu Tôn tượng (Z <= -1.25m)
        if (this.haloMesh) {
          this.haloMesh.position.set(0, 3.60, -1.25)
        }
        if (this.auraLight) {
          this.auraLight.position.set(0, 3.60, -1.40)
        }
      },
      undefined,
      (error) => {
        console.warn('[SacredBuddhaStatue] Failed to load GLB model, falling back to procedural:', error)
        this.buildProceduralFallback()
      }
    )
  }

  /**
   * Phương án dự phòng (fallback) nếu môi trường không nạp được GLB
   */
  private buildProceduralFallback() {
    const stoneMat = this.materials.createGraniteStepMaterial()
    const goldMat = this.materials.createSacredGoldLeafMaterial()

    // Bệ đá dự phòng
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.6, 8), stoneMat)
    base.position.y = 0.3
    this.root.add(base)

    // Tượng Phật thếp vàng dự phòng
    const figure = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 2.8, 16), goldMat)
    figure.position.y = 1.7
    figure.castShadow = true
    this.root.add(figure)
  }

  /**
   * Vầng quang minh đại từ bi (Soft Radial Glow Aura):
   * Ánh sáng hào quang mềm mại lan tỏa mờ dịu từ tâm ra ngoài vô tận (Additive Blending),
   * hoàn toàn không có đường viền cắt cúp hay vòng tròn thô cứng.
   */
  private buildDharmaHalo() {
    if (typeof document === 'undefined') return

    // 1. Tạo texture gradient quang minh mềm
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const grad = ctx.createRadialGradient(256, 256, 12, 256, 256, 256)
    grad.addColorStop(0.0, 'rgba(255, 245, 205, 0.90)') // Tâm sáng quang minh ấm áp
    grad.addColorStop(0.20, 'rgba(255, 210, 120, 0.60)')
    grad.addColorStop(0.45, 'rgba(255, 160, 45, 0.28)')
    grad.addColorStop(0.72, 'rgba(215, 105, 20, 0.08)')
    grad.addColorStop(1.0, 'rgba(160, 60, 0, 0.0)')      // Mờ dần ra không gian vô cực (0 đường viền)

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 512)

    const glowTex = new THREE.CanvasTexture(canvas)

    // 2. Tấm vầng sáng lớn (Soft Glow Plane)
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })

    const glowGeo = new THREE.PlaneGeometry(3.6, 3.6)
    this.haloMesh = new THREE.Mesh(glowGeo, glowMat)
    this.haloMesh.position.set(0, 3.60, -1.25)
    this.root.add(this.haloMesh)

    // 3. Đèn điểm quang minh ấm áp hắt nhẹ sau gáy (sau vị trí vầng sáng)
    this.auraLight = new THREE.PointLight(0xffb855, 1.3, 7.0, 1.8)
    this.auraLight.position.set(0, 3.60, -1.40)
    this.auraLight.castShadow = false
    this.root.add(this.auraLight)
  }

  /**
   * Cập nhật chuyển động thở nhẹ của vầng quang minh (Breathing pulse)
   */
  public update(delta: number) {
    this.auraTime += delta
    if (this.haloMesh) {
      // Vầng quang minh thở nhẹ nhàng linh thiêng
      const pulse = 1.0 + Math.sin(this.auraTime * 1.5) * 0.035
      this.haloMesh.scale.set(pulse, pulse, 1.0)
    }
  }

  /**
   * Giải phóng tài nguyên bộ nhớ sạch sẽ (Zero-leak)
   */
  public dispose() {
    if (this.modelGroup) {
      this.modelGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          mesh.geometry?.dispose()
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              if ('map' in m && m.map) m.map.dispose()
              m.dispose()
            })
          } else if (mesh.material) {
            const m = mesh.material as any
            if (m.map) m.map.dispose()
            m.dispose()
          }
        }
      })
      this.root.remove(this.modelGroup)
      this.modelGroup = null
    }

    if (this.haloMesh) {
      this.haloMesh.geometry?.dispose()
      if (this.haloMesh.material) {
        const mat = this.haloMesh.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.dispose()
      }
      this.root.remove(this.haloMesh)
      this.haloMesh = null
    }

    if (this.auraLight) {
      this.root.remove(this.auraLight)
      this.auraLight = null
    }
  }
}
