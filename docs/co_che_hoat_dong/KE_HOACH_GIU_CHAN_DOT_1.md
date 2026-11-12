# Kế hoạch triển khai đợt giữ chân: 3.1 đến 3.4

Tài liệu này là kế hoạch làm theo đề xuất trong `DE_XUAT_TRO_CHOI_GIU_CHAN.md`. Bạn đã chọn bốn cơ chế: 3.1 Sổ Tu Tập, 3.2 Ba Việc Lành, 3.3 Album thẻ và bảo hiểm gacha, 3.4 Lễ hội theo lịch âm. Mục 3.1 và 3.2 đã làm xong trong cùng đợt này, hai mục còn lại là kế hoạch.

## 1. Thứ tự và lý do

| Thứ tự | Cơ chế | Trạng thái | Công sức còn lại | Phụ thuộc |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 3.1 Sổ Tu Tập | Đã làm, đã qua test | Chỉ còn xem thử trên trình duyệt | Không |
| 2 | 3.2 Ba Việc Lành | Đã làm, đã qua test | Chỉ còn xem thử trên trình duyệt | Dùng chung bảng và panel của 3.1 |
| 3 | 3.3 Album và bảo hiểm gacha | Chưa làm | Vừa | Cần bạn chốt N và việc công bố tỉ lệ |
| 4 | 3.4 Lễ hội lịch âm | Chưa làm | Lớn lần đầu | Cần người duyệt nội dung văn hóa |

Làm 3.2 ngay sau 3.1 vì cùng một vòng lặp hằng ngày: việc lành của 3.2 cũng được tính là việc lành của chuỗi. Làm 3.3 trước 3.4 vì 3.3 không cần nghệ thuật 3D mới, còn 3.4 cần đồ họa và nội dung nên chậm nhất.

Giả định tôi đang dùng cho đến khi bạn trả lời các điểm ở mục 7 của tài liệu đề xuất: phần thưởng chỉ là vật phẩm, thẻ và danh hiệu, không thêm MC. Tôi đã áp dụng giả định này ở 3.1.

## 2. Mục 3.1 Sổ Tu Tập: đã làm

### Luật chơi đã cài

- Mỗi ngày có ít nhất một việc lành thì được ghi một dấu. Việc lành gồm: ngồi thiền trọn một thời, thắp hương đầu ngày, gieo một quẻ, cúng dường Hòm Công Đức.
- Server tự đọc việc lành từ các bảng sẵn có (`meditation_sessions`, `mc_ledger`, `fortune_records`, `merit_donations`). Client không gửi gì ngoài lệnh ghi dấu, nên không giả mạo được.
- Ghi liên tiếp thì chuỗi tăng 1. Lỡ đúng 1 ngày mà tuần của ngày bị lỡ chưa dùng ngày nghỉ thì chuỗi được giữ và vẫn tăng 1. Lỡ nhiều hơn thì chuỗi về nửa (làm tròn xuống) rồi cộng dấu hôm nay, không bao giờ về 0.
- Cột mốc và quà: 3 ngày Đàn Hương Kyoto, 7 ngày Hoa Đăng Cầu An, 21 ngày một thẻ di sản hạng Rare, 49 ngày trang phục Pháp Phục Nâu Làng Mai, 108 ngày danh hiệu Hành Giả Bền Tâm.
- Mỗi cột mốc chỉ phát một lần cho mỗi tài khoản. Chuỗi về nửa rồi lên lại cột mốc cũ thì không phát lại.
- Không cộng MC, nên không đụng trần MC theo ngày và không sinh bút toán sổ cái.

### Các tệp đã thêm hoặc sửa

- `lib/streak/streakRules.ts`: quy tắc thuần, không đụng DB.
- `lib/time/vietnamDay.ts`: thêm `addDaysToDayKey`, `daysBetweenDayKeys`, `getWeekKeyOfDayKey`, `getVietnamWeekKey`. Tuần bắt đầu từ thứ Hai theo giờ Việt Nam.
- `server/db/migrations.ts`: migration 11, hai bảng `account_streaks` và `streak_rewards`.
- `server/utils/wallet/streakService.ts`, `server/api/mc/streak/status.get.ts`, `server/api/mc/streak/claim.post.ts`.
- `stores/streak.ts`, `components/StreakPanel.vue`, tab "Sổ Tu Tập" trong `SanctuaryDrawer.vue`, mục 04 trong menu "Thiền & Công Đức" của `TempleCanvas.vue`.
- `lib/ui/copy.ts`: các chuỗi mới, đã qua cổng ngân sách chữ.
- `scripts/wallet/test-streak-rules.mjs` (21 ca) và `scripts/wallet/test-streak.mjs` (16 ca), thêm vào `package.json`.
- `scripts/wallet/_server.mjs`: thêm biến `SERVER_ENTRY` để test chạy được trên bản build ở thư mục khác mà không ghi đè `.output`.

### Còn lại của 3.1

- Chưa xem trên trình duyệt thật. Test chỉ kiểm tra logic và API, chưa kiểm tra bố cục ở 375, 768, 1440.
- Đã sửa: HUD "Ngày Tu" (`TempleCanvas.vue`) và ô "Chuỗi tu tập" ở tab Thiền (`SanctuaryDrawer.vue`) trước đây lấy từ `user.streakDays` khởi đầu cứng ở 3, nên người chưa tu ngày nào vẫn thấy 3. Hai chỗ này giờ lấy từ `useStreakStore().status.currentStreak` của server, chưa tu thì hiện 0. Đã bỏ hẳn `streakDays` và `lastMeditatedDate` khỏi `stores/user.ts`, và `totalMinutesMeditated` khởi đầu từ 0 thay vì 45 giả. HUD được nạp lại khi mở trang và khi đổi tài khoản ví.
- Ghi dấu đang là nút bấm tay. Có thể tự gợi ý khi vừa thiền xong hoặc thắp hương xong, nhưng tôi chưa làm để tránh thêm thông báo.

## 3. Mục 3.2 Ba Việc Lành mỗi ngày: đã làm

### Đã cài đúng như thiết kế bên dưới, với các chọn lựa cụ thể

- Việc "đến điểm" dùng Cách A (client báo, server tin). Server chỉ nhận điểm nằm trong bộ ba việc hôm nay của chính tài khoản, nên không ai điền sẵn việc khác. Quà là vật phẩm nên chấp nhận gian lận nhẹ.
- Danh mục 8 việc trong `lib/streak/deedCatalog.ts`: 3 việc tự tính (thiền xong, thắp hương, gieo quẻ) và 5 điểm đến (Hồ Sen, Lầu Chuông, Đài Tơ Duyên, Cây Bồ Đề, Cây Đa). Không đưa việc cúng dường vào bộ ba vì tốn MC, tránh chặn người mới.
- Bộ ba chọn bằng `createSeededRng(hashSeedString("daily-deeds|accountId|dayKey"))` rồi xáo Fisher-Yates, không lưu danh sách việc.
- Quà đủ ba việc: một Trầm Hương Xứ Quảng (`incense_quang`), vật phẩm tiêu hao, không cộng MC. Nhận tối đa một lần mỗi ngày (`daily_deed_rewards` khóa chính theo tài khoản và ngày).
- Việc thiền, thắp hương, gieo quẻ tái dùng `getTodayDeeds` của Sổ Tu Tập, không viết lại truy vấn.

### Các tệp đã thêm hoặc sửa

- `lib/streak/deedCatalog.ts`: danh mục, `pickDailyDeeds`, quà.
- `server/db/migrations.ts`: migration 12, hai bảng `daily_deeds` và `daily_deed_rewards`.
- `server/utils/wallet/deedService.ts`, `server/api/mc/deeds/status.get.ts`, `visit.post.ts`, `claim.post.ts`.
- `stores/deeds.ts`: có chặn gọi trùng và thời gian chờ 5 giây giữa các lần thử lại, vì việc kiểm tra "đã tới điểm" chạy mỗi khung hình.
- `lib/world3d/TempleStage.ts`: thêm `walkToPoint(target, onArrive, onAbort)` dẫn tới điểm bất kỳ, tự mở cửa và đi ra nếu đang trong Chánh Điện.
- `components/TempleCanvas.vue`: `checkDeedVisits` theo `MapLayout.LANDMARKS` (bán kính điểm cộng 3,5 m), `handleGuideToDeed`, nối sự kiện `guide-to-deed`.
- `components/StreakPanel.vue` và `SanctuaryDrawer.vue`: khung "Ba việc lành" nằm trong tab Sổ Tu Tập, mỗi việc đến điểm có nút "Dẫn tới".
- `lib/ui/copy.ts`: chuỗi mới. Tiêu đề khung việc ghi dấu của 3.1 đổi từ "Việc lành" thành "Việc ghi dấu" để khỏi trùng với "Ba việc lành".
- `scripts/wallet/test-deeds-rules.mjs` (12 ca) và `scripts/wallet/test-deeds.mjs` (19 ca), thêm vào `package.json`.

### Còn lại của 3.2

- Chưa xem trên trình duyệt thật. Tọa độ điểm bước tới (`DEED_APPROACH` trong `TempleCanvas.vue`) tôi chọn theo tọa độ landmark trong `MapLayout`, chưa chạy thử trong cảnh 3D xem nhân vật có bị vướng vật cản hay không. Nếu kẹt, nhân vật dừng lại và hiện thông báo "Bị cản, hãy tự bước", người chơi vẫn tự bước tới được.
- Việc tự tính chỉ cập nhật khi mở tab hoặc khi nạp lại trạng thái. Làm xong thiền hoặc thắp hương rồi mở lại tab Sổ Tu Tập sẽ thấy.
- Quà "Trầm Hương Xứ Quảng" dùng được ở Bói Quẻ như lễ phẩm có sẵn, nên quà này có giá trị thật với người chơi (50 MC giá cửa hàng). Nếu thấy quá hào phóng khi nhận mỗi ngày, đổi `DAILY_DEED_REWARD` trong `deedCatalog.ts`.

### Thiết kế ban đầu (giữ để đối chiếu)

### Mục tiêu

Mỗi ngày hiện 3 việc, làm đủ thì nhận một phần thưởng. Khác với Sổ Tu Tập thưởng sự đều đặn, Ba Việc Lành đưa người chơi tới những chỗ họ ít ghé trong chùa.

### Thiết kế

- Danh sách việc lấy từ một bảng cố định trong `lib/streak/deedCatalog.ts`. Mỗi việc có mã, câu hiển thị, và loại sự kiện server kiểm được.
- Chọn 3 việc mỗi ngày bằng hạt giống theo `accountId` và khóa ngày giờ Việt Nam. Dùng `hashSeedString` trong `lib/boi/SeedService.ts` để không phải lưu danh sách việc. Mỗi người một bộ khác nhau, cùng một người cùng một ngày thì luôn giống nhau.
- Chỉ đưa vào danh mục những việc server tự kiểm chứng được từ dữ liệu có sẵn: thiền xong, thắp hương, gieo quẻ, cúng dường (đã có ở 3.1).
- Với việc "đến một điểm trong chùa" (hồ sen, lầu chuông, cây Nguyệt Lão), server không biết vị trí người chơi. Có hai cách, bạn chọn:
  - Cách A, dễ và an toàn: client báo "đã tới điểm X" và server tin, chỉ dùng cho phần thưởng không có giá trị tiền. Nhược điểm là gian lận được, nhưng thiệt hại chỉ là một vật phẩm tượng trưng.
  - Cách B, chặt chẽ: dùng nhịp tim `heartbeat` như Hầu Đồng, server kiểm tọa độ gửi lên so với `MapLayout.LANDMARKS`. Tốn công hơn và vẫn tin tọa độ client.
  - Tôi đề xuất Cách A cho đợt này vì phần thưởng là vật phẩm, không phải MC.
- Phần thưởng khi đủ 3 việc: một vật phẩm tiêu hao nhẹ (nén hương hoặc bông sen), không cộng MC.

### Dữ liệu và API

- Thêm migration 12, bảng `daily_deeds` gồm `account_id`, `day_key`, `deed_id`, `completed_at`, khóa chính theo ba cột đó, và một cột `reward_claimed_day` hoặc bảng `daily_deed_rewards` để chống nhận hai lần.
- `GET /api/mc/deeds/status` trả 3 việc hôm nay và tiến độ.
- `POST /api/mc/deeds/visit` với `{ landmark }` cho việc đến điểm (Cách A).
- `POST /api/mc/deeds/claim` nhận thưởng khi đủ 3 việc.
- Việc thiền, hương, quẻ, công đức tự tính từ bảng sẵn có, không cần gọi thêm.

### Giao diện

- Thêm khung "Ba việc lành hôm nay" ngay trong `StreakPanel.vue`, dùng chung tab Sổ Tu Tập để người chơi không phải học thêm một chỗ mới.
- Mỗi việc có nút "Dẫn tới" tái dùng cơ chế tự bước tới của mini map trong `TempleCanvas.vue`.

### Kiểm thử

- Test thuần: cùng tài khoản cùng ngày ra cùng bộ việc, khác ngày thì khác, không trùng việc trong một bộ.
- Test API: không nhận thưởng khi chưa đủ 3 việc, nhận một lần rồi từ chối lần hai, tài khoản khác không thấy tiến độ của nhau.

### Rủi ro

- Việc "đến điểm" gian lận được (đã nêu ở Cách A). Chấp nhận vì phần thưởng không có giá trị tiền.
- Nếu một việc nào đó khó làm với người chơi di động (cần đi xa trong cảnh), người chơi sẽ bỏ cả ngày. Cần loại việc quá khó khỏi danh mục.

## 4. Mục 3.3 Album Thẻ Di Sản và bảo hiểm gacha: kế hoạch

### Mục tiêu

Cho người chơi mục tiêu sưu tập dài hạn và bỏ cảm giác "mở gói mãi không ra thẻ hiếm".

### Hiện trạng cần biết

- `rollRarity` trong `server/utils/cards/catalog.ts` dùng tỉ lệ cố định: phổ thông 60 phần trăm, hiếm 25, sử thi 12, huyền thoại 3. Hiện chỉ có bảo hiểm trong một gói (gói 5 thẻ đảm bảo 1 thẻ hiếm trở lên, gói 10 thẻ đảm bảo 1 thẻ sử thi trở lên). Gói 1 thẻ không có bảo hiểm.
- Không có bộ đếm giữa các lần mở. Người chơi mở nhiều gói 1 thẻ vẫn có thể không bao giờ ra huyền thoại.
- Danh mục có 18 thẻ thuộc 4 nước: Việt Nam, Nhật Bản, Thái Lan, Hàn Quốc. Đây là cơ sở tự nhiên để chia album theo nước.
- Thẻ trùng hiện chỉ tăng số lượng, chưa có ích lợi.

### Cần bạn quyết định trước khi làm

1. Ngưỡng bảo hiểm N: sau bao nhiêu lần mở liên tiếp không ra thẻ từ sử thi trở lên thì lần kế chắc chắn có. Tôi gợi ý 10 lần mở cho sử thi và 30 lần cho huyền thoại, vì tỉ lệ sử thi cộng huyền thoại hiện là 15 phần trăm, kỳ vọng khoảng 7 lần.
2. Có công bố tỉ lệ rơi trong giao diện hay không. Tôi đề xuất công bố, vì đây là gacha trả bằng MC mua bằng ADA và minh bạch phù hợp với tinh thần dự án.
3. Thẻ trùng đổi thành "bụi di sản" theo tỉ lệ nào, và bao nhiêu bụi đổi được một thẻ còn thiếu. Gợi ý: phổ thông 1, hiếm 5, sử thi 20, huyền thoại 80. Đổi thẻ còn thiếu hạng nào thì tốn đúng số bụi của hạng đó nhân 4.

### Thiết kế

- Thêm migration 13: bảng `card_pity` (`account_id` khóa chính, `opens_since_epic`, `opens_since_legendary`) và bảng `card_dust` (`account_id` khóa chính, `dust`).
- Sửa `buyAndOpenCardPack` trong `mcService.ts`: sau khi rút, cập nhật bộ đếm trong cùng transaction với việc trừ MC. Nếu bộ đếm chạm ngưỡng thì thay một thẻ bằng thẻ đạt chuẩn, dùng lại `rollGuaranteedRarity`.
- Thẻ trùng: khi mở gói mà tài khoản đã có thẻ, vẫn ghi vào kho như hiện nay và cộng bụi cho lần trùng đó. Giữ nguyên hành vi hiện có để không làm hỏng dữ liệu cũ.
- `POST /api/mc/cards/dust-craft` đổi bụi lấy thẻ còn thiếu, kiểm số bụi ở server.
- Album: định nghĩa trong `data/cards/albums.json` theo nước, mỗi album liệt kê các `card_id`. Đủ một album thì mở khóa phần thưởng (khung thẻ hoặc trang phục). Trạng thái hoàn thành tính từ `card_inventory`, không cần bảng riêng, chỉ cần bảng ghi đã nhận quà để không phát hai lần.
- Giao diện: thêm khung tiến độ album và bộ đếm bảo hiểm trong tab Thẻ Bài, bảng tỉ lệ rơi trong `CardPackCard.vue`.

### Kiểm thử

- Test thuần cho bộ đếm: không chạm ngưỡng thì giữ nguyên, chạm ngưỡng thì chắc chắn ra, bộ đếm về 0 khi ra.
- Test API: bộ đếm tăng đúng qua nhiều lần mở, sổ cái khớp số MC đã trừ, mở lặp cùng `requestId` không tăng bộ đếm hai lần.
- Chạy lại `wallet:test:hydra` và `test-cards-monetization` để chắc không phá luồng mua gói hiện có.

### Rủi ro

- Đây là phần động tới MC và gacha nên cần cẩn thận nhất trong bốn mục. Phải đặt việc cập nhật bộ đếm trong `onSpent` để cùng transaction với việc trừ MC, nếu không có thể trừ tiền mà không tăng bộ đếm.
- Nếu đổi `rollRarity` mà không giữ hành vi cũ khi chưa chạm ngưỡng, tỉ lệ công bố sẽ sai. Cần test kiểm tỉ lệ.
- Lưu ý pháp lý và trách nhiệm: ghi rõ tỉ lệ, không bán vật phẩm tăng tỉ lệ, giữ giá bằng MC kiếm được chứ không ép nạp ADA.


## 5. Mục 3.4 Lễ hội theo lịch âm: kế hoạch

### Mục tiêu

Người chơi có lý do vào đúng một số ngày trong năm, và chùa đổi không khí theo ngày thật. Đây là mục lớn nhất, nên đề xuất làm thành bộ khung dùng lại được, rồi thêm từng dịp một.

### Hiện trạng cần biết

- `convertSolarToLunar(dd, mm, yy)` trong `lib/boi/VietnameseLunarCalendar.ts` trả về `day`, `month`, `year`, `isLeap`. Đã xử lý tháng nhuận. Hầu Đồng đang dùng nó để đánh dấu mùng 1, 14, 15, 29, 30 là ngày lễ.
- `AtmosphereManager.setTimeOfDay(mode)` chỉ đổi theo buổi trong ngày, chưa có khái niệm "dịp lễ".
- `ZenAudio` có sẵn chuông, mõ, chuông xoay, nhưng chưa có bản nhạc riêng cho dịp lễ.
- Hầu Đồng đã có nhãn lễ ("Đại Lễ Sóc Vọng...") ở server. Nên dùng chung một bảng dịp lễ thay vì mỗi nơi tự tính.
- Ngày lịch âm phải tính theo giờ Việt Nam. Dùng `getVietnamDayKey` rồi tách ngày, tháng, năm để đưa vào `convertSolarToLunar`.

### Thiết kế bộ khung

- Tạo `lib/festival/festivalCalendar.ts`: hàm thuần `getActiveFestival(dayKey)` trả về dịp lễ của ngày đó hoặc null. Mỗi dịp có `id`, tên, tháng và ngày âm, và danh sách hiệu ứng.
- Danh sách dịp lễ cho đợt đầu, cố định theo âm lịch: mùng 1 và rằm hằng tháng, Tết Nguyên Đán (mùng 1 tháng Giêng), Rằm tháng Giêng, Phật Đản (rằm tháng Tư), Vu Lan (rằm tháng Bảy). Tháng nhuận: chỉ tính tháng thường, không tính tháng nhuận, để tránh lặp lễ.
- Thay phần tự tính trong `hauDongService.ts` bằng gọi chung hàm này, để hai nơi không bao giờ lệch nhau.
- Hiệu ứng mỗi dịp gồm: trang trí (một nhóm vật thể 3D bật hoặc tắt), ánh sáng (một chế độ trong `Palette`), âm thanh (một đoạn nhạc nền hoặc tiếng chuông riêng), và một hoạt động nhỏ.
- Hoạt động của mỗi dịp tái dùng thứ có sẵn trước: rằm thì thả Hoa Đăng (liên quan 3.5 nhưng không cần cộng đồng), Vu Lan thì cài hoa hồng, Tết thì hái lộc ở cây Bồ Đề. Phần thưởng là vật phẩm hoặc thẻ, không MC.

### Phạm vi đề xuất cho lần đầu

Chỉ làm mùng 1 và rằm trước, vì đã có sẵn cờ ngày lễ và là dịp lặp mỗi tháng nên thấy hiệu quả nhanh. Việc cần làm:

1. Viết `festivalCalendar.ts` và test cho các ngày đã biết. Bộ test vàng hiện có trong `scripts/boi/test-golden-suite.mjs` chỉ có vài mốc lịch âm (ca 3: 22/01/2004, ca 14: 24/08/2006 thuộc tháng 7 nhuận), chưa đủ để kiểm các dịp lễ. Cần bổ sung thêm mốc mùng 1 và rằm từ một nguồn lịch chuẩn bên ngoài, tôi chưa có sẵn nên sẽ hỏi bạn hoặc đối chiếu với lịch vạn niên chính thức trước khi viết test.
2. Hiển thị một dải thông báo nhẹ trong HUD khi có dịp lễ, dùng `UiBadge`, không nhấp nháy.
3. Một hiệu ứng ánh sáng ấm hơn và tiếng chuông riêng ngày rằm. Chưa làm trang trí 3D mới.
4. Một phần thưởng nhỏ cho việc có mặt ngày lễ, ví dụ cộng việc lành "Dâng hương ngày rằm" vào Sổ Tu Tập.

Các dịp lớn (Tết, Phật Đản, Vu Lan) để làm sau khi bộ khung ổn, vì mỗi dịp cần nghệ thuật 3D và nội dung văn hóa riêng.

### Cần người duyệt

Nội dung và nghi thức của từng dịp lễ phải được người am hiểu duyệt, theo đúng nguyên tắc trong `KE_HOACH_NPC_TRU_TRI.md`. Tôi sẽ không tự viết lời thuyết minh về ý nghĩa tôn giáo.

### Rủi ro

- Tính lịch âm sai một ngày là sai lễ. Cần test với các mốc chuẩn, đặc biệt quanh tháng nhuận và qua ranh giới năm.
- Lệch múi giờ: server và client phải cùng tính theo giờ Việt Nam, nếu không người chơi ở múi giờ khác thấy lễ sai ngày.
- Tốn nghệ thuật 3D nếu làm hết các dịp lớn, nên tách nhỏ đúng như đề xuất.

## 6. Việc cần bạn quyết định

1. Đã xong: nối HUD và tab Thiền về chuỗi thật của server (xem mục 2).
2. Đã chọn tạm Cách A cho việc "đến điểm" của 3.2. Nếu muốn chặt hơn thì đổi sang Cách B (kiểm tọa độ qua heartbeat), bạn quyết định.
3. Gacha 3.3: ngưỡng bảo hiểm N, có công bố tỉ lệ hay không, và bảng quy đổi bụi di sản.
4. Phạm vi 3.4 lần đầu: chỉ mùng 1 và rằm như đề xuất, hay làm luôn một dịp lớn.
5. Có muốn đẩy bộ đếm lên Hydra Head làm bằng chứng công khai hay chỉ lưu SQLite. Với 3.1 và 3.2 hiện không cần vì không có MC. Chỉ có ý nghĩa nếu sau này làm Hoa Đăng Nguyện Chung (3.5).

## 7. Cách kiểm tra mỗi mục trước khi coi là xong

Mọi mục đều phải qua đủ các cổng của dự án trước khi báo xong:

- `node scripts/verify-ui-primitives.mjs` phải báo ALL CHECKS PASSED.
- `node scripts/verify-copy-budget.mjs` phải báo ALL COPY BUDGET CHECKS PASSED.
- `npx vue-tsc --noEmit` thoát với mã 0.
- Build Nuxt thoát với mã 0. Lưu ý: `vue-tsc` không bắt được lỗi cú pháp template, build mới bắt được. Ở 3.1, `vue-tsc` báo đạt trong khi `StreakPanel.vue` đang hỏng, chỉ build thật mới phát hiện. Vì vậy luôn chạy build, không chỉ type check.
- `npm run wallet:test:hydra` 11/11, `wallet:test:meditation` 14/14, `boi:test` 21/21, và test riêng của mục đó.

