// controlHints.ts - Nguồn dữ liệu duy nhất cho mọi gợi ý phím/chuột trên HUD (Song ngữ VI / EN).
// Màn hình tải, bảng gợi ý khi lại gần, pill góc trái và bảng phím tắt đều đọc từ đây.

import { isEnglish, tr } from './copy'

export type HintSurface = 'loading' | 'pill' | 'cheat'

export interface ControlHint {
  id: string
  /** Các phím/nút tương đương nhau (hiển thị cạnh nhau, nối bằng `sep`). */
  readonly keys: string[]
  /** Từ nối giữa các phím, mặc định 'hoặc' / 'or'. */
  readonly sep?: string
  readonly label: string
  /** Bề mặt UI hiển thị gợi ý này. */
  surfaces: HintSurface[]
  /** Gợi ý dành cho nhà phát triển, mặc định ẩn. */
  dev?: boolean
}

interface RawHintDef {
  id: string
  keysVi: string[]
  keysEn?: string[]
  sepVi?: string
  sepEn?: string
  labelVi: string
  labelEn: string
  surfaces: HintSurface[]
  dev?: boolean
}

function makeHint(def: RawHintDef): ControlHint {
  return {
    id: def.id,
    get keys() {
      return isEnglish() ? (def.keysEn ?? def.keysVi) : def.keysVi
    },
    get sep() {
      return isEnglish() ? (def.sepEn ?? def.sepVi) : def.sepVi
    },
    get label() {
      return tr(def.labelVi, def.labelEn)
    },
    surfaces: def.surfaces,
    dev: def.dev
  }
}

export const CONTROL_HINTS: ControlHint[] = [
  makeHint({ id: 'alt', keysVi: ['ALT'], labelVi: 'Hiện con trỏ chuột', labelEn: 'Show mouse cursor', surfaces: ['cheat'] }),
  makeHint({ id: 'menus', keysVi: ['1, 2, 3'], labelVi: 'Mở 3 cụm menu', labelEn: 'Open 3 menu docks', surfaces: ['cheat'] }),
  makeHint({ id: 'move', keysVi: ['WASD'], labelVi: 'Di chuyển', labelEn: 'Move', surfaces: ['loading', 'pill', 'cheat'] }),
  makeHint({ id: 'look', keysVi: ['Chuột'], keysEn: ['Mouse'], labelVi: 'Xoay góc nhìn', labelEn: 'Look around', surfaces: ['loading'] }),
  makeHint({ id: 'interact', keysVi: ['Chuột phải', 'E'], keysEn: ['Right-click', 'E'], sepVi: 'hoặc', sepEn: 'or', labelVi: 'Tương tác', labelEn: 'Interact', surfaces: ['loading', 'pill', 'cheat'] }),
  makeHint({ id: 'jump', keysVi: ['Space'], labelVi: 'Nhảy', labelEn: 'Jump', surfaces: ['loading', 'cheat'] }),
  makeHint({ id: 'run', keysVi: ['Shift'], labelVi: 'Chạy nhanh', labelEn: 'Sprint', surfaces: ['cheat'] }),
  makeHint({ id: 'walk', keysVi: ['Z'], labelVi: 'Đi chậm', labelEn: 'Slow walk', surfaces: ['cheat'] }),
  makeHint({ id: 'camera', keysVi: ['V', 'F5'], sepVi: 'hoặc', sepEn: 'or', labelVi: 'Đổi góc nhìn', labelEn: 'Switch camera', surfaces: ['loading', 'cheat'] }),
  makeHint({ id: 'bow', keysVi: ['B'], labelVi: 'Chắp tay chào', labelEn: 'Bow greeting', surfaces: ['cheat'] }),
  makeHint({ id: 'map', keysVi: ['M'], labelVi: 'Bản đồ chùa', labelEn: 'Sanctuary map', surfaces: ['pill', 'cheat'] }),
  makeHint({ id: 'meditate', keysVi: ['T'], labelVi: 'Tọa thiền', labelEn: 'Meditate', surfaces: ['cheat'] }),
  makeHint({ id: 'chat', keysVi: ['C'], labelVi: 'Pháp đàm', labelEn: 'Dharma chat', surfaces: ['cheat'] }),
  makeHint({ id: 'graphics', keysVi: ['F4'], labelVi: 'Đồ họa', labelEn: 'Graphics', surfaces: ['loading', 'cheat'] }),
  makeHint({ id: 'dev-perf', keysVi: ['F2'], labelVi: 'Bảng hiệu năng', labelEn: 'Performance HUD', surfaces: ['cheat'], dev: true }),
  makeHint({ id: 'dev-collider', keysVi: ['F3'], labelVi: 'Khung va chạm', labelEn: 'Collision wireframes', surfaces: ['cheat'], dev: true })
]

/** Gợi ý người chơi thường (không gồm nhóm nhà phát triển) theo bề mặt hiển thị. */
export function hintsFor(surface: HintSurface): ControlHint[] {
  return CONTROL_HINTS.filter((h) => !h.dev && h.surfaces.includes(surface))
}

/** Nhóm phím dành cho nhà phát triển (F2/F3), chỉ hiện khi mở rộng trong bảng phím tắt. */
export const DEV_HINTS: ControlHint[] = CONTROL_HINTS.filter((h) => h.dev)

/** Gợi ý tương tác dùng cho bảng "lại gần mục tiêu". */
export const INTERACT_HINT: ControlHint = CONTROL_HINTS.find((h) => h.id === 'interact')!
