// controlHints.ts - Nguồn dữ liệu duy nhất cho mọi gợi ý phím/chuột trên HUD.
// Màn hình tải, bảng gợi ý khi lại gần, pill góc trái và bảng phím tắt đều đọc từ đây
// để tránh lệch nội dung khi đổi phím.

export type HintSurface = 'loading' | 'pill' | 'cheat'

export interface ControlHint {
  id: string
  /** Các phím/nút tương đương nhau (hiển thị cạnh nhau, nối bằng `sep`). */
  keys: string[]
  /** Từ nối giữa các phím, mặc định 'hoặc'. */
  sep?: string
  label: string
  /** Bề mặt UI hiển thị gợi ý này. */
  surfaces: HintSurface[]
  /** Gợi ý dành cho nhà phát triển, mặc định ẩn. */
  dev?: boolean
}

export const CONTROL_HINTS: ControlHint[] = [
  { id: 'alt', keys: ['ALT'], label: 'Hiện con trỏ chuột', surfaces: ['cheat'] },
  { id: 'menus', keys: ['1, 2, 3'], label: 'Mở 3 cụm menu', surfaces: ['cheat'] },
  { id: 'move', keys: ['WASD'], label: 'Di chuyển', surfaces: ['loading', 'pill', 'cheat'] },
  { id: 'look', keys: ['Chuột'], label: 'Xoay góc nhìn', surfaces: ['loading'] },
  { id: 'interact', keys: ['Chuột phải', 'E'], sep: 'hoặc', label: 'Tương tác', surfaces: ['loading', 'pill', 'cheat'] },
  { id: 'jump', keys: ['Space'], label: 'Nhảy', surfaces: ['loading', 'cheat'] },
  { id: 'run', keys: ['Shift'], label: 'Chạy nhanh', surfaces: ['cheat'] },
  { id: 'walk', keys: ['Z'], label: 'Đi chậm', surfaces: ['cheat'] },
  { id: 'camera', keys: ['V', 'F5'], sep: 'hoặc', label: 'Đổi góc nhìn', surfaces: ['loading', 'cheat'] },
  { id: 'bow', keys: ['B'], label: 'Chắp tay chào', surfaces: ['cheat'] },
  { id: 'map', keys: ['M'], label: 'Bản đồ chùa', surfaces: ['pill', 'cheat'] },
  { id: 'meditate', keys: ['T'], label: 'Tọa thiền', surfaces: ['cheat'] },
  { id: 'chat', keys: ['C'], label: 'Pháp đàm', surfaces: ['cheat'] },
  { id: 'graphics', keys: ['F4'], label: 'Đồ họa', surfaces: ['loading', 'cheat'] },
  { id: 'dev-perf', keys: ['F2'], label: 'Bảng hiệu năng', surfaces: ['cheat'], dev: true },
  { id: 'dev-collider', keys: ['F3'], label: 'Khung va chạm', surfaces: ['cheat'], dev: true }
]

/** Gợi ý người chơi thường (không gồm nhóm nhà phát triển) theo bề mặt hiển thị. */
export function hintsFor(surface: HintSurface): ControlHint[] {
  return CONTROL_HINTS.filter((h) => !h.dev && h.surfaces.includes(surface))
}

/** Nhóm phím dành cho nhà phát triển (F2/F3), chỉ hiện khi mở rộng trong bảng phím tắt. */
export const DEV_HINTS: ControlHint[] = CONTROL_HINTS.filter((h) => h.dev)

/** Gợi ý tương tác dùng cho bảng "lại gần mục tiêu". */
export const INTERACT_HINT: ControlHint = CONTROL_HINTS.find((h) => h.id === 'interact')!
