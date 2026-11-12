# Kiểm kê chữ hiển thị (Giai đoạn 4, bước 4.1)

Số liệu đo bằng `npm run copy:inventory` (script `scripts/copy-inventory.mjs`, bộ quét ở `scripts/lib/copyScan.mjs`). Bộ quét dùng regex, không phải trình phân tích cú pháp đầy đủ, nên là ước lượng: đếm text node trong thẻ, chuỗi literal trong `{{ }}`, thuộc tính `placeholder/title/aria-label/label/alt`, và chuỗi tiếng Việt trong `<script>` và `.ts`. Nội dung trong `<details>` (lớp thứ hai do người chơi chủ động mở) không tính vào chữ mặc định. Trang `pages/dev/*` bị loại vì không phải giao diện người chơi.

## Cách đọc số

- Cột "tổng từ" là số từ hiển thị theo mọi loại. Cột "trước" đo ở đầu Giai đoạn 4, cột "sau" đo sau khi tách chuỗi sang `lib/ui/copy.ts` và viết lại theo ngân sách.
- Chuỗi đã chuyển sang `t('khóa')` không còn nằm trong component nên bộ quét không đếm ở đó nữa. Chúng được đếm riêng ở dòng `lib/ui/copy.ts` (502 từ, 105 chuỗi). Vì vậy so sánh công bằng nhất là tổng toàn bộ.
- Loại chữ trong bộ quét: tiêu đề (`h1` đến `h6`), nút (`button`, `UiButton`), mô tả (`p`), nhãn (các thẻ còn lại và thuộc tính), script (chuỗi trong `<script>` và `.ts`: thông báo, nhãn dữ liệu, nội dung văn hóa).

## Bảng theo màn hình

| Màn hình / tệp | Tổng từ trước | Tổng từ sau | Ghi chú |
|---|---|---|---|
| `components/SanctuaryDrawer.vue` | 2292 | 1626 | Giảm nhiều nhất. Còn 897 từ ở loại script là dữ liệu văn hóa (danh mục quẻ, vật phẩm, lời kinh), thuộc "nội dung văn hóa", giữ nguyên |
| `components/TempleCanvas.vue` | 1540 | 932 | Toàn bộ 52 toast được rút về tối đa 6 từ. Hướng dẫn phím tắt nằm ở `controlHints.ts` |
| `components/HauDongPanel.vue` | 542 | 323 | Các đoạn giải thích chia quỹ 60/25/15 đã rút còn một câu |
| `components/WalletConnectModal.vue` | 319 | 219 | Câu mô tả CIP-8 rút còn một câu ngắn |
| `components/AbbotChatDrawer.vue` | 257 | 221 | Phần lớn là lời thoại của Trụ Trì, thuộc nội dung văn hóa |
| `stores/meditation.ts` | 378 | 215 | 14 thông báo thiền viết lại, tiêu đề tối đa 6 từ và nội dung tối đa 12 từ |
| `components/SoundscapeMixer.vue` | 99 | 84 | Nhãn preset còn 2 từ |
| `components/ZenChatDrawer.vue` | 76 | 59 | |
| `components/MeditationModal.vue` | 69 | 65 | |
| `components/cards/CardRevealModal.vue` | 43 | 21 | Tiêu đề 8 từ còn 3 từ |
| `components/DisclaimerBanner.vue` | 27 | gần 0 mặc định | 3 mục pháp lý chuyển vào `<details>`, mặc định chỉ thấy nút "Xem thêm" |
| Các tệp còn lại (`ui/`, `cards/`, `HydraBadge`, `OnlinePilgrimsModal`, `EmoteWheel`, store phụ, `controlHints.ts`) | 1157 | 1064 | Phần lớn là dữ liệu và nhãn của thẻ bài, store ví, kinh văn. Không đụng tới |
| `lib/ui/copy.ts` (nguồn chuỗi mới) | 0 | 502 | Chuỗi gom từ các component ở trên |

Tổng toàn bộ (không tính `pages/dev`): trước 6799 từ, sau 5331 từ (đã gồm 502 từ ở `copy.ts`). Nếu tính riêng chữ còn nằm trong component thì còn 4829 từ.

## Mức cần thiết

| Mức | Gồm những gì |
|---|---|
| Bắt buộc | Nhãn nút hành động, tiêu đề màn, số MC, lỗi nói cách khắc phục |
| Nên có | Mô tả một câu dưới tiêu đề, tooltip |
| Bỏ được hoặc đã đưa vào lớp hai | Đoạn giải thích cơ chế chia quỹ, giải thích CIP-8, mô tả dài của thẻ bài, giải thích pháp lý đầy đủ |

## Số chuỗi vượt ngân sách

- Trước: 83 chuỗi vượt (nút, tiêu đề, mô tả), chưa tính toast.
- Sau: 0 chuỗi vượt. `npm run verify:copy` báo `ALL COPY BUDGET CHECKS PASSED`.
- Toast (`showToast`, khoảng 50 lời gọi) và thông báo thiền (`pushNotice`, 14 lời gọi) cũng được quét bằng cùng script và đều đạt. Lần quét đầu bắt được 12 thông báo thiền vượt, đã sửa trước khi cổng qua.
- Chưa có số liệu "trước" cho toast vì bộ quét đầu chưa quét `showToast`. Tôi chỉ đọc thủ công danh sách 52 vị trí gọi `showToast` và thấy phần lớn có mô tả vượt 6 từ, nhưng chưa đếm chính xác từng cái, nên không ghi con số.

## Giới hạn của số liệu

- Bộ quét không hiểu mọi mẫu viết mã. Một số chuỗi ghép từ nhiều biến hoặc nằm trong dữ liệu JSON (`data/`, `server/`) không được đếm. Nội dung nghi lễ trong `data/van_hoa_chua_nghi_le/` và `data/cau_hoi_co_san/` là nội dung văn hóa, không thuộc phạm vi rút gọn.
- Số từ tiếng Việt đếm theo khoảng trắng nên "Chánh Điện" tính 2 từ.
- Chưa kiểm kê chữ do máy chủ trả về (`e.data.message`). Chỗ nào còn hiển thị thông báo lỗi thô từ API sẽ cần xử lý ở bước sau.
