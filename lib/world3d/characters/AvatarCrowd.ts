import * as THREE from 'three'
import { PilgrimAvatar, type PilgrimCountry, PALETTES } from '../PilgrimAvatar'
import { AvatarKit } from './AvatarKit'
import { NameplateAtlas } from './NameplateAtlas'
import { FootstepSystem } from './FootstepSystem'
import type { PilgrimPresence } from '../../network/MultiplayerClient'

export interface CrowdPilgrim {
  id: string
  name: string
  title: string
  country: PilgrimCountry
  currentPos: THREE.Vector3
  targetPos: THREE.Vector3
  currentYaw: number
  targetYaw: number
  isMoving: boolean
  lastStepDist: number
  prevStepPos: THREE.Vector3
  lod: 0 | 1 | 2 | 3
  avatarLOD0?: PilgrimAvatar
}

/**
 * AvatarCrowd (Hệ Thống Đám Đông 500 Người Tối Ưu Hóa Tuyệt Đối):
 * Slices 500 avatars into 4 LOD tiers:
 * - LOD0 (0-15m, max 25 near camera): Full skeleton rig mesh with dynamic headwear and walking animation.
 * - LOD1 (15-45m): Merged low-poly InstancedMesh (1 draw call).
 * - LOD2 (45-90m): Ultra-low poly impostor InstancedMesh (1 draw call).
 * - LOD3 (>90m or frustum culled): 0 draw calls, CPU-only logic.
 * Consolidated NameplateAtlas (1 draw call) and global FootstepSystem (1 draw call).
 */
export class AvatarCrowd {
  public root = new THREE.Group()

  private maxPilgrims = 600
  private pilgrims = new Map<string, CrowdPilgrim>()

  // LOD0 Pool (Max 15 detailed avatars nearest to camera)
  private readonly maxLOD0 = 15
  private lod0Pool: PilgrimAvatar[] = []
  private availableLOD0: PilgrimAvatar[] = []

  // LOD1 & LOD2 Instanced Meshes
  private lod1Mesh: THREE.InstancedMesh
  private lod2Mesh: THREE.InstancedMesh
  private avatarKit: AvatarKit

  // 1 Draw Call Nameplate Atlas & Footstep System
  public nameplateAtlas: NameplateAtlas
  public footstepSystem: FootstepSystem

  // Spatial Frustum Culling
  private frustum = new THREE.Frustum()
  private projScreenMatrix = new THREE.Matrix4()
  private dummy = new THREE.Object3D()
  private tempColor = new THREE.Color()

  // Breakdown statistics for F2 Profiler HUD
  private stats = {
    total: 0,
    lod0: 0,
    lod1: 0,
    lod2: 0,
    lod3: 0
  }

  constructor(scene: THREE.Scene) {
    this.avatarKit = AvatarKit.getInstance()

    // 1. Tạo Pool cho LOD0 (25 chi tiết nhất)
    for (let i = 0; i < this.maxLOD0; i++) {
      const avatar = new PilgrimAvatar()
      avatar.root.visible = false
      this.root.add(avatar.root)
      this.lod0Pool.push(avatar)
      this.availableLOD0.push(avatar)
    }

    // 2. Tạo InstancedMesh cho LOD1 (~380 tris / avatar, 1 draw call)
    this.lod1Mesh = new THREE.InstancedMesh(this.avatarKit.lod1Geometry, this.avatarKit.lod1Material, this.maxPilgrims)
    this.lod1Mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.lod1Mesh.castShadow = true
    this.lod1Mesh.receiveShadow = true
    this.root.add(this.lod1Mesh)

    // 3. Tạo InstancedMesh cho LOD2 (~80 tris / avatar, 1 draw call)
    this.lod2Mesh = new THREE.InstancedMesh(this.avatarKit.lod2Geometry, this.avatarKit.lod2Material, this.maxPilgrims)
    this.lod2Mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.root.add(this.lod2Mesh)

    // Khởi tạo ma trận ẩn cho instanced meshes
    this.dummy.position.set(0, -500, 0)
    this.dummy.updateMatrix()
    for (let i = 0; i < this.maxPilgrims; i++) {
      this.lod1Mesh.setMatrixAt(i, this.dummy.matrix)
      this.lod2Mesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.lod1Mesh.instanceMatrix.needsUpdate = true
    this.lod2Mesh.instanceMatrix.needsUpdate = true

    // 4. Bảng tên Atlas toàn cục (1 draw call) & Dấu chân hoa sen (1 draw call)
    this.nameplateAtlas = new NameplateAtlas()
    this.root.add(this.nameplateAtlas.mesh)

    this.footstepSystem = FootstepSystem.getInstance()
    this.root.add(this.footstepSystem.mesh)

    scene.add(this.root)
  }

  /**
   * Thêm hoặc cập nhật người chơi trong đám đông
   */
  public upsertPilgrim(data: Partial<PilgrimPresence> & { id: string }) {
    let p = this.pilgrims.get(data.id)
    if (!p) {
      const country = (data.country && data.country.trim() !== '' ? data.country : 'vietnam') as PilgrimCountry
      const name = data.name && data.name.trim() !== '' ? data.name : `Đồng tu ${data.id.slice(0, 6)}`
      const title = data.title && data.title.trim() !== '' ? data.title : 'Hành Giả'

      const pos = data.position
        ? new THREE.Vector3(data.position[0], data.position[1], data.position[2])
        : new THREE.Vector3()
      p = {
        id: data.id,
        name,
        title,
        country,
        currentPos: pos.clone(),
        targetPos: pos.clone(),
        currentYaw: data.yaw || 0,
        targetYaw: data.yaw || 0,
        isMoving: false,
        lastStepDist: 0,
        prevStepPos: pos.clone(),
        lod: 3
      }
      this.pilgrims.set(data.id, p)
      this.nameplateAtlas.register(p.id, p.name, p.title, p.country)
    } else {
      if (data.position) {
        p.targetPos.set(data.position[0], data.position[1], data.position[2])
      }
      if (data.yaw !== undefined) {
        p.targetYaw = data.yaw
      }
      if (data.country && data.country.trim() !== '' && p.country !== data.country) {
        p.country = data.country as PilgrimCountry
        if (p.avatarLOD0) {
          p.avatarLOD0.setCountryStyle(p.country)
        }
        this.nameplateAtlas.register(p.id, p.name, p.title, p.country)
      }
      if (data.name && data.name.trim() !== '') {
        p.name = data.name
        this.nameplateAtlas.register(p.id, p.name, p.title, p.country)
      }
    }
  }

  /**
   * Kích hoạt Emote (bow, meditate, pray) cho người chơi từ xa
   */
  public triggerEmote(id: string, action: string) {
    const p = this.pilgrims.get(id)
    if (p && p.avatarLOD0) {
      p.avatarLOD0.setAction(action)
    }
  }

  /**
   * Xóa người chơi rời khỏi thế giới
   */
  public removePilgrim(id: string) {
    const p = this.pilgrims.get(id)
    if (!p) return

    if (p.avatarLOD0) {
      p.avatarLOD0.root.visible = false
      this.availableLOD0.push(p.avatarLOD0)
      p.avatarLOD0 = undefined
    }

    this.nameplateAtlas.unregister(id)
    this.pilgrims.delete(id)
  }

  /**
   * Cập nhật đám đông mỗi frame:
   * 1. Nội suy tọa độ di chuyển mượt mà (100ms snapshot buffer lerp).
   * 2. Phân loại khoảng cách và Frustum Culling.
   * 3. Gán linh hoạt LOD0/1/2/3 và cập nhật InstancedMesh + Nameplates.
   */
  public update(delta: number, camera: THREE.PerspectiveCamera, playerPos: THREE.Vector3) {
    // Cập nhật Frustum camera để culling nhanh
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix)

    const camPos = camera.position
    let lod0Count = 0
    let lod1Count = 0
    let lod2Count = 0
    let lod3Count = 0

    // Thu hồi các avatar LOD0 để tái phân bổ theo cự ly gần nhất
    const sortedPilgrims = Array.from(this.pilgrims.values())
    for (const p of sortedPilgrims) {
      // Nội suy vị trí & góc xoay
      const distToTarget = p.currentPos.distanceTo(p.targetPos)
      p.isMoving = distToTarget > 0.05
      p.currentPos.lerp(p.targetPos, Math.min(delta * 14.0, 1.0))

      let diff = p.targetYaw - p.currentYaw
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      p.currentYaw += diff * Math.min(delta * 14.0, 1.0)

      // Kiểm tra bước chân hoa sen
      if (p.isMoving) {
        const stepDist = p.currentPos.distanceTo(p.prevStepPos)
        p.lastStepDist += stepDist
        if (p.lastStepDist > 1.2) {
          this.footstepSystem.addFootstep(p.currentPos)
          p.lastStepDist = 0
        }
      }
      p.prevStepPos.copy(p.currentPos)
    }

    // Sắp xếp người chơi theo khoảng cách tới camera để ưu tiên LOD0 cho người ở gần
    sortedPilgrims.sort((a, b) => {
      const distA = a.currentPos.distanceToSquared(camPos)
      const distB = b.currentPos.distanceToSquared(camPos)
      return distA - distB
    })

    let lod1InstanceIndex = 0
    let lod2InstanceIndex = 0

    for (const p of sortedPilgrims) {
      const distToCam = p.currentPos.distanceTo(camPos)

      // Frustum Culling: Kiểm tra xem điểm có nằm trong nón nhìn camera không
      const inFrustum = this.frustum.containsPoint(p.currentPos)

      if (!inFrustum || distToCam > 95.0) {
        // LOD3: Culling hoàn toàn
        p.lod = 3
        if (p.avatarLOD0) {
          p.avatarLOD0.root.visible = false
          this.availableLOD0.push(p.avatarLOD0)
          p.avatarLOD0 = undefined
        }
        this.nameplateAtlas.updatePosition(p.id, 0, 0, 0, false)
        lod3Count++
        continue
      }

      // Phân chia tầng LOD
      if (distToCam <= 15.0 && lod0Count < this.maxLOD0) {
        // --- LOD 0 (Cực chi tiết: 0 - 15m) ---
        p.lod = 0
        lod0Count++

        if (!p.avatarLOD0 && this.availableLOD0.length > 0) {
          p.avatarLOD0 = this.availableLOD0.pop()!
          p.avatarLOD0.setCountryStyle(p.country)
        }

        if (p.avatarLOD0) {
          p.avatarLOD0.root.visible = true
          p.avatarLOD0.root.position.copy(p.currentPos)
          p.avatarLOD0.root.rotation.y = p.currentYaw
          p.avatarLOD0.update(delta, p.isMoving, 4.0, p.currentPos)
        }

        this.nameplateAtlas.updatePosition(p.id, p.currentPos.x, p.currentPos.y, p.currentPos.z, true)
      } else if (distToCam <= 45.0) {
        // --- LOD 1 (Instanced Mesh tầm trung: 15 - 45m) ---
        p.lod = 1
        lod1Count++

        if (p.avatarLOD0) {
          p.avatarLOD0.root.visible = false
          this.availableLOD0.push(p.avatarLOD0)
          p.avatarLOD0 = undefined
        }

        if (lod1InstanceIndex < this.maxPilgrims) {
          this.dummy.position.copy(p.currentPos)
          this.dummy.rotation.y = p.currentYaw
          this.dummy.scale.set(1, 1, 1)
          this.dummy.updateMatrix()
          this.lod1Mesh.setMatrixAt(lod1InstanceIndex, this.dummy.matrix)
          const robeHex = PALETTES[p.country]?.robeColor || 0x3d5a80
          this.tempColor.setHex(robeHex)
          this.lod1Mesh.setColorAt(lod1InstanceIndex, this.tempColor)
          lod1InstanceIndex++
        }

        this.nameplateAtlas.updatePosition(p.id, p.currentPos.x, p.currentPos.y, p.currentPos.z, true)
      } else {
        // --- LOD 2 (Instanced Mesh tầm xa: 45 - 90m) ---
        p.lod = 2
        lod2Count++

        if (p.avatarLOD0) {
          p.avatarLOD0.root.visible = false
          this.availableLOD0.push(p.avatarLOD0)
          p.avatarLOD0 = undefined
        }

        if (lod2InstanceIndex < this.maxPilgrims) {
          this.dummy.position.copy(p.currentPos)
          this.dummy.rotation.y = p.currentYaw
          this.dummy.scale.set(1, 1, 1)
          this.dummy.updateMatrix()
          this.lod2Mesh.setMatrixAt(lod2InstanceIndex, this.dummy.matrix)
          const robeHex = PALETTES[p.country]?.robeColor || 0x3d5a80
          this.tempColor.setHex(robeHex)
          this.lod2Mesh.setColorAt(lod2InstanceIndex, this.tempColor)
          lod2InstanceIndex++
        }

        // Ẩn bảng tên ở cự ly xa để giảm tải thị giác
        this.nameplateAtlas.updatePosition(p.id, 0, 0, 0, false)
      }
    }

    // Ẩn các instance còn lại của LOD1 và LOD2
    for (let i = lod1InstanceIndex; i < this.maxPilgrims; i++) {
      this.dummy.position.set(0, -500, 0)
      this.dummy.updateMatrix()
      this.lod1Mesh.setMatrixAt(i, this.dummy.matrix)
    }
    for (let i = lod2InstanceIndex; i < this.maxPilgrims; i++) {
      this.dummy.position.set(0, -500, 0)
      this.dummy.updateMatrix()
      this.lod2Mesh.setMatrixAt(i, this.dummy.matrix)
    }

    this.lod1Mesh.instanceMatrix.needsUpdate = true
    this.lod2Mesh.instanceMatrix.needsUpdate = true
    if (this.lod1Mesh.instanceColor) this.lod1Mesh.instanceColor.needsUpdate = true
    if (this.lod2Mesh.instanceColor) this.lod2Mesh.instanceColor.needsUpdate = true

    // Cập nhật hệ thống dấu chân hoa sen toàn cục
    this.footstepSystem.update(delta)

    this.stats = {
      total: this.pilgrims.size,
      lod0: lod0Count,
      lod1: lod1Count,
      lod2: lod2Count,
      lod3: lod3Count
    }
  }

  public getStats() {
    return this.stats
  }

  public getPilgrimCount(): number {
    return this.pilgrims.size
  }

  public clear() {
    for (const p of this.pilgrims.values()) {
      if (p.avatarLOD0) {
        p.avatarLOD0.root.visible = false
        this.availableLOD0.push(p.avatarLOD0)
        p.avatarLOD0 = undefined
      }
    }
    this.pilgrims.clear()
    this.nameplateAtlas.clear()
  }

  public dispose() {
    this.clear()
    for (const av of this.lod0Pool) {
      av.dispose()
    }
    this.lod0Pool = []
    this.availableLOD0 = []
    this.lod1Mesh.geometry.dispose()
    ;(this.lod1Mesh.material as THREE.Material).dispose()
    this.lod2Mesh.geometry.dispose()
    ;(this.lod2Mesh.material as THREE.Material).dispose()
    this.nameplateAtlas.dispose()
    this.footstepSystem.dispose()
  }
}
