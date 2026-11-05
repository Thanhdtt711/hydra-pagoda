# Vạn Cảnh Thiền Tự (`hydra-pagoda`)

Không gian hành hương & thiền định 3D đa người chơi (Nuxt 3 + Vue 3 + Three.js + Pinia + Nitro WebSocket), tích hợp đăng nhập ví Cardano **Eternl (CIP-30 / CIP-8)**, nạp **MC Coin** bằng ADA trên chuỗi Cardano L1 (`@hydra-sdk/cardano-wasm` & `@hydra-sdk/core`), và sổ cái tiêu dùng MC nguyên tử phía máy chủ.

---

## Khởi chạy Nhanh

```powershell
# 1. Cài đặt phụ thuộc
pnpm install

# 2. Tạo file cấu hình môi trường
Copy-Item .env.example .env

# 3. Chạy máy chủ phát triển (http://127.0.0.1:3012)
npm.cmd run dev

# 4. Biên dịch bản Production
npm.cmd run build
```

---

## Tài liệu Ví Cardano Eternl & Kinh tế MC Coin (`docs/wallet/`)

Toàn bộ tài liệu kỹ thuật, bảo mật, vận hành và hướng dẫn người chơi cho tính năng **Đăng nhập ví Eternl & Mua/Tiêu MC Coin** được đặt tại thư mục **[`docs/wallet/README.md`](./docs/wallet/README.md)**:

- **[`docs/wallet/README.md`](./docs/wallet/README.md)** — Tổng quan & Mục lục tài liệu Ví Cardano + MC Coin.
- **[`docs/wallet/REUSE_REPORT.md`](./docs/wallet/REUSE_REPORT.md)** — Báo cáo điều tra hiện trạng & tái sử dụng từ `hydra-graveyard` (Bước 1).
- **[`docs/wallet/KIEN_TRUC.md`](./docs/wallet/KIEN_TRUC.md)** — Kiến trúc hệ thống, 3 sơ đồ luồng Mermaid (Đăng nhập, Mua MC, Tiêu MC), lược đồ CSDL SQLite (11 bảng), danh mục API và mô hình mối đe dọa (Threat Model).
- **[`docs/wallet/HUONG_DAN_CAI_DAT.md`](./docs/wallet/HUONG_DAN_CAI_DAT.md)** — Hướng dẫn cài đặt `.env`, tạo ví Treasury Preprod & lấy tADA faucet, cấu hình Blockfrost/Koios, checklist chuyển sang Mainnet và chạy script đối soát.
- **[`docs/wallet/HUONG_DAN_NGUOI_CHOI.md`](./docs/wallet/HUONG_DAN_NGUOI_CHOI.md)** — Hướng dẫn người chơi cài đặt Eternl, kết nối ví, mua MC bằng ADA và tiêu MC trong chùa.
- **[`docs/wallet/TEST_REPORT.md`](./docs/wallet/TEST_REPORT.md)** — Báo cáo kết quả kiểm thử tự động (`52/52 PASS`) và nghiệm thu thực tế trên mạng Cardano Preprod.
- **[`docs/wallet/CHANGELOG.md`](./docs/wallet/CHANGELOG.md)** — Nhật ký thay đổi chi tiết qua 5 bước triển khai.

### Các Lệnh Kiểm thử & Đối soát Sổ cái

```powershell
# Đối soát tổng ADA nhận tại Treasury với tổng MC đã phát & số dư từng tài khoản
npm.cmd run wallet:reconcile

# Chạy bộ kiểm thử tự động Bước 2 (Đăng nhập CIP-8 & WebSocket - 19 test cases)
npm.cmd run wallet:test:auth

# Chạy bộ kiểm thử tự động Bước 3 (Mua MC bằng ADA với @hydra-sdk - 19 test cases)
npm.cmd run wallet:test:deposit

# Chạy bộ kiểm thử tự động Bước 4 (Tiêu MC nguyên tử & Chống Race Condition - 14 test cases)
npm.cmd run wallet:test:spend
```

