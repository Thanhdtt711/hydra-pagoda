<template>
  <div class="space-y-3">
    <!-- Thông báo lỗi / trạng thái -->
    <div
      v-if="errorMsg"
      class="bg-[#26221d] border border-[#f6465d]/70 rounded-[2px] px-3 py-2 flex items-center justify-between gap-2"
    >
      <span class="text-xs font-semibold text-[#f6465d]">{{ errorMsg }}</span>
      <UiButton variant="ghost" size="sm" @click="errorMsg = ''">Đóng</UiButton>
    </div>

    <!-- ===================================================== -->
    <!-- CHẾ ĐỘ 1: ĐANG TRONG BÀN ĐẤU / PHÒNG CHỜ              -->
    <!-- ===================================================== -->
    <div v-if="activeMatch" class="space-y-3">
      <!-- Header thông tin bàn -->
      <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <UiBadge variant="gold">{{ gameLabel(activeMatch.gameId) }}</UiBadge>
          <span class="text-xs font-bold font-numbers text-[#f0e6d2]">Mã phòng: #{{ activeMatch.roomCode }}</span>
          <UiButton variant="ghost" size="sm" @click="copyRoomCode(activeMatch.roomCode)">
            {{ copiedCode ? 'Đã chép' : 'Chép mã' }}
          </UiButton>
        </div>
        <div class="flex items-center gap-2 text-xs font-numbers">
          <span class="text-[#9c9283]">Cược: <strong class="text-[#c9a24b]">{{ activeMatch.wagerMc.toLocaleString() }} MC</strong></span>
          <span class="text-[#9c9283]">Thắng: <strong class="text-[#0ecb81]">+{{ activeMatch.expectedPayoutMc.toLocaleString() }} MC</strong></span>
        </div>
      </div>

      <!-- Trạng thái ĐANG CHỜ ĐỐI THỦ -->
      <div
        v-if="activeMatch.status === 'waiting'"
        class="bg-[#1a1714] border border-[#c9a24b]/60 rounded-[2px] p-4 text-center space-y-3"
      >
        <div class="text-sm font-bold text-[#c9a24b]">Đang chờ kỳ thủ tham gia bàn đấu</div>
        <div class="text-xs text-[#f0e6d2]">
          Chia sẻ mã phòng <span class="font-bold font-numbers text-[#0ecb81] px-1.5 py-0.5 bg-[#26221d] border border-[#332d26] rounded-[2px]">{{ activeMatch.roomCode }}</span> hoặc chờ người chơi khác bấm Vào đấu ở sảnh.
        </div>
        <div class="text-xs text-[#9c9283]">
          Đã tạm khóa {{ activeMatch.wagerMc.toLocaleString() }} MC trên Hydra L2. Hủy bàn sẽ hoàn lại 100% MC ngay lập tức.
        </div>
        <div class="flex justify-center gap-2 pt-1">
          <UiButton variant="secondary" size="sm" :disabled="busy" @click="refreshActiveMatch">Làm mới</UiButton>
          <UiButton variant="danger" size="sm" :disabled="busy" @click="handleCancelMatch">Hủy bàn (Hoàn 100%)</UiButton>
        </div>
      </div>

      <!-- Trạng thái ĐANG ĐẤU hoặc ĐÃ KẾT THÚC -->
      <template v-else>
        <!-- Banner Kết Quả khi trận đấu kết thúc -->
        <div
          v-if="activeMatch.status === 'finished'"
          class="bg-[#26221d] border-2 rounded-[2px] px-3.5 py-3 flex items-center justify-between gap-3"
          :class="
            activeMatch.winnerSide === 'draw'
              ? 'border-[#c9a24b]'
              : activeMatch.winnerSide === activeMatch.mySide
                ? 'border-[#0ecb81]'
                : 'border-[#f6465d]'
          "
        >
          <div class="space-y-0.5 min-w-0">
            <div
              class="text-sm font-bold"
              :class="
                activeMatch.winnerSide === 'draw'
                  ? 'text-[#c9a24b]'
                  : activeMatch.winnerSide === activeMatch.mySide
                    ? 'text-[#0ecb81]'
                    : 'text-[#f6465d]'
              "
            >
              {{ finishTitle }}
            </div>
            <div class="text-xs text-[#f0e6d2]">{{ finishSubtitle }}</div>
          </div>
          <UiButton variant="primary" size="sm" @click="leaveFinishedMatch">Về Sảnh PvP</UiButton>
        </div>

        <!-- Banner đề nghị hòa từ đối thủ -->
        <div
          v-if="activeMatch.status === 'playing' && activeMatch.drawOfferBy && activeMatch.drawOfferBy !== activeMatch.mySide"
          class="bg-[#26221d] border border-[#c9a24b] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2"
        >
          <span class="text-xs font-semibold text-[#c9a24b]">Đối thủ đề nghị hòa ván này (hoàn 100% cược cho cả hai).</span>
          <div class="flex items-center gap-1.5 shrink-0">
            <UiButton variant="primary" size="sm" :disabled="busy" @click="handleAction('accept_draw')">Đồng ý hòa</UiButton>
            <UiButton variant="secondary" size="sm" :disabled="busy" @click="handleAction('reject_draw')">Từ chối</UiButton>
          </div>
        </div>

        <!-- Thanh 2 Kỳ Thủ + Đồng hồ lượt -->
        <div class="grid grid-cols-2 gap-2">
          <div
            class="bg-[#1a1714] border rounded-[2px] px-3 py-2 flex items-center justify-between gap-2"
            :class="activeMatch.status === 'playing' && activeMatch.turnSide === 'p1' ? 'border-[#0ecb81] bg-[#26221d]' : 'border-[#332d26]'"
          >
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#f0e6d2] truncate">
                {{ activeMatch.host.name }} {{ activeMatch.mySide === 'p1' ? '(Bạn)' : '' }}
              </div>
              <div class="text-xs text-[#9c9283]">{{ sideLabel(activeMatch.gameId, 'p1') }}</div>
            </div>
            <UiBadge v-if="activeMatch.status === 'playing' && activeMatch.turnSide === 'p1'" variant="success">
              {{ remainingSec }}s
            </UiBadge>
            <UiBadge v-else-if="activeMatch.winnerSide === 'p1'" variant="success">Thắng</UiBadge>
          </div>

          <div
            class="bg-[#1a1714] border rounded-[2px] px-3 py-2 flex items-center justify-between gap-2"
            :class="activeMatch.status === 'playing' && activeMatch.turnSide === 'p2' ? 'border-[#0ecb81] bg-[#26221d]' : 'border-[#332d26]'"
          >
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#f0e6d2] truncate">
                {{ activeMatch.guest?.name || 'Khách' }} {{ activeMatch.mySide === 'p2' ? '(Bạn)' : '' }}
              </div>
              <div class="text-xs text-[#9c9283]">{{ sideLabel(activeMatch.gameId, 'p2') }}</div>
            </div>
            <UiBadge v-if="activeMatch.status === 'playing' && activeMatch.turnSide === 'p2'" variant="success">
              {{ remainingSec }}s
            </UiBadge>
            <UiBadge v-else-if="activeMatch.winnerSide === 'p2'" variant="success">Thắng</UiBadge>
          </div>
        </div>

        <!-- Cảnh báo Chiếu Tướng / Chiếu Vua -->
        <div
          v-if="activeMatch.status === 'playing' && activeMatch.inCheckSide"
          class="bg-[#26221d] border border-[#f6465d] rounded-[2px] px-3 py-1.5 text-xs font-bold text-[#f6465d] text-center"
        >
          {{ activeMatch.gameId === 'xiangqi' ? 'CHIẾU TƯỚNG!' : 'CHIẾU VUA!' }}
          {{ activeMatch.inCheckSide === activeMatch.mySide ? ' Vua/Tướng của bạn đang bị chiếu!' : ' Đối thủ đang bị chiếu!' }}
        </div>

        <!-- ================================================= -->
        <!-- BÀN CỜ TƯỚNG PvP (10x9 SVG Gỗ cổ điển)           -->
        <!-- ================================================= -->
        <div v-if="activeMatch.gameId === 'xiangqi' && xqBoard" class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div class="relative w-full max-w-[396px] aspect-[9/10] bg-[#c8a05d] border-2 border-[#7a5223] rounded-[2px]">
            <svg viewBox="0 0 900 1000" class="w-full h-full pointer-events-none block">
              <rect x="44" y="44" width="812" height="912" fill="none" stroke="#4a2c11" stroke-width="4" />
              <line v-for="r in 10" :key="`xh-${r}`" x1="50" :y1="50 + (r - 1) * 100" x2="850" :y2="50 + (r - 1) * 100" stroke="#4a2c11" stroke-width="2.5" />
              <line x1="50" y1="50" x2="50" y2="950" stroke="#4a2c11" stroke-width="2.5" />
              <line x1="850" y1="50" x2="850" y2="950" stroke="#4a2c11" stroke-width="2.5" />
              <template v-for="c in 7" :key="`xv-${c}`">
                <line :x1="50 + c * 100" y1="50" :x2="50 + c * 100" y2="450" stroke="#4a2c11" stroke-width="2.5" />
                <line :x1="50 + c * 100" y1="550" :x2="50 + c * 100" y2="950" stroke="#4a2c11" stroke-width="2.5" />
              </template>
              <line x1="350" y1="50" x2="550" y2="250" stroke="#4a2c11" stroke-width="2.5" />
              <line x1="550" y1="50" x2="350" y2="250" stroke="#4a2c11" stroke-width="2.5" />
              <line x1="350" y1="750" x2="550" y2="950" stroke="#4a2c11" stroke-width="2.5" />
              <line x1="550" y1="750" x2="350" y2="950" stroke="#4a2c11" stroke-width="2.5" />
              <text x="235" y="514" text-anchor="middle" fill="#4a2c11" font-size="38" font-weight="700" opacity="0.72">楚 河</text>
              <text x="665" y="514" text-anchor="middle" fill="#4a2c11" font-size="38" font-weight="700" opacity="0.72">漢 界</text>
            </svg>
            <div class="absolute inset-0 grid grid-cols-9 grid-rows-10">
              <template v-for="vr in 10" :key="`xvr-${vr}`">
                <button
                  v-for="vc in 9"
                  :key="`xvc-${vr}-${vc}`"
                  type="button"
                  class="relative flex items-center justify-center cursor-pointer focus:outline-none"
                  @click="onXqClick(xqLogicalR(vr - 1), xqLogicalC(vc - 1))"
                >
                  <span
                    v-if="isXqLegalTarget(xqLogicalR(vr - 1), xqLogicalC(vc - 1)) && !xqBoard[xqLogicalR(vr - 1)]?.[xqLogicalC(vc - 1)]"
                    class="w-3 h-3 rounded-full bg-[#0ecb81] border border-[#14110e]"
                  ></span>
                  <span
                    v-if="xqBoard[xqLogicalR(vr - 1)]?.[xqLogicalC(vc - 1)]"
                    class="w-[82%] h-[82%] rounded-full flex items-center justify-center font-bold text-sm border-2 transition-transform"
                    :class="[
                      xqBoard[xqLogicalR(vr - 1)]![xqLogicalC(vc - 1)]!.side === 'red'
                        ? 'bg-[#f6ecd8] text-[#b8372b] border-[#b8372b]'
                        : 'bg-[#1f1c18] text-[#f0e6d2] border-[#c9a24b]',
                      selectedPos?.r === xqLogicalR(vr - 1) && selectedPos?.c === xqLogicalC(vc - 1)
                        ? 'ring-2 ring-[#0ecb81] scale-110'
                        : isXqLegalTarget(xqLogicalR(vr - 1), xqLogicalC(vc - 1))
                          ? 'ring-2 ring-[#f6465d]'
                          : isLastFromOrTo(xqLogicalR(vr - 1), xqLogicalC(vc - 1))
                            ? 'ring-2 ring-[#c9a24b]'
                            : ''
                    ]"
                  >
                    {{ getPieceChar(xqBoard[xqLogicalR(vr - 1)]![xqLogicalC(vc - 1)]!) }}
                  </span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- ================================================= -->
        <!-- BÀN CỜ VUA PvP (8x8 Staunton SVG)                 -->
        <!-- ================================================= -->
        <div v-else-if="activeMatch.gameId === 'chess' && chessSt" class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
          <div class="w-full max-w-[384px] aspect-square border-2 border-[#c9a24b] rounded-[2px] grid grid-cols-8 grid-rows-8 overflow-hidden">
            <template v-for="vr in 8" :key="`cvr-${vr}`">
              <button
                v-for="vc in 8"
                :key="`cvc-${vr}-${vc}`"
                type="button"
                class="relative flex items-center justify-center cursor-pointer focus:outline-none"
                :class="[
                  (chessLogicalR(vr - 1) + chessLogicalC(vc - 1)) % 2 === 0 ? 'bg-[#f0f0f0]' : 'bg-[#8a8a8a]',
                  selectedPos?.r === chessLogicalR(vr - 1) && selectedPos?.c === chessLogicalC(vc - 1)
                    ? 'ring-2 ring-inset ring-[#0ecb81]'
                    : isLastFromOrTo(chessLogicalR(vr - 1), chessLogicalC(vc - 1))
                      ? 'ring-2 ring-inset ring-[#c9a24b]'
                      : ''
                ]"
                @click="onChessClick(chessLogicalR(vr - 1), chessLogicalC(vc - 1))"
              >
                <span
                  v-if="isChessLegalTarget(chessLogicalR(vr - 1), chessLogicalC(vc - 1)) && !chessSt.board[chessLogicalR(vr - 1)]?.[chessLogicalC(vc - 1)]"
                  class="w-3 h-3 rounded-full bg-[#0ecb81] border border-[#14110e] pointer-events-none"
                ></span>
                <span
                  v-if="isChessLegalTarget(chessLogicalR(vr - 1), chessLogicalC(vc - 1)) && chessSt.board[chessLogicalR(vr - 1)]?.[chessLogicalC(vc - 1)]"
                  class="absolute inset-0.5 rounded-[2px] border-2 border-[#f6465d] pointer-events-none"
                ></span>
                <ChessPieceSvg
                  v-if="chessSt.board[chessLogicalR(vr - 1)]?.[chessLogicalC(vc - 1)]"
                  :type="chessSt.board[chessLogicalR(vr - 1)]![chessLogicalC(vc - 1)]!.type"
                  :side="chessSt.board[chessLogicalR(vr - 1)]![chessLogicalC(vc - 1)]!.side"
                />
              </button>
            </template>
          </div>
        </div>

        <!-- ================================================= -->
        <!-- BÀN CỜ CARO PvP (15x15)                           -->
        <!-- ================================================= -->
        <div v-else-if="activeMatch.gameId === 'caro' && caroBoard" class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2 select-none">
          <div class="w-full max-w-[405px] aspect-square bg-[#2b241c] border-2 border-[#c9a24b] rounded-[2px] grid grid-cols-15 grid-rows-15">
            <template v-for="r in 15" :key="`cr-${r}`">
              <button
                v-for="c in 15"
                :key="`cc-${r}-${c}`"
                type="button"
                class="border border-[#3d342a] flex items-center justify-center text-xs font-extrabold cursor-pointer focus:outline-none"
                :class="[
                  isCaroWinCell(r - 1, c - 1) ? 'bg-[#0ecb81]/25' : isLastSingle(r - 1, c - 1) ? 'bg-[#c9a24b]/25' : 'hover:bg-[#332d26]',
                  caroBoard[r - 1]?.[c - 1] === 'X' ? 'text-[#f6465d]' : 'text-[#0ecb81]'
                ]"
                @click="onCaroClick(r - 1, c - 1)"
              >
                {{ caroBoard[r - 1]?.[c - 1] || '' }}
              </button>
            </template>
          </div>
        </div>

        <!-- ================================================= -->
        <!-- BÀN CỜ VÂY PvP (9x9)                              -->
        <!-- ================================================= -->
        <div v-else-if="activeMatch.gameId === 'go' && goSt" class="space-y-2">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-1.5 flex items-center justify-between">
              <span class="text-[#9c9283]">Đen bắt (Chủ bàn)</span>
              <span class="font-bold font-numbers text-[#0ecb81]">{{ goSt.capturesB }}</span>
            </div>
            <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-1.5 flex items-center justify-between">
              <span class="text-[#9c9283]">Trắng bắt (Khách)</span>
              <span class="font-bold font-numbers text-[#f0e6d2]">{{ goSt.capturesW }}</span>
            </div>
          </div>
          <div class="flex justify-center bg-[#14110e] border border-[#332d26] rounded-[2px] p-2.5 select-none">
            <div class="relative w-full max-w-[360px] aspect-square bg-[#9e7d45] border-2 border-[#c9a24b] rounded-[2px] p-2">
              <svg viewBox="0 0 800 800" class="w-full h-full pointer-events-none">
                <line v-for="i in 9" :key="`pgh-${i}`" x1="40" :y1="40 + (i - 1) * 90" x2="760" :y2="40 + (i - 1) * 90" stroke="#2c2214" stroke-width="2.5" />
                <line v-for="i in 9" :key="`pgv-${i}`" :x1="40 + (i - 1) * 90" y1="40" :x2="40 + (i - 1) * 90" y2="760" stroke="#2c2214" stroke-width="2.5" />
                <circle cx="220" cy="220" r="6" fill="#2c2214" />
                <circle cx="580" cy="220" r="6" fill="#2c2214" />
                <circle cx="400" cy="400" r="6" fill="#2c2214" />
                <circle cx="220" cy="580" r="6" fill="#2c2214" />
                <circle cx="580" cy="580" r="6" fill="#2c2214" />
              </svg>
              <div class="absolute inset-2 grid grid-cols-9 grid-rows-9">
                <template v-for="r in 9" :key="`gr-${r}`">
                  <button
                    v-for="c in 9"
                    :key="`gc-${r}-${c}`"
                    type="button"
                    class="flex items-center justify-center cursor-pointer focus:outline-none"
                    @click="onGoClick(r - 1, c - 1)"
                  >
                    <span
                      v-if="goSt.board[r - 1]?.[c - 1]"
                      class="w-[80%] h-[80%] rounded-full border"
                      :class="[
                        goSt.board[r - 1]![c - 1] === 'B' ? 'bg-[#14110e] border-[#332d26]' : 'bg-[#f6ecd8] border-[#7a5223]',
                        goSt.lastMove?.r === r - 1 && goSt.lastMove?.c === c - 1 ? 'ring-2 ring-[#0ecb81]' : ''
                      ]"
                    ></span>
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Thanh nút hành động trong trận -->
        <div v-if="activeMatch.status === 'playing'" class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-1.5">
            <UiButton
              v-if="activeMatch.gameId === 'go'"
              variant="secondary"
              size="sm"
              :disabled="busy || !isMyTurn"
              @click="onGoPass"
            >
              Bỏ lượt (Pass)
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="busy || activeMatch.drawOfferBy === activeMatch.mySide"
              @click="handleAction('offer_draw')"
            >
              {{ activeMatch.drawOfferBy === activeMatch.mySide ? 'Đã gửi cầu hòa' : 'Cầu hòa' }}
            </UiButton>
            <UiButton
              v-if="remainingSec === 0 && !isMyTurn"
              variant="primary"
              size="sm"
              :disabled="busy"
              @click="handleAction('claim_timeout')"
            >
              Bắt hết giờ
            </UiButton>
          </div>
          <UiButton variant="danger" size="sm" :disabled="busy" @click="handleAction('resign')">
            Đầu hàng
          </UiButton>
        </div>
      </template>
    </div>

    <!-- ===================================================== -->
    <!-- CHẾ ĐỘ 2: SẢNH CHỜ PvP (TẠO BÀN + DANH SÁCH PHÒNG)    -->
    <!-- ===================================================== -->
    <div v-else class="space-y-3">
      <!-- Khu vực tạo bàn cược mới -->
      <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-3 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-[#c9a24b]">Tạo bàn đấu PvP cược MC (Hydra L2)</span>
          <span class="text-xs font-numbers text-[#9c9283]">
            Số dư: <strong class="text-[#c9a24b]">{{ wallet.mcBalance.toLocaleString() }} MC</strong>
          </span>
        </div>

        <!-- Chọn 1 trong 4 môn cờ -->
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="g in PVP_GAMES"
            :key="g.id"
            type="button"
            class="px-2 py-2 rounded-[2px] border text-xs font-semibold transition-colors cursor-pointer"
            :class="selectedGame === g.id ? 'bg-[#26221d] border-[#c9a24b] text-[#c9a24b]' : 'bg-[#14110e] border-[#332d26] text-[#f0e6d2] hover:border-[#c9a24b]/60'"
            @click="selectedGame = g.id"
          >
            {{ g.label }}
          </button>
        </div>

        <!-- Chọn mức cược -->
        <div class="space-y-1.5">
          <div class="text-xs text-[#9c9283]">Chọn mức cược mỗi bên:</div>
          <div class="grid grid-cols-5 gap-1.5">
            <button
              v-for="w in WAGERS"
              :key="w"
              type="button"
              class="px-2 py-1.5 rounded-[2px] border text-xs font-bold font-numbers transition-colors cursor-pointer"
              :class="selectedWager === w ? 'bg-[#26221d] border-[#c9a24b] text-[#c9a24b]' : 'bg-[#14110e] border-[#332d26] text-[#f0e6d2] hover:border-[#c9a24b]/60'"
              @click="selectedWager = w"
            >
              {{ w.toLocaleString() }}
            </button>
          </div>
        </div>

        <!-- Minh bạch tỷ lệ thưởng 95% / phí bàn 5% -->
        <div class="bg-[#14110e] border border-[#332d26] rounded-[2px] px-2.5 py-2 text-xs text-[#9c9283] flex flex-wrap items-center justify-between gap-2">
          <span>
            Tổng pot <strong class="font-numbers text-[#f0e6d2]">{{ (selectedWager * 2).toLocaleString() }} MC</strong> · Thắng nhận <strong class="font-numbers text-[#0ecb81]">{{ Math.floor(selectedWager * 2 * 0.95).toLocaleString() }} MC (95%)</strong> · Phí bàn 5% vào Quỹ 55/5/40 · Hòa hoàn 100%.
          </span>
        </div>

        <UiButton
          variant="primary"
          size="md"
          block
          :disabled="busy || wallet.mcBalance < selectedWager"
          @click="handleCreateMatch"
        >
          {{ busy ? 'Đang tạo bàn...' : `Tạo bàn ${gameLabel(selectedGame)} (${selectedWager.toLocaleString()} MC)` }}
        </UiButton>
      </div>

      <!-- Vào phòng nhanh bằng mã 6 ký tự -->
      <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-3 flex items-center gap-2">
        <UiInput
          v-model="joinCodeInput"
          placeholder="Nhập mã phòng 6 ký tự..."
          class="flex-1"
        />
        <UiButton
          variant="secondary"
          size="md"
          :disabled="busy || joinCodeInput.trim().length < 4"
          @click="handleJoinByCode"
        >
          Vào mã
        </UiButton>
      </div>

      <!-- Danh sách bàn đang chờ -->
      <div class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-[#f0e6d2]">Bàn đang chờ đấu ({{ waitingMatches.length }})</span>
          <UiButton variant="ghost" size="sm" :disabled="busy" @click="loadLobby">Làm mới</UiButton>
        </div>

        <div v-if="waitingMatches.length === 0" class="text-center py-4 text-xs text-[#9c9283]">
          Chưa có bàn nào đang chờ. Hãy tạo bàn đầu tiên và mời đạo hữu cùng đấu!
        </div>

        <div v-else class="space-y-1.5 max-h-[210px] overflow-y-auto">
          <div
            v-for="m in waitingMatches"
            :key="m.matchId"
            class="bg-[#14110e] border border-[#332d26] rounded-[2px] px-3 py-2 flex items-center justify-between gap-2"
          >
            <div class="min-w-0 space-y-0.5">
              <div class="flex items-center gap-1.5">
                <UiBadge variant="gold">{{ gameLabel(m.gameId) }}</UiBadge>
                <span class="text-xs font-bold text-[#f0e6d2] truncate">{{ m.host.name }}</span>
                <span class="text-xs font-numbers text-[#9c9283]">#{{ m.roomCode }}</span>
              </div>
              <div class="text-xs font-numbers text-[#9c9283]">
                Cược <strong class="text-[#c9a24b]">{{ m.wagerMc.toLocaleString() }} MC</strong> · Thắng ăn <strong class="text-[#0ecb81]">{{ m.expectedPayoutMc.toLocaleString() }} MC</strong>
              </div>
            </div>
            <UiButton
              variant="primary"
              size="sm"
              :disabled="busy || m.mySide === 'p1' || wallet.mcBalance < m.wagerMc"
              @click="handleJoinMatch(m.matchId)"
            >
              {{ m.mySide === 'p1' ? 'Bàn của bạn' : 'Vào đấu' }}
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Lịch sử trận PvP gần đây -->
      <div v-if="recentMatches.length > 0" class="bg-[#1a1714] border border-[#332d26] rounded-[2px] p-3 space-y-2">
        <div class="text-xs font-bold text-[#9c9283]">Lịch sử PvP gần đây của bạn</div>
        <div class="space-y-1.5">
          <div
            v-for="rm in recentMatches"
            :key="rm.matchId"
            class="bg-[#14110e] border border-[#332d26] rounded-[2px] px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-semibold text-[#f0e6d2]">{{ gameLabel(rm.gameId) }}</span>
              <span class="text-[#9c9283] font-numbers">#{{ rm.roomCode }}</span>
            </div>
            <span
              class="font-bold font-numbers"
              :class="
                rm.winnerSide === 'draw'
                  ? 'text-[#c9a24b]'
                  : rm.winnerSide === rm.mySide
                    ? 'text-[#0ecb81]'
                    : 'text-[#f6465d]'
              "
            >
              {{
                rm.winnerSide === 'draw'
                  ? 'Hòa (Hoàn 100%)'
                  : rm.winnerSide === rm.mySide
                    ? `+${(rm.payoutMc - rm.wagerMc).toLocaleString()} MC`
                    : `-${rm.wagerMc.toLocaleString()} MC`
              }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiInput from '~/components/ui/UiInput.vue'
import ChessPieceSvg from '~/components/ui/ChessPieceSvg.vue'
import { useWalletStore } from '~/stores/wallet'
import { getPieceChar, getLegalMovesForPiece, type XiangqiBoard, type XiangqiPos } from '~/lib/games/xiangqi'
import { getLegalChessMovesForPiece, type ChessState, type ChessMove } from '~/lib/games/chess'
import type { CaroBoard } from '~/lib/games/caro'
import type { GoState } from '~/lib/games/go'
import { zenAudio } from '~/lib/audio/ZenAudio'

type PvpGameId = 'xiangqi' | 'chess' | 'caro' | 'go'

interface PvpMatchView {
  matchId: string
  roomCode: string
  gameId: PvpGameId
  wagerMc: number
  potMc: number
  expectedPayoutMc: number
  expectedRakeMc: number
  status: 'waiting' | 'playing' | 'finished' | 'cancelled'
  mySide: 'p1' | 'p2' | null
  host: { address: string; shortAddress: string; name: string }
  guest: { address: string; shortAddress: string; name: string } | null
  turnSide: 'p1' | 'p2'
  state: unknown
  moveCount: number
  lastMove: any
  winnerSide: 'p1' | 'p2' | 'draw' | null
  endReason: string | null
  drawOfferBy: 'p1' | 'p2' | null
  payoutMc: number
  rakeMc: number
  turnDeadlineAt: number | null
  serverNow: number
  inCheckSide?: 'p1' | 'p2' | null
  goScore?: { black: number; white: number } | null
}

const PVP_GAMES: Array<{ id: PvpGameId; label: string }> = [
  { id: 'xiangqi', label: 'Cờ Tướng' },
  { id: 'chess', label: 'Cờ Vua' },
  { id: 'caro', label: 'Cờ Caro' },
  { id: 'go', label: 'Cờ Vây' }
]
const WAGERS = [50, 100, 200, 500, 1000] as const

const wallet = useWalletStore()
const selectedGame = ref<PvpGameId>('xiangqi')
const selectedWager = ref<number>(100)
const joinCodeInput = ref('')
const busy = ref(false)
const errorMsg = ref('')
const copiedCode = ref(false)

const activeMatch = ref<PvpMatchView | null>(null)
const waitingMatches = ref<PvpMatchView[]>([])
const recentMatches = ref<PvpMatchView[]>([])

const selectedPos = ref<{ r: number; c: number } | null>(null)
const nowTick = ref(Date.now())
const serverSkewMs = ref(0)

let pollTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

function extractErr(e: any, fallback: string): string {
  return e?.data?.data?.message || e?.data?.message || e?.message || fallback
}

function gameLabel(id: PvpGameId): string {
  return PVP_GAMES.find(g => g.id === id)?.label || id
}

function sideLabel(id: PvpGameId, side: 'p1' | 'p2'): string {
  if (id === 'xiangqi') return side === 'p1' ? 'Quân Đỏ (đi trước)' : 'Quân Đen'
  if (id === 'chess') return side === 'p1' ? 'Quân Trắng (đi trước)' : 'Quân Đen'
  if (id === 'caro') return side === 'p1' ? 'Quân X (đi trước)' : 'Quân O'
  return side === 'p1' ? 'Quân Đen (đi trước)' : 'Quân Trắng (+6,5 Komi)'
}

const isMyTurn = computed(() => {
  const m = activeMatch.value
  return Boolean(m && m.status === 'playing' && m.mySide && m.turnSide === m.mySide)
})

const remainingSec = computed(() => {
  const m = activeMatch.value
  if (!m || m.status !== 'playing' || !m.turnDeadlineAt) return 0
  const estNow = nowTick.value + serverSkewMs.value
  return Math.max(0, Math.ceil((m.turnDeadlineAt - estNow) / 1000))
})

const finishTitle = computed(() => {
  const m = activeMatch.value
  if (!m || m.status !== 'finished') return ''
  if (m.winnerSide === 'draw') return 'Ván đấu HÒA — Hoàn trả 100% cược'
  if (m.winnerSide === m.mySide) return `CHIẾN THẮNG! Bạn nhận +${m.payoutMc.toLocaleString()} MC`
  return `Bạn đã thua (-${m.wagerMc.toLocaleString()} MC)`
})

const finishSubtitle = computed(() => {
  const m = activeMatch.value
  if (!m) return ''
  const reasonMap: Record<string, string> = {
    checkmate: 'Chiếu bí kết thúc ván đấu.',
    five_in_row: 'Đủ 5 quân thẳng hàng.',
    area_score: m.goScore ? `Tính đất Cờ Vây: Đen ${m.goScore.black} - Trắng ${m.goScore.white}.` : 'Kết thúc tính đất Cờ Vây.',
    resign: 'Một bên đã xin đầu hàng.',
    timeout: 'Hết thời gian suy nghĩ 90 giây/nước.',
    draw_agreement: 'Hai kỳ thủ đồng ý hòa.',
    stalemate: 'Hòa cờ (hết nước đi hợp lệ).',
    board_full: 'Bàn cờ đã kín ô.'
  }
  const base = reasonMap[m.endReason || ''] || 'Ván đấu đã kết thúc.'
  return m.rakeMc > 0 ? `${base} Phí bàn 5% (${m.rakeMc} MC) chảy vào Quỹ 55/5/40.` : base
})

const xqBoard = computed(() => (activeMatch.value?.gameId === 'xiangqi' ? (activeMatch.value.state as XiangqiBoard) : null))
const chessSt = computed(() => (activeMatch.value?.gameId === 'chess' ? (activeMatch.value.state as ChessState) : null))
const caroBoard = computed(() => (activeMatch.value?.gameId === 'caro' ? (activeMatch.value.state as CaroBoard) : null))
const goSt = computed(() => (activeMatch.value?.gameId === 'go' ? (activeMatch.value.state as GoState) : null))

// Lật bàn cờ khi người chơi là khách (p2) ở Cờ Tướng và Cờ Vua
const flipBoard = computed(() => activeMatch.value?.mySide === 'p2')
const xqLogicalR = (vr: number) => (flipBoard.value ? 9 - vr : vr)
const xqLogicalC = (vc: number) => (flipBoard.value ? 8 - vc : vc)
const chessLogicalR = (vr: number) => (flipBoard.value ? 7 - vr : vr)
const chessLogicalC = (vc: number) => (flipBoard.value ? 7 - vc : vc)

const xqLegalTargets = computed<XiangqiPos[]>(() => {
  if (!xqBoard.value || !selectedPos.value || !isMyTurn.value) return []
  return getLegalMovesForPiece(xqBoard.value, selectedPos.value.r, selectedPos.value.c)
})

const chessLegalTargets = computed<ChessMove[]>(() => {
  if (!chessSt.value || !selectedPos.value || !isMyTurn.value) return []
  return getLegalChessMovesForPiece(chessSt.value, selectedPos.value.r, selectedPos.value.c)
})

function isXqLegalTarget(r: number, c: number): boolean {
  return xqLegalTargets.value.some(t => t.r === r && t.c === c)
}

function isChessLegalTarget(r: number, c: number): boolean {
  return chessLegalTargets.value.some(m => m.to.r === r && m.to.c === c)
}

function isLastFromOrTo(r: number, c: number): boolean {
  const lm = activeMatch.value?.lastMove
  if (!lm) return false
  return (lm.from?.r === r && lm.from?.c === c) || (lm.to?.r === r && lm.to?.c === c)
}

function isLastSingle(r: number, c: number): boolean {
  const lm = activeMatch.value?.lastMove
  return Boolean(lm && lm.r === r && lm.c === c)
}

function isCaroWinCell(r: number, c: number): boolean {
  const line = activeMatch.value?.lastMove?.winLine as Array<{ r: number; c: number }> | undefined
  return Boolean(line?.some(p => p.r === r && p.c === c))
}

function applyMatchUpdate(next: PvpMatchView) {
  const prevStatus = activeMatch.value?.status
  const prevMoveCount = activeMatch.value?.moveCount ?? -1
  if (next.serverNow) serverSkewMs.value = next.serverNow - Date.now()
  activeMatch.value = next
  if (next.moveCount !== prevMoveCount) {
    selectedPos.value = null
    if (prevMoveCount >= 0) zenAudio.playWoodenFish?.()
  }
  if (prevStatus !== 'finished' && next.status === 'finished') {
    void wallet.syncServerAccount()
    if (next.winnerSide === next.mySide) zenAudio.playSingingBowl?.()
  }
}

async function loadLobby() {
  if (!wallet.isAuthenticated) return
  try {
    const res = (await $fetch('/api/mc/games/pvp/list')) as {
      activeMatch: PvpMatchView | null
      waitingMatches: PvpMatchView[]
      recentMatches: PvpMatchView[]
    }
    waitingMatches.value = res.waitingMatches || []
    recentMatches.value = res.recentMatches || []
    if (res.activeMatch) {
      applyMatchUpdate(res.activeMatch)
    }
  } catch { /* bỏ qua lỗi mạng tạm thời */ }
}

async function refreshActiveMatch() {
  const m = activeMatch.value
  if (!m || m.status === 'finished' || m.status === 'cancelled') return
  try {
    const res = (await $fetch(`/api/mc/games/pvp/state?matchId=${encodeURIComponent(m.matchId)}`)) as { match: PvpMatchView }
    if (res?.match) applyMatchUpdate(res.match)
  } catch { /* giữ trạng thái cũ */ }
}

async function handleCreateMatch() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const res = (await $fetch('/api/mc/games/pvp/create', {
      method: 'POST',
      body: { gameId: selectedGame.value, wagerMc: selectedWager.value }
    })) as { match: PvpMatchView }
    if (res?.match) applyMatchUpdate(res.match)
    await wallet.syncServerAccount()
  } catch (e: any) {
    errorMsg.value = extractErr(e, 'Không thể tạo bàn đấu PvP.')
  } finally {
    busy.value = false
  }
}

async function handleJoinMatch(matchId: string) {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const res = (await $fetch('/api/mc/games/pvp/join', {
      method: 'POST',
      body: { matchId }
    })) as { match: PvpMatchView }
    if (res?.match) applyMatchUpdate(res.match)
    await wallet.syncServerAccount()
  } catch (e: any) {
    errorMsg.value = extractErr(e, 'Không thể tham gia bàn này.')
  } finally {
    busy.value = false
  }
}

async function handleJoinByCode() {
  const code = joinCodeInput.value.trim().toUpperCase()
  if (!code || busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const res = (await $fetch('/api/mc/games/pvp/join', {
      method: 'POST',
      body: { roomCode: code }
    })) as { match: PvpMatchView }
    joinCodeInput.value = ''
    if (res?.match) applyMatchUpdate(res.match)
    await wallet.syncServerAccount()
  } catch (e: any) {
    errorMsg.value = extractErr(e, 'Không tìm thấy phòng với mã này.')
  } finally {
    busy.value = false
  }
}

async function handleCancelMatch() {
  if (!activeMatch.value || busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    await $fetch('/api/mc/games/pvp/cancel', {
      method: 'POST',
      body: { matchId: activeMatch.value.matchId }
    })
    activeMatch.value = null
    selectedPos.value = null
    await Promise.all([wallet.syncServerAccount(), loadLobby()])
  } catch (e: any) {
    errorMsg.value = extractErr(e, 'Không thể hủy bàn.')
  } finally {
    busy.value = false
  }
}

async function sendMove(move: Record<string, unknown>) {
  if (!activeMatch.value || busy.value || !isMyTurn.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const res = (await $fetch('/api/mc/games/pvp/move', {
      method: 'POST',
      body: { matchId: activeMatch.value.matchId, move }
    })) as { match: PvpMatchView }
    selectedPos.value = null
    if (res?.match) applyMatchUpdate(res.match)
  } catch (e: any) {
    errorMsg.value = extractErr(e, 'Nước đi không hợp lệ.')
  } finally {
    busy.value = false
  }
}

async function handleAction(action: 'resign' | 'offer_draw' | 'accept_draw' | 'reject_draw' | 'claim_timeout') {
  if (!activeMatch.value || busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const res = (await $fetch('/api/mc/games/pvp/action', {
      method: 'POST',
      body: { matchId: activeMatch.value.matchId, action }
    })) as { match: PvpMatchView }
    if (res?.match) applyMatchUpdate(res.match)
  } catch (e: any) {
    errorMsg.value = extractErr(e, 'Không thể thực hiện thao tác.')
  } finally {
    busy.value = false
  }
}

function onXqClick(r: number, c: number) {
  if (!isMyTurn.value || !xqBoard.value) return
  const myColor = activeMatch.value?.mySide === 'p1' ? 'red' : 'black'
  const clicked = xqBoard.value[r]?.[c]
  if (selectedPos.value && isXqLegalTarget(r, c)) {
    void sendMove({ from: selectedPos.value, to: { r, c } })
    return
  }
  if (clicked && clicked.side === myColor) {
    selectedPos.value = { r, c }
  } else {
    selectedPos.value = null
  }
}

function onChessClick(r: number, c: number) {
  if (!isMyTurn.value || !chessSt.value) return
  const myColor = activeMatch.value?.mySide === 'p1' ? 'w' : 'b'
  const clicked = chessSt.value.board[r]?.[c]
  if (selectedPos.value && isChessLegalTarget(r, c)) {
    void sendMove({ from: selectedPos.value, to: { r, c }, promote: 'Q' })
    return
  }
  if (clicked && clicked.side === myColor) {
    selectedPos.value = { r, c }
  } else {
    selectedPos.value = null
  }
}

function onCaroClick(r: number, c: number) {
  if (!isMyTurn.value || !caroBoard.value) return
  if (caroBoard.value[r]?.[c] !== null) return
  void sendMove({ r, c })
}

function onGoClick(r: number, c: number) {
  if (!isMyTurn.value || !goSt.value) return
  if (goSt.value.board[r]?.[c] !== null) return
  void sendMove({ r, c })
}

function onGoPass() {
  if (!isMyTurn.value) return
  void sendMove({ pass: true })
}

function leaveFinishedMatch() {
  activeMatch.value = null
  selectedPos.value = null
  void loadLobby()
}

async function copyRoomCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = true
    setTimeout(() => { copiedCode.value = false }, 1500)
  } catch { /* bỏ qua */ }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (activeMatch.value && (activeMatch.value.status === 'waiting' || activeMatch.value.status === 'playing')) {
      void refreshActiveMatch()
    } else if (!activeMatch.value) {
      void loadLobby()
    }
  }, activeMatch.value ? 1200 : 4000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

watch(() => activeMatch.value?.status, () => {
  startPolling()
})

onMounted(() => {
  void loadLobby()
  startPolling()
  clockTimer = setInterval(() => { nowTick.value = Date.now() }, 500)
})

onBeforeUnmount(() => {
  stopPolling()
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
})
</script>
