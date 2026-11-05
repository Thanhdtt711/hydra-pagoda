import * as THREE from 'three'

/**
 * AvatarKit:
 * Shared geometries, materials, procedural fabric textures,
 * and low-poly LOD templates for crowd instancing matching Chibi proportions (~1.38m, 3.8 heads).
 */
export class AvatarKit {
  private static instance: AvatarKit | null = null

  // Shared Procedural Fabric Normal Texture (Micro Silk/Linen Weave)
  public fabricNormalMap: THREE.CanvasTexture

  // Geometries for LOD1 instancing (Chibi silhouette: ~340 triangles)
  public lod1Geometry: THREE.BufferGeometry
  public lod1Material: THREE.MeshStandardMaterial

  // Geometries for LOD2 instancing (Ultra low-poly minimalist Chibi impostor: ~64 triangles)
  public lod2Geometry: THREE.BufferGeometry
  public lod2Material: THREE.MeshStandardMaterial

  constructor() {
    this.fabricNormalMap = this.createFabricNormalMap()

    this.lod1Geometry = this.createMergedLOD1Geometry()
    this.lod1Material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White base so instance colors tint accurately
      roughness: 0.65,
      metalness: 0.08,
      normalMap: this.fabricNormalMap,
      normalScale: new THREE.Vector2(0.20, 0.20)
    })

    this.lod2Geometry = this.createMergedLOD2Geometry()
    this.lod2Material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White base so instance colors tint accurately
      roughness: 0.8,
      metalness: 0.05
    })
  }

  public static getInstance(): AvatarKit {
    if (!AvatarKit.instance) {
      AvatarKit.instance = new AvatarKit()
    }
    return AvatarKit.instance
  }

  /**
   * Tạo Texture Normal Map sợi dệt lụa/vải đũi cổ truyền trên Canvas
   */
  private createFabricNormalMap(): THREE.CanvasTexture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.createImageData(size, size)
    const d = imgData.data

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4
        // Warp and weft cross weave
        const wx = Math.sin((x / size) * Math.PI * 32)
        const wy = Math.sin((y / size) * Math.PI * 32)
        const nx = wx * 0.20
        const ny = wy * 0.20
        d[idx] = Math.floor(128 + nx * 127)     // Normal X
        d[idx + 1] = Math.floor(128 + ny * 127) // Normal Y
        d[idx + 2] = 245                        // Normal Z
        d[idx + 3] = 255
      }
    }

    ctx.putImageData(imgData, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(8, 8)
    return tex
  }

  /**
   * Tạo hình khối nhân vật Chibi LOD1 gộp sẵn (tỷ lệ 3.8 đầu, chiều cao ~1.38m, ~340 triangles)
   */
  private createMergedLOD1Geometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = []

    // 1. Chân & Giày (0.00m tới 0.26m)
    const legL = new THREE.CylinderGeometry(0.038, 0.038, 0.26, 8, 1, false)
    legL.translate(-0.065, 0.13, 0)
    geometries.push(legL)

    const legR = new THREE.CylinderGeometry(0.038, 0.038, 0.26, 8, 1, false)
    legR.translate(0.065, 0.13, 0)
    geometries.push(legR)

    // 2. Tà áo dài dáng chữ A (0.26m tới 0.52m)
    const skirtGeo = new THREE.CylinderGeometry(0.13, 0.20, 0.26, 12, 1, false)
    skirtGeo.translate(0, 0.39, 0)
    geometries.push(skirtGeo)

    // 3. Thân trên áo giao lĩnh (0.52m tới 0.84m)
    const torsoGeo = new THREE.CylinderGeometry(0.14, 0.13, 0.32, 10)
    torsoGeo.translate(0, 0.68, 0)
    geometries.push(torsoGeo)

    // 4. Hai cánh tay áo thụng chắp sen phía trước
    const armL = new THREE.CylinderGeometry(0.035, 0.055, 0.18, 8)
    armL.rotateZ(-0.5)
    armL.rotateX(0.4)
    armL.translate(-0.09, 0.64, 0.10)
    geometries.push(armL)

    const armR = new THREE.CylinderGeometry(0.035, 0.055, 0.18, 8)
    armR.rotateZ(0.5)
    armR.rotateX(0.4)
    armR.translate(0.09, 0.64, 0.10)
    geometries.push(armR)

    // 5. Đầu to tròn Chibi (0.87m tới 1.23m)
    const headGeo = new THREE.SphereGeometry(0.18, 14, 10)
    headGeo.scale(1.04, 0.98, 1.02)
    headGeo.translate(0, 1.05, 0)
    geometries.push(headGeo)

    // 6. Nón lá truyền thống (Đỉnh 1.38m)
    const hatGeo = new THREE.ConeGeometry(0.30, 0.15, 16, 1, false)
    hatGeo.rotateX(-0.06)
    hatGeo.translate(0, 1.27, -0.01)
    geometries.push(hatGeo)

    return this.mergeBufferGeometries(geometries)
  }

  /**
   * Tạo hình khối nhân vật Chibi LOD2 tinh giản tối đa (~64 triangles)
   */
  private createMergedLOD2Geometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = []

    // 1. Thân áo & tà áo dáng chữ A (0.00m tới 0.84m)
    const bodyGeo = new THREE.CylinderGeometry(0.13, 0.20, 0.80, 6, 1, false)
    bodyGeo.translate(0, 0.42, 0)
    geometries.push(bodyGeo)

    // 2. Đầu to tròn Chibi tối giản
    const headGeo = new THREE.SphereGeometry(0.17, 8, 6)
    headGeo.translate(0, 1.02, 0)
    geometries.push(headGeo)

    // 3. Nón lá tối giản
    const hatGeo = new THREE.ConeGeometry(0.28, 0.16, 8, 1, false)
    hatGeo.translate(0, 1.22, 0)
    geometries.push(hatGeo)

    return this.mergeBufferGeometries(geometries)
  }

  /**
   * Helper gộp danh sách BufferGeometry thành 1 geometry duy nhất
   */
  private mergeBufferGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let totalPositions = 0

    for (const g of geos) {
      const nonIndexed = g.index ? g.toNonIndexed() : g
      totalPositions += nonIndexed.attributes.position.array.length
    }

    const mergedPositions = new Float32Array(totalPositions)
    const mergedNormals = new Float32Array(totalPositions)
    let posOffset = 0

    for (const g of geos) {
      const nonIndexed = g.index ? g.toNonIndexed() : g
      const pos = nonIndexed.attributes.position.array as Float32Array
      mergedPositions.set(pos, posOffset)

      if (nonIndexed.attributes.normal) {
        mergedNormals.set(nonIndexed.attributes.normal.array as Float32Array, posOffset)
      }

      posOffset += pos.length
    }

    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3))
    merged.computeVertexNormals()

    for (const g of geos) {
      g.dispose()
    }

    return merged
  }

  public dispose() {
    this.lod1Geometry.dispose()
    this.lod1Material.dispose()
    this.lod2Geometry.dispose()
    this.lod2Material.dispose()
    this.fabricNormalMap.dispose()
    AvatarKit.instance = null
  }
}
