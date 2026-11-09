# Cẩm Nang Chi Tiết Vạn Cảnh Thiền Tự — Hướng Dẫn Toàn Diện Mọi Chức Năng Cho Người Chơi

Chào mừng đạo hữu đến với **Vạn Cảnh Thiền Tự (Hydra Pagoda)** — Không gian tâm linh 3D WebGL kết hợp thiền định chánh niệm, chiêm bốc di sản dân gian và công nghệ sổ cái minh bạch trên nền tảng Cardano & Hydra L2.

Tài liệu này hướng dẫn chi tiết từng chức năng, giao diện, phím bấm và cơ chế tương tác mà đạo hữu nhìn thấy và thao tác trong suốt hành trình chiêm bái.

---

## 1. Tổng Quan Giao Diện & Màn Hình Chính

Khi bước vào không gian chùa, màn hình gồm 3 thành phần chính:
1. **Không gian 3D Chùa Vạn Cảnh (Canvas chính):** Quần thể kiến trúc cổ kính với Tam Quan, Đại Hùng Bảo Điện, Tượng Phật Thích Ca Mâu Ni, cây Bồ Đề, các bồ đoàn thiền, bàn xem quẻ và hòm công đức.
2. **Thanh Trạng Thái Trên Cùng (Top Bar - Binance Dark Token):**
   - **Tên Tự Viện:** Biểu tượng chùa vàng cùng tên "VẠN CẢNH THIỀN TỰ".
   - **Nhãn Mạng:** Hiển thị `TESTNET (PREPROD)` màu vàng hoặc `MAINNET` màu xanh.
   - **Thời Tiết & Môi Trường:** Cho biết thời khắc hiện tại trong chùa (Bình minh, Hoàng hôn, Trăng đêm thanh tịnh, Nắng vàng an lạc, Mưa xuân...).
   - **Âm Thanh Chánh Niệm:** Nút loa cho phép bật/tắt nhạc thiền tần số 432Hz, tiếng chuông đồng đại hồng chung và tiếng chim rừng.
   - **Số Dư MC Coin:** Hiển thị số lượng Merit Coins đang sở hữu (ví dụ: `1,250 MC`).
   - **Nút "+ NẠP MC":** Mở nhanh bảng mua thêm MC bằng đồng ADA.
   - **Nút "VÍ CARDANO":** Kết nối hoặc quản lý địa chỉ ví Web3 (Eternl, Lace, Vespr, Nami).
   - **Nút "MENU / HÀNH TRANG":** Mở ngăn kéo chiêm bái từ cạnh phải màn hình.
3. **Bảng Điều Hướng Cạnh Phải (Sanctuary Drawer):**
   - Thiết kế chuẩn sàn Binance Dark với nền đen `#0b0e11`, thẻ xám `#1e2329`, viền chỉ vàng kim `#fcd535`.
   - Ngăn kéo trượt mượt mà từ bên phải, không che khuất toàn bộ khung cảnh 3D để người chơi vẫn cảm nhận được không gian chùa tĩnh tại.

---

## 2. Hệ Thống Điều Khiển Nhân Vật & Góc Nhìn 3D

Đạo hữu nhập vai một Hành Giả Cổ Tự (Pilgrim) khoác áo tràng lam, mang tràng hạt bồ đề và đóa sen thanh tịnh.

### Bảng Phím Tắt Thao Tác

| Thao tác | Phím bấm trên Bàn phím / Chuột | Mô tả chi tiết |
|---|---|---|
| **Di chuyển tới** | Phím `W` hoặc Phím Mũi tên lên `↑` | Nhân vật bước đi về phía trước theo hướng nhìn camera. |
| **Di chuyển lùi** | Phím `S` hoặc Phím Mũi tên xuống `↓` | Nhân vật lùi lại phía sau. |
| **Sang trái** | Phím `A` hoặc Phím Mũi tên trái `←` | Nhân vật bước nghiêng sang bên trái. |
| **Sang phải** | Phím `D` hoặc Phím Mũi tên phải `→` | Nhân vật bước nghiêng sang bên phải. |
| **Chạy nhanh** | Giữ phím `Shift` + Phím di chuyển | Tăng tốc độ bước đi của nhân vật khi cần di chuyển quãng đường xa. |
| **Nhảy / Vượt bậc thang** | Phím Cách (`Space`) | Nhảy nhẹ qua bậc thềm hoặc chướng ngại vật nhỏ. |
| **Xoay góc nhìn 360 độ** | Rê chuột (khi khóa con trỏ) hoặc Giữ chuột phải | Quan sát toàn cảnh ngôi chùa và bầu trời mây nước từ mọi góc độ. |
| **Khóa / Mở con trỏ chuột** | Nhấp chuột trái vào màn hình 3D | Khóa con trỏ (Pointer Lock) để điều khiển xoay camera như game nhập vai; bấm `ESC` để nhả chuột khi cần thao tác form. |
| **Đổi góc nhìn Camera** | Phím `F5` hoặc Phím `V` | Chuyển đổi linh hoạt giữa Góc nhìn thứ ba (TPP - nhìn thấy toàn thân nhân vật) và Góc nhìn thứ nhất (FPP - nhìn từ tầm mắt nhân vật). |
| **Tự động đến điểm thiền** | Phím `M` (hoặc bấm nút "Tọa Thiền" trong Menu) | Nhân vật tự động bước đến bồ đoàn trống gần nhất và ngồi xếp bằng trang nghiêm hướng về Phật. |

---

## 3. Quy Tắc Ràng Buộc Khoảng Cách Thực Tế (Distance-Gated Proximity)

Để giữ trọn tính tôn nghiêm của chốn Phật môn, người chơi **không thể đứng từ xa ở cổng chùa mà bấm xem quẻ hay cúng dường**.

- **Khoảng cách hợp lệ:** Đạo hữu phải điều khiển nhân vật tiến lại gần trong bán kính **$\le 5$ mét** so với Bàn Xem Quẻ hoặc Hòm Công Đức.
- **Khi đứng ngoài phạm vi:**
  - Nếu bấm nút "Gieo quẻ" hoặc "Công đức", hệ thống sẽ nhắc nhở êm dịu: *"Đạo hữu cần bước lại gần Bàn Xin Xăm & Pháp Bảo ngoài sân Chùa để thành tâm thỉnh quẻ"*.
  - Hệ thống tự động kích hoạt **Đường Dẫn Hướng Tâm Linh** (vệt sáng vàng trên mặt sàn) và điều chỉnh camera chỉ đường dẫn lối nhân vật đến đúng vị trí.

---

## 4. Chức Năng Bói Quẻ 6 Môn Cầu An

Hệ thống chiêm bốc dân gian dựa trên học thuyết Dịch học cổ truyền, lịch âm Việt Nam (thuật toán Hồ Ngọc Đức UTC+7), Nạp âm 60 hoa giáp và Bát Trạch Cung Phi.

### Bước 1 — Khai Hồ Sơ Bát Tự (Bắt Buộc Trước Mọi Quẻ)
Khi mở tab Bói Quẻ lần đầu hoặc khi chưa có hồ sơ, toàn bộ 6 môn và nút gieo quẻ đều bị khóa. Người chơi bắt buộc khai báo các thông tin sau:
1. **Họ và tên:** Nhập chữ tiếng Việt có dấu (tối thiểu 2 ký tự, tối đa 50 ký tự). Hệ thống chuẩn hóa Unicode NFC và từ chối chữ số, ký tự đặc biệt hoặc biểu tượng cảm xúc.
2. **Ngày tháng năm sinh (Dương lịch):** Nhập dạng ngày/tháng/năm. Hệ thống tự động kiểm tra loại trừ ngày không có thật (như 31/02, 29/02 năm không nhuận), ngày trong tương lai hoặc người có tuổi trên 120.
3. **Giờ sinh:** Chọn 1 trong 12 canh giờ (Tý 23h-1h, Sửu 1h-3h, Dần 3h-5h, Mão 5h-7h, Thìn 7h-9h, Tỵ 9h-11h, Ngọ 11h-13h, Mùi 13h-15h, Thân 15h-17h, Dậu 17h-19h, Tuất 19h-21h, Hợi 21h-23h) hoặc chọn "Không rõ giờ sinh".
4. **Giới tính:** Bắt buộc chọn "Nam" hoặc "Nữ" (dùng để tính chuẩn xác Cung Phi Bát Trạch và Sao Cửu Diệu).

> [!NOTE]
> **Thẻ Xem Trước Tự Tính:** Ngay khi nhập đúng, màn hình hiển thị thẻ xem trước Bát Tự gồm: Ngày sinh âm lịch (có ghi chú tháng nhuận), Năm Can Chi, Ngũ Hành Bản Mệnh (Nạp Âm), Cung Phi Bát Trạch, Tuổi Dương, Tuổi Mụ và Sao Niên Vận. Người chơi bấm nút vàng **"XÁC NHẬN HỒ SƠ"** để lưu trữ và mở khóa gieo quẻ.

### Bước 2 — Chọn Môn Bói & Phương Thức Chiêm Bái
Sau khi hồ sơ đã duyệt, người chơi có thể chọn 1 trong 6 Môn Cầu An:
- **Xin Xăm Bát Quái:** Thẻ xăm cổ tự định hướng tổng quan vận trình, gia đạo, công danh.
- **Tơ Duyên Tương Ngộ:** Chiêm đoán nhân duyên đôi lứa. Yêu cầu nhập thêm hồ sơ "Người thương" (họ tên, ngày sinh, giới tính) và hỗ trợ lưu danh bạ 5 người thương. Hệ thống đối sánh tương sinh/khắc giữa 2 bản mệnh và cung phi.
- **Cầu Tự Con Cái:** Lời dạy an hòa về đường con cái và phúc trạch gia đình. Tự động áp dụng giới hạn tuổi từ 18 trở lên; ngôn từ chuẩn mực, tuyệt đối không phán bệnh.
- **Chiêu Tài Tấn Bảo:** Chỉ dẫn phương thức kinh doanh minh bạch, tài lộc bền vững từ thiện nghiệp.
- **Dược Sư An Khang:** Nuôi dưỡng thân tâm, giải tỏa âu lo, cân bằng nhịp sống.
- **Dâng Sao Giải Hạn:** Luận giải cửu diệu niên vận (La Hầu, Thổ Tú, Thủy Diệu, Thái Bạch, Thái Dương, Vân Hớn, Kế Đô, Thái Âm, Mộc Đức) và hướng dẫn nghi thức nghinh sao hoặc hóa giải hung tinh.

### 4 Phương Thức Thỉnh Quẻ
- **Phương thức A (Xin Nhanh Tĩnh Tâm):** Thành tâm cầu an trong 1 lần chạm, hệ thống tự đối chiếu hồ sơ để sinh quẻ.
- **Phương thức B (Chọn Theo Chủ Đề Có Sẵn):** Chọn câu hỏi gợi ý phù hợp (công danh, tình cảm, sức khỏe, xuất hành...).
- **Phương thức C (Khai Tâm Tự Đặt Câu Hỏi):** Người chơi tự gõ câu hỏi thắc mắc trong lòng; hệ thống tự động dò tìm chủ đề cốt lõi.
- **Phương thức D (Lắc Ống Xăm 3D):** Trải nghiệm rung lắc ống xăm bằng tương tác vật lý trực quan.

### Chi Phí & Lượt Gieo
- **Lượt Miễn Phí:** Mỗi tài khoản được tặng **1 lượt miễn phí / môn / ngày** (làm mới vào 00:00 UTC+7 mỗi đêm).
- **Dùng Lễ Phẩm:** Nếu đã hết lượt miễn phí, người chơi có thể dùng vật phẩm có sẵn trong túi đồ (Nhang Trầm, Hoa Đăng...) để gieo quẻ mà không tốn MC.
- **Dùng MC Coin:** Chi phí thỉnh quẻ thêm lượt là **50 MC / lần**.

### Màn Hiển Thị Kết Quả Quẻ
Mọi kết quả quẻ luôn hiển thị đồng bộ và trọn vẹn các thành phần:
- **Tiêu đề Thẻ quẻ & Huy hiệu Mức:** Phân định rõ 5 mức duy nhất: **Đại Cát**, **Cát**, **Bình**, **Hung**, **Đại Hung**. Môn Xin Xăm sử dụng danh xưng truyền thống "Thẻ số N".
- **Câu Sấm / Bài Thơ (4 câu):** Vần thơ tứ tuyệt cổ phong giàu ý nghĩa giáo dục chánh niệm.
- **Luận Giải Vận Trình:** Phân tích chi tiết theo độ tuổi người gieo (không gợi ý việc thi cử học đường cho người lớn tuổi).
- **4 Phương Diện Bổ Trợ:** Khối tóm tắt riêng biệt cho *Tiền tài & Lộc pháp*, *Duyên tình & Gia đạo*, *Sức khỏe & Thân tâm*, *Sự nghiệp & Công danh*.
- **Căn Cứ Dịch Lý & Ngũ Hành Bát Tự:** Liệt kê minh bạch quan hệ tương sinh/khắc của Bản mệnh với Ngày, Cung phi với Bản mệnh, kèm nhãn tác động `[Thuận]`, `[Nghịch]`, `[Trung tính]`. Nếu căn cứ khắc mà quẻ ra Cát, hệ thống giải thích rõ yếu tố phúc tinh bù đắp.
- **Lời Khuyên Hành Trì:** Hướng dẫn tu tâm, làm lành lánh dữ, rèn luyện kỷ luật bản thân.
- **Pháp Hóa Giải Vận Hạn:** Tự động kích hoạt khi gặp quẻ Hung hoặc Đại Hung, kèm nút bấm dẫn lối người chơi sang khu vực Tọa Thiền 432Hz để hóa giải điềm xấu.
- **Hiệu Ứng Ngày (Buff / Debuff):** Quẻ Cát ban tặng hiệu ứng may mắn tăng tỷ lệ công đức; quẻ Hung tạo thử thách nhẹ và nhắc nhở tọa thiền để gỡ bỏ.

### Xuất Ảnh Thẻ Quẻ Chia Sẻ (Chuẩn Sắc Phong Hoàng Triều 1080px)
- Người chơi bấm nút **"Lưu / Chia sẻ ảnh quẻ (PNG)"** để tạo ảnh sắc phong trang trọng với viền mạ vàng kép, triện đỏ Chu Sa và đầy đủ 100% nội dung quẻ.
- **Công tắc bảo vệ quyền riêng tư:** Cho phép bật tùy chọn **"Ẩn ngày sinh chi tiết khi xuất ảnh"** — trên ảnh sẽ chỉ ghi năm âm lịch và Can Chi (ví dụ: *Năm Giáp Thân · 23 Tuổi Mụ*), giấu ngày tháng sinh dương lịch để người chơi thoải mái đăng lên Facebook, Zalo hay Telegram.
- Hỗ trợ nút **"Tải ảnh PNG"** (lưu về máy) và nút **"Sao chép ảnh"** (lưu vào bộ nhớ tạm Clipboard).

---

## 5. Hội Thiền Chánh Niệm 432Hz (Meditate-to-Earn)

Thiền định là tính năng cốt lõi giúp thanh lọc thân tâm và nhận phước báu công đức.

### Cách Tham Gia Thiền Định
1. Bấm phím **`M`** hoặc chọn mục **"Tọa Thiền 432Hz"** trên giao diện.
2. Nhân vật tự động bước đến bồ đoàn thiền gần nhất trong Đại Hùng Bảo Điện, ngồi kiết già hướng thẳng về phía Kim Thân Phật Tổ Thích Ca Mâu Ni.
3. Chọn mốc thời gian muốn thiền: **3 phút**, **5 phút**, **10 phút**, **15 phút** hoặc **30 phút**.
4. Bấm nút vàng **"BẮT ĐẦU TỌA THIỀN"**.

### Trải Nghiệm Trong Lúc Thiền
- **Âm Thanh Tần Số 432Hz:** Âm hưởng chuông bát xoay Tây Tạng kết hợp sóng hài 432Hz du dương giúp đưa não bộ về trạng thái thư giãn sâu (Alpha/Theta).
- **Vòng Thở Mandala 4-4-6:** Vòng sáng Mandala co giãn nhịp nhàng dẫn nhịp thở:
  - *Hít sâu bằng mũi:* 4 giây (vòng sáng nở ra).
  - *Nín thở tịnh tâm:* 4 giây (vòng sáng giữ nguyên).
  - *Thở chậm bằng miệng:* 6 giây (vòng sáng thu lại).
- **Phần Thưởng MC Coin (Được máy chủ xác thực):** Mỗi phút thiền trọn vẹn tích lũy thêm điểm phước báu MC Coin vào sổ cái (tối đa **200 MC / ngày / tài khoản**).
- **Hóa Giải Vận Hạn:** Ngay khi hoàn thành thời thiền tối thiểu 3 phút, toàn bộ trạng thái Debuff của quẻ xấu trong ngày sẽ được chuyển hóa thành trạng thái *"Tâm Bình Khí Hòa"*.

---

## 6. Hòm Công Đức & Bảng Vàng Tri Ân (Merit Box & Hall of Fame)

Hòm Công Đức bằng gỗ mun chạm hoa sen mạ vàng tọa lạc ở bên phải ngự đạo chính điện.

### Cách Thức Cúng Dường
1. Di chuyển nhân vật đến đứng cạnh Hòm Công Đức.
2. Bấm vào Hòm Công Đức để mở bảng cúng dường.
3. Chọn các mức công đức định sẵn: **50 MC**, **100 MC**, **500 MC**, **1,000 MC** hoặc nhập số MC tùy tâm (tối thiểu 10 MC).
4. Bấm **"CÚNG DƯỜNG CÔNG ĐỨC"**: Hệ thống phát tiếng chuông ngân vang, phát tán hiệu ứng hoa sen vàng bay bổng và ghi nhận vào sổ cái minh bạch.

### Bảng Tổng Tiền & Top 10 Thí Chủ Đại Bồ Đề
Phía dưới bảng công đức hiển thị:
- **Tổng Tiền Công Đức Toàn Tự:** Con số thực tế tổng hợp toàn bộ lượng cúng dường đã được ghi nhận trên hệ thống.
- **Bảng Vàng Top 10:** Danh sách vinh danh 10 vị thí chủ hộ trì Tam Bảo nhiều nhất kèm huy hiệu Vàng, Bạc, Đồng và địa chỉ ví rút gọn.
- **Tặng Thưởng Tâm Linh:** Cúng dường từ **500 MC** trở lên sẽ được tặng ngay **Hoa Đăng Cầu An** vào túi đồ để người chơi đem thả ra hồ nước cầu bình an cho gia quyến.

---

## 7. Pháp Đàm & Trò Chuyện Cộng Đồng (Sangha Text Chat)

Chức năng giao lưu giữa các hành giả cùng chiêm bái trong thế giới thiền tự.

- **Vị trí:** Khung chat bố trí gọn gàng ở góc dưới bên trái màn hình.
- **Nhập tin nhắn:** Nhấp vào ô nhập liệu hoặc bấm phím **`Enter`**, gõ lời tâm sự, câu hỏi Phật pháp hay lời chào đạo hữu rồi bấm `Gửi`.
- **Bóng Chat 3D (Speech Bubble):** Lời nói xuất hiện ngay trên đầu nhân vật trong không gian 3D, giúp các hành giả nhận diện và đàm đạo trực tiếp với nhau.
- **Bộ Lọc An Hòa:** Hệ thống tự động lọc bỏ các ngôn từ kích động, thô tục, giữ cho không gian pháp đàm luôn trang nghiêm và hòa ái.

---

## 8. Cửa Hàng Cổ Tự & Túi Đồ Hành Giả (Shop & Inventory)

Nơi trang bị cổ phục và thỉnh pháp bảo bằng MC Coin.

### Cổ Phục Truyền Thống Các Nước
Khoác lên mình bộ trang phục truyền thống giúp thay đổi ngoại hình 3D của nhân vật:
- **Áo Tràng Lam Cổ Tự:** Trang phục mặc định trang nhã thanh tịnh.
- **Việt Phục Áo Tấc / Nhật Bình (Việt Nam):** Nét đẹp cung đình truyền thống triều Nguyễn.
- **Cổ Phục Chut Thai (Thái Lan):** Dải lụa vàng ánh kim mang phong cách xứ sở Chùa Vàng.
- **Kimono Cổ Điển (Nhật Bản):** Họa tiết hoa anh đào thanh nhã xứ Phù Tang.
- **Hanbok Tôn Quý (Hàn Quốc):** Tà áo truyền thống trang trọng.
- **Trang Phục Thiền Sư Tây Tạng:** Sắc áo đỏ thẫm ấm áp vùng cao nguyên tuyết trắng.

### Lễ Phẩm Chiêm Bái
- **Trầm Hương Thượng Hạng:** Thắp hương trước án Phật, tích lũy phước lành.
- **Đèn Hoa Sen Cầu An:** Thả trôi trên mặt nước hồ chùa.
- **Đèn Trời Khai Vận:** Thắp sáng ước nguyện bay lên bầu trời đêm tĩnh lặng.
- **Chuỗi Tràng Hạt Bồ Đề 108 Hạt:** Pháp khí niệm Phật định tâm.
- Mọi vật phẩm thỉnh được lưu trong **Túi Đồ Hành Giả (Inventory)** để sử dụng trực tiếp hoặc dùng thay thế phí gieo quẻ.

---

## 9. Bộ Thẻ Bài Di Sản Cổ Tự (Heritage Cards & Gacha)

Tính năng sưu tập thẻ bài 3D tôn vinh các ngôi chùa cổ nghìn năm tuổi của Việt Nam và thế giới:
- **Độ Hiếm:** Phổ Thông (Common - viền bạc), Quý Hiếm (Rare - viền lam), Sử Thi (Epic - viền tím), Huyền Thoại (Legendary - viền vàng kim lấp lánh).
- **Mở Gói Chiêm Bái (Gacha):** Dùng MC Coin để thỉnh gói thẻ ngẫu nhiên với hiệu ứng bóc thẻ 3D lộng lẫy.
- **Nội Dung Thẻ:** Mỗi thẻ gồm hình ảnh 3D phục dựng ngôi chùa cổ, niên đại lịch sử, kinh kệ khai sáng và tệp âm thanh thuyết minh di sản song ngữ.
- **Tương Lai Web3:** Các thẻ bài Huyền Thoại sẵn sàng được đúc (mint) thành Cardano CIP-68 NFT trên chuỗi khối.

---

## 10. Ví Web3 Cardano & Công Nghệ Sổ Cái Hydra L2

Hệ thống hạ tầng bảo đảm tính an toàn, bảo mật và công khai của dòng tài chính công đức:
- **Đăng Nhập Chuẩn CIP-8:** Ký thông điệp xác thực chủ sở hữu ví an toàn tuyệt đối mà **không tốn một đồng phí mạng nào**.
- **Nạp MC Một Chiều Bằng ADA:** Tỷ lệ quy đổi cố định **`1 ADA = 1.000 MC`**. Mọi giao dịch được ghi nhận trực tiếp vào ví Treasury của chùa qua Blockfrost Indexer.
- **Hydra L2 Head Micro-Transactions:**
  - Gieo quẻ và cúng dường bằng MC được đồng bộ tức thì lên kênh trạng thái Hydra Head L2 với tốc độ dưới 1 giây và phí gas bằng 0.
  - Mỗi quẻ gieo có mã biên nhận `receiptHash` và bằng chứng `Hydra Proof` (số snapshot, mã băm giao dịch L2) giúp người chơi kiểm tra tính minh bạch và chống chỉnh sửa kết quả.

---

## 11. Bảng Tóm Tắt Phím Tắt Nhanh Cho Hành Giả

| Phím Tắt | Chức Năng Nhanh |
|---|---|
| **W, A, S, D** | Di chuyển nhân vật Hành Giả bước đi trong chùa. |
| **Shift** | Giữ để chạy nhanh. |
| **Space** | Nhảy / Bước lên bậc tam cấp. |
| **Chuột Trái** | Khóa con trỏ chuột vào giữa màn hình để xoay camera 360°. |
| **ESC** | Nhả con trỏ chuột để thao tác bấm nút trên giao diện. |
| **F5 / V** | Chuyển đổi qua lại giữa góc nhìn thứ nhất (FPP) và góc nhìn thứ ba (TPP). |
| **M** | Tự động đi tới bồ đoàn gần nhất và bắt đầu Tọa Thiền 432Hz. |
| **Enter** | Mở ô gõ tin nhắn Pháp Đàm trò chuyện cộng đồng. |

---

*Chúc quý đạo hữu có những giây phút an lạc, thân tâm an tịnh và gặt hái nhiều phước lành chánh niệm khi chiêm bái tại Vạn Cảnh Thiền Tự!*

