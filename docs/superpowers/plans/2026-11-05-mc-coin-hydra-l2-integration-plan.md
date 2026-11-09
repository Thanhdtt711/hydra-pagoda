# Kế hoạch Triển khai: Tích hợp Hybrid Cardano Hydra L2 cho MC Coin

> **Trạng thái**: Sẵn sàng triển khai (Sau khi hoàn tất Bói Quẻ 6 Môn Cầu An & Tọa Thiền Nhận MC)
> **Mục tiêu**: Đưa vòng đời giao dịch **MC Coin (Nạp MC, Thưởng Tọa Thiền, Tiêu MC Bói Quẻ / Cửa Hàng / Công Đức)** lên **Cardano Hydra Layer 2 (`hydra-node`)** theo kiến trúc **Hybrid Server + Hydra L2 State Channel**, giúp tạo lưu lượng giao dịch UTxO thực tế (`NewTx` → `TxValid` → `SnapshotConfirmed`) với tốc độ `< 200ms`, phí gas `0 lovelace`, và không cần bật popup Eternl mỗi lần tiêu MC nhờ **Session Ephemeral Key**.

---

## 1. Kiến trúc Hybrid: SQLite Sổ Cái + Hydra L2 State Channel

Hệ thống hoạt động theo 2 chế độ tự động chuyển đổi (Graceful Fallback):

1. **Khi `HYDRA_L2_ENABLED=true` và `hydra-node` đang mở (`HeadStatus = Open`)**:
   - Mọi thao tác cộng/trừ MC (`deposit_ada`, `meditation_reward`, `fortune_divination`, `shop_purchase`, `merit_donation`) đều:
     1. Ghi nhận nguyên tử vào SQLite (`mc_ledger`) để phản hồi UI tức thì.
     2. Xây dựng giao dịch Cardano L2 (`@hydra-sdk/cardano-wasm`) đính kèm **Inline Datum (CIP-68 / Credit State)** + **CIP-20 Metadata (`label 674`)**, ký tự động bằng **Khóa Phiên L2 (`Session Key`)** và phát qua WebSocket tới `hydra-node` (`NewTx`).
     3. Lắng nghe sự kiện `TxValid` và `SnapshotConfirmed` từ `hydra-node` để cập nhật `hydra_tx_hash` và `hydra_snapshot_no` vào bảng `mc_ledger`.
2. **Khi chạy môi trường Local không bật `hydra-node` (`HYDRA_L2_ENABLED=false` hoặc mất kết nối WS)**:
   - Tự động fallback về sổ cái SQLite và đánh dấu `l2_status = 'local_ledger'`, đảm bảo game không bao giờ bị treo hay gián đoạn trải nghiệm.

---

## 2. Mô hình UTxO & Session Key trên Hydra L2

### 2.1. Session Ephemeral Key (Khóa Phiên L2 Không Cần Popup Ví)
- Khi người chơi đăng nhập ví Eternl qua chuẩn **CIP-8 (`POST /api/auth/verify`)**:
  - Máy chủ dẫn xuất hoặc khởi tạo một cặp khóa Ed25519 định danh phiên L2 (`l2_session_vkey`, `l2_address`) gắn với `account_id` trong bảng `accounts`.
  - Chữ ký CIP-8 lúc đăng nhập đóng vai trò ủy quyền hợp lệ từ ví L1 (`addr_test1...`) sang khóa phiên L2.
- Nhờ đó, khi người chơi bấm *"Xác nhận (-50 MC)"* để xem quẻ, giao dịch trên Hydra Head được ký tự động ở tầng L2 chỉ trong `~5ms` mà **không làm bật cửa sổ popup Eternl**.

### 2.2. Quản lý Tranh chấp UTxO (Sequential Tx Queue & Fuel Pool)
- Để tránh lỗi `BadInputsUTxO` khi nhiều hành động diễn ra liên tiếp:
  - Tạo module `server/utils/hydra/hydraQueue.ts` duy trì hàng đợi tuần tự theo từng tài khoản và bể UTxO mồi (`Fuel Pool` gồm 10–20 UTxO nhỏ trong Hydra Head).
  - Mỗi giao dịch chỉ mất `50ms – 150ms` để đạt `TxValid` trên Hydra Head.

---

## 3. Cập nhật Lược đồ Cơ sở Dữ liệu (`server/db/migrations.ts`)

Bổ sung các cột theo dõi bằng chứng Hydra L2 vào `mc_ledger`:

```sql
ALTER TABLE mc_ledger ADD COLUMN hydra_tx_hash TEXT;
ALTER TABLE mc_ledger ADD COLUMN hydra_snapshot_no INTEGER;
ALTER TABLE mc_ledger ADD COLUMN hydra_status TEXT DEFAULT 'offchain'; -- 'offchain' | 'submitted' | 'valid' | 'snapshot_confirmed'
```

---

## 4. Các Module Cần Xây dựng

1. **`server/utils/hydra/hydraClient.ts`**:
   - Quản lý kết nối WebSocket bền vững tới `HYDRA_NODE_WS_URL` (mặc định `ws://127.0.0.1:4001`).
   - Theo dõi trạng thái Head (`Idle` / `Initializing` / `Open` / `Closed` / `FanoutPossible`).
   - Lắng nghe `GetUTxO`, `NewTx`, `TxValid`, `TxInvalid`, `SnapshotConfirmed`.
2. **`server/utils/hydra/l2TxBuilder.ts`**:
   - Dùng `@hydra-sdk/cardano-wasm` để đóng gói giao dịch L2 với `fee = 0 lovelace`.
   - Đính kèm metadata chuẩn CIP-20 (`674`):
     ```json
     {
       "674": {
         "msg": [
           "Van Canh Thien Tu - Hydra L2 MC Ledger",
           "Action: fortune_divination (-50 MC)",
           "Account: addr_test1...",
           "Receipt: mc_fortune_8f92a1..."
         ]
       }
     }
     ```
3. **`server/api/hydra/status.get.ts`**:
   - Trả về trạng thái kết nối Hydra Head (`headStatus`, `latestSnapshotNo`, `totalL2Txs`, `avgConfirmMs`) để hiển thị trên HUD và trong modal Ví.
4. **Cập nhật UI (`components/SanctuaryDrawer.vue` & `components/WalletModal.vue`)**:
   - Hiển thị huy hiệu **`⚡ Hydra L2 Verified · Snapshot #142 · Tx: 9a4f...`** ngay bên dưới kết quả quẻ bói và biên nhận cúng dường khi giao dịch đã được xác nhận trên Hydra Head.

---

## 5. Kế hoạch Kiểm thử (`scripts/wallet/test-hydra-l2.mjs`)

1. **Chế độ Mock Hydra Node (`scripts/hydra-mock-server.mjs`)**:
   - Giả lập WebSocket `hydra-node` phản hồi `Greetings`, `GetUTxO`, `TxValid`, `SnapshotConfirmed` để chạy kiểm thử tự động 100% mà không phụ thuộc Docker bên ngoài.
2. **Kiểm thử Luồng End-to-End**:
   - Nạp MC → Tọa thiền nhận `+30 MC` → Gieo quẻ `-50 MC` → Kiểm tra `mc_ledger` có đầy đủ `hydra_tx_hash` và `hydra_snapshot_no`.
3. **Kiểm thử Graceful Fallback**:
   - Ngắt kết nối `hydra-node` giữa chừng → Giao dịch tiêu MC vẫn thành công qua SQLite (`hydra_status = 'offchain'`), không làm lỗi thao tác của người chơi.

