/**
 * Thưởng MC khi thắng cờ dưới Bóng Bồ Đề. Thuần hằng số và hàm, dùng chung cho server và client.
 *
 * - Có 5 môn: Cờ Tướng, Ô Ăn Quan, Cờ Caro, Cờ Vua, Cờ Vây.
 * - Mỗi môn, ván THẮNG ĐẦU TIÊN trong ngày được +10 MC. Những ván thắng sau của cùng môn trong ngày không có thêm gì.
 * - Thắng đủ cả 5 môn trong ngày: nhận thêm +10 MC, tổng cả ngày là 60 MC.
 * - Ngày tính theo giờ Việt Nam. Tối đa 60 MC mỗi tài khoản mỗi ngày.
 */
export const BOARD_GAME_IDS = ['xiangqi', 'chess', 'caro', 'go', 'oanquan'] as const
export type BoardGameId = (typeof BOARD_GAME_IDS)[number]

export const BOARD_GAME_REWARD_PER_GAME = 10
export const BOARD_GAME_ALL_CLEAR_BONUS = 10
export const BOARD_GAME_MAX_DAILY_MC = BOARD_GAME_REWARD_PER_GAME * BOARD_GAME_IDS.length + BOARD_GAME_ALL_CLEAR_BONUS // 60

/** Thời gian chơi tối thiểu (giây) từ lúc bắt đầu ván đến lúc thắng, chống gửi kết quả giả. */
export const BOARD_GAME_MIN_SECONDS: Record<BoardGameId, number> = {
  xiangqi: 20,
  oanquan: 15,
  caro: 10,
  chess: 20,
  go: 20
}

export const BOARD_GAME_LABELS: Record<BoardGameId, { vi: string; en: string }> = {
  xiangqi: { vi: 'Cờ Tướng', en: 'Xiangqi' },
  oanquan: { vi: 'Ô Ăn Quan', en: 'O An Quan' },
  caro: { vi: 'Cờ Caro', en: 'Caro' },
  chess: { vi: 'Cờ Vua', en: 'Chess' },
  go: { vi: 'Cờ Vây', en: 'Go' }
}

export function isBoardGameId(value: unknown): value is BoardGameId {
  return typeof value === 'string' && (BOARD_GAME_IDS as readonly string[]).includes(value)
}
