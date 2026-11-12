# Giai đoạn 3. Redesign giao diện

Chỉ làm cho desktop và chỉ đọc mã, không chụp ảnh. Chưa có ảnh trước/sau, chưa kiểm bằng mắt. Mọi nhận định về diện mạo bên dưới là suy ra từ mã và token, cần bạn xem lại trên trình duyệt.

## Hướng đã chọn

Kết hợp hướng B "Sơn mài và vàng thếp" làm nền, thêm ấn son đỏ của hướng A cho nút hành động chính. Bạn chọn vì muốn giữ nền tối nhưng bỏ cảm giác ứng dụng giao dịch.

## Token mới

| Vai trò | Trước (Binance) | Sau |
| :--- | :--- | :--- |
| Nền gốc | `#0b0e11` | `#100e0c` |
| Mặt thẻ | `#1e2329` | `#1a1714` |
| Mặt nâng | `#2b3139` | `#26221d` |
| Viền chỉ | `#2b3139` | `#332d26` |
| Chữ chính | `#eaecef` | `#ede4d3` |
| Chữ phụ | `#929aa5` | `#a89c88` |
| Chữ chú thích | `#707a8a` | `#968b79` |
| Nhấn (chữ, viền, đang chọn) | `#fcd535` | vàng thếp `#c9a24b` |
| Nút chính | nền vàng `#fcd535` | ấn son `#b8372b`, chữ kem `#f6ecd8` |
| Font tiêu đề | Cinzel, Playfair (thực tế gần như không dùng) | Noto Serif Display |
| Font thân | Inter | Be Vietnam Pro |
| Góc | 2, 4, 6, 8, 12px | 2px và tròn hẳn |
| Bóng | nhiều cấp | một cấp (`shadow-2xl`) |

Tỉ lệ tương phản đã tính bằng công thức WCAG: chữ chính 14,14:1, chữ phụ 6,61:1, chú thích 5,33:1 trên thẻ và 4,71:1 trên mặt nâng, vàng thếp 7,44:1, chữ kem trên son 4,95:1. Giá trị chú thích ban đầu `#8a7f6e` chỉ đạt 4,02:1 trên mặt nâng nên đã đổi sang `#968b79`. Viền chỉ chỉ đạt 1,31:1 so với thẻ, đó là chủ ý, nên điều khiển tương tác không được chỉ dựa vào viền.

## Đã làm

- Token trong `assets/css/tokens.css` và `assets/css/main.css`, `DESIGN.md` viết lại phần màu, chữ, hình khối, `AGENTS.md` mục 5 cập nhật theo.
- Đổi 22 file `.vue` và `.css` từ mã màu Binance sang màu mới bằng script, không sửa tay từng chỗ. Cũng đổi tay 2 file trong `lib/` (`ShareCardRenderer.ts` dòng 71, `NameplateHelper.ts` dòng 84) và `TempleCanvas.vue` dòng 127, vì script chỉ quét `components/` và `pages/`.
- `UiButton variant="primary"` đổi sang ấn son. Nút gửi trong `ZenChatDrawer.vue` đổi theo. Các chỗ khác dùng `bg-primary` là chấm, thanh tiến độ, gạch chân tab, vẫn vàng thếp.
- Tiêu đề drawer và modal dùng class `ui-font-serif` (Noto Serif Display): `UiModal`, `SanctuaryDrawer`, `AbbotChatDrawer`, `HauDongPanel`, `CardRevealModal`.
- Bỏ `nuxt.config.ts` nạp Cinzel và Playfair Display. Cinzel không có subset vietnamese nên chữ có dấu từng bị rơi về font dự phòng.
- Bỏ 39 nhãn `uppercase tracking-wider/wide`. Còn 2 chỗ `uppercase` đơn thuần ở `SoundscapeMixer.vue` dòng 79 và `TempleCanvas.vue` dòng 1411, không có giãn chữ, chưa đụng.
- Bỏ icon trong ô vuông bo ở 4 tiêu đề: `CardDetailViewer`, `CardRevealModal`, `AbbotChatDrawer`, `CardPackCard`.
- Bỏ bóng phát sáng ở thẻ di sản, bỏ gradient ở nền thẻ, ruy băng độ hiếm, thanh tiến độ bộ sưu tập, `drop-shadow-md` trong `HeritageCardArt`.
- `scripts/verify-ui-primitives.mjs` thêm 5 luật chặn: kính mờ, nhãn chữ hoa giãn chữ, bóng phát sáng, Cinzel/Playfair, mã màu Binance cũ.

## Kết quả cổng chất lượng

- `npx vue-tsc --noEmit`: exit 0.
- `node scripts/verify-ui-primitives.mjs`: ALL CHECKS PASSED, 37 file, gồm 5 luật mới.
- `npm run build`: exit 0.
- `npm run wallet:test:hydra`: 11/11 PASS.
- `npm run boi:test`: exit 0.
- Đã kiểm trong CSS build: `--radius-md:2px`, `.bg-seal`, `.shadow-xl` trở thành bóng trong suốt và `.shadow-2xl` ra `0 8px 24px`.

## Chưa làm hoặc chưa chắc

- Chưa xem bằng mắt, chưa chụp ảnh. Cần bạn kiểm tra nhất: tiêu đề serif có vừa chỗ không, nút son có quá nổi không, thẻ bài sau khi bỏ gradient có còn đủ phân biệt độ hiếm không.
- `text-white` còn 223 chỗ, nay ra `#f5eddc` (kem) nhờ `--color-white` trong `@theme`, đã xác nhận có trong CSS build. Chưa kiểm có chỗ nào cần trắng thật.
- Còn nhiều `rounded-full` (khoảng 42 chỗ). Giữ cho chấm, nút tròn, thanh tiến độ. Chưa kiểm từng chỗ có nên là góc vuông không, ví dụ pill huy hiệu ở `HeritageCardItem.vue` dòng 237.
- Chưa xử lý "thẻ trong thẻ trong thẻ", bố cục đối xứng và công thức "tiêu đề + dòng xám + hành động". Đây là chỉnh bố cục từng màn, không làm hàng loạt được. Chưa động vào ý "dùng đồ vật làm giao diện" (ống xăm, hòm gỗ, sổ công đức), cũng chưa thêm chuyển động có ý nghĩa như nhang cháy hay mực loang.
- Màu độ hiếm thẻ (tím, xanh trời, hổ phách) và màu cung trong sơ đồ minimap giữ nguyên. Màu huy hiệu `UiBadge` vẫn nền nhạt xanh/đỏ theo ghi chú ở `tokens.css`.
- Cảnh 3D (`lib/world3d/`) không đổi màu, chỉ đổi màu bảng tên người chơi.
- Còn `animate-pulse` ở thẻ thiền định (`SanctuaryDrawer.vue` dòng 2711) và `animate-ping` ở vài chấm trạng thái trong `TempleCanvas.vue`. `tokens.css` đã tắt animation khi bật `prefers-reduced-motion`.
- `--radius-2xl` và `--radius-3xl` khai báo trong `main.css` chưa chắc dùng ở đâu, đã đặt sẵn 2px.
