import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { SlotBatch } from '../style/SlotBatch'

/**
 * SacredBuddhaStatue (Tôn tượng Đức Phật Thích Ca Mâu Ni, phong cách low-poly phẳng màu):
 * - Nạp duy nhất một model GLB /models/the_buddha_statue_in_a_mountain.glb (hỗ trợ nén meshopt),
 *   bỏ toàn bộ texture / PBR gốc và gán vật liệu phẳng màu 'gold' của Palette (tự đổi theo ngày / hoàng hôn / đêm).
 * - Chuẩn hóa cao 4.2m, đáy chạm y = 0 của gốc `root`.
 * - Vầng hào quang là một đĩa phẳng cộng sáng (additive), KHÔNG dùng PointLight.
 * - Có phương án dự phòng procedural low-poly nếu không nạp được GLB.
 */
export class SacredBuddhaStatue {
  public root: THREE.Group = new THREE.Group()
  public haloMesh: THREE.Mesh
  public isLoaded = false

  private modelGroup: THREE.Object3D | null = null
  private fallbackGroup: THREE.Group | null = null
  private haloMaterial: THREE.MeshBasicMaterial
  private time = 0
  private disposed = false

  constructor() {
    this.root.name = 'sacred_buddha_statue'

    // Vầng quang minh: đĩa tròn 24 cạnh phẳng, cộng sáng nhẹ
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd98a,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    })
    this.haloMesh = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), this.haloMaterial)
    this.haloMesh.name = 'buddha_halo'
    this.haloMesh.position.set(0, 3.6, -1.25)
    this.haloMesh.renderOrder = 2
    this.root.add(this.haloMesh)

    this.loadBuddhaGLB()
  }

  private loadBuddhaGLB() {
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)

    loader.load(
      '/models/the_buddha_statue_in_a_mountain.glb',
      (gltf) => {
        if (this.disposed) return
        const model = gltf.scene

        // Chuẩn hóa chiều cao 4.2m, căn giữa X/Z, đáy chạm y = 0
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)
        const scale = 4.2 / (size.y > 0 ? size.y : 1)
        model.scale.setScalar(scale)
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)

        // Thay mọi vật liệu gốc bằng vật liệu phẳng màu của Palette
        const goldMat = FlatMaterialFactory.getInstance().get('gold')
        const oldMaterials = new Set<THREE.Material>()
        model.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (!mesh.isMesh) return
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => m && oldMaterials.add(m))
          mesh.material = goldMat
          mesh.castShadow = true
          mesh.receiveShadow = true
        })
        oldMaterials.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial
          std.map?.dispose()
          std.normalMap?.dispose()
          std.roughnessMap?.dispose()
          std.metalnessMap?.dispose()
          std.aoMap?.dispose()
          std.emissiveMap?.dispose()
          m.dispose()
        })

        this.modelGroup = model
        this.root.add(model)
        this.isLoaded = true
        this.haloMesh.position.set(0, 3.6, -1.25)
      },
      undefined,
      (error) => {
        console.warn('[SacredBuddhaStatue] Không nạp được GLB, dùng bản procedural low-poly:', error)
        if (!this.disposed) this.buildProceduralFallback()
      }
    )
  }

  /** Tượng ngồi thiền low-poly: đài sen 2 tầng, thân, tay, đầu, búi tóc. */
  private buildProceduralFallback() {
    const b = new SlotBatch()
    // Đài sen
    b.cylinder('stone', 1.7, 1.9, 0.35, 8, 0, 0.175, 0)
    b.cylinder('lotus', 1.45, 1.7, 0.3, 8, 0, 0.5, 0)
    b.cylinder('gold', 1.2, 1.45, 0.25, 8, 0, 0.775, 0)
    // Thân ngồi kiết già
    b.cylinder('gold', 1.0, 1.25, 0.55, 8, 0, 1.18, 0)
    b.cylinder('gold', 0.62, 0.95, 1.2, 8, 0, 1.95, 0)
    // Hai tay đặt trên gối
    b.box('gold', 0.7, 0.2, 0.45, 0, 1.55, 0.55)
    // Vai, cổ, đầu, búi tóc
    b.cylinder('gold', 0.34, 0.62, 0.35, 8, 0, 2.7, 0)
    b.cylinder('skin', 0.16, 0.2, 0.2, 8, 0, 2.95, 0)
    b.sphere('skin', 0.38, 0, 0, 3.3, 0.02)
    b.cone('gold', 0.2, 0.3, 6, 0, 3.78, 0.02)

    this.fallbackGroup = b.build({ name: 'buddha_fallback' })
    this.root.add(this.fallbackGroup)
    this.isLoaded = true
    this.haloMesh.position.set(0, 3.3, -0.9)
  }

  public update(delta: number) {
    this.time += delta
    const pulse = 1 + Math.sin(this.time * 1.5) * 0.035
    this.haloMesh.scale.setScalar(pulse)
  }

  public dispose() {
    this.disposed = true
    if (this.modelGroup) {
      this.modelGroup.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose()
      })
      this.root.remove(this.modelGroup)
      this.modelGroup = null
    }
    if (this.fallbackGroup) {
      SlotBatch.disposeGeometries(this.fallbackGroup)
      this.root.remove(this.fallbackGroup)
      this.fallbackGroup = null
    }
    this.haloMesh.geometry.dispose()
    this.haloMaterial.dispose()
    this.root.remove(this.haloMesh)
  }
}
