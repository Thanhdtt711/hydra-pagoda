# Tài liệu Ví Cardano Eternl & Kinh tế MC Coin — Vạn Cảnh Thiền Tự (`hydra-pagoda`)

Bộ tài liệu này mô tả đầy đủ kiến trúc, bảo mật, hướng dẫn cài đặt vận hành, hướng dẫn người chơi và báo cáo nghiệm thu cho hệ thống **Đăng nhập ví Cardano Eternl (CIP-30 / CIP-8)**, **Mua MC Coin bằng ADA trên chuỗi Cardano L1 (`@hydra-sdk/cardano-wasm` & `@hydra-sdk/core`)**, và **Dịch vụ Ví nội bộ Tiêu MC Coin (`spend`)** của dự án **Vạn Cảnh Thiền Tự (`hydra-pagoda`)**.

---

## Mục lục Tài liệu (`docs/wallet/`)

1. **[`REUSE_REPORT.md`](./REUSE_REPORT.md) — Báo cáo Điều tra & Tái sử dụng (Bước 1)**
   - Khảo sát hiện trạng ví Cardano và kinh tế trong `hydra-pagoda`.
   - Đối chiếu với dự án tham khảo `D:\Vtechcom\hydra-graveyard`: những module tái sử dụng được, những phần không tái sử dụng và lý do kỹ thuật/bảo mật.
2. **[`KIEN_TRUC.md`](./KIEN_TRUC.md) — Kiến trúc Hệ thống, Lược đồ CSDL, API & Mô hình Mối đe dọa**
   - Sơ đồ luồng dữ liệu Mermaid cho 3 nghiệp vụ chính:
     1. Đăng nhập ví Eternl (CIP-30 + chữ ký CIP-8 `COSE_Sign1`) & định danh WebSocket.
     2. Mua MC Coin bằng ADA (`@hydra-sdk/cardano-wasm`, Blockfrost / Koios Indexer, cộng MC nguyên tử sau khi đạt `>= N` xác nhận).
     3. Tiêu MC Coin nguyên tử (`spend()`) cho Cửa Hàng/Di Sản, Bói Quẻ 6 Môn và Hòm Công Đức.
   - Lược đồ CSDL SQLite WAL đầy đủ (`10` bảng).
   - Danh mục toàn bộ API endpoint (đầu vào, đầu ra, mã lỗi).
   - Mô hình mối đe dọa (Threat Model) và các lớp phòng vệ.
3. **[`HUONG_DAN_CAI_DAT.md`](./HUONG_DAN_CAI_DAT.md) — Hướng dẫn Cài đặt, Vận hành & Đối soát**
   - Yêu cầu môi trường & giải thích chi tiết từng biến trong `.env.example`.
   - Cách tạo ví Treasury trên Preprod và nhận tADA từ Cardano Faucet.
   - Cấu hình nhà cung cấp chỉ mục (Blockfrost API Key hoặc tự động dự phòng Koios REST API v1).
   - Checklist chuyển đổi từ **Preprod Testnet → Mainnet**.
   - Cách chạy script đối soát [`scripts/wallet/reconcile.mjs`](../../scripts/wallet/reconcile.mjs) (`npm run wallet:reconcile`) và quy trình xử lý đơn trả thiếu / hết hạn.
4. **[`HUONG_DAN_NGUOI_CHOI.md`](./HUONG_DAN_NGUOI_CHOI.md) — Hướng dẫn Người chơi**
   - Cài đặt ví Eternl, chọn mạng Preprod / Mainnet, kết nối và ký thông điệp đăng nhập.
   - Mua MC Coin bằng ADA (`1 ADA = 1.000 MC`, gói tối thiểu `2 ADA`, phí mạng `~0.2 ADA`, kiểm tra giao dịch trên Cardanoscan).
   - Sử dụng MC Coin trong chùa: Cửa Hàng Cổ Phục & Lễ Vật, Thẻ Bài Di Sản 3D, Bói Quẻ 6 Môn, Hòm Công Đức.
   - Câu hỏi thường gặp (FAQ) & Lưu ý pháp lý/kinh tế.
5. **[`TEST_REPORT.md`](./TEST_REPORT.md) — Báo cáo Kiểm thử & Nghiệm thu (Bước 2 → Bước 6)**
- Kết quả chạy tự động `test-auth.mjs` (`19/19 PASS`), `test-deposit.mjs` (`19/19 PASS`), `test-spend.mjs` (`14/14 PASS`).
- Bước 6: bộ test Hybrid Hydra L2 `test-hydra-l2.mjs` (`11/11 PASS`) và kết quả xác minh trên hydra-node thật.
   - Bằng chứng nghiệm thu giao dịch thật trên mạng **Cardano Preprod** (`100 ADA -> +100.000 MC`, tiêu `-300 MC` gieo quẻ, đối soát `reconcile.mjs` khớp 100%).
6. **[`CHANGELOG.md`](./CHANGELOG.md) — Nhật ký Thay đổi theo từng bước (Bước 1 → Bước 6)**
7. **[`CO_CHE_MC_VA_HYDRA_L2.md`](./CO_CHE_MC_VA_HYDRA_L2.md) — Giải thích Cơ chế MC Coin, Kế hoạch Tọa Thiền Nhận MC, Phân tích Đưa MC lên Cardano Hydra L2 và Thiết kế Hybrid Hydra L2 ĐÃ TRIỂN KHAI (Phần 4: khóa server, Fuel Pool, State UTxO, trạng thái giao dịch, giao diện `HydraBadge`, cấu hình & kiểm thử)**
   - Giải thích chi tiết luồng Mua MC (L1) & Tiêu MC (Off-chain).
   - Thiết kế tính năng **Tọa Thiền 432Hz nhận thưởng MC** (có chống gian lận & giới hạn trần mỗi ngày).
   - Phân tích tác dụng, lợi ích và tác động kỹ thuật khi đưa MC Coin thành tài sản giao dịch thực trên **Cardano Hydra Head (L2)**.

---

## Quy tắc Kinh tế Cốt lõi

- **Tỷ lệ quy đổi cố định:** `1 ADA = 1.000 MC coin` (`1 MC = 1.000 lovelace`). Toàn bộ tính toán ở server và CSDL dùng **số nguyên** (`lovelace` và `MC`), tuyệt đối không dùng số thực (`float`) để tránh sai số làm tròn.
- **Bản chất của MC Coin:** MC là **điểm trong game (off-chain)** lưu tại máy chủ, chỉ dùng để mua vật phẩm Cửa Hàng/Di Sản, gieo quẻ/xem bói và cúng dường Hòm Công Đức trong Vạn Cảnh Thiền Tự.
- **Một chiều (One-way):** MC Coin **không phải tiền mã hóa** và **không đổi ngược ra ADA**. Hòm công đức trong chùa là hoàn toàn tự nguyện.
