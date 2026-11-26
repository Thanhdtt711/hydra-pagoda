# TÀI LIỆU KỸ THUẬT & NGHIỆP VỤ: HỆ THỐNG "BÓI QUẺ 6 MÔN CẦU AN"

- **Dự án:** Vạn Cảnh Chùa / Hydra Pagoda
- **Phân hệ mã nguồn:** `lib/boi/` (`FortuneEngine.ts`, `MetaphysicsService.ts`, `SeedService.ts`, `ContentRepository.ts`, `GameplayService.ts`, `VietnameseLunarCalendar.ts`) và `data/boi/*.json`
- **Mục đích tài liệu:** Giải thích chi tiết nguyên lý hoạt động, mục đích sử dụng Ngày tháng năm sinh, cơ chế đổi quẻ theo ngày, cách xử lý câu hỏi tự do (như hỏi ngày đi chơi cụ thể) và luồng thuật toán đầu-cuối của hệ thống Bói Quẻ Cầu An.

---

## MỤC LỤC

1. [Tổng quan Hệ thống Bói Quẻ 6 Môn Cầu An](#1-tổng-quan-hệ-thống-bói-quẻ-6-môn-cầu-an)
2. [Giải đáp Trọng tâm 3 Câu hỏi Cốt lõi](#2-giải-đáp-trọng-tâm-3-câu-hỏi-cốt-lõi)
3. [Chi tiết Thuật toán & Quy trình Xử lý 7 Bước](#3-chi-tiết-thuật-toán--quy-trình-xử-lý-7-bước)
4. [Cơ chế Tính Bát Tự, Ngũ Hành & Điều chỉnh Xác suất Quẻ](#4-cơ-chế-tính-bát-tự-ngũ-hành--điều-chỉnh-xác-suất-quẻ)
5. [Cách Hệ thống Xử lý Câu hỏi & Chọn Nội dung Quẻ](#5-cách-hệ-thống-xử-lý-câu-hỏi--chọn-nội-dung-quẻ)
6. [Cơ chế Gameplay: Lượt Miễn phí, Phí MC & Nhiệm vụ Hóa Giải](#6-cơ-chế-gameplay-lượt-miễn-phí-phí-mc--nhiệm-vụ-hóa-giải)
7. [Sơ đồ Luồng Xử lý Tổng thể (Flowchart)](#7-sơ-đồ-luồng-xử-lý-tổng-thể-flowchart)

---

## 1. Tổng quan Hệ thống Bói Quẻ 6 Môn Cầu An

Hệ thống **Bói Quẻ 6 Môn Cầu An** trong Vạn Cảnh Chùa là một bộ máy chiêm bốc văn hóa dân gian **tất định theo ngày (Daily Deterministic Fortune Engine)**, kết hợp giữa thuật toán lịch Âm - Dương Việt Nam, Bát Tự Ngũ Hành Nạp Âm, Cung Phi Bát Trạch và Cửu Diệu Niên Vận.

Hệ thống bao gồm **6 môn chiêm bái chuyên biệt**:

| STT | Mã môn (`MonId`) | Tên hiển thị | Chủ đề Mặc định (`TopicTag`) | Đặc thù Thuật toán |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `xin_xam` | **Xin Xăm Bát Quái** | `tong_quan` (Bổn mạng & Tổng quan) | Đối sánh Ngũ Hành Bản Mệnh với Ngũ Hành Ngày xem quẻ. |
| **2** | `to_duyen` | **Tơ Duyên Tương Ngộ** | `tinh_duyen` (Tình duyên & Tri kỷ) | Đối sánh kép: Ngũ Hành & Cung Phi của 2 người (Mệnh chính + Mệnh người thương) kết hợp Ngũ Hành Ngày. |
| **3** | `cau_tu` | **Cầu Tự Con Cái** | `gia_dao` (Gia đạo & Con cái) | Đối sánh Mệnh - Ngày, có bộ lọc bảo vệ độ tuổi (`>= 18 tuổi`) và câu từ y khoa chuẩn mực. |
| **4** | `chieu_tai` | **Chiêu Tài Tấn Bảo** | `tai_loc` (Tài lộc & Kinh doanh) | Đối sánh Mệnh - Ngày tập trung vào vận khí tài chính, đầu tư, buôn bán. |
| **5** | `duoc_su` | **Dược Sư An Khang** | `suc_khoe` (An khang & Thân tâm) | Đối sánh Mệnh - Ngày tập trung vào dưỡng sinh, sức khỏe tinh thần và thể chất. |
| **6** | `dang_sao` | **Dâng Sao Giải Hạn** | `tong_quan` (Niên vận & Sao hạn) | Tính **Tuổi Mụ** và **Sao Chiếu Mệnh Cửu Diệu** trong năm Âm lịch hiện tại để định mức Cát/Hung. |

---

## 2. Giải đáp Trọng tâm 3 Câu hỏi Cốt lõi

### Câu hỏi 1: Hệ thống lấy Ngày, Tháng, Năm sinh (và Giới tính, Giờ sinh) để làm gì?
Thông tin ngày tháng năm sinh của người chơi **KHÔNG phải để trang trí**, mà được đưa trực tiếp vào `lib/boi/MetaphysicsService.ts` và `lib/boi/FortuneEngine.ts` để thực hiện **4 nhiệm vụ tính toán thực tế**:

1. **Đổi sang Âm lịch Việt Nam & Xác định Năm Can Chi chính xác (`convertSolarToLunar`):**
   - Người Việt tính mệnh theo lịch Âm (Tiết lập xuân / Tết Nguyên Đán). Nếu một người sinh ngày `20/01/2002` Dương lịch (tức tháng Chạp năm Tân Tỵ trước Tết), hệ thống sẽ tự động đổi sang Âm lịch để biết người này thuộc tuổi **Tân Tỵ (2001)** chứ không phải Nhâm Ngọ (2002).
2. **Tính Bản Mệnh Ngũ Hành, Cung Phi & Sao Chiếu Mệnh (`computeFullProfile`):**
   - Từ năm Âm lịch, hệ thống tra bảng Lục Thập Hoa Giáp để tìm **Ngũ Hành Nạp Âm** (ví dụ: sinh ngày `23/12/2001` Dương lịch -> `09/11/2001` Âm lịch -> tuổi **Tân Tỵ**, mệnh **Bạch Lạp Kim**, hành **Kim**).
   - Kết hợp **Năm sinh Âm lịch + Giới tính** để tính **Cung Phi Bát Trạch** (ví dụ: cùng sinh năm 2001 nhưng Nam là cung **Cấn - hành Thổ**, còn Nữ là cung **Đoài - hành Kim**).
   - Tính **Tuổi Mụ (`ageLunar`)** và **Sao Cửu Diệu chiếu mệnh** trong năm hiện tại (Thái Dương, Thái Âm, Mộc Đức, Thủy Diệu, La Hầu, Kế Đô, Thái Bạch...).
3. **Làm thay đổi Xác suất bốc trúng quẻ Tốt / Xấu (`computeMucProbabilities`):**
   - Hệ thống lấy **Ngũ Hành Bản Mệnh** (từ ngày sinh) so sánh với **Ngũ Hành của Ngày xem quẻ**:
   - Nếu ngày hôm đó **Tương Sinh** với bản mệnh người xem -> Hệ thống **tăng xác suất ra Đại Cát (+4%) và Cát (+6%)**, đồng thời giảm xác suất ra Hung (-5%) và Đại Hung (-3%).
   - Nếu ngày hôm đó **Tương Khắc** với bản mệnh người xem -> Hệ thống **giảm xác suất ra Đại Cát (-3%) và Cát (-6%)**, đồng thời tăng xác suất ra Hung (+6%) và Đại Hung (+4%).
4. **Tạo Mã Seed Cá nhân hóa & Lọc Nội dung theo Độ tuổi (`getCandidateBlocks`):**
   - Ngày sinh + Giờ sinh + Giới tính là thành phần gốc để tạo mã `seed` bốc quẻ (hai người có ngày sinh khác nhau cùng hỏi 1 câu trong cùng 1 ngày sẽ nhận 2 quẻ khác nhau).
   - Độ tuổi (`ageLunar`) dùng để lọc bỏ các lời luận giải không hợp tuổi (ví dụ: người trên 35 tuổi sẽ không bốc phải lời khuyên "chăm chỉ ôn thi học kỳ"; người dưới 18 tuổi không nhận lời luận về "cầu con cái").

---

### Câu hỏi 2: Có bói theo ngày không? Hôm nay ra quẻ này, hôm sau ra quẻ khác phải không?
**Chính xác 100%: Hôm nay ra quẻ này, sang ngày mai (sau 00:00 giờ Việt Nam UTC+7) sẽ ra quẻ khác.**

Cơ chế này hoạt động như sau trong `lib/boi/SeedService.ts`:
- Công thức tạo hạt giống ngẫu nhiên (`seed`) là:
  $$\text{seed} = \text{Hash32}\left(\text{NgàySinh} \mid \text{GiờSinh} \mid \text{GiớiTính} \mid \text{MãMôn} \mid \text{MãCâuHỏi} \mid \text{NgàyHiệnTại}_{\text{UTC+7}}\right)$$
- **Trong cùng một ngày hôm nay (ví dụ `2026-11-09`):**
  - Chuỗi `NgàyHiệnTại` giữ nguyên là `"2026-11-09"`.
  - Do đó, nếu cùng một người chơi, chọn cùng một môn và hỏi cùng một câu hỏi, dù có bấm gieo lại 10 lần trong ngày hôm nay thì kết quả `seed` vẫn không đổi và **luôn trả về đúng 1 quẻ duy nhất**. Thiết kế này tuân thủ nguyên tắc tâm linh *"Bất khả tái tam đọc"* (Xin quẻ chỉ linh ứng ở lần thành tâm đầu tiên trong ngày, ngăn người chơi spam bấm liên tục đến khi nào ra quẻ Đại Cát mới chịu dừng).
  - *(Lưu ý: Nếu trong cùng ngày hôm nay nhưng người chơi đổi sang hỏi một **Môn khác** hoặc một **Câu hỏi khác**, thì `MãMôn` / `MãCâuHỏi` thay đổi nên sẽ ra một quẻ khác tương ứng với câu hỏi mới đó).*
- **Khi bước sang ngày hôm sau (ví dụ `2026-11-10`):**
  1. Chuỗi `NgàyHiệnTại` tự động đổi thành `"2026-11-10"` -> Hàm băm `FNV-1a + MurmurHash3` sinh ra một con số `seed` 32-bit mới hoàn toàn.
  2. Can Chi và Ngũ Hành của ngày mới (`getCanChiNgay`) cũng thay đổi (ví dụ hôm qua là ngày Thủy tương sinh với mệnh Kim, hôm nay sang ngày Hỏa tương khắc với mệnh Kim) -> Bảng phân phối xác suất Cát/Hung cũng thay đổi theo.
  3. Kết quả là người chơi sẽ nhận được **một quẻ hoàn toàn mới cho ngày mới**.

---

### Câu hỏi 3: Nếu bói kiểu câu hỏi cụ thể, ví dụ "Tôi muốn đi chơi vào ngày 20/11/2026" thì hệ thống bói theo ngày 20/11/2026 hay vẫn bói theo ngày hôm nay?

**Hệ thống TỰ ĐỘNG BÓT TÁCH NGÀY `20/11/2026` trong câu hỏi để bói và tính Can Chi Ngũ Hành đúng vào ngày `20/11/2026`!** (Nếu trong câu hỏi không nhắc đến ngày cụ thể nào thì mới lấy ngày hôm nay).

Cụ thể, thông qua hàm `extractDateFromQuestion()` trong `lib/boi/SeedService.ts` và `generateFortune()` trong `lib/boi/FortuneEngine.ts`, khi bạn gõ câu hỏi tự do: *"Tôi muốn đi chơi vào ngày 20/11/2026"*:

1. **Bước 1 — Nhận diện chủ đề (`matchTopicFromQuestion`):** Hệ thống quét từ khóa *"đi chơi"* và gắn nhãn chủ đề **`xuat_hanh` (Xuất Hành & Di Chuyển)** để chọn các bài thơ xăm và lời luận giải nói đúng về chuyện đi xa, xuất hành.
2. **Bước 2 — Tự động bóc tách Ngày mục tiêu (`extractDateFromQuestion`):**
   - Hỗ trợ mọi cách gõ ngày phổ biến của người Việt:
     - `20/11/2026`, `20-11-2026`, `20.11.2026` (`DD/MM/YYYY`)
     - `2026-11-20`, `2026/11/20` (`YYYY-MM-DD`)
     - `ngày 20 tháng 11 năm 2026` hoặc `ngày 20 tháng 11`
     - `ngày 20/11`, `vào 20/11`, `hôm 20/11` (tự động lấy năm hiện tại nếu người chơi không ghi năm)
   - Kiểm tra tính hợp lệ thực tế của lịch (tự động loại bỏ ngày không tồn tại như `31/02/2026` hoặc `29/02` năm không nhuận).
3. **Bước 3 — Tính Thiên Thời Can Chi & Ngũ Hành đúng vào ngày `20/11/2026` (`analyzeMetaphysics`):**
   - Thay vì lấy ngày hôm nay, hệ thống truyền `dateStr = "2026-11-20"` vào bộ lịch Âm - Dương để tìm ra chính xác ngày `20/11/2026` là **Ngày Mậu Tuất, nạp âm Bình Địa Mộc (hành Mộc)**.
   - Lấy **Bản mệnh của người hỏi** đối sánh trực tiếp với **hành Mộc của ngày 20/11/2026** để tính Tương Sinh / Tương Khắc và điều chỉnh xác suất Cát / Hung của chuyến đi chơi ngày hôm đó.
   - Trên tờ **Sắc Quẻ Chiêm Bái**, dòng căn cứ thứ 3 sẽ hiển thị rõ ràng ngày mục tiêu:
     *`Thiên thời Ngày 20/11/2026 · Mậu Tuất (Mộc): Bản mệnh Kim gặp ngày Mộc: Tương khắc [Nghịch].`*

---

## 3. Chi tiết Thuật toán & Quy trình Xử lý 7 Bước

Mỗi khi người chơi bấm nút **"Gieo Quẻ / Thỉnh Xăm"**, hàm `generateFortune(input)` trong `lib/boi/FortuneEngine.ts` thực thi tuần tự 7 bước:

### Bước 1: Chuẩn hóa Đầu vào & Xác định Môn (`resolveMonId`)
- Chuyển đổi mã môn (`xin_xam`, `to_duyen`, `cau_tu`, `chieu_tai`, `duoc_su`, `dang_sao`) và kiểm tra chế độ hỏi (`quick` - Gieo nhanh, `preset` - Chọn câu hỏi gợi ý, `custom` - Tự nhập câu hỏi).

### Bước 2: Phân tích Câu hỏi & Gắn nhãn Chủ đề (`matchTopicFromQuestion`)
- Hệ thống không gọi AI sinh văn bản ngẫu nhiên lúc chạy (để đảm bảo tốc độ phản hồi `< 5ms` và kiểm soát 100% văn phong cổ phong trang trọng).
- Thay vào đó, hệ thống chấm điểm từ khóa (`keywordMap` trong `data/boi/config.json`) để quy câu hỏi của người chơi về 1 trong **8 Chủ đề (`TopicTag`)**:
  1. `tong_quan` — Bổn Mạng & Tổng Quan Vận Trình
  2. `su_nghiep` — Công Danh & Sự Nghiệp (từ khóa: *việc, công việc, sự nghiệp, thăng chức, xin việc, dự án, khởi nghiệp...*)
  3. `tai_loc` — Tài Lộc & Kinh Doanh (từ khóa: *tiền, tài lộc, lương, kinh doanh, buôn bán, đầu tư, vốn, đất đai...*)
  4. `tinh_duyen` — Tình Duyên & Tri Kỷ (từ khóa: *tình, yêu, duyên, vợ chồng, hôn nhân, cưới, chia tay, crush, hẹn hò...*)
  5. `gia_dao` — Gia Đạo & Con Cái (từ khóa: *con cái, cầu tự, gia đình, gia đạo, cha mẹ, nhà cửa, tổ ấm...*)
  6. `suc_khoe` — An Khang & Thân Tâm (từ khóa: *bệnh, khỏe, sức khỏe, ốm, đau, ngủ, khám, bình an, dưỡng sinh...*)
  7. `thi_cu` — Học Vấn & Khoa Cử (từ khóa: *thi, học, điểm, đỗ, trượt, tốt nghiệp, chứng chỉ, khoa cử, luận văn...*)
  8. `xuat_hanh` — Xuất Hành & Di Chuyển (từ khóa: *đi xa, xuất hành, du lịch, chuyển nhà, xuất ngoại, di chuyển, thượng lộ...*)

### Bước 3: Băm Mã Hạt Giống 32-bit (`buildFortuneSeed`)
- Chuẩn hóa toàn bộ chuỗi về chữ thường không dấu (`normalizeVietnameseText`), ghép thành chuỗi khóa:
  `key = "${normBirth}:${normHour}|${normGender}|${normMon}|${normQuestion}|${dateStr}"`
- Đưa chuỗi `key` qua thuật toán băm **FNV-1a kết hợp MurmurHash3 32-bit avalanche finalizer** để tạo ra số nguyên không dấu 32-bit `seed`, sau đó khởi tạo bộ sinh số giả ngẫu nhiên **Mulberry32 (`createSeededRng`)**.

### Bước 4: Phân tích Huyền học Đa tầng (`analyzeMetaphysics`)
- Chạy thuật toán lịch Âm - Dương (`VietnameseLunarCalendar.ts`) tính ra:
  - Ngày tháng năm Âm lịch & Can Chi năm sinh.
  - Ngũ Hành Bản Mệnh & tên Nạp Âm (trong 30 Nạp Âm của Lục Thập Hoa Giáp, ví dụ *Hải Trung Kim*, *Lư Trung Hỏa*, *Đại Lâm Mộc*, *Bạch Lạp Kim*...).
  - Cung Phi Bát Trạch (Càn, Khảm, Cấn, Chấn, Tốn, Ly, Khôn, Đoài) & Đông/Tây Tứ Mệnh.
  - Sao Chiếu Mệnh Cửu Diệu theo Tuổi Mụ & Giới tính.
  - Can Chi & Ngũ Hành của Ngày hiện tại.

### Bước 5: Tính Xác suất & Rút Mức Quẻ (`computeMucProbabilities` & `rollMucQue`)
- Điều chỉnh xác suất 5 mức quẻ (`Đại Cát`, `Cát`, `Bình`, `Hung`, `Đại Hung`) dựa trên quan hệ Ngũ Hành (`Tương Sinh`, `Bình Hòa`, `Tương Khắc`).
- Dùng số thực đầu tiên từ `rng.nextFloat()` để rút ra mức quẻ.
- Nếu căn cứ Ngũ Hành là `Tương Khắc` nhưng người chơi may mắn rút được quẻ `Cát / Đại Cát`, hệ thống tự động sinh dòng giải thích **Yếu tố bù đắp** (*"Căn cứ có xung khắc nhưng quẻ đắc Cát do phúc duyên niên vận sao lành nâng đỡ..."*) để đảm bảo tính logic chặt chẽ.

### Bước 6: Lắp ghép 4 Khối Nội dung Quẻ (`getCandidateBlocks` & `pickBlockAvoidingRecent`)
Mỗi lá xăm / quẻ hoàn chỉnh được tổng hợp từ **4 khối nội dung độc lập** trong kho dữ liệu `data/boi/*.json` (ưu tiên tránh trùng lặp với 3 lần gieo gần nhất của người chơi):
1. **Khối `tho` (Thơ Xăm & Tên Quẻ):** Bài thơ thất ngôn tứ tuyệt hoặc lục bát cổ phong cùng số thứ tự thẻ xăm (ví dụ: *Thẻ số 45 · Thượng Cát · Liên Hoa Tịnh Thủy*).
2. **Khối `luangiai` (Luận Giải Chủ Đề):** Phân tích chi tiết vận trình khớp với `TopicTag` mà người chơi vừa hỏi.
3. **Khối `loikhuyen` (Lời Khuyên Hành Trì & Chánh Niệm):** Hướng dẫn cách ứng xử, giữ tâm chánh niệm và hành động thực tế.
4. **Khối `hoagiai` (Pháp Hóa Giải — chỉ xuất hiện khi quẻ là `Hung` hoặc `Đại Hung`):** Hướng dẫn cách hóa giải vận hạn bằng việc thiện lành, thiền định hoặc cúng dường.

### Bước 7: Gắn Hiệu ứng Gameplay Trong Ngày (`dailyEffect`) & Lưu Biên Nhận
- Mỗi mức quẻ mang lại một hiệu ứng trạng thái (`Buff` hoặc `Debuff` nhẹ) trong ngày hôm đó cho nhân vật.
- Tạo biên nhận giao dịch (`receiptHash`) lưu vào bảng `fortune_records` trên SQLite và lịch sử cá nhân (tối đa 30 bản ghi).

---

## 4. Cơ chế Tính Bát Tự, Ngũ Hành & Điều chỉnh Xác suất Quẻ

Bảng dưới đây thể hiện chính xác tỷ lệ phần trăm ra từng loại quẻ trong `data/boi/config.json`:

| Mức Quẻ (`MucQue`) | Xác suất Gốc (`Bình Hòa`) | Khi Mệnh - Ngày **Tương Sinh** (`+Thuận`) | Khi Mệnh - Ngày **Tương Khắc** (`-Nghịch`) | Hiệu ứng Gameplay Trong Ngày (`dailyEffects`) |
| :--- | :--- | :--- | :--- | :--- |
| **Đại Cát (`dai_cat`)** | **10%** | **14%** (`+4%`) | **7%** (`-3%`) | **Buff:** *Hồng Phúc Tề Thiên* (`+10% MC` khi thiền định, `+10%` điểm phúc đức) |
| **Cát (`cat`)** | **30%** | **36%** (`+6%`) | **24%** (`-6%`) | **Buff:** *Thuận Buồm Xuôi Gió* (`+5% MC` khi thiền định, `+5%` điểm phúc đức) |
| **Bình (`binh`)** | **30%** | **28%** (`-2%`) | **29%** (`-1%`) | **Trung tính:** *Tâm Như Chỉ Thủy* (Giữ trạng thái cân bằng, an nhiên) |
| **Hung (`hung`)** | **20%** | **15%** (`-5%`) | **26%** (`+6%`) | **Debuff nhẹ:** *Tâm Cảnh Lao Đao* (`-5%` tốc độ tĩnh tâm — có thể **Hóa giải** ngay) |
| **Đại Hung (`dai_hung`)** | **10%** | **7%** (`-3%`) | **14%** (`+4%`) | **Debuff:** *Vận Khí Trầm Lắng* (`-10%` tốc độ tĩnh tâm — có thể **Hóa giải** ngay) |
| **Tổng cộng** | **100%** | **100%** | **100%** | *Quy tắc bất biến: Tổng (`Hung` + `Đại Hung`) luôn `>= 15%` để giữ tính chân thực* |

---

## 5. Cách Hệ thống Xử lý Câu hỏi & Chọn Nội dung Quẻ

Hệ thống hỗ trợ **3 phương thức đặt câu hỏi** trên giao diện Bàn Xem Quẻ:
1. **Gieo Nhanh Cầu An (`mode = 'quick'`):** Không cần nhập câu hỏi, hệ thống lấy câu hỏi mặc định của môn đó (ví dụ môn Xin Xăm lấy chủ đề `tong_quan`, môn Chiêu Tài lấy chủ đề `tai_loc`).
2. **Chọn Câu Hỏi Gợi Ý (`mode = 'preset'`):** Mỗi môn có sẵn 5–7 câu hỏi phổ biến nhất đã gắn sẵn nhãn `TopicTag` chuẩn xác.
3. **Tự Nhập Câu Hỏi Riêng (`mode = 'custom'`):** Người chơi tự gõ câu hỏi bất kỳ. Hệ thống dùng bộ lọc từ khóa `matchTopicFromQuestion` để tìm `TopicTag` sát nhất, đồng thời in nguyên văn câu hỏi của người chơi lên tờ **Sắc Quẻ Chiêm Bái** khi xem và khi tải ảnh về máy.

---

## 6. Cơ chế Gameplay: Lượt Miễn phí, Phí MC & Nhiệm vụ Hóa Giải

1. **Hạn mức Miễn phí Hằng ngày (`dailyFreeDrawsPerSubject = 1`):**
   - Mỗi ngày (tính theo múi giờ Việt Nam `UTC+7`), mỗi người chơi được **miễn phí 01 lượt gieo quẻ cho mỗi môn** (tổng cộng 6 lượt miễn phí/ngày cho 6 môn).
2. **Chi phí Lượt Gieo Thêm (`extraDrawCostMc = 50 MC` hoặc Vật phẩm Cúng dường):**
   - Nếu trong ngày đã dùng hết lượt miễn phí của môn đó mà muốn thỉnh thêm quẻ (ví dụ hỏi sang câu hỏi khác hoặc xem cho người thân), người chơi có thể dùng **Vật phẩm lễ phẩm** trong túi đồ (Hương trầm, Hoa sen) hoặc trả **`50 MC` / lượt**.
3. **Nhiệm vụ Hóa Giải Vận Hạn (`resolveActiveDebuff`):**
   - Khi rút phải quẻ **Hung** hoặc **Đại Hung**, hệ thống không bao giờ hù dọa bi quan mà luôn mở ra **Nhiệm vụ Hóa Giải Chánh Niệm** ngay trên giao diện:
     - Ngồi thiền tại **Hội Thiền 432Hz** trước tượng Phật.
     - Hoặc **Dâng hương / Phát tâm công đức** tại Hòm Công Đức.
   - Ngay khi người chơi hoàn thành hành động thiện lành đó, trạng thái `Debuff` được gỡ bỏ tức thì và chuyển hóa thành **Buff "Tâm Bình Khí Hòa (+5% Tâm An)"**.

---

## 7. Sơ đồ Luồng Xử lý Tổng thể (Flowchart)

```
[Người chơi mở Bàn Xem Quẻ Cầu An]
                │
                ▼
[Nhập/Lưu Hồ sơ: Họ tên + Ngày tháng năm sinh + Giờ sinh + Giới tính]
(Nếu môn Tơ Duyên: Nhập thêm Ngày tháng năm sinh của Người thương)
                │
                ▼
[Chọn 1 trong 6 Môn & Chọn Câu hỏi (Gợi ý hoặc Tự nhập)]
                │
                ▼
+-------------------------------------------------------------------+
| Kiểm tra Hạn mức: Còn lượt miễn phí trong ngày của môn này không? |
+-------------------------------------------------------------------+
   │ Còn (1 lượt/môn/ngày)              │ Hết lượt miễn phí
   ▼                                    ▼
[Miễn phí 0 MC]              [Trừ 1 Lễ phẩm hoặc 50 MC qua mc_ledger]
   │                                    │
   +────────────────┬───────────────────+
                    ▼
[Bước 1: Chuẩn hóa Câu hỏi -> Dò từ khóa ra Chủ đề (TopicTag)]
                    │
                    ▼
[Bước 2: Đổi Ngày sinh Dương -> Âm lịch Việt Nam (VietnameseLunarCalendar)
         Tính Can Chi, Ngũ Hành Nạp Âm, Cung Phi, Tuổi Mụ, Sao Cửu Diệu]
                    │
                    ▼
[Bước 3: Đối sánh Ngũ Hành Bản Mệnh với Ngũ Hành Ngày hiện tại (UTC+7)
         -> Điều chỉnh tỷ lệ % (Đại Cát / Cát / Bình / Hung / Đại Hung)]
                    │
                    ▼
[Bước 4: Băm mã Seed 32-bit = Hash(NgàySinh + GiờSinh + GiớiTính + Môn + CâuHỏi + NgàyHiệnTại)
         -> Khởi tạo Mulberry32 PRNG -> Rút Mức Quẻ & 4 Khối Nội Dung (Thơ, Luận giải, Lời khuyên, Hóa giải)]
                    │
                    ▼
[Bước 5: Lưu fortune_records vào SQLite + Áp dụng Buff/Debuff trong ngày
         + Hiển thị tờ "Sắc Quẻ Chiêm Bái" & Cho phép Xuất Ảnh PNG]
```

