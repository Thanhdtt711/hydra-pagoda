// GeometryMerger.ts - Zero-Dependency Static Mesh Batching Utility for Three.js
// Merges multiple geometries into a single high-performance BufferGeometry (1 draw call).

import * as THREE from 'three'

export interface GeometryBatchPart {
  geometry: THREE.BufferGeometry
  matrix?: THREE.Matrix4
  position?: THREE.Vector3
  rotation?: THREE.Euler
  scale?: THREE.Vector3
}

export class GeometryMerger {
  /**
   * Merges multiple BufferGeometries into a single BufferGeometry.
   * Automatically handles indexing, normals, and UVs.
   * Disposes of source geometries if disposeSource is true.
   */
  public static merge(
    parts: (THREE.BufferGeometry | GeometryBatchPart)[],
    disposeSource = true
  ): THREE.BufferGeometry {
    if (parts.length === 0) return new THREE.BufferGeometry()

    let totalPositions = 0
    let totalNormals = 0
    let totalUvs = 0

    const preparedGeos: THREE.BufferGeometry[] = []

    for (const item of parts) {
      let geo: THREE.BufferGeometry
      let mat: THREE.Matrix4 | null = null

      if ('geometry' in item) {
        geo = item.geometry
        if (item.matrix) {
          mat = item.matrix
        } else if (item.position || item.rotation || item.scale) {
          mat = new THREE.Matrix4()
          const p = item.position || new THREE.Vector3()
          const q = new THREE.Quaternion().setFromEuler(item.rotation || new THREE.Euler())
          const s = item.scale || new THREE.Vector3(1, 1, 1)
          mat.compose(p, q, s)
        }
      } else {
        geo = item
      }

      // Convert to non-indexed for seamless merging across different topologies
      const nonIndexed = geo.index ? geo.toNonIndexed() : geo.clone()
      if (mat) {
        nonIndexed.applyMatrix4(mat)
      }

      totalPositions += nonIndexed.attributes.position.array.length
      if (nonIndexed.attributes.normal) {
        totalNormals += nonIndexed.attributes.normal.array.length
      }
      if (nonIndexed.attributes.uv) {
        totalUvs += nonIndexed.attributes.uv.array.length
      }

      preparedGeos.push(nonIndexed)
      if (disposeSource && 'geometry' in item) {
        item.geometry.dispose()
      } else if (disposeSource && !('geometry' in item)) {
        item.dispose()
      }
    }

    const mergedPositions = new Float32Array(totalPositions)
    const mergedNormals = new Float32Array(totalPositions)
    const mergedUvs = totalUvs > 0 ? new Float32Array((totalPositions / 3) * 2) : null

    let posOffset = 0
    let uvOffset = 0

    for (const g of preparedGeos) {
      const pos = g.attributes.position.array as Float32Array
      mergedPositions.set(pos, posOffset)

      if (g.attributes.normal) {
        mergedNormals.set(g.attributes.normal.array as Float32Array, posOffset)
      }

      if (mergedUvs && g.attributes.uv) {
        mergedUvs.set(g.attributes.uv.array as Float32Array, uvOffset)
        uvOffset += g.attributes.uv.array.length
      } else if (mergedUvs) {
        uvOffset += (pos.length / 3) * 2
      }

      posOffset += pos.length
      g.dispose()
    }

    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3))
    if (mergedUvs) {
      merged.setAttribute('uv', new THREE.BufferAttribute(mergedUvs, 2))
    }
    merged.computeVertexNormals()

    return merged
  }
}

