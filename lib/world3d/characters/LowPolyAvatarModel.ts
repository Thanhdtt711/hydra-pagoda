import * as THREE from 'three'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import type {
    AvatarAnimation,
    AvatarBodyShape,
    AvatarExpression,
    AvatarGender,
    AvatarModel,
    PilgrimCountry
} from './AvatarModel'
import {
    AVATAR_DIMS,
    AVATAR_PALETTES,
    buildPartGeometries,
    disposePartGeometries,
    getCachedPartGeometries,
    type AvatarPalette,
    type AvatarPartGeometries
} from './AvatarGeometry'

/**
 * LowPolyAvatarModel:
 * Nhân vật ~7 đầu (1.75 m), low-poly phẳng màu, dựng từ 6 bộ phận rigid (thân trên + đầu, váy, 2 tay, 2 chân).
 * Không xương: hoạt ảnh bằng cách xoay các pivot Group. Mỗi người chơi = 6 draw call, hình học dùng chung theo quốc gia.
 *
 * Quy ước trục: gốc ở mặt đất giữa hai bàn chân, mặt hướng +Z.
 * Xoay X dương: phần thân trên cúi về phía trước, chi dưới ra phía sau; xoay X âm: nâng tay/chân về phía trước.
 */

const BOW_DURATION = 1.8
const D = AVATAR_DIMS

interface Pose {
    bodyY: number
    bodyRollZ: number
    upperPitch: number
    upperYaw: number
    upperRoll: number
    legLX: number
    legRX: number
    legScaleY: number
    armLX: number
    armLZ: number
    armRX: number
    armRZ: number
    skirtSX: number
    skirtSY: number
    skirtRotX: number
    skirtBackRotX: number
    skirtRotZ: number
}

function neutralPose(): Pose {
    return {
        bodyY: 0,
        bodyRollZ: 0,
        upperPitch: 0,
        upperYaw: 0,
        upperRoll: 0,
        legLX: 0,
        legRX: 0,
        legScaleY: 1,
        armLX: 0,
        armLZ: 0.28,
        armRX: 0,
        armRZ: -0.28,
        skirtSX: 1,
        skirtSY: 1,
        skirtRotX: 0,
        skirtBackRotX: 0,
        skirtRotZ: 0
    }
}

export class LowPolyAvatarModel implements AvatarModel {
    public readonly root = new THREE.Group()

    private readonly bodyPivot = new THREE.Group()
    private readonly upperPivot = new THREE.Group()
    private readonly skirtPivot = new THREE.Group()
    private readonly skirtBackPivot = new THREE.Group()
    private readonly armLPivot = new THREE.Group()
    private readonly armRPivot = new THREE.Group()
    private readonly legLPivot = new THREE.Group()
    private readonly legRPivot = new THREE.Group()

    private readonly upperMesh: THREE.Mesh
    private readonly skirtMesh: THREE.Mesh
    private readonly skirtBackMesh: THREE.Mesh
    private readonly armLMesh: THREE.Mesh
    private readonly armRMesh: THREE.Mesh
    private readonly legLMesh: THREE.Mesh
    private readonly legRMesh: THREE.Mesh

    private currentCountry: PilgrimCountry = 'vietnam'
    private currentGender: AvatarGender = 'female'
    private currentExpression: AvatarExpression = 'serene'
    private currentBodyShape: AvatarBodyShape = 'regular'
    private currentAnimation: AvatarAnimation = 'idle'

    /** Geometry riêng (khi đổi màu áo tuỳ chỉnh) – model sở hữu và phải dispose. */
    private ownedGeometries: AvatarPartGeometries | null = null
    private skirtHeight = 0.7

    private animTime = Math.random() * 10
    private bowTimer = -1
    private bowDuration = 1.8
    private bowHoldDuration = 0.5
    private readonly pose: Pose = neutralPose()
    private readonly target: Pose = neutralPose()

    constructor(country: PilgrimCountry = 'vietnam', gender: AvatarGender = 'female') {
        const material = FlatMaterialFactory.getInstance().vertexColor()
        const geos = getCachedPartGeometries(country, gender)
        this.skirtHeight = geos.skirtHeight

        const makeMesh = (geo: THREE.BufferGeometry) => {
            const mesh = new THREE.Mesh(geo, material)
            mesh.castShadow = true
            mesh.receiveShadow = false
            return mesh
        }

        this.upperMesh = makeMesh(geos.upper)
        this.skirtMesh = makeMesh(geos.skirt)
        this.skirtBackMesh = makeMesh(geos.skirtBack)
        this.armLMesh = makeMesh(geos.armL)
        this.armRMesh = makeMesh(geos.armR)
        this.legLMesh = makeMesh(geos.legL)
        this.legRMesh = makeMesh(geos.legR)

        this.legLPivot.position.set(D.legX, D.hipY, 0)
        this.legRPivot.position.set(-D.legX, D.hipY, 0)
        this.legLPivot.add(this.legLMesh)
        this.legRPivot.add(this.legRMesh)

        this.skirtPivot.position.set(0, D.hipY, 0)
        this.skirtPivot.add(this.skirtMesh)

        this.skirtBackPivot.position.set(0, D.hipY, 0)
        this.skirtBackPivot.add(this.skirtBackMesh)

        this.upperPivot.position.set(0, D.hipY, 0)
        this.armLPivot.position.set(D.shoulderX, D.shoulderY, 0)
        this.armRPivot.position.set(-D.shoulderX, D.shoulderY, 0)
        this.armLPivot.add(this.armLMesh)
        this.armRPivot.add(this.armRMesh)
        this.upperPivot.add(this.upperMesh, this.armLPivot, this.armRPivot)

        this.bodyPivot.add(this.legLPivot, this.legRPivot, this.skirtPivot, this.skirtBackPivot, this.upperPivot)
        this.root.add(this.bodyPivot)

        this.currentCountry = country
        this.currentGender = gender
        this.applyPose(this.pose)
    }

    // ==========================================
    // HỢP ĐỒNG AvatarModel
    // ==========================================

    public setCountry(country: PilgrimCountry) {
        this.currentCountry = country
        this.releaseOwnedGeometries()
        this.assignGeometries(getCachedPartGeometries(this.currentCountry, this.currentGender))
    }

    public setGender(gender: AvatarGender) {
        this.currentGender = gender
        this.releaseOwnedGeometries()
        this.assignGeometries(getCachedPartGeometries(this.currentCountry, this.currentGender))
    }

    public getGender(): AvatarGender {
        return this.currentGender
    }

    public setOutfitColor(colorHex: number) {
        const base = AVATAR_PALETTES[this.currentCountry] ?? AVATAR_PALETTES.vietnam
        const geos = buildPartGeometries({ ...base, gender: this.currentGender, robeColor: colorHex })
        this.assignGeometries(geos)
        this.releaseOwnedGeometries()
        this.ownedGeometries = geos
    }

    /** Áp dụng bộ tạo hình / màu sắc tùy chỉnh riêng (ví dụ NPC Thầy Trụ Trì). */
    public setCustomPalette(palette: AvatarPalette) {
        const geos = buildPartGeometries({ ...palette, gender: palette.gender ?? this.currentGender })
        this.assignGeometries(geos)
        this.releaseOwnedGeometries()
        this.ownedGeometries = geos
    }

    public setExpression(expression: AvatarExpression) {
        // Mặt chỉ có 2 chấm mắt, nên biểu cảm chỉ lưu lại để điều khiển tư thế.
        this.currentExpression = expression
    }

    public getExpression(): AvatarExpression {
        return this.currentExpression
    }

    public setBodyShape(shape: AvatarBodyShape) {
        this.currentBodyShape = shape
        if (shape === 'chubby') {
            this.bodyPivot.scale.set(1.15, 0.96, 1.15)
        } else if (shape === 'tall') {
            this.bodyPivot.scale.set(0.93, 1.08, 0.93)
        } else {
            this.bodyPivot.scale.set(1, 1, 1)
        }
    }

    public getBodyShape(): AvatarBodyShape {
        return this.currentBodyShape
    }

    public play(anim: AvatarAnimation, customDuration?: number, customHold?: number) {
        this.currentAnimation = anim
        if (anim === 'bow') {
            this.bowTimer = 0
            this.bowDuration = customDuration ?? 1.8
            this.bowHoldDuration = customHold ?? 0.5
        } else {
            this.bowTimer = -1
        }
    }

    public update(delta: number, isMoving = false, moveSpeed = 4.8, _worldPos?: THREE.Vector3) {
        this.animTime += delta
        const t = this.animTime
        const tg = this.target
        Object.assign(tg, neutralPose())

        // Cúi lạy: hỗ trợ giữ cúi đầu trang nghiêm (ví dụ giữ 2 giây khi thắp hương).
        if (this.currentAnimation === 'bow') {
            this.bowTimer += delta
            const total = this.bowDuration
            const hold = Math.max(0, Math.min(this.bowHoldDuration, total - 0.4))
            const easeTime = Math.max(0.1, (total - hold) / 2)
            let eased = 0
            if (this.bowTimer < easeTime) {
                const k = this.bowTimer / easeTime
                eased = Math.sin(k * (Math.PI / 2))
            } else if (this.bowTimer < easeTime + hold) {
                eased = 1.0 // Giữ nguyên tư thế cúi đầu chắp tay trang nghiêm
            } else {
                const k = Math.min((this.bowTimer - (easeTime + hold)) / easeTime, 1.0)
                eased = Math.cos(k * (Math.PI / 2))
            }
            tg.upperPitch = Math.min(eased * 1.35, 1) * 0.45
            tg.bodyY = -tg.upperPitch * 0.04
            tg.armLX = -0.88 * eased
            tg.armRX = -0.88 * eased
            tg.armLZ = 0.28 * (1 - eased) - 0.22 * eased
            tg.armRZ = -0.28 * (1 - eased) + 0.22 * eased
            if (this.bowTimer >= total) {
                this.currentAnimation = 'idle'
                this.bowTimer = -1
            }
        } else if (this.currentAnimation === 'meditate') {
            this.poseMeditate(t)
        } else if (this.currentAnimation === 'pray') {
            this.posePray(t)
        } else if (this.currentAnimation === 'wave') {
            this.poseWave(t)
        } else if (isMoving || this.currentAnimation === 'walk') {
            this.poseWalk(t, moveSpeed)
        } else {
            this.poseIdle(t)
        }

        // Làm mượt chuyển tư thế
        const blend = 1 - Math.exp(-14 * Math.min(delta, 0.1))
        const p = this.pose as unknown as Record<keyof Pose, number>
        const g = tg as unknown as Record<keyof Pose, number>
        for (const key of Object.keys(p) as Array<keyof Pose>) {
            p[key] += (g[key] - p[key]) * blend
        }
        this.applyPose(this.pose)
    }

    public dispose() {
        this.releaseOwnedGeometries()
        // Hình học dùng chung theo quốc gia và vật liệu vertexColor dùng chung KHÔNG được dispose ở đây.
        this.root.removeFromParent()
    }

    // ==========================================
    // TƯ THẾ
    // ==========================================

    private poseIdle(t: number) {
        const tg = this.target
        const breath = Math.sin(t * 2.0)
        tg.upperPitch = 0.008 + breath * 0.005
        tg.upperYaw = Math.sin(t * 0.7) * 0.035
        tg.upperRoll = Math.sin(t * 1.1) * 0.015
        tg.armLX = 0.02 + breath * 0.018
        tg.armRX = 0.02 + breath * 0.018
        tg.armLZ = 0.28 + breath * 0.012
        tg.armRZ = -0.28 - breath * 0.012
    }

    private poseWalk(t: number, moveSpeed: number) {
        const tg = this.target
        const freq = Math.max(4.8, moveSpeed * 1.6)
        const cycle = t * freq
        const s = Math.sin(cycle)
        const amp = Math.min(0.30, 0.20 + moveSpeed * 0.02)

        tg.legLX = s * amp
        tg.legRX = -s * amp
        tg.armLX = -s * amp * 0.95
        tg.armRX = s * amp * 0.95
        tg.armLZ = 0.28
        tg.armRZ = -0.28
        tg.bodyY = Math.abs(s) * 0.032
        tg.bodyRollZ = s * 0.022
        tg.upperYaw = s * 0.07
        tg.upperPitch = 0.03
        // Tà trước nâng về trước (-X) và tà sau tung về sau (+X) lớn hơn góc bước chân để không bao giờ bị xuyên qua
        tg.skirtRotX = -(Math.abs(s) * amp * 0.98 + 0.045)
        tg.skirtBackRotX = Math.abs(s) * amp * 0.98 + 0.045
        tg.skirtRotZ = -s * 0.025
    }

    private poseMeditate(t: number) {
        const tg = this.target
        const breath = Math.sin(t * 1.6)
        // Tọa thiền kiết già Chibi: hạ hông vừa khít lên bồ đoàn, chân xếp bằng gọn gàng.
        tg.bodyY = -0.21 + breath * 0.01
        tg.legLX = -1.25
        tg.legRX = -1.25
        tg.legScaleY = 0.72
        tg.skirtSX = 1.16
        tg.skirtSY = 0.72
        tg.skirtRotX = -0.42
        tg.skirtBackRotX = 0.16
        tg.armLX = -0.58
        tg.armRX = -0.58
        tg.armLZ = -0.16
        tg.armRZ = 0.16
        tg.upperPitch = 0.03 + breath * 0.008
        tg.upperYaw = Math.sin(t * 0.5) * 0.012
    }

    private posePray(t: number) {
        const tg = this.target
        const breath = Math.sin(t * 1.6)
        tg.armLX = -0.88
        tg.armRX = -0.88
        tg.armLZ = -0.22
        tg.armRZ = 0.22
        tg.upperPitch = 0.12 + breath * 0.01
        tg.bodyY = Math.sin(t * 1.6) * 0.004
    }

    private poseWave(t: number) {
        const tg = this.target
        tg.armRX = -2.45
        tg.armRZ = -0.25 + Math.sin(t * 8) * 0.28
        tg.armLX = 0.02
        tg.armLZ = 0.28
        tg.upperRoll = 0.04
        tg.upperYaw = Math.sin(t * 0.8) * 0.05
    }

    // ==========================================
    // TIỆN ÍCH
    // ==========================================

    private applyPose(p: Pose) {
        this.bodyPivot.position.y = p.bodyY
        this.bodyPivot.rotation.z = p.bodyRollZ

        this.upperPivot.rotation.set(p.upperPitch, p.upperYaw, p.upperRoll)

        this.legLPivot.rotation.x = p.legLX
        this.legRPivot.rotation.x = p.legRX
        this.legLPivot.scale.y = p.legScaleY
        this.legRPivot.scale.y = p.legScaleY

        this.armLPivot.rotation.set(p.armLX, 0, p.armLZ)
        this.armRPivot.rotation.set(p.armRX, 0, p.armRZ)

        this.skirtPivot.scale.set(p.skirtSX, p.skirtSY, p.skirtSX)
        this.skirtPivot.rotation.set(p.skirtRotX, 0, p.skirtRotZ)

        this.skirtBackPivot.scale.set(p.skirtSX, p.skirtSY, p.skirtSX)
        this.skirtBackPivot.rotation.set(p.skirtBackRotX, 0, p.skirtRotZ)
    }

    private assignGeometries(geos: AvatarPartGeometries) {
        this.upperMesh.geometry = geos.upper
        this.skirtMesh.geometry = geos.skirt
        this.skirtBackMesh.geometry = geos.skirtBack
        this.armLMesh.geometry = geos.armL
        this.armRMesh.geometry = geos.armR
        this.legLMesh.geometry = geos.legL
        this.legRMesh.geometry = geos.legR
        this.skirtHeight = geos.skirtHeight
    }

    private releaseOwnedGeometries() {
        if (this.ownedGeometries) {
            disposePartGeometries(this.ownedGeometries)
            this.ownedGeometries = null
        }
    }
}
