import * as THREE from 'three'
import type { PBRMaterialFactory } from '../materials/PBRMaterialFactory'

export interface TerrainChunk {
  mesh: THREE.Mesh
  cx: number
  cz: number
  center: THREE.Vector3
}

/**
 * TerrainSystem (Hệ thống Địa hình & Bản đồ Mở rộng ~400 x 400m):
 * - Chia lưới chunk 64m x 64m (6x6 = 36 chunks bao phủ [-192, 192]m x [-192, 192]m)
 * - Mặt bằng sân chùa và ngự đạo phẳng (y = 0.0)
 * - Đồi thiền Zen thoai thoải ngoại vi lượn sóng tự nhiên
 * - Thuật toán getSurfaceY(x, z) zero-allocation đồng bộ 100% giữa hình học và va chạm
 * - Culling chunk theo khoảng cách camera
 */
export class TerrainSystem {
  public root: THREE.Group = new THREE.Group()
  private chunks: TerrainChunk[] = []
  private materials: PBRMaterialFactory
  private sharedMaterial: THREE.MeshStandardMaterial

  public static readonly WORLD_SIZE = 384 // 6 chunks * 64m = 384m
  public static readonly CHUNK_SIZE = 64
  public static readonly CHUNKS_PER_AXIS = 6 // 6x6 grid

  constructor(materials: PBRMaterialFactory) {
    this.materials = materials
    this.root.name = 'TerrainSystem'

    // Tạo vật liệu đất rêu phong tự nhiên PBR có hỗ trợ vertexColors
    const baseMat = this.materials.createMossyEarthMaterial()
    this.sharedMaterial = baseMat.clone()
    this.sharedMaterial.vertexColors = true
    this.sharedMaterial.roughness = 0.92

    this.buildTerrainChunks()
  }

  /**
   * Tính toán độ cao địa hình giải tích tại tọa độ bất kỳ (x, z)
   * Phẳng tại sân chùa (|x| <= 28, z in [-32, 28]) và lối đi Nam dẫn ra ngoài
   */
  public static computeElevation(x: number, z: number): number {
    // 1. Khuôn viên chùa trung tâm phẳng tuyệt đối
    const inCourtyardX = Math.abs(x) < 26.0
    const inCourtyardZ = z > -32.0 && z < 28.0
    if (inCourtyardX && inCourtyardZ) {
      return 0.0
    }

    // 2. Trục đường dẫn Nam ra cổng ngoài (Đường rộng 9m dọc trục Z)
    if (Math.abs(x) < 4.8 && z >= 26.0 && z <= 120.0) {
      return 0.0
    }

    // 3. Tính khoảng cách tới biên khuôn viên chùa
    const dx = Math.max(0, Math.abs(x) - 26.0)
    let dz = 0
    if (z < -32.0) dz = -32.0 - z
    else if (z > 28.0) dz = z - 28.0

    const distFromTemple = Math.hypot(dx, dz)
    if (distFromTemple <= 0.001) return 0.0

    // Vùng chuyển tiếp thoai thoải (blend zone 12m)
    const blendFactor = Math.min(distFromTemple / 12.0, 1.0)
    const smoothT = blendFactor * blendFactor * (3.0 - 2.0 * blendFactor)

    // Sóng đồi Zen thoai thoải bằng các hàm điều hòa mượt
    const wave1 = Math.sin(x * 0.028 + 1.2) * Math.cos(z * 0.024 + 0.5) * 3.8
    const wave2 = Math.sin(x * 0.055 - z * 0.042) * 1.6
    const wave3 = Math.cos(x * 0.012 + z * 0.015) * 2.2

    // Độ dâng nhẹ về các rặng đồi bao quanh ngoại vi
    const distFromCenter = Math.hypot(x, z)
    const perimeterRise = Math.max(0, distFromCenter - 90.0) * 0.06

    const rawHeight = Math.max(0, wave1 + wave2 + wave3 + perimeterRise)
    return rawHeight * smoothT
  }

  /**
   * Phương thức truy vấn cao độ mặt đất cho CollisionWorld
   */
  public getSurfaceY(x: number, z: number): number {
    return TerrainSystem.computeElevation(x, z)
  }

  private buildTerrainChunks() {
    const halfWorld = TerrainSystem.WORLD_SIZE * 0.5
    const chunkSize = TerrainSystem.CHUNK_SIZE
    const segments = 24 // 24x24 quads mỗi chunk -> lưới mượt mà, nhẹ nhàng

    for (let ix = 0; ix < TerrainSystem.CHUNKS_PER_AXIS; ix++) {
      for (let iz = 0; iz < TerrainSystem.CHUNKS_PER_AXIS; iz++) {
        const originX = -halfWorld + ix * chunkSize
        const originZ = -halfWorld + iz * chunkSize
        const centerX = originX + chunkSize * 0.5
        const centerZ = originZ + chunkSize * 0.5

        const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, segments, segments)
        geo.rotateX(-Math.PI * 0.5)

        const posAttr = geo.attributes.position
        const count = posAttr.count
        const colors = new Float32Array(count * 3)

        const colorGrass = new THREE.Color(0x354f26)
        const colorSoil = new THREE.Color(0x23291d)
        const colorHigh = new THREE.Color(0x425d2c)

        for (let i = 0; i < count; i++) {
          const localX = posAttr.getX(i)
          const localZ = posAttr.getZ(i)
          const worldX = centerX + localX
          const worldZ = centerZ + localZ

          const y = TerrainSystem.computeElevation(worldX, worldZ)
          posAttr.setY(i, y)

          // Vertex color splatting
          const distTemple = Math.hypot(Math.max(0, Math.abs(worldX) - 26), Math.max(0, Math.abs(worldZ) - 28))
          const vertexColor = new THREE.Color()

          if (distTemple < 8.0) {
            vertexColor.copy(colorSoil)
          } else if (y > 3.5) {
            vertexColor.copy(colorHigh)
          } else {
            vertexColor.copy(colorGrass)
          }

          colors[i * 3] = vertexColor.r
          colors[i * 3 + 1] = vertexColor.g
          colors[i * 3 + 2] = vertexColor.b
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geo.computeVertexNormals()

        const mesh = new THREE.Mesh(geo, this.sharedMaterial)
        mesh.position.set(centerX, 0, centerZ)
        mesh.receiveShadow = true
        mesh.name = `TerrainChunk_${ix}_${iz}`

        this.root.add(mesh)
        this.chunks.push({
          mesh,
          cx: ix,
          cz: iz,
          center: new THREE.Vector3(centerX, 0, centerZ)
        })
      }
    }
  }

  /**
   * Culling các chunk ở quá xa camera để tiết kiệm băng thông GPU
   */
  public update(cameraPosition: THREE.Vector3, maxDistance = 240) {
    const maxDistSq = maxDistance * maxDistance
    for (const chunk of this.chunks) {
      const dx = chunk.center.x - cameraPosition.x
      const dz = chunk.center.z - cameraPosition.z
      const distSq = dx * dx + dz * dz
      chunk.mesh.visible = distSq <= maxDistSq
    }
  }

  public dispose() {
    for (const chunk of this.chunks) {
      chunk.mesh.geometry.dispose()
    }
    this.chunks = []
    this.sharedMaterial.dispose()
  }
}

