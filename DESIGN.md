# Hydra Pagoda: Hệ thiết kế "Sơn mài và vàng thếp"

## 1. Định hướng
Giao diện là một tấm gỗ sơn mài tối trong gian chính điện: nền nâu đen, chữ màu giấy dó, viền chỉ vàng thếp mảnh. Một con dấu son duy nhất cho hành động chính. Không kính mờ, không bóng phát sáng, không đổ màu.
- **Nền:** nâu đen `#100e0c`, mặt thẻ `#1a1714`, mặt nâng `#26221d`, viền chỉ `#332d26`, viền đậm `#4a4237`.
- **Vàng thếp** `#c9a24b` (hover `#b58f3a`, vô hiệu `#3a3320`): chữ nhấn, viền, trạng thái đang chọn, thanh tiến độ. Không dùng làm nền nút lớn.
- **Son ấn** `#b8372b` (hover `#9e2d22`, vô hiệu `#4a2622`, chữ kem `#f6ecd8`): chỉ cho nút hành động chính `UiButton variant="primary"`, mỗi màn một nút.
- **Xanh và đỏ giao dịch** (`#0ecb81`, `#f6465d`): chỉ dành cho số liệu tăng giảm và trạng thái. Không làm nền thẻ. Son ấn khác đỏ giao dịch ở chỗ son là nền nút còn đỏ giao dịch chỉ là chữ.
- **Hình khối:** chỉ có hai kiểu góc, vuông 2px cho mọi khối và tròn hẳn cho vật tròn. Chỉ một cấp bóng (`shadow-2xl`) cho lớp nổi như drawer và popover, các cấp bóng khác tắt trong `main.css`.
- **Ngăn kéo bên phải:** mọi hộp thoại và bảng trượt từ phải sang (`max-w-[440px]`, cao toàn màn hình, nền trong suốt không làm mờ), để cảnh 3D vẫn nhìn và thao tác được.

---

## 2. Bảng màu và token

| Token | Giá trị | Vai trò | Tương phản (đã tính) |
| :--- | :--- | :--- | :--- |
| `canvas-dark` | `#100e0c` | Nền gốc | |
| `surface-card` | `#1a1714` | Thẻ, drawer, popover | |
| `surface-elevated` | `#26221d` | Hover, đầu bảng, thẻ nâng | |
| `hairline` | `#332d26` | Viền 1px, đường phân cách | |
| `border-strong` | `#4a4237` | Viền khi hover | |
| `text-primary` | `#ede4d3` | Chữ chính | 14,14:1 trên thẻ |
| `text-secondary` | `#a89c88` | Chữ phụ | 6,61:1 trên thẻ, 5,85:1 trên mặt nâng |
| `text-muted` | `#968b79` | Chú thích | 5,33:1 trên thẻ, 4,71:1 trên mặt nâng |
| `gold` / `primary` | `#c9a24b` | Nhấn, viền chọn | 7,44:1 trên thẻ |
| `seal` | `#b8372b` | Nền nút chính | chữ kem 4,95:1 |
| `trading-up` | `#0ecb81` | Số tăng, giao dịch thành công | 8,40:1 trên thẻ |
| `trading-down` | `#f6465d` | Số giảm, viền lỗi | 5,06:1 trên thẻ |

Lưu ý: viền `hairline` chỉ đạt 1,31:1 so với thẻ, đúng ý đồ là đường chỉ mảnh. Mọi điều khiển tương tác phải có thêm nhận diện thứ hai (nền, chữ hoặc vòng focus vàng thếp), không dựa vào viền hairline.

---

## 3. Chữ và số
- **Tiêu đề drawer, modal, tên màn:** dùng chung `Be Vietnam Pro` đậm (`font-bold`), không dùng font serif. Class `ui-font-serif` và `Noto Serif Display` đã bỏ, script `verify-ui-primitives.mjs` chặn không cho quay lại. Cinzel và Playfair Display cũng đã bỏ vì không có subset vietnamese.
- **Thân chữ:** `Be Vietnam Pro` 400/500/600/700, thiết kế cho tiếng Việt.
- **Ngoại lệ:** `Noto Serif` chỉ còn dùng để vẽ ảnh chia sẻ quẻ và bảng gỗ trong cảnh 3D (canvas), không dùng trong giao diện HTML.
- **Số và mã băm:** `IBM Plex Sans` với `tabular-nums lining-nums`, class `font-numbers`.
- **Cỡ chữ tối thiểu 12px.** `html` đặt 14px nên 1rem là 14px. Kiểm tra bằng `scripts/verify-ui-primitives.mjs`.
- **Biểu tượng:** dùng `ZenIcon`, không dùng emoji hay ký tự dingbat.

---

## 4. Right-Sliding Drawer Panels
- All dialogs (`UiModal`, `SanctuaryDrawer`, `WalletConnectModal`, `ZenChatDrawer`, `FortuneModal`, `MeditationModal`, `MeritBoxModal`, `SoundscapeMixer`, `CardCollectionModal`, `SanctuaryShop`, `DisclaimerBanner`, `EmoteWheel`) share the unified right drawer architecture.
- **Geometry:** `w-full sm:w-[380px] lg:w-[420px] max-w-[440px]`, full viewport height (`h-full top-0 right-0`).
- **Backdrop:** Transparent or subtle non-dimming overlay so pilgrims can see and interact with the 3D temple canvas simultaneously.
- **Focus & Keyboard:** Escape key dismisses open panel, restores focus to trigger element. Only one right drawer panel open at a time.

---

## 5. UI Primitives Inventory (`components/ui/*`)

1. **`UiButton.vue`:**
   - `variant="primary"`: ấn son `#b8372b`, chữ kem `#f6ecd8`, hover `#9e2d22`, vô hiệu `#4a2622`.
   - `variant="secondary"`: mặt thẻ `#1a1714`, chữ `#ede4d3`, viền hairline.
   - `variant="ghost"`: nền trong suốt, hover mặt thẻ `#1a1714`.
   - `variant="danger"`: Red `#f6465d` text/border.
   - `size="sm"` (28px), `size="md"` (40px), `size="lg"` (48px).
2. **`UiCard.vue`:**
   - Mặt `#1a1714`, viền `#332d26`, góc 2px.
3. **`UiSelectableCard.vue`:**
   - Interactive selection card with gold-leaf active border and check indicator.
4. **`UiBadge.vue`:**
   - Compact status pills (`gold`, `trading-up`, `trading-down`, `info`, `neutral`).
5. **`UiChip.vue`:**
   - Filter chips and toggles with tabular counts and indicator dots.
6. **`UiInput.vue`:**
   - Cao 40px, mặt thẻ `#1a1714`, vòng focus vàng thếp `#c9a24b`, trạng thái lỗi đỏ.
7. **`UiKeycap.vue`:**
   - Flat dark keyboard shortcut indicator with `font-numbers`.
8. **`UiStatCell.vue`:**
   - Key-value metric displays with tabular numbers and semantic coloration.
9. **`UiTabs.vue`:**
   - Underline (đường chọn 2px vàng thếp) and Segmented tab variants.
10. **`UiModal.vue`:**
    - Standardized right-sliding drawer panel container.
11. **`ZenIcon.vue`:**
    - Clean inline SVG vector icons.

---

## 6. Verification & Quality Gates
- **Primitive Rules Enforcement:** `node scripts/verify-ui-primitives.mjs` scans all components and pages for 0 banned symbols and 0 fonts < 12px.
- **Build Verification:** `npm run build` compiles client and nitro server with code 0.
- **Hydra L2 Test Suite:** `npm run wallet:test:hydra` tests simulated and real head transactions.

