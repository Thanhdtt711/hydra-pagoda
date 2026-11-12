# Đề xuất trò chơi và cơ chế giữ chân người chơi

Tài liệu này là đề xuất. Mục 3.1 Sổ Tu Tập đã được làm, kế hoạch cho 3.2 đến 3.4 nằm ở `KE_HOACH_GIU_CHAN_DOT_1.md`. Các mục còn lại chưa làm. Mục tiêu là cho người chơi một lý do nhỏ và dễ chịu để quay lại mỗi ngày, mà không phá không khí tĩnh lặng của chùa.

## 1. Hiện trạng: game đã có gì để giữ chân

| Hệ thống | Đang có | Điểm còn thiếu |
| :--- | :--- | :--- |
| Bói quẻ | 1 lượt miễn phí mỗi môn mỗi ngày, buff hoặc debuff trong ngày, nhiệm vụ hóa giải | Không có gì nối các ngày với nhau |
| Thiền 432Hz | Thưởng 15 đến 150 MC, trần 200 MC mỗi ngày | Không có chuỗi ngày hay cột mốc dài hạn |
| Hầu Đồng | 25 MC mỗi giá, trần 250 MC mỗi ngày, hàng chờ | Chỉ có giờ diễn, thiếu lý do canh giờ |
| Parkour | Có thời gian tốt nhất, có thưởng hoàn thành | Bảng xếp hạng chỉ theo mọi thời đại, người mới khó vượt |
| Thẻ di sản | Mở gói gacha, kho thẻ | Không có album, không có mục tiêu sưu tập |
| Hòm Công Đức | Bảng vàng công đức | Chỉ xếp theo số tiền, người ít MC không thấy mình |
| Đồng tu online | Cử chỉ, danh sách người cùng chùa | Chưa có hoạt động chung |
| Thầy trụ trì | Hỏi đáp tự do | Không có lý do để hỏi mỗi ngày |

Nhận xét chung: mỗi hoạt động đều có trần theo ngày nên người chơi chạm trần trong vài phút rồi không còn việc gì làm. Các cơ chế dưới đây lấp đúng chỗ đó.

## 2. Nguyên tắc thiết kế

- **Không ép, không phạt nặng.** Bỏ một ngày chỉ làm chậm tiến độ, không xóa sạch. Không dùng đếm ngược gây sợ bỏ lỡ.
- **Thưởng bằng thứ có ý nghĩa, không bằng tiền.** Ưu tiên danh hiệu, thẻ, trang phục, hương và hoa. MC chỉ là phần phụ, vẫn nằm trong các trần hiện có.
- **Không biến thành cờ bạc.** Gacha có bảo hiểm (xem mục 3.3), hiển thị rõ tỉ lệ, không bán thứ gì tăng tỉ lệ.
- **Mọi phần thưởng do server cấp.** Client chỉ gửi sự kiện, server kiểm tra rồi mới ghi `mc_ledger`. Đây là quy tắc sẵn có của dự án.
- **Mỗi hoạt động ngắn.** Một ngày hoàn thành trong 5 đến 10 phút, hợp với tinh thần thiền.
- **Dùng lại hệ thống có sẵn.** Mỗi đề xuất ghi rõ tái dùng cái gì để tiết kiệm công.

## 3. Các trò chơi và cơ chế đề xuất

### 3.1 Sổ Tu Tập: chuỗi ngày an lạc

- **Là gì:** mỗi ngày có ít nhất một việc lành (thiền, thắp hương, bói quẻ, công đức) thì ghi một dấu vào sổ. Dấu nối nhau thành chuỗi.
- **Cột mốc:** 3, 7, 21, 49 và 108 ngày. Mỗi cột mốc tặng một vật có ý nghĩa: hương loại tốt, hoa sen, một thẻ di sản, một bộ trang phục chùa, cuối cùng là danh hiệu hiển thị cạnh tên.
- **Cách bớt áp lực:** mỗi tuần có 1 "ngày nghỉ" tự động bảo vệ chuỗi. Bỏ quá ngày nghỉ thì chuỗi về nửa, không về 0.
- **Tái dùng:** `meditation_sessions`, `fortune_records`, `merit_donations` đã có ngày giờ, chỉ cần một bảng `account_streaks` và một hàm tổng hợp theo ngày, dùng lại `getVietnamDayKey` trong `lib/time/vietnamDay`.
- **Tác động giữ chân:** cao. Đây là cơ chế rẻ nhất và hiệu quả nhất để tạo thói quen.
- **Công sức:** nhỏ. 1 bảng, 2 API (`status`, `claim`), 1 khung trong drawer.

### 3.2 Ba Việc Lành mỗi ngày (nhiệm vụ ngày)

- **Là gì:** mỗi ngày hiện 3 việc ngẫu nhiên nhưng cố định theo tài khoản và ngày, ví dụ "ngồi thiền 3 phút", "thắp một nén hương trước Chánh Điện", "đến nghe Thầy trụ trì một câu", "đi một vòng quanh hồ sen". Làm đủ 3 việc nhận một phần thưởng.
- **Khác với chuỗi ngày:** chuỗi thưởng sự đều đặn, Ba Việc Lành cho người chơi một lý do để đi đến những chỗ trong chùa mà họ ít ghé (hồ sen, lầu chuông, cây Nguyệt Lão).
- **Tái dùng:** `MapLayout.LANDMARKS` làm danh sách điểm đến, nút "Bấm để tự động bước tới" của mini map làm lối đi.
- **Hạt giống ngày:** dùng cùng cách tính hạt giống ngày xác định như `lib/boi`, nên không cần lưu danh sách việc.
- **Công sức:** vừa. Cần bắt sự kiện đến điểm, thiền xong, thắp hương gửi về server.

### 3.3 Album Thẻ Di Sản và bảo hiểm gacha

- **Là gì:** gom thẻ thành album theo ngôi chùa hoặc theo đề tài. Đủ một trang thì mở khóa lời thuyết minh đầy đủ, một khung thẻ riêng hoặc một trang phục.
- **Bảo hiểm:** sau N gói không ra thẻ hiếm thì gói kế chắc chắn có. Hiển thị bộ đếm cho người chơi thấy. Thẻ trùng đổi thành "bụi di sản", gom đủ bụi thì đổi lấy thẻ còn thiếu.
- **Vì sao giữ chân:** mục tiêu sưu tập dài hạn, mỗi thẻ thiếu là một lý do quay lại.
- **Tái dùng:** `stores/cards.ts`, `account_inventory`, `pack-buy.post.ts`. Thêm bảng đếm bảo hiểm và bảng bụi.
- **Lưu ý trách nhiệm:** nêu rõ tỉ lệ rơi, không bán gói tăng tỉ lệ, giữ giá bằng MC kiếm được chứ không ép nạp ADA. Cần ghi trong mục hướng dẫn người chơi.
- **Công sức:** vừa.

### 3.4 Lễ hội theo lịch âm

- **Là gì:** sự kiện theo ngày thật: mùng 1 và rằm hằng tháng, Phật Đản, Vu Lan, Tết Nguyên Đán, Rằm tháng Giêng. Mỗi dịp đổi trang trí chùa, đổi nhạc nền và có một hoạt động riêng.
- **Ví dụ:** rằm có đèn hoa đăng quanh hồ sen, Vu Lan có nghi thức cài hoa hồng, Tết có hái lộc đầu năm ở cây Bồ Đề.
- **Tái dùng:** `lib/boi` đã có tính lịch âm và Can Chi, `AtmosphereManager` đổi ánh sáng và thời tiết, `ZenAudio` đổi nhạc.
- **Vì sao giữ chân:** người chơi có lý do vào đúng ngày, và có thứ để kể với bạn bè. Không áp lực vì sự kiện lặp lại hằng năm.
- **Công sức:** lớn cho lần đầu (bộ khung sự kiện), nhỏ cho mỗi dịp sau.

### 3.5 Hoa Đăng Nguyện Chung (mục tiêu cộng đồng)

- **Là gì:** cả chùa cùng thả hoa đăng trên hồ sen. Mỗi người thả một ngọn thì số hoa đăng của chùa tăng một. Đủ mốc thì cả chùa nhận quà chung (sen nở thêm, tiếng chuông đặc biệt).
- **Vì sao giữ chân:** ai cũng góp được một ngọn dù chỉ chơi một phút, và thấy mình thuộc về một cộng đồng. Không có xếp hạng nên không gây so bì.
- **Tái dùng:** WebSocket đa người chơi của Sangha Online Hub, vật phẩm "Hoa Đăng Cầu An" đã có trong cửa hàng, `LotusPond.ts` để vẽ hoa đăng, `hydra_kv` để lưu bộ đếm toàn cục.
- **Hydra L2:** có thể ghi bộ đếm làm bằng chứng công khai trên Hydra Head, đúng tinh thần minh bạch của dự án.
- **Công sức:** vừa.

### 3.6 Giải Parkour theo tuần

- **Là gì:** bảng xếp hạng Parkour reset mỗi tuần, người đứng đầu nhận danh hiệu tuần đó. Giữ thêm bảng mọi thời đại như hiện nay.
- **Vì sao giữ chân:** bảng mọi thời đại khiến người mới nản. Bảng tuần cho ai cũng có cơ hội lên top, và có lý do quay lại vào cuối tuần.
- **Tái dùng:** bảng `parkour_records` đã có thời gian tốt nhất, chỉ cần thêm cột tuần hoặc lọc theo ngày. Không cần cảnh 3D mới. Ngày đã tính theo giờ Việt Nam qua `getVietnamDayKey`, nên mốc tuần cũng dùng giờ Việt Nam cho thống nhất.
- **Công sức:** nhỏ.

### 3.7 Câu Đố Thầy Trụ Trì (trò chơi trí tuệ mỗi ngày)

- **Là gì:** mỗi ngày Thầy ra một câu đố ngắn về văn hóa chùa (ý nghĩa ngày rằm, vì sao thắp 3 nén hương, tượng Tam Bảo là ai). Trả lời đúng nhận một mảnh thẻ hoặc điểm vào Sổ Tu Tập. Trả lời sai thì Thầy giải thích nhẹ nhàng, không trừ gì.
- **Vì sao giữ chân:** biến phần nội dung văn hóa đã viết sẵn thành trò chơi, người chơi vừa học vừa có lý do hỏi Thầy mỗi ngày.
- **Tái dùng:** `data/van_hoa_chua_nghi_le/` và `data/cau_hoi_co_san/questions.json` là nguồn câu hỏi, `npc/abbot/ask` và `AbbotChatDrawer` là giao diện. Đáp án do server chấm để không bị lộ ở client.
- **Lưu ý:** cần người am hiểu duyệt nội dung để giữ thái độ trân trọng, đúng như quy tắc trong `KE_HOACH_NPC_TRU_TRI.md`.
- **Công sức:** vừa. Phần lớn là soạn 60 đến 100 câu đố đầu tiên.

### 3.8 Vườn Sen riêng

- **Là gì:** mỗi người có một góc nhỏ ở hồ sen để trồng và chăm sen. Nhớ vào tưới thì sen nở sau vài ngày, mỗi giống sen có màu và hoa khác nhau. Sen nở dùng để dâng cúng hoặc đổi lấy vật phẩm.
- **Vì sao giữ chân:** có thứ đang lớn lên chờ mình, nhưng sen không chết nếu bỏ một hai ngày, chỉ nở chậm hơn nên không gây tội lỗi.
- **Tái dùng:** `LotusPond.ts` và `WindGrass.ts` cho phần vẽ, `account_inventory` cho kho hoa.
- **Công sức:** lớn. Cần mô hình sen theo nhiều giai đoạn và giao diện chăm sóc.

## 4. Bảng so sánh và thứ tự đề xuất

| STT | Cơ chế | Giữ chân | Công sức | Rủi ro | Gợi ý đợt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1 | Sổ Tu Tập | Cao | Nhỏ | Thấp | Đợt 1 |
| 3.6 | Giải Parkour theo tuần | Trung bình | Nhỏ | Thấp | Đợt 1 |
| 3.2 | Ba Việc Lành mỗi ngày | Cao | Vừa | Thấp | Đợt 2 |
| 3.7 | Câu Đố Thầy Trụ Trì | Trung bình | Vừa | Cần duyệt nội dung | Đợt 2 |
| 3.5 | Hoa Đăng Nguyện Chung | Trung bình | Vừa | Cần đồng bộ realtime | Đợt 2 |
| 3.3 | Album Thẻ và bảo hiểm gacha | Cao | Vừa | Vấn đề trách nhiệm gacha | Đợt 3 |
| 3.4 | Lễ hội theo lịch âm | Cao | Lớn | Tốn nội dung và nghệ thuật | Đợt 3 |
| 3.8 | Vườn Sen riêng | Cao | Lớn | Tốn mô hình 3D | Đợt 4 |

Cột "Giữ chân" và "Công sức" là ước tính của tôi từ cấu trúc code hiện tại, chưa có dữ liệu người chơi thật để kiểm chứng.

Lý do xếp thứ tự: đợt 1 gần như không cần cảnh 3D mới và tái dùng bảng có sẵn, thử nhanh được tác dụng. Đợt 2 thêm hoạt động đa dạng. Đợt 3 và 4 tốn nghệ thuật nên chỉ làm sau khi biết đợt 1 và 2 có giữ được người chơi hay không.

## 5. Cách đo hiệu quả

Cần một vài con số tối thiểu để biết cơ chế nào có tác dụng, lấy từ dữ liệu SQLite đã có, không cần theo dõi cá nhân:

- Tỉ lệ người quay lại sau 1 ngày, 7 ngày và 30 ngày.
- Số ngày hoạt động trung bình mỗi tuần của một tài khoản.
- Tỉ lệ người đạt cột mốc 3 ngày và 7 ngày của Sổ Tu Tập.
- Tỉ lệ làm đủ Ba Việc Lành.
- Thời gian một phiên chơi trung bình, để chắc rằng cơ chế mới không làm phiên chơi kéo dài quá mức.

## 6. Điều không nên làm

- Không dùng đếm ngược "ưu đãi sắp hết" hay thông báo dọa mất chuỗi.
- Không thêm bảng xếp hạng theo số MC hay số ADA nạp, vì khuyến khích chi tiêu quá mức.
- Không bán vật phẩm làm tăng tỉ lệ ra thẻ hiếm.
- Không để phần thưởng MC vượt các trần theo ngày đã có (thiền 200, Hầu Đồng 250). Phần thưởng mới nên ở dạng vật phẩm, thẻ hoặc danh hiệu.
- Không thêm hiệu ứng nhấp nháy, rung, âm thanh gắt vào thông báo thưởng. Giữ đúng ngôn ngữ thiết kế Sơn mài và vàng thếp, dùng `UiBadge` và `ZenIcon`.

## 7. Điểm cần bạn quyết định

1. Có đồng ý chỉ thưởng bằng vật phẩm, thẻ, danh hiệu và tránh thưởng thêm MC hay không.
2. Bảo hiểm gacha: chọn N bao nhiêu gói, và có công bố tỉ lệ rơi công khai hay không.
3. Có muốn đẩy bộ đếm cộng đồng lên Hydra Head làm bằng chứng công khai hay chỉ lưu SQLite.
4. Bắt đầu từ đợt nào. Tôi gợi ý Sổ Tu Tập và Giải Parkour theo tuần trước.
