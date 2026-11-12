# Đánh giá và sửa lỗi giao diện (Giai đoạn 2)

Phạm vi thật của lượt này nhỏ hơn yêu cầu trong prompt. Tôi chỉ duyệt HUD ở cả ba cỡ (375, 768, 1440 px), ba menu xổ lên ở thanh dưới, và drawer Bói Quẻ (tab đầu, form hồ sơ Bát Tự) ở 375 và 1440 px. Chưa duyệt: Shop, Hòm công đức, Tơ Duyên, Hầu Đồng, Thẻ bài (gallery, mở gói, chi tiết), Thiền, Âm cảnh, Đồng Tu, Trụ Trì chat, modal ví, bảng phím tắt, minimap mở rộng, kết quả bói quẻ. Mục "Còn lại" liệt kê những phần đó.

Ảnh chụp nằm trong `docs/ra_soat/anh/`, đặt tên theo `{độ rộng}_{số}_{màn}.png`. Chụp bằng Chrome headless với WebGL phần mềm (swiftshader), nên không dùng được để đánh giá FPS hay độ mượt. Số đo vùng bấm, tràn ngang và cỡ chữ lấy từ DOM (`getBoundingClientRect`, `getComputedStyle`), không chỉ nhìn ảnh. Trong ảnh 375 px có một chip trắng "1.9 s" đè lên nút giữa của thanh dưới, đó là badge của Nuxt DevTools ở chế độ dev, không phải lỗi của game.

## Phát hiện và kết quả

| # | Mức | Lỗi | Trạng thái |
|---|---|---|---|
| 1 | Nghiêm trọng | Ở 375 px thanh trên và thanh dưới tràn ra ngoài màn hình. Tám nút nằm ngoài mép phải, trong đó ba nút điều hướng chính (Bói Quẻ, Thiền, Di Sản) bị cắt. Ở 768 px ba nút đó cũng tràn. | Đã sửa |
| 2 | Nghiêm trọng | `text-xs` hiển thị 10.5 px và `text-sm` hiển thị 11.4 px, dưới sàn 12 px của `DESIGN.md`. Nguyên nhân: `html` đặt `font-size` 14 px nên `0.75rem` ra 10.5 px. `verify-ui-primitives.mjs` không bắt được vì chỉ tìm chuỗi `text-[11px]` trong mã nguồn, không đo cỡ chữ thật. | Đã sửa cho `text-xs` (12 px) và `text-sm` (13 px), đo lại trong trình duyệt. Xem ghi chú bên dưới |
| 3 | Trung bình | Vùng bấm dưới 40 px ở drawer 375 px: 18 phần tử (chip MC 32 px, nút đóng 32 px, mười tab 36 px, nút chọn giới tính và ô chọn giờ sinh 35 px, nút dẫn đường 28 px). | Đã sửa. Còn 1 ô nhập ngày sinh cao 32 px ở tab Tơ Duyên, đã đổi sang 40 px ở lượt cuối |
| 4 | Nhẹ | Popup menu xổ lên ở 375 px dùng bề rộng cố định 320 px, dễ tràn mép khi nút nằm sát cạnh. | Đã sửa: popup bám theo cả dock, kéo giãn hết bề rộng |
| 5 | Nhẹ | Nút "Dừng bước" dùng `UiButton variant="danger"`, biến thể này không tồn tại. | Đã đổi sang `secondary` ở lượt typecheck |
| 6 | Trung bình | Modal ví và popup HUD ở 375 px: nút đóng 25 đến 28 px, link "Cài Đặt" 28 px, sáu nút dẫn đường trong Sơ đồ Thiền Tự 28 px, nút "Dừng bước" 24 px. | Đã sửa, đo lại 0 phần tử dưới 40 px trừ mục "Nhà phát triển" (xem Còn lại) |
| 7 | Trung bình | Nhãn chữ trong SVG Sơ đồ Thiền Tự cỡ 7.5 đến 9.5 px (đo DOM: 8 đến 9.5 px). Script kiểm tra cỡ chữ không quét SVG nên bỏ sót. | Đã đổi tất cả sang 12 px, đã dời vị trí vài nhãn cho khỏi đè nhau |

## Số đo trước và sau

| Màn | Chỉ số | Trước | Sau |
|---|---|---|---|
| HUD 375 px | Nút nằm ngoài mép phải | 8 | 0 |
| HUD 375 px | Vùng bấm dưới 40 px | 3 | 0 |
| HUD 768 px | Nút nằm ngoài mép phải | 3 | 0 |
| HUD 768 px | Vùng bấm dưới 40 px | 5 | 0 |
| Drawer, 9 tab, 375 px | Vùng bấm dưới 40 px (không tính ô nhập đã nằm trong hộp 40 px) | 18 ở tab Bói Quẻ | 0 ở cả 9 tab, trừ ô ngày sinh đã sửa sau đó (chưa đo lại) |
| Drawer, 9 tab, 375 px | Tràn phải, cuộn ngang trang | không đo | 0 |
| Modal ví 375 px | Vùng bấm dưới 40 px | 2 | 0 |
| Sơ đồ Thiền Tự 375 px | Vùng bấm dưới 40 px, chữ dưới 12 px | 7 và 5 | 0 và 0 |
| HUD 1440 px | Vùng bấm dưới 40 px | 6 | 6 (không sửa) |
| HUD 375, 768, 1440 px | Mục chữ dưới 12 px (đo DOM) | 8 mục ở 1440 px | 0 ở cả ba cỡ |

Tràn ngang trang (`scrollWidth - innerWidth`) luôn bằng 0 ở cả ba cỡ, trước và sau. Các số "sau" của HUD và menu lấy từ lần chạy sau khi sửa. Số "sau" của drawer lấy từ lần chạy cuối cùng, sau khi sửa vùng bấm.

## Cách sửa HUD ở màn nhỏ

Từ 1023 px trở xuống (`@media (max-width: 1023px)` trong `TempleCanvas.vue`):

- Ẩn: tên thương hiệu và tên người chơi, nhãn quốc gia, nút giới tính, ô "Ngày Tu", nhãn "TESTNET", chỉ báo chế độ sổ cái, chữ "Đồng Tu", cụm phím tắt, chỉ báo ALT, các nhãn phím số trong nút điều hướng.
- Giữ: số dư MC kèm nút Nạp, ví, đổi hiển thị, âm thanh, số đồng tu, bản đồ.
- Nút ví và nút "Hiển thị" chuyển thành chỉ có icon (có `aria-label`). Thêm hai icon `wallet` và `profile` vào `ZenIcon`, dùng `sun` cho nút hiển thị.
- Thanh dưới: ba nút điều hướng chiếm một hàng riêng, chia đều, cao tối thiểu 44 px, chữ được xuống dòng.

Đánh đổi: ở màn nhỏ người chơi không còn thấy ngay tên mình, tình trạng Hydra L2 và nhãn mạng thử nghiệm. Đây là quyết định của tôi để HUD vừa màn hình, tôi chưa hỏi bạn. Nếu muốn giữ lại thông tin nào, cần chọn ra.

## Đã đổi trong mã

- `assets/css/tokens.css`: `--text-body-sm` 13 px và `--text-caption` 12 px (trước là `rem`).
- `components/TempleCanvas.vue`: các lớp `hud-hide-sm`, `hud-show-sm`, `hud-dock`, `hud-bottom` và khối media query.
- `components/ui/UiTabs.vue`: tab cao tối thiểu 40 px (trước 36 px), nút cuộn rộng 40 px (trước 24 px).
- `components/SanctuaryDrawer.vue`: chip MC và nút đóng 40 px, ba nút trong form hồ sơ `h-[40px]`, nút dẫn đường cỡ `md`.
- `components/ZenIcon.vue`: thêm icon `wallet`, `profile`.
- `assets/css/main.css`: khối `@media (pointer: coarse), (max-width: 1023px)` ép `min-height: 40px !important` cho nút, tab, select trong `[role=dialog]` (trừ `.ui-btn--link`) và `height: 40px !important` cho `.ui-btn--sm`, kèm nới vùng chạm thanh trượt. Đây là cách sửa chung, có thể làm to các nút vốn nhỏ có chủ ý, tôi chỉ kiểm tra bằng ảnh ở tab Âm Cảnh, Cửa Hàng, Tơ Duyên và modal ví.
- `components/SanctuaryDrawer.vue`: `max-width` 480 px đổi thành 440 px theo `DESIGN.md`.
- `components/ui/UiModal.vue`, `components/WalletConnectModal.vue`, `components/TempleCanvas.vue`: nút đóng, link "Cài Đặt", nút dẫn đường, nút "Dừng bước" lên 40 px, nhãn SVG sơ đồ lên 12 px. Dùng `h-[40px]` thay vì `h-10` vì `html` 14 px làm `h-10` chỉ còn 35 px.
- Banner buff/debuff trong ngày (`SanctuaryDrawer.vue`): bỏ nền xanh và vàng phủ cả khối (`bg-[rgba(14,203,129,0.1)]`, `bg-[rgba(252,213,53,0.1)]`), chỉ giữ viền màu và icon. Khối lớn không còn nền xanh/đỏ giao dịch. Badge mức quẻ nhỏ (`getMucBadgeStyle`) vẫn tô nền xanh/đỏ nhạt, tôi giữ vì `tokens.css` cho phép dùng cho badge nhỏ. Chỉ quét bằng regex trên `bg-`, `border-`, `text-` nên có thể còn chỗ sót.
- Vòng focus cho ô nhập thô: xem mục Còn lại số 8.
- `TempleCanvas`, `CardDetailViewer`, `CardRevealModal`, `HeritageCardItem`: bỏ `backdrop-blur` (nền overlay đã đủ tối, không cần mờ).

## Còn lại (chưa làm)

1. Duyệt các màn chưa chụp, kèm đánh giá phân cấp thị giác, màu vàng dùng quá nhiều, xanh/đỏ giao dịch dùng sai ngữ nghĩa. Lượt này tôi chỉ đo được vùng bấm, tràn ngang và cỡ chữ. Phần đánh giá thẩm mỹ và phân cấp (mục 2.2 trong prompt) chưa làm.
2. HUD 1440 px còn sáu phần tử dưới 40 px (cao 23 đến 36 px). Tôi không sửa vì desktop dùng chuột. Nếu muốn đúng quy tắc 40 px mọi nơi thì cần sửa thêm.
3. `text-base` (12.25 px) và `text-lg` (17.5 px) vẫn lệch do gốc `html` 14 px. Sửa đúng phải đổi gốc về 16 px và duyệt lại toàn bộ kích thước.
4. Hai `INPUT` trong form hồ sơ cao 16 và 20 px. Vùng bấm thật có thể là hộp bao quanh cao 40 px (`UiInput` có `min-h-[40px]` trên hộp bao), nhưng chưa bấm thử để xác nhận. Ô thô `h-9` trong `SanctuaryDrawer.vue` đã đổi thành `h-[40px]`.
5. `prefers-reduced-motion`: đã kiểm tra lại, `assets/css/tokens.css` (dòng 146 đến 155) có quy tắc toàn cục ép `animation-duration` và `transition-duration` về 0,01 ms, `animation-iteration-count` về 1 cho mọi phần tử, và `main.css` có import file này. Vì vậy các `animate-pulse`, `animate-ping`, `animate-spin` đã được bao phủ, không cần thêm từng chỗ. Chưa thử bật tuỳ chọn hệ điều hành để xác nhận trên trình duyệt thật. Một hệ quả: `animate-spin` của icon loading cũng bị dừng khi bật tuỳ chọn này.
6. Bỏ `backdrop-blur` và đổi drawer 480 px thành 440 px là quyết định của tôi, chưa so ảnh trước và sau ở 1440 px. Cần bạn nhìn lại bằng mắt.
7. Mục "Nhà phát triển" trong popup phím tắt: đã thêm `min-h-[40px]` vào nút (`TempleCanvas.vue`), chưa đo lại trong trình duyệt.
8. Thứ tự Tab: trong drawer, Tab đi đúng trong drawer (không thoát ra ngoài trong 8 lần bấm thử). Nhưng các `INPUT` ở form hồ sơ nhận focus mà chính phần tử `INPUT` không có outline hay box-shadow (`NORING`). Đọc mã cho thấy `UiInput` đã có `focus-within:border-primary focus-within:ring-1 focus-within:ring-primary` trên hộp bao nên không phải lỗi. Còn các ô nhập thô chỉ đổi màu viền khi focus, nên đã thêm `focus:ring-1 focus:ring-primary` cho 4 ô trong `SanctuaryDrawer.vue`, 1 ô trong `HauDongPanel.vue`, `AbbotChatDrawer.vue` và `ZenChatDrawer.vue`. Chưa kiểm tra trong trình duyệt. Chưa kiểm tra bẫy focus đầy đủ và độ tương phản màu bằng công cụ.
9. Chưa đo thời gian tải thật. Trong lần chạy này cảnh tải xong sau 14 đến 35 giây ở 375 và 1440 px, nhưng đó là WebGL phần mềm, không phải số liệu của máy người dùng.

## Quality gate sau lượt này

| Kiểm tra | Kết quả |
|---|---|
| `vue-tsc --noEmit` | 0 lỗi |
| `node scripts/verify-ui-primitives.mjs` | ALL CHECKS PASSED (37 file) |
| `npm run build` | exit 0, tổng JS 1783.6 KB (trước 1782.9 KB), chunk lớn nhất 618.4 KB |
| `wallet:test:auth`, `deposit`, `spend`, `hydra`, `meditation`, `hau-dong`, `vietnam-day` | 19/19, 19/19, 14/14, 11/11, 14/14, 8/8, 6/6 |
| `boi:test`, `boi:test:golden` | 21/21, 39/39 |

Lượt cuối đã chạy lại `vue-tsc` (0 lỗi), `verify-ui-primitives` (đạt), `pnpm run build` (exit 0), `boi:test` (21/21), `wallet:test:hydra` (11/11) và `wallet:reconcile` (kết luận đối soát an toàn). Các script wallet khác chưa chạy lại sau lần sửa cuối, vì lượt này chỉ đổi giao diện.

Chưa làm: chụp lại 768 px và 1440 px sau khi đổi sang drawer 440 px; sau lần sửa cuối chỉ đo lại ở 375 px, và ô ngày sinh 40 px chưa đo lại. Số "HUD 1440 px dưới 40 px" trong bảng vẫn đúng, vì quy tắc 40 px chỉ áp dụng cho màn cảm ứng hoặc dưới 1024 px.

Tôi nghi drawer không đóng bằng Esc, nhưng khi chạy thử Esc đóng được drawer ở cả hai cỡ (kể cả trước khi tôi thêm mã nào). Không phải lỗi. Tôi đã thêm rồi gỡ bỏ phần xử lý Esc riêng trong `SanctuaryDrawer.vue`, không còn dấu vết trong mã. Tôi chưa truy ra chính xác chỗ nào trong `TempleCanvas.vue` đóng drawer khi bấm Esc, chỉ biết kết quả đúng.

Ghi chú cho mục 2: tôi thử đổi `html` về 16 px để mọi `rem` ra đúng giá trị Tailwind, rồi hoàn lại. Lý do: cách đó đổi kích thước của mọi phần tử dùng `rem` trong toàn game, mà tôi chưa kiểm tra hết các màn. Thay vào đó tôi ghim `--text-caption` và `--text-body-sm` bằng `px` trong `assets/css/tokens.css`. Hệ quả: `text-base` vẫn là 12.25 px và `text-lg` là 17.5 px (đo trong trình duyệt), và các lớp theo spacing như `h-10` vẫn ra 35 px thay vì 40 px. Tôi chỉ thay `h-10` bằng `h-[40px]` ở ba nút trong form hồ sơ, chưa quét toàn bộ.
