# Thiết Kế Chi Tiết: Đài Tơ Duyên Nguyệt Lão (Bói Duyên Cặp Đôi Đồng Tu)

- **Ngày tạo:** 2026-11-10
- **Trạng thái:** Chờ phê duyệt (Pending Approval)
- **Tác giả:** Mia & Sumale

---

## 1. Mục Tiêu & Bối Cảnh
Trong không gian tâm linh của Vạn Cảnh Chùa, tính năng Bói Quẻ hiện tại mới chỉ hỗ trợ trải nghiệm đơn lẻ (Solo). Để thúc đẩy tương tác xã hội và kết nối tình duyên/tri kỷ giữa những người chơi, hệ thống cần bổ sung phân hệ **Ý tưởng 4: Đài Tơ Duyên Nguyệt Lão (Kết Duyên Đồng Tu & Bói Duyên Cặp Đôi)**.

Tính năng này kết hợp cảnh quan 3D lãng mạn bên bờ Hồ Sen với thuật toán so khớp Bát Tự, Ngũ Hành Nạp Âm và Cung Phi Bát Trạch, cho phép người chơi thỉnh quẻ tình duyên cho bản thân và bạn đồng tu/người thương, nhận Thẻ Bài Song Duyên và vật phẩm lưu niệm phong thủy.

---

## 2. Cảnh Quan 3D: Cây Nguyệt Lão Bên Bờ Hồ Sen

### 2.1. Vị Trí Bản Đồ & Quy Hoạch
- **Vị trí:** Đặt bên bờ Hồ Sen và đầu Cầu Kiều phía Đông Nam sân chùa tại tọa độ thế giới ($x = 22.0\text{m}, z = 16.0\text{m}$, cao độ mặt đất $y = 0.0\text{m}$).
- **Hướng nhìn:** Quay mặt về phía Tây Bắc, hướng nhìn vào sân chùa và mặt nước hồ sen nở ngát hương.
- **Vùng loại trừ (Exclusion Zone):** Thiết lập vùng bảo vệ bán kính $3.5\text{m}$ quanh gốc cây để không mọc cỏ dại hay cây rừng ngẫu nhiên đâm xuyên.

### 2.2. Chi Tiết Kiến Trúc 3D (`LoveTreeProp.ts`)
- **Hồng Thần Mộc (Cây Nguyệt Lão):** Thân cây đại thụ uốn khúc cổ kính bằng gỗ nâu trầm, tán lá phong/đào sắc đỏ hồng rực rỡ phong cách low-poly flat shading.
- **Dải Lụa Đỏ & Chuông Gió:** Treo 8 dải lụa đỏ thắt nút đồng tâm buông rủ từ các cành cây xuống, kèm chuông đồng phong linh nhỏ đung đưa theo làn gió.
- **Án Thư Kết Duyên:** Bàn gỗ hương chạm hoa sen ($1.4\text{m} \times 0.7\text{m} \times 0.85\text{m}$) đặt tại $(22.0, 0.0, 14.5)$, trên bàn có lư hương đồng tỏa khói trầm nhẹ và tráp gỗ đựng Cuộn Chỉ Hồng.
- **Đệm Quỳ Đôi:** 2 đệm cói thiền màu đỏ gạch đặt phía trước án thư tại $z = 13.5\text{m}$ để 2 đồng tu cùng hành lễ.
- **Vật lý & Va chạm:** Tích hợp `CylinderCollider` tại gốc cây ($R = 0.9\text{m}$) và `BoxCollider` tại bàn án thư để nhân vật không đi xuyên thấu.

---

## 3. Cơ Chế Tương Tác & Giao Diện Người Dùng (UI Drawer)

### 3.1. Điểm Tương Tác Trong Game (Proximity Trigger)
- Khi nhân vật bước vào phạm vi $d \le 2.6\text{m}$ so với án thư:
  - Hiển thị HUD tương tác: `[E] hoặc [Chuột Phải]: Thỉnh Quẻ Tơ Duyên (Nguyệt Lão Thắt Chỉ Hồng)`.
  - Nhấn phím `E` sẽ mở ngăn kéo `SanctuaryDrawer` với tab `love_couple`.

### 3.2. Form Nhập Liệu Bát Tự Đôi Lứa
Giao diện chia làm 2 cột thẻ tinh tế chuẩn Binance Dark (`#1e2329`, viền `#2b3139`, accent vàng `#fcd535`):
- **Cột Trái (Bản thân):** Tự động nạp Họ tên, Ngày tháng năm sinh (Dương lịch/Âm lịch), Giới tính từ hồ sơ người chơi đã lưu.
- **Cột Phải (Người thương / Bạn đồng tu):** Nhập Họ tên, Ngày tháng năm sinh, Giới tính của đối phương. Có ô dán nhanh địa chỉ ví Cardano hoặc chọn từ danh sách đồng tu đang online gần đó.

### 3.3. Chi Phí & Kinh Tế (Merit Coins)
- **Lượt đầu tiên trong ngày:** Miễn phí tham gia ($0\text{ MC}$).
- **Từ lượt thứ 2 trở đi trong ngày:** Thu phí $10\text{ MC}$ mỗi lượt gieo quẻ (trừ vào số dư ví thông qua sổ cái `mc_ledger`).

---

## 4. Thuật Toán So Khớp Bát Tự & Dữ Liệu Quẻ

### 4.1. Phân Tích Mệnh Số Học (`MetaphysicsService.ts`)
Tận dụng hàm giải tích Bát Tự sẵn có để so sánh 2 lá số:
- **Ngũ Hành Nạp Âm:** Kiểm tra Tương sinh (ví dụ Kim sinh Thủy: $+15$ điểm), Bình hòa (ví dụ Thổ hòa Thổ: $+8$ điểm), Tương khắc (ví dụ Thủy khắc Hỏa: $-10$ điểm).
- **Cung Phi Bát Trạch:** So khớp nhóm Đông Tứ Mệnh và Tây Tứ Mệnh (Sinh Khí, Diên Niên, Thiên Y, Phục Vị: cộng từ $10$ đến $20$ điểm; Tuyệt Mệnh, Họa Hại: cân bằng lời khuyên hóa giải).
- **Điểm Tương Hợp (Compatibility Score):** Chuẩn hóa trong khoảng $60\% - 99\%$.

### 4.2. Phân Cấp Danh Vị Duyên Số
- **Duyên Tiền Định ($90\% - 99\%$):** Mức Đại Cát, tâm đầu ý hợp, trăm năm hòa hợp.
- **Tri Kỷ Tương Phùng ($80\% - 89\%$):** Mức Cát, hiểu ý sẻ chia, đồng hành bền chặt.
- **Bằng Hữu Đồng Tâm ($70\% - 79\%$):** Mức Bình hòa, cần thời gian bồi đắp và lắng nghe nhau.
- **Nghịch Duyên Tu Tâm ($60\% - 69\%$):** Cần nhường nhịn, thấu hiểu, tu tâm dưỡng tính để hóa giải bất đồng.

### 4.3. Nội Dung Quẻ & Lời Khuyên
- Rút ngẫu nhiên có trọng số từ kho 68 bài thơ Tơ Duyên (`data/boi/to_duyen.json`).
- Cấu trúc quẻ hiển thị gồm: Tiêu đề quẻ, Bài thơ Tơ Duyên 4 câu, Luận giải ý nghĩa đôi lứa, và Khối Hóa Giải / Cân Bằng cảm xúc chánh niệm.

---

## 5. Thẻ Bài Song Duyên & Vật Phẩm Lưu Niệm

### 5.1. Thẻ Bài Song Duyên Kỹ Thuật Số (Digital Couple Card)
- Render giao diện thẻ đôi lộng lẫy hiển thị tên 2 người, Can Chi 2 bản mệnh, điểm tương hợp %, danh vị duyên số và 4 câu thơ Nguyệt Lão.
- Cung cấp nút **"Tải Ảnh Thẻ Song Duyên"**: Sử dụng HTML5 Canvas để kết xuất ảnh PNG độ phân giải $1080 \times 1920$ sắc nét, hỗ trợ người chơi lưu vào máy và chia sẻ lên mạng xã hội.

### 5.2. Tặng Vật Phẩm Phong Thủy Vào Túi Đồ
- Khi hoàn tất gieo quẻ thành công, hệ thống trao tặng **1 Bùa Chỉ Đỏ Uyên Ương** (`love_knot_charm`) vào bảng vật phẩm của người chơi.
- Bùa này mang ý nghĩa chúc phúc bình an, gắn kết lương duyên và có thể trưng bày trong tủ đồ kỷ niệm.

---

## 6. Kế Hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu (Quality Gates)
1. **Kiểm tra UI Primitives:** Chạy `node scripts/verify-ui-primitives.mjs` đạt $0$ lỗi font $< 12\text{px}$ và $0$ ký tự cấm.
2. **Kiểm tra Unit Test Bát Tự:** Chạy `npm run boi:test` đạt $21/21$ test cases PASS.
3. **Kiểm tra Build Integrity:** Chạy `npm.cmd run build` biên dịch sạch sẽ không có cảnh báo nghiêm trọng hay lỗi bundle.

