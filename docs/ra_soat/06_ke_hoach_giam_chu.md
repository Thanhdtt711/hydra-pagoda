# Kế hoạch giảm chữ (Giai đoạn 4)

Nguyên tắc: người chơi hiểu qua hình, màu, biểu tượng, âm thanh và bối cảnh trước, chữ chỉ còn khi không thể thay bằng thứ khác. Không mất thông tin, chỉ chuyển sang dạng người chơi chủ động mở.

## 1. Đã làm

- Gom chuỗi hiển thị về `lib/ui/copy.ts` với hàm `t('khóa', { biến })`. Sửa chữ một chỗ, dễ thêm tiếng Anh sau (tách thành `COPY_VI` và `COPY_EN` rồi chọn theo locale).
- Tiền tố khóa quyết định ngân sách: `btn.*` và `title.*` tối đa 3 từ, `toast.*` tối đa 6 từ, `tip.*` và `desc.*` tối đa 12 từ.
- `scripts/verify-copy-budget.mjs` (chạy bằng `npm run verify:copy`) kiểm 4 nhóm: chuỗi hiển thị trong component, các khóa trong `copy.ts`, mọi lời gọi `showToast` (tối đa 6 từ), mọi lời gọi `pushNotice` (tiêu đề tối đa 6 từ, nội dung tối đa 12 từ).
- Thay đoạn giải thích bằng biểu tượng cộng số ở các nút có giá: "Cúng dường" kèm `1,000 MC`, "Mở đàn" kèm `2,500 MC`, "Chắp tay" kèm `+5 MC`, "Nạp 2,000 MC" kèm `2 ADA`. Số dùng `font-numbers` và nằm cạnh nhãn, không viết thành câu.
- Rút 52 toast ở `TempleCanvas.vue` thành một tiêu đề ngắn, phần mô tả để trống. Ví dụ "Dâng hương", "+15 MC", "Đợi giá thứ 5", "Bị cản, hãy tự bước".
- Rút 14 thông báo thiền ở `stores/meditation.ts`.
- Tiết lộ dần ở `DisclaimerBanner`: mặc định chỉ có một nút "Xem thêm", 3 mục pháp lý nằm trong `<details>`.
- Thay hoạt ảnh `animate-pulse` ở vòng thở bằng chuyển động phóng to và thu nhỏ theo pha thở: hít vào và giữ hơi thì vòng nở ra, thở ra thì vòng co lại. Người chơi nhìn vòng là biết nhịp thở mà không cần đọc "Hít vào / Thở ra".

## 2. Bảng thuật ngữ

| Khái niệm | Từ dùng thống nhất | Không dùng |
|---|---|---|
| Điểm trong game | MC | Merit Coin, Merit Coins, điểm công đức |
| Hành động quyên góp | cúng dường | phát tâm, hỷ cúng, dâng tiền |
| Nơi quyên góp | hòm công đức | Hòm Công Đức Tam Bảo, sổ vàng (chỉ dùng cho bảng xếp hạng) |
| Kết quả bói | quẻ | xăm, lá xăm (trừ tên Bàn Xin Xăm là vật thể trong cảnh) |
| Hành động bói | gieo quẻ | thỉnh quẻ, chiêm nghiệm |
| Chỗ ngồi thiền | bồ đoàn | đệm, nệm |
| Hành động thiền | ngồi thiền | bắt đầu tọa thiền, thiền định |
| Dẫn nhân vật tự đi | "Đến ..." hoặc "Vào ..." | "Dẫn đường đến ..." |
| Đóng cửa sổ | Hủy hoặc Quay lại | Hủy bỏ & Quay lại |

Tên riêng giữ nguyên vì là tên vật thể hoặc địa điểm trong cảnh 3D: Bàn Xin Xăm, Đài Tơ Duyên, Điện Thờ Tứ Phủ, Chánh Điện, Đại Hùng Bảo Điện, Cổng Tam Quan.

## 3. Kịch bản hướng dẫn lần đầu (đề xuất, chưa làm)

Chuỗi 5 bước trong cảnh 3D, mỗi bước một biểu tượng, một vòng sáng, tối đa 4 từ, hoàn thành bằng hành động thật chứ không bấm "Tiếp":

| Bước | Biểu tượng + vòng sáng ở | Chữ (tối đa 4 từ) | Hoàn thành khi |
|---|---|---|---|
| 1. Đi tới | Vòng sáng trên nền sân trước Tam Quan | "WASD: đi tới" | Nhân vật đi qua vòng sáng |
| 2. Thắp nhang | Vòng sáng quanh đỉnh hương | "E: Thắp nhang" | Gọi được `handleIncenseOffering` |
| 3. Quyên góp | Vòng sáng quanh hòm công đức | "E: Cúng dường" | `economy.donateMerit` thành công |
| 4. Xin quẻ | Vòng sáng quanh Bàn Xin Xăm | "E: Gieo quẻ" | Có kết quả `fortuneResult` |
| 5. Ngồi thiền | Vòng sáng ở Chánh Điện | "T: Ngồi thiền" | `meditation.phase` chuyển sang `seated` |

Quy tắc đi kèm: mỗi gợi ý chỉ hiện một lần cho tình huống đó rồi tự ẩn (lưu cờ vào `localStorage`), có nút "xem lại" ở chỗ cố định. Không hiện bảng hướng dẫn khi mới vào.

Lý do chưa làm: cần dựng vòng sáng và biểu tượng nổi trong `lib/world3d/TempleStage.ts` (2400 dòng) và nối với từng store. Đây là việc đụng vào cảnh 3D, nên tách thành tác vụ riêng để kiểm FPS và bộ nhớ.

## 4. Chưa làm hoặc chưa chắc

- **Kiểm thử khả dụng với 5 người chưa chơi bao giờ chưa thực hiện.** Tôi không thể tự tìm người thử. Kịch bản đề xuất: mỗi người có 3 phút, quan sát họ có tự làm được thắp nhang, quyên góp, xin một quẻ, ngồi thiền, mở thẻ bài mà không hỏi. Ghi kết quả vào bảng dưới, nếu thất bại ở bước nào thì khôi phục lượng chữ tối thiểu ở đúng chỗ đó. Vì chưa thử nên mức chữ hiện tại là ước đoán theo ngân sách, chưa có bằng chứng người chơi vẫn hiểu.
- **Vòng tiến độ cho phần thưởng và giới hạn ngày (4.4) chưa làm.** Hiện vẫn hiển thị bằng số ("+X MC", "Đủ rồi hôm nay"). Cần dựng vòng tròn đầy dần ở HUD.
- **Âm thanh thay lời (quy tắc 9) mới có sẵn một phần**: chuông và mõ đã phát khi thành công, nhưng chưa thêm rung nhẹ thị giác khi lỗi.
- **Còn chuỗi vượt ở các chỗ bộ quét không thấy**: thông báo lỗi do máy chủ trả về (`e.data.message`) hiển thị nguyên văn. Cần chuẩn hóa mã lỗi sang câu ngắn ở phía giao diện.
- **Nội dung văn hóa** (lời Trụ Trì, kinh văn, mô tả thẻ bài, giải quẻ chi tiết) chưa tách thành "một câu cốt lõi mặc định, bản đầy đủ khi mở" theo quy tắc 11. Việc này cần biên tập nội dung, không tự động hóa được.
- **Phím tắt (quy tắc 10)** đã gom ở `controlHints.ts` từ Giai đoạn 3, giữ nguyên.
- Một số chuỗi rút gọn có thể làm mất sắc thái. Ví dụ "Bị cản, hãy tự bước" thay cho câu chỉ rõ hướng đi (Đông, Tây Nam, phía sau Chánh Điện). Nếu thấy người chơi lạc hướng thì khôi phục hướng ở đúng chỗ đó.

### Bảng ghi kết quả kiểm thử khả dụng (để trống, điền khi thử)

| Người thử | Thắp nhang | Quyên góp | Xin quẻ | Ngồi thiền | Mở thẻ bài | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

## 5. Cách giữ ngân sách về sau

- Thêm chuỗi mới vào `lib/ui/copy.ts` theo đúng tiền tố, chạy `npm run verify:copy` trước khi gộp.
- Toast mới chỉ truyền tiêu đề, để trống mô tả, ưu tiên "+N MC" kèm biểu tượng.
- Đoạn giải thích dài đặt trong `<details>` hoặc sau nút "i", không đặt thẳng vào nội dung mặc định.

## Đợt sửa sau Giai đoạn 4: vỡ layout, font serif, bản đồ

- Danh sách câu hỏi ở tab Chọn Câu Hỏi bị cắt chữ vì thẻ `UiSelectableCard` co lại trong khung `max-h-52`. Đã thêm `shrink-0` cho thẻ và `break-words` cho tiêu đề thẻ để thẻ giữ đủ chiều cao và danh sách cuộn bên trong khung.
- Bỏ hẳn `ui-font-serif` ở 7 component và bỏ font `Noto Serif Display` khỏi `nuxt.config.ts`, `main.css`, `tokens.css`. Tiêu đề dùng Be Vietnam Pro đậm. `verify-ui-primitives.mjs` có luật mới chặn `ui-font-serif` và `Noto Serif Display`. `Noto Serif` chỉ còn dùng khi vẽ canvas (ảnh chia sẻ quẻ, bảng gỗ trong cảnh 3D).
- Viết lại bản đồ Thiền Tự trong `TempleCanvas.vue`. Bản cũ co giãn lệch hai trục (400x260 cho vùng 90x90 m) và vẽ sai vị trí so với `MapLayout.LANDMARKS`. Bản mới có tỉ lệ đều 6 px/m, Bắc ở trên, mũi tên hướng nhìn quay đúng theo `-yaw`, có la bàn, đường vào Nhà Hầu Đồng và đường lên núi, nhãn cỡ chữ tương đương 12 px trở lên. Nút điều hướng bản đồ cho phép xuống dòng để không tràn ở màn 375 px.
- Bỏ `animate-pulse` ở biểu tượng mặt sau thẻ di sản. Dòng phụ của `AbbotChatDrawer` không còn bị cắt bằng dấu ba chấm.
- Quét DOM bằng Chrome ở 375, 768 và 1440 px cho HUD, bản đồ, ba menu dock và các drawer. Không còn chữ bị cắt hay tràn khỏi khung. Các mục `offscreen` còn lại là thanh tab của drawer, cuộn ngang có chủ đích.
