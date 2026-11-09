import * as THREE from 'three'
import { Palette, type PaletteSlot, type TimeOfDayMode } from './Palette'

/**
 * FlatMaterialFactory:
 * Vật liệu phẳng (MeshLambertMaterial + flatShading), không texture, không PBR map.
 * - get(slot): vật liệu theo slot màu của Palette, đổi màu tại chỗ khi setPalette().
 * - emissive(slot): vật liệu phát sáng (đèn lồng, nến) – cường độ theo thời điểm trong ngày.
 * - vertexColor(): vật liệu dùng màu đỉnh đã "nướng" trong geometry (nhân vật, LOD xa).
 * - Tất cả dùng chung gradient theo độ cao (tối ở thấp, sáng ở cao) qua onBeforeCompile.
 */

const gradientUniforms = {
    uGradBottomY: { value: -2.0 },
    uGradTopY: { value: 22.0 },
    uGradStrength: { value: 0.16 }
}

function applyHeightGradient(mat: THREE.Material) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uGradBottomY = gradientUniforms.uGradBottomY
        shader.uniforms.uGradTopY = gradientUniforms.uGradTopY
        shader.uniforms.uGradStrength = gradientUniforms.uGradStrength

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vFlatWorldY;')
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vFlatWorldY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          vFlatWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif`
            )

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                '#include <common>\nvarying float vFlatWorldY;\nuniform float uGradBottomY;\nuniform float uGradTopY;\nuniform float uGradStrength;'
            )
            .replace(
                '#include <color_fragment>',
                `#include <color_fragment>
        float flatH = smoothstep(uGradBottomY, uGradTopY, vFlatWorldY);
        diffuseColor.rgb *= mix(1.0 - uGradStrength, 1.0 + uGradStrength * 0.6, flatH);`
            )
    }
    // Tất cả vật liệu phẳng dùng chung một chương trình shader.
    mat.customProgramCacheKey = () => 'flat-height-gradient'
}

export interface FlatMaterialOptions {
    side?: THREE.Side
    transparent?: boolean
    opacity?: number
    /** Có áp gradient theo độ cao không (mặc định true). */
    gradient?: boolean
}

export class FlatMaterialFactory {
    private static instance: FlatMaterialFactory | null = null

    private mode: TimeOfDayMode = 'day'
    private slotMats = new Map<string, THREE.MeshLambertMaterial>()
    private emissiveMats = new Map<PaletteSlot, THREE.MeshLambertMaterial>()
    private vertexMat: THREE.MeshLambertMaterial | null = null

    public static getInstance(): FlatMaterialFactory {
        if (!FlatMaterialFactory.instance) FlatMaterialFactory.instance = new FlatMaterialFactory()
        return FlatMaterialFactory.instance
    }

    /** Vật liệu phẳng theo slot màu. Cache theo (slot + tùy chọn). */
    public get(slot: PaletteSlot, options: FlatMaterialOptions = {}): THREE.MeshLambertMaterial {
        const key = `${slot}|${options.side ?? 0}|${options.transparent ? 1 : 0}|${options.opacity ?? 1}|${options.gradient === false ? 0 : 1}`
        let mat = this.slotMats.get(key)
        if (!mat) {
            mat = new THREE.MeshLambertMaterial({
                color: Palette.slot(this.mode, slot),
                flatShading: true,
                side: options.side ?? THREE.FrontSide,
                transparent: options.transparent ?? false,
                opacity: options.opacity ?? 1
            })
            mat.userData.paletteSlot = slot
            if (options.gradient !== false) applyHeightGradient(mat)
            this.slotMats.set(key, mat)
        }
        return mat
    }

    /** Vật liệu phát sáng (đèn lồng, nến, hoa đăng). */
    public emissive(slot: PaletteSlot): THREE.MeshLambertMaterial {
        let mat = this.emissiveMats.get(slot)
        if (!mat) {
            const color = Palette.slot(this.mode, slot)
            mat = new THREE.MeshLambertMaterial({
                color,
                emissive: color,
                emissiveIntensity: Palette.get(this.mode).lanterns.emissiveIntensity,
                flatShading: true
            })
            mat.userData.paletteSlot = slot
            this.emissiveMats.set(slot, mat)
        }
        return mat
    }

    /** Vật liệu dùng màu đỉnh có sẵn trong geometry (không đổi theo palette). */
    public vertexColor(): THREE.MeshLambertMaterial {
        if (!this.vertexMat) {
            this.vertexMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
            applyHeightGradient(this.vertexMat)
        }
        return this.vertexMat
    }

    public get currentMode(): TimeOfDayMode {
        return this.mode
    }

    /** Đổi bảng màu cho toàn bộ vật liệu đã tạo (không tạo lại shader). */
    public setPalette(mode: TimeOfDayMode) {
        this.mode = mode
        const pal = Palette.get(mode)

        this.slotMats.forEach((mat) => {
            const slot = mat.userData.paletteSlot as PaletteSlot
            mat.color.setHex(pal.slots[slot])
        })
        this.emissiveMats.forEach((mat, slot) => {
            mat.color.setHex(pal.slots[slot])
            mat.emissive.setHex(pal.slots[slot])
            mat.emissiveIntensity = pal.lanterns.emissiveIntensity
        })
    }

    /** Cập nhật dải độ cao của gradient (ví dụ khi địa hình thay đổi). */
    public setGradientRange(bottomY: number, topY: number, strength = gradientUniforms.uGradStrength.value) {
        gradientUniforms.uGradBottomY.value = bottomY
        gradientUniforms.uGradTopY.value = topY
        gradientUniforms.uGradStrength.value = strength
    }

    public dispose() {
        this.slotMats.forEach((m) => m.dispose())
        this.emissiveMats.forEach((m) => m.dispose())
        this.vertexMat?.dispose()
        this.slotMats.clear()
        this.emissiveMats.clear()
        this.vertexMat = null
        if (FlatMaterialFactory.instance === this) FlatMaterialFactory.instance = null
    }
}
