import * as THREE from 'three'
import { FlatMaterialFactory } from './FlatMaterialFactory'
import type { PaletteSlot } from './Palette'
import { LowPolyBuilder, type ColoredPart, type PartTransform } from './LowPolyBuilder'

/**
 * SlotBatch:
 * Gom nhiều hình khối low-poly theo SLOT MÀU của Palette rồi gộp thành mỗi slot một Mesh duy nhất.
 * Vật liệu lấy từ FlatMaterialFactory.get(slot) nên công trình tự đổi màu khi đổi ngày / hoàng hôn / đêm.
 * Quy ước: mọi vị trí (x, y, z) là TÂM của khối (đúng như BoxGeometry / CylinderGeometry của three).
 */

export interface SlotBatchBuildOptions {
    name?: string
    castShadow?: boolean
    receiveShadow?: boolean
}

interface SolidBucket {
    slot: PaletteSlot
    doubleSided: boolean
    parts: ColoredPart[]
}

export class SlotBatch {
    private solid = new Map<string, SolidBucket>()
    private glow = new Map<PaletteSlot, ColoredPart[]>()

    /** Thêm geometry bất kỳ (đã flat) vào bucket của slot. */
    public add(slot: PaletteSlot, geometry: THREE.BufferGeometry, transform?: PartTransform, doubleSided = false): this {
        const key = `${slot}|${doubleSided ? 1 : 0}`
        let bucket = this.solid.get(key)
        if (!bucket) {
            bucket = { slot, doubleSided, parts: [] }
            this.solid.set(key, bucket)
        }
        bucket.parts.push({ geometry, color: 0xffffff, transform })
        return this
    }

    /** Thêm geometry phát sáng (đèn lồng, ngọn nến). */
    public addEmissive(slot: PaletteSlot, geometry: THREE.BufferGeometry, transform?: PartTransform): this {
        let list = this.glow.get(slot)
        if (!list) {
            list = []
            this.glow.set(slot, list)
        }
        list.push({ geometry, color: 0xffffff, transform })
        return this
    }

    public box(slot: PaletteSlot, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): this {
        return this.add(slot, LowPolyBuilder.box(w, h, d), { position: [x, y, z], rotation: [0, ry, 0] })
    }

    public cylinder(
        slot: PaletteSlot,
        rTop: number,
        rBottom: number,
        h: number,
        segments: number,
        x: number,
        y: number,
        z: number
    ): this {
        return this.add(slot, LowPolyBuilder.cylinder(rTop, rBottom, h, segments), { position: [x, y, z] })
    }

    public cone(slot: PaletteSlot, r: number, h: number, segments: number, x: number, y: number, z: number): this {
        return this.add(slot, LowPolyBuilder.cone(r, h, segments), { position: [x, y, z] })
    }

    public sphere(slot: PaletteSlot, r: number, detail: number, x: number, y: number, z: number): this {
        return this.add(slot, LowPolyBuilder.sphere(r, detail), { position: [x, y, z] })
    }

    /** Gộp toàn bộ thành các Mesh (mỗi slot một Mesh) và làm rỗng batch. */
    public build(options: SlotBatchBuildOptions = {}): THREE.Group {
        const group = new THREE.Group()
        if (options.name) group.name = options.name
        const factory = FlatMaterialFactory.getInstance()
        const castShadow = options.castShadow ?? true
        const receiveShadow = options.receiveShadow ?? true

        this.solid.forEach((bucket) => {
            if (bucket.parts.length === 0) return
            const geo = LowPolyBuilder.mergeColored(bucket.parts)
            const mat = factory.get(bucket.slot, { side: bucket.doubleSided ? THREE.DoubleSide : THREE.FrontSide })
            const mesh = new THREE.Mesh(geo, mat)
            mesh.name = `${options.name ?? 'batch'}_${bucket.slot}`
            mesh.castShadow = castShadow
            mesh.receiveShadow = receiveShadow
            group.add(mesh)
        })

        this.glow.forEach((parts, slot) => {
            if (parts.length === 0) return
            const geo = LowPolyBuilder.mergeColored(parts)
            const mesh = new THREE.Mesh(geo, factory.emissive(slot))
            mesh.name = `${options.name ?? 'batch'}_glow_${slot}`
            mesh.castShadow = false
            mesh.receiveShadow = false
            group.add(mesh)
        })

        this.solid.clear()
        this.glow.clear()
        return group
    }

    /** Giải phóng geometry của một nhóm đã build (KHÔNG dispose vật liệu vì dùng chung FlatMaterialFactory). */
    public static disposeGeometries(root: THREE.Object3D) {
        root.traverse((obj) => {
            const mesh = obj as THREE.Mesh
            if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose()
        })
    }
}
