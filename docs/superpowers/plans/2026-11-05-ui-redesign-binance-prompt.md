# Prompt: Làm lại giao diện toàn bộ theo `DESIGN-binance.md`

Copy toàn bộ phần trong khung dưới đây gửi cho AI/agent code.

---

## VAI TRÒ

Bạn là senior product designer kiêm frontend engineer (Nuxt 3 + Vue 3 + Pinia). Nhiệm vụ: **làm lại toàn bộ lớp hiển thị** của dự án `hydra-pagoda` theo hệ thiết kế trong `DESIGN-binance.md` (ở thư mục gốc). Đọc file đó hết trước khi làm. Đây là nguồn sự thật duy nhất về màu, font, bo góc, khoảng cách, nút, input, thẻ, bảng, badge.

Mục tiêu cuối: nhìn vào giao diện, người dùng thấy một sản phẩm tài chính/giao dịch dày đặc thông tin, tiết chế, có kỷ luật — **không có cảm giác "AI tự sinh"**.

## PHẠM VI (làm hết, không bỏ sót)

1. Tokens & CSS nền
   - `assets/css/tokens.css`, `assets/css/main.css`: viết lại token theo Binance (canvas `#0b0e11`, card `#1e2329`, elevated `#2b3139`, hairline `#2b3139`, chữ chính `#eaecef`, chữ phụ `#707a8a`/`#929aa5`, accent duy nhất vàng `#fcd535` — active `#f0b90b`, disabled `#3a3a1f`, chữ trên nền vàng `#181a20`).
   - Giữ tên token cũ đang được dùng (`--success`, `--success-soft`, `--text-secondary`, `--surface-elevated-dark`, `ui-font-mono`, `ui-focus-ring`, `font-numbers`, `bg-surface-card`, `border-hairline`, `text-secondary`, `text-up`) bằng cách đổi **giá trị**, không đổi tên, để không vỡ component. Nếu cần token mới thì thêm, rồi dọn token chết.
2. Primitives `components/ui/*`: `UiBadge, UiButton, UiCard, UiChip, UiDataRow, UiInput, UiKeycap, UiModal, UiSelectableCard, UiStatCell, UiTabs, UiTooltip, ZenIcon`.
3. Components: `CardCollectionModal, DisclaimerBanner, EmoteWheel, FortuneModal, HydraBadge, MeditationModal, MeritBoxModal, OnlinePilgrimsModal, SanctuaryDrawer, SanctuaryShop, SoundscapeMixer, TempleCanvas (chỉ phần HUD/overlay 2D, không đụng cảnh 3D), WalletConnectModal, ZenChatDrawer`.
4. Pages: `pages/index.vue`, `pages/dev/design-system.vue` (cập nhật làm trang mẫu cho hệ mới), `pages/dev/avatar.vue`.

## QUY TẮC THIẾT KẾ (bắt buộc)

**Màu**
- Nền tối là mặc định. Một accent duy nhất: vàng `#fcd535`. Dùng cho CTA chính, trạng thái đang chọn, con số cần nhấn. Mỗi màn hình tối đa 1–2 chỗ vàng nổi bật.
- Xanh `#0ecb81` / đỏ `#f6465d` chỉ dành cho **số tăng/giảm** (ví dụ +MC / −MC) ở dạng chữ hoặc badge nhỏ. Không tô nền thẻ, không dùng làm màu "thành công/lỗi" chung. Thành công/lỗi dùng chữ + icon + viền hairline, trạng thái thông tin dùng xanh dương `#3b82f6`.
- Ring focus: `0 0 0 2px` xanh dương 50% alpha.
- Tuyệt đối không: gradient màu, glow, glassmorphism/blur kính, aurora, tím/neon, bóng đổ màu.

**Chữ**
- Font: Inter cho UI, IBM Plex Sans hoặc JetBrains Mono cho **mọi con số** (số dư MC, giá, tỉ lệ, thời gian). Đặt qua class `font-numbers` / `ui-font-mono`, có `tabular-nums`.
- Trọng lượng chỉ 500–700. Không dùng 300/400 mỏng cho tiêu đề. Thang cỡ chữ cố định theo file thiết kế, không tự bịa cỡ lẻ.
- Chữ phụ đạt tỉ lệ tương phản ≥ 4.5:1 trên nền tương ứng.

**Hình khối**
- Bo góc: 2/4/6/8/12/pill. Nút 6px, input & thẻ 8px, container lớn 12px. Pill chỉ cho chip/badge nhỏ.
- Phân tầng bằng **màu nền + hairline 1px**, không dùng bóng đổ nặng. Không viền trái/phải màu dày làm điểm nhấn thẻ.
- Khoảng cách theo lưới 4px. Mật độ cao: padding gọn, hàng dữ liệu dạng bảng/`UiDataRow`, căn số bên phải.
- Không bọc mọi thứ trong thẻ bo tròn lồng thẻ. Ưu tiên danh sách phẳng, dòng phân cách hairline.

**Icon & microcopy**
- Chỉ dùng `ZenIcon` với tên trong whitelist hiện có. Không emoji, không ký tự unicode làm icon.
- Giữ tiếng Việt, ngắn, cụ thể, đúng nghiệp vụ ("Nạp MC", "Số dư", "Đã ghi sổ"). Cấm câu sáo rỗng kiểu "Khám phá hành trình tuyệt vời…".

## CHỐNG "VỀ KIỂU AI" (checklist tự soát)

- [ ] Không hero căn giữa với tiêu đề to + phụ đề + 2 nút.
- [ ] Không lưới 3 thẻ giống hệt nhau có icon tròn phía trên.
- [ ] Không gradient chữ, không nền gradient, không glow quanh nút.
- [ ] Không bo góc quá lớn (>12px) trên thẻ/panel, không bóng mờ to.
- [ ] Không đối xứng máy móc: tiêu đề căn trái, số căn phải, có phân cấp thật.
- [ ] Không padding rộng rãi vô nghĩa; dữ liệu phải dày và dễ quét.
- [ ] Không dùng cùng một kiểu thẻ cho mọi thứ; danh sách, bảng, stat cell khác nhau rõ.
- [ ] Không placeholder/lorem, không số liệu giả.

## TRẠNG THÁI BẮT BUỘC CHO MỌI THÀNH PHẦN TƯƠNG TÁC

hover, active, focus-visible (dùng `ui-focus-ring`), disabled (nút vàng disabled = `#3a3a1f`), loading, empty, error. Vùng bấm ≥ 36px desktop, ≥ 44px mobile. Hỗ trợ responsive theo breakpoint trong file thiết kế.

## YÊU CẦU BỔ SUNG (chưa code, chỉ ghi nhận để làm sau)

### A. Modal chuyển thành panel đóng/mở bên phải

- Mọi modal dạng popup giữa màn hình (`CardCollectionModal`, `FortuneModal`, `MeditationModal`, `MeritBoxModal`, `OnlinePilgrimsModal`, `WalletConnectModal`, và các modal khác qua `components/ui/UiModal.vue`) chuyển thành **panel trượt từ mép phải** (side drawer), đóng/mở bằng trạng thái hiện có (`v-model` / prop mở-đóng giữ nguyên).
- Kích thước: rộng `w-full sm:w-[380px] lg:w-[420px]` (tối đa ~440px), cao full chiều cao viewport, không phủ toàn màn hình. Cảnh 3D phía bên trái vẫn nhìn thấy và tương tác được.
- Không dùng backdrop tối che cả màn hình. Nếu cần bắt click ngoài để đóng thì dùng lớp trong suốt, không làm tối cảnh. Trên mobile (< 640px) panel được phép chiếm full chiều rộng.
- Cách làm: sửa **một chỗ** là `UiModal.vue` (đổi thành vỏ panel bên phải) để các modal con tự đổi theo, không sửa từng modal trừ khi layout nội dung bắt buộc.
- Hiệu ứng: trượt ngang 150–200ms (`translate-x`), tôn trọng `prefers-reduced-motion`. Đóng bằng nút X, phím `Esc`, và click ra ngoài panel. Focus trap, trả focus về nút đã mở.
- Chỉ mở một panel phải tại một thời điểm. Mở panel mới thì đóng panel cũ (hoặc thay nội dung), `SanctuaryDrawer` và `ZenChatDrawer` phải dùng chung quy tắc này, không chồng lên nhau.
- **Giữ nguyên toàn bộ chức năng hiện có**: props, emit, store, API, luồng ví, mua đồ, gieo quẻ, cúng dường, thiền, `data-testid`, badge Hydra L2 / SQLite.

### B. Bỏ danh sách chọn quốc gia trên HUD

- Xoá nút chọn quốc gia và popover "Cổ tự 9 quốc gia (Phím 1-9)" ở thanh HUD trên cùng trong `components/TempleCanvas.vue` (gồm `showCountryMenu`, `.hud-country-btn`, `.hud-popover--country` và phần CSS đi kèm).
- Không làm mất tính năng đổi quốc gia: giữ phím tắt `1`–`9`, hàm `handleCountrySelect` và đường đổi quốc gia đang có trong `SanctuaryDrawer` / `SanctuaryShop`. Chỉ bỏ phần giao diện dropdown.
- Dọn các chỗ tham chiếu `showCountryMenu` còn lại (đóng menu bằng `Esc`, `closeAllDropups`, kiểm tra menu đang mở...) để không lỗi.
- Nếu HUD cần hiển thị quốc gia hiện tại thì chỉ là nhãn chữ nhỏ (`VN`), không bấm được.

### C. Dùng Tailwind là chính, hạn chế CSS thuần

- Dự án đã có Tailwind v4 (`@tailwindcss/vite`). Viết lại style bằng **class Tailwind trực tiếp trong template**, thay cho khối `<style scoped>` dài.
- Chỉ giữ CSS thuần cho: khai báo token (`:root` / `@theme` trong `tokens.css`), keyframes, và vài trường hợp Tailwind không làm được (ví dụ overlay đè lên canvas 3D). Mỗi component tối đa vài chục dòng CSS thuần, ưu tiên bằng 0.
- Màu, bo góc, khoảng cách, font lấy từ token khai báo trong `@theme` để dùng như `bg-surface-card`, `border-hairline`, `text-secondary`, `text-up`. Không ghi hex cứng trong class (không `bg-[#1e2329]`).
- Dùng `@apply` rất hạn chế, chỉ cho primitive lặp lại nhiều lần như `ui-focus-ring`. Không tạo thêm lớp tiện ích tự đặt tên nếu Tailwind đã có.

### D. Đồng nhất giao diện dark

- Chỉ một theme: **dark**. Bỏ mọi nhánh light mode, `dark:` variant, biến màu sáng, và các giá trị nền trắng/xám nhạt đang lẫn trong component.
- Toàn bộ component, modal, panel, input, badge, tooltip dùng cùng bộ token tối của `DESIGN-binance.md` (canvas `#0b0e11`, card `#1e2329`, elevated `#2b3139`, chữ `#eaecef`, chữ phụ `#707a8a`). Panel bên phải dùng nền card, không mờ kính.
- Đặt `color-scheme: dark` ở gốc để scrollbar, input, select hiển thị tối.
- Phần "Light-Mode Transactional Components" trong file thiết kế **không áp dụng** ở bản này.

## RÀNG BUỘC KỸ THUẬT (không được phá)

- **Không đổi logic**, store, API, props, emit. Chỉ đổi template/CSS/class.
- Giữ nguyên mọi `data-testid` (ví dụ `hud-ledger-mode`, `hydra-badge`) và hành vi của `HydraBadge`, chỉ báo chế độ Hydra L2 / SQLite trên HUD, badge ở kết quả gieo quẻ / cúng dường / mua đồ / lịch sử.
- Không thêm thư viện UI mới. Không đụng `lib/world3d/*`.
- Font: nếu không có BinanceNova/BinancePlex thì dùng Inter + IBM Plex Sans/JetBrains Mono, khai báo trong `nuxt.config.ts` hoặc `main.css`.

## QUY TRÌNH

1. Đọc `DESIGN-binance.md`, `tokens.css`, `main.css`, các `components/ui/*` hiện tại. Liệt kê token đang dùng.
2. Làm theo thứ tự: tokens → primitives → `pages/dev/design-system.vue` (để xem mẫu) → từng component một (HUD `TempleCanvas` → `SanctuaryDrawer` → các modal → còn lại) → `pages/index.vue`.
3. Sau **mỗi component**: chạy `npm.cmd run build`. Sau mỗi nhóm: chạy `node scripts/verify-ui-primitives.mjs`.
4. Cuối cùng chạy `npm.cmd run wallet:test:hydra` (phải 11/11 PASS) và soát bằng checklist "chống về kiểu AI" ở trên.
5. Quét sót: tìm hex/màu cứng ngoài token (`#[0-9a-fA-F]{3,8}`, `rgba(`, `linear-gradient`, `box-shadow`, `backdrop-filter`) trong `components/`, `pages/` và thay bằng token hoặc xoá nếu vi phạm.
6. Nếu chưa có `PRODUCT.md`/`DESIGN.md` của dự án, tạo bản ngắn mô tả hệ thiết kế đã áp dụng.

## ĐẦU RA

- Danh sách file đã sửa, mỗi file một dòng nói đã đổi gì.
- Danh sách vi phạm còn sót (nếu có) và lý do.
- Kết quả build + test.
- Giải thích bằng tiếng Việt đơn giản, ngắn gọn.

## TIÊU CHÍ NGHIỆM THU

- Toàn bộ UI dùng đúng palette/font/bo góc/khoảng cách của `DESIGN-binance.md`.
- Không còn gradient/glow/glass/emoji-icon/viền cạnh màu.
- Xanh/đỏ chỉ xuất hiện ở số tăng/giảm.
- Mọi số dùng font số, căn thẳng cột.
- Build sạch, test 11/11, `data-testid` nguyên vẹn.
- Mọi modal là panel trượt bên phải, rộng ≤ 440px trên desktop, không che kín cảnh 3D, không có backdrop tối.
- Không còn dropdown chọn quốc gia trên HUD; phím `1`–`9` và đổi quốc gia trong Drawer/Shop vẫn hoạt động.
- Phần lớn style nằm trong class Tailwind; `<style scoped>` gần như không còn.
- Không còn nhánh light mode hay màu sáng nào trong UI.
- Mọi chức năng hiện có (ví, nạp MC, cửa hàng, bói quẻ, cúng dường, thiền, chat, emote, âm thanh) hoạt động như cũ.

---
