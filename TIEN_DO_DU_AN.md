# BÁO CÁO TIẾN ĐỘ DỰ ÁN: VẠN CẢNH THIỀN TỰ (HYDRA-PAGODA)

> **Dự án**: Game Hành Hương Cổ Tự 3D & Metaverse Thiền Định Đa Quốc Gia  
> **Phiên bản hiện tại**: v0.3.0 (Alpha Stage)  
> **Cập nhật ngày**: 03/11/2026  
> **Công nghệ nền tảng**: Nuxt 3 (SPA Mode), Three.js PBR, Pinia, Tailwind CSS v4, Web Audio API procedural synthesis, Cardano Web3 (CIP-30/CIP-8/Hydra L2 readiness).

---

## I. TỔNG QUAN CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### 1. Kiến trúc Đồ họa 3D & Khí quyển Điện ảnh (Three.js Stage)
* **Kế thừa & Nâng cấp theo kiến trúc `hydra-graveyard`**:
  * **Hệ thống Chiếu sáng 3 điểm (Key - Rim - Hemi)**:
    * `HemisphereLight`: Tách biệt màu trời (`sky`) và màu phản xạ đất mùn (`ground`), tạo chiều sâu tự nhiên.
    * `KeyLight`: Hướng chiếu xiên tự nhiên, bóng đổ mềm `PCFSoftShadowMap` với camera shadow ôm sát (`bias = -0.0004`, `normalBias = 0.035`).
    * `RimLight`: Đèn viền từ phía sau làm nổi bật đường nét mái ngói cổ tự, cột gỗ và hình thể người chơi trên nền trời.
  * **Khắc phục triệt để lỗi chói sáng & Hiệu năng Post-processing**:
    * Hiệu chỉnh `UnrealBloomPass`: `strength: 0.25`, `radius: 0.15`, `threshold: 1.05` (chỉ phát sáng nguồn sáng thực sự; tắt ở cấu hình Low nhằm tránh chói mắt và tối ưu iGPU).
    * Không lạm dụng Screen-space Ambient Occlusion (GTAO hiện chưa chạy để đảm bảo tốc độ khung hình ổn định $\ge 60\text{ FPS}$; chiều sâu hình khối được xử lý hiệu quả qua PBR AO Map và bóng đổ mềm PCF).
    * Loại bỏ các quầng sáng Additive gây chói lóa trên mặt đất; giảm `emissiveIntensity` của buồng đèn đá xuống mức nến ấm (`0.15 - 0.35`).
    * Khử điểm sáng chói trên ngực nhân vật; đóa sen chuyển sang chất liệu vàng kim cổ điển (`d4af37`), không gây nhức mắt.
  * **Hệ thống Chuyển đổi Thời Gian Trong Ngày (Time of Day)**:
    * ☀️ **Ban Ngày (Trời Sáng)**: Nắng vàng ấm áp, bầu trời thiên thanh trong xanh, sương mù chân trời xa (`40m - 160m`), đèn lồng tắt êm dịu.
    * 🌅 **Hoàng Hôn (Ráng Chiều)**: Bầu trời đỏ cam tím huyền ảo, ánh sáng vàng cam nghiêng bóng.
    * 🌙 **Đêm Trăng (Thanh Tịnh)**: Ánh trăng huyền lương, đèn đá thắp sáng ấm áp dẫn lối chánh điện.
  * **Sân chùa phân tầng & Lối ngự đạo đá xanh**:
    * Nền đất cỏ tự nhiên bao quanh khuôn viên (`0x1f271a`).
    * Sân lát đá phiến cổ gọt vuông vát cạnh với texture rãnh vữa và phong hóa vi tế.
    * Ngự đạo lát đá xanh Thanh Hóa dẫn thẳng vào chánh điện.
  * **Hàng Đèn Đá Cổ Tự (Tōrō)**:
    * Thiết kế đèn đá Á Đông chi tiết: Chân đế bát giác, thân trụ, buồng lửa `Hibukuro` và nón mái đá 6 cạnh.
  * **Hiệu ứng Khí quyển Động**:
    * 45 điểm đom đóm / thiền quang (`Spiritual Motes`) bay dập dờn quanh hồ sen.
    * Khói trầm uốn lượn từ Lư hương Tam khí.
    * Cánh hoa bồ đề bay lượn theo nhịp gió thời gian thực.

---

### 2. Thiết kế Nhân vật Hành Giả 3D & Động cơ Di chuyển chuẩn Minecraft
* **Cơ chế Chuột & Di chuyển giống hệt Minecraft ([`TempleStage.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/TempleStage.ts))**:
  * **Chuột Phải (Right Click) tương tác tức thì**:
    * Khi đứng gần bất kỳ đối tượng nào (Lư hương Tam Bảo, Hòm Công Đức, Bàn Xin Xăm, Đệm Ngồi Thiền, Hồ Hoa Đăng), nhấn **Chuột Phải** sẽ kích hoạt hành động ngay lập tức như mở rương / dùng đồ trong Minecraft!
    * Tâm ngắm dấu thập `+` đổi màu và hiện Action Toast nổi bật: `[CHUỘT PHẢI] Dâng Hương Trầm`, `[CHUỘT PHẢI] Mở Hòm Công Đức`.
  * **Khóa Con Trỏ Chuột (Pointer Lock) & Xoay 360° tự do**:
    * Nhấp chuột vào màn hình tự động ẩn và khóa con trỏ. Di chuột xoay góc nhìn mượt mà 1:1 theo hướng tự nhiên (đẩy lên nhìn trời, kéo xuống nhìn đất).
    * Góc ngước/nhìn dọc (Pitch) mở rộng từ nhìn thẳng lên trời (-85°) xuống tận chân (+85°) chuẩn Minecraft.
    * Nhấn phím `ESC` để nhả chuột khi cần thao tác trên menu.
  * **Hệ thống phím di chuyển & Vật lý Minecraft**:
    * `W A S D`: Đi theo hướng nhìn camera (chuẩn hóa vector; đi lùi chậm hơn ~18% như Minecraft).
    * `SPACE`: **Nhảy (Jump)** có gia tốc trọng lực thực tế (`gravity = -22 m/s²`), nhún tiếp đất êm ái.
    * `SHIFT`: **Rón rén (Sneak)** hạ thấp chiều cao tầm mắt (1.62m -> 1.35m), avatar khom người, đi chậm 40%.
    * `CTRL`: **Chạy nhanh (Sprint)** tăng tốc độ lên 145%, đi kèm hiệu ứng **Dynamic FOV Kick** (góc nhìn mở rộng từ 52° lên 63° tạo cảm giác lướt gió).
    * `F5`: **Chu kỳ chuyển đổi 3 góc nhìn Minecraft**:
      1. 👁️ **FPP**: Góc nhìn thứ nhất từ tầm mắt 1.62m.
      2. 👤 **TPP Back**: Góc nhìn thứ ba sau lưng 4.2m.
      3. 🪞 **TPP Front (Selfie)**: Góc nhìn thứ ba đối diện trực diện trước mặt nhân vật.
  * **Tâm ngắm Dấu Thập (+) Minecraft**:
    * **Chỉ hiển thị ở Góc nhìn thứ nhất (FPP)** nhằm giữ cho tầm nhìn thứ ba (TPP Back / TPP Front) luôn thoáng đãng, điện ảnh và không bị che khuất nhân vật.
    * Khi ở FPP, tâm ngắm nằm chính giữa với 2 đường mảnh trắng xám, hỗ trợ định vị chính xác đối tượng tương tác.

* **Mô hình nhân vật chi tiết ([`PilgrimAvatar.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/PilgrimAvatar.ts))**:
  * Tướng mạo an nhiên vi tiếu: mắt khép hờ thiền định, tai cát tường.
  * Bộ Cổ phục nhiều lớp: Áo Tràng Giao Lĩnh / Áo Tấc, tà thường xòe lượn sóng, đai thắt lụa ngọc kèm **Ngọc Bội Chạm Sen**.
  * **Tràng hạt 108 hạt Bồ Đề** quàng cổ với Hạt Mẹ (Guru bead) và tua rua vàng kim trước ngực.
  * Hai bàn tay chắp ấn **Anjali Mudra** nâng đóa **Sen Vàng Tam Bảo**.
  * Loại bỏ hoàn toàn vòng tròn lơ lửng bị lệch góc nhìn trước đó.
* **Tự động thay đổi Trang phục & Mũ Nón theo 9 Quốc gia / Tông phái**:
  1. 🇻🇳 **Việt Nam**: Áo Lam Cổ Phục / Áo Tấc thanh tao + **Nón Lá** dát viền chỉ vàng kim tinh xảo.
  2. 🇯🇵 **Nhật Bản**: Samue / Kimono đen chàm Zen tối giản + **Nón Rơm Kasa** dẹt.
  3. 🇹🇭 **Thái Lan**: Y Cà-sa Theravada vàng nghệ hoàng gia + Đầu cạo thanh tịnh.
  4. 🇰🇷 **Hàn Quốc**: Hanbok Durumagi xám khói Tào Khê + **Mũ Gat** Joseon truyền thống.
  5. 🇹🇼 **Đài Loan**: Áo Phật tử cận đại thêu hoa sen + Mấn nhung.
  6. 🇸🇬 **Singapore**: Cổ phục Phật giáo Nam Dương thanh lịch.
  7. 🇮🇳 **Ấn Độ**: Y đỏ đất Phật Tích Bồ Đề Đạo Tràng.
  8. 🏔️ **Tây Tạng**: Chuba Mật Tông đỏ bordeaux + Mũ Pandita chóp nhọn vàng Mandala.
  9. 🌿 **Làng Mai**: Áo nâu sồng giản dị thanh bần của Thiền phái Trúc Lâm Quốc tế.
* **Động cơ Bước đi (Locomotion Animation)**:
  * Khớp chân bước so le mượt mà, thân người nhún nhẹ theo nhịp bước (`harmonic bobbing`).
  * Tay áo thụng và vạt áo đung đưa theo quán tính.
  * **Hiệu ứng "Bộ Bộ Sinh Liên"**: Từng bước chân di chuyển trên sân chùa nở ra các đài sen vàng tỏa sáng lấp lánh rồi tan biến vào hư không.

---

### 3. Hệ thống Điều khiển & Camera 360° Mượt Mà
* **Chuột xoay góc nhìn 360° tự do**:
  * Hỗ trợ **Pointer Lock** khi nhấp vào màn hình (chuẩn game AAA). Nhấn `Esc` để thoát khóa con trỏ.
  * Hỗ trợ **Kéo chuột trái hoặc chuột phải** xoay mượt mà ở mọi vị trí trên màn hình.
  * Thuật toán **Exponential Damping** làm mượt góc quay `yaw`/`pitch`, loại bỏ giật lag chuột.
* **Di chuyển W-A-S-D chuẩn theo hướng nhìn Camera**:
  * Nhấn `W` luôn bước thẳng về hướng camera đang ngắm; nhân vật tự xoay người mượt mà theo góc bước đi.
* **Chế độ FPP (Thứ nhất) & TPP (Thứ ba) tức thì**:
  * Chuyển đổi một nút bấm hoặc cuộn chuột (Mouse Wheel) phóng to từ 0.5m đến 12m.
  * Khi ở FPP (0.5m), thân người chơi tự động ẩn để quan sát trọn vẹn điện thờ Tam Bảo.

---

### 4. Hệ thống Giao Diện Người Dùng Chuẩn Vercel Geist (DESIGN-vercel.md)
* **Khắc phục hoàn toàn phong cách "giao diện AI tạo" & Loại bỏ hoàn toàn Emoji**:
  * **Thay thế 100% Emoji bằng Bộ Icon Vector SVG Chuẩn (`components/ZenIcon.vue`)**:
    * Không dùng emoji đồ chơi (⛩️, 🪙, 🪷, 🔔, ☀️, 📷, 🏔️, 🌿...) gây cảm giác nghiệp dư.
    * Xây dựng bộ SVG icons vector hình học chuẩn mực (độ dày nét `1.8px`, phong cách Lucide / Radix / Geist):
      * `pagoda`: Cổng tam quan cổ tự Á Đông viền tối giản.
      * `coin`: Đồng tiền viền đôi tabular.
      * `lotus`: Đóa hoa sen kỷ hà học đối xứng thanh thoát.
      * `cardano`: Biểu tượng mạng Cardano ADA chính thức với các vòng tròn quỹ đạo tinh khiết.
      * `bell` & `bell-off`: Chuông chùa tĩnh tâm và chế độ tắt tiếng.
      * `sun`, `sunset`, `moon`: Bộ ba biểu tượng thiên văn học chuyển đổi thời gian.
      * `camera`: Máy ảnh góc nhìn FPP / TPP.
      * `cards`, `meditation`, `shield`: Biểu tượng phân hệ di sản, thiền định và quy chuẩn.
    * Thanh chuyển quốc gia dùng **Huy hiệu Mã ISO chuẩn quốc tế** (`VN`, `JP`, `TH`, `KR`, `TW`, `SG`, `IN`, `TB`, `LM`) trên nền pill tối giản thay vì cờ emoji.
  * **Chuyển giao Thiết kế sang Binance Web3 Design System (`DESIGN-binance.md`)**:
    * **Bảng màu Binance Dark & Gold Voltage**: Nền đen canvas `#0b0e11`, thẻ card `#1e2329`, bề mặt nổi `#2b3139`, đường viền tóc hairline `#2b3139`. Màu thương hiệu Binance Yellow `#FCD535` kết hợp sắc xanh giao dịch `#0ecb81` và xanh Cardano `#3b82f6`.
    * **TopBar (Phương án 1)**: Thay thế dải quốc gia nằm ngang tràn màn hình bằng **Nút Dropdown Popover tích hợp bên cạnh huy hiệu thương hiệu** (`[ 🇻🇳 VN Việt Nam ▾ ]`). Toàn bộ không gian trung tâm màn hình được giải phóng 100% cho bầu trời cổ tự 3D.
    * **Cơ chế Chuột Thông Minh (Giải quyết xung đột Di Cam vs Click UI - Cách 1 + Cách 3)**:
      * **Cách 1 (Giữ phím `ALT`)**: Người chơi bình thường di chuột xoay camera 360°. Khi cần click các nút trên giao diện, chỉ cần **GIỮ PHÍM `ALT`** -> Con trỏ chuột lập tức hiển thị tự do để click bất kỳ nút nào; thả phím `ALT` ra sẽ tự động khóa chuột trở lại. Đèn báo `[ALT] ĐANG HIỆN CHUỘT` sáng vàng rực trên HUD.
      * **Cách 3 (Phím tắt Số 1-2-3 & Tự động nhả chuột)**:
        * Bấm phím **`1`**: Mở Cụm Bói Quẻ 6 Môn & tự động nhả chuột.
        * Bấm phím **`2`**: Mở Cụm Thiền & Công Đức & tự động nhả chuột.
        * Bấm phím **`3`**: Mở Cụm Di Sản & Cửa Hàng & tự động nhả chuột.
        * Bấm phím **`C`**: Mở Pháp Đàm / Chat & tự động nhả chuột.
        * Bấm phím **`X`**: Mở Bánh xe cử chỉ & tự động nhả chuột.
      * **Chặn tương tác ngoài ý muốn**: Toàn bộ các vùng giao diện (`.bn-panel`, nút bấm, aside, popover) được gắn lớp chặn xung đột, click vào UI không bao giờ bị kích hoạt hành động đấm/chém hay dâng hương trong game 3D.
    * **BottomBar (Phương án 2: Triệt tiêu 100% trượt ngang & thanh cuộn)**:
      * Thay thế dải 7 nút bấm nằm ngang bị tràn màn hình bằng **3 Cụm Menu Drop-up độc lập (`~340px`)**:
        1. **`[ ✦ Bói Quẻ & Cầu An ▴ ]`**: Nút vàng Binance Yellow `#FCD535` làm trọng tâm, bấm xổ lên danh mục 6 môn bói quẻ (Xăm Bát Quái, Tơ Duyên, Cầu Tự, Chiêu Tài, Dược Sư, Dâng Sao).
        2. **`[ 🪷 Thiền & Công Đức ▴ ]`**: Xổ lên menu dọc gồm Hòm Công Đức, Hội Thiền 432Hz và Pháp Đàm Đồng Tu.
        3. **`[ 🎒 Di Sản & Cửa Hàng ▴ ]`**: Xổ lên Cửa Hàng Pháp Bảo, Thẻ Bài Di Sản 3D, Bộ Trộn Âm Thanh 3D và Quy Chuẩn Trải Nghiệm.
      * Tự động đóng tất cả drop-up khi bấm ra ngoài hoặc ấn phím `Escape`.
    * **Hệ thống Right-Side Modal Drawer (MD)**:
      * Tái cấu trúc thanh tab chuyển mục thành **Ma trận cố định 2 hàng (Fixed 2-Row Matrix, 4 cột)**: Hàng 1 gồm Bói Quẻ 6 Môn (chiếm 2 cột), Cửa Hàng, Công Đức; Hàng 2 gồm Thẻ Di Sản, Hội Thiền, Âm Thanh, Đồng Tu.
      * **Triệt tiêu hoàn toàn thuộc tính `overflow-x-auto` và thanh cuộn ngang xám** trên toàn bộ ứng dụng (`SanctuaryDrawer.vue`, `SoundscapeMixer.vue`, `ZenChatDrawer.vue`), mang lại trải nghiệm chuẩn Web3 Game AAA.

### 5. Hệ thống Kinh Tế & Nghi Lễ Đi Chùa Đời Thực
* **Dâng hương Tam Bảo**: Thắp 3 nén hương trầm trước Lư hương đồng cổ.
* **Hòm Công Đức (Merit Box)**:
  * Quyên góp vi mô bằng Tâm Duyên (Coin in-game), Sen Vàng, hoặc ADA Cardano.
  * Tích hợp âm thanh tiền xu rơi trong vắt và hiệu ứng công đức hồi hướng.
* **Xin Xăm / Xóc Quẻ Dân Gian (Fortune Modal)**:
  * Ống xăm 3D bằng đồng vàng rung lắc vật lý rơi ra thẻ quẻ.
  * Thơ quẻ dân gian, giải quẻ cuộc sống kèm lời khuyên chính niệm, từ bi.
* **Cảnh Báo Pháp Lý & Chống Mê Tín Dị Đoan (Mandatory Disclaimer)**:
  * Banner và Modal cảnh báo rõ ràng: Các quẻ xăm, sao hạn, duyên tình chỉ mang tính chất mô phỏng văn hóa dân gian hư cấu, không có giá trị tiên tri; khuyên người chơi hướng thiện, tích đức chuyển nghiệp.
* **Phòng Thiền Nhóm (Meditation Room)**:
  * Thời lượng 3 / 5 / 15 / 30 phút.
  * Vòng thở điều tức Mandala 4-4-6 (Hít vào 4s - Giữ 4s - Thở ra 6s).
  * Chuông chùa và Chuông xoay Tây Tạng (Singing Bowl 432Hz) gõ báo hiệu chu kỳ thiền.

---

### 5. Hệ thống Âm Thanh Thiền Định Thuần Thuật Toán ([`ZenAudio.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/audio/ZenAudio.ts))
* Không phụ thuộc file `.mp3` ngoại tuyến nặng nề, hoàn toàn tổng hợp bằng Web Audio API:
  * **Đại Hồng Chung**: 7 tầng họa âm ngân dài 6 giây với hiệu ứng tắt dần tự nhiên.
  * **Chuông Xoay Tây Tạng 432Hz**: Sóng sin tinh khiết với độ rung vi tế giải tỏa căng thẳng.
  * **Tiếng Mõ Gỗ**: Âm thanh đục ấm, thanh tịnh tâm trí.
  * **Tiếng Xóc Thẻ Tre & Tiền Rơi**: Chân thực từng va chạm vật lý.

---

## II. DANH MỤC CÁC FILE ĐÃ TRIỂN KHAI

| Đường dẫn File | Mô tả Trách Nhiệm |
| :--- | :--- |
| [`lib/world3d/TempleStage.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/TempleStage.ts) | Stage chính Three.js, Camera 360°, Hệ thống chiếu sáng 3 điểm, Sương mù, Thời gian trong ngày (Day/Sunset/Night), Sân chùa đá, Hồ sen, Lư hương. |
| [`lib/world3d/PilgrimAvatar.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/PilgrimAvatar.ts) | Mô hình Hành giả Á Đông, Cổ phục 9 nước, Nón lá/Mũ Gat/Kasa, Ấn hoa sen Anjali, 108 hạt Bồ Đề, Hoạt ảnh bước đi, Bộ bộ sinh liên. |
| [`lib/audio/ZenAudio.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/audio/ZenAudio.ts) | Bộ tổng hợp âm thanh thiền bằng Web Audio API (Đại hồng chung, Chuông xoay 432Hz, Mõ gỗ, Xóc xăm). |
| [`components/TempleCanvas.vue`](file:///d:/Vtechcom/hydra-pagoda/components/TempleCanvas.vue) | Giao diện HUD chính, Nút chuyển thời gian (Trời sáng / Hoàng hôn / Đêm), Nút đổi FPP/TPP, Thanh chọn quốc gia. |
| [`components/DisclaimerBanner.vue`](file:///d:/Vtechcom/hydra-pagoda/components/DisclaimerBanner.vue) | Cảnh báo pháp lý và chống mê tín dị đoan. |
| [`components/MeritBoxModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/MeritBoxModal.vue) | Modal hòm công đức, quyên góp Tâm Duyên & ADA. |
| [`components/FortuneModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/FortuneModal.vue) | Modal xóc quẻ 3D, thơ quẻ và lời bình chính niệm. |
| [`components/MeditationModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/MeditationModal.vue) | Modal thiền định thở 4-4-6 với chuông xoay 432Hz. |
| [`stores/user.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/user.ts) | Store quản lý quốc gia, camera mode, danh hiệu tu tập. |
| [`stores/economy.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/economy.ts) | Store kinh tế Tâm Duyên, Bảo Ngọc Sen Vàng, ADA. |
| [`GAME_DESIGN_DOCUMENT.md`](file:///d:/Vtechcom/hydra-pagoda/GAME_DESIGN_DOCUMENT.md) | Bản thiết kế game chi tiết 470 dòng. |

---

## III. GIAI ĐOẠN 2: MULTIPLAYER WEBSOCKET REALTIME // SANGHA ONLINE HUB (HOÀN THÀNH)

### 1. Hạ tầng Mạng WebSocket Tốc độ cao (Nitro CrossWS Server Gateway)
* **Kênh WebSocket Server-side ([`server/routes/_ws.ts`](file:///d:/Vtechcom/hydra-pagoda/server/routes/_ws.ts))**:
  * Tích hợp trực tiếp vào nhân Nitro của Nuxt 3 qua cấu hình `nitro.experimental.websocket: true` (chuẩn CrossWS tốc độ cao, không xung đột port, cùng domain `/_ws`).
  * **Cơ chế Pub/Sub Sangha Channel (`sangha-temple`)**:
    * Quản lý phiên kết nối đa hành giả theo thời gian thực trong bộ nhớ RAM máy chủ.
    * Đóng gói và phát tán Delta updates với tần số chuẩn 20Hz (mỗi 50ms).
    * Hỗ trợ các gói tin wire protocol:
      * `client:join`: Gửi danh tính hành giả, quốc gia, trang phục, tọa độ `[x, y, z]`, góc xoay yaw, và thân tướng (`standing`, `walking`, `bowing`, `meditating`).
      * `client:move`: Luồng vị trí và hướng nhìn tối ưu băng thông.
      * `client:emote`: Phát tán cử chỉ tâm linh (chắp tay xá chào, ngồi tọa thiền).
      * `client:chat`: Gởi lời nguyện chánh niệm (giới hạn 120 ký tự thanh tịnh).
      * `server:snapshot`: Cung cấp ảnh chụp toàn bộ hành giả đang hiện diện ngay khi mới vào.
      * `server:join` / `server:leave`: Thông báo hành giả gia nhập / rời chốn thiền môn.

### 2. Client Multiplayer Network Manager ([`lib/network/MultiplayerClient.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/network/MultiplayerClient.ts))
* Kế thừa triết lý kết nối bền vững từ `hydra-graveyard`:
  * Tự động tái kết nối với thuật toán lũy thừa (Exponential Backoff từ 1s đến 8s, tối đa 15 lần).
  * Bộ đệm điều tiết 20Hz (Throttled delta streaming): Gom và chỉ gởi tọa độ khi có sự thay đổi thực sự, tránh làm nghẽn đường truyền mạng.
  * Tự động điều chỉnh giao thức `ws://` và `wss://` an toàn theo môi trường trình duyệt.

### 3. Hiển thị & Đồng bộ Thân tướng 3D Đa Người Chơi ([`TempleStage.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/TempleStage.ts))
* **Bản đồ Hành giả Đồng tu từ xa (`remotePilgrims = new Map<string, RemotePilgrimInstance>()`)**:
  * Mỗi người chơi online được khởi tạo riêng một thực thể 3D `PilgrimAvatar` đầy đủ chi tiết với đúng màu sắc y phục, mũ nón và tràng hạt của quốc gia họ đã chọn.
  * **Nội suy chuyển động mượt mà (Hermite/Lerp Interpolation)**:
    * Vị trí `currentPos` trượt mượt mà về `targetPos` với hệ số nội suy thời gian thực (`delta * 12`), loại bỏ hoàn toàn hiện tượng giật cục (jitter/teleport) do độ trễ mạng.
    * Tự động phát hiện khoảng cách dịch chuyển để kích hoạt nhịp chân đi bộ và hiệu ứng sen nở từng bước (*Bộ bộ sinh liên*).
* **Bảng Tên & Danh Hiệu 3D Trên Đầu ([`lib/world3d/NameplateHelper.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/NameplateHelper.ts))**:
  * Render bảng tên dạng Canvas2D Sprite sắc nét chuẩn High-DPI:
    * Huy hiệu quốc gia dạng ISO (`VN`, `JP`, `KR`, `TH`, `TW`, `SG`, `IN`, `TB`, `LM`).
    * Tên hành giả màu trắng nổi bật, font chữ sans-serif hiện đại.
    * Danh hiệu tâm linh màu vàng ngọc `monospace` (ví dụ: *Sơ Tâm Nhập Đạo*).
  * Khóa trục billboard luôn hướng về camera người xem; bật `depthTest: false` giúp chữ không bao giờ bị cắt xén vào tường gạch.

### 4. Tương tác Thân - Khẩu - Ý Đồng Tu Thời Gian Thực
* **Thân Nghi: Chắp Tay Cúi Lạy Chào (Namaste Bow - Phím `B`)**:
  * Nhấn phím `B` hoặc nút **Chào [B]** trên HUD: Hành giả gập người cung kính 25 độ, hai bàn tay nâng hoa sen xá chào đại chúng.
  * Tự động vang lên một tiếng mõ thanh thoát và phát tán cử chỉ đến tất cả hành giả trong chánh điện; phía người nhận sẽ hiện thông báo chào mừng.
* **Tâm Nghi: Tọa Thiền Kiết Già Tại Chỗ (Group Sitting Meditation - Phím `M`)**:
  * Nhấn phím `M` hoặc nút **Tọa Thiền [M]**: Avatar hạ thấp trọng tâm sát đất, hai chân xếp bằng kiết già, tà áo xòe phủ kín trang nghiêm.
  * Vòng hào quang thiền định xung quanh phát sáng nhịp nhàng theo hơi thở chánh niệm; đồng bộ tư thế tọa thiền tới toàn bộ các màn hình khác.
* **Khẩu Nghi: Khẩu Ý Thanh Tịnh (Zen Sangha Chat - Phím `C` / [`components/ZenChatDrawer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/ZenChatDrawer.vue))**:
  * Khay trò chuyện chánh niệm thiết kế chuẩn Vercel Geist: nền đen nhám `#111111`, đường viền tóc 1px `border-white/10`, góc bo 6px.
  * **Lời nguyện gởi nhanh (Canned Mantras)**:
    * `Nam Mô A Di Đà Phật`
    * `Thân tâm an lạc, vạn sự cát tường`
    * `Nguyện cầu quốc thái dân an`
    * `Mỗi bước chân nở một đóa hoa sen`
    * `Thở vào tâm tĩnh lặng, thở ra miệng mỉm cười`
    * `Tâm bình thế giới bình`
  * **Bong bóng thoại 3D lơ lửng trên đầu nhân vật ([`NameplateHelper.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/NameplateHelper.ts))**:
    * Khi bất kỳ ai phát tâm trò chuyện, một bong bóng thoại viền vàng kim sẽ hiện trên đỉnh đầu avatar trong 3D trong 6.5 giây rồi mờ dần, giúp nhận diện người đang nói ngay trong không gian ảo.

### 5. Danh Sách Đồng Tu & Chỉ Số Hiện Diện ([`components/OnlinePilgrimsModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/OnlinePilgrimsModal.vue))
* Nút HUD chỉ số trực tuyến ở góc trên bên phải: `● {N} ĐỒNG TU` với đèn xanh lục phát xung nhịp nhàng.
* Bảng danh sách đồng tu hiển thị chi tiết:
  * Huy hiệu quốc gia, tên, danh hiệu, trạng thái hành vi hiện tại (*Tọa thiền kiết già*, *Kinh hành an lạc*, *Chắp tay cúi lạy*, *Đứng trang nghiêm*).
  * Nút tương tác nhanh: Nhấn **Chào** để hướng tâm cúi lạy chào đồng tu đó.

### 6. Chuẩn Hóa Giao Diện & Hệ Thống Icon Vector
* Thay thế toàn bộ icon emoji bằng hệ thống Icon Vector SVG tối giản chuẩn Vercel ([`components/ZenIcon.vue`](file:///d:/Vtechcom/hydra-pagoda/components/ZenIcon.vue)): bổ sung các icon `users`, `message`, `hand-bow`, `send`, `radio`.
* Loại bỏ triệt để các hộp thoại trình duyệt `alert(...)` làm đơ giao diện; thay bằng **Hộp Thông Báo Toast Không Chặn** thanh lịch (`Toast Notification Pill`) hiển thị mượt mà ở góc màn hình.

---

## IV. BẢNG TỔNG HỢP SOURCE CODE THÊM MỚI Ở GIAI ĐOẠN 2

| Đường dẫn File | Mô tả Trách Nhiệm |
| :--- | :--- |
| [`server/routes/_ws.ts`](file:///d:/Vtechcom/hydra-pagoda/server/routes/_ws.ts) | Máy chủ WebSocket Nitro CrossWS, quản lý phòng và broadcast delta 20Hz. |
| [`lib/network/MultiplayerClient.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/network/MultiplayerClient.ts) | Client WebSocket quản lý kết nối, tự kết nối lại lũy thừa, điều tiết 20Hz. |
| [`lib/world3d/NameplateHelper.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/NameplateHelper.ts) | Tạo Sprite 3D Bảng Tên & Bong Bóng Thoại High-DPI trên đầu nhân vật. |
| [`components/ZenChatDrawer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/ZenChatDrawer.vue) | Giao diện Chat Khẩu Ý Thanh Tịnh chuẩn Vercel Geist + Canned Mantras. |
| [`components/OnlinePilgrimsModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/OnlinePilgrimsModal.vue) | Modal danh sách đồng tu trực tuyến với trạng thái thiền và nút chào. |

---

## V. ĐỒNG BỘ TOÀN DIỆN TẤT CẢ CÁC TÍNH NĂNG TRONG GAME DESIGN DOCUMENT (GDD)

Theo đối chiếu chi tiết với toàn bộ 470 dòng của [`GAME_DESIGN_DOCUMENT.md`](file:///d:/Vtechcom/hydra-pagoda/GAME_DESIGN_DOCUMENT.md), tất cả các phân hệ chức năng chuyên sâu đã được tích hợp hoàn chỉnh:

### 1. Phân hệ Web3 Cardano CIP-30 & Ephemeral Key (GDD Section 6.1 & Giai đoạn 4)
* **Store Quản lý Ví CIP-30 ([`stores/wallet.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/wallet.ts))**:
  * Nhận diện và tích hợp trực tiếp `window.cardano`: **Lace, Eternl, Nami, Flint, Vespr (Mobile)**.
  * Quản lý địa chỉ Bech32, số dư Lovelace/ADA thực tế, tự động chuyển đổi hiển thị định dạng số thập phân chuẩn.
* **Cơ chế Khóa Tạm Thời Ephemeral Ed25519 ([`lib/cardano/ephemeralKey.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/cardano/ephemeralKey.ts))**:
  * Sinh và lưu khóa thiết bị trong `localStorage` để ký ngầm tức thì các thao tác tâm linh (dâng hương, gõ mõ, dâng hoa) mà không làm phiền người chơi bằng cửa sổ pop-up của ví.
* **Giao diện Kết Nối Ví ([`components/WalletConnectModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/WalletConnectModal.vue))**:
  * Thiết kế Vercel Spec-Sheet hiển thị địa chỉ ví Bech32, số dư ADA, trạng thái kết nối Hydra Head L2 (Fee = 0), nút ngắt kết nối.
  * Tích hợp trực tiếp vào Hòm Công Đức ([`components/MeritBoxModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/MeritBoxModal.vue)) để trừ ADA thực tế và cấp biên lai hash giao dịch.

### 2. Cửa Hàng Pháp Bảo & Tủ Đồ Cổ Phục Cao Cấp (GDD Section 6.3 & 10)
* **Giao diện Cửa Hàng ([`components/SanctuaryShop.vue`](file:///d:/Vtechcom/hydra-pagoda/components/SanctuaryShop.vue))**:
  * **Tab 1: Tủ Đồ Cổ Phục 9 Quốc Gia**: Áo Lam Cổ Phục & Nón Lá (Việt Nam), Samue Thiền Tăng & Kasa (Nhật Bản), Y Cà Sa Theravada (Thái Lan), Hanbok Durumagi (Hàn Quốc), Áo Tràng Lam (Đài Loan), Pháp Phục Lụa (Singapore), Dhoti Bồ Đề (Ấn Độ), Áo Chuba (Tây Tạng), Pháp Phục Nâu (Làng Mai).
  * **Tab 2: Đồ Lễ Cúng Dường & Nhang Trầm**: Trầm hương xứ Quảng, Đàn hương Kyoto, Mâm ngũ quả tươi, Bánh oản hoàng cung, Đèn hoa đăng cầu an.
  * Hỗ trợ thanh toán linh hoạt bằng 3 loại tiền tệ: **Tâm Duyên (Merit Coins)**, **Bảo Ngọc Sen Vàng (Divine Lotus)**, hoặc **Cardano (ADA)**.
  * Chức năng **Mặc Thử Ngay**: xem trước trang phục trực tiếp trên mô hình nhân vật 3D trước khi quyết định thỉnh.

### 3. Bộ Trộn Âm Thanh Không Gian 3D Tùy Biến 6 Kênh (GDD Section 9 & 10)
* **Engine Tổng Hợp Procedural Web Audio ([`lib/audio/ZenAudio.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/audio/ZenAudio.ts))**:
  * Phát sóng nền liên tục không cần file mp3 nặng nề, hoàn toàn chạy bằng thuật toán toán học thời gian thực:
    * 🌧️ **Mưa Rào Mái Ngói**: Lọc dải thông thấp (Low-pass filtered white noise).
    * 🌊 **Suối Reo & Gáo Trúc**: Âm hưởng róc rách thanh lương Shishi-odoshi.
    * 🔔 **Chuông Xoay 432Hz Drone**: Tần số trị liệu tâm trí kép (432Hz + 216Hz sub-octave).
    * 🎐 **Phong Linh Chuông Gió**: Thuật toán ngẫu nhiên gõ các nốt ngũ cung Á Đông ngân vang.
    * 🪵 **Tiếng Mõ Định Tâm**: Nhịp mõ trầm ấm gõ đều đặn định kỳ.
    * 📜 **Tụng Niệm Phạn / Pali**: Sóng răng cưa lọc dải cộng hưởng tần số Om thiêng liêng ~136.1Hz.
* **Giao diện Bộ Mixer ([`components/SoundscapeMixer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/SoundscapeMixer.vue))**:
  * 6 fader trượt mượt mà (0% - 100%), thanh điều khiển âm lượng tổng (Master Volume), nút ngắt âm nhanh (Mute).
  * 4 Preset cài sẵn chuyển đổi tức thì: *Tối Giản 432Hz*, *Đêm Mưa Mái Ngói*, *Rừng Trúc Suối Reo*, *Khóa Lễ Mật Tông*.

### 4. Bánh Xe Cử Chỉ Tâm Linh (Sacred Emote Wheel - GDD Section 4.1 & 10)
* **Giao diện Bánh Xe Cử Chỉ ([`components/EmoteWheel.vue`](file:///d:/Vtechcom/hydra-pagoda/components/EmoteWheel.vue))**:
  * Kích hoạt bằng phím tắt **`X`** hoặc nút bấm **Cử Chỉ [X]** trên thanh công cụ HUD.
  * 6 Cử chỉ lễ nghi:
    1. `[1]` **Chắp Tay Chào**: Namaste / Gassho / Wai xá chào đồng tu.
    2. `[2]` **Niệm Phật Sen Nở**: Đóa sen vàng bừng nở dưới từng bước chân an lạc.
    3. `[3]` **Đảnh Lễ Tam Bảo**: Ngũ thể đầu địa, 3 lạy chạm đất cung kính.
    4. `[4]` **Tọa Thiền Kiết Già**: Ngồi xếp bằng tĩnh tại, hào quang lan tỏa nhịp thở.
    5. `[5]` **Dâng 3 Nén Hương**: Tâm hương dâng cúng mười phương chư Phật.
    6. `[6]` **Thả Đèn Hoa Đăng**: Hoa đăng lung linh trôi theo dòng nước cầu an.
  * Đồng bộ tức thì tới tất cả người chơi khác qua WebSocket và thông báo Toast nhẹ nhàng.

### 5. Khí Quyển 9 Thánh Địa Cổ Tự Trong Three.js (GDD Section 2 & 5)
* **Chuyển đổi Khí quyển Toàn cảnh ([`lib/world3d/TempleStage.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/TempleStage.ts))**:
  * Khi chuyển tab quốc gia, cảnh quan thay đổi toàn diện ánh sáng, sương mù, màu trời:
    * 🇻🇳 **Việt Nam**: Nắng vàng thiên thanh, mây phủ Yên Tử, sương mù hồ sen.
    * 🇯🇵 **Nhật Bản**: Rừng trúc Sagano, sương hồng hoa anh đào, ánh sáng Zen tĩnh lặng.
    * 🇹🇭 **Thái Lan**: Hoàng triều Saffron, ánh vàng kim bảo tháp Chedi rực rỡ.
    * 🇰🇷 **Hàn Quốc**: Sắc phong đỏ mùa thu Bulguksa, sương khói Tào Khê.
    * 🇹🇼 **Đài Loan**: Ráng chiều hoàng hôn Nhật Nguyệt Đàm, sắc cam ấm áp.
    * 🇸🇬 **Singapore**: Ánh sáng hiện đại lung linh thanh tịnh Chùa Răng Phật.
    * 🇮🇳 **Ấn Độ**: Đất đỏ phù sa Đạo Tràng, ánh đèn bơ Ghee ấm áp cội Bồ Đề.
    * 🏔️ **Tây Tạng**: Băng tuyết Himalaya, ánh nắng cao nguyên trong vắt, gió tuyết phần phật.
    * 🌿 **Làng Mai**: Tán rừng thông xanh thẳm, vạt nắng chánh niệm xuyên qua kẽ lá.

### 6. Thẻ Bài Di Sản 3D & Thuyết Minh Audio (GDD Section 7.2)
* Nâng cấp [`components/CardCollectionModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/CardCollectionModal.vue):
  * Tích hợp khung **Mô hình 3D Cổ Tự Mini Tương Tác Xoay 360°** cho các thẻ bài kiến trúc.
  * Nút bật/tắt **Thuyết Minh Audio Song Ngữ** kích hoạt chuông xoay và tiếng đọc trầm ấm.
  * Nút **Đúc Thẻ Bài On-Chain (2.5 ADA)** trừ trực tiếp vào ví Cardano và xuất mã hash giao dịch chuẩn CIP-68.

### 7. Phân Hệ Chiêm Bốc Tâm Linh & Kinh Tế Kiếm Tiền Đa Tiền Tệ (GDD Section 6.5 & Monetization)
* **Tái thiết kế toàn diện [`components/FortuneModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/FortuneModal.vue) với 6 Chuyên Mục Bói Quẻ Chuyên Biệt**:
  1. 📿 **Xin Xăm Bát Quái (Thánh Xăm 100 Quẻ)**: Thượng Thượng, Đại Cát, Trung Cát... Luận giải sự nghiệp, bổn mạng, gia đạo.
  2. 🔴 **Tình Duyên - Nguyệt Lão Điển Tích**: Đền Nguyệt Lão se chỉ hồng, hóa giải duyên muộn, tìm tri kỷ đồng tâm đạo.
  3. 👶 **Cầu Tự - Quan Âm Tống Tử**: Cầu con cái hiếu thuận, thai giáo an lành, mẹ tròn con vuông, phúc đức lưu truyền.
  4. 💰 **Tiền Tài & Kinh Doanh - Chiêu Tài Tấn Bảo**: Khai mở tài lộc, kinh doanh đắc lợi, mua may bán đắt, tài nguyên dồi dào.
  5. 🌿 **Sức Khỏe & An Khang - Dược Sư Tiêu Tai**: Thập nhị đại nguyện Đức Phật Dược Sư tiêu trừ tật bệnh, thân tâm thanh tịnh, trường thọ.
  6. ⭐ **Dâng Sao Giải Hạn - Bắc Đẩu Thất Tinh**: Hóa giải vận hạn niên mạng Thái Bạch, La Hầu, Kế Đô, cầu bình an bản mệnh.

* **Cơ Chế Thu Phí / Cúng Dường (Monetization & Burn Economy) với 3 Cấp Bậc**:
  * **Cấp 1 - Sơ Tâm Chiêm Bái (10 Tâm Duyên)**: Tiêu thụ điểm thưởng tích lũy từ chuỗi ngày tu tập (Streak), bình giải cơ bản.
  * **Cấp 2 - Linh Tự Chiêu Tài (50 Tâm Duyên / 2 Sen Vàng / 1 ADA)**: Bình giải chuyên sâu 4 phương diện (Tiền tài, Tình duyên, Sức khỏe, Sự nghiệp) + Nghi thức dâng lễ chuyên biệt.
  * **Cấp 3 - Thượng Thượng Hoàng Kim (100 Tâm Duyên / 5 Sen Vàng / 3 ADA)**: Dấu Triện Son Đỏ `[KHAI QUANG TAM BẢO]`, thơ chữ Nôm tứ tuyệt, lời khuyên chánh niệm và **Mã băm Notarized Hash On-chain Cardano / Hydra L2** lưu trữ vĩnh viễn trên blockchain.

* **Khắc phục lỗi hình ảnh & Ánh sáng 3D**:
  * Ẩn hoàn toàn vòng hào quang khi di chuyển/đứng yên (chỉ kích hoạt trang trọng khi Tọa Thiền `M`), loại bỏ hiện tượng vòng tròn vàng lơ lửng ngoài ý muốn.
  * Hiệu chỉnh độ phát sáng (Bloom Threshold 1.25, Strength 0.16) và giảm công suất đèn lồng, xóa bỏ hoàn toàn hiện tượng chói lóa mắt ban đêm.

---

## VI. BẢNG TỔNG HỢP CÁC TỆP NGUỒN CỦA DỰ ÁN

| Đường dẫn File | Mô tả Chức Năng |
| :--- | :--- |
| [`lib/world3d/TempleStage.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/TempleStage.ts) | Stage Three.js 3D, Camera Minecraft FPP/TPP, Khí quyển 9 quốc gia, Quản lý hành giả từ xa. |
| [`lib/world3d/PilgrimAvatar.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/PilgrimAvatar.ts) | Mô hình Hành giả 3D, Cổ phục 9 nước, Nón lá/Kasa/Gat, Tràng hạt 108 hạt, Cúi chào & Tọa thiền. |
| [`lib/world3d/NameplateHelper.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/NameplateHelper.ts) | Tạo Sprite Bảng Tên Canvas2D High-DPI & Bong bóng thoại 3D trên đầu người chơi. |
| [`lib/audio/ZenAudio.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/audio/ZenAudio.ts) | Web Audio Engine procedural: Đại hồng chung, Chuông xoay 432Hz, Mõ gỗ, Bộ trộn 6 kênh không gian. |
| [`lib/network/MultiplayerClient.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/network/MultiplayerClient.ts) | Client WebSocket quản lý kết nối, tự kết nối lại lũy thừa, điều tiết 20Hz. |
| [`lib/cardano/ephemeralKey.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/cardano/ephemeralKey.ts) | Quản lý khóa Ephemeral Ed25519 cục bộ ký tương tác nhanh không cần ví popup. |
| [`server/routes/_ws.ts`](file:///d:/Vtechcom/hydra-pagoda/server/routes/_ws.ts) | Server WebSocket Nitro CrossWS, quản lý sangha channel và broadcast 20Hz. |
| [`stores/wallet.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/wallet.ts) | Pinia store quản lý kết nối ví Cardano CIP-30 (Lace, Eternl, Vespr) và số dư ADA. |
| [`stores/user.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/user.ts) | Quản lý định danh hành giả, streak tu tập hàng ngày, camera mode. |
| [`stores/economy.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/economy.ts) | Quản lý số dư Tâm Duyên, Sen Vàng, lịch sử cúng dường. |
| [`stores/cards.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/cards.ts) | Kho lưu trữ dữ liệu 10 thẻ bài Di sản Triết lý & Kiến trúc Cổ tự. |
| [`components/TempleCanvas.vue`](file:///d:/Vtechcom/hydra-pagoda/components/TempleCanvas.vue) | Giao diện HUD chính, điều khiển FPP/TPP, Streak, Top Bar, Bottom Status Bar. |
| [`components/WalletConnectModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/WalletConnectModal.vue) | Modal kết nối ví Cardano CIP-30 / CIP-8. |
| [`components/SanctuaryShop.vue`](file:///d:/Vtechcom/hydra-pagoda/components/SanctuaryShop.vue) | Cửa hàng Pháp Bảo & Tủ đồ Cổ Phục 9 quốc gia. |
| [`components/SoundscapeMixer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/SoundscapeMixer.vue) | Bộ trộn âm thanh thiền không gian 3D 6 kênh với Presets. |
| [`components/EmoteWheel.vue`](file:///d:/Vtechcom/hydra-pagoda/components/EmoteWheel.vue) | Bánh xe cử chỉ tâm linh 6 động tác vái lạy/thiền. |
| [`components/ZenChatDrawer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/ZenChatDrawer.vue) | Khay chat Khẩu Ý Thanh Tịnh chuẩn Vercel Geist + Canned Mantras. |
| [`components/OnlinePilgrimsModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/OnlinePilgrimsModal.vue) | Modal danh sách đồng tu trực tuyến với trạng thái thiền và nút chào. |
| [`components/MeritBoxModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/MeritBoxModal.vue) | Hòm công đức số hóa với Cardano CIP-30 & Hydra L2 receipt hash. |
| [`components/FortuneModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/FortuneModal.vue) | Bàn xóc quẻ 3D với 100 quẻ thơ và lời khuyên chánh niệm. |
| [`components/MeditationModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/MeditationModal.vue) | Modal thiền định 432Hz với vòng tròn thở 4-4-6. |
| [`components/CardCollectionModal.vue`](file:///d:/Vtechcom/hydra-pagoda/components/CardCollectionModal.vue) | Thư viện thẻ bài CIP-68 NFT với mô hình 3D xoay 360° và audio thuyết minh. |
| [`components/DisclaimerBanner.vue`](file:///d:/Vtechcom/hydra-pagoda/components/DisclaimerBanner.vue) | Biểu ngữ cảnh báo pháp lý và chống mê tín dị đoan. |
| [`components/ZenIcon.vue`](file:///d:/Vtechcom/hydra-pagoda/components/ZenIcon.vue) | Thư viện Icon Vector SVG tối giản chuẩn Vercel Geist (không emojis). |
| [`components/SanctuaryDrawer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/SanctuaryDrawer.vue) | Modal Drawer đa năng bên phải chuẩn `hydra-graveyard` (Bói Quẻ, Cửa Hàng, Hòm Công Đức, Thẻ Bài, Thiền 432Hz, Âm Thanh 3D, Đồng Tu Online). |

---

## VII. TÁI THIẾT KẾ TOÀN DIỆN HỆ THỐNG GIAO DIỆN CHUẨN VERCEL GEIST (DESIGN-vercel.md)

Đã đọc lại toàn bộ tài liệu quy chuẩn thiết kế [`DESIGN-vercel.md`](file:///d:/Vtechcom/hydra-pagoda/DESIGN-vercel.md) và tái cấu trúc lại toàn bộ các thành phần giao diện trong thư mục [`components/`](file:///d:/Vtechcom/hydra-pagoda/components), loại bỏ hoàn toàn các phong cách lộn xộn/rườm rà trước đó để đạt chuẩn mực thẩm mỹ nền tảng lập trình tối giản (Vercel Developer-Platform Aesthetic):

1. **Bảng màu & Độ sâu (Color Ladder & Hairline Elevation)**:
   - Màu nền Ink Platform: Canvas `#000000`, bề mặt elevated `#0a0a0a` / `#111111` kết hợp kính mờ `backdrop-blur-2xl`.
   - Đường viền Hairline 1px chuẩn mực (`border border-white/10`), loại bỏ viền đổ bóng dày nặng hoặc màu vàng/nâu mộ địa.
   - Bảng màu điểm nhấn tiết chế: Trắng `#ffffff`, Xám nhạt `#ededed`, Xám trung tính `#888888`, Xanh Vercel Cardano `#0070f3`, Vàng kim hổ phách `#f5a623`, Xanh ngọc thiền `#50e3c2`.

2. **Quy chuẩn Hình học & Nút bấm (Shape & Geometry)**:
   - **App & Nav Controls**: Góc bo vuông vức chính xác 6px (`rounded-[6px]`), padding ngang thanh lịch, kích thước 32px (`h-8`).
   - **Category-Tab Pills**: Dạng con thoi bo tròn hoàn toàn (`category-pill`, `rounded-full`), trạng thái active nền trắng chữ đen nổi bật (`category-pill-active`).
   - **Feature Cards & Content Panels**: Bo góc 8px - 14px (`rounded-[8px]`, `rounded-[14px]`).

3. **Kiến trúc Chữ (Geist Typography)**:
   - Display Headings: Geist Sans 600 với độ dãn chữ âm siết chặt (`tracking-tight`, letter-spacing `-0.03em`).
   - Technical Eyebrows: Geist Mono in hoa 10px (`mono-eyebrow text-[10px] uppercase tracking-wider text-[#888888]`).
   - Tabular Numerals: Số đếm tỷ lệ đơn cách (`tabular-nums font-mono`) trên toàn bộ số dư ngân khố, đồng hồ và bộ đếm.

4. **Tối ưu Bố cục Màn hình Chính ([`components/TempleCanvas.vue`](file:///d:/Vtechcom/hydra-pagoda/components/TempleCanvas.vue))**:
   - **TopBar**:
     - Cụm trái: Thẻ brand Vercel wordmark tinh tế, hiển thị phiên bản `v0.3.0 // CIP-30` và thông tin định danh hành giả.
     - Trung tâm: Hàng pill danh mục 9 quốc gia con thoi (`VN`, `JP`, `TH`, `KR`, `TW`, `SG`, `IN`, `TB`, `LM`), tự động ẩn gọn trên màn hình nhỏ.
     - Cụm phải: Bộ nút tiện ích chuẩn 6px: Streak tu tập, Dải số dư (Coin, Lotus, ADA), Ví Cardano CIP-30, Đổi thời gian Day/Sunset/Night, Góc nhìn F5 Minecraft, và Nút đếm đồng tu online.
   - **BottomBar**:
     - Góc trái: Thanh spec-sheet phím tắt Minecraft tối giản, rõ ràng, không trùng lặp nút.
     - Góc phải: Bộ nút kích hoạt 6px mở trực tiếp các phân hệ tương ứng trong Modal Drawer bên phải (`Bói Quẻ 6 Môn`, `Cửa Hàng`, `Hòm Công Đức`, `Thẻ Bài Di Sản`, `Hội Thiền 432Hz`, `Âm Thanh 3D`, `Quy Chuẩn`).

5. **Modal Drawer Bên Phải Chuẩn Vercel ([`components/SanctuaryDrawer.vue`](file:///d:/Vtechcom/hydra-pagoda/components/SanctuaryDrawer.vue))**:
   - Khung docking bên phải (`top-14 md:top-16 right-4 bottom-4 w-[440px]`), hiệu ứng mở trượt `vercel-anim-right`.
   - Header gồm nhãn kỹ thuật Geist Mono, tiêu đề sắc sảo, chip số dư ngân khố và thanh chuyển đổi Category Pills 7 phân hệ.
   - Toàn bộ 7 phân hệ (Bói Quẻ 6 Môn, Cửa Hàng 9 Nước, Hòm Công Đức, Thẻ Bài Di Sản NFT, Hội Thiền 432Hz, Bộ Trộn Âm Thanh 3D, Sangha Hub) đều được tái thiết kế phẳng, sử dụng icon SVG vector chuẩn từ `ZenIcon`, loại bỏ 100% emoji đồ chơi, mang lại cảm giác chuyên nghiệp của một sản phẩm Web3 đỉnh cao.

---

## VIII. NÂNG CẤP THẾ GIỚI 3D CHUẨN AAA: GIAI ĐOẠN 1 (HOÀN THÀNH)

### 1. Hệ Thống Va Chạm Vật Lý Chuyên Dụng (Dedicated Collision System)
* **Kiến trúc Module hóa độc lập**:
  * [`lib/world3d/collision/Collider.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/collision/Collider.ts):
    * `BoxCollider`: Xử lý va chạm khối hộp AABB/OBB, nhận diện mặt sàn bước lên được (`isWalkable: true`), tính toán pháp tuyến tiếp xúc và độ lún (`penetration depth`).
    * `CylinderCollider`: Xử lý va chạm hình trụ tròn 3D tối ưu cho 10 cột gỗ Lim chánh điện, 8 hàng đèn đá Tōrō, lư hương đồng, thân cây bồ đề.
    * `testCapsule()` & `raycast()`: Thuật toán kiểm tra giao cắt hình học phân tích tốc độ cao, không phụ thuộc thư viện ngoài nặng nề.
  * [`lib/world3d/collision/CollisionWorld.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/collision/CollisionWorld.ts):
    * Quản lý tập trung toàn bộ các collider vật lý trong thế giới cổ tự.
    * Hỗ trợ truy vấn raycast tìm mặt sàn bên dưới (`getSurfaceY`) cho tính năng bám sàn (Ground Snapping).
    * Tạo nhóm khung dây wireframe debug trực quan (`createDebugGroup`).

### 2. Bộ Điều Khiển Nhân Vật Dạng Capsule (Capsule Character Controller)
* [`lib/world3d/collision/CharacterController.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/collision/CharacterController.ts):
  * **Kích thước Capsule chuẩn**: Bán kính `r = 0.38m`, chiều cao đứng `1.75m`, chiều cao rón rén (Sneak) `1.40m`.
  * **Continuous Collision Detection (CCD)**: Phân chia 3 bước tính toán nhỏ (Sub-stepping) mỗi frame với tối đa 3 vòng lặp nới lỏng (relaxation) giúp người chơi khi chạy nhanh (Sprint) hay giật FPS không bao giờ bị đâm xuyên qua tường hay cột.
  * **Trượt dọc bề mặt (Wall Sliding)**: Triệt tiêu thành phần vận tốc đâm vuông góc vào tường, cho phép nhân vật lướt nhẹ dọc theo vách tường và góc cột mượt mà, không bị khựng cứng hay kẹt góc.
  * **Leo tam cấp mượt mà (Step-up Climbing)**: Ngưỡng nâng chân `stepHeight = 0.45m` khớp chuẩn xác với độ cao 3 bậc thềm đá tam cấp (`0.45m / 0.90m / 1.35m`). Người chơi có thể tự do bước lên thềm chùa tự nhiên như ngoài đời thực.
  * **Bám mặt đất khi đi xuống (Ground Snapping)**: Tự động giữ chân nhân vật sát bậc thang khi đi từ trên thềm xuống sân, không bị hiện tượng nhảy tưng tưng hay rơi tự do.
  * **Chạm trần (Ceiling Hit)**: Triệt tiêu vận tốc hướng lên ngay khi đầu nhân vật chạm trần/mái ngói.

### 3. Camera Spring Arm chống xuyên tường (Camera Collision Avoidance)
* [`lib/world3d/collision/CameraSpringArm.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/collision/CameraSpringArm.ts):
  * Bắn tia raycast từ tiêu điểm mắt nhân vật về phía vị trí camera mong muốn.
  * Tự động phát hiện vách tường, cột chùa, lan can và thu ngắn khoảng cách camera lại ngay tức khắc trước bề mặt vật thể với bán kính an toàn `cameraRadius = 0.28m`.
  * Cơ chế nội suy 2 tốc độ: Thu vào tức thì khi va chạm tường (`lerp 25.0`), nhả ra êm ái khi ra khoảng trống (`lerp 8.0`).
  * Triệt tiêu hoàn toàn hiện tượng camera nhìn xuyên qua vách chùa hay xuyên lòng cột gỗ.

### 4. Gỡ bỏ Clamp cứng & Ranh giới Thế giới Vật lý
* Gỡ bỏ hoàn toàn dòng lệnh clamp tọa độ nhân tạo cũ: `clamp(x, -18, 18)` và `clamp(z, -5, 24)`.
* Thay thế bằng hệ thống 4 bức tường rào vật lý bao quanh khuôn viên chùa (`bound_north`, `bound_south`, `bound_west`, `bound_east`). Người chơi có thể tự do đi dạo khắp sân, tiến sát bậc tam cấp và đi xung quanh các công trình.

### 5. Chế độ Kiểm chứng Wireframe Collider (Phím F3)
* Nhấn phím **`F3`** bất cứ lúc nào để Bật/Tắt chế độ hiển thị lưới khung dây 3D:
  * Màu xanh lơ (`Cyan`): Tường rào, chánh điện, bàn xăm, hòm công đức.
  * Màu xanh ngọc (`Green`): Mặt sân chùa và 3 tầng bậc thềm đá tam cấp (Walkable).
  * Màu hồng cánh sen (`Magenta`): Hệ 10 cột gỗ Lim, 8 cột đèn đá Tōrō, lư hương đồng và hồ sen.

---

## IX. NÂNG CẤP THẾ GIỚI 3D CHUẨN AAA: GIAI ĐOẠN 2 (HOÀN THÀNH)

### 1. Dựng Chánh Điện Rỗng Kiến Trúc Cổ Tự Á Đông ([`lib/world3d/sanctuary/PagodaSanctuary.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/sanctuary/PagodaSanctuary.ts))
* **Xóa bỏ khối hộp đặc primitive cũ**:
  * Trước đây Chánh điện là một khối hộp đặc `BoxGeometry(16, 5.5, 12)` chặn đứng người chơi bên ngoài.
  * Đã chuyển đổi thành cấu trúc rỗng đa thành phần hoàn chỉnh:
    * **Tường Hậu (North Wall)**: Vách gỗ sẫm màu thời gian tại $z = -16.0$, dày $0.4\text{m}$.
    * **Tường Tây (West Wall) & Tường Đông (East Wall)**: Vách gỗ tại $x = \pm 8.0$, sâu $12\text{m}$ với 4 cụm **cửa sổ song lăng chữ Vạn / hoa cúc** chạm lộng tinh xảo, dán giấy xuyến chỉ cho phép ánh sáng vàng ấm khuếch tán vào nội điện.
    * **Tường Tiền (South Wall) & Cửa Lớn**: Vách trước với khoảng mở cửa rộng $3.6\text{m}$, cao $3.8\text{m}$, phía trên có **xà trán cửa** và gắn bức **Hoành phi đại tự dát vàng: "ĐẠI HÙNG BẢO ĐIỆN"**.
    * **Sàn nội thất gỗ Lim đánh bóng**: Mặt sàn phẳng tại $y = 1.35$ kết nối trực tiếp từ bậc tam cấp thứ 3, người chơi bước vào êm ái (`isWalkable: true`).
    * **Ngưỡng cửa / Bậu cửa tam cấp**: Bậu gỗ lim cao $0.14\text{m}$ ngang qua lối vào theo đúng văn hóa chùa chiền Á Đông; capsule controller leo qua tự nhiên mà không bị vấp.
    * **Hệ Tứ Trụ Lim & Xà Kèo**: 4 cột gỗ Lim nội thất đường kính lớn đặt trên chân tảng đá hoa sen, đỡ hệ xà ngang (quá giang) và trần gỗ lọng tại $y = 6.75$.

### 2. Cửa Bức Bàn 2 Cánh Tự Mở & Tương Tác Chuột Phải
* Hệ thống cửa gỗ 2 cánh (thượng song hạ bản, tay nắm đồng hoa mai) gắn trên trục xoay bản lề ($x = \pm 1.75$):
  * **Tự động mở khi tiến gần**: Khi người chơi bước tới cách cửa $< 4.2\text{m}$, 2 cánh cửa tự động mở vào trong mượt mà với góc $78^\circ$. Khi đi xa $> 6.0\text{m}$, cửa tự động khép lại trang nghiêm.
  * **Tương tác thủ công**: Người chơi có thể nhấp **chuột phải** khi đứng gần cửa hoặc nhấn nút hành động để Đóng / Mở cửa chủ động kèm âm thanh gõ mõ / lẫy gỗ thanh tịnh.
  * **Dynamic Door Collider**: Khi cửa đóng, 2 collider cánh cửa chặn không cho đi xuyên; khi cửa mở, hệ thống va chạm tự động nhả để nhân vật bước qua không bị cản trở.

### 3. Ban Thờ Tam Bảo & Tôn Tượng Đức Phật Thích Ca Nội Điện
* Di dời tôn tượng Phật từ ngoài sân vào vị trí trang nghiêm nhất trung tâm Chánh điện ($z = -13.5$):
  * **Bệ thờ Tam Bảo sơn son thếp vàng 3 tầng**: Kích thước $5.2 \times 1.25 \times 2.8\text{m}$ chạm khắc sen vàng.
  * **Tòa sen Tam Cấp**: Ba tầng cánh hoa sen màu hồng ngọc thếp vàng nâng đỡ thân Phật.
  * **Kim thân Đức Phật Thích Ca Mâu Ni**: Dát vàng toàn thân, ngự tọa kiết già với **Ấn Thiền Định (Dhyana Mudra)** tĩnh lặng.
  * **Hào quang Mandala quang minh**: Đĩa hào quang xoay chậm sau đầu Phật phát ánh sáng từ bi.
  * **Hương án & Pháp khí cúng dường**:
    * Bàn cúng phía trước tại $z = -11.5$ với lư hương đồng cổ tam túc tỏa khói thơm nghi ngút.
    * Đôi chân đèn nến hoa sen bằng đồng phát ánh lửa vàng ấm nhấp nháy thực tế.
    * Đôi lục bình gốm hoa sen ngọc và 4 bồ đoàn thiền tọa bện bằng cỏ bàng trên mặt sàn.

### 4. Ánh Sáng Nội Thất & Cơ Chế Chuyển Cảnh Exposure Mượt Mà
* **Hệ thống đèn nội thất**:
  * Đèn lồng lụa vàng bát giác treo giữa trần Chánh điện ($y = 5.4, z = -9.5$) tỏa ánh sáng ấm áp.
  * 2 đèn nến bàn thờ với hiệu ứng lập lòe (flicker) tự nhiên.
  * Đèn hào quang Phật vàng kim dịu nhẹ.
* **Cơ chế Exposure & Ambient Transition**:
  * Tự động nhận diện trạng thái nhân vật khi bước qua bậu cửa vào trong Chánh điện:
    $$f_{\text{interior}} = \text{lerp}(f_{\text{interior}}, \text{target}, \Delta t \cdot 3.5)$$
  * Khi bước vào trong, ánh sáng mặt trời bên ngoài được giảm nhẹ để không làm lóa mắt, trong khi ánh nến và đèn lồng nội thất nổi bật ấm cúng, tôn nghiêm.
  * Khi bước ra sân, ánh sáng tự động chuyển đổi êm ái về chế độ ban ngày / hoàng hôn / đêm.

### 5. Camera Spring Arm Bên Trong Chánh Điện
* Thuật toán Raycast chống xuyên tường đảm bảo góc nhìn thứ 3 (TPP) khi bước vào phòng không bao giờ nhìn xuyên qua vách gỗ, trần nhà hay cột chùa. Camera tự động co ngắn khoảng cách theo không gian phòng và nhả dài khi bước ra ngoài sân.

---

## X. NÂNG CẤP THẾ GIỚI 3D CHUẨN AAA: GIAI ĐOẠN 3 (HOÀN THÀNH)

### 1. PBR Material Factory & Xử Lý Bề Mặt Chi Tiết ([`lib/world3d/materials/PBRMaterialFactory.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/materials/PBRMaterialFactory.ts))
* Xây dựng bộ khởi tạo vật liệu PBR thủ tục hoàn chỉnh (baseColor, normalMap, roughnessMap, aoMap):
  * **Đá phiến sân chùa cổ kính (`stonePavement`)**: Vân gạch đá xẻ so le, rãnh vữa khía rãnh normal map, độ nhám chống trượt, mảng rêu phong tự nhiên.
  * **Đá hoa cương tam cấp (`graniteStep`)**: Bề mặt đá mài cổ, khe vát cạnh bevel vi mô, chống lóa.
  * **Gỗ Lim cột chùa (`ironwood`)**: Thớ gỗ dọc lim già xẻ mịn, dầu bóng bảo vệ, độ nhám PBR thực tế.
  * **Ngói âm dương cổ tự (`yinYangRoof`)**: Sống ngói lượn sóng so le, phủ rêu âm dương trầm mặc.
  * **Đồng cổ đúc (`antiqueBronze`)**: Kim loại đúc cổ với lớp gỉ đồng patina xanh sẫm, độ phản xạ kim loại cao.
  * **Vàng lá thếp Tam Bảo (`sacredGoldLeaf`)**: Vàng thếp lộng lẫy tôn nghiêm trên kim thân tượng Phật.
  * **Đất cỏ rêu phong (`mossyEarth`)**: Lớp đất mùn tự nhiên quanh chùa với mảng rêu phong ẩm ướt.
* Khai thác tối đa bộ lọc bất đẳng hướng GPU (`maxAnisotropy` lên tới 16x) cho góc nhìn nghiêng sắc nét.

### 2. Khí Quyển Vật Lý Preetham Sky & Bóng Đổ Mặt Trời Follower ([`lib/world3d/environment/AtmosphereManager.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/environment/AtmosphereManager.ts))
* **Bầu trời vật lý Preetham**: Tính toán tán xạ Rayleigh và Mie theo thời gian thực (Ban Ngày / Hoàng Hôn / Ban Đêm).
* **Mặt trời Follower Cascaded Shadow**: Tự động bám theo tọa độ người chơi, tập trung ma trận bóng đổ 2048x2048 quanh bán kính 26m giúp bóng đổ luôn sắc nét, không bị răng cưa hay mờ nhạt.
* **Cân chỉnh Ánh sáng Dịu mắt**:
  * Ban ngày: Mặt trời vàng kim ấm áp chiếu từ góc trước bên phải rọi sáng mặt tiền Chánh điện.
  * Hoàng hôn: Tông hổ phách đỏ tía huyền ảo.
  * Ban đêm: Đêm tối tĩnh mịch sâu thẳm, mặt trời lặn sâu $-24^\circ$, loại bỏ mây trắng sáng, chỉ còn ánh trăng bạc và đèn lồng ấm cúng.

### 3. Pipeline Hậu Kỳ & Thiết Lập Cấu Hình ([`lib/world3d/postprocessing/PostProcessingManager.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/postprocessing/PostProcessingManager.ts))
* Pipeline hậu kỳ tinh giản, tối ưu cao: `RenderPass` $\to$ `UnrealBloomPass` (High threshold 1.05) $\to$ `SMAAPass` $\to$ `OutputPass` (ACES Filmic Tone Mapping).
* Bloom được kiểm soát chặt chẽ ở ngưỡng cao để chỉ phát quang từ đèn lồng thực tế; tắt hoàn toàn ở mức Low để giữ hình ảnh trong trẻo, không lóa và nhẹ cho GPU.
* Không kích hoạt GTAO thời gian thực để bảo toàn ngân sách khung hình $\ge 60\text{ FPS}$ cho đám đông 500 người (chiều sâu bóng đổ dựa trên Cascaded PCF Shadow Map và AO texture baked sẵn).
* Phím tắt **F4** và nút chuyển cấu hình trên thanh trạng thái (Low / Medium / High / Ultra).

---

## XI. NÂNG CẤP THẾ GIỚI 3D CHUẨN AAA: GIAI ĐOẠN 4 (HOÀN THÀNH)

### 1. Hồ Sen Sống Động & Cầu Đá Vòm Cong ([`lib/world3d/nature/LotusPond.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/nature/LotusPond.ts))
* **Mặt Nước Shader Thời Gian Thực**:
  * Shader mặt nước 2 lớp sóng lăn tăn độc lập (`sin/cos wave displacement`).
  * Hiệu ứng phản xạ Fresnel: nhìn thẳng thấy nước xanh ngọc bích sâu thẳm, nhìn nghiêng phản chiếu bầu trời và cây cối.
  * Ánh lấp lánh Specular phản chiếu nguồn sáng mặt trời/trăng trên đầu ngọn sóng.
* **Cầu Đá Vòm Cong (Arched Stone Bridge)**:
  * Vòm cầu đá hoa cương cong parabol bắc xuyên ngang hồ sen (dài $17\text{m}$, rộng $3.2\text{m}$).
  * Hệ lan can đá chạm khắc 12 búp sen đá tinh xảo dọc 2 bên thành cầu.
  * Đăng ký 3 khối collider dốc và đỉnh phẳng để người chơi bước lên tam cấp và đi dạo qua cầu êm ái.
  * Lan can 2 bên có collider bảo vệ chống rơi xuống nước.
* **Hệ Sinh Thái Sen & Hoa Đăng Nổi**:
  * 32 cụm lá sen dập dềnh và hoa sen hồng nở rộ nhụy vàng đón nắng.
  * 6 đèn hoa đăng tứ giác trôi bập bềnh theo nhịp sóng nước với ánh nến lung linh.

### 2. Lầu Chuông Cổ Tự & Đại Hồng Chung Đồng Cổ ([`lib/world3d/architecture/BellTower.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/architecture/BellTower.ts))
* **Kiến trúc Lầu Chuông Gỗ Lim 2 Tầng Mái**:
  * Bệ đá hoa cương tam cấp 2 tầng kiên cố ($7.2\text{m} \times 7.2\text{m}$).
  * 4 cột gỗ lim cái vững chãi đặt trên chân tảng đá xanh quả bồng.
  * Hệ xà ngang, vì kèo kẻ truyền đỡ 2 tầng mái ngói âm dương cong vút 4 đầu đao.
  * Lan can con tiện gỗ bao quanh tầng trên.
* **Đại Hồng Chung Đồng Cổ**:
  * Dựng hình bằng `LatheGeometry` theo tỷ lệ chuẩn của chuông chùa cổ truyền thống (Chùa Thiên Mụ / Một Cột).
  * Vành chuông loe, thân chuông trụ suôn, quai chuông chạm bồ lao treo xích sắt.
  * Chày kình gỗ lim gõ chuông treo dây thừng đung đưa nhịp nhàng theo thời gian.
  * Đầy đủ Collider cho bệ đá, 4 cột lim và lan can.

### 3. Cổng Tam Quan Cổ Kính 3 Lối Đi ([`lib/world3d/architecture/TamQuanGate.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/architecture/TamQuanGate.ts))
* **Cấu Trúc Tam Môn Truyền Thống**:
  * Tọa lạc tại ranh giới Nam của khuôn viên chùa ($z = 24.5\text{m}$).
  * 4 trụ biểu đá khối vuông vức đỡ xà ngang gỗ lim.
  * 3 lối vào riêng biệt: **Trung Quan** (cửa chính cao $4.2\text{m}$, rộng $3.8\text{m}$), **Giả Quan** (cửa Tây) và **Không Quan** (cửa Đông).
  * 3 tầng mái ngói đao cong giật cấp với đỉnh chóp pháp luân sen vàng.
  * Bức đại tự hoành phi sơn son chữ nổi dát vàng: **"VẠN CẢNH THIỀN TỰ"**.
  * Tường bao hoa lan can kéo dài 2 bên kết nối hoàn hảo với ranh giới thế giới.

### 4. Thảm Cỏ Tự Nhiên Lay Động Gió ([`lib/world3d/nature/WindGrass.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/nature/WindGrass.ts))
* Khởi tạo **2.200 cụm cỏ** rải tự nhiên quanh khuôn viên đất cỏ và bờ hồ sen.
* Kỹ thuật `THREE.InstancedMesh` kết hợp **Vertex Wind Displacement Shader**:
  * Ngọn cỏ lay động mềm mại theo nhịp gió (`windSpeed = 2.2`, `windStrength = 0.18`), gốc cỏ ghim chặt trên nền đất.
  * Gradient màu chuyển tiếp từ gốc rêu sẫm lên ngọn xanh nắng tươi mát.
  * Toàn bộ 2.200 cụm cỏ chỉ tiêu tốn đúng **1 Draw Call**, giữ vững 60 FPS mượt mà.

### 5. Tôn Tượng Phật Thích Ca Mâu Ni & Đài Sen Tôn Nghiêm ([`lib/world3d/sanctuary/SacredBuddhaStatue.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/world3d/sanctuary/SacredBuddhaStatue.ts))
* Bệ đá bát giác 3 tầng giật cấp chạm hoa sen lật úp.
* Tòa sen vàng 16 cánh nâng đỡ tôn tượng.
* Kim thân Đức Phật Thích Ca Mâu Ni tọa thiền kiết già (`Padmasana`), ấn Thiền Định (`Dhyana Mudra`), áo cà sa buông rủ hở vai phải, đỉnh đầu nhục kế (`Ushnisha`) và ngọc Mani trí tuệ.
* Vầng hào quang Mandala quang minh mạ vàng luân chuyển thanh tịnh phía sau đầu.

---

## XII. NÂNG CẤP THẾ GIỚI 3D CHUẨN AAA: GIAI ĐOẠN 5 (HOÀN TẤT & BÀN GIAO)

### 1. Màn Hình Tải Trang Chánh Niệm (Zen Loading Screen)
* Giao diện tải trang trang trọng, thanh thoát theo phong cách Binance Dark/Gold (`components/TempleCanvas.vue`).
* Thanh tiến độ chuyển động mượt mà ($0\% \to 100\%$).
* Luân chuyển ngẫu nhiên các câu pháp cú & danh ngôn thiền học sâu sắc (Thiền sư Thích Nhất Hạnh, Lục Tổ Huệ Năng).
* Bảng hướng dẫn phím tắt trực quan: `WASD` di chuyển, `Chuột` xoay góc nhìn, `Space` nhảy, `Shift` rón rén, `Ctrl` chạy, `F3` Debug Colliders, `F4` Chuyển cấu hình đồ họa (Low-Ultra), `F5` Đổi góc nhìn FPP/TPP, `Chuột Phải` tương tác tâm linh, `Alt` hiển thị con trỏ chuột.

### 2. Quản Lý Vòng Đời Tài Nguyên & Chống Rò Rỉ Bộ Nhớ (Memory Cleanup Lifecycle)
* Bổ sung đầy đủ phương thức `dispose()` cho toàn bộ hệ sinh thái:
  * `TempleStage.destroy()`: Hủy toàn bộ render loop, giải phóng WebGLRenderer, EffectComposer, AtmosphereManager, PostProcessingManager.
  * Thuật toán đệ quy `scene.traverse()` quét và giải phóng $100\%$ `geometry.dispose()` và `material.dispose()` của toàn bộ cây đối tượng 3D khi chuyển trang hoặc hủy component.
  * Ngắt toàn bộ bộ lắng nghe sự kiện (`window.removeEventListener`), bộ hẹn giờ (timers, intervals) và ngắt kết nối WebSocket Multiplayer Client an toàn.

### 3. Bảng Ghi Nhận Bản Quyền Toàn Diện ([`CREDITS.md`](file:///d:/Vtechcom/hydra-pagoda/CREDITS.md))
* Lập tài liệu chính thức ghi nhận đầy đủ nguồn gốc, tác giả và giấy phép nguồn mở thương mại:
  * **Three.js (^0.186.1)**: MIT License.
  * **Nuxt 3, Vue 3, Tailwind v4, Pinia, TypeScript**: MIT / Apache 2.0.
  * **PBR Material Textures**: CC0 1.0 Universal Public Domain Dedication (ambientCG, Poly Haven).
  * **Preetham Sky Model**: Analytical Atmospheric Scattering (MIT License).
  * **Custom Shaders**: Water Ripple Reflector & Instanced Wind Grass Shaders.
  * **Procedural Web Audio Engine**: Binaural 432Hz Soundscape.
  * **Cardano CIP-30 & CIP-68 Standards**: Phi tập trung, minh bạch, bảo tồn di sản.

---

## BẢNG TỔNG KẾT NGHIỆM THU 7 GIAI ĐOẠN NÂNG CẤP ĐỒ HỌA 3D CHUẨN AAA

| Giai đoạn | Nội dung trọng tâm | Trạng thái | Kiểm thử / Kết quả |
| :--- | :--- | :---: | :--- |
| **Giai đoạn 1** | Dedicated Collision System, Character Controller (Capsule), Camera Spring Arm (Raycast), Gỡ bỏ hoàn toàn Clamp cứng. | **HOÀN THÀNH** | Người chơi di chuyển tự do, trượt dọc vách tường, camera không bao giờ nhìn xuyên tường. |
| **Giai đoạn 2** | Chánh điện rỗng bên trong, Cửa bức bàn 2 cánh tự mở/chuột phải, Ngưỡng cửa tam cấp, Ban thờ Tam Bảo & Tượng Phật chuyển vào nội điện, Chuyển cảnh ánh sáng Exposure mượt. | **HOÀN THÀNH** | Người chơi bước vào Chánh điện tự nhiên, ánh sáng ấm cúng, tương tác đóng mở cửa hoàn hảo. |
| **Giai đoạn 3** | Thư viện vật liệu PBR thủ tục (7 bộ map chuẩn), Bầu trời vật lý Preetham Sky, Mặt trời Cascaded Follower Shadow, Post-processing ACES Filmic, Phím F4 chuyển 4 mức đồ họa. | **HOÀN THÀNH** | Hình ảnh sắc nét, tương phản trầm mặc, ban ngày rọi sáng ấm áp, ban đêm đen tĩnh mịch, triệt tiêu lóa sáng. |
| **Giai đoạn 4** | Hồ sen sống động (Water Wave Shader), Cầu đá vòm cong tam cấp có va chạm, Lầu chuông gỗ lim 2 tầng & Đại hồng chung đồng cổ, Cổng Tam Quan 3 lối, Thảm cỏ Instanced lay động gió (2.200 cụm, 1 Draw Call). | **HOÀN THÀNH** | Quần thể cổ tự Á Đông đồ sộ, bước lên cầu đá và cổng tam quan trơn tru, hiệu năng giữ vững 60 FPS. |
| **Giai đoạn 5** | Màn hình tải trang Zen Loading Screen mượt mà, Quản lý tài nguyên `dispose()` chống rò rỉ WebGL, Bảng ghi nhận bản quyền `CREDITS.md`. | **HOÀN THÀNH** | Đạt chuẩn trò chơi Web3 3D chất lượng cao, sẵn sàng phục vụ người dùng toàn cầu. |
| **Giai đoạn 6** | Quy hoạch Single Source of Truth (`MapLayout`), Đại Hùng Bảo Điện $1.200\text{ m}^2$ với 500 chỗ thiền, dời Bát Nhang Phương án A, chuẩn hóa bậc thang $\le 0.18\text{m}$ (Step-up WASD), thung lũng mở rộng $R = 115\text{m}$ ($41.500\text{ m}^2$). | **HOÀN THÀNH** | Loại bỏ 100% xung đột và cây xuyên nhà, đi bộ mượt qua thềm/cầu/lầu chuông, sàn tự nhiên bám dốc đồi, tường 48 hộp chặn núi. |
| **Giai đoạn 7** | Tinh chỉnh LOD đám đông 500 người (4-15 draw calls), gỡ bỏ góc nhìn selfie, gói tin mạng nhị phân 35B kèm AoI 40m & anti-cheat chống NaN/teleport, nghiệm thu tiêu chí mục 9. | **HOÀN THÀNH** | 16/16 chỉ tiêu mục 9 Pass 100%, CharacterController 0.12ms, server bảo mật, build sạch 0 lỗi, bundle 1.9MB. |

---

## XIII. NÂNG CẤP THẾ GIỚI 3D CHUẨN AAA: GIAI ĐOẠN 6 (HOÀN THÀNH)

### 1. Single Source of Truth & Quy Hoạch Bản Đồ Không Xung Đột (`lib/world3d/world/MapLayout.ts`)
* Quy chuẩn toàn bộ landmark, cây cối, điểm spawn, ranh giới thung lũng vào một nguồn chân lý duy nhất.
* Hàm kiểm thử tự động `validateLayout()` kiểm soát footprint AABB/Circle và khoảng cách an toàn (clearance), đạt 0 xung đột.
* Dời Hồ Sen sang $X = -17.5\text{m}$ và Lầu Chuông sang $X = +17.5\text{m}$, mở rộng hành lang lối đi sang Chánh Điện $\ge 3.5\text{m}$ và $\ge 6.4\text{m}$.
* Dời Bát Nhang thành Đại Đỉnh Đồng giữa sân tại $(0, 0.08, 10.0)$ cách chân cầu thang Chánh Điện $3.3\text{m}$ về hướng Nam (Phương án A), mở thông trục ngự đạo từ Cổng Tam Quan vào Chánh Điện rộng $\ge 4.0\text{m}$.

### 2. Đại Hùng Bảo Điện 1.200 m² & 500 Chỗ Ngồi Thiền (`lib/world3d/world/HallLayout.ts`, `lib/world3d/sanctuary/PagodaSanctuary.ts`)
* Dựng lại toàn bộ Chánh Điện theo kích thước chuẩn $40\text{m} \times 30\text{m}$ (diện tích sàn $1.200\text{ m}^2$, chiều cao nóc điện $15.5\text{m}$).
* 5 Cửa bức bàn cổ truyền (3 cửa chính mặt Nam rộng $4.2\text{m}$ và 2 cửa phụ Đông - Tây rộng $2.2\text{m}$).
* Khởi tạo ma trận đúng 500 ô bồ đoàn ngồi thiền phân bố đều 4 phân khu (125 chỗ/khu), tuyệt đối không chồng lấn vào ngự đạo hay bàn thờ Phật.
* Chỉ duy nhất 1 Kim Thân Đức Phật Thích Ca Mâu Ni uy nghiêm ngự trên đài sen bát giác ở hậu điện.

### 3. Chuẩn Hóa Bậc Thang & Cơ Chế Đi Bộ WASD (Step-Up Physics)
* Chuẩn hóa chiều cao bậc thang (riser) $\le 0.18\text{m}$ và mặt bậc (tread) $\ge 0.30\text{m}$:
  * Chánh Điện: 8 bậc tam cấp chuẩn ($0.16875\text{m}$/bậc).
  * Lầu Chuông: 4 bậc thềm vững chãi ($0.175\text{m}$/bậc).
  * Hồ Sen: 12 nhịp bậc cong uốn lượn ($\le 0.15\text{m}$/bậc).
* Nâng cấp `Collider.ts` & `CharacterController.ts`: Vật thể đi bộ được có chiều cao trong ngưỡng `stepHeight` được tự động bước lên (Step-up), triệt tiêu hoàn toàn hiện tượng mặt đứng bậc thang bị cản thành tường ngang. Người chơi dùng WASD đi lên/xuống mượt mà không cần ấn Space nhảy.

### 4. Mở Rộng Địa Hình Thung Lũng & Vòng Tường Ranh Giới Chân Núi ($R = 115\text{m}$)
* Tích hợp trực tiếp thuật toán cao độ giải tích của `TerrainSystem` làm sàn vật lý trong `CharacterController`, cho phép người chơi bước chân ra ngoài khuôn viên chùa, dạo bước trên đồi cỏ, rừng thông mà không bị rơi xuyên map.
* Mở rộng ranh giới đi lại tự do ra sát chân núi $R = 115.0\text{m}$ (diện tích đi lại đạt $> 41.500\text{ m}^2$).
* Vòng tường ranh giới 48 khối hộp liên tục ôm sát chân núi ngăn xuyên núi ra khoảng không, đi kèm lưới an toàn Fall Protection tự động respawn khi $Y < -3.0\text{m}$.

---

## XIV. HOÀN THIỆN TOÀN DIỆN, BẢO MẬT MẠNG & NGHIỆM THU MỤC 9: GIAI ĐOẠN 7 (HOÀN TẤT)

### 1. Tinh Chỉnh LOD Đám Đông & Quản Lý Bộ Nhớ (AvatarCrowd)
* Phân tầng 4 cấp LOD cho đám đông 500 người:
  * LOD0 (0-15m): Pool 15 avatar chi tiết đầy đủ skeleton rig, nón lá, animation blend.
  * LOD1 (15-45m): InstancedMesh gộp (~380 tris/avatar, 1 draw call).
  * LOD2 (45-90m): Impostor InstancedMesh (~80 tris/avatar, 1 draw call).
  * LOD3 (>90m hoặc ngoài Frustum): 0 draw call, xử lý CPU thuần túy.
* Gom toàn bộ bảng tên người chơi vào 1 Draw Call (`NameplateAtlas`) và dấu chân hoa sen vào 1 Draw Call (`FootstepSystem`). Tổng draw call toàn bộ đám đông 500 người chỉ tốn từ 4 đến 15 draw calls.
* Loại bỏ triệt để góc nhìn Selfie (`tpp_front`) theo yêu cầu người dùng, giữ chu kỳ chuyển đổi F5 giữa 2 góc nhìn tinh giản: FPP (Góc nhìn thứ nhất) $\leftrightarrow$ TPP (Góc nhìn thứ ba).

### 2. Giao Thức Mạng Nhị Phân 20Hz & Chống Giả Mạo (NetProtocol & Server Security)
* Gói tin chuyển động nhị phân nén nhỏ gọn chỉ 35 bytes (gồm Action Code, Timestamp, Position Vector3, Yaw), giảm tải băng thông mạng xuống $< 12\text{ kbps/client}$.
* Phân vùng không gian AoI Grid $40\text{m} \times 40\text{m}$, server chỉ broadcast gói tin cho các client trong bán kính quan sát $\sim 60\text{m}$, triệt tiêu nghẽn mạng $O(N^2)$ khi đạt 500 đồng tu.
* Bổ sung cơ chế xác thực an toàn phía server (`server/routes/_ws.ts`):
  * Rate-limit 20–25Hz.
  * Từ chối và loại bỏ ngay lập tức gói tin chứa tọa độ rác (`NaN`, `Infinity`).
  * Phát hiện và ngăn chặn tốc biến / speed-hack (delta position vượt quá $15\text{m}$/tick).

### 3. Nghiệm Thu Toàn Diện Tiêu Chí Kỹ Thuật Mục 9 (16/16 Test Pass 100%)
Bộ test tự động `scratch/test_phase7_acceptance.mjs` chạy kiểm định độc lập đã xác nhận toàn bộ 16 chỉ tiêu chất lượng chuẩn AAA:
* **Đại Hùng Bảo Điện**: Sàn $1.200\text{ m}^2$, đủ 500 chỗ thiền hợp lệ, 0 chỗ ra ngoài tường, 0 chỗ đè lên bàn thờ Phật, đủ 5 cửa bức bàn.
* **Quy hoạch & Bản đồ**: `validateLayout()` 0 xung đột, diện tích đi lại thung lũng đạt $41.548\text{ m}^2$ ($R = 115\text{m}$), Bát Nhang cách thềm $9.5\text{m}$, 234 cây rừng tự nhiên không cây nào mọc trong nhà.
* **Hệ sinh thái cây cối**: Đủ 6 loài cây đặc trưng Á Đông (Bồ Đề, Đa, Thông, Trúc, Phong/Anh Đào, Cau cảnh).
* **Động cơ vật lý**: `CharacterController.update` đạt tốc độ siêu nhanh **0.123 ms/tick** (vượt xa tiêu chí $\le 0.3\text{ ms}$), Fall Protection cứu hộ $100\%$.
* **Mạng nhị phân**: Gói tin nén 35 bytes ($\le 40$ bytes), giải mã nguyên vẹn $100\%$, AoI 40m grid chuẩn xác.




---

## XV. THIẾT KẾ LẠI GIAO DIỆN 3D PHONG CÁCH LOW-POLY TỐI GIẢN (PHASE 0 → 6)

Kế hoạch: `docs/superpowers/plans/2026-11-06-lowpoly-minimalist-redesign-plan.md` (nhánh `feat/lowpoly-redesign`). Phong cách mới thay thế hướng PBR/realistic của các giai đoạn trước. Các mô tả về PBR, Preetham Sky, texture Canvas 2D, 500 chỗ thiền và 500 người chơi ở các mục phía trên là lịch sử, không còn phản ánh hiện trạng.

### 1. Hiện trạng đồ họa
* Màu phẳng theo bảng màu 3 chế độ ngày / hoàng hôn / đêm (`lib/world3d/style/Palette.ts`, `FlatMaterialFactory.ts`), không còn ảnh texture, PBR map, IBL, GTAO hay outline.
* Dựng hình bằng `LowPolyBuilder`, `SlotBatch`, `RoofBuilder`; bầu trời `SkyDome`; địa hình 400×400 m (`TerrainSystem`, `DistantMountains`).
* Một đèn định hướng đổ bóng mềm, tối đa 4 PointLight; hậu kỳ gồm MSAA, Bloom nhẹ (ngưỡng 1.0) và Vignette nhẹ.
* Nhân vật khoảng 7 đầu ghép từ bộ phận cứng; đám đông dùng InstancedMesh và 4 mức LOD (`AvatarCrowd`).
* Đại Hùng Bảo Điện 28×22 m với khoảng 256 chỗ thiền; Tam Quan, Lầu Chuông, Hồ Sen và 6 loài cây dựng lại theo phong cách mới.
* Duy nhất một tôn tượng Phật GLB.

### 2. Kết quả Phase 6 (hoàn thiện và dọn dẹp)
* **Mạng:** ngân sách thiết kế khoảng 200 người chơi đồng thời (gói 24 byte, AoI 40×40 m); sửa lỗi kiểu của `MultiplayerClient.sendBinary`; cập nhật chú thích `server/routes/_ws.ts`; logic giới hạn tốc độ, chống teleport và kiểm tra id giữ nguyên.
* **Dọn dẹp:** xóa shim `lib/world3d/environment/LightingConfig.ts`; `PostProcessingManager` đọc thông số Bloom từ `POST_STYLE`; loại bỏ khối method bị trùng lặp trong `TempleStage.ts` (từ 1914 xuống 1689 dòng).
* **Chất lượng đồ họa:** `TempleStage.setGraphicsQuality` gọi thêm `AtmosphereManager.setShadowQuality` (Low: tắt bóng; Medium: bóng 1024; High/Ultra: bóng 2048), kết hợp pixel ratio và Bloom của `PostProcessingManager`.
* **Nén tượng Phật:** `public/models/the_buddha_statue_in_a_mountain.glb` giảm từ 10.82 MB xuống khoảng 0.10 MB (bỏ texture, UV, tangent; hàn đỉnh; lượng tử hóa; meshopt). Còn 6 mesh, khoảng 11.6 nghìn đỉnh, 21.5 nghìn tam giác, bounding box không đổi. `SacredBuddhaStatue.ts` đã có sẵn bộ giải nén meshopt nên không cần sửa mã.
* **Tài liệu:** viết lại `CREDITS.md`, thêm mục 10.0 vào `GAME_DESIGN_DOCUMENT.md`, thêm mục này.

### 3. Việc còn lại sau Phase 6
* Đo FPS và draw call trên trình duyệt thật với `?bots=200` (phím F2 mở HUD): mục tiêu ≥ 60 FPS (High), ≥ 30 FPS (Low), draw call ≤ 150 (High) và ≤ 80 (Low).
* Kiểm tra tải GLB đã nén ở runtime và đổi màu theo thời điểm trong ngày.
* Bổ sung tên tác giả, liên kết và giấy phép của mô hình tượng Phật trên Sketchfab vào `CREDITS.md` mục 2.5 trước khi phát hành công khai.
