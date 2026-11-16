# Kế Hoạch Triển Khai Hệ Thống Thẻ Bài Di Sản Cổ Tự & Kinh Doanh Gacha (Heritage Cards & Monetization)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh hệ thống Thẻ Bài Di Sản & Triết Lý Cổ Tự tích hợp mô hình kinh doanh Gacha Pack (Hộp Mù), bể hút tiêu thụ Merit Coin (MC Sink), phòng trưng bày di sản 3D tương tác xoay 360 độ kèm audio thuyết minh song ngữ, và hạ tầng sẵn sàng đúc NFT On-Chain Cardano (CIP-68 / CIP-25).

**Architecture:** Mở rộng cơ sở dữ liệu SQLite (`card_inventory`, `card_packs`), xây dựng API Backend trừ MC kèm xác thực Hydra L2 Head, cấu trúc lại Pinia store `stores/cards.ts`, và thiết kế UI Drawer Binance Dark chuyên nghiệp với hiệu ứng mở thẻ lấp lánh (Card Reveal) cùng bộ lọc quốc gia / độ hiếm chuẩn mực.

**Tech Stack:** Nuxt 3, Vue 3, Pinia, SQLite (`node:sqlite`), Hydra L2 Head Notary, Tailwind CSS, Three.js 3D canvas, KaTeX/Audio.

## Global Constraints
- Tuân thủ nghiêm ngặt Design System Binance Dark (`DESIGN.md`): Background `#0b0e11`, Card `#1e2329`, Border `#2b3139`, Vàng chủ đạo `#fcd535`, font numbers Roboto Mono / DIN.
- Không sử dụng font size < 12px (`scripts/verify-ui-primitives.mjs` kiểm tra 0 vi phạm).
- 100% các giao dịch trừ MC mở thẻ phải có bản ghi `mc_ledger` và bằng chứng giao dịch Hydra L2 Head (`hydra_status = snapshot_confirmed`).
- Không phá vỡ luồng chơi khi người dùng ở chế độ vãng lai (Guest Mode - chưa kết nối ví CIP-30).

---

### Task 1: Thiết Kế Dữ Liệu Catalog Thẻ Bài & Tỷ Lệ Gacha (Data Layer)

**Files:**
- Create: `data/cards/catalog.json`
- Create: `server/utils/cards/catalog.ts`
- Test: `scripts/cards/test-gacha-probability.mjs`

**Interfaces:**
- Consumes: Cấu trúc `CardRarity` ('common' | 'rare' | 'epic' | 'legendary'), `CardCategory` ('wisdom' | 'architecture').
- Produces: `getCardsCatalog()`, `getCardPacks()`, `rollCardGacha(packId: string)` trả về thẻ trúng thưởng theo tỷ lệ RNG chuẩn xác.

- [x] **Step 1: Tạo tệp dữ liệu `data/cards/catalog.json`**
  Định nghĩa danh mục tối thiểu 16 thẻ bài di sản:
  - 4 quốc gia: Việt Nam (Chùa Một Cột, Yên Tử, Chùa Keo), Nhật Bản (Kinkaku-ji, Todai-ji), Thái Lan (Wat Phra Kaew, Wat Arun), Hàn Quốc (Bulguksa, Haeinsa).
  - 4 bậc hiếm: Thường (Common: 60%), Tinh Tấn (Rare: 25%), Giác Ngộ (Epic: 12%), Chân Như (Legendary: 3%).
  - Định nghĩa 3 gói thẻ Gacha:
    - *Gói Duyên Khởi (1 thẻ):* 500 MC
    - *Gói Ngũ Uẩn (5 thẻ - bảo hiểm ít nhất 1 thẻ Rare+):* 2.200 MC (giảm 12%)
    - *Gói Bát Nhã Hoàng Kim (10 thẻ - bảo hiểm 1 thẻ Epic+):* 4.500 MC (giảm 10%)

- [x] **Step 2: Viết hàm dịch vụ `server/utils/cards/catalog.ts`**
  Cung cấp các hàm load catalog, kiểm tra ID thẻ, và thuật toán Weighted Random Generator cho tỷ lệ mở gói đảm bảo tính ngẫu nhiên minh bạch.

- [x] **Step 3: Viết test xác minh phân phối xác suất Gacha**
  Chạy mô phỏng 10.000 lượt roll gacha, kiểm tra độ lệch chuẩn của tỷ lệ Common/Rare/Epic/Legendary nằm trong sai số cho phép ($\pm 2\%$).

---

### Task 2: Schema CSDL SQLite & Bút Toán Sổ Cái MC (Backend Layer)

**Files:**
- Modify: `server/db/migrations.ts` (Migration 9: `card_inventory` và `card_pack_openings`)
- Modify: `server/utils/wallet/mcService.ts`
- Create: `server/api/mc/cards/pack-buy.post.ts`
- Create: `server/api/mc/cards/inventory.get.ts`
- Test: `scripts/wallet/test-cards-monetization.mjs`

**Interfaces:**
- Consumes: `withTransaction`, `getDb`, `recordLedgerDebit`, `submitHydraL2Transaction`.
- Produces: API `POST /api/mc/cards/pack-buy` với body `{ packId, requestId }`, trả về danh sách thẻ nhận được, số dư MC mới, và Hydra L2 proof.

- [x] **Step 1: Thêm bảng `card_inventory` vào migrations**
  ```sql
  CREATE TABLE IF NOT EXISTS card_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    card_id TEXT NOT NULL,
    rarity TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    is_nft_minted INTEGER DEFAULT 0,
    nft_asset_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_card_inv_acc ON card_inventory(account_id);
  ```

- [x] **Step 2: Xây dựng hàm `buyAndOpenCardPack` trong `mcService.ts`**
  - Kiểm tra số dư tài khoản $MC \ge \text{packCost}$.
  - Trừ MC trong transaction SQLite với lý do `card_pack_purchase`.
  - Ghi nhận các thẻ trúng thưởng vào bảng `card_inventory`.
  - Đẩy bút toán lên Hydra L2 Head để sinh `hydra_tx_hash` và `snapshot_no`.

- [x] **Step 3: Viết Route API `server/api/mc/cards/pack-buy.post.ts` & `inventory.get.ts`**
  Bảo vệ bằng session token CIP-8, chống spam và đảm bảo tính idempotent dựa trên `clientRequestId`.

- [x] **Step 4: Kiểm thử quy trình trừ tiền và hoàn tiền khi lỗi**
  Đảm bảo nếu lỗi xảy ra giữa chừng, toàn bộ transaction SQLite được rollback và không mất MC của người chơi.

---

### Task 3: Nâng Cấp Pinia Store `stores/cards.ts` & Đồng Bộ Hóa

**Files:**
- Modify: `stores/cards.ts`
- Modify: `stores/economy.ts`

**Interfaces:**
- Consumes: API `/api/mc/cards/pack-buy`, `/api/mc/cards/inventory` và `useEconomyStore()`.
- Produces: `cardsStore.openPack(packId)`, `cardsStore.ownedCardIds`, `cardsStore.filterCountry`, `cardsStore.filterRarity`, `cardsStore.collectionStats`.

- [x] **Step 1: Cập nhật state và getters trong `stores/cards.ts`**
  - Quản lý danh sách thẻ đã sở hữu từ backend (`userInventory`).
  - Getter tính toán tiến độ hoàn thành bộ sưu tập theo từng quốc gia (Việt Nam, Nhật Bản, Thái Lan, Hàn Quốc).
  - Hỗ trợ lưu trữ tạm thời vào `localStorage` (`van_canh_offline_cards_v1`) khi người chơi chưa đăng nhập ví.

- [x] **Step 2: Tích hợp hàm `openPack` gọi API và đồng bộ số dư**
  Sau khi mở thẻ thành công, cập nhật ngay lập tức `economy.meritCoins` và danh mục thẻ sở hữu.

---

### Task 4: Thiết Kế UI Mở Thẻ Gacha & Hiệu Ứng Lật Thẻ (Frontend UX)

**Files:**
- Create: `components/cards/CardPackCard.vue`
- Create: `components/cards/CardRevealModal.vue`
- Modify: `components/SanctuaryDrawer.vue` (khu vực tab `cards`)

**Interfaces:**
- Consumes: `cardsStore`, `economyStore`, Binance Dark UI Primitives (`UiButton`, `UiBadge`, `UiTabs`).
- Produces: Giao diện mở hộp mù sống động, hiệu ứng ánh sáng hào quang vàng theo độ hiếm thẻ (Gold/Purple/Blue).

- [x] **Step 1: Xây dựng danh sách gói thẻ `CardPackCard.vue`**
  Hiển thị 3 loại hộp thẻ với giá MC, huy hiệu giảm giá, thông tin bảo hiểm tỷ lệ ra thẻ hiếm và nút *Mở Thẻ*.

- [x] **Step 2: Tạo Modal lật thẻ tương tác `CardRevealModal.vue`**
  - Hiệu ứng úp thẻ ban đầu, bấm vào từng thẻ để lật (Flip animation $180^\circ$).
  - Viền phát sáng đổi màu theo bậc hiếm: Trắng (Common) $\rightarrow$ Xanh dương (Rare) $\rightarrow$ Tím (Epic) $\rightarrow$ Vàng Binance (Legendary).
  - Nút *Lật tất cả* và nút *Nhận & Cất Vào Kho* trang nhã.

- [x] **Step 3: Tích hợp âm thanh thiền định & chuông xoay**
  Khi mở trúng thẻ Legendary/Epic: Kích hoạt âm thanh chuông đại hồng chung ngân vang trầm hùng.

---

### Task 5: Phòng Trưng Bày Di Sản 3D & Thuyết Minh Audio (Digital Heritage)

**Files:**
- Create: `components/cards/CardGalleryView.vue`
- Create: `components/cards/CardDetailViewer.vue`
- Modify: `components/SanctuaryDrawer.vue`

**Interfaces:**
- Consumes: Thuyết minh audio, bài học chánh niệm song ngữ, tạo hình nền điện thoại 4K canvas.
- Produces: Trải nghiệm xem chi tiết 2 mặt thẻ di sản và đọc kinh kệ, tích hợp nút "Đúc NFT CIP-68".

- [x] **Step 1: Bộ lọc chuyên sâu danh mục thẻ**
  Cho phép lọc thẻ theo: Tất cả / Quốc gia (VN, JP, TH, KR) / Độ hiếm (Thường, Tinh Tấn, Giác Ngộ, Chân Như) / Đã sở hữu / Chưa mở.

- [x] **Step 2: Khung xem thẻ tương tác `CardDetailViewer.vue`**
  - Mặt trước: Triết lý chánh niệm và điển tích cổ tự.
  - Mặt sau: Đoạn kinh kệ văn tự, bài học chánh niệm và nút nghe đọc thuyết minh di tích.
  - Nút hành động: *Tải hình nền điện thoại PNG 4K* và *Đúc NFT CIP-68 (Cardano Preprod)*.

---

### Task 6: Kiểm Thử Toàn Diện & Tích Hợp Hệ Thống

**Files:**
- Test: `scripts/cards/test-gacha-probability.mjs`
- Test: `scripts/verify-ui-primitives.mjs`

- [x] **Step 1: Chạy test kịch bản kinh tế (MC Gacha Loop)**
  - Tỷ lệ Common/Rare/Epic/Legendary chuẩn xác (60%/25%/12%/3%).
  - Kiểm tra bảo hiểm gói Ngũ Uẩn (100% ra Rare+) và Bát Nhã (100% ra Epic+).
  - Cơ chế idempotency và rollback số dư an toàn.

- [x] **Step 2: Kiểm tra UI Primitives & Responsive**
  Chạy `node scripts/verify-ui-primitives.mjs` đảm bảo 100% tuân thủ: 0 font < 12px, không vỡ layout trên mobile màn hình nhỏ (38 files scanned, 0 vi phạm).

- [x] **Step 3: Chạy Nuxt Build**
  Chạy `npm run build` để kiểm tra compile không phát sinh lỗi types hay SSR (Exit code 0).
