import * as THREE from 'three'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { Palette, type TimeOfDayMode } from '../style/Palette'

export interface TerrainChunk {
  mesh: THREE.Mesh
  cx: number
  cz: number
  center: THREE.Vector3
  /** Tham số tô màu mỗi đỉnh (đã lấy trung bình theo mặt): [soil, heightT, jitter]. */
  params: Float32Array
}

/**
 * TerrainSystem (Địa hình Low-poly Minimalist ~400 x 400m):
 * - Lưới chunk 64m x 64m (6x6 = 36 chunks bao phủ [-192, 192]m)
 * - Mặt phẳng tô màu phẳng theo từng tam giác (non-indexed, flat shading), không texture
 * - Màu theo palette (cỏ / cỏ tối / đất) + gradient theo độ cao, đổi màu tại chỗ qua setPalette()
 * - computeElevation / getSurfaceY giữ nguyên để đồng bộ với va chạm, cây, cỏ
 */
export class TerrainSystem {
  public root: THREE.Group = new THREE.Group()
  private chunks: TerrainChunk[] = []
  private material: THREE.Material

  public static readonly WORLD_SIZE = 384 // 6 chunks * 64m = 384m
  public static readonly CHUNK_SIZE = 64
  public static readonly CHUNKS_PER_AXIS = 6 // 6x6 grid

  /** Số ô mỗi cạnh chunk. 20 -> mặt tam giác ~3.2m, đủ "facet" mà vẫn nhẹ (~29k tri). */
  private static readonly SEGMENTS = 20

  /** Tham số giữ chỗ để tương thích chỗ gọi cũ (new TerrainSystem(this.materials)). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_legacyMaterials?: unknown) {
    this.root.name = 'TerrainSystem'
    this.material = FlatMaterialFactory.getInstance().vertexColor()
    this.buildTerrainChunks()
    this.setPalette(FlatMaterialFactory.getInstance().currentMode)
  }

  /**
   * Tính toán độ cao địa hình giải tích tại tọa độ bất kỳ (x, z)
   * Phẳng tuyệt đối tại sân chùa trung tâm + khu Nhà Hầu Đồng phía Đông (x in [-26, 52], z in [-32, 28])
   * và lối đi Nam dẫn ra ngoài
   */
  public static computeElevation(x: number, z: number): number {
    // 1. Khuôn viên chùa trung tâm & Điện Thờ Tứ Phủ (Nhà Hầu Đồng phía Đông) phẳng tuyệt đối
    const inCourtyardX = x > -26.0 && x < 52.0
    const inCourtyardZ = z > -32.0 && z < 28.0
    if (inCourtyardX && inCourtyardZ) {
      return 0.0
    }

    // 2. Trục đường dẫn Nam ra cổng ngoài (Đường rộng 9m dọc trục Z)
    if (Math.abs(x) < 4.8 && z >= 26.0 && z <= 120.0) {
      return 0.0
    }

    // 3. Tính khoảng cách tới biên khuôn viên chùa (Tây -26m, Đông +52m, Bắc -32m, Nam +28m)
    let dx = 0
    if (x <= -26.0) dx = -26.0 - x
    else if (x >= 52.0) dx = x - 52.0

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

    // Độ dốc đồi bao quanh ngoại vi
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

  /** Hash ổn định [0,1) theo ô lưới để tạo biến thiên màu giữa các mặt. */
  private static hash2(a: number, b: number): number {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return s - Math.floor(s)
  }

  private buildTerrainChunks() {
    const halfWorld = TerrainSystem.WORLD_SIZE * 0.5
    const chunkSize = TerrainSystem.CHUNK_SIZE
    const segs = TerrainSystem.SEGMENTS
    const step = chunkSize / segs

    for (let ix = 0; ix < TerrainSystem.CHUNKS_PER_AXIS; ix++) {
      for (let iz = 0; iz < TerrainSystem.CHUNKS_PER_AXIS; iz++) {
        const originX = -halfWorld + ix * chunkSize
        const originZ = -halfWorld + iz * chunkSize
        const centerX = originX + chunkSize * 0.5
        const centerZ = originZ + chunkSize * 0.5

        // Lưới độ cao (segs+1)^2 theo tọa độ thế giới
        const stride = segs + 1
        const heights = new Float32Array(stride * stride)
        for (let j = 0; j <= segs; j++) {
          for (let i = 0; i <= segs; i++) {
            heights[j * stride + i] = TerrainSystem.computeElevation(originX + i * step, originZ + j * step)
          }
        }

        const triCount = segs * segs * 2
        const positions = new Float32Array(triCount * 9)
        const params = new Float32Array(triCount * 9) // 3 đỉnh * 3 tham số
        const colors = new Float32Array(triCount * 9)

        let p = 0
        let q = 0

        const pushTri = (
          ax: number, ay: number, az: number,
          bx: number, by: number, bz: number,
          cx: number, cy: number, cz: number,
          gi: number, gj: number, half: number
        ) => {
          // Vị trí cục bộ (mesh đặt tại tâm chunk)
          positions[p++] = ax - centerX; positions[p++] = ay; positions[p++] = az - centerZ
          positions[p++] = bx - centerX; positions[p++] = by; positions[p++] = bz - centerZ
          positions[p++] = cx - centerX; positions[p++] = cy; positions[p++] = cz - centerZ

          // Tham số màu theo trọng tâm mặt
          const mx = (ax + bx + cx) / 3
          const mz = (az + bz + cz) / 3
          const my = (ay + by + cy) / 3
          const dxTemple = mx < -26 ? -26 - mx : mx > 52 ? mx - 52 : 0
          const dzTemple = Math.max(0, Math.abs(mz) - 28)
          const distTemple = Math.hypot(dxTemple, dzTemple)
          const soil = distTemple < 8.0 ? 1.0 - distTemple / 8.0 : 0.0
          const heightT = Math.min(1, Math.max(0, my / 8.0))
          const jitter = TerrainSystem.hash2(gi * 2 + half, gj) - 0.5

          for (let v = 0; v < 3; v++) {
            params[q++] = soil
            params[q++] = heightT
            params[q++] = jitter
          }
        }

        for (let j = 0; j < segs; j++) {
          for (let i = 0; i < segs; i++) {
            const x0 = originX + i * step
            const x1 = x0 + step
            const z0 = originZ + j * step
            const z1 = z0 + step
            const h00 = heights[j * stride + i]
            const h10 = heights[j * stride + i + 1]
            const h01 = heights[(j + 1) * stride + i]
            const h11 = heights[(j + 1) * stride + i + 1]

            // Đường chéo đổi hướng xen kẽ để bớt "sọc" lưới
            if ((i + j) % 2 === 0) {
              pushTri(x0, h00, z0, x0, h01, z1, x1, h10, z0, i, j, 0)
              pushTri(x1, h10, z0, x0, h01, z1, x1, h11, z1, i, j, 1)
            } else {
              pushTri(x0, h00, z0, x0, h01, z1, x1, h11, z1, i, j, 0)
              pushTri(x0, h00, z0, x1, h11, z1, x1, h10, z0, i, j, 1)
            }
          }
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geo.computeVertexNormals()
        geo.computeBoundingSphere()

        const mesh = new THREE.Mesh(geo, this.material)
        mesh.position.set(centerX, 0, centerZ)
        mesh.receiveShadow = true
        mesh.name = `TerrainChunk_${ix}_${iz}`

        this.root.add(mesh)
        this.chunks.push({
          mesh,
          cx: ix,
          cz: iz,
          center: new THREE.Vector3(centerX, 0, centerZ),
          params
        })
      }
    }
  }

  /** Tô lại màu đỉnh theo bảng màu thời điểm trong ngày (không tạo lại geometry). */
  public setPalette(mode: TimeOfDayMode) {
    const cGrass = new THREE.Color(Palette.slot(mode, 'grass'))
    const cDark = new THREE.Color(Palette.slot(mode, 'grassDark'))
    const cGround = new THREE.Color(Palette.slot(mode, 'ground'))
    const cSoil = cDark.clone().lerp(cGround, 0.35)
    const tmp = new THREE.Color()

    for (const chunk of this.chunks) {
      const colorAttr = chunk.mesh.geometry.getAttribute('color') as THREE.BufferAttribute
      const arr = colorAttr.array as Float32Array
      const params = chunk.params
      const n = colorAttr.count

      for (let i = 0; i < n; i++) {
        const soil = params[i * 3]
        const heightT = params[i * 3 + 1]
        const jitter = params[i * 3 + 2]

        // Thấp -> cỏ tối, cao -> cỏ sáng; gần chùa -> pha đất
        tmp.copy(cDark).lerp(cGrass, 0.25 + heightT * 0.75)
        if (soil > 0) tmp.lerp(cSoil, soil * 0.8)
        const k = 1.0 + jitter * 0.12
        arr[i * 3] = tmp.r * k
        arr[i * 3 + 1] = tmp.g * k
        arr[i * 3 + 2] = tmp.b * k
      }
      colorAttr.needsUpdate = true
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
    // Vật liệu vertexColor dùng chung từ FlatMaterialFactory: không dispose ở đây.
  }
}
