# TÀI LIỆU LÊN KẾ HOẠCH (PLANNING DOCUMENT): CÔNG TRÌNH "NHÀ HẦU ĐỒNG" (ĐIỆN THỜ TỨ PHỦ & TRẦN TRIỀU)

- **Dự án:** Vạn Cảnh Chùa / Hydra Pagoda (Không gian Di sản Văn hóa & Tâm linh Số 3D)
- **Đơn vị tiền tệ hệ thống:** Merit Coins (`MC`) — tích hợp sổ cái SQLite (`mc_ledger`) & Hydra L2 Head Notary trên nền tảng Cardano
- **Nền tảng / Công nghệ:** WebGL 3D (Nuxt 3 + Vue 3 + Three.js + Web Audio API + Pinia + Nitro Server SQLite)
- **Trạng thái tài liệu:** Bản Thiết kế Chính thức đã chốt thông số (v1.1)

---

## MỤC LỤC

1. [Tổng quan & Mục tiêu của Nhà Hầu Đồng](#1-tổng-quan--mục-tiêu-của-nhà-hầu-đồng)
2. [Phân tích Tín ngưỡng: Tam Phủ, Tứ Phủ & Đức Thánh Trần](#2-phân-tích-tín-ngưỡng-tam-phủ-tứ-phủ--đức-thánh-trần)
3. [Thiết kế Không gian & Công trình 3D](#3-thiết-kế-không-gian--công-trình-3d)
4. [Quy trình Một Buổi Hầu Đồng trong Hệ thống](#4-quy-trình-một-buổi-hầu-đồng-trong-hệ-thống)
5. [Nhân vật & Hệ thống NPC](#5-nhân-vật--hệ-thống-npc)
6. [Hệ thống Âm nhạc & Hình ảnh](#6-hệ-thống-âm-nhạc--hình-ảnh)
7. [Cơ chế Tương tác Khu vực (Proximity) & Kinh tế MC](#7-cơ-chế-tương-tác-khu-vực-proximity--kinh-tế-mc)
8. [Lịch Tổ chức & Hệ thống Hàng chờ Đặc cách](#8-lịch-tổ-chức--hệ-thống-hàng-chờ-đặc-cách)
9. [Kỹ thuật Triển khai (Database, Trigger, Ledger, Audit)](#9-kỹ-thuật-triển-khai-database-trigger-ledger-audit)
10. [Rủi ro & Lưu ý Đạo đức Văn hóa](#10-rủi-ro--lưu-ý-đạo-đức-văn-hóa)
11. [Lộ trình Thực hiện (Roadmap)](#11-lộ-trình-thực-hiện-roadmap)
12. [Phụ lục: Thuật ngữ & Nguồn tham khảo](#12-phụ-lục-thuật-ngữ--nguồn-tham-khảo)
13. [Bảng Chốt Quyết định Thiết kế của Chủ Dự án](#13-bảng-chốt-quyết-định-thiết-kế-của-chủ-dự-án)

---

## 1. Tổng quan & Mục tiêu của Nhà Hầu Đồng

### 1.1. Định vị công trình trong tổng thể dự án
Trong quần thể không gian tâm linh truyền thống Việt Nam ("Tiền Phật - Hậu Mẫu" hoặc cụm kiến trúc Chùa - Điện - Phủ liên hoàn), **Nhà Hầu Đồng** (hay **Điện Thờ Mẫu Tam Tứ Phủ & Trần Triều**) là một công trình kiến trúc 3D mới, được đặt tại **phía Đông (bên phải) của Đại Hùng Bảo Điện** trong cùng một cảnh giới 3D (`TempleStage.ts`), kết nối trực tiếp với sân chùa bằng đường dạo lát đá để người chơi tự do đi bộ qua lại. Công trình này tái hiện không gian thực hành nghi lễ Hầu đồng (Lên đồng) — nghi thức trung tâm của **Thực hành Tín ngưỡng thờ Mẫu Tam phủ của người Việt**, đã được UNESCO chính thức ghi danh vào Danh sách Di sản văn hóa phi vật thể đại diện của nhân loại vào ngày 01/12/2016 tại Ethiopia.

### 1.2. Giá trị Văn hóa & Bảo tồn Di sản
- **Tôn vinh nghệ thuật diễn xướng tổng hợp:** Tái hiện sự giao thoa giữa âm nhạc Chầu văn, nghệ thuật vũ đạo dân gian (múa mồi, múa kiếm, múa quạt, múa chèo đò, múa hèo...), mỹ thuật trang phục truyền thống (khăn chầu, áo ngự theo sắc màu Tứ phủ) và kiến trúc điện thờ cổ truyền.
- **Giáo dục & truyền cảm hứng lịch sử:** Giới thiệu công lao của các bậc tiền nhân, danh tướng lịch sử và nhân thần được nhân dân tôn vinh trong hệ thống thần điện Tứ Phủ và Trần Triều (như Hưng Đạo Đại Vương Trần Quốc Tuấn, Quan Lớn Đệ Tam, Chầu Bà, Ông Hoàng Mười, Ông Hoàng Bảy...).
- **Chuẩn mực và tôn nghiêm:** Xóa bỏ định kiến sai lệch về "mê tín dị đoan" bằng cách trình bày nghi lễ dưới góc độ di sản văn hóa phi vật thể, chú thích rõ ý nghĩa từng giá đồng, từng bản văn và đạo cụ.

### 1.3. Giá trị Trải nghiệm & Gameplay
- **Sự kiện cộng đồng định kỳ (Live Ritual Event):** Tạo điểm tụ hội sôi động định kỳ (mồng 1, ngày Rằm âm lịch) hoặc khi có tín chủ phát tâm công đức lớn (`2,500 MC`), bổ sung mảnh ghép "Động - Rực rỡ - Cộng đồng" bên cạnh không gian "Tĩnh - Thiền định 432Hz" của Đại Hùng Bảo Điện.
- **Cơ chế "Dự lễ Thỉnh lộc" (Proximity Blessing):** Người chơi hiện diện trong Nhà Hầu Đồng, thành tâm theo dõi từng giá đồng đến khoảnh khắc **Ban lộc** sẽ nhận được lộc thánh quy đổi trực tiếp thành `MC` vào tài khoản cùng hiệu ứng chúc phúc (Buff cát tường).
- **Vòng lặp kinh tế bền vững:** Kết nối Hòm Công Đức của Nhà Hầu Đồng với Quỹ Ban Lộc cộng đồng, đảm bảo dòng chảy `MC` minh bạch trên sổ cái SQLite và Hydra L2 Head.

---

## 2. Phân tích Tín ngưỡng: Tam Phủ, Tứ Phủ & Đức Thánh Trần

Để thiết kế chính xác hệ thống tượng thờ, sắc phục, đạo cụ và kịch bản giá đồng, tài liệu chuẩn hóa kiến thức nền tảng như sau:

### 2.1. Khái niệm Tam Phủ, Tứ Phủ và sự kết hợp thờ Đức Thánh Trần
1. **Tam Phủ (Ba miền vũ trụ):**
   - **Thiên Phủ (Miền Trời):** Do Mẫu Đệ Nhất Thượng Thiên cai quản — đại diện màu **Đỏ**.
   - **Nhạc Phủ (Miền Rừng núi):** Do Mẫu Đệ Nhị Thượng Ngàn cai quản — đại diện màu **Xanh lá (Lục)**.
   - **Thoải Phủ (Thủy Phủ - Miền Sông nước):** Do Mẫu Đệ Tam Thoải Phủ cai quản — đại diện màu **Trắng**.
2. **Tứ Phủ (Bốn miền vũ trụ):** Mở rộng từ Tam Phủ bằng việc bổ sung **Địa Phủ (Miền Đất đai)** do Mẫu Đệ Tứ Địa Phủ cai quản — đại diện màu **Vàng**.
3. **Phối thờ Đức Thánh Trần (Trần Triều):** Trong lịch sử tín ngưỡng dân gian Việt Nam (đặc biệt vùng đồng bằng Bắc Bộ), tín ngưỡng thờ Đức Thánh Trần (Hưng Đạo Đại Vương Trần Quốc Tuấn cùng gia quyến, tướng lĩnh nhà Trần) kết hợp chặt chẽ với tín ngưỡng thờ Mẫu theo cấu trúc **"Công đồng Tứ Phủ - Trần Triều"**.
   - *Lưu ý cần xác minh theo vùng miền:* Ở một số bản đền cổ Bắc Bộ, các giá Trần Triều (Đức Ông, Vương Cô, Vương Cậu) có thể được hầu ở ban riêng hoặc hầu trước/sau hệ thống Tứ Phủ tùy theo lệ đền và dòng đồng. Trong thiết kế hệ thống số, đặt **Ban Trần Triều** ở gian tả (bên trái từ trong nhìn ra) của Điện thờ và cho phép chọn Giá Đức Ông Trần Triều như một giá đặc biệt khi mở đàn đặc cách.

### 2.2. Hệ thống Hàng Thánh chính trong Tứ Phủ (Dùng làm căn cứ thiết kế Giá Đồng)

| Thứ bậc | Hàng Thánh | Đặc trưng văn hóa & Vai trò | Quy ước trong Nghi lễ Hầu đồng |
| :--- | :--- | :--- | :--- |
| **1** | **Ngọc Hoàng & Tam Tòa Thánh Mẫu** | Mẫu Thượng Thiên (Đỏ), Mẫu Thượng Ngàn (Xanh), Mẫu Thoải (Trắng) — bậc tối cao sinh hóa muôn loài. | **Lưu ý tối quan trọng:** Theo tục lệ cổ truyền, Thánh Mẫu **không bao giờ giáng đồng mở khăn** như các hàng dưới (hoặc chỉ "ứng bóng" thoáng qua trong tích tắc khi làm đại lễ mở phủ). Vì vậy **KHÔNG thiết kế giá hầu Mẫu múa hát thông thường** để tránh phạm kỵ. |
| **2** | **Ngũ Vị Tôn Quan (Quan Lớn)** | Quan Đệ Nhất (Đỏ), Quan Đệ Nhị (Xanh), Quan Đệ Tam (Trắng), Quan Đệ Tứ (Vàng), Quan Đệ Ngũ Tuần Tranh (Xanh lam/Xanh lục). | Uy nghiêm, võ tướng; đội mũ cánh chuồn, mặc áo mãng thêu rồng; thường múa kiếm, múa cờ lệnh và khai quang chứng sớ. |
| **3** | **Tứ Phủ Chầu Bà (12 Chầu)** | Từ Chầu Đệ Nhất đến Chầu Đệ Tứ, Chầu Năm Suối Lân, Chầu Lục, Chầu Bảy, Chầu Tám, Chầu Chín, Chầu Mười Đồng Mỏ, Chầu Bé Bắc Lệ. | Duyên dáng nhưng uy quyền; trang phục theo sắc phủ (rất nhiều giá thuộc Nhạc Phủ mặc áo chàm/xanh); thường múa mồi (đuốc), múa quạt, múa vắt khăn. |
| **4** | **Tứ Phủ Ông Hoàng (10 Ông Hoàng)** | Nổi bật nhất trong hầu đồng là **Ông Hoàng Bơ** (Trắng - Thoải phủ), **Ông Hoàng Bảy Bảo Hà** (Tím/Chàm - Nhạc phủ), **Ông Hoàng Mười Nghệ An** (Vàng - Địa phủ). | Phong lưu, văn võ song toàn; đội khăn xếp chữ nhân cài trâm, mặc áo vạt hò/áo mãng; múa quạt, múa hèo (gậy), ngâm thơ, thưởng trà, ban lộc rộng rãi. |
| **5** | **Tứ Phủ Thánh Cô (12 Cô)** | Cô Đệ Nhất, Cô Đôi Thượng Ngàn (Xanh), Cô Bơ Bông (Trắng), Cô Tư, Cô Năm, Cô Sáu, Cô Chín Sòng Sơn (Hồng/Đỏ), Cô Bé Thượng Ngàn... | Trẻ trung, tươi vui; múa mồi, múa quạt, múa chèo đò (Cô Bơ), múa hái hoa/hái lộc rừng (Cô Đôi, Cô Bé); phát lộc hoa quả, gương lược, tiền lộc. |
| **6** | **Tứ Phủ Thánh Cậu (12 Cậu)** | Thường hầu Cậu Hoàng Cả, Cậu Hoàng Đôi, Cậu Bơ, **Cậu Bé Hoàng Tử** (Cậu Bé Thượng Ngàn / Cậu Bé Đồi Ngang). | Hồn nhiên, tinh nghịch; đầu thắt khăn rìu hai bên, mặc áo ngắn thêu kim tuyến; múa hèo, múa lân/cờ, tung lộc sôi nổi làm khép lại buổi hầu trong hoan hỉ. |

---

## 3. Thiết kế Không gian & Công trình 3D

### 3.1. Vị trí Quy hoạch & Bố cục Kiến trúc Tổng thể (Mặt bằng 24m x 20m tại Hướng Đông)
- **Vị trí trên bản đồ 3D (`TempleStage.ts`):** Nằm ở **phía Đông (bên phải) của Đại Hùng Bảo Điện** (tâm công trình đặt tại tọa độ `x = +32m, z = -18m`, mặt tiền quay về hướng Tây hoặc hướng Nam nối với đường dạo lát đá sân chùa).
- **Kiến trúc:** Thiết kế theo kiểu kiến trúc **Chữ Đinh (丁)** truyền thống Việt Nam, gồm tiền đường rộng rãi cho người dự lễ và hậu cung thâm nghiêm:

```
+-------------------------------------------------------------------+
|                         CUNG CẤM (HẬU CUNG)                       |
|        [Tượng Tam Tòa Thánh Mẫu: Đỏ (Giữa) - Xanh (Tả) - Trắng]   |
+---------------------+-----------------------+---------------------+
|   BAN TRẦN TRIỀU    |   BAN CÔNG ĐỒNG       |   BAN CHẦU BÀ /     |
| (Đức Thánh Trần)    |   TỨ PHỦ & NGŨ VỊ     |   SƠN TRANG         |
|                     |      TÔN QUAN         |                     |
|                     +-----------------------+                     |
|                     |  BÀN THỜ & MÂM LỄ VẬT |                     |
|                     +-----------------------+                     |
|                     |                       |   [KHU HẦU DÂNG &   |
|  [KHU CUNG VĂN]     |      CHIẾU HẦU        |    TỦ KHĂN ÁO 36]   |
|  (Đàn nguyệt, trống,|   (Thảm nhung đỏ      |   (4 NPC Hầu dâng)  |
|   phách, nhị, sáo)  |    5m x 3.6m giữa)    |                     |
|                     +-----------------------+                     |
|                     |   [HÒM CÔNG ĐỨC]      |                     |
|                     |   (Tương tác Đặt lễ)  |                     |
|---------------------+-----------------------+---------------------|
|                                                                   |
|              KHU VỰC KHÁN GIẢ / NGƯỜI DỰ LỄ (PROXIMITY ZONE)      |
|       (Trải chiếu hoa hai bên tả - hữu & phía trước Chiếu Hầu,     |
|        chừa lối đi giữa làm trục thần đạo hướng thẳng vào ban thờ)|
|                                                                   |
+--------------------------[ CỬA ĐIỆN THỜ ]-------------------------+
|         LỐI ĐI ĐÁ KẾT NỐI SANG ĐẠI HÙNG BẢO ĐIỆN (Hướng Tây)      |
+-------------------------------------------------------------------+
```

### 3.2. Phân khu chức năng chi tiết
1. **Cung Cấm (Hậu Cung):** Đặt ở vị trí sâu và cao nhất (`y = +0.8m` so với sàn điện), treo cửa võng chạm khắc sơn son thếp vàng. Bên trong an vị tượng Tam Tòa Thánh Mẫu (Mẫu Đệ Nhất áo đỏ ở giữa, Mẫu Đệ Nhị áo xanh bên tả, Mẫu Đệ Tam áo trắng bên hữu). Người chơi không được bước vào Cung Cấm (có BoxCollider chặn).
2. **Ban Công Đồng Tứ Phủ & Ban Trần Triều:**
   - Chính giữa phía trước Cung Cấm là **Ban Công Đồng** (Ngũ Vị Tôn Quan, Tứ Phủ Chầu Bà, Ông Hoàng) và phía dưới gầm hương án là khám thờ **Ngũ Hổ - Bạch Xà - Thanh Xà**.
   - Bên tả là **Ban Đức Thánh Trần**, bên hữu là **Ban Sơn Trang**.
3. **Chiếu Hầu (Trung tâm diễn xướng):** Kích thước `5.0m x 3.6m`, đặt ngay trước Ban Công Đồng, trải chiếu cói viền đỏ chồng thảm nhung thêu hoa văn cổ. Đây là vùng sân khấu độc quyền của **NPC Đồng Thầy** và **NPC Hầu Dâng**; người chơi có vòng collider mềm ngăn không cho dẫm lên giữa chiếu hầu khi đang có lễ.
4. **Khu Nhạc Cung Văn (Bên Tả Chiếu Hầu):** Chiếu ngồi của 3 NPC Cung Văn cùng bộ nhạc cụ dân tộc (đàn nguyệt, trống chầu, phách/cảnh, đàn nhị, thanh la).
5. **Khu Hầu Dâng & Tráp Lộc (Bên Hữu Chiếu Hầu):** Đặt giá treo khăn chầu áo ngự, tráp đựng đạo cụ (kiếm, cờ, mồi, quạt, hèo) và các mâm lộc (túi lộc đỏ-vàng).
6. **Hòm Công Đức & Bàn Ghi Danh (Đặt lễ):** Đặt ở rìa phải lối vào tiền đường, có bảng hiệu phát sáng nhẹ theo chuẩn Binance Dark (`#fcd535`) để người chơi bấm phím `F` hoặc click chuột mở ngăn kéo **Đặt Lễ / Phát Tâm Mở Giá Đặc Cách (`2,500 MC`)**.
7. **Khu vực Khán giả / Người dự lễ (Proximity Zone):** Toàn bộ lòng nhà tiền đường bao quanh 3 mặt của Chiếu Hầu (bán kính `R = 14m` tính từ tâm Chiếu Hầu), bố trí các dãy chiếu hoa để người chơi ngồi dự lễ.

### 3.3. Vật liệu, Màu sắc, Ánh sáng & Âm thanh Không gian
- **Vật liệu (Low-Poly Procedural Materials):** Gỗ lim nâu sẫm (`#3b2314`), cột gỗ sơn son thếp vàng (`#8b1e1e` kết hợp viền vàng kim `#e0b030`), nền gạch bát cổ màu đỏ trầm, thảm chiếu hầu đỏ thẫm.
- **Bảng màu chủ đạo (Ngũ sắc Tứ Phủ):** Đỏ (Thiên), Xanh lục (Nhạc), Trắng ngà (Thoải), Vàng hoàng yến (Địa), kết hợp chuẩn UI Binance Dark (`#0b0e11` / `#1e2329` / `#fcd535`) cho toàn bộ bảng giao diện.
- **Ánh sáng:**
  - Trạng thái bình thường (không có lễ): Ánh sáng đèn lồng vàng ấm dịu (`#ffaa44`), khói trầm hương bay nhẹ từ lư đồng.
  - Trạng thái vào lễ (Active Ritual): Khi vị thánh giáng đồng, hệ thống đèn chiếu điểm (Spotlight) trên Chiếu Hầu chuyển tông màu hòa quyện theo sắc phủ của giá đồng đang ngự (Đỏ ấm cho Quan Đệ Nhất/Trần Triều, Trắng bạc thanh khiết cho Quan Đệ Tam/Cô Bơ, Xanh ngọc lục bảo cho Chầu Đôi/Cô Đôi Thượng Ngàn, Vàng rực rỡ cho Ông Hoàng Mười).
- **Âm thanh không gian (Spatial Audio):** Sử dụng `PannerNode` của Web Audio API đặt tại tâm Khu Cung Văn; âm lượng tiếng đàn nguyệt, trống phách và hát văn rõ nhất khi người chơi đứng trong Nhà Hầu Đồng (`d <= 14m`) và giảm dần khi bước ra sân (`14m < d <= 30m`).

---

## 4. Quy trình Một Buổi Hầu Đồng trong Hệ thống

### 4.1. Thời lượng Chuẩn đã chốt: 8 Phút / Buổi (5 Giá Đồng)
- **Thực tế ngoài đời:** Một vấn hầu kéo dài từ **3 đến 10 tiếng** với tối đa **36 giá đồng**, mỗi giá từ **15 đến 30 phút**.
- **Thiết kế chính thức trong hệ thống (đã chốt):**
  - **Số lượng giá mặc định:** **5 Giá đồng / buổi** (đại diện đầy đủ hàng Quan - Chầu - Ông Hoàng - Cô - Cậu và đủ sắc màu Tứ Phủ).
  - **Tổng thời lượng 1 buổi hầu:** **8 phút (480 giây)**.
  - **Thời lượng mỗi giá:** **96 giây (1 phút 36 giây) / giá**.
  - **Lý do:** Nhịp độ 8 phút / buổi (96 giây / giá) cực kỳ gọn gàng, sinh động cho nền tảng Web 3D, giữ trọn vẹn 6 bước nghi thức cổ truyền mà người chơi không phải chờ đợi lâu.

### 4.2. Danh sách 5 Giá Đồng Mặc định (Bộ 5 Giá Kinh Điển đã chốt)

| Thứ tự | Tên Giá Đồng | Thuộc Phủ | Sắc phục chủ đạo | Đạo cụ & Vũ đạo đặc trưng | Ý nghĩa Chúc phúc (Buff) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Giá 1** | **Quan Lớn Đệ Tam Thoải Phủ** | Thoải Phủ | Trắng thêu rồng bạc | Múa kiếm đôi, múa cờ lệnh, chứng sớ | Khai thông trí tuệ, hóa giải vận hạn |
| **Giá 2** | **Chầu Đôi Thượng Ngàn** | Nhạc Phủ | Xanh lục / Chàm thêu phượng | Múa mồi (đuốc thiêng), múa quạt xanh | Bình an sức khỏe, tài lộc núi rừng |
| **Giá 3** | **Ông Hoàng Mười (Nghệ An)** | Địa Phủ | Vàng hoàng gia thêu rồng | Múa quạt vàng, múa hèo, ngâm thơ | Công danh đỗ đạt, hanh thông sự nghiệp |
| **Giá 4** | **Cô Đôi Thượng Ngàn** *(hoặc Cô Bơ)* | Nhạc / Thoải | Xanh lá (Cô Đôi) / Trắng (Cô Bơ) | Múa quạt, múa hái hoa rừng / múa chèo đò | Duyên lành, may mắn, an nhiên tự tại |
| **Giá 5** | **Cậu Bé Hoàng Tử** | Nhạc Phủ | Xanh/Đỏ thêu kim tuyến, khăn rìu | Múa hèo, múa cờ/lân, phát lộc rộn ràng | Hoan hỉ, chiêu tài, viên mãn cuối buổi |

*(Ghi chú: Với buổi hầu **Đặc cách do người chơi công đức 2,500 MC**, người khởi xướng có thể chọn thêm **Giá Đức Ông Trần Triều** hoặc **Giá Ông Hoàng Bảy Bảo Hà** thay thế vào danh sách).*

### 4.3. Kịch bản Chi tiết 6 Bước của Từng Giá Đồng (Chu kỳ 96 giây/giá)

```
[Bước 1: Trùm khăn & Thay lễ phục] (00:00 - 00:10 | 10s)
       │
       ▼
[Bước 2: Mở khăn & Dâng hương]     (00:10 - 00:20 | 10s)
       │
       ▼
[Bước 3: Lễ Thánh Giáng]           (00:20 - 00:30 | 10s)
       │
       ▼
[Bước 4: Múa Đồng & Hát Chầu Văn]  (00:30 - 01:10 | 40s)
       │
       ▼
[Bước 5: Ban Lộc cho Người dự lễ]  (01:10 - 01:28 | 18s) ──> [TRIGGER CHIA THƯỞNG MC]
       │
       ▼
[Bước 6: Thánh Thăng (Xe giá)]     (01:28 - 01:36 | 08s)
```

- **Bước 1 — Thay lễ phục theo vị thánh ngự (10 giây):** 4 NPC Hầu Dâng quây khăn phủ diện màu đỏ lên đầu NPC Đồng Thầy. Khi mở sang bước mới, trang phục của NPC Đồng Thầy chuyển đổi tức thì sang bộ khăn chầu áo ngự của vị thánh tương ứng.
- **Bước 2 — Dâng hương (10 giây):** NPC Đồng Thầy quay mặt vào Ban Công Đồng, dâng 3 nén tâm hương, thực hiện động tác lễ bái trang nghiêm. Tiếng chiêng trống dạo đầu vang lên.
- **Bước 3 — Lễ Thánh Giáng / Thánh nhập (10 giây):** Cung Văn tấu nhịp trống sấm dồn dập; NPC Đồng Thầy lắc đầu nhẹ theo nhịp phách rồi tung khăn phủ diện (**Mở khăn**). Hào quang nhẹ theo màu phủ tỏa ra quanh Chiếu Hầu; trên màn hình hiển thị thông báo trang trọng: *"Giá ngự: Quan Lớn Đệ Tam Thoải Phủ giáng đàn"*.
- **Bước 4 — Múa đồng kết hợp Hát Chầu Văn (40 giây):** Cung Văn hát văn thỉnh và văn tả cảnh. NPC Đồng Thầy đứng dậy khỏi chiếu, nhận đạo cụ từ tay Hầu Dâng (kiếm, mồi, quạt, hèo) và thực hiện bài múa đồng đặc trưng trên mặt Chiếu Hầu. Trong giai đoạn này, giao diện hiển thị nút **"Chắp Tay Khánh Hỷ"** để người chơi xác nhận đang tương tác thực.
- **Bước 5 — Ban lộc cho người tham dự (18 giây):** NPC Đồng Thầy ngồi xuống chiếu hầu, quay mặt ra phía khán giả; NPC Hầu Dâng bưng mâm lộc. Các hiệu ứng túi lộc vàng bay từ Chiếu Hầu tỏa về phía các nhân vật người chơi đang đứng/ngồi hợp lệ trong khu vực. **Hệ thống Backend kích hoạt phát thưởng `MC` trực tiếp vào ví tài khoản của từng người chơi đủ điều kiện.**
- **Bước 6 — Thánh Thăng / Thánh xuất (8 giây):** Cung Văn hát câu kết *"Xe giá hồi cung"*; NPC Đồng Thầy chắp tay, Hầu Dâng tung khăn đỏ phủ lên đầu Đồng Thầy. Ánh sáng dịu xuống, khép lại giá đồng và chuyển sang giá tiếp theo.

---

## 5. Nhân vật & Hệ thống NPC

Hệ thống nhân vật sử dụng phong cách **Chibi Low-Poly đồng bộ** với hệ thống nhân vật hiện tại của dự án (`AvatarGeometry.ts` / `LowPolyAvatarModel.ts`), nhưng được thiết kế bộ khung trang phục nghi lễ riêng:

| Vai trò | Số lượng | Vị trí | Mô tả Tạo hình & Hành vi (Animation State Machine) |
| :--- | :--- | :--- | :--- |
| **NPC Đồng Thầy (Thanh Đồng)** | 01 | Chính giữa Chiếu Hầu | Nhân vật trung tâm thực hiện nghi lễ. Có 6 trạng thái animation: `IdleKneel` (Quỳ tĩnh), `CoverScarf` (Trùm khăn phủ diện), `IncenseBow` (Dâng hương lễ thánh), `SwordDance` / `TorchDance` / `FanDance` / `StaffDance` (Múa đồng theo đạo cụ), `BlessingDistribute` (Ban lộc), và `Ascend` (Thánh thăng). |
| **NPC Hầu Dâng (Tứ Trụ)** | 04 | Ngồi hai bên tả - hữu mép Chiếu Hầu | Mặc áo dài ngũ thân truyền thống màu trầm trang nhã, đầu đội khăn đóng. Thực hiện động tác tung khăn phủ diện, thay trang phục, dâng hương, dâng kiếm/quạt/mồi cho Đồng Thầy và bưng tráp lộc khi đến bước Ban lộc. |
| **NPC Cung Văn** | 03 | Khu Cung Văn (bên tả Chiếu Hầu) | Mặc áo dài the đen, khăn xếp. NPC 1 gảy đàn nguyệt; NPC 2 gõ trống phách & hát văn; NPC 3 kéo đàn nhị / thổi sáo. Chuyển động tay đồng bộ với nhịp BPM của bản Chầu văn đang phát. |
| **Người chơi (Người dự lễ)** | Tối đa 50 người/phòng | Khu Khán giả (xung quanh Chiếu Hầu) | Khi bước vào Proximity Zone hoặc ngồi lên chiếu dự lễ, nhân vật tự động chuyển sang tư thế **Chắp tay trang nghiêm** (`HandsClasped`). Khi nhấn nút "Chắp Tay Thỉnh Lộc", nhân vật cúi đầu nhẹ đón lộc. |

### Thiết kế Trang phục NPC Đồng Thầy theo Giá (Modular Mesh Swap)
Để tối ưu hiệu năng WebGL (Three.js), thân NPC Đồng Thầy giữ nguyên khung xương (`rig`), chỉ hoán đổi vật liệu màu áo (`Material Color Slot`), mũ/khăn trên đầu (`Headgear Group`) và đạo cụ cầm tay (`LeftHandProp` / `RightHandProp`):
- **Hàng Quan Lớn & Đức Ông Trần Triều:** Áo mãng thêu rồng (Đỏ / Trắng / Vàng), đai lưng ngọc, đầu đội **Mũ Cánh Chuồn** gắn hài sảo, tay cầm song kiếm hoặc cờ lệnh.
- **Hàng Chầu Bà:** Áo chầu thêu phượng, khăn vấn kết hoa hoặc khăn thổ cẩm (Nhạc phủ), tay cầm đôi mồi lửa (emissive glow) hoặc đôi quạt lụa.
- **Hàng Ông Hoàng (Mười / Bảy):** Áo vạt hò thêu rồng màu vàng (Ông Hoàng Mười) hoặc tím chàm (Ông Hoàng Bảy), đầu đội **Khăn Xếp Chữ Nhân** cài trâm kim hoàn, tay cầm quạt giấy và gậy hèo.
- **Hàng Thánh Cô:** Áo tứ thân / áo dài lụa màu xanh non hoặc trắng, đầu đội **Khăn Phượng / Khăn Quai Thao** cài trâm hoa, tay cầm quạt hoa hoặc mái chèo.
- **Hàng Thánh Cậu:** Áo ngắn thêu kim tuyến vạt chéo, đầu thắt **Khăn Rìu** hai chỏm hai bên, tay cầm đôi hèo hoa.

---

## 6. Hệ thống Âm nhạc & Hình ảnh

### 6.1. Kiến trúc Âm thanh Hybrid (Procedural Chầu Văn + Hỗ trợ gắn `.mp3` về sau)
Theo quyết định của Chủ dự án, hệ thống âm thanh trong `lib/audio/ZenAudio.ts` được thiết kế theo cơ chế **Hybrid 2 lớp**:
1. **Lớp 1 — Bộ tổng hợp Chầu Văn thủ tục (`ProceduralChauVanEngine` hoạt động ngay):**
   - Sử dụng Web Audio API tổng hợp trực tiếp tiếng **Trống Chầu** (mặt trống trầm + tang trống đanh), **Phách Tre** (nhịp Dọc / Phú Bình / Xá Thượng), **Thanh La (Cảnh)** ngân kim loại và tiếng **Đàn Nguyệt** gảy giai điệu ngũ cung theo từng giá đồng.
2. **Lớp 2 — Khe cắm File `.mp3` tự động (`Custom MP3 Override`):**
   - Mỗi giá đồng có cấu hình đường dẫn âm thanh tại `public/audio/hau-dong/<deity_id>.mp3` (ví dụ `quan_de_tam.mp3`, `chau_doi.mp3`, `ong_hoang_muoi.mp3`, `co_doi.mp3`, `cau_be.mp3`).
   - Khi bắt đầu giá đồng, hệ thống kiểm tra nếu file `.mp3` tồn tại trong `public/audio/hau-dong/` thì tự động phát file `.mp3` đó qua `AudioElement` gắn vào `SpatialPanner`; nếu chưa có file `.mp3` thì tự động dùng `ProceduralChauVanEngine`. Nhờ vậy sau này chỉ cần chép file `.mp3` vào thư mục là chạy ngay mà không cần sửa code.

### 6.2. Hiệu ứng Hình ảnh (Visual Effects - VFX)
- **Múa Mồi (Đuốc thiêng):** Sử dụng hệ thống hạt (Particle System) nhẹ tại đầu 2 bó đuốc trên tay NPC Đồng Thầy trong các giá Chầu và giá Cô, tạo vệt sáng ấm khi xoay cổ tay.
- **Hiệu ứng Thánh Giáng & Ban Lộc:** Khi mở khăn, một vòng sóng ánh sáng mềm mại dưới mặt Chiếu Hầu lan tỏa theo màu sắc của Phủ; khi Ban lộc, các hạt sáng vàng kim (`#fcd535`) bay theo đường cong Bézier từ mâm lộc đến vị trí các người chơi hợp lệ.

---

## 7. Cơ chế Tương tác Khu vực (Proximity) & Kinh tế MC

### 7.1. Định nghĩa Khu vực & Điều kiện "Đang Xem Hợp Lệ" (Eligibility Rules)
1. **Phạm vi Khu vực (Proximity Zone):**
   - Bán kính `R <= 14m` tính từ tâm Chiếu Hầu của Nhà Hầu Đồng.
   - Khi người chơi bước vào vùng này trong lúc đang có buổi hầu, góc trên màn hình hiển thị huy hiệu **`ĐANG DỰ LỄ HẦU ĐỒNG — GIÁ THỨ [k/5]`**.
2. **Điều kiện được tính là "Đang xem hợp lệ" để nhận lộc ở Bước 5 của mỗi giá (96 giây/giá):**
   - **Thời gian hiện diện tối thiểu (`T_stay`):** Người chơi phải có mặt liên tục trong Proximity Zone tối thiểu **45 giây / 96 giây** trước thời điểm Bước 5 (Ban lộc) kết thúc.
   - **Xác nhận không treo máy (Anti-AFK Check):** Trong khoảng thời gian diễn ra Bước 3 hoặc Bước 4 của giá đồng đó, trên giao diện xuất hiện nút **"Chắp Tay Khánh Hỷ / Thỉnh Lộc"** (hoặc phím tắt `E`). Người chơi phải bấm ít nhất **01 lần trong mỗi giá** để xác nhận đang theo dõi thực sự.
   - **Xác thực tài khoản:** Đã kết nối ví Cardano (CIP-30) hoặc có phiên JWT hợp lệ (`sessions` table).

### 7.2. Công thức Tính Mức Thưởng Ban Lộc (`MC`) & Giới hạn

#### A. Buổi hầu theo Lịch cố định (Mồng 1 & Ngày 15 Âm lịch — Nguồn từ Quỹ Dự Trữ Đền):
- **Mức thưởng cơ bản mỗi giá (`R_base`):** **15 MC / giá / người**.
- **Thưởng trọn buổi (Full Attendance Bonus):** Nếu người chơi theo dõi trọn vẹn cả 5 giá trong một buổi hầu (8 phút), ở giá cuối cùng nhận thêm **+25 MC**.
- **Tổng nhận tối đa 1 buổi hầu cố định:** `5 x 15 + 25 = 100 MC / buổi / người`.

#### B. Buổi hầu Đặc cách (Ngưỡng mở lễ `D = 2,500 MC` đã chốt):
Khi có buổi hầu đặc cách với tổng quỹ đóng góp `D = 2,500 MC`, **60% số tiền công đức (`P_pool = 1,500 MC`)** được đưa trực tiếp vào **Quỹ Ban Lộc của buổi hầu đó**, chia đều cho 5 giá (`P_gia = 300 MC / giá`).
- Tại mỗi giá đồng, gọi `N_active` là số người chơi đủ điều kiện đang dự lễ tại thời điểm Ban lộc:

$$R_{\text{người/giá}} = \min\left( 75,\; \max\left( 15,\; \left\lfloor \frac{P_{\text{giá}}}{N_{\text{active}}} \right\rfloor \right) \right)$$

Trong đó:
- $R_{\min\_\text{giá}} = 15\text{ MC}$ (mức lộc tối thiểu để ai dự lễ cũng hoan hỉ).
- $R_{\max\_\text{giá}} = 75\text{ MC}$ (trần mỗi giá cho 1 người để tránh trường hợp 1 người tự mở buổi hầu trong phòng vắng rồi tự nhận lại toàn bộ quỹ).
- Phần dư trong `P_gia` (nếu ít người xem nên chạm trần `75 MC/người`) sẽ được kết chuyển vào **Quỹ Dự Trữ Lễ Sóc Vọng (`ritual_reserve_pool`)** để tài trợ cho các buổi hầu Lịch cố định ngày Mồng 1 và Rằm.

### 7.3. Bảng Tổng hợp Thông số Kinh tế & Giới hạn Chống Farm

| Tham số | Giá trị Chính thức | Lý do Thiết kế & Cân bằng Kinh tế |
| :--- | :--- | :--- |
| **Thời lượng 1 buổi / 1 giá** | **8 phút (480s) / 96s mỗi giá** | Gọn gàng, sinh động, giữ chân người chơi theo dõi trọn 5 giá. |
| **Thời gian hiện diện tối thiểu / giá** | **45 giây / 96 giây** | Ngăn hành vi chỉ chạy vào đúng 5 giây cuối lúc phát lộc rồi chạy ra. |
| **Cơ chế chống AFK** | Bấm **"Chắp Tay"** 1 lần/giá | Ngăn treo máy 24/24 trong Nhà Hầu Đồng để tự động hút tiền `MC`. |
| **Ngưỡng công đức mở lễ Đặc cách** | **2,500 MC / buổi hầu** | Đủ giá trị tạo sự kiện tâm điểm toàn server (Quỹ Ban lộc 1,500 MC / 5 giá). |
| **Lộc mỗi giá (Lịch cố định)** | **15 MC / giá** (+25 MC nếu đủ 5 giá) | Tương đương 100 MC cho 8 phút dự lễ trang nghiêm. |
| **Lộc mỗi giá (Buổi Đặc cách)** | **15 – 75 MC / giá** (từ 60% quỹ công đức) | Tạo sự hào hứng khi có đại thí chủ mở lễ lớn mà không cho phép tự farm 1 mình. |
| **Giới hạn nhận tối đa / Buổi** | **375 MC / tài khoản / buổi** | Trần an toàn tuyệt đối cho mỗi phiên hầu đồng (5 giá x 75 MC). |
| **Giới hạn nhận tối đa / Ngày** | **500 MC / tài khoản / ngày** | Dù trong ngày có nhiều người mở buổi hầu đặc cách liên tiếp, 1 tài khoản không thể farm vượt 500 MC/ngày. |
| **Chống đa tài khoản (Sybil / Multi-tab)** | Khóa theo `account_id` + `wallet_address` + Rate-limit IP (tối đa 2 ví/IP/giá) | Chặn việc mở 20 tab trình duyệt cùng lúc để chia nhỏ quỹ ban lộc. |

### 7.4. Cơ chế Phân bổ Dòng tiền Công đức (`2,500 MC`)

```
[Người chơi Công đức Mở Đàn: D = 2,500 MC]
              │
              ├──> 60% (1,500 MC) ──> [QUỸ BAN LỘC TRỰC TIẾP (300 MC / giá)]
              │                        ├─ Chia cho người dự lễ trong 5 giá đồng (15..75 MC/người/giá)
              │                        └─ Phần dư (nếu ít người xem) ──> [Quỹ Dự Trữ Rằm/Mồng 1]
              │
              ├──> 25% (625 MC)   ──> [QUỸ TU BỔ & TRANG BỊ ĐIỆN THỜ (MC SINK / BURN)]
              │                        └─ Đốt (Burn) khỏi lưu thông để nâng cấp cấp độ Điện thờ,
              │                           mở khóa bộ Khăn Áo mới, Đèn lồng & Nhạc khí (Chống lạm phát)
              │
              └──> 15% (375 MC)   ──> [QUỸ DỰ TRỮ LỄ SÓC VỌNG (MỒNG 1 & RẰM)]
                                       └─ Tài trợ nguồn MC ban lộc cho các buổi hầu lịch cố định,
                                          giúp hệ thống tự chủ mà không cần in thêm MC vô hạn
```

---

## 8. Lịch Tổ chức & Hệ thống Hàng chờ Đặc cách

### 8.1. Lịch Cố định (Lễ Sóc Vọng: Mồng 1 và Ngày 15 Âm lịch)
- **Hệ lịch sử dụng:** Sử dụng **Âm lịch Việt Nam (múi giờ `UTC+7` - `Asia/Ho_Chi_Minh`)**, đồng bộ trực tiếp với bộ tính lịch Âm - Dương sẵn có của dự án (`lib/boi/MetaphysicsService.ts`).
- **Ngày tổ chức định kỳ:** Ngày **Mồng 1 Âm lịch** và ngày **15 (Rằm) Âm lịch** hằng tháng.
- **Cách xử lý tháng thiếu / tháng nhuận:** Mọi tháng Âm lịch (dù 29 hay 30 ngày) đều luôn có ngày Mồng 1 và ngày 15. Nếu có lễ Tất niên cuối tháng, tháng thiếu (29 ngày) sẽ tự động dời lễ về ngày 29 Âm lịch; tháng nhuận vẫn tổ chức đầy đủ vào Mồng 1 và 15.
- **Khung giờ tổ chức trong ngày Mồng 1 & Rằm:** Tổ chức **4 khung giờ cố định trong ngày** (`09:00`, `12:00`, `18:00`, `21:00` giờ Việt Nam).

### 8.2. Cơ chế Đặc cách (`2,500 MC`) & Hàng chờ

| Hạng mục | Quy tắc Thiết kế Chính thức |
| :--- | :--- |
| **1. Ngưỡng mở buổi hầu đặc cách** | **2,500 MC / buổi hầu**. |
| **2. Hai hình thức đóng góp** | **a) Độc lập (Đại Thí Chủ Mở Đàn):** Một người chơi công đức một lần đủ `>= 2,500 MC` để mở ngay một vấn hầu riêng.<br>**b) Cộng dồn (Bách Gia Công Đức):** Nhiều người chơi cùng đóng góp các khoản nhỏ (tối thiểu `50 MC/lần`) vào thanh tiến trình **"Quỹ Mở Đàn Chung"**. Ngay khi thanh tiến trình đạt mốc `2,500 / 2,500 MC`, hệ thống tự động kích hoạt 1 buổi hầu đặc cách cộng đồng. |
| **3. Thời gian chuẩn bị & Thời gian nghỉ (Cooldown)** | - Khi đạt ngưỡng kích hoạt: Hệ thống phát thông báo toàn server và đếm ngược **1 phút chuẩn bị (`Pre-Ritual Countdown`)** để người chơi đang ở Đại Hùng Bảo Điện kịp đi bộ sang Nhà Hầu Đồng.<br>- **Thời gian nghỉ giữa 2 buổi hầu liên tiếp (Cooldown):** **10 phút** sau khi buổi hầu trước kết thúc. |
| **4. Hàng chờ (Ritual Queue)** | - Đưa vào **Hàng chờ (`ritual_queue`)** theo nguyên tắc **FIFO (Vào trước - Phục vụ trước)**, tối đa **05 buổi chờ cùng lúc**.<br>- Các buổi hầu **Lịch cố định (Mồng 1 & Rằm)** luôn có độ ưu tiên cao nhất ở đúng khung giờ đã định. |

### 8.3. Quyền lợi của Người Khuyên Góp (Thí Chủ / Thanh Đồng Chủ Lễ)
1. **Ghi danh trên Bảng Vàng Công Đức & Sớ Chúc Phúc:** Tên hiển thị và địa chỉ ví rút gọn của người mở đàn (hoặc Top 3 người đóng góp cao nhất trong buổi Bách Gia) được khắc lên **Cuốn Thư Vàng** phía trên Chiếu Hầu trong suốt buổi lễ và lưu vào sổ cái Hydra L2.
2. **Quyền chọn 1 Giá Đồng Tâm Nguyện:** Người mở đàn độc lập (`>= 2,500 MC`) được chọn **1 Giá Đồng tâm nguyện** (bao gồm **Giá Đức Ông Trần Triều** hoặc **Giá Ông Hoàng Bảy Bảo Hà**) đưa vào danh sách 5 giá của buổi hầu đó.
3. **Vị trí Ngồi Danh Dự & Buff Cát Tường:** Được ưu tiên vị trí ngồi chiếu hoa hàng đầu chính diện Chiếu Hầu và nhận **+15% tỉ lệ Cát Tường** khi gieo quẻ trong ngày hôm đó.

---

## 9. Kỹ thuật Triển khai (Database, Trigger, Ledger, Audit)

### 9.1. Cấu trúc Bảng Dữ liệu SQLite Mới (`server/utils/wallet/db.ts`)

```sql
-- 1. Bảng quản lý các buổi hầu đồng (Lịch cố định & Đặc cách)
CREATE TABLE IF NOT EXISTS hau_dong_sessions (
  id TEXT PRIMARY KEY,
  session_type TEXT NOT NULL,              -- 'scheduled_lunar' | 'sponsored_solo' | 'sponsored_crowd'
  sponsor_account_id TEXT,
  sponsor_display_name TEXT,
  total_donated_mc INTEGER NOT NULL DEFAULT 0,
  blessing_pool_mc INTEGER NOT NULL DEFAULT 0,     -- 60% quỹ dùng để ban lộc (1,500 MC)
  distributed_mc INTEGER NOT NULL DEFAULT 0,
  burned_mc INTEGER NOT NULL DEFAULT 0,            -- 25% quỹ đốt chống lạm phát (625 MC)
  reserve_mc INTEGER NOT NULL DEFAULT 0,           -- 15% + phần dư chuyển vào quỹ dự trữ (375 MC)
  selected_deities_json TEXT NOT NULL,             -- Mảng JSON 5 mã giá đồng
  current_stage_index INTEGER NOT NULL DEFAULT 0,  -- 0..4 (tương ứng giá 1..5)
  current_step TEXT NOT NULL DEFAULT 'queued',     -- 'queued'|'countdown'|'costume'|'incense'|'descent'|'dance'|'blessing'|'ascent'|'completed'
  scheduled_start_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL
);

-- 2. Bảng ghi nhận đóng góp công đức mở đàn (Crowdfunding & Solo)
CREATE TABLE IF NOT EXISTS hau_dong_donations (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  account_id TEXT NOT NULL,
  amount_mc INTEGER NOT NULL,
  requested_deity TEXT,
  ledger_tx_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 3. Bảng điểm danh & kiểm toán ban lộc theo từng giá đồng (Chống nhận trùng - Idempotency)
CREATE TABLE IF NOT EXISTS hau_dong_attendance_claims (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  stage_index INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  stay_seconds INTEGER NOT NULL,
  interacted_at TEXT NOT NULL,
  reward_mc INTEGER NOT NULL,
  ledger_tx_id TEXT NOT NULL,
  client_ip_hash TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, stage_index, account_id)
);
```

### 9.2. Sự kiện Kích hoạt, Sổ cái & Kiểm toán
- **Heartbeat Hiện diện (`POST /api/hau-dong/heartbeat`):** Gửi mỗi 10 giây khi người chơi đứng trong vùng `R <= 14m` của Nhà Hầu Đồng, ghi nhận `stay_seconds` và thao tác bấm **"Chắp Tay Khánh Hỷ"**.
- **Nhận Lộc Bước 5 (`POST /api/hau-dong/claim-blessing`):** Kiểm tra `stay_seconds >= 45`, `hasSaluted === true`, gọi `creditMc()` trong `withTransaction()`, ghi vào `mc_ledger` (`tx_type = 'hau_dong_blessing'`) và gửi biên nhận qua Hydra L2 Notary (`hydraClient.ts`).

---

## 10. Rủi ro & Lưu ý Đạo đức Văn hóa

1. **Tôn trọng nguyên tắc tín ngưỡng:** Không thiết kế giá hầu Tam Tòa Thánh Mẫu mở khăn múa hát; giữ đúng màu sắc khăn áo và đạo cụ của từng Phủ.
2. **Ngôn từ chuẩn mực:** Sử dụng thuật ngữ truyền thống (*"Dự lễ", "Thỉnh lộc", "Ban lộc", "Phát tâm công đức"*).
3. **Chống phá rối trong không gian thờ tự:** Đặt BoxCollider bảo vệ Cung Cấm và Chiếu Hầu; tự động chuyển nhân vật sang tư thế chắp tay khi vào trong Điện thờ; lọc ngôn từ trên Bảng Vàng Công Đức.

---

## 11. Lộ trình Thực hiện (Roadmap)

| Giai đoạn | Hạng mục Công việc Chính | Tiêu chí Hoàn thành (Definition of Done) |
| :--- | :--- | :--- |
| **Giai đoạn 1: Kiến trúc 3D Nhà Hầu Đồng** | Dựng `HauDongSanctuary.ts` ở phía Đông Đại Hùng Bảo Điện (`x = +32m, z = -18m`), gồm Cung Cấm, Ban Công Đồng, Ban Trần Triều, Chiếu Hầu, Khu Cung Văn, Hòm Công Đức, đường đá kết nối và vùng Proximity Zone `R = 14m`. | Hiển thị mượt 60 FPS, không Z-fighting, đi bộ trực tiếp từ Đại Hùng Bảo Điện sang Nhà Hầu Đồng. |
| **Giai đoạn 2: NPC, Trang phục & Âm nhạc** | Dựng NPC Đồng Thầy, 4 NPC Hầu Dâng, 3 NPC Cung Văn; thiết kế trang phục & đạo cụ 5 giá đồng + Đức Ông Trần Triều / Ông Hoàng Bảy; lập trình `ProceduralChauVanEngine` trong `ZenAudio.ts` kèm cơ chế tự nhận file `.mp3`. | NPC diễn hoạt đầy đủ 6 bước (96s/giá x 5 giá = 8 phút), nhạc Chầu văn vang lên theo không gian 3D. |
| **Giai đoạn 3: Backend Kinh tế, Lịch & Hàng chờ** | Tạo bảng SQLite, viết API trạng thái buổi hầu, API Công đức mở đàn (`2,500 MC`), Hàng chờ FIFO, Lịch Âm Mồng 1/Rằm, Heartbeat hiện diện (`45s`) và Chia thưởng `MC` ở Bước 5. | `npm run wallet:reconcile` PASS và `npm run wallet:test:hydra` PASS. |
| **Giai đoạn 4: Giao diện UI & Kiểm thử Tổng thể** | Thiết kế Drawer Nhà Hầu Đồng & HUD Dự lễ theo chuẩn Binance Dark (`DESIGN.md`): Thanh tiến trình 5 giá (8 phút), Nút "Chắp Tay Thỉnh Lộc", Hòm Công Đức `2,500 MC`, Bảng Vàng Ghi Danh. | Vượt qua toàn bộ 3 cổng chất lượng (`verify-ui-primitives.mjs`, `wallet:test:hydra`, `npm run build`). |

---

## 12. Phụ lục: Thuật ngữ & Nguồn tham khảo
- **Giá đồng (Vấn hầu):** Một buổi lễ hầu đồng gọi là một "vấn hầu", mỗi lần một vị Thánh giáng nhập vào Thanh đồng được gọi là một "giá đồng".
- **Thanh đồng (Đồng Thầy):** Người thực hành nghi lễ trung gian tâm linh trên chiếu hầu.
- **Tứ Trụ Hầu Dâng:** Bốn người phụ tá ngồi hai bên chiếu hầu, chuyên trách tung khăn, thay lễ phục, dâng hương, dâng đạo cụ và chuẩn bị mâm lộc.
- **Cung Văn:** Nghệ nhân hát Chầu văn và chơi nhạc cụ dân tộc phục vụ buổi hầu.
- **Thánh giáng / Thánh thăng:** Khoảnh khắc vị Thánh ngự xuống (mở khăn phủ diện) và rời đi (trùm khăn phủ diện).
- **Ban lộc (Tán lộc):** Nghi thức vị Thánh phát quà lộc và lời chúc phúc cho người tham dự.
- **Nguồn tham khảo:** Hồ sơ Di sản UNESCO (2016), *"Đạo Mẫu Việt Nam"* (GS.TS. Ngô Đức Thịnh), `dothosondong86.com`, `luatvietnam.vn`, `vanhoatramhuong.com`, `truyenthongtre.vn`, kênh *"Hát Văn Hầu Đồng"*.

---

## 13. Bảng Chốt Quyết định Thiết kế của Chủ Dự án

| STT | Hạng mục | Quyết định Chính thức của Chủ Dự án |
| :--- | :--- | :--- |
| **1** | **Vị trí Nhà Hầu Đồng** | Đặt ở **bên phải / Hướng Đông của Đại Hùng Bảo Điện**, kết nối trực tiếp trong cùng cảnh 3D. |
| **2** | **Thời lượng 1 buổi hầu** | **8 phút (480 giây)** cho 5 giá đồng (**96 giây / giá**; điều kiện nhận lộc: đứng xem `>= 45 giây/giá` + bấm "Chắp Tay"). |
| **3** | **Ngưỡng công đức Đặc cách** | **2,500 MC / buổi hầu** (60% Quỹ Ban Lộc = `1,500 MC`, 25% Tu bổ/Burn = `625 MC`, 15% Quỹ Dự trữ Rằm/Mồng 1 = `375 MC`). |
| **4** | **Danh sách Giá Đồng** | **Quan Lớn Đệ Tam -> Chầu Đôi Thượng Ngàn -> Ông Hoàng Mười -> Cô Đôi Thượng Ngàn -> Cậu Bé Hoàng Tử** (kèm tùy chọn **Đức Ông Trần Triều / Ông Hoàng Bảy** khi mở đàn đặc cách). |
| **5** | **Hệ thống Âm thanh** | Lập trình bộ tổng hợp âm thanh Chầu văn tạm thời (`ProceduralChauVanEngine` trong `ZenAudio.ts`), hỗ trợ sẵn khe cắm tự động nhận file `.mp3` tại `public/audio/hau-dong/` khi bổ sung sau. |
