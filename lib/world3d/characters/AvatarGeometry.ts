import * as THREE from 'three'
import { LowPolyBuilder, type ColoredPart } from '../style/LowPolyBuilder'
import type { PilgrimCountry } from './AvatarModel'

/**
 * AvatarGeometry:
 * Nguồn dữ liệu hình học duy nhất cho nhân vật Chibi Low-Poly 9 quốc gia (~1.75 m tính cả nón).
 * - Bảng màu + kiểu trang phục truyền thống theo 9 quốc gia (khớp hoàn toàn với bản mẫu Chibi Low-Poly).
 * - Dựng danh sách 6 bộ phận rigid (thân trên + đầu + khối hông quần, tà áo/váy cong, 2 tay, 2 chân) với màu đỉnh nướng sẵn.
 * - Tà áo dài & váy uốn cong 3D theo tiết diện elip của thân và quần lụa ống rộng, kết hợp khối hông quần (pelvis)
 *   giúp triệt tiêu 100% khe hở giữa chân và thân người ở mọi góc nhìn.
 * - Dựng mô hình tĩnh gộp 1 mảnh cho LOD1/LOD2 (InstancedMesh đám đông).
 */

export type AvatarStyle = 'ao_nhat_binh' | 'kimono' | 'ca_sa' | 'hanbok' | 'ao_duong' | 'kurta' | 'chuba' | 'robe'
export type AvatarHatKind = 'none' | 'non_la' | 'man_velvet' | 'kasa_japan' | 'gat_korea' | 'shaved_monk' | 'tibet_cowl'
export type AvatarHairKind = 'none' | 'short' | 'bun' | 'knot'
export type AvatarGender = 'female' | 'male'

export interface AvatarPalette {
    style: AvatarStyle
    robeColor: number
    trimColor: number
    innerColor: number
    sashColor: number
    skinColor: number
    hatKind: AvatarHatKind
    hatColor: number
    hairKind: AvatarHairKind
    hairColor: number
    shoesColor: number
    blushColor?: number
    countryKey?: PilgrimCountry
    gender?: AvatarGender
    beard?: boolean
    beardColor?: number
    elderEyebrows?: boolean
    monkSpots?: boolean
}

export const AVATAR_PALETTES: Record<PilgrimCountry, AvatarPalette> = {
    vietnam: {
        style: 'ao_nhat_binh',
        robeColor: 0x3898a2,
        trimColor: 0xe6b432,
        innerColor: 0xf4eee1,
        sashColor: 0x567eb5,
        skinColor: 0xf9d8be,
        hatKind: 'non_la',
        hatColor: 0xf4e79e,
        hairKind: 'bun',
        hairColor: 0x18181e,
        shoesColor: 0x2a2321,
        blushColor: 0xf28d95,
        countryKey: 'vietnam'
    },
    japan: {
        style: 'kimono',
        robeColor: 0x3b4d6b,
        trimColor: 0xf2a6b8,
        innerColor: 0xf7f4ed,
        sashColor: 0xd95f76,
        skinColor: 0xfbe0c8,
        hatKind: 'kasa_japan',
        hatColor: 0xe8cf96,
        hairKind: 'knot',
        hairColor: 0x16151c,
        shoesColor: 0x3a2a1d,
        blushColor: 0xf4929c,
        countryKey: 'japan'
    },
    thailand: {
        style: 'ca_sa',
        robeColor: 0xe87a1e,
        trimColor: 0xf5c438,
        innerColor: 0xd45b12,
        sashColor: 0xf5c438,
        skinColor: 0xf2c8a2,
        hatKind: 'shaved_monk',
        hatColor: 0xf5c438,
        hairKind: 'bun',
        hairColor: 0x1a1618,
        shoesColor: 0x5c3214,
        blushColor: 0xed8585,
        countryKey: 'thailand'
    },
    korea: {
        style: 'hanbok',
        robeColor: 0x6c9ab0,
        trimColor: 0xf5ece2,
        innerColor: 0xd96b7e,
        sashColor: 0x26262b,
        skinColor: 0xfce2ce,
        hatKind: 'gat_korea',
        hatColor: 0x1c1c22,
        hairKind: 'knot',
        hairColor: 0x18161a,
        shoesColor: 0x2b3040,
        blushColor: 0xf595a0,
        countryKey: 'korea'
    },
    taiwan: {
        style: 'ao_duong',
        robeColor: 0x2e6875,
        trimColor: 0xe5ae38,
        innerColor: 0xf5efdc,
        sashColor: 0xc93b3b,
        skinColor: 0xf7d6ba,
        hatKind: 'man_velvet',
        hatColor: 0x23384d,
        hairKind: 'short',
        hairColor: 0x1a181e,
        shoesColor: 0x2c2826,
        blushColor: 0xf08a92,
        countryKey: 'taiwan'
    },
    singapore: {
        style: 'ao_duong',
        robeColor: 0x2ca393,
        trimColor: 0xf07b5e,
        innerColor: 0xf7f1e3,
        sashColor: 0xf0b840,
        skinColor: 0xf6d3b6,
        hatKind: 'man_velvet',
        hatColor: 0xf0b840,
        hairKind: 'short',
        hairColor: 0x1c181b,
        shoesColor: 0x362822,
        blushColor: 0xf28b92,
        countryKey: 'singapore'
    },
    india: {
        style: 'kurta',
        robeColor: 0xc22532,
        trimColor: 0xf7c844,
        innerColor: 0xf5a642,
        sashColor: 0xf7c844,
        skinColor: 0xdfb088,
        hatKind: 'shaved_monk',
        hatColor: 0xf7c844,
        hairKind: 'short',
        hairColor: 0x161215,
        shoesColor: 0x522210,
        blushColor: 0xe37878,
        countryKey: 'india'
    },
    tibet: {
        style: 'chuba',
        robeColor: 0x7c1f8c,
        trimColor: 0xf7c128,
        innerColor: 0x9e1922,
        sashColor: 0xe84878,
        skinColor: 0xeabf98,
        hatKind: 'tibet_cowl',
        hatColor: 0xf7c128,
        hairKind: 'short',
        hairColor: 0x181416,
        shoesColor: 0x3b124f,
        blushColor: 0xeb8088,
        countryKey: 'tibet'
    },
    western: {
        style: 'robe',
        robeColor: 0x6e4e37,
        trimColor: 0xc99b68,
        innerColor: 0xf2eadf,
        sashColor: 0x4a3322,
        skinColor: 0xfce2d0,
        hatKind: 'shaved_monk',
        hatColor: 0x523927,
        hairKind: 'short',
        hairColor: 0x6e472b,
        shoesColor: 0x382518,
        blushColor: 0xf49298,
        countryKey: 'western'
    }
}

/**
 * Bảng màu & tạo hình riêng cho NPC Thầy Trụ Trì (đầu trọc không tóc/không mũ, râu tóc bạc, mặc áo cà sa).
 */
export const ABBOT_PALETTE: AvatarPalette = {
    style: 'ca_sa',
    robeColor: 0x734422,
    trimColor: 0xd9801e,
    innerColor: 0x522f17,
    sashColor: 0xf2c144,
    skinColor: 0xefceb1,
    hatKind: 'shaved_monk',
    hatColor: 0xd9801e,
    hairKind: 'none',
    hairColor: 0xe6e8ec,
    shoesColor: 0x382315,
    blushColor: 0,
    gender: 'male',
    beard: true,
    beardColor: 0xe6e8ec,
    elderEyebrows: true,
    monkSpots: true
}

/**
 * Hệ số quy đổi từ đơn vị thiết kế Chibi (cao ~2.05 đơn vị tính cả nón) sang mét trong thế giới 3D (~1.76 m).
 */
const S = 0.86

/** Kích thước chuẩn (m). Gốc toạ độ nằm ở mặt đất, giữa hai bàn chân, hướng mặt = +Z. */
export const AVATAR_DIMS = {
    hipY: 0.58 * S,
    legX: 0.118 * S,
    shoulderX: 0.195 * S,
    /** So với trục thân trên (ngang hông). */
    shoulderY: (1.13 - 0.58) * S,
    torsoTop: (1.20 - 0.58) * S,
    headCenterY: (1.50 - 0.58) * S,
    totalHeight: 1.75
} as const

const D = AVATAR_DIMS

// ---------------------------------------------------------------------------
// Tiện ích dựng hình Chibi Low-Poly
// ---------------------------------------------------------------------------

const _mat4 = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _scl = new THREE.Vector3()

interface PlaceOpts {
    x?: number
    y?: number
    z?: number
    sx?: number
    sy?: number
    sz?: number
    rx?: number
    ry?: number
    rz?: number
}

/**
 * Biến đổi geometry theo toạ độ thiết kế (preview units) rồi quy đổi sang mét (nhân hệ số S)
 * và trả về ColoredPart có normal phẳng.
 */
function makePart(rawGeo: THREE.BufferGeometry, color: number, opts: PlaceOpts = {}): ColoredPart {
    const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone()
    if (g !== rawGeo) rawGeo.dispose()

    const sx = (opts.sx ?? 1) * S
    const sy = (opts.sy ?? 1) * S
    const sz = (opts.sz ?? 1) * S
    _pos.set((opts.x ?? 0) * S, (opts.y ?? 0) * S, (opts.z ?? 0) * S)
    _euler.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0, 'XYZ')
    _quat.setFromEuler(_euler)
    _scl.set(sx, sy, sz)
    _mat4.compose(_pos, _quat, _scl)

    g.applyMatrix4(_mat4)
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    g.computeVertexNormals()
    return { geometry: g, color }
}

const sph = (r: number, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h)
const cyl = (rt: number, rb: number, h: number, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cone = (r: number, h: number, s = 14) => new THREE.ConeGeometry(r, h, s, 1, false)

/**
 * Dựng nón hình chóp có cả mặt ngoài và mặt trong (để nhìn từ dưới lên không bị trong suốt với FrontSide material).
 */
function buildSolidConeHat(r: number, h: number, segs = 14): THREE.BufferGeometry {
    const outer = new THREE.ConeGeometry(r, h, segs, 1, true)
    const inner = new THREE.ConeGeometry(r * 0.985, h * 0.985, segs, 1, true)
    // Đảo chiều tam giác mặt trong
    const idx = inner.index!
    for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i + 1)
        const b = idx.getX(i + 2)
        idx.setX(i + 1, b)
        idx.setX(i + 2, a)
    }
    const oNon = outer.toNonIndexed()
    const iNon = inner.toNonIndexed()
    outer.dispose()
    inner.dispose()

    const oPos = oNon.attributes.position.array as Float32Array
    const iPos = iNon.attributes.position.array as Float32Array
    const merged = new Float32Array(oPos.length + iPos.length)
    merged.set(oPos, 0)
    merged.set(iPos, oPos.length)
    oNon.dispose()
    iNon.dispose()

    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.BufferAttribute(merged, 3))
    out.computeVertexNormals()
    return out
}

/**
 * Dựng một mảnh vỏ cong siêu elip (squircle) 3D có độ dày:
 * Giữ mặt trước phẳng đầy đặn bao phủ hoàn toàn 2 ống quần phía trong (không bao giờ bị quần đâm xuyên),
 * đồng thời bo cong ở 2 mép ngoài cùng (|u| > 0.7) vào ôm sát sườn quần để không hở hông khi nhìn nghiêng.
 */
function buildCurvedShellGeo(
    hwTop: number,
    hwBot: number,
    zFrontTop: number,
    zFrontBot: number,
    bendTop: number,
    bendBot: number,
    height: number,
    sideZ: number,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    zExtraOffset: number,
    thickness: number,
    segU = 8,
    segV = 4
): THREE.BufferGeometry {
    const positions: number[] = []
    const indices: number[] = []

    function pt(u: number, v: number, zOff: number): [number, number, number] {
        const y = -v * height
        const hw = hwTop + (hwBot - hwTop) * v
        const zFront = zFrontTop + (zFrontBot - zFrontTop) * v + zOff
        const bend = bendTop + (bendBot - bendTop) * v
        const absU = Math.min(1.05, Math.abs(u))
        const zMag = zFront - bend * Math.pow(absU, 2.8)
        return [hw * u, y, sideZ * zMag]
    }

    const cols = segU + 1
    const rows = segV + 1
    for (let layer = 0; layer < 2; layer++) {
        const zOff = layer === 0 ? zExtraOffset : zExtraOffset - thickness
        for (let iv = 0; iv < rows; iv++) {
            const v = v0 + (v1 - v0) * (iv / segV)
            for (let iu = 0; iu < cols; iu++) {
                const u = u0 + (u1 - u0) * (iu / segU)
                positions.push(...pt(u, v, zOff))
            }
        }
    }

    const stride = cols * rows
    const flip = sideZ < 0

    function addQuad(a: number, b: number, c: number, d: number, invert = false) {
        if (invert === flip) {
            indices.push(a, c, b, a, d, c)
        } else {
            indices.push(a, b, c, a, c, d)
        }
    }

    for (let iv = 0; iv < segV; iv++) {
        for (let iu = 0; iu < segU; iu++) {
            const i0 = iv * cols + iu
            const i1 = i0 + 1
            const i2 = i0 + cols + 1
            const i3 = i0 + cols
            addQuad(i0, i1, i2, i3, false)
            addQuad(stride + i0, stride + i1, stride + i2, stride + i3, true)
        }
    }
    for (let iu = 0; iu < segU; iu++) {
        addQuad(iu, iu + 1, stride + iu + 1, stride + iu, true)
        const b = segV * cols + iu
        addQuad(b, b + 1, stride + b + 1, stride + b, false)
    }
    for (let iv = 0; iv < segV; iv++) {
        const l0 = iv * cols
        const l1 = (iv + 1) * cols
        addQuad(l0, l1, stride + l1, stride + l0, false)
        const r0 = iv * cols + segU
        const r1 = (iv + 1) * cols + segU
        addQuad(r0, r1, stride + r1, stride + r0, true)
    }

    const geo = new THREE.BufferGeometry()
    geo.setIndex(indices)
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const flatGeo = geo.toNonIndexed()
    geo.dispose()
    flatGeo.computeVertexNormals()
    return flatGeo
}

/**
 * Tạo danh sách ColoredPart cho 1 tấm tà áo (trước hoặc sau) bao phủ hoàn toàn 2 ống quần bên trong.
 * yTopRelHip = 0.62 - 0.58 = +0.04 (trong hệ quy chiếu skirtPivot đặt tại hipY = 0.58).
 */
function buildCurvedAoDaiFlapParts(
    widthTop: number,
    widthBot: number,
    height: number,
    sideZ: 1 | -1,
    mainColor: number,
    trimColor: number | null,
    yTopRelHip = 0.04
): ColoredPart[] {
    const parts: ColoredPart[] = []
    const hwTop = widthTop * 0.52
    const hwBot = widthBot * 0.50
    const zFrontTop = 0.152
    const zFrontBot = 0.170
    const bendTop = 0.044
    const bendBot = 0.050
    const thickness = 0.016

    parts.push(
        makePart(
            buildCurvedShellGeo(hwTop, hwBot, zFrontTop, zFrontBot, bendTop, bendBot, height, sideZ, -1, 1, 0, 1, 0, thickness, 8, 4),
            mainColor,
            { y: yTopRelHip }
        )
    )

    if (trimColor !== null) {
        for (const s of [-1, 1]) {
            const uStart = s < 0 ? -1.03 : 0.85
            const uEnd = s < 0 ? -0.85 : 1.03
            parts.push(
                makePart(
                    buildCurvedShellGeo(
                        hwTop,
                        hwBot,
                        zFrontTop,
                        zFrontBot,
                        bendTop,
                        bendBot,
                        height,
                        sideZ,
                        uStart,
                        uEnd,
                        0.02,
                        1.01,
                        0.004,
                        thickness + 0.005,
                        2,
                        4
                    ),
                    trimColor,
                    { y: yTopRelHip }
                )
            )
        }
        parts.push(
            makePart(
                buildCurvedShellGeo(
                    hwTop,
                    hwBot,
                    zFrontTop,
                    zFrontBot,
                    bendTop,
                    bendBot,
                    height,
                    sideZ,
                    -1.03,
                    1.03,
                    0.89,
                    1.02,
                    0.005,
                    thickness + 0.006,
                    8,
                    1
                ),
                trimColor,
                { y: yTopRelHip }
            )
        )
    }

    return parts
}

/**
 * Tạo dải lụa vắt chéo ngực phẳng mượt ôm sát thân trước Áo Dài (trong hệ quy chiếu upperPivot tại hipY = 0.58).
 */
function buildDiagonalChestSashParts(mainColor: number, secondLineColor: number | null): ColoredPart[] {
    const parts: ColoredPart[] = []
    const hipY = 0.58
    const pts = [
        new THREE.Vector3(0.08, 1.16 - hipY, 0.132),
        new THREE.Vector3(0.01, 1.07 - hipY, 0.156),
        new THREE.Vector3(-0.09, 0.96 - hipY, 0.162),
        new THREE.Vector3(-0.18, 0.85 - hipY, 0.146),
        new THREE.Vector3(-0.23, 0.77 - hipY, 0.095)
    ]
    const curve = new THREE.CatmullRomCurve3(pts)
    parts.push(makePart(new THREE.TubeGeometry(curve, 16, 0.034, 6, false), mainColor, { z: 0.088, sz: 0.38 }))

    if (secondLineColor !== null) {
        const pts2 = [
            new THREE.Vector3(0.05, 1.18 - hipY, 0.132),
            new THREE.Vector3(-0.03, 1.10 - hipY, 0.154),
            new THREE.Vector3(-0.13, 1.00 - hipY, 0.156),
            new THREE.Vector3(-0.21, 0.91 - hipY, 0.138)
        ]
        const curve2 = new THREE.CatmullRomCurve3(pts2)
        parts.push(makePart(new THREE.TubeGeometry(curve2, 12, 0.010, 5, false), secondLineColor, { z: 0.088, sz: 0.40 }))
    }
    return parts
}

/** Xác định mã quốc gia từ AvatarPalette để dựng đúng trang phục đặc trưng. */
function resolveCountryStyle(p: AvatarPalette): PilgrimCountry {
    if (p.countryKey) return p.countryKey
    switch (p.style) {
        case 'ao_nhat_binh':
            return 'vietnam'
        case 'kimono':
            return 'japan'
        case 'ca_sa':
            return 'thailand'
        case 'hanbok':
            return 'korea'
        case 'ao_duong':
            return p.hatColor === 0xf0b840 ? 'singapore' : 'taiwan'
        case 'kurta':
            return 'india'
        case 'chuba':
            return 'tibet'
        case 'robe':
        default:
            return 'western'
    }
}

// ---------------------------------------------------------------------------
// 1. Đầu Chibi, khuôn mặt, mái tóc rẽ ngôi & nón truyền thống (tương đối so với hipY = 0.58)
// ---------------------------------------------------------------------------

function buildHeadParts(p: AvatarPalette, cStyle: PilgrimCountry): ColoredPart[] {
    const parts: ColoredPart[] = []
    const hy = 1.50 - 0.58 // +0.92 trong không gian upperPivot
    const dark = 0x181514
    const isMale = p.gender === 'male'
    const isSolemnNpc = p.blushColor === 0
    const blush = p.blushColor ?? 0xf28d95

    // Đầu bầu dục chibi đa giác mềm mại (giống 100% giữa Nam và Nữ chính)
    parts.push(
        makePart(sph(0.34, 14, 10), p.skinColor, {
            y: hy,
            sx: 1.06,
            sy: 0.94,
            sz: 0.92
        })
    )

    // Đôi tai hai bên
    for (const s of [-1, 1]) {
        parts.push(makePart(sph(0.062, 7, 6), p.skinColor, { x: s * 0.355, y: hy - 0.025, z: -0.01, sx: 0.55, sy: 0.95, sz: 0.75 }))
    }

    // Đôi mắt đen láy + đốm sáng + lông mày + má hồng (Nam chính giống 100% Nữ chính; riêng tượng/NPC trang nghiêm có blushColor = 0 thì ẩn má hồng)
    for (const s of [-1, 1]) {
        parts.push(
            makePart(sph(0.042, 8, 6), dark, {
                x: s * 0.132,
                y: hy - 0.005,
                z: 0.295,
                sx: 0.92,
                sy: 1.25,
                sz: 0.55
            })
        )
        parts.push(makePart(sph(0.013, 5, 4), 0xffffff, { x: s * 0.132 - 0.012, y: hy + 0.022, z: 0.322 }))

        if (isSolemnNpc && isMale) {
            const browColor = p.elderEyebrows ? (p.beardColor ?? 0xe6e8ec) : dark
            const browH = p.elderEyebrows ? 0.024 : 0.018
            parts.push(
                makePart(box(0.095, browH, 0.018), browColor, {
                    x: s * 0.135,
                    y: hy + 0.082,
                    z: 0.296,
                    ry: -s * 0.25,
                    rz: s * (p.elderEyebrows ? -0.06 : 0.10)
                })
            )
        } else {
            parts.push(
                makePart(new THREE.TorusGeometry(0.042, 0.008, 4, 6, Math.PI * 0.55), dark, {
                    x: s * 0.135,
                    y: hy + 0.088,
                    z: 0.292,
                    rz: Math.PI * 0.22 - s * 0.08
                })
            )
        }

        if (!isSolemnNpc) {
            const cheekGeo = cyl(0.056, 0.056, 0.01, 6)
            cheekGeo.rotateX(Math.PI / 2)
            parts.push(makePart(cheekGeo, blush, { x: s * 0.215, y: hy - 0.085, z: 0.258, ry: s * 0.48 }))
        }
    }

    // Mũi nhỏ & miệng cười
    parts.push(makePart(sph(0.024, 6, 5), 0xebae8d, { x: 0, y: hy - 0.045, z: 0.322, sx: 1.1, sy: 0.85, sz: 0.9 }))
    parts.push(
        makePart(new THREE.TorusGeometry(0.040, 0.009, 4, 8, Math.PI * 0.85), 0xb85642, {
            x: 0,
            y: hy - 0.118,
            z: 0.298,
            rz: Math.PI * 1.075
        })
    )

    // Râu dài uy nghiêm (dành cho Thầy Trụ Trì lớn tuổi / tượng Đức Thánh Trần)
    if (p.beard) {
        const beardCol = p.beardColor ?? p.hairColor
        parts.push(
            makePart(cone(0.088, 0.28, 6), beardCol, {
                x: 0,
                y: hy - 0.27,
                z: 0.26,
                rx: Math.PI,
                sx: 0.95,
                sy: 1.0,
                sz: 0.45
            })
        )
        if (p.elderEyebrows) {
            for (const s of [-1, 1]) {
                parts.push(
                    makePart(box(0.068, 0.020, 0.020), beardCol, {
                        x: s * 0.048,
                        y: hy - 0.098,
                        z: 0.308,
                        ry: -s * 0.18,
                        rz: -s * 0.22
                    })
                )
            }
        }
    }

    // Chấm đỏ Bindi giữa trán cho Ấn Độ
    if (cStyle === 'india' && !isMale) {
        parts.push(makePart(sph(0.016, 6, 5), 0xd91e2a, { x: 0, y: hy + 0.065, z: 0.315, sz: 0.4 }))
    }

    const isShavedHead = p.hairKind === 'none'
    if (isShavedHead) {
        if (p.monkSpots) {
            // 6 dấu hương đinh (giới đinh) đặc trưng nhà sư trên đỉnh trán
            const spotColor = 0xb58668
            for (const rowY of [0.22, 0.265]) {
                for (const colX of [-0.048, 0, 0.048]) {
                    parts.push(
                        makePart(sph(0.010, 5, 4), spotColor, {
                            x: colX,
                            y: hy + rowY,
                            z: 0.215 - (rowY - 0.22) * 0.55
                        })
                    )
                }
            }
        }
        return parts
    }

    // Mũ tóc đỉnh đầu & 2 mái tóc rẽ ngôi trước trán (giống 100% giữa Nam và Nữ)
    parts.push(
        makePart(new THREE.SphereGeometry(0.358, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), p.hairColor, {
            x: 0,
            y: hy + 0.02,
            z: -0.02,
            sx: 1.06,
            sy: 0.96,
            sz: 0.95,
            rx: -0.18
        })
    )
    for (const s of [-1, 1]) {
        parts.push(
            makePart(sph(0.18, 8, 6), p.hairColor, {
                x: s * 0.175,
                y: hy + 0.135,
                z: 0.225,
                sx: 1.18,
                sy: 0.58,
                sz: 0.55,
                ry: s * 0.32,
                rz: -s * 0.42
            })
        )
    }

    // Phần tóc sau gáy: Nam cắt ngắn gọn gàng trên gáy; Nữ có 2 lọn tóc buông hai bên má và búi tóc dài sau gáy
    if (isMale) {
        parts.push(
            makePart(sph(0.24, 10, 8), p.hairColor, {
                x: 0,
                y: hy + 0.01,
                z: -0.13,
                sx: 0.96,
                sy: 0.72,
                sz: 0.58
            })
        )
        for (const s of [-1, 1]) {
            parts.push(
                makePart(box(0.032, 0.09, 0.055), p.hairColor, {
                    x: s * 0.335,
                    y: hy + 0.03,
                    z: 0.05,
                    rz: -s * 0.08
                })
            )
        }
    } else {
        for (const s of [-1, 1]) {
            parts.push(
                makePart(sph(0.19, 8, 7), p.hairColor, {
                    x: s * 0.25,
                    y: hy - 0.12,
                    z: -0.12,
                    sx: 0.85,
                    sy: 1.08,
                    sz: 0.82
                })
            )
        }
        parts.push(makePart(sph(0.32, 10, 8), p.hairColor, { x: 0, y: hy - 0.09, z: -0.16, sx: 1.12, sy: 0.96, sz: 0.72 }))
    }

    // Nếu hatKind === 'none', bỏ qua nón quốc gia để gắn Mũ Quan / Khăn Chầu / Mão Thánh Mẫu chuyên biệt
    if (p.hatKind === 'none') {
        return parts
    }

    // Nón lá & Mũ truyền thống theo quốc gia
    if (cStyle === 'vietnam' || cStyle === 'japan') {
        const hatRadius = cStyle === 'vietnam' ? 0.68 : 0.64
        const hatHeight = cStyle === 'vietnam' ? 0.56 : 0.36
        parts.push(makePart(buildSolidConeHat(hatRadius, hatHeight, 14), p.hatColor, { x: 0, y: hy + 0.36, z: -0.02, rx: -0.06 }))

        const strapPts = [
            new THREE.Vector3(-0.46, hy + 0.10, 0.08),
            new THREE.Vector3(-0.36, hy - 0.13, 0.15),
            new THREE.Vector3(-0.18, hy - 0.26, 0.20),
            new THREE.Vector3(0.0, hy - 0.295, 0.21),
            new THREE.Vector3(0.18, hy - 0.26, 0.20),
            new THREE.Vector3(0.36, hy - 0.13, 0.15),
            new THREE.Vector3(0.46, hy + 0.10, 0.08)
        ]
        const strapCurve = new THREE.CatmullRomCurve3(strapPts)
        parts.push(makePart(new THREE.TubeGeometry(strapCurve, 20, 0.012, 5, false), p.sashColor))

        for (const s of [-1, 1]) {
            parts.push(makePart(box(0.022, 0.36, 0.010), p.sashColor, { x: s * 0.47, y: hy - 0.06, z: 0.08, rz: s * 0.06 }))
        }
    } else if (cStyle === 'thailand') {
        parts.push(makePart(cyl(0.18, 0.24, 0.12, 10), p.trimColor, { x: 0, y: hy + 0.34, z: 0 }))
        parts.push(makePart(cone(0.18, 0.48, 10), p.trimColor, { x: 0, y: hy + 0.62, z: 0 }))
        parts.push(makePart(sph(0.04, 6, 6), p.trimColor, { x: 0, y: hy + 0.87, z: 0 }))
    } else if (cStyle === 'korea') {
        parts.push(makePart(cyl(0.56, 0.56, 0.025, 16), p.hatColor, { x: 0, y: hy + 0.32, z: 0 }))
        parts.push(makePart(cyl(0.19, 0.21, 0.26, 12), p.hatColor, { x: 0, y: hy + 0.45, z: 0 }))
    } else if (cStyle === 'taiwan') {
        parts.push(makePart(cyl(0.30, 0.33, 0.16, 12), p.hatColor, { x: 0, y: hy + 0.33, z: 0 }))
        parts.push(makePart(sph(0.04, 8, 6), p.sashColor, { x: 0, y: hy + 0.43, z: 0 }))
    } else if (cStyle === 'singapore' || cStyle === 'india') {
        parts.push(makePart(cyl(0.22, 0.26, 0.08, 10), p.trimColor, { x: 0, y: hy + 0.32, z: 0 }))
        for (let i = -2; i <= 2; i++) {
            parts.push(makePart(sph(0.032, 6, 5), p.trimColor, { x: i * 0.06, y: hy + 0.37, z: 0.16 - Math.abs(i) * 0.02 }))
        }
    } else if (cStyle === 'tibet') {
        parts.push(makePart(cyl(0.34, 0.36, 0.14, 12), 0x4a2512, { x: 0, y: hy + 0.31, z: 0 }))
        parts.push(makePart(sph(0.31, 10, 8), p.hatColor, { x: 0, y: hy + 0.38, z: 0, sy: 0.65 }))
    } else {
        parts.push(makePart(sph(0.33, 12, 8), p.hatColor, { x: 0.03, y: hy + 0.32, z: 0, sx: 1.08, sy: 0.42, sz: 1.05 }))
    }

    return parts
}

// ---------------------------------------------------------------------------
// 2. Thân trên (Khối hông quần liền mạch + Thân áo + Cổ tàu + Dải lụa + Đầu)
// ---------------------------------------------------------------------------

function buildUpper(p: AvatarPalette): ColoredPart[] {
    const parts: ColoredPart[] = []
    const hipY = 0.58
    const cStyle = resolveCountryStyle(p)

    // Khối hông quần (Pelvis) nằm gọn trong lòng tà áo, nối liền từ thân áo xuống 2 ống quần không hở hông
    parts.push(makePart(cyl(0.185, 0.195, 0.22, 12), p.innerColor, { x: 0, y: 0.58 - hipY, z: 0, sz: 0.56 }))

    // Thân áo trên (ôm gọn từ ngực y=1.20 xuống qua eo y=0.60)
    parts.push(makePart(cyl(0.175, 0.228, 0.60, 12), p.robeColor, { x: 0, y: 0.90 - hipY, z: 0, sz: 0.668 }))

    // Cổ áo đứng (Cổ tàu) + viền vàng mảnh trên cổ
    parts.push(makePart(cyl(0.092, 0.105, 0.08, 10), p.robeColor, { x: 0, y: 1.20 - hipY, z: 0, sz: 0.82 }))
    parts.push(makePart(cyl(0.096, 0.106, 0.022, 10), p.trimColor, { x: 0, y: 1.175 - hipY, z: 0, sz: 0.83 }))

    // Chi tiết ngực áo theo từng quốc gia
    if (cStyle === 'vietnam' || cStyle === 'taiwan') {
        parts.push(...buildDiagonalChestSashParts(p.trimColor, p.trimColor))
        if (cStyle === 'taiwan') {
            for (let i = 0; i < 3; i++) {
                parts.push(makePart(sph(0.018, 6, 5), 0xc93b3b, { x: -0.04 - i * 0.06, y: 1.08 - i * 0.08 - hipY, z: 0.155 }))
            }
        }
    } else if (cStyle === 'japan') {
        parts.push(...buildDiagonalChestSashParts(0xffffff, p.trimColor))
        parts.push(makePart(cyl(0.228, 0.232, 0.18, 10), p.trimColor, { x: 0, y: 0.78 - hipY, z: 0, sz: 0.68 }))
        parts.push(makePart(box(0.24, 0.20, 0.09), p.trimColor, { x: 0, y: 0.80 - hipY, z: -0.17 }))
    } else if (cStyle === 'korea') {
        parts.push(...buildDiagonalChestSashParts(p.trimColor, p.sashColor))
    } else if (cStyle === 'thailand' || cStyle === 'india') {
        if (p.hairKind === 'none') {
            // Y cà sa quấn chéo vai + đai y + khoen vàng + tràng hạt cho Sư Thầy / Thầy Trụ Trì
            const wrapPtsFront = [
                new THREE.Vector3(0.11, 1.18 - hipY, 0.125),
                new THREE.Vector3(0.02, 1.08 - hipY, 0.155),
                new THREE.Vector3(-0.08, 0.96 - hipY, 0.162),
                new THREE.Vector3(-0.18, 0.84 - hipY, 0.145),
                new THREE.Vector3(-0.23, 0.75 - hipY, 0.08)
            ]
            const wrapPtsBack = [
                new THREE.Vector3(0.11, 1.18 - hipY, -0.12),
                new THREE.Vector3(0.02, 1.07 - hipY, -0.145),
                new THREE.Vector3(-0.08, 0.95 - hipY, -0.152),
                new THREE.Vector3(-0.18, 0.83 - hipY, -0.135),
                new THREE.Vector3(-0.23, 0.75 - hipY, -0.07)
            ]
            parts.push(
                makePart(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wrapPtsFront), 16, 0.062, 7, false), p.trimColor, {
                    z: 0.065,
                    sz: 0.45
                })
            )
            parts.push(
                makePart(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wrapPtsBack), 16, 0.062, 7, false), p.trimColor, {
                    z: -0.06,
                    sz: 0.45
                })
            )
            // Vạt cà sa phủ vai phải / hông & đai lưng màu nghệ
            parts.push(makePart(cyl(0.212, 0.224, 0.14, 12), p.trimColor, { x: 0, y: 0.73 - hipY, z: 0, sz: 0.68 }))
            parts.push(makePart(cyl(0.226, 0.228, 0.024, 12), p.sashColor, { x: 0, y: 0.80 - hipY, z: 0, sz: 0.69 }))
            // Khoen vàng y hậu (cà sa móc vai) trước ngực
            parts.push(
                makePart(new THREE.TorusGeometry(0.030, 0.008, 5, 10), p.sashColor, {
                    x: 0.07,
                    y: 1.08 - hipY,
                    z: 0.165,
                    rx: -0.18,
                    ry: 0.15
                })
            )
            // Tràng hạt gỗ đeo cổ buông nhẹ
            const beadCount = 9
            for (let bi = 0; bi < beadCount; bi++) {
                const u = bi / (beadCount - 1) - 0.5
                const bx = u * 0.16
                const by = 1.15 - Math.cos(u * Math.PI) * 0.11 - hipY
                const bz = 0.125 + Math.cos(u * Math.PI) * 0.042
                parts.push(makePart(sph(0.015, 5, 4), 0x42220e, { x: bx, y: by, z: bz }))
            }
        } else {
            parts.push(...buildDiagonalChestSashParts(p.trimColor, null))
        }
    } else if (cStyle === 'tibet') {
        parts.push(...buildDiagonalChestSashParts(p.trimColor, p.sashColor))
    } else if (cStyle === 'singapore') {
        parts.push(makePart(box(0.05, 0.44, 0.02), p.trimColor, { x: 0, y: 0.94 - hipY, z: 0.15 }))
    } else {
        parts.push(makePart(cone(0.32, 0.26, 10), p.trimColor, { x: 0, y: 1.08 - hipY, z: 0, sz: 0.72 }))
    }

    // Cổ nhân vật
    parts.push(makePart(cyl(0.068, 0.078, 0.10, 8), p.skinColor, { x: 0, y: 1.25 - hipY, z: 0 }))

    // Đầu, khuôn mặt, tóc & nón
    parts.push(...buildHeadParts(p, cStyle))

    return parts
}

// ---------------------------------------------------------------------------
// 3. Tà áo dài cong 3D trước & sau tách rời (xoay quanh trục hông hipY = 0.58)
// ---------------------------------------------------------------------------

function buildSkirts(p: AvatarPalette): { frontParts: ColoredPart[]; backParts: ColoredPart[]; height: number } {
    const cStyle = resolveCountryStyle(p)

    if (cStyle === 'korea') {
        // Hanbok: Chia vạt trước và vạt sau của chân váy Chima để khi bước chân không đâm xuyên váy
        const frontParts = buildCurvedAoDaiFlapParts(0.38, 0.48, 0.50, 1, p.innerColor, p.trimColor, 0.04)
        const backParts = buildCurvedAoDaiFlapParts(0.38, 0.48, 0.50, -1, p.innerColor, p.trimColor, 0.04)
        return { frontParts, backParts, height: 0.50 * S }
    }

    if (cStyle === 'tibet') {
        // Tạp dề Pangden phía trước + tà sau Chuba
        const frontParts = buildCurvedAoDaiFlapParts(0.34, 0.38, 0.48, 1, 0xf5c128, 0xc92a3a, 0.04)
        const backParts = buildCurvedAoDaiFlapParts(0.38, 0.42, 0.48, -1, p.robeColor, p.trimColor, 0.04)
        return { frontParts, backParts, height: 0.48 * S }
    }

    const widthTop = cStyle === 'japan' ? 0.38 : 0.36
    const widthBot =
        cStyle === 'japan'
            ? 0.40
            : cStyle === 'thailand'
              ? 0.38
              : cStyle === 'india'
                ? 0.43
                : cStyle === 'singapore'
                  ? 0.40
                  : 0.42
    const flapH = cStyle === 'singapore' ? 0.46 : 0.48

    const frontParts = buildCurvedAoDaiFlapParts(widthTop, widthBot, flapH, 1, p.robeColor, p.trimColor, 0.04)
    const backParts = buildCurvedAoDaiFlapParts(widthTop, widthBot, flapH, -1, p.robeColor, p.trimColor, 0.04)

    return { frontParts, backParts, height: flapH * S }
}

// ---------------------------------------------------------------------------
// 4. Hai tay áo xuôi tự nhiên & đôi chân quần lụa ống rộng + giày hài
// ---------------------------------------------------------------------------

function buildArm(p: AvatarPalette, sideSign: 1 | -1): ColoredPart[] {
    const cStyle = resolveCountryStyle(p)
    const sleeveBotR = cStyle === 'japan' ? 0.11 : 0.088
    const parts: ColoredPart[] = []

    // Đầu vai bo nhỏ mượt (không bị u vai)
    parts.push(makePart(sph(0.072, 8, 6), p.robeColor, { x: 0, y: -0.02, z: 0, sx: 0.95, sy: 1.0, sz: 0.85 }))

    // Ống tay áo hơi loe nhẹ về phía cổ tay
    parts.push(makePart(cyl(0.068, sleeveBotR, 0.42, 8), p.robeColor, { x: 0, y: -0.22, z: 0, sz: 0.85 }))

    // Viền vàng cổ tay áo
    parts.push(makePart(cyl(sleeveBotR + 0.003, sleeveBotR + 0.005, 0.042, 8), p.trimColor, { x: 0, y: -0.42, z: 0, sz: 0.86 }))

    // Bàn tay mũm mĩm + ngón cái nhỏ
    parts.push(makePart(sph(0.058, 8, 6), p.skinColor, { x: 0, y: -0.49, z: 0, sx: 0.92, sy: 1.12, sz: 0.85 }))
    parts.push(makePart(sph(0.024, 6, 5), p.skinColor, { x: -sideSign * 0.042, y: -0.475, z: 0.025 }))

    return parts
}

function buildLeg(p: AvatarPalette): ColoredPart[] {
    return [
        // Chỏm cầu khớp hông gọn chiều Z giúp khi bước chân không bao giờ lộ khe hở hay đâm qua tà
        makePart(sph(0.102, 8, 6), p.innerColor, { x: 0, y: 0, z: 0, sx: 0.92, sy: 0.82, sz: 0.76 }),
        // Ống quần lụa suông rộng 8 cạnh (rộng chiều ngang X để lộ đẹp ở khe xẻ tà, gọn chiều Z để nằm hoàn toàn trong tà áo)
        makePart(cyl(0.108, 0.146, 0.50, 8), p.innerColor, { x: 0, y: -0.24, z: 0, sz: 0.78 }),
        // Đôi hài đen mũi tròn
        makePart(sph(0.088, 8, 6), p.shoesColor, { x: 0, y: -0.52, z: 0.035, sx: 0.95, sy: 0.52, sz: 1.42 })
    ]
}

// ---------------------------------------------------------------------------
// API công khai
// ---------------------------------------------------------------------------

export interface AvatarPartLists {
    upper: ColoredPart[]
    skirt: ColoredPart[]
    skirtBack: ColoredPart[]
    armL: ColoredPart[]
    armR: ColoredPart[]
    legL: ColoredPart[]
    legR: ColoredPart[]
    /** Chiều cao phần váy/tà áo phía dưới hông (m). */
    skirtHeight: number
}

export interface AvatarPartGeometries {
    upper: THREE.BufferGeometry
    skirt: THREE.BufferGeometry
    skirtBack: THREE.BufferGeometry
    armL: THREE.BufferGeometry
    armR: THREE.BufferGeometry
    legL: THREE.BufferGeometry
    legR: THREE.BufferGeometry
    skirtHeight: number
}

export function createPartLists(palette: AvatarPalette): AvatarPartLists {
    const skirts = buildSkirts(palette)
    return {
        upper: buildUpper(palette),
        skirt: skirts.frontParts,
        skirtBack: skirts.backParts,
        armL: buildArm(palette, 1),
        armR: buildArm(palette, -1),
        legL: buildLeg(palette),
        legR: buildLeg(palette),
        skirtHeight: skirts.height
    }
}

/** Dựng các geometry rigid đã gộp. Người gọi sở hữu và phải dispose. */
export function buildPartGeometries(palette: AvatarPalette): AvatarPartGeometries {
    const l = createPartLists(palette)
    return {
        upper: LowPolyBuilder.mergeColored(l.upper),
        skirt: LowPolyBuilder.mergeColored(l.skirt),
        skirtBack: LowPolyBuilder.mergeColored(l.skirtBack),
        armL: LowPolyBuilder.mergeColored(l.armL),
        armR: LowPolyBuilder.mergeColored(l.armR),
        legL: LowPolyBuilder.mergeColored(l.legL),
        legR: LowPolyBuilder.mergeColored(l.legR),
        skirtHeight: l.skirtHeight
    }
}

const partCache = new Map<string, AvatarPartGeometries>()

/** Geometry dùng chung theo quốc gia và giới tính (KHÔNG dispose từ model). */
export function getCachedPartGeometries(country: PilgrimCountry, gender: AvatarGender = 'female'): AvatarPartGeometries {
    const key = `${country}_${gender}`
    let g = partCache.get(key)
    if (!g) {
        const base = AVATAR_PALETTES[country] ?? AVATAR_PALETTES.vietnam
        g = buildPartGeometries({ ...base, gender })
        partCache.set(key, g)
    }
    return g
}

export function disposeAvatarGeometryCache() {
    partCache.forEach((g) => {
        g.upper.dispose()
        g.skirt.dispose()
        g.skirtBack.dispose()
        g.armL.dispose()
        g.armR.dispose()
        g.legL.dispose()
        g.legR.dispose()
    })
    partCache.clear()
}

export function disposePartGeometries(g: AvatarPartGeometries) {
    g.upper.dispose()
    g.skirt.dispose()
    g.skirtBack.dispose()
    g.armL.dispose()
    g.armR.dispose()
    g.legL.dispose()
    g.legR.dispose()
}

function offsetParts(list: ColoredPart[], offset: [number, number, number], rotZ = 0): ColoredPart[] {
    for (const p of list) {
        const t = p.transform ?? (p.transform = {})
        const pos = t.position ?? [0, 0, 0]
        if (rotZ !== 0) {
            const rot = t.rotation ?? [0, 0, 0]
            t.rotation = [rot[0], rot[1], rot[2] + rotZ]
        }
        t.position = [pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]]
    }
    return list
}

/** Mô hình tĩnh (tư thế đứng Chibi) gộp 1 mảnh – dùng cho LOD1 (InstancedMesh). */
export function buildLod1Geometry(palette: AvatarPalette): THREE.BufferGeometry {
    const l = createPartLists(palette)
    const all: ColoredPart[] = [
        ...offsetParts(l.upper, [0, D.hipY, 0]),
        ...offsetParts(l.skirt, [0, D.hipY, 0]),
        ...offsetParts(l.skirtBack, [0, D.hipY, 0]),
        ...offsetParts(l.armL, [D.shoulderX, D.hipY + D.shoulderY, 0], 0.28),
        ...offsetParts(l.armR, [-D.shoulderX, D.hipY + D.shoulderY, 0], -0.28),
        ...offsetParts(l.legL, [D.legX, D.hipY, 0]),
        ...offsetParts(l.legR, [-D.legX, D.hipY, 0])
    ]
    return LowPolyBuilder.mergeColored(all)
}

/** Hình đại diện Chibi rút gọn (~140 tam giác) – dùng cho LOD2 ở xa. */
export function buildLod2Geometry(palette: AvatarPalette): THREE.BufferGeometry {
    const cStyle = resolveCountryStyle(palette)
    const parts: ColoredPart[] = []

    // Quần + thân áo + đầu Chibi
    parts.push(makePart(cyl(0.20, 0.28, 0.52, 6), palette.innerColor, { x: 0, y: 0.30, z: 0, sz: 0.75 }))
    parts.push(makePart(cyl(0.18, 0.24, 0.62, 6), palette.robeColor, { x: 0, y: 0.88, z: 0, sz: 0.68 }))
    parts.push(makePart(sph(0.34, 8, 6), palette.skinColor, { x: 0, y: 1.50, z: 0, sx: 1.06, sy: 0.94, sz: 0.92 }))
    parts.push(makePart(sph(0.32, 6, 5), palette.hairColor, { x: 0, y: 1.48, z: -0.12 }))

    if (cStyle === 'vietnam' || cStyle === 'japan') {
        parts.push(makePart(cone(0.66, 0.50, 8), palette.hatColor, { x: 0, y: 1.86, z: -0.02 }))
    } else if (cStyle === 'korea') {
        parts.push(makePart(cyl(0.54, 0.54, 0.03, 8), palette.hatColor, { x: 0, y: 1.82, z: 0 }))
    } else if (cStyle === 'thailand') {
        parts.push(makePart(cone(0.18, 0.45, 6), palette.trimColor, { x: 0, y: 2.05, z: 0 }))
    }

    return LowPolyBuilder.mergeColored(parts)
}
