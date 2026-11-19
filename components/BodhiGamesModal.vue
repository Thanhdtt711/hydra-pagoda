<template>
  <UiModal
    v-if="open"
    :title="tr('Kỳ Đài Dưới Bóng Bồ Đề', 'Bodhi Tree Board Games')"
    :subtitle="tr('Đấu trí thư giãn cùng Sư Thầy & Tiểu Đồng', 'Mindful strategy under the sacred Bodhi canopy')"
    max-width="xl"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <UiTabs
        :model-value="activeTab"
        :tabs="gameTabs"
        aria-label="Chọn trò chơi dưới bóng Bồ Đề"
        @update:model-value="(val) => onRequestTabChange(val as BoardGameId)"
      />

      <!-- Thông báo nhanh cho môn đang mở -->
      <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-2 space-y-1.5">
        <div
          v-if="tabLockWarning"
          class="bg-[#26221d] border border-[#f6465d]/70 rounded-[2px] px-2.5 py-1.5 flex items-center justify-between gap-2"
        >
          <span class="text-xs font-semibold text-[#f6465d] leading-snug">{{ tabLockWarning }}</span>
          <UiButton variant="secondary" size="sm" @click="endCurrentGame">
            {{ tr('Kết thúc ván', 'End Match') }}
          </UiButton>
        </div>
        <div
          v-if="winMessage"
          class="bg-[#26221d] border border-[#0ecb81]/60 rounded-[2px] px-2.5 py-1.5 text-xs font-bold text-[#0ecb81] leading-snug"
        >
          {{ winMessage }}
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-[#f0e6d2] leading-relaxed">{{ rewardHint }}</span>
          <div class="flex items-center gap-2 shrink-0">
            <UiButton
              v-if="isCurrentGameInProgress"
              variant="secondary"
              size="sm"
              @click="endCurrentGame"
            >
              {{ tr('Kết thúc ván', 'End Match') }}
            </UiButton>
            <span class="text-xs font-bold font-numbers text-[#0ecb81]">
              {{ boardGames.mergedEarnedMc }} / {{ BOARD_GAME_MAX_DAILY_MC }} MC
            </span>
          </div>
        </div>
      </div>

      <!-- ===================================================== -->
      <!-- TAB 1: CỜ TƯỚNG (XIANGQI) - HIỆN LÊN TRƯỚC            -->
      <!-- ===================================================== -->
      <div v-if="activeTab === 'xiangqi'" class="space-y-3">
        <div class="bg-[#26221d] border border-[#332d26] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <UiBadge :variant="xqWinner ? (xqWinner === 'red' ? 'success' : 'danger') : (xqTurn === 'red' ? 'gold' : 'neutral')">
              {{ xqBadgeText }}
            </UiBadge>
            <span class="text-xs text-[#f0e6d2] truncate">{{ xqStatusText }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="xqHistory.length === 0 || xqThinking"
              @click="undoXiangqi"
            >
              {{ tr('Đi lại', 'Undo') }}
            </UiButton>
            <UiButton variant="secondary" size="sm" @click="resetXiangqi">
              {{ tr('Ván mới', 'New') }}
            </UiButton>
          </div>
        </div>

        <div class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div class="relative w-full max-w-[380px] aspect-[9/10] bg-[#241c14] border-2 border-[#c9a24b] rounded-[2px] p-1.5">
            <svg viewBox="0 0 800 900" class="w-full h-full pointer-events-none">
              <line
                v-for="r in 10"
                :key="`hr-${r}`"
                x1="40"
                :y1="40 + (r - 1) * 90"
                x2="760"
                :y2="40 + (r - 1) * 90"
                stroke="#8b7346"
                stroke-width="2"
              />
              <line
                v-for="c in 9"
                :key="`vt-${c}`"
                :x1="40 + (c - 1) * 90"
                y1="40"
                :x2="40 + (c - 1) * 90"
                y2="400"
                stroke="#8b7346"
                stroke-width="2"
              />
              <line
                v-for="c in 9"
                :key="`vb-${c}`"
                :x1="40 + (c - 1) * 90"
                y1="490"
                :x2="40 + (c - 1) * 90"
                y2="850"
                stroke="#8b7346"
                stroke-width="2"
              />
              <line x1="40" y1="400" x2="40" y2="490" stroke="#8b7346" stroke-width="2" />
              <line x1="760" y1="400" x2="760" y2="490" stroke="#8b7346" stroke-width="2" />
              <line x1="310" y1="40" x2="490" y2="220" stroke="#8b7346" stroke-width="2" />
              <line x1="490" y1="40" x2="310" y2="220" stroke="#8b7346" stroke-width="2" />
              <line x1="310" y1="670" x2="490" y2="850" stroke="#8b7346" stroke-width="2" />
              <line x1="490" y1="670" x2="310" y2="850" stroke="#8b7346" stroke-width="2" />
              <text x="230" y="454" text-anchor="middle" fill="#c9a24b" font-size="26" font-weight="600">楚 河</text>
              <text x="570" y="454" text-anchor="middle" fill="#c9a24b" font-size="26" font-weight="600">漢 界</text>
            </svg>

            <div class="absolute inset-1.5 grid grid-cols-9 grid-rows-10">
              <template v-for="r in 10" :key="`row-${r - 1}`">
                <button
                  v-for="c in 9"
                  :key="`cell-${r - 1}-${c - 1}`"
                  type="button"
                  class="relative flex items-center justify-center cursor-pointer focus:outline-none"
                  @click="onXiangqiCellClick(r - 1, c - 1)"
                >
                  <span
                    v-if="isLastMoveCell(r - 1, c - 1)"
                    class="absolute inset-0.5 rounded-[2px] border border-[#c9a24b]/60 bg-[#c9a24b]/10 pointer-events-none"
                  ></span>
                  <span
                    v-if="isLegalTarget(r - 1, c - 1) && !xqBoard[r - 1]![c - 1]"
                    class="w-2.5 h-2.5 rounded-full bg-[#0ecb81] opacity-85 pointer-events-none"
                  ></span>
                  <span
                    v-if="isLegalTarget(r - 1, c - 1) && xqBoard[r - 1]![c - 1]"
                    class="absolute inset-0.5 rounded-full border-2 border-[#f6465d] pointer-events-none"
                  ></span>
                  <span
                    v-if="xqBoard[r - 1]![c - 1]"
                    class="w-[82%] h-[82%] rounded-full border-2 flex items-center justify-center text-sm font-bold transition-transform"
                    :class="[
                      xqBoard[r - 1]![c - 1]!.side === 'red'
                        ? 'bg-[#f6ecd8] text-[#b8372b] border-[#b8372b]'
                        : 'bg-[#1a1714] text-[#f0e6d2] border-[#c9a24b]',
                      xqSelected?.r === r - 1 && xqSelected?.c === c - 1
                        ? 'ring-2 ring-[#0ecb81] scale-110'
                        : ''
                    ]"
                    :title="getPieceViName(xqBoard[r - 1]![c - 1]!)"
                  >
                    {{ getPieceChar(xqBoard[r - 1]![c - 1]!) }}
                  </span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================== -->
      <!-- TAB 2: Ô ĂN QUAN                                      -->
      <!-- ===================================================== -->
      <div v-else-if="activeTab === 'oanquan'" class="space-y-3">
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-2.5 flex items-center justify-between">
            <div>
              <div class="text-xs text-[#9c9283]">{{ tr('Tiểu Đồng', 'Novice') }}</div>
              <div class="text-lg font-bold font-numbers text-[#f0e6d2]">{{ oaqState.aiScore }}</div>
            </div>
            <UiBadge v-if="oaqState.turn === 'ai' && !oaqState.gameOver" variant="gold">
              {{ tr('Đang đi', 'Turn') }}
            </UiBadge>
          </div>

          <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-2.5 flex flex-col items-center justify-center text-center">
            <div class="text-xs text-[#9c9283]">{{ tr('Trên tay', 'In Hand') }}</div>
            <div class="text-lg font-bold font-numbers text-[#c9a24b]">{{ oaqHandCount }}</div>
          </div>

          <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-2.5 flex items-center justify-between">
            <div>
              <div class="text-xs text-[#9c9283]">{{ tr('Đạo Hữu', 'You') }}</div>
              <div class="text-lg font-bold font-numbers text-[#0ecb81]">{{ oaqState.playerScore }}</div>
            </div>
            <UiBadge v-if="oaqState.turn === 'player' && !oaqState.gameOver" variant="success">
              {{ tr('Lượt bạn', 'Yours') }}
            </UiBadge>
          </div>
        </div>

        <div class="bg-[#26221d] border border-[#332d26] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2">
          <span class="text-xs text-[#f0e6d2]">{{ oaqStatusText }}</span>
          <UiButton variant="secondary" size="sm" @click="resetOAnQuan">
            {{ tr('Ván mới', 'New') }}
          </UiButton>
        </div>

        <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div class="grid grid-cols-7 gap-1.5 items-stretch">
            <div
              class="row-span-2 rounded-l-full border flex flex-col items-center justify-center p-1.5 transition-colors"
              :class="oaqCellClass(0)"
            >
              <span class="text-xs text-[#9c9283] mb-1">Quan</span>
              <div class="flex flex-wrap items-center justify-center gap-0.5 max-w-[40px]">
                <span
                  v-if="oaqState.cells[0]!.quan > 0"
                  class="w-3.5 h-3.5 rounded-full bg-[#c9a24b] border border-[#f6ecd8]"
                ></span>
                <span
                  v-for="s in Math.min(oaqState.cells[0]!.small, 10)"
                  :key="`q0-${s}`"
                  class="w-1.5 h-1.5 rounded-full bg-[#d9cdb8]"
                ></span>
              </div>
              <span class="text-xs font-bold font-numbers text-[#c9a24b] mt-1">
                {{ oaqState.cells[0]!.small + oaqState.cells[0]!.quan * 10 }}
              </span>
            </div>

            <div
              v-for="idx in AI_CELLS"
              :key="`ai-${idx}`"
              class="h-20 rounded-[2px] border flex flex-col items-center justify-between p-1 transition-colors"
              :class="oaqCellClass(idx)"
            >
              <span class="text-xs text-[#7d7467] font-numbers">{{ idx }}</span>
              <div class="flex flex-wrap items-center justify-center gap-0.5 max-w-[42px]">
                <span
                  v-for="s in Math.min(oaqState.cells[idx]!.small, 8)"
                  :key="`c${idx}-${s}`"
                  class="w-1.5 h-1.5 rounded-full bg-[#d9cdb8]"
                ></span>
              </div>
              <span class="text-xs font-bold font-numbers text-[#f0e6d2]">{{ oaqState.cells[idx]!.small }}</span>
            </div>

            <div
              class="row-span-2 rounded-r-full border flex flex-col items-center justify-center p-1.5 transition-colors"
              :class="oaqCellClass(6)"
            >
              <span class="text-xs text-[#9c9283] mb-1">Quan</span>
              <div class="flex flex-wrap items-center justify-center gap-0.5 max-w-[40px]">
                <span
                  v-if="oaqState.cells[6]!.quan > 0"
                  class="w-3.5 h-3.5 rounded-full bg-[#c9a24b] border border-[#f6ecd8]"
                ></span>
                <span
                  v-for="s in Math.min(oaqState.cells[6]!.small, 10)"
                  :key="`q6-${s}`"
                  class="w-1.5 h-1.5 rounded-full bg-[#d9cdb8]"
                ></span>
              </div>
              <span class="text-xs font-bold font-numbers text-[#c9a24b] mt-1">
                {{ oaqState.cells[6]!.small + oaqState.cells[6]!.quan * 10 }}
              </span>
            </div>

            <button
              v-for="idx in PLAYER_CELLS"
              :key="`pl-${idx}`"
              type="button"
              :disabled="!canSelectOaqCell(idx)"
              class="h-20 rounded-[2px] border flex flex-col items-center justify-between p-1 transition-colors cursor-pointer disabled:cursor-not-allowed"
              :class="oaqCellClass(idx, true)"
              @click="selectOaqCell(idx)"
            >
              <span class="text-xs text-[#9c9283] font-numbers">{{ idx }}</span>
              <div class="flex flex-wrap items-center justify-center gap-0.5 max-w-[42px]">
                <span
                  v-for="s in Math.min(oaqState.cells[idx]!.small, 8)"
                  :key="`p${idx}-${s}`"
                  class="w-1.5 h-1.5 rounded-full bg-[#c9a24b]"
                ></span>
              </div>
              <span class="text-xs font-bold font-numbers text-[#f0e6d2]">{{ oaqState.cells[idx]!.small }}</span>
            </button>
          </div>
        </div>

        <div
          v-if="oaqSelectedCell !== null && oaqState.turn === 'player' && !oaqAnimating && !oaqState.gameOver"
          class="bg-[#1a1714] border border-[#c9a24b] rounded-[2px] p-2.5 flex items-center justify-between gap-2"
        >
          <span class="text-xs text-[#f0e6d2]">
            {{ tr(`Rải ô số ${oaqSelectedCell}:`, `Sow cell ${oaqSelectedCell}:`) }}
          </span>
          <div class="flex items-center gap-2">
            <UiButton variant="secondary" size="sm" @click="playOAnQuanMove(oaqSelectedCell, 1)">
              <ZenIcon name="chevron-left" :size="14" />
              {{ tr('Trái', 'Left') }}
            </UiButton>
            <UiButton variant="primary" size="sm" @click="playOAnQuanMove(oaqSelectedCell, -1)">
              {{ tr('Phải', 'Right') }}
              <ZenIcon name="chevron-right" :size="14" />
            </UiButton>
          </div>
        </div>
      </div>

      <!-- ===================================================== -->
      <!-- TAB 3: CỜ CARO (15x15)                                -->
      <!-- ===================================================== -->
      <div v-else-if="activeTab === 'caro'" class="space-y-3">
        <div class="bg-[#26221d] border border-[#332d26] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <UiBadge :variant="caroWinner === 'X' ? 'success' : caroWinner === 'O' ? 'danger' : 'gold'">
              {{ caroBadgeText }}
            </UiBadge>
            <span class="text-xs text-[#f0e6d2] truncate">{{ caroStatusText }}</span>
          </div>
          <UiButton variant="secondary" size="sm" @click="resetCaro">
            {{ tr('Ván mới', 'New') }}
          </UiButton>
        </div>

        <div class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div
            class="w-full max-w-[375px] aspect-square grid bg-[#241c14] border border-[#c9a24b]"
            style="grid-template-columns: repeat(15, minmax(0, 1fr)); grid-template-rows: repeat(15, minmax(0, 1fr));"
          >
            <template v-for="r in CARO_SIZE" :key="`cr-${r - 1}`">
              <button
                v-for="c in CARO_SIZE"
                :key="`cc-${r - 1}-${c - 1}`"
                type="button"
                class="border border-[#3a3022] flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-[#2e241a] transition-colors"
                :class="[
                  isCaroWinCell(r - 1, c - 1) ? 'bg-[#2a3b26]' : '',
                  caroLastMove?.r === r - 1 && caroLastMove?.c === c - 1 ? 'ring-1 ring-inset ring-[#c9a24b]' : ''
                ]"
                @click="onCaroClick(r - 1, c - 1)"
              >
                <span v-if="caroBoard[r - 1]![c - 1] === 'X'" class="text-[#b8372b] font-bold">X</span>
                <span v-else-if="caroBoard[r - 1]![c - 1] === 'O'" class="text-[#c9a24b] font-bold">O</span>
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- ===================================================== -->
      <!-- TAB 4: CỜ VUA (CHESS 8x8)                             -->
      <!-- ===================================================== -->
      <div v-else-if="activeTab === 'chess'" class="space-y-3">
        <div class="bg-[#26221d] border border-[#332d26] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <UiBadge :variant="chessWinner ? (chessWinner === 'w' ? 'success' : chessWinner === 'b' ? 'danger' : 'neutral') : (chessState.turn === 'w' ? 'gold' : 'neutral')">
              {{ chessBadgeText }}
            </UiBadge>
            <span class="text-xs text-[#f0e6d2] truncate">{{ chessStatusText }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <UiButton variant="secondary" size="sm" :disabled="chessHistory.length === 0 || chessThinking" @click="undoChess">
              {{ tr('Đi lại', 'Undo') }}
            </UiButton>
            <UiButton variant="secondary" size="sm" @click="resetChess">
              {{ tr('Ván mới', 'New') }}
            </UiButton>
          </div>
        </div>

        <div class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div class="w-full max-w-[368px] aspect-square grid grid-cols-8 grid-rows-8 border-2 border-[#c9a24b]">
            <template v-for="r in 8" :key="`chr-${r - 1}`">
              <button
                v-for="c in 8"
                :key="`chc-${r - 1}-${c - 1}`"
                type="button"
                class="relative flex items-center justify-center text-2xl cursor-pointer focus:outline-none"
                :class="[
                  (r + c) % 2 === 0 ? 'bg-[#3d3326]' : 'bg-[#211b14]',
                  chessSelected?.r === r - 1 && chessSelected?.c === c - 1 ? 'ring-2 ring-inset ring-[#0ecb81]' : '',
                  isChessLastMove(r - 1, c - 1) ? 'bg-[#4f4229]/80' : ''
                ]"
                @click="onChessClick(r - 1, c - 1)"
              >
                <span
                  v-if="isChessLegalTarget(r - 1, c - 1) && !chessState.board[r - 1]![c - 1]"
                  class="w-3 h-3 rounded-full bg-[#0ecb81] opacity-80 pointer-events-none"
                ></span>
                <span
                  v-if="isChessLegalTarget(r - 1, c - 1) && chessState.board[r - 1]![c - 1]"
                  class="absolute inset-0.5 rounded-[2px] border-2 border-[#f6465d] pointer-events-none"
                ></span>
                <span
                  v-if="chessState.board[r - 1]![c - 1]"
                  :class="chessState.board[r - 1]![c - 1]!.side === 'w' ? 'text-[#f6ecd8]' : 'text-[#c9a24b]'"
                >
                  {{ getChessSymbol(chessState.board[r - 1]![c - 1]!) }}
                </span>
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- ===================================================== -->
      <!-- TAB 5: CỜ VÂY (GO 9x9)                                -->
      <!-- ===================================================== -->
      <div v-else class="space-y-3">
        <div class="bg-[#26221d] border border-[#332d26] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <UiBadge :variant="goState.gameOver ? 'success' : (goState.turn === 'B' ? 'gold' : 'neutral')">
              {{ goBadgeText }}
            </UiBadge>
            <span class="text-xs text-[#f0e6d2] truncate">{{ goStatusText }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <UiButton variant="secondary" size="sm" :disabled="goState.gameOver || goState.turn !== 'B'" @click="onGoPass">
              {{ tr('Bỏ lượt', 'Pass') }}
            </UiButton>
            <UiButton variant="secondary" size="sm" @click="resetGo">
              {{ tr('Ván mới', 'New') }}
            </UiButton>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-1.5 flex items-center justify-between">
            <span class="text-xs text-[#9c9283]">{{ tr('Đen bắt (Bạn)', 'Black Captures') }}</span>
            <span class="text-sm font-bold font-numbers text-[#0ecb81]">{{ goState.capturesB }}</span>
          </div>
          <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-1.5 flex items-center justify-between">
            <span class="text-xs text-[#9c9283]">{{ tr('Trắng bắt (Sư Thầy)', 'White Captures') }}</span>
            <span class="text-sm font-bold font-numbers text-[#f0e6d2]">{{ goState.capturesW }}</span>
          </div>
        </div>

        <div class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div class="relative w-full max-w-[360px] aspect-square bg-[#9e7d45] border-2 border-[#c9a24b] rounded-[2px] p-2">
            <!-- 9x9 Go Grid SVG -->
            <svg viewBox="0 0 800 800" class="w-full h-full pointer-events-none">
              <line
                v-for="i in 9"
                :key="`gh-${i}`"
                x1="40"
                :y1="40 + (i - 1) * 90"
                x2="760"
                :y2="40 + (i - 1) * 90"
                stroke="#2c2214"
                stroke-width="2.5"
              />
              <line
                v-for="i in 9"
                :key="`gv-${i}`"
                :x1="40 + (i - 1) * 90"
                y1="40"
                :x2="40 + (i - 1) * 90"
                y2="760"
                stroke="#2c2214"
                stroke-width="2.5"
              />
              <!-- Hoshi star points -->
              <circle cx="220" cy="220" r="6" fill="#2c2214" />
              <circle cx="580" cy="220" r="6" fill="#2c2214" />
              <circle cx="220" cy="580" r="6" fill="#2c2214" />
              <circle cx="580" cy="580" r="6" fill="#2c2214" />
              <circle cx="400" cy="400" r="6" fill="#2c2214" />
            </svg>

            <div class="absolute inset-2 grid grid-cols-9 grid-rows-9">
              <template v-for="r in GO_SIZE" :key="`gr-${r - 1}`">
                <button
                  v-for="c in GO_SIZE"
                  :key="`gc-${r - 1}-${c - 1}`"
                  type="button"
                  class="relative flex items-center justify-center cursor-pointer focus:outline-none"
                  @click="onGoCellClick(r - 1, c - 1)"
                >
                  <span
                    v-if="goState.board[r - 1]![c - 1]"
                    class="w-[82%] h-[82%] rounded-full border shadow-sm"
                    :class="[
                      goState.board[r - 1]![c - 1] === 'B'
                        ? 'bg-[#171513] border-[#3d3730]'
                        : 'bg-[#f5efe2] border-[#b5a992]',
                      goState.lastMove?.r === r - 1 && goState.lastMove?.c === c - 1
                        ? 'ring-2 ring-[#b8372b]'
                        : ''
                    ]"
                  ></span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================== -->
      <!-- BẢNG TIẾN ĐỘ CÁC GAME ĐÃ CHƠI & TIỀN NHẬN TRONG NGÀY -->
      <!-- ===================================================== -->
      <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-3.5 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h4 class="text-sm font-bold text-[#f0e6d2] m-0">
              {{ tr('Tiến Độ Chơi & Thưởng Hôm Nay', 'Daily Games & Rewards Progress') }}
            </h4>
            <p class="text-xs text-[#9c9283] mt-0.5 m-0">
              {{ rewardSummary }}
            </p>
          </div>
        </div>

        <!-- 3 ô thống kê: Đã chơi / Đã thắng / Tiền đã nhận -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] p-2">
            <div class="text-xs text-[#9c9283]">{{ tr('Môn đã chơi', 'Games Played') }}</div>
            <div class="text-sm font-bold font-numbers text-[#f0e6d2] mt-0.5">
              {{ boardGames.mergedPlayedGamesCount }} / {{ BOARD_GAME_IDS.length }}
            </div>
          </div>
          <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] p-2">
            <div class="text-xs text-[#9c9283]">{{ tr('Môn đã thắng', 'Games Won') }}</div>
            <div class="text-sm font-bold font-numbers text-[#c9a24b] mt-0.5">
              {{ boardGames.mergedWonCount }} / {{ BOARD_GAME_IDS.length }}
            </div>
          </div>
          <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] p-2">
            <div class="text-xs text-[#9c9283]">{{ tr('Đã nhận hôm nay', 'Earned Today') }}</div>
            <div class="text-sm font-bold font-numbers text-[#0ecb81] mt-0.5">
              +{{ boardGames.mergedEarnedMc }} / {{ BOARD_GAME_MAX_DAILY_MC }} MC
            </div>
          </div>
        </div>

        <!-- Thanh tiến độ MC trong ngày -->
        <div class="w-full h-2 bg-[#14110e] border border-[#332d26] rounded-[2px] overflow-hidden">
          <div
            class="h-full bg-[#0ecb81] transition-all duration-300"
            :style="{ width: `${Math.min(100, Math.round((boardGames.mergedEarnedMc / BOARD_GAME_MAX_DAILY_MC) * 100))}%` }"
          ></div>
        </div>

        <!-- Danh sách 5 môn cờ + trạng thái đã chơi / đã nhận tiền -->
        <div class="space-y-1.5">
          <button
            v-for="id in BOARD_GAME_IDS"
            :key="`prog-${id}`"
            type="button"
            class="w-full px-2.5 py-2 rounded-[2px] border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
            :class="[
              boardGames.hasWonToday(id)
                ? 'bg-[#26221d] border-[#0ecb81]/60'
                : activeTab === id
                  ? 'bg-[#26221d] border-[#c9a24b]'
                  : 'bg-[#14110e] border-[#332d26] hover:border-[#c9a24b]/60'
            ]"
            @click="onRequestTabChange(id)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <ZenIcon
                :name="boardGames.hasWonToday(id) ? 'circle-check' : boardGames.getPlayedCount(id) > 0 ? 'sparkles' : 'moon'"
                :size="16"
                class="shrink-0"
                :class="boardGames.hasWonToday(id) ? 'text-[#0ecb81]' : boardGames.getPlayedCount(id) > 0 ? 'text-[#c9a24b]' : 'text-[#9c9283]'"
              />
              <span class="text-xs font-semibold text-[#f0e6d2] truncate">{{ gameName(id) }}</span>
              <span class="text-xs text-[#9c9283] font-numbers shrink-0">
                {{
                  boardGames.getPlayedCount(id) > 0
                    ? tr(`(Đã chơi ${boardGames.getPlayedCount(id)} ván)`, `(${boardGames.getPlayedCount(id)} played)`)
                    : tr('(Chưa chơi)', '(Not played)')
                }}
              </span>
            </div>

            <span
              class="text-xs font-bold font-numbers shrink-0"
              :class="boardGames.hasWonToday(id) ? 'text-[#0ecb81]' : 'text-[#c9a24b]'"
            >
              {{
                boardGames.hasWonToday(id)
                  ? tr('Đã nhận +10 MC', 'Received +10 MC')
                  : tr('Thắng: +10 MC', 'Win: +10 MC')
              }}
            </span>
          </button>

          <!-- Dòng thứ 6: Thưởng hoàn thành cả 5 loại cờ -->
          <div
            class="w-full px-2.5 py-2 rounded-[2px] border flex items-center justify-between gap-2"
            :class="
              boardGames.mergedWonCount >= BOARD_GAME_IDS.length
                ? 'bg-[#26221d] border-[#0ecb81]/60'
                : 'bg-[#14110e] border-[#332d26]'
            "
          >
            <div class="flex items-center gap-2 min-w-0">
              <ZenIcon
                :name="boardGames.mergedWonCount >= BOARD_GAME_IDS.length ? 'circle-check' : 'sparkles'"
                :size="16"
                class="shrink-0"
                :class="boardGames.mergedWonCount >= BOARD_GAME_IDS.length ? 'text-[#0ecb81]' : 'text-[#c9a24b]'"
              />
              <span class="text-xs font-semibold text-[#f0e6d2] truncate">
                {{ tr('Thưởng thắng đủ cả 5 loại cờ', 'Win all 5 board games bonus') }}
              </span>
            </div>
            <span
              class="text-xs font-bold font-numbers shrink-0"
              :class="boardGames.mergedWonCount >= BOARD_GAME_IDS.length ? 'text-[#0ecb81]' : 'text-[#c9a24b]'"
            >
              {{
                boardGames.mergedWonCount >= BOARD_GAME_IDS.length
                  ? tr('Đã nhận +10 MC (Tổng 60 MC)', 'Received +10 MC (60 MC Total)')
                  : tr(`Còn ${BOARD_GAME_IDS.length - boardGames.mergedWonCount} môn (+10 MC)`, `${BOARD_GAME_IDS.length - boardGames.mergedWonCount} left (+10 MC)`)
              }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import UiModal from '~/components/ui/UiModal.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { tr } from '~/lib/ui/copy'
import { useBoardGamesStore } from '~/stores/boardGames'
import {
  BOARD_GAME_ALL_CLEAR_BONUS,
  BOARD_GAME_IDS,
  BOARD_GAME_LABELS,
  BOARD_GAME_MAX_DAILY_MC,
  BOARD_GAME_REWARD_PER_GAME,
  type BoardGameId
} from '~/lib/games/boardGameRewards'
import {
  AI_CELLS,
  PLAYER_CELLS,
  createOAnQuanState,
  executeOAnQuanMove,
  chooseBestOAnQuanMove,
  cloneOAnQuanState,
  type OAnQuanDir,
  type OAnQuanState
} from '~/lib/games/oAnQuan'
import {
  createInitialXiangqiBoard,
  cloneXiangqiBoard,
  getLegalMovesForPiece,
  getAllLegalMoves,
  applyXiangqiMove,
  isInCheck,
  chooseBestXiangqiMove,
  getPieceChar,
  getPieceViName,
  type XiangqiBoard,
  type XiangqiMove,
  type XiangqiPos,
  type XiangqiSide
} from '~/lib/games/xiangqi'
import {
  CARO_SIZE,
  createCaroBoard,
  cloneCaroBoard,
  checkCaroWinner,
  chooseBestCaroMove,
  type CaroBoard,
  type CaroPos
} from '~/lib/games/caro'
import {
  createInitialChessState,
  getLegalChessMovesForPiece,
  getAllLegalChessMoves,
  applyChessMove,
  isChessInCheck,
  chooseBestChessMove,
  getChessSymbol,
  type ChessMove,
  type ChessPos,
  type ChessSide,
  type ChessState
} from '~/lib/games/chess'
import {
  GO_SIZE,
  createGoState,
  tryPlayGoMove,
  passGoTurn,
  scoreGoArea,
  chooseBestGoMove,
  type GoState
} from '~/lib/games/go'

const props = withDefaults(defineProps<{
  open?: boolean
}>(), {
  open: true
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Cờ Tướng hiện lên trước theo yêu cầu
const activeTab = ref<'xiangqi' | 'oanquan' | 'caro' | 'chess' | 'go'>('xiangqi')
const gameTabs = computed(() => [
  { id: 'xiangqi', label: tr('Cờ Tướng', 'Xiangqi') },
  { id: 'oanquan', label: tr('Ô Ăn Quan', 'O An Quan') },
  { id: 'caro', label: tr('Cờ Caro', 'Caro') },
  { id: 'chess', label: tr('Cờ Vua', 'Chess') },
  { id: 'go', label: tr('Cờ Vây', 'Go 9x9') }
])

function playStoneSound(pitch = 420, duration = 0.055) {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(pitch, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.55, ctx.currentTime + duration)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close().catch(() => {}), 150)
  } catch {
    // Ignore audio errors
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ==========================================
// THƯỞNG MC (server quyết định số tiền)
// ==========================================
const boardGames = useBoardGamesStore()
const winMessage = ref('')

const gameName = (id: BoardGameId) => tr(BOARD_GAME_LABELS[id].vi, BOARD_GAME_LABELS[id].en)

const rewardHint = computed(() => {
  const id = activeTab.value
  const st = boardGames.status
  if (!st?.authenticated) {
    return tr(
      'Bạn chưa kết nối ví nên ván này chỉ để giải trí, không nhận MC. Kết nối ví để thắng cờ nhận MC.',
      'Wallet not connected: this game is for fun only and gives no MC. Connect your wallet to earn MC.'
    )
  }
  if (st.wonGames.includes(id)) {
    return tr(
      `Hôm nay bạn đã nhận +${BOARD_GAME_REWARD_PER_GAME} MC ở môn ${gameName(id)}. Chơi tiếp vẫn vui nhưng không nhận thêm MC. Mai chơi lại để nhận tiếp.`,
      `You already earned +${BOARD_GAME_REWARD_PER_GAME} MC from ${gameName(id)} today. You can keep playing, but no more MC until tomorrow.`
    )
  }
  return tr(
    `Thắng ván ${gameName(id)} này để nhận +${BOARD_GAME_REWARD_PER_GAME} MC (mỗi môn chỉ nhận 1 lần mỗi ngày).`,
    `Win this ${gameName(id)} game to earn +${BOARD_GAME_REWARD_PER_GAME} MC (once per game per day).`
  )
})

const rewardSummary = computed(() => {
  const st = boardGames.status
  const won = st?.wonCount ?? 0
  const earned = st?.earnedTodayMc ?? 0
  return tr(
    `Hôm nay: đã thắng ${won}/${BOARD_GAME_IDS.length} môn, nhận ${earned}/${BOARD_GAME_MAX_DAILY_MC} MC. Thắng đủ cả ${BOARD_GAME_IDS.length} môn được thưởng thêm +${BOARD_GAME_ALL_CLEAR_BONUS} MC (tổng ${BOARD_GAME_MAX_DAILY_MC} MC).`,
    `Today: won ${won}/${BOARD_GAME_IDS.length} games, earned ${earned}/${BOARD_GAME_MAX_DAILY_MC} MC. Win all ${BOARD_GAME_IDS.length} for a +${BOARD_GAME_ALL_CLEAR_BONUS} MC bonus (${BOARD_GAME_MAX_DAILY_MC} MC total).`
  )
})

/** Mở phiên tính thưởng cho môn đang chơi (nếu chưa có). */
function beginRun(id: BoardGameId, force = false) {
  void boardGames.startRun(id, force)
}

async function onGameWon(id: BoardGameId) {
  const res = await boardGames.reportWin(id)
  if (!boardGames.status?.authenticated) {
    winMessage.value = tr('Bạn thắng rồi! Kết nối ví để lần sau thắng được nhận MC.', 'You won! Connect your wallet to earn MC next time.')
    return
  }
  if (!res) {
    winMessage.value = tr('Bạn thắng rồi!', 'You won!')
    return
  }
  if (res.rewardMc > 0) {
    const total = res.rewardMc + res.bonusMc
    winMessage.value =
      res.bonusMc > 0
        ? tr(
            `Chúc mừng! Thắng đủ ${BOARD_GAME_IDS.length} môn hôm nay, bạn nhận +${total} MC (gồm +${res.bonusMc} MC thưởng thêm).`,
            `Congratulations! All ${BOARD_GAME_IDS.length} games won today: +${total} MC (including +${res.bonusMc} MC bonus).`
          )
        : tr(`Chúc mừng! Bạn thắng ${gameName(id)} và nhận +${res.rewardMc} MC.`, `Congratulations! You won ${gameName(id)} and earned +${res.rewardMc} MC.`)
  } else {
    winMessage.value = tr(
      `Bạn thắng! Hôm nay môn ${gameName(id)} đã nhận thưởng rồi nên không có thêm MC.`,
      `You won! ${gameName(id)} already paid out today, so no extra MC.`
    )
  }
}

// ==========================================
// 1. CỜ TƯỚNG (XIANGQI)
// ==========================================
const xqBoard = ref<XiangqiBoard>(createInitialXiangqiBoard())
const xqTurn = ref<XiangqiSide>('red')
const xqSelected = ref<XiangqiPos | null>(null)
const xqLegalTargets = ref<XiangqiPos[]>([])
const xqLastMove = ref<XiangqiMove | null>(null)
const xqHistory = ref<Array<{ board: XiangqiBoard; lastMove: XiangqiMove | null }>>([])
const xqWinner = ref<XiangqiSide | null>(null)
const xqThinking = ref(false)
const xqCheckWarning = ref(false)

const xqBadgeText = computed(() => {
  if (xqWinner.value === 'red') return tr('Đỏ Thắng', 'Red Wins')
  if (xqWinner.value === 'black') return tr('Đen Thắng', 'Black Wins')
  if (xqThinking.value) return tr('Đang nghĩ', 'Thinking')
  return xqTurn.value === 'red' ? tr('Lượt Đỏ', 'Red Turn') : tr('Lượt Đen', 'Black Turn')
})

const xqStatusText = computed(() => {
  if (xqWinner.value === 'red') return tr('Chiếu bí! Đạo Hữu thắng Sư Thầy.', 'Checkmate! You won.')
  if (xqWinner.value === 'black') return tr('Chiếu bí! Sư Thầy thắng ván này.', 'Checkmate! Abbot won.')
  if (xqCheckWarning.value) return tr('Chiếu tướng!', 'Check!')
  return tr('Đạo Hữu cầm quân Đỏ đi trước.', 'Red moves first.')
})

function resetXiangqi() {
  winMessage.value = ''
  beginRun('xiangqi', true)
  xqBoard.value = createInitialXiangqiBoard()
  xqTurn.value = 'red'
  xqSelected.value = null
  xqLegalTargets.value = []
  xqLastMove.value = null
  xqHistory.value = []
  xqWinner.value = null
  xqThinking.value = false
  xqCheckWarning.value = false
}

function undoXiangqi() {
  if (xqHistory.value.length === 0 || xqThinking.value) return
  const prev = xqHistory.value.pop()!
  xqBoard.value = prev.board
  xqLastMove.value = prev.lastMove
  xqTurn.value = 'red'
  xqSelected.value = null
  xqLegalTargets.value = []
  xqWinner.value = null
  xqCheckWarning.value = isInCheck(xqBoard.value, 'red')
}

function isLegalTarget(r: number, c: number): boolean {
  return xqLegalTargets.value.some((p) => p.r === r && p.c === c)
}

function isLastMoveCell(r: number, c: number): boolean {
  if (!xqLastMove.value) return false
  return (
    (xqLastMove.value.from.r === r && xqLastMove.value.from.c === c) ||
    (xqLastMove.value.to.r === r && xqLastMove.value.to.c === c)
  )
}

function onXiangqiCellClick(r: number, c: number) {
  if (xqWinner.value || xqTurn.value !== 'red' || xqThinking.value) return
  const clickedPiece = xqBoard.value[r]![c]

  if (xqSelected.value && isLegalTarget(r, c)) {
    const move: XiangqiMove = { from: { ...xqSelected.value }, to: { r, c }, captured: clickedPiece }
    xqHistory.value.push({ board: cloneXiangqiBoard(xqBoard.value), lastMove: xqLastMove.value })
    xqBoard.value = applyXiangqiMove(xqBoard.value, move)
    xqLastMove.value = move
    xqSelected.value = null
    xqLegalTargets.value = []
    playStoneSound(clickedPiece ? 620 : 380, 0.06)

    if (getAllLegalMoves(xqBoard.value, 'black').length === 0) {
      xqWinner.value = 'red'
      xqCheckWarning.value = false
      return
    }
    xqCheckWarning.value = isInCheck(xqBoard.value, 'black')
    xqTurn.value = 'black'
    xqThinking.value = true

    setTimeout(() => {
      if (!props.open) {
        xqThinking.value = false
        return
      }
      const aiMove = chooseBestXiangqiMove(xqBoard.value, 'black', 3)
      if (!aiMove) {
        xqWinner.value = 'red'
        xqThinking.value = false
        return
      }
      const targetBefore = xqBoard.value[aiMove.to.r]![aiMove.to.c]
      xqBoard.value = applyXiangqiMove(xqBoard.value, aiMove)
      xqLastMove.value = aiMove
      playStoneSound(targetBefore ? 600 : 360, 0.06)

      if (getAllLegalMoves(xqBoard.value, 'red').length === 0) {
        xqWinner.value = 'black'
        xqCheckWarning.value = false
      } else {
        xqCheckWarning.value = isInCheck(xqBoard.value, 'red')
      }
      xqTurn.value = 'red'
      xqThinking.value = false
    }, 180)
    return
  }

  if (clickedPiece && clickedPiece.side === 'red') {
    xqSelected.value = { r, c }
    xqLegalTargets.value = getLegalMovesForPiece(xqBoard.value, r, c)
    playStoneSound(460, 0.03)
    return
  }

  xqSelected.value = null
  xqLegalTargets.value = []
}

// ==========================================
// 2. Ô ĂN QUAN
// ==========================================
const oaqState = ref<OAnQuanState>(createOAnQuanState())
const oaqSelectedCell = ref<number | null>(null)
const oaqAnimating = ref(false)
const oaqHasMoved = ref(false)
const oaqActiveCell = ref<number | null>(null)
const oaqHandCount = ref(0)
const oaqLastEventText = ref('')

const oaqStatusText = computed(() => {
  if (oaqState.value.gameOver) {
    if (oaqState.value.winner === 'player') return tr('Đạo Hữu đã thắng!', 'You won!')
    if (oaqState.value.winner === 'ai') return tr('Tiểu Đồng đã thắng!', 'Novice Monk won!')
    return tr('Hòa cờ!', 'Draw!')
  }
  if (oaqLastEventText.value) return oaqLastEventText.value
  return oaqState.value.turn === 'player'
    ? tr('Chọn một ô của bạn để rải sỏi.', 'Select a cell to sow.')
    : tr('Tiểu Đồng đang suy nghĩ...', 'Novice is thinking...')
})

function resetOAnQuan() {
  winMessage.value = ''
  beginRun('oanquan', true)
  oaqState.value = createOAnQuanState()
  oaqSelectedCell.value = null
  oaqAnimating.value = false
  oaqHasMoved.value = false
  oaqActiveCell.value = null
  oaqHandCount.value = 0
  oaqLastEventText.value = ''
}

function canSelectOaqCell(idx: number): boolean {
  return oaqState.value.turn === 'player' && !oaqAnimating.value && !oaqState.value.gameOver && oaqState.value.cells[idx]!.small > 0
}

function selectOaqCell(idx: number) {
  if (!canSelectOaqCell(idx)) return
  oaqSelectedCell.value = oaqSelectedCell.value === idx ? null : idx
  playStoneSound(520, 0.04)
}

function oaqCellClass(idx: number, interactive = false): string {
  if (oaqActiveCell.value === idx) return 'bg-[#2e2618] border-[#c9a24b]'
  if (oaqSelectedCell.value === idx) return 'bg-[#26221d] border-[#0ecb81]'
  if (interactive && canSelectOaqCell(idx)) return 'bg-[#1a1714] border-[#332d26] hover:border-[#c9a24b]'
  return 'bg-[#1a1714] border-[#332d26]'
}

async function animateOAnQuanMove(cellIndex: number, dir: OAnQuanDir) {
  oaqAnimating.value = true
  oaqSelectedCell.value = null
  const { nextState, events } = executeOAnQuanMove(oaqState.value, cellIndex, dir)
  const visual = cloneOAnQuanState(oaqState.value)

  for (const ev of events) {
    if (!props.open) return
    if (ev.type === 'pickup') {
      oaqActiveCell.value = ev.cellIndex
      visual.cells[ev.cellIndex]!.small = 0
      oaqHandCount.value = ev.handCount
      oaqState.value = cloneOAnQuanState(visual)
      playStoneSound(480, 0.05)
      await sleep(200)
    } else if (ev.type === 'drop') {
      oaqActiveCell.value = ev.cellIndex
      visual.cells[ev.cellIndex]!.small += 1
      oaqHandCount.value = ev.handCount
      oaqState.value = cloneOAnQuanState(visual)
      playStoneSound(360, 0.04)
      await sleep(160)
    } else if (ev.type === 'capture') {
      oaqActiveCell.value = ev.cellIndex
      visual.cells[ev.cellIndex]!.small = 0
      visual.cells[ev.cellIndex]!.quan = 0
      if (ev.side === 'player') visual.playerScore += ev.capturedPoints ?? 0
      else visual.aiScore += ev.capturedPoints ?? 0
      oaqState.value = cloneOAnQuanState(visual)
      oaqLastEventText.value =
        ev.side === 'player'
          ? tr(`Đạo Hữu ăn +${ev.capturedPoints} điểm!`, `Captured +${ev.capturedPoints}!`)
          : tr(`Tiểu Đồng ăn +${ev.capturedPoints} điểm!`, `AI captured +${ev.capturedPoints}!`)
      playStoneSound(660, 0.09)
      await sleep(300)
    }
  }

  oaqHandCount.value = 0
  oaqActiveCell.value = null
  oaqState.value = nextState
  oaqAnimating.value = false

  if (!nextState.gameOver && nextState.turn === 'ai') {
    await sleep(380)
    if (!props.open) return
    const aiMove = chooseBestOAnQuanMove(oaqState.value)
    if (aiMove) await animateOAnQuanMove(aiMove.cellIndex, aiMove.dir)
  }
}

function playOAnQuanMove(cellIndex: number, dir: OAnQuanDir) {
  if (oaqAnimating.value || oaqState.value.turn !== 'player' || oaqState.value.gameOver) return
  oaqHasMoved.value = true
  oaqLastEventText.value = ''
  void animateOAnQuanMove(cellIndex, dir)
}

// ==========================================
// 3. CỜ CARO (15x15)
// ==========================================
const caroBoard = ref<CaroBoard>(createCaroBoard())
const caroTurn = ref<'X' | 'O'>('X')
const caroWinner = ref<'X' | 'O' | 'draw' | null>(null)
const caroWinLine = ref<CaroPos[]>([])
const caroLastMove = ref<CaroPos | null>(null)

const caroBadgeText = computed(() => {
  if (caroWinner.value === 'X') return tr('X Thắng', 'X Wins')
  if (caroWinner.value === 'O') return tr('O Thắng', 'O Wins')
  if (caroWinner.value === 'draw') return tr('Hòa', 'Draw')
  return caroTurn.value === 'X' ? tr('Lượt X (Bạn)', 'Your Turn (X)') : tr('Lượt O', 'AI Turn (O)')
})

const caroStatusText = computed(() => {
  if (caroWinner.value === 'X') return tr('Đạo Hữu thắng 5 quân liên tiếp!', 'You got 5 in a row!')
  if (caroWinner.value === 'O') return tr('Tiểu Đồng đã nối đủ 5 quân O.', 'Novice Monk got 5 in a row.')
  if (caroWinner.value === 'draw') return tr('Bàn cờ đã kín, hòa!', 'Board full, draw!')
  return tr('Đạo Hữu đánh X trước, nối 5 quân để thắng.', 'Play X, connect 5 to win.')
})

function resetCaro() {
  winMessage.value = ''
  beginRun('caro', true)
  caroBoard.value = createCaroBoard()
  caroTurn.value = 'X'
  caroWinner.value = null
  caroWinLine.value = []
  caroLastMove.value = null
}

function isCaroWinCell(r: number, c: number): boolean {
  return caroWinLine.value.some((p) => p.r === r && p.c === c)
}

function onCaroClick(r: number, c: number) {
  if (caroWinner.value || caroTurn.value !== 'X' || caroBoard.value[r]![c] !== null) return
  const next = cloneCaroBoard(caroBoard.value)
  next[r]![c] = 'X'
  caroBoard.value = next
  caroLastMove.value = { r, c }
  playStoneSound(480, 0.04)

  const check = checkCaroWinner(caroBoard.value)
  if (check.winner) {
    caroWinner.value = check.winner
    caroWinLine.value = check.line
    return
  }

  caroTurn.value = 'O'
  setTimeout(() => {
    if (!props.open) return
    const ai = chooseBestCaroMove(caroBoard.value, 'O')
    if (!ai) {
      caroWinner.value = 'draw'
      return
    }
    const afterAi = cloneCaroBoard(caroBoard.value)
    afterAi[ai.r]![ai.c] = 'O'
    caroBoard.value = afterAi
    caroLastMove.value = ai
    playStoneSound(360, 0.04)

    const aiCheck = checkCaroWinner(caroBoard.value)
    if (aiCheck.winner) {
      caroWinner.value = aiCheck.winner
      caroWinLine.value = aiCheck.line
    }
    caroTurn.value = 'X'
  }, 160)
}

// ==========================================
// 4. CỜ VUA (CHESS 8x8)
// ==========================================
const chessState = ref<ChessState>(createInitialChessState())
const chessSelected = ref<ChessPos | null>(null)
const chessLegalMoves = ref<ChessMove[]>([])
const chessLastMove = ref<ChessMove | null>(null)
const chessHistory = ref<Array<{ state: ChessState; lastMove: ChessMove | null }>>([])
const chessWinner = ref<ChessSide | 'draw' | null>(null)
const chessThinking = ref(false)
const chessCheck = ref(false)

const chessBadgeText = computed(() => {
  if (chessWinner.value === 'w') return tr('Trắng Thắng', 'White Wins')
  if (chessWinner.value === 'b') return tr('Đen Thắng', 'Black Wins')
  if (chessWinner.value === 'draw') return tr('Hòa', 'Draw')
  if (chessThinking.value) return tr('Đang nghĩ', 'Thinking')
  return chessState.value.turn === 'w' ? tr('Lượt Trắng', 'White Turn') : tr('Lượt Đen', 'Black Turn')
})

const chessStatusText = computed(() => {
  if (chessWinner.value === 'w') return tr('Chiếu bí! Đạo Hữu thắng.', 'Checkmate! You win.')
  if (chessWinner.value === 'b') return tr('Chiếu bí! Sư Thầy thắng.', 'Checkmate! Abbot wins.')
  if (chessWinner.value === 'draw') return tr('Hết nước đi — Hòa cờ!', 'Stalemate — Draw!')
  if (chessCheck.value) return tr('Chiếu Vua!', 'Check!')
  return tr('Đạo Hữu cầm quân Trắng đi trước.', 'White moves first.')
})

function resetChess() {
  winMessage.value = ''
  beginRun('chess', true)
  chessState.value = createInitialChessState()
  chessSelected.value = null
  chessLegalMoves.value = []
  chessLastMove.value = null
  chessHistory.value = []
  chessWinner.value = null
  chessThinking.value = false
  chessCheck.value = false
}

function undoChess() {
  if (chessHistory.value.length === 0 || chessThinking.value) return
  const prev = chessHistory.value.pop()!
  chessState.value = prev.state
  chessLastMove.value = prev.lastMove
  chessSelected.value = null
  chessLegalMoves.value = []
  chessWinner.value = null
  chessCheck.value = isChessInCheck(chessState.value, 'w')
}

function isChessLegalTarget(r: number, c: number): boolean {
  return chessLegalMoves.value.some((m) => m.to.r === r && m.to.c === c)
}

function isChessLastMove(r: number, c: number): boolean {
  if (!chessLastMove.value) return false
  return (
    (chessLastMove.value.from.r === r && chessLastMove.value.from.c === c) ||
    (chessLastMove.value.to.r === r && chessLastMove.value.to.c === c)
  )
}

function onChessClick(r: number, c: number) {
  if (chessWinner.value || chessState.value.turn !== 'w' || chessThinking.value) return
  const targetMove = chessLegalMoves.value.find((m) => m.to.r === r && m.to.c === c)

  if (targetMove) {
    chessHistory.value.push({ state: chessState.value, lastMove: chessLastMove.value })
    chessState.value = applyChessMove(chessState.value, targetMove)
    chessLastMove.value = targetMove
    chessSelected.value = null
    chessLegalMoves.value = []
    playStoneSound(targetMove.captured ? 620 : 390, 0.05)

    const blackMoves = getAllLegalChessMoves(chessState.value, 'b')
    if (blackMoves.length === 0) {
      chessWinner.value = isChessInCheck(chessState.value, 'b') ? 'w' : 'draw'
      chessCheck.value = false
      return
    }
    chessCheck.value = isChessInCheck(chessState.value, 'b')
    chessThinking.value = true

    setTimeout(() => {
      if (!props.open) {
        chessThinking.value = false
        return
      }
      const aiMove = chooseBestChessMove(chessState.value, 'b', 3)
      if (!aiMove) {
        chessWinner.value = isChessInCheck(chessState.value, 'b') ? 'w' : 'draw'
        chessThinking.value = false
        return
      }
      chessState.value = applyChessMove(chessState.value, aiMove)
      chessLastMove.value = aiMove
      playStoneSound(aiMove.captured ? 600 : 370, 0.05)

      const whiteMoves = getAllLegalChessMoves(chessState.value, 'w')
      if (whiteMoves.length === 0) {
        chessWinner.value = isChessInCheck(chessState.value, 'w') ? 'b' : 'draw'
        chessCheck.value = false
      } else {
        chessCheck.value = isChessInCheck(chessState.value, 'w')
      }
      chessThinking.value = false
    }, 180)
    return
  }

  const piece = chessState.value.board[r]![c]
  if (piece && piece.side === 'w') {
    chessSelected.value = { r, c }
    chessLegalMoves.value = getLegalChessMovesForPiece(chessState.value, r, c)
    playStoneSound(460, 0.03)
    return
  }

  chessSelected.value = null
  chessLegalMoves.value = []
}

// ==========================================
// 5. CỜ VÂY (GO 9x9)
// ==========================================
const goState = ref<GoState>(createGoState())

const goScore = computed(() => scoreGoArea(goState.value.board))

const goBadgeText = computed(() => {
  if (goState.value.gameOver) {
    return goScore.value.black > goScore.value.white ? tr('Đen Thắng', 'Black Wins') : tr('Trắng Thắng', 'White Wins')
  }
  return goState.value.turn === 'B' ? tr('Lượt Đen (Bạn)', 'Black (You)') : tr('Lượt Trắng', 'White Turn')
})

const goStatusText = computed(() => {
  if (goState.value.gameOver) {
    return tr(
      `Kết thúc: Đen ${goScore.value.black} — Trắng ${goScore.value.white} (Komi 6.5)`,
      `Final: Black ${goScore.value.black} — White ${goScore.value.white}`
    )
  }
  return tr('Đạo Hữu cầm quân Đen đi trước. Bấm Bỏ lượt 2 lần để tính điểm.', 'Play Black. Two passes end the game.')
})

function resetGo() {
  winMessage.value = ''
  beginRun('go', true)
  goState.value = createGoState()
}

function triggerGoAiTurn() {
  setTimeout(() => {
    if (!props.open || goState.value.gameOver || goState.value.turn !== 'W') return
    const aiPos = chooseBestGoMove(goState.value)
    if (!aiPos) {
      goState.value = passGoTurn(goState.value)
      playStoneSound(320, 0.04)
      return
    }
    const res = tryPlayGoMove(goState.value, aiPos.r, aiPos.c)
    if (res.ok && res.nextState) {
      goState.value = res.nextState
      playStoneSound(res.capturedCount ? 620 : 370, 0.05)
    } else {
      goState.value = passGoTurn(goState.value)
    }
  }, 200)
}

function onGoCellClick(r: number, c: number) {
  if (goState.value.gameOver || goState.value.turn !== 'B') return
  const res = tryPlayGoMove(goState.value, r, c)
  if (!res.ok || !res.nextState) return
  goState.value = res.nextState
  playStoneSound(res.capturedCount ? 640 : 420, 0.05)
  triggerGoAiTurn()
}

function onGoPass() {
  if (goState.value.gameOver || goState.value.turn !== 'B') return
  goState.value = passGoTurn(goState.value)
  playStoneSound(310, 0.04)
  if (!goState.value.gameOver) triggerGoAiTurn()
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      xqThinking.value = false
      chessThinking.value = false
    }
  }
)

// ==========================================
// Khóa đổi tab khi đang trong ván chơi & Kết nối thưởng MC
// ==========================================
const tabLockWarning = ref('')

const isCurrentGameInProgress = computed(() => {
  switch (activeTab.value) {
    case 'xiangqi':
      return (xqHistory.value.length > 0 || xqThinking.value || xqLastMove.value !== null) && !xqWinner.value
    case 'oanquan':
      return (oaqHasMoved.value || oaqAnimating.value) && !oaqState.value.gameOver
    case 'caro':
      return caroLastMove.value !== null && !caroWinner.value
    case 'chess':
      return (chessHistory.value.length > 0 || chessThinking.value || chessLastMove.value !== null) && !chessWinner.value
    case 'go':
      return (
        (goState.value.lastMove !== null ||
          goState.value.capturesB > 0 ||
          goState.value.capturesW > 0 ||
          goState.value.consecutivePasses > 0) &&
        !goState.value.gameOver
      )
    default:
      return false
  }
})

function onRequestTabChange(nextTab: BoardGameId) {
  if (nextTab === activeTab.value) return
  if (isCurrentGameInProgress.value) {
    tabLockWarning.value = tr(
      'Đang trong ván chơi! Phải kết thúc ván hiện tại mới được chọn sang môn cờ khác.',
      'Match in progress! Please finish or end the current match before switching games.'
    )
    playStoneSound(240, 0.08)
    return
  }
  tabLockWarning.value = ''
  activeTab.value = nextTab
}

function endCurrentGame() {
  tabLockWarning.value = ''
  switch (activeTab.value) {
    case 'xiangqi':
      xqThinking.value = false
      xqWinner.value = 'black'
      break
    case 'oanquan':
      oaqAnimating.value = false
      oaqState.value = { ...oaqState.value, gameOver: true, winner: 'ai' }
      break
    case 'caro':
      caroWinner.value = 'O'
      break
    case 'chess':
      chessThinking.value = false
      chessWinner.value = 'b'
      break
    case 'go':
      goState.value = { ...goState.value, gameOver: true }
      break
  }
}

watch(isCurrentGameInProgress, (inProg) => {
  if (!inProg) {
    tabLockWarning.value = ''
  }
})

onMounted(async () => {
  await boardGames.refreshStatus()
  beginRun(activeTab.value)
})

watch(activeTab, (id) => {
  winMessage.value = ''
  beginRun(id)
})

watch(() => xqWinner.value, (w) => {
  if (w === 'red') void onGameWon('xiangqi')
})
watch(() => chessWinner.value, (w) => {
  if (w === 'w') void onGameWon('chess')
})
watch(() => caroWinner.value, (w) => {
  if (w === 'X') void onGameWon('caro')
})
watch(() => oaqState.value.gameOver, (over) => {
  if (over && oaqState.value.winner === 'player') void onGameWon('oanquan')
})
watch(() => goState.value.gameOver, (over) => {
  if (over && goScore.value.black > goScore.value.white) void onGameWon('go')
})
</script>
