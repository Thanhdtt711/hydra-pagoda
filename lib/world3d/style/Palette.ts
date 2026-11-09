/**
 * Palette:
 * Nguồn sự thật duy nhất cho màu sắc + ánh sáng phong cách Low-poly Minimalist
 * (Monument Valley / Journey). Mỗi thời điểm trong ngày có bảng màu phẳng riêng.
 *
 * Quy ước: màu viết dạng hex sRGB (0xRRGGBB). THREE.Color.setHex tự chuyển sang linear.
 */

export type TimeOfDayMode = 'day' | 'sunset' | 'night'

/** Các "slot" màu dùng chung cho mọi vật liệu phẳng. */
export type PaletteSlot =
    | 'ground' // sân gạch / đá lát
    | 'grass' // cỏ, đồi
    | 'grassDark' // cỏ tối / chân đồi
    | 'roof' // ngói
    | 'roofDark' // viền mái, góc mái
    | 'wood' // cột, cửa gỗ
    | 'woodDark' // xà, bệ gỗ
    | 'wall' // tường vàng nhạt / vôi
    | 'stone' // đá xám, bậc thềm
    | 'gold' // vàng kim (tượng, nóc, chuông)
    | 'water' // hồ sen
    | 'lotus' // hoa sen
    | 'leaf' // lá sen / tán mặc định
    | 'trunk' // thân cây
    | 'mountainNear' // núi gần
    | 'mountainMid' // núi giữa
    | 'mountainFar' // núi xa
    | 'lantern' // đèn lồng (phát sáng)
    | 'skin' // da người
    | 'hair' // tóc
    | 'cloth' // vải trắng/kem (áo lót)

export interface TimePalette {
    sky: { top: number; bottom: number; horizon: number }
    fog: { color: number; near: number; far: number }
    slots: Record<PaletteSlot, number>
    sun: { elevation: number; azimuth: number; color: number; intensity: number; disk: number }
    hemi: { skyColor: number; groundColor: number; intensity: number }
    rim: { color: number; intensity: number }
    exposure: { outdoor: number; indoor: number }
    /** Đèn lồng / nến: cường độ phát sáng + ánh sáng điểm. */
    lanterns: { emissiveIntensity: number; pointLightIntensity: number }
    /** Độ lộ của sao trên vòm trời (0..1). */
    stars: number
    /** Có bật bóng đổ mềm không (đêm giảm). */
    shadowStrength: number
}

export const PALETTES: Record<TimeOfDayMode, TimePalette> = {
    day: {
        sky: { top: 0x8ec5d6, bottom: 0xf4e9d0, horizon: 0xdce8e0 },
        fog: { color: 0xdce8e0, near: 60, far: 260 },
        slots: {
            ground: 0xe8dcc0,
            grass: 0x9cc48a,
            grassDark: 0x7fae78,
            roof: 0xb5543c,
            roofDark: 0x8f3f2f,
            wood: 0x8a4b35,
            woodDark: 0x6a3828,
            wall: 0xf1e4c6,
            stone: 0xb9b3a6,
            gold: 0xf2c14e,
            water: 0x7fc6c4,
            lotus: 0xf4a7b9,
            leaf: 0x6fae6a,
            trunk: 0x7a5a42,
            mountainNear: 0x8fb59a,
            mountainMid: 0xa9c8b4,
            mountainFar: 0xc6dccb,
            lantern: 0xe8643a,
            skin: 0xe8b88f,
            hair: 0x2d2430,
            cloth: 0xf5efe0
        },
        sun: { elevation: 52, azimuth: 42, color: 0xfff4de, intensity: 1.6, disk: 0xfff6dc },
        hemi: { skyColor: 0xcfe7f2, groundColor: 0xb7c6a0, intensity: 1.9 },
        rim: { color: 0xa9d0e0, intensity: 0.35 },
        exposure: { outdoor: 1.0, indoor: 1.1 },
        lanterns: { emissiveIntensity: 0.0, pointLightIntensity: 0.0 },
        stars: 0,
        shadowStrength: 1.0
    },
    sunset: {
        sky: { top: 0x6b4e8f, bottom: 0xf2a66b, horizon: 0xe9b28c },
        fog: { color: 0xe9b28c, near: 50, far: 220 },
        slots: {
            ground: 0xd9b592,
            grass: 0xa89a6a,
            grassDark: 0x8a7e5a,
            roof: 0xa24b42,
            roofDark: 0x7e3a38,
            wood: 0x7c4535,
            woodDark: 0x5e3428,
            wall: 0xe8c9a0,
            stone: 0xa89c92,
            gold: 0xffb347,
            water: 0xe59a7a,
            lotus: 0xf09aa8,
            leaf: 0x8a9a5a,
            trunk: 0x6e4c3c,
            mountainNear: 0x8a6a8a,
            mountainMid: 0xa9809a,
            mountainFar: 0xcf9aa0,
            lantern: 0xff7a3a,
            skin: 0xe2a882,
            hair: 0x2a2028,
            cloth: 0xf0dcc0
        },
        sun: { elevation: 9, azimuth: 58, color: 0xffa760, intensity: 2.2, disk: 0xffd9a0 },
        hemi: { skyColor: 0xe9a98a, groundColor: 0x8a6a6a, intensity: 2.0 },
        rim: { color: 0xff9a60, intensity: 0.5 },
        exposure: { outdoor: 1.0, indoor: 1.1 },
        lanterns: { emissiveIntensity: 0.8, pointLightIntensity: 3.0 },
        stars: 0.0,
        shadowStrength: 0.85
    },
    night: {
        sky: { top: 0x14172b, bottom: 0x2b2f55, horizon: 0x232846 },
        fog: { color: 0x232846, near: 40, far: 240 },
        slots: {
            ground: 0x3a3a55,
            grass: 0x2e4a47,
            grassDark: 0x243a3c,
            roof: 0x4a3a52,
            roofDark: 0x382c40,
            wood: 0x3a2c3a,
            woodDark: 0x2a2030,
            wall: 0x5a5470,
            stone: 0x4a4a62,
            gold: 0xffd27a,
            water: 0x2a3f6b,
            lotus: 0x9a7ab0,
            leaf: 0x2f5a52,
            trunk: 0x3a3040,
            mountainNear: 0x2a3250,
            mountainMid: 0x303a5c,
            mountainFar: 0x3a4468,
            lantern: 0xffb45a,
            skin: 0x8f7a8a,
            hair: 0x14101a,
            cloth: 0x8f8aa8
        },
        sun: { elevation: 52, azimuth: 210, color: 0xaecaff, intensity: 1.1, disk: 0xf4f1e0 },
        hemi: { skyColor: 0x4d5f9a, groundColor: 0x2c3150, intensity: 1.8 },
        rim: { color: 0x6d8be0, intensity: 0.4 },
        exposure: { outdoor: 1.0, indoor: 1.15 },
        lanterns: { emissiveIntensity: 2.2, pointLightIntensity: 5.0 },
        stars: 1.0,
        shadowStrength: 0.55
    }
}

/** Cấu hình hậu kỳ nhẹ cho phong cách minimal. */
export const POST_STYLE = {
    // Bloom chỉ dành cho nguồn sáng (đèn lồng, nến, hoa đăng): ngưỡng cao.
    bloom: { threshold: 1.0, strength: 0.28, radius: 0.35 },
    // Vignette nhẹ tạo không khí.
    vignette: { darkness: 0.32, offset: 1.05 }
} as const

export class Palette {
    public static get(mode: TimeOfDayMode): TimePalette {
        return PALETTES[mode] ?? PALETTES.day
    }

    public static slot(mode: TimeOfDayMode, slot: PaletteSlot): number {
        return Palette.get(mode).slots[slot]
    }
}
