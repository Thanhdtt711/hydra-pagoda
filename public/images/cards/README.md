# Hướng dẫn Thêm Ảnh PNG Thẻ Bài Di Sản Cổ Tự

Thư mục này chứa hình ảnh minh họa thực tế (PNG, JPG hoặc WebP) cho 18 Thẻ Bài Di Sản Cổ Tự.

## 1. Quy tắc đặt tên file
Sumale chỉ cần lưu file ảnh với định dạng PNG và đặt tên trùng khớp với mã ID của thẻ bài:

| Mã Thẻ (Card ID) | Tên Thẻ Bài Di Sản | Quốc Gia | Tên File Đề Xuất |
|---|---|---|---|
| `card_vn_01` | Chùa Một Cột (Diên Hựu Tự) | Việt Nam | `card_vn_01.png` |
| `card_vn_02` | Cư Trần Lạc Đạo Phú (Trúc Lâm Yên Tử) | Việt Nam | `card_vn_02.png` |
| `card_vn_03` | Chùa Keo Thái Bình | Việt Nam | `card_vn_03.png` |
| `card_vn_04` | Bát Nhã Tâm Kinh | Việt Nam | `card_vn_04.png` |
| `card_vn_05` | Chùa Hương Tích | Việt Nam | `card_vn_05.png` |
| `card_jp_01` | Đông Đại Tự Todai-ji | Nhật Bản | `card_jp_01.png` |
| `card_jp_02` | Kim Các Tự Kinkaku-ji | Nhật Bản | `card_jp_02.png` |
| `card_jp_03` | Trà Đạo Nhất Kỳ Nhất Hội | Nhật Bản | `card_jp_03.png` |
| `card_jp_04` | Vòng Tròn Thiền Ý Enso | Nhật Bản | `card_jp_04.png` |
| `card_jp_05` | Vườn Đá Khô Long An Tự Ryoan-ji | Nhật Bản | `card_jp_05.png` |
| `card_th_01` | Chùa Phật Ngọc Wat Phra Kaew | Thái Lan | `card_th_01.png` |
| `card_th_02` | Chùa Bình Minh Wat Arun | Thái Lan | `card_th_02.png` |
| `card_th_03` | Từ Bi Quán Tưởng Metta Bhavana | Thái Lan | `card_th_03.png` |
| `card_th_04` | Bánh Xe Chánh Pháp Luân | Thái Lan | `card_th_04.png` |
| `card_kr_01` | Hải Ấn Tự Bát Vạn Đại Tạng Kinh | Hàn Quốc | `card_kr_01.png` |
| `card_kr_02` | Phật Quốc Tự Bulguksa | Hàn Quốc | `card_kr_02.png` |
| `card_kr_03` | Nhất Tâm Chân Như Thiền Sư Wonhyo | Hàn Quốc | `card_kr_03.png` |
| `card_kr_04` | Tào Khê Tự Jogyesa | Hàn Quốc | `card_kr_04.png` |

## 2. Cơ chế Fallback thông minh
- Khi Sumale thả file ảnh PNG vào đây (tỉ lệ khuyên dùng khoảng `4:3` hoặc `16:11`, ví dụ `640x440px`), giao diện thẻ bài trên màn hình mở hộp mù (Gacha) và phòng trưng bày sẽ lập tức tự động load ảnh PNG thật.
- Nếu chưa có file PNG hoặc ảnh bị lỗi, hệ thống tự động hiển thị hình vẽ vector nghệ thuật dự phòng thanh tịnh, không bao giờ bị vỡ giao diện hay hiện icon gãy ảnh.

