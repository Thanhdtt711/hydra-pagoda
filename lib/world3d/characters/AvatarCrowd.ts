import * as THREE from 'three'
import { PilgrimAvatar, type AvatarGender, type PilgrimCountry } from '../PilgrimAvatar'
import { AvatarKit } from './AvatarKit'
import { NameplateAtlas } from './NameplateAtlas'
import { FootstepSystem } from './FootstepSystem'
import type { PilgrimPresence } from '../../network/MultiplayerClient'

export interface CrowdPilgrim {
  id: string
  name: string
  title: string
  country: PilgrimCountry
  gender: AvatarGender
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

interface CountryInstances {
  lod1: THREE.InstancedMesh
  lod2: THREE.InstancedMesh
  lod1Count: number
  lod2Count: number
}

/**
 * AvatarCrowd (đám đông low-poly, thiết kế cho ~200 người cùng lúc):
 * - LOD0 (0-15 m, tối đa 12 người): 6 bộ phận rigid có hoạt ảnh đầy đủ (PilgrimAvatar).
 * - LOD1 (15-45 m): mô hình đứng gộp ~500 tam giác, InstancedMesh theo từng quốc gia.
 * - LOD2 (45-95 m): hình khối rất thô ~100 tam giác, InstancedMesh theo từng quốc gia.
 * - LOD3 (>95 m hoặc ngoài khung nhìn): chỉ tính logic trên CPU.
 * Màu sắc nằm trong vertex color của từng quốc gia nên không cần instanceColor.
 * NameplateAtlas (1 draw call) và FootstepSystem (1 draw call) dùng chung toàn cục.
 */
export class AvatarCrowd {
  public root = new THREE.Group()

  /** Sức chứa mỗi InstancedMesh (theo từng quốc gia). */
  private readonly instanceCapacity = 256
  private pilgrims = new Map<string, CrowdPilgrim>()

  // LOD0 pool
  private maxLOD0 = 12
  private lod0Pool: PilgrimAvatar[] = []
  private availableLOD0: PilgrimAvatar[] = []

  // LOD1 / LOD2 theo quốc gia (tạo lười khi gặp quốc gia đó lần đầu)
  private instances = new Map<PilgrimCountry, CountryInstances>()
  private avatarKit: AvatarKit

  private nameplateAtlas: NameplateAtlas
  private footstepSystem: FootstepSystem

  private frustum = new THREE.Frustum()
  private projScreenMatrix = new THREE.Matrix4()
  private dummy = new THREE.Object3D()
  private sorted: CrowdPilgrim[] = []

  // Thống kê hiển thị trên HUD F2
  private stats = {
    total: 0,
    lod0: 0,
    lod1: 0,
    lod2: 0,
    lod3: 0
  }

  constructor(scene: THREE.Scene) {
    this.avatarKit = AvatarKit.getInstance()

    for (let i = 0; i < this.maxLOD0; i++) {
      const avatar = new PilgrimAvatar()
      avatar.root.visible = false
      this.root.add(avatar.root)
      this.lod0Pool.push(avatar)
      this.availableLOD0.push(avatar)
    }

    this.nameplateAtlas = new NameplateAtlas()
    this.root.add(this.nameplateAtlas.mesh)

    this.footstepSystem = FootstepSystem.getInstance()
    this.root.add(this.footstepSystem.mesh)

    scene.add(this.root)
  }

  private getInstances(country: PilgrimCountry): CountryInstances {
    let inst = this.instances.get(country)
    if (inst) return inst

    const material = this.avatarKit.material
    const lod1 = new THREE.InstancedMesh(this.avatarKit.getLod1Geometry(country), material, this.instanceCapacity)
    lod1.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    lod1.castShadow = true
    lod1.receiveShadow = false
    lod1.frustumCulled = false
    lod1.count = 0

    const lod2 = new THREE.InstancedMesh(this.avatarKit.getLod2Geometry(country), material, this.instanceCapacity)
    lod2.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    lod2.frustumCulled = false
    lod2.count = 0

    this.root.add(lod1, lod2)
    inst = { lod1, lod2, lod1Count: 0, lod2Count: 0 }
    this.instances.set(country, inst)
    return inst
  }

  /**
   * Thêm mới hoặc cập nhật một người hành hương.
   */
  public upsertPilgrim(data: Partial<PilgrimPresence> & { id: string }) {
    let p = this.pilgrims.get(data.id)

    if (!p) {
      const rawCountry = data.country && data.country.trim() !== '' ? data.country.split(':')[0] : 'vietnam'
      const country = rawCountry as PilgrimCountry
      const gender: AvatarGender =
        data.gender === 'male' || (data.country && data.country.endsWith(':male')) ? 'male' : 'female'
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
        gender,
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
      if (data.country && data.country.trim() !== '') {
        const nextCountry = data.country.split(':')[0] as PilgrimCountry
        if (p.country !== nextCountry) {
          p.country = nextCountry
          if (p.avatarLOD0) {
            p.avatarLOD0.setCountryStyle(p.country)
          }
          this.nameplateAtlas.register(p.id, p.name, p.title, p.country)
        }
      }
      if (data.gender || (data.country && data.country.includes(':'))) {
        const nextGender: AvatarGender =
          data.gender === 'male' || (data.country && data.country.endsWith(':male')) ? 'male' : 'female'
        if (p.gender !== nextGender) {
          p.gender = nextGender
          if (p.avatarLOD0) {
            p.avatarLOD0.setGender(p.gender)
          }
        }
      }
      if (data.name && data.name.trim() !== '') {
        p.name = data.name
        this.nameplateAtlas.register(p.id, p.name, p.title, p.country)
      }
    }
  }

  /** Kích hoạt hoạt ảnh biểu cảm (chỉ thấy rõ ở LOD0). */
  public triggerEmote(id: string, action: string) {
    const p = this.pilgrims.get(id)
    if (p?.avatarLOD0) {
      p.avatarLOD0.setAction(action)
    }
  }

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

  private releaseLOD0(p: CrowdPilgrim) {
    if (p.avatarLOD0) {
      p.avatarLOD0.root.visible = false
      this.availableLOD0.push(p.avatarLOD0)
      p.avatarLOD0 = undefined
    }
  }

  private writeInstance(mesh: THREE.InstancedMesh, index: number, p: CrowdPilgrim) {
    this.dummy.position.copy(p.currentPos)
    this.dummy.rotation.set(0, p.currentYaw, 0)
    this.dummy.scale.set(1, 1, 1)
    this.dummy.updateMatrix()
    mesh.setMatrixAt(index, this.dummy.matrix)
  }

  /**
   * Cập nhật đám đông mỗi frame:
   * 1. Nội suy toạ độ và góc xoay.
   * 2. Phân loại theo khoảng cách + frustum culling.
   * 3. Gán LOD0/1/2/3, cập nhật InstancedMesh và nameplate.
   */
  public update(delta: number, camera: THREE.PerspectiveCamera, playerPos: THREE.Vector3) {
    void playerPos
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix)

    const camPos = camera.position
    let lod0Count = 0
    let lod1Count = 0
    let lod2Count = 0
    let lod3Count = 0

    this.instances.forEach((inst) => {
      inst.lod1Count = 0
      inst.lod2Count = 0
    })

    const list = this.sorted
    list.length = 0
    for (const p of this.pilgrims.values()) {
      const distToTarget = p.currentPos.distanceTo(p.targetPos)
      p.isMoving = distToTarget > 0.05
      p.currentPos.lerp(p.targetPos, Math.min(delta * 14.0, 1.0))

      let diff = p.targetYaw - p.currentYaw
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      p.currentYaw += diff * Math.min(delta * 14.0, 1.0)

      if (p.isMoving) {
        p.lastStepDist += p.currentPos.distanceTo(p.prevStepPos)
        if (p.lastStepDist > 1.2) {
          this.footstepSystem.addFootstep(p.currentPos)
          p.lastStepDist = 0
        }
      }
      p.prevStepPos.copy(p.currentPos)
      list.push(p)
    }

    // Người gần camera nhất được ưu tiên LOD0
    list.sort((a, b) => a.currentPos.distanceToSquared(camPos) - b.currentPos.distanceToSquared(camPos))

    for (const p of list) {
      const distToCam = p.currentPos.distanceTo(camPos)
      const inFrustum = this.frustum.containsPoint(p.currentPos) || distToCam < 4

      if (!inFrustum || distToCam > 95.0) {
        p.lod = 3
        this.releaseLOD0(p)
        this.nameplateAtlas.updatePosition(p.id, 0, 0, 0, false)
        lod3Count++
        continue
      }

      if (distToCam <= 15.0 && lod0Count < this.maxLOD0) {
        // --- LOD0: đầy đủ hoạt ảnh ---
        p.lod = 0
        lod0Count++

        if (!p.avatarLOD0 && this.availableLOD0.length > 0) {
          p.avatarLOD0 = this.availableLOD0.pop()!
          p.avatarLOD0.setCountryStyle(p.country)
          p.avatarLOD0.setGender(p.gender)
          p.avatarLOD0.setAction('standing')
        }

        if (p.avatarLOD0) {
          p.avatarLOD0.root.visible = true
          p.avatarLOD0.root.position.copy(p.currentPos)
          p.avatarLOD0.root.rotation.y = p.currentYaw
          p.avatarLOD0.update(delta, p.isMoving, 4.0, p.currentPos)
        }

        this.nameplateAtlas.updatePosition(p.id, p.currentPos.x, p.currentPos.y, p.currentPos.z, true)
      } else if (distToCam <= 45.0) {
        // --- LOD1: mô hình đứng gộp ---
        p.lod = 1
        this.releaseLOD0(p)

        const inst = this.getInstances(p.country)
        if (inst.lod1Count < this.instanceCapacity) {
          this.writeInstance(inst.lod1, inst.lod1Count, p)
          inst.lod1Count++
          lod1Count++
        }
        this.nameplateAtlas.updatePosition(p.id, p.currentPos.x, p.currentPos.y, p.currentPos.z, distToCam <= 30.0)
      } else {
        // --- LOD2: hình khối thô ---
        p.lod = 2
        this.releaseLOD0(p)

        const inst = this.getInstances(p.country)
        if (inst.lod2Count < this.instanceCapacity) {
          this.writeInstance(inst.lod2, inst.lod2Count, p)
          inst.lod2Count++
          lod2Count++
        }
        this.nameplateAtlas.updatePosition(p.id, 0, 0, 0, false)
      }
    }

    this.instances.forEach((inst) => {
      inst.lod1.count = inst.lod1Count
      inst.lod2.count = inst.lod2Count
      inst.lod1.instanceMatrix.needsUpdate = true
      inst.lod2.instanceMatrix.needsUpdate = true
    })

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
      this.releaseLOD0(p)
    }
    this.pilgrims.clear()
    this.nameplateAtlas.clear()
    this.instances.forEach((inst) => {
      inst.lod1.count = 0
      inst.lod2.count = 0
    })
  }

  public dispose() {
    this.clear()
    for (const av of this.lod0Pool) {
      av.dispose()
    }
    this.lod0Pool = []
    this.availableLOD0 = []

    // Hình học LOD thuộc AvatarKit, vật liệu thuộc FlatMaterialFactory: chỉ giải phóng bộ đệm instance.
    this.instances.forEach((inst) => {
      inst.lod1.dispose()
      inst.lod2.dispose()
    })
    this.instances.clear()
    this.avatarKit.dispose()

    this.nameplateAtlas.dispose()
    this.footstepSystem.dispose()
  }
}
