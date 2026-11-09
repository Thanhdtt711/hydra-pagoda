# TỐI ƯU UX THAO TÁC & BIỂN HOÀNH PHI 3D

Tài liệu này ghi lại hai đợt rà soát giao diện thao tác người dùng của cảnh 3D Vạn Cảnh Thiền Tự. Đợt 1 xử lý ba vấn đề được báo cáo: biển tên bị bé và cắt chữ, menu chuột phải của trình duyệt bật lên trong cảnh 3D, và các gợi ý phím/chuột còn rời rạc. Đợt 2 xử lý toàn bộ các phát hiện còn tồn tại sau đợt 1 (xung đột xoay camera và tương tác, tiếng mõ spam, gợi ý phím trùng lặp, biển tên người chơi, mất pointer lock, phím thay thế F4/F5, nhóm phím nhà phát triển).

## 1. Vấn đề được báo cáo

| # | Hiện tượng | Nguyên nhân gốc | Mức độ |
|---|-----------|-----------------|--------|
| 1 | Biển "ĐẠI HÙNG BẢO ĐIỆN" nhỏ, chữ bị cắt ở mép trái | Canvas 512x128 nhưng chữ `bold 54px` cố định, không đo độ rộng nên chữ dài hơn khung. Mặt phẳng chỉ 4.4 x 1.1 m, đặt sát tường nên khó đọc và bị lấn bởi mái hiên | Cao |
| 2 | Biển "VẠN CẢNH THIỀN TỰ" ở Tam Quan có cùng rủi ro | Cỡ chữ cố định 46px trên canvas 512x128, độ phân giải thấp nên mờ khi nhìn xa | Trung bình |
| 3 | Bấm chuột phải hiện menu của Chrome (Quay lại, Tải lại, Kiểm tra...) | `contextmenu` chỉ được chặn trên phần tử `canvas`. Khi chuột phải rơi vào lớp HUD phủ lên canvas (thanh gợi ý, prompt tương tác, vùng `pointer-events-auto`) thì sự kiện không đi qua canvas nên trình duyệt hiện menu gốc | Cao |
| 4 | Chỉ có một cách tương tác (chuột phải) | Touchpad laptop, chuột thiếu nút phải hoặc trình duyệt chặn đều khiến người chơi không tương tác được | Trung bình |

## 2. Những gì đã sửa

### 2.1. Biển hoành phi (tên biển)

- Thêm helper dùng chung [`createPlaqueTexture()`](../lib/world3d/utils/PlaqueTexture.ts:30) cho mọi biển chữ 3D.
- Chữ được đo bằng `measureText` rồi tự co cỡ để luôn nằm trọn trong khung có lề, nên không thể bị cắt dù đổi nội dung biển.
- Canvas nâng lên 1024 px chiều ngang, bật mipmap và anisotropy 8, giúp chữ sắc nét khi nhìn từ xa hoặc góc xiên.
- Có viền đôi (ngoài đậm, trong mảnh) và đổ bóng chữ nhẹ để chữ nổi trên nền.
- [`PagodaSanctuary.buildPlaque()`](../lib/world3d/sanctuary/PagodaSanctuary.ts:482): mặt phẳng tăng từ 4.4 x 1.1 m lên 6.4 x 1.6 m (tỷ lệ 4:1 khớp canvas 1024x256), dời ra trước hàng cột hiên (`PORCH_Z + 0.42`) để không bị mái hiên và tường che.
- [`TamQuanGate.buildPlaque()`](../lib/world3d/architecture/TamQuanGate.ts:119): canvas 1024x240 khớp mặt phẳng 3.1 x 0.726 m, tránh méo chữ.

### 2.2. Chặn menu chuột phải của trình duyệt

- [`TempleStage.onContextMenu`](../lib/world3d/TempleStage.ts) được gắn vào `window` ở pha capture thay vì chỉ trên canvas, nên mọi lớp HUD phủ lên cảnh đều không bật được menu gốc.
- Chừa lại ô `input`, `textarea` và `contenteditable` để người dùng vẫn dán và sao chép được trong khung chat.
- Listener được gỡ đúng cặp trong `destroy()` (cùng tham số `capture = true`) nên không rò rỉ khi rời trang.
- Thêm `window.blur` gọi `onMouseUp` để reset trạng thái kéo chuột khi người dùng chuyển tab giữa lúc đang giữ chuột, tránh camera bị "dính" xoay.

### 2.3. Thêm phím E làm cách tương tác thay thế

- Phím `E` gọi cùng một hàm tương tác với chuột phải (`onRightClick(currentNearTarget)`), nên hành vi hai đường luôn giống nhau.
- Bỏ qua khi giữ phím (`e.repeat`), khi đang gõ trong `input`, `textarea`, `contenteditable`, và khi có `Ctrl`, `Meta`, `Alt`.

### 2.4. Gợi ý phím trên HUD (đợt 1)

Các gợi ý trong [`TempleCanvas.vue`](../components/TempleCanvas.vue) được cập nhật để phản ánh hai cách tương tác:

- Màn hình tải: "Chuột phải hoặc E Tương tác".
- Prompt gần vật thể: hiện cả `Chuột phải` và `E`.
- Bảng phím tắt: dòng Tương tác hiện cả hai phím.
- Thống nhất cách viết hoa "Chuột phải" ở mọi nơi (trước đây có chỗ "Chuột Phải").

### 2.5. Phân biệt kéo xoay và nhấp chuột phải (đợt 2)

Trước đây chuột phải vừa xoay camera vừa kích hoạt tương tác ngay lúc nhấn xuống, nên giữ chuột để xoay cũng bấm nhầm vào mục tiêu đang gần.

- [`TempleStage.onMouseDown`](../lib/world3d/TempleStage.ts) với nút phải chỉ ghi nhận trạng thái chờ (`rightPending`) cùng vị trí bấm, không kích hoạt tương tác nữa.
- [`TempleStage.onMouseMove`](../lib/world3d/TempleStage.ts) cộng dồn quãng kéo (`rightDragDist`). Khi pointer lock đang bật dùng tổng `movementX/Y`, khi chưa khóa dùng khoảng cách lớn nhất của `clientX/Y` so với điểm bấm.
- [`TempleStage.onMouseUp`](../lib/world3d/TempleStage.ts) chỉ gọi `onRightClick` nếu nút nhả là nút phải và quãng kéo nhỏ hơn `RIGHT_CLICK_DRAG_PX` (4 px). Nếu sự kiện đến từ `window.blur` (không phải `MouseEvent`) thì hủy trạng thái chờ, không tương tác.
- Hệ quả: nhấp chuột phải nhanh vẫn tương tác như cũ, giữ và kéo chỉ xoay camera.

### 2.6. Tiếng mõ chỉ phát có kiểm soát (đợt 2)

- [`handleRightClickAction`](../components/TempleCanvas.vue) trước đây phát `playWoodenFish()` mỗi lần chuột phải vào khoảng trống, rất ồn khi người dùng nhấp liên tục.
- Nay nhánh khoảng trống có cooldown `IDLE_WOODEN_FISH_COOLDOWN_MS = 1000` (dựa trên `performance.now()`), tối đa một tiếng mõ mỗi giây. Chuột phải vào mục tiêu thật (hương, cửa, hòm công đức...) không bị ảnh hưởng.

### 2.7. Nguồn dữ liệu gợi ý phím dùng chung (đợt 2)

- Tạo [`lib/ui/controlHints.ts`](../lib/ui/controlHints.ts) với danh sách `CONTROL_HINTS` (mỗi mục gồm `id`, `keys`, `sep`, `label`, `surfaces`, `dev`) và các hàm `hintsFor(surface)`, `DEV_HINTS`, `INTERACT_HINT`.
- Bốn nơi trong `TempleCanvas.vue` đều đọc từ nguồn này: màn hình tải (`loading`), prompt gần mục tiêu (`INTERACT_HINT`), pill góc trái (`pill`) và bảng phím tắt đầy đủ (`cheat`). Thêm hoặc đổi phím chỉ cần sửa một chỗ.
- Mục "Đổi góc nhìn" nay hiển thị `V` hoặc `F5`, và nút "Hiển thị" ghi `V / F5`.
- Đã sửa luôn thụt lề lệch ở khối prompt gần mục tiêu.

### 2.8. Phím V đổi camera (đợt 2)

- [`TempleStage.onKeyDown`](../lib/world3d/TempleStage.ts) xử lý phím `V` gọi `cycleCameraMode()`, cùng hành vi với `F5`. Bỏ qua khi giữ phím, khi có `Ctrl`, `Meta`, `Alt` hoặc khi đang gõ trong ô nhập.
- `F4` và `F5` vẫn giữ nguyên, `V` là phương án cho máy mà trình duyệt chiếm `F5` (làm mới trang).

### 2.9. Chip nhắc lấy lại điều khiển khi mất pointer lock (đợt 2)

- [`TempleStage`](../lib/world3d/TempleStage.ts) có callback mới `onPointerLockStateChange(locked)`, được gọi trong `onPointerLockChange`.
- [`TempleCanvas.vue`](../components/TempleCanvas.vue) lưu `isPointerLocked` và `hasEverLocked`, tính `showResumeChip`. Chip chỉ hiện khi đã tải xong, không khóa con trỏ, không giữ `ALT`, và không có drawer, emote wheel, modal, popover hoặc menu drop-up nào đang mở.
- Nội dung chip là "Nhấp vào cảnh để bắt đầu điều khiển" lần đầu và "Nhấp vào cảnh để tiếp tục điều khiển" sau khi đã từng khóa. Chip có `pointer-events-none` nên không chặn nhấp vào cảnh.

### 2.10. Nhóm phím "Nhà phát triển" (đợt 2)

- Bảng phím tắt có thêm khối "Nhà phát triển" thu gọn mặc định (nút bấm có `aria-expanded`), khi mở liệt kê `F2` (bảng hiệu năng) và `F3` (khung va chạm). Dữ liệu lấy từ `DEV_HINTS` trong `controlHints.ts`, không làm rối bảng cho người chơi thường.

### 2.11. Biển tên người chơi tự co chữ (đợt 2)

- Thêm helper [`lib/world3d/utils/FitText.ts`](../lib/world3d/utils/FitText.ts) với `fitText()` và `ellipsizeToWidth()`: chuẩn hóa NFC, giảm cỡ chữ từng bước đến mức tối thiểu cho vừa độ rộng, nếu vẫn dài thì cắt bằng dấu `…` (tìm nhị phân theo ký tự Unicode nên không cắt đôi dấu tiếng Việt).
- [`NameplateAtlas.renderNameToAtlas()`](../lib/world3d/characters/NameplateAtlas.ts): vẽ danh hiệu trước (căn phải, tối đa 76 px, cỡ 10 xuống 8 px), sau đó tên dùng phần còn lại của ô (cỡ 12 xuống 9 px).
- [`NameplateHelper`](../lib/world3d/NameplateHelper.ts): tên (26 xuống 15 px), danh hiệu (16 xuống 12 px) và bong bóng chat (24 xuống 15 px) đều đi qua `fitText`.

## 3. Kết quả kiểm tra

- `vue-tsc`: không phát sinh lỗi mới ở `lib/world3d`, `lib/ui`, `TempleCanvas.vue`, `FitText.ts` và các tệp nameplate (80 lỗi cũ còn lại nằm ngoài phạm vi, ở modal, shop và API `server/api/mc/*`).
- `pnpm build`: Build complete.
- `node scripts/verify-ui-primitives.mjs`: ALL CHECKS PASSED (0 ký hiệu cấm, 0 chữ nhỏ hơn 12px).
- Chưa kiểm bằng trình duyệt thật. Cần xác nhận bằng mắt: biển mới (từ cổng Tam Quan và thềm chánh điện), giữ chuột phải và kéo thì chỉ xoay camera, nhấp nhanh chuột phải vẫn tương tác, phím `V` đổi camera, chip hiện khi nhấn `Esc` và biến mất khi nhấp lại vào cảnh, nameplate với tên dài có dấu.

## 4. Việc nên làm tiếp

Toàn bộ phát hiện của đợt 1 đã được xử lý ở mục 2.5 đến 2.11. Các việc dưới đây là đề xuất cho đợt sau.

| Ưu tiên | Đề xuất | Lý do |
|---------|---------|-------|
| Cao | Kiểm thử thủ công trên trình duyệt thật (Chrome, Firefox, Safari) và touchpad | Mọi thay đổi mới chỉ được xác nhận bằng type-check và build |
| Trung bình | Thêm điều khiển cảm ứng (nút tương tác nổi, joystick ảo) cho thiết bị di động | Hiện chưa có đường tương tác nào ngoài chuột và phím |
| Trung bình | Cho người dùng gán phím riêng và lưu vào `localStorage` | `CONTROL_HINTS` đã là nguồn duy nhất nên dễ mở rộng thành cấu hình |
| Trung bình | Viết test tự động cho `fitText` (tên rất dài, nhiều dấu, emoji, chuỗi rỗng) | Hàm dùng chung cho nhiều biển, lỗi sẽ lan rộng |
| Thấp | Tách bảng phím tắt thành component riêng (`HotkeyCheatSheet.vue`) | `TempleCanvas.vue` đã hơn 1.400 dòng |
| Thấp | Thêm nhãn truy cập (aria) và điều hướng bàn phím cho các popover HUD | Cải thiện trợ năng |

## 5. Quy ước cho biển chữ 3D mới

1. Biển cố định trong thế giới (hoành phi, bảng trạm) luôn dùng `createPlaqueTexture()`, không tự vẽ canvas thủ công.
2. Mọi chữ vẽ lên canvas có độ rộng không biết trước (tên người chơi, tin nhắn, nội dung từ máy chủ) phải đi qua `fitText()` trong `lib/world3d/utils/FitText.ts`, đặt rõ `maxWidth`, `maxPx`, `minPx`.
3. Chọn tỷ lệ canvas (width / height) bằng đúng tỷ lệ mặt phẳng để chữ không bị méo.
4. Không đặt cỡ chữ cố định cho nội dung có thể dài. Cỡ chữ tối thiểu của biển trong cảnh phải vẫn đọc được từ khoảng cách tương tác.
5. Dispose texture và material trong hàm `dispose()` của lớp chủ (đã thực hiện ở `PagodaSanctuary` qua `ownedTextures` và `TamQuanGate`).
6. Gợi ý phím trên HUD chỉ khai báo trong `lib/ui/controlHints.ts`. Không viết cứng `UiKeycap` rời rạc trong template.
7. Tương tác chuột phải phải kích hoạt khi nhả chuột và chỉ khi quãng kéo nhỏ hơn 4 px, để không xung đột với xoay camera.

## 6. Tệp đã thay đổi

- [`lib/world3d/utils/PlaqueTexture.ts`](../lib/world3d/utils/PlaqueTexture.ts) (mới, đợt 1)
- [`lib/world3d/utils/FitText.ts`](../lib/world3d/utils/FitText.ts) (mới, đợt 2)
- [`lib/ui/controlHints.ts`](../lib/ui/controlHints.ts) (mới, đợt 2)
- [`lib/world3d/sanctuary/PagodaSanctuary.ts`](../lib/world3d/sanctuary/PagodaSanctuary.ts)
- [`lib/world3d/architecture/TamQuanGate.ts`](../lib/world3d/architecture/TamQuanGate.ts)
- [`lib/world3d/TempleStage.ts`](../lib/world3d/TempleStage.ts)
- [`lib/world3d/characters/NameplateAtlas.ts`](../lib/world3d/characters/NameplateAtlas.ts)
- [`lib/world3d/NameplateHelper.ts`](../lib/world3d/NameplateHelper.ts)
- [`components/TempleCanvas.vue`](../components/TempleCanvas.vue)
