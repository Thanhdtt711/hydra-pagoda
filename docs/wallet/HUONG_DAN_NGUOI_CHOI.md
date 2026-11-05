# Hướng dẫn Người chơi — Kết nối Ví Eternl, Nạp & Sử dụng MC Coin (`HUONG_DAN_NGUOI_CHOI.md`)

Chào mừng bạn đến với **Vạn Cảnh Thiền Tự (`hydra-pagoda`)**. Tài liệu này hướng dẫn chi tiết cách cài đặt ví Cardano **Eternl**, đăng nhập an toàn, nạp **MC Coin** bằng ADA và sử dụng MC Coin trong không gian chùa 3D.

---

## 1. Lưu ý Quan trọng Trước Khi Bắt Đầu

> [!IMPORTANT]
> - **MC Coin là điểm trong game (off-chain)** được lưu trên máy chủ của Vạn Cảnh Thiền Tự, dùng để thỉnh cổ phục, lễ vật, thẻ bài di sản, gieo quẻ đầu xuân và cúng dường Hòm Công Đức trong chùa.
> - **MC Coin KHÔNG phải tiền mã hóa và KHÔNG đổi ngược ra ADA (chỉ nạp một chiều).**
> - **Hòm công đức trong chùa là hoàn toàn tự nguyện.**

---

## 2. Cài đặt Ví Eternl & Chọn Đúng Mạng

1. **Cài đặt tiện ích mở rộng Eternl chính thức** cho trình duyệt Chrome / Brave / Edge tại:
   - https://eternl.io (hoặc liên kết Chrome Web Store hiển thị trực tiếp trong cửa sổ kết nối ví của game).
2. **Tạo hoặc khôi phục ví Cardano** trong tiện ích Eternl và đặt mật khẩu chi tiêu (Spending Password).
3. **Chọn đúng mạng hoạt động**:
   - Khi góc trên màn hình Vạn Cảnh Thiền Tự có nhãn màu vàng **`TESTNET`**: hãy mở Eternl và chuyển mạng ở góc dưới bên trái sang **`Preprod Testnet`**. Bạn có thể nhận tADA thử nghiệm miễn phí tại [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet).
   - Khi hệ thống chạy chính thức (**Mainnet**): chọn mạng **`Mainnet`** trong ví Eternl.

---

## 3. Kết nối Ví & Ký Thông điệp Đăng nhập

1. Trên thanh trạng thái trên cùng của chùa, bấm vào nút **`VÍ CARDANO`**.
2. Trong cửa sổ hiện ra, bấm **`Kết nối & Đăng nhập bằng Ví Eternl`**.
3. Tiện ích Eternl sẽ bật lên 2 bước xác nhận:
   - **Bước 1 — Cấp quyền truy cập đọc địa chỉ (`enable`)**: cho phép trang web xem địa chỉ ví và mạng hiện tại.
   - **Bước 2 — Ký thông điệp xác thực chủ sở hữu (`signData` / CIP-8)**: bạn sẽ thấy nội dung thông điệp rõ ràng gồm tên game **`Vạn Cảnh Thiền Tự`**, tên miền, mã `Nonce` dùng một lần và thời gian. Việc ký thông điệp này **hoàn toàn miễn phí (không tốn ADA)** và chứng minh bạn là chủ sở hữu thực sự của ví.
4. Sau khi ký thành công:
   - Thanh trên cùng hiển thị địa chỉ rút gọn của bạn (ví dụ `addr_test1...n9ug9`) và số dư **`MC`** thật từ máy chủ.
   - Khi bạn tải lại trang (`F5`), phiên đăng nhập vẫn được giữ tự động mà không cần ký lại. Nếu bạn đổi sang tài khoản khác hoặc đổi mạng trong ví Eternl, hệ thống sẽ tự động đăng xuất an toàn.

---

## 4. Cách Mua MC Coin bằng ADA

1. Bấm nút **`+ NẠP MC`** màu vàng trên thanh trên cùng (hoặc mở **`VÍ CARDANO`** → chuyển sang tab **`Mua MC`**).
2. **Quy tắc quy đổi & gói mua**:
   - **Tỷ lệ cố định:** **`1 ADA = 1.000 MC`** (`1 MC = 1.000 lovelace`).
   - **Gói tối thiểu:** **`2 ADA`** (`2.000 MC`) để đảm bảo quy tắc min-UTxO của mạng Cardano.
   - Bạn có thể chọn nhanh các gói **`5 ADA`**, **`10 ADA`**, **`50 ADA`**, **`100 ADA`** hoặc nhập một số nguyên ADA bất kỳ (`>= 2 ADA`).
   - Giao diện luôn hiển thị rõ: *"Bạn trả X ADA (chưa gồm phí mạng ~0.2 ADA) → nhận Y MC"*.
3. Bấm **`Mua Y MC bằng X ADA`**:
   - Hệ thống tạo đơn hàng (có hạn 30 phút) và dựng giao dịch trả đúng số ADA tới ví Treasury của chùa kèm mã đơn (`orderId`) trong metadata.
   - Ví Eternl bật cửa sổ yêu cầu bạn nhập mật khẩu ký giao dịch (`signTx`) và gửi lên mạng lưới (`submitTx`).
4. **Theo dõi trạng thái đơn trực tiếp**:
   - Giao diện hiển thị tiến trình 4 bước: **Đang chờ ký → Đã gửi lên chuỗi → Đang chờ xác nhận khối (`Confirmations`) → Hoàn tất**.
   - Trên mạng **Preprod**, giao dịch thường đạt `1/1` xác nhận sau khoảng **20 – 40 giây**. Trên **Mainnet** (`3/3` xác nhận), thời gian khoảng **60 – 90 giây**.
   - Ngay khi đạt đủ xác nhận, số dư **MC** trên thanh trên cùng sẽ tự động cộng thêm theo thời gian thực. Bạn có thể bấm vào liên kết **`Cardanoscan ↗`** cạnh mỗi đơn để kiểm tra giao dịch trực tiếp trên trình khám phá chuỗi Cardano.
   - Nếu bạn lỡ đóng trình duyệt khi đơn đang chờ xác nhận, đừng lo: máy chủ vẫn tự động theo dõi chuỗi và cộng MC ngay khi giao dịch hoàn tất.

---

## 5. Cách Sử dụng MC Coin trong Chùa

Bạn có thể bấm các phím tắt **`[1]`**, **`[2]`**, **`[3]`** trên thanh dưới cùng hoặc đi bộ lại gần các điểm tương tác 3D trong chùa và nhấn phím **`E`**:

1. **Bói Quẻ & Cầu An 6 Môn (`[1]` hoặc lại gần Bàn Quẻ Khai Xuân)**:
   - Chọn 1 trong 6 môn: *Xin Xăm Bát Quái, Tơ Duyên Tương Ngộ, Cầu Tự Con Cái, Chiêu Tài Tấn Bảo, Dược Sư An Khang, Dâng Sao Giải Hạn*.
   - Chọn cấp bậc chiêm nghiệm: **Quẻ Cơ Bản (`10 MC`)**, **Phổ Biến (`50 MC`)**, hoặc **Kim Quyển (`100 MC`)**.
   - Bấm **Gieo Quẻ Chiêm Bái** → kiểm tra hộp **Xác nhận tiêu MC** → bấm **Xác nhận**. Máy chủ sẽ sinh quẻ và lưu vào **Lịch Sử Quẻ Đã Gieo** của bạn.
2. **Hòm Công Đức (`[2]` hoặc lại gần Hòm Công Đức Tam Bảo)**:
   - Chọn mức gợi ý (`50 / 100 / 500 / 1.000 MC`) hoặc nhập số MC tùy tâm (`>= 10 MC`), nhập lời nguyện cầu hồi hướng và bấm **Xác nhận**.
   - Tên hiển thị của bạn sẽ được ghi nhận vào **Bảng Vàng Công Đức**. Đặc biệt, khi cúng dường từ **`500 MC`** trở lên, bạn được tặng vật phẩm tri ân **Hoa Đăng Cầu An** vào kho đồ.
3. **Cửa Hàng Pháp Bảo, Cổ Phục & Thẻ Bài Di Sản (`[3]`)**:
   - **Cổ Phục 9 Quốc Gia**: mở khóa vĩnh viễn các bộ pháp phục truyền thống (Thái Lan `800 MC`, Hàn Quốc `1.000 MC`, Đài Loan `1.200 MC`, Ấn Độ `1.800 MC`, Tây Tạng `2.500 MC`...) và khoác trực tiếp lên nhân vật 3D.
   - **Lễ Vật & Nhang Trầm**: mua cộng dồn các vật phẩm lễ (*Trầm Hương Xứ Quảng `50 MC`, Hoa Đăng Cầu An `60 MC`, Mâm Ngũ Quả `120 MC`...*).
   - **Thẻ Bài Di Sản 3D**: khai quang vĩnh viễn các thẻ bài kiến trúc cổ tự và triết lý phương Đông trong bộ sưu tập của tài khoản.

---

## 6. Câu hỏi Thường gặp (FAQ)

- **Hỏi: Tôi bấm mua hoặc gieo quẻ khi mạng yếu bị bấm đúp 2 lần thì có bị trừ MC 2 lần không?**
  - **Đáp:** Không. Mỗi hộp xác nhận tiêu MC đều gắn một mã `requestId` duy nhất; máy chủ đảm bảo mỗi yêu cầu chỉ trừ MC đúng một lần.
- **Hỏi: Số dư MC của tôi chưa đủ để mua vật phẩm thì làm sao?**
  - **Đáp:** Khi số dư không đủ, nút mua sẽ tự động làm mờ kèm nút **`+ Nạp MC`** ngay bên cạnh để bạn mở nhanh cửa sổ nạp MC bằng ADA.
- **Hỏi: Tôi có thể rút MC Coin về lại ví Eternl thành ADA được không?**
  - **Đáp:** Không. MC Coin là điểm tiêu dùng nội bộ một chiều trong game, không thể quy đổi ngược ra ADA hay bất kỳ tài sản mã hóa nào.

