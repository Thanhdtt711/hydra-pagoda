# Hướng Dẫn Vận Hành Hydra L2 & Hexcore Trên Vạn Cảnh Chùa (Hydra Pagoda)

Tài liệu này mô tả chi tiết kiến trúc, nguyên lý hoạt động và từng bước thiết lập, nạp quỹ mồi (Fuel UTxO), kiểm tra trạng thái cũng như xử lý sự cố khi kết nối **Hydra Pagoda** với **Cardano Hydra Head L2** (thông qua hạ tầng **Hexcore** hoặc node tự vận hành).

---

## 1. Tổng Quan Kiến Trúc Hydra L2 (Hybrid Notary Mode)

Dự án **Hydra Pagoda** sử dụng mô hình **Sổ cái kép (Hybrid Ledger)**:

1. **Lớp Cơ sở dữ liệu (PostgreSQL Supabase / SQLite):** Lưu trữ tức thời mọi biến động số dư Merit Coins (`mc_balance`), lịch sử giao dịch (`mc_ledger`), quẻ bói (`fortune_records`), chuỗi tu tập và phần thưởng.
2. **Lớp Chứng thực Hydra L2 (`hydra-node` trên Hexcore):** Khi `HYDRA_L2_ENABLED=true` và Head đang ở trạng thái **`Open`** kèm quỹ mồi (**Fuel UTxO**), mỗi bút toán trong `mc_ledger` sẽ được đóng gói thành một giao dịch **Cardano Conway-era (`NewTx`)** thực thụ với:
   - **State UTxO + Inline Datum (CIP-68 style):** Chứa `accountId`, `mcBalance`, `lastLedgerId`, `updatedAt`.
   - **Metadata nhãn `8182`:** Đính kèm chi tiết bút toán (`ledgerId`, `type`, `deltaMc`, `balanceAfter`, `refType`, `refId`).
   - **Chứng thực Snapshot (`SnapshotConfirmed`):** Giao dịch được các node trong Hydra Head ký xác nhận tức thì với phí gas bằng `0`, cập nhật `hydra_status = 'snapshot_confirmed'`, `hydra_tx_id`, và `hydra_snapshot_no` vào bảng `mc_ledger`.

### 12 Luồng Giao Dịch Trong Game Được Chứng Thực Trên Hydra L2
Khi Hydra L2 hoạt động đầy đủ, tất cả 12 luồng giao dịch MC trong game đều hiển thị huy hiệu xanh ngọc **`Hydra L2 · Snapshot #...`**:
1. **Xin Quẻ Cầu An (6 môn đơn):** `POST /api/mc/fortune/draw`
2. **Chiêm Tinh Tơ Duyên Cặp Đôi:** `POST /api/mc/fortune/draw-couple`
3. **Gieo Quẻ Tức Thời:** `POST /api/mc/spend-fortune`
4. **Hòm Công Đức (Merit Box):** `POST /api/mc/merit-box`
5. **Cửa Hàng Pháp Khí & Vật Phẩm:** `POST /api/shop/buy`
6. **Thỉnh Thẻ Bài Di Sản & Mở Gói Gacha:** `POST /api/cards/buy`, `POST /api/cards/open-pack`
7. **Hội Thiền 432Hz (Meditate-to-Earn):** `POST /api/mc/meditation/claim`
8. **Dâng Hương Tam Bảo:** `POST /api/mc/incense/offer`
9. **Thưởng Thức Hầu Đồng / Tán Lộc:** `POST /api/mc/hau-dong/donate`
10. **Hành Hương Tháp Cổ (Parkour):** `POST /api/mc/parkour/start`
11. **Kỳ Đài Dưới Bóng Cây Đa (5 trò cờ dân gian):** `POST /api/mc/games/win`
12. **Nạp ADA -> MC trên Cardano L1:** `POST /api/mc/verify-deposit`

---

## 2. Cấu Hình Biến Môi Trường (`.env`)

Mở file `.env` tại thư mục gốc của dự án và cấu hình các biến sau:

```dotenv
# 1. Mạng Cardano ('preprod' hoặc 'mainnet')
NUXT_PUBLIC_CARDANO_NETWORK=preprod

# 2. Blockfrost API Key (Dùng để kiểm tra UTxO L1 và gửi giao dịch Commit lên Cardano Preprod)
NUXT_BLOCKFROST_API_KEY=preprodXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NUXT_BLOCKFROST_BASE_URL=https://cardano-preprod.blockfrost.io/api/v0

# 3. Bật chế độ chứng thực Hydra L2
HYDRA_L2_ENABLED=true

# 4. WebSocket URL của Node trên Hexcore (Lấy tại tab "Kết nối" -> "URL WebSocket" trên Hexcore)
HYDRA_NODE_WS_URL=wss://vtech.hexcore.io.vn/api/heads/<HEAD_ID>/nodes/0/socket?X-Api-Key=<HEXCORE_TOKEN>

# 5. Khóa bí mật 32-byte (64 ký tự hex) dùng để dẫn xuất ví Fuel L1/L2 và khóa phiên (Session Key)
# LƯU Ý QUAN TRỌNG: Giữ cố định chuỗi này để địa chỉ ví Fuel không bị thay đổi giữa các lần chạy!
NUXT_HYDRA_SESSION_SECRET=5de5b2b4cb6bd276b70355c2ef5371a3194705bbbcd294262b02ee061c39ed40

# 6. Thông số vận hành UTxO trong Head
NUXT_HYDRA_STATE_LOVELACE=2000000
NUXT_HYDRA_FUEL_TARGET=10
NUXT_HYDRA_SUBMIT_TIMEOUT_MS=8000
```

> **Lưu ý về địa chỉ Fuel (`fuelAddress`):** Từ `NUXT_HYDRA_SESSION_SECRET`, hệ thống dùng thuật toán `HMAC-SHA256("hydra-pagoda:l2-fuel:v1")` để tạo ra một cặp khóa Ed25519 cố định và một địa chỉ ví Cardano Enterprise trên mạng Preprod (ví dụ: `addr_test1vp05c04jd9hcnvynjsjqrlt5t3d5krxysc2ucvtwlqsh0csrwqk29`). Toàn bộ UTxO trong Hydra Head được quản lý và ký tự động bởi khóa Fuel này.

---

## 3. Quy Trình 4 Bước Đưa Hydra Head Lên Trạng Thái Sẵn Sàng

Để Hydra Head có thể ký giao dịch L2, Head không chỉ cần ở trạng thái **`Open`** mà còn phải **có sẵn UTxO mồi (Fuel UTxO)** thuộc về địa chỉ `fuelAddress` ở bên trong Head.

### Bước 1: Tạo Head & Lấy Access Token Trên Hexcore
1. Đăng nhập vào bảng điều khiển **Hexcore** (`https://vtech.hexcore.io.vn`).
2. Tạo một Head mới (hoặc chọn Head đang có, ví dụ `Pagoda_v2` - `hexcore-h9-n0`).
3. Bấm vào node `hexcore-h9-n0` -> chuyển sang tab **Kết nối (Connect)**.
4. Tại mục **1. Access token**, đặt tên token và bấm **`+ Tạo token`**.
5. Sao chép đường dẫn tại mục **2. URL WebSocket** có dạng:
   ```text
   wss://vtech.hexcore.io.vn/api/heads/9/nodes/0/socket?X-Api-Key=hxn_...
   ```
6. Dán đường dẫn này vào biến `HYDRA_NODE_WS_URL` trong file `.env`.

### Bước 2: Tìm Địa Chỉ Ví Fuel & Chuyển tADA Trên Cardano Preprod L1
1. Chạy lệnh kiểm tra và commit tự động lần đầu:
   ```bash
   npm run hydra:commit
   ```
2. Terminal sẽ in ra địa chỉ Fuel L1/L2 của server:
   ```text
   🔑 Địa chỉ Fuel L1/L2 (preprod): addr_test1vp05c04jd9hcnvynjsjqrlt5t3d5krxysc2ucvtwlqsh0csrwqk29
   ```
3. Nếu địa chỉ này chưa có tADA trên mạng Cardano Preprod L1, bạn mở ví **Eternl** (hoặc Lace/Nami đang chọn mạng **Preprod Testnet**) và chuyển khoảng **50 – 100 tADA** tới địa chỉ `addr_test1...` ở trên.
4. Chờ khoảng **20 – 30 giây** để giao dịch chuyển tADA được xác nhận trên Cardano Preprod L1.

### Bước 3: Chạy Lệnh Commit UTxO Từ L1 Vào Hydra Head
Sau khi ví Fuel đã có tADA trên L1, chạy lại lệnh:

```bash
npm run hydra:commit
```

Script `scripts/hydra-commit-fuel.mjs` sẽ **tự động thực hiện toàn bộ quy trình**:
1. **Kiểm tra trạng thái Head qua WebSocket:**
   - Nếu Head đang `Idle` hoặc `Final`: Tự động gửi lệnh `{ "tag": "Init" }` và chờ Head chuyển sang `Initializing` / `Open`.
   - Nếu Head đang `FanoutPossible`: Tự động gửi lệnh `{ "tag": "Fanout" }` -> chờ `HeadIsFinalized` -> tự động gửi tiếp `{ "tag": "Init" }` để mở Head mới.
   - Nếu Head đang `Initializing` hoặc `Open` (hỗ trợ Incremental Commit/Deposit của Hydra v2): Chuyển ngay sang bước gọi HTTP Commit.
2. **Gọi HTTP `POST .../socket/commit` trên Hexcore:** Đóng gói UTxO tADA lớn nhất của địa chỉ Fuel trên L1 để yêu cầu `hydra-node` soạn thảo giao dịch Commit (`draftTx.cborHex`).
3. **Ký số bằng `@hydra-sdk/cardano-wasm`:** Dùng khóa riêng `fuelSk` ký witness vào `FixedTransaction` (`sign_and_add_vkey_signature`).
4. **Gửi giao dịch lên Cardano Preprod L1:** Đẩy giao dịch CBOR đã ký lên `POST /tx/submit` của Blockfrost.

Khi thành công, terminal sẽ hiển thị:
```text
✔ Tìm thấy UTxO trên L1: e4aab31c7b78decd8aa7f4f22959469009775dbf89f3458537647fe76df3cb6e#0 (100.00 ADA)
✔ Head đang ở trạng thái Open -> Tiến hành gọi POST /commit để nạp UTxO vào Head...
⏳ Đang gọi POST /commit tới Hexcore...
⏳ Đang gửi giao dịch Commit đã ký lên Cardano Preprod L1...

🎉 ĐÃ COMMIT THÀNH CÔNG UTxO (100.00 ADA) VÀO HYDRA HEAD!
🔗 L1 Commit TxHash: 225f0182a312685ef8623979c57146fe8c03289b39919154342bfb5a3204b62f
```

### Bước 4: Chờ Chuỗi Sự Kiện Xác Nhận Trên Hexcore (1 – 3 Phút)
Sau khi giao dịch Commit được gửi lên L1:
- **Trường hợp 1 (Commit khi Head đang `Initializing`):** Sau khoảng 20–40 giây khi L1 xác nhận giao dịch Commit, các node trong Head sẽ tự động gom chữ ký (`CollectCom`) và phát sự kiện **`HeadIsOpen`** kèm theo UTxO 100 ADA bên trong!
- **Trường hợp 2 (Incremental Deposit khi Head đã `Open` sẵn):** `hydra-node` trên Hexcore sẽ lần lượt xử lý 3 sự kiện trên chuỗi L1:
  1. `CommitRecorded` / `DepositRecorded` (L1 ghi nhận giao dịch Deposit).
  2. `CommitApproved` (Head ký xác nhận khoản nạp).
  3. `CommitFinalized` / `DepositFinalized` (Khoản 100 ADA chính thức đi vào Snapshot UTxO của Head).

---

## 4. Cách Kiểm Tra Hệ Thống Đã Chạy Hydra L2 Hay Chưa

Bạn có **3 cách trực quan** để kiểm tra ngay lập tức:

### Cách 1: Kiểm tra qua API `/api/hydra/status`
Mở trình duyệt truy cập: `http://localhost:3012/api/hydra/status`

Khi Hydra L2 đã sẵn sàng 100%, JSON trả về sẽ có:
```json
{
  "enabled": true,
  "connected": true,
  "mode": "hydra_l2",
  "dbEngine": "postgres",
  "headStatus": "Open",
  "latestSnapshotNo": 1,
  "fuelAddress": "addr_test1vp05c04jd9hcnvynjsjqrlt5t3d5krxysc2ucvtwlqsh0csrwqk29",
  "headUtxoCount": 10,
  "fuelUtxoCount": 10,
  "ledger": {
    "fuelPoolSize": 10,
    "inFlight": 0
  }
}
```
- **`headStatus: "Open"`**: Kết nối WebSocket tới Hexcore thông suốt và Head đang mở.
- **`fuelUtxoCount > 0`** (và `fuelPoolSize > 0`): Trong Head đã có UTxO mồi thuộc về địa chỉ Fuel. Ngay ở giao dịch đầu tiên, `hydraQueue.ts` sẽ tự động tách (fan-out) 1 UTxO 100 ADA thành **10 UTxO mồi** (`fuelPoolSize: 10`) để có thể xử lý song song 10 giao dịch L2 cùng lúc mà không cần chờ nhau!

### Cách 2: Quan sát Huy Hiệu (Badge) Trên Giao Diện Game
- Khi thực hiện **Xin Xăm, Bói Quẻ, Tơ Duyên, Công Đức, Mua Vật Phẩm, Thỉnh Thẻ Bài, Thắng Cờ...**:
  - Nếu hiển thị huy hiệu xanh ngọc **`● Hydra L2 · Snapshot #12 · 4ae91c8b...`**: Giao dịch đã được chứng thực trên Hydra Head L2!
  - Nếu hiển thị huy hiệu xanh dương **`● PostgreSQL · Sổ cái Supabase`**: Giao dịch hiện mới được lưu ở cơ sở dữ liệu (do Head chưa Open hoặc `fuelUtxoCount === 0`).

### Cách 3: Quan sát Bảng Ví Cardano & Nạp MC
- Mở ngăn kéo **Ví Cardano & Nạp MC**, dòng trạng thái bên dưới tab `Nạp MC Coin` sẽ hiển thị:
  `CSDL: PostgreSQL (Supabase) · Hydra L2 - Head Open - Snapshot #... - ... tx xác nhận`

---

## 5. Các Đường Dẫn API Đặc Thù Của Hexcore Proxy

Khi làm việc với node trên **Hexcore**, cần lưu ý đường dẫn HTTP REST của Hexcore **luôn nằm dưới hậu tố `/socket/...`** và yêu cầu truyền `X-Api-Key` (qua Header hoặc Query String):

| Chức năng | Phương thức | Đường dẫn trên Hexcore |
| :--- | :--- | :--- |
| **WebSocket (Events & Commands)** | `WSS` | `wss://vtech.hexcore.io.vn/api/heads/<id>/nodes/<n>/socket?X-Api-Key=<TOKEN>` |
| **Trạng thái Head (`/head`)** | `GET` | `https://vtech.hexcore.io.vn/api/heads/<id>/nodes/<n>/socket/head` |
| **Lấy UTxO trong Head (`/snapshot/utxo`)** | `GET` | `https://vtech.hexcore.io.vn/api/heads/<id>/nodes/<n>/socket/snapshot/utxo` |
| **Tham số giao thức (`/protocol-parameters`)** | `GET` | `https://vtech.hexcore.io.vn/api/heads/<id>/nodes/<n>/socket/protocol-parameters` |
| **Tạo giao dịch Commit (`/commit`)** | `POST` | `https://vtech.hexcore.io.vn/api/heads/<id>/nodes/<n>/socket/commit` |

---

## 6. Bảng Chẩn Đoán & Xử Lý Sự Cố Thườngặp (Troubleshooting)

| Mã cảnh báo trong Terminal | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| `hydra_getutxo_timeout` | Node từ xa trên Hexcore không phản hồi lệnh WebSocket `GetUTxO` (đã bỏ trên Hydra v2) hoặc trễ mạng. | Đã được xử lý tự động trong `hydraClient.ts`: Hệ thống đọc trực tiếp `snapshotUtxo` từ bản tin `Greetings`, `HeadIsOpen`, `SnapshotConfirmed` trong `0ms` và đồng bộ dự phòng qua HTTP `/socket/snapshot/utxo`. |
| `l2_no_fuel` | Head đang `Open` nhưng bên trong Head chưa có UTxO nào của địa chỉ `fuelAddress` (`fuelUtxoCount: 0`). | Chạy `npm run hydra:commit` để nạp tADA từ địa chỉ Fuel trên L1 vào Head, sau đó chờ sự kiện `CommitFinalized` (hoặc `HeadIsOpen`). |
| `NodeUnsynced` -> `NodeSynced` trên Hexcore Console | `cardano-node` bên dưới Hexcore vừa đồng bộ kịp block mới trên mạng Preprod. | Hoàn toàn bình thường. Khi thấy `NodeSynced`, node đã bắt kịp tip của chuỗi L1. |
| `PostTxOnChainFailed` (`NotEnoughFuel` trên Hexcore) | Ví điều khiển nội bộ của `hydra-node` trên Hexcore hết tADA làm phí gas L1 để đóng/mở Head. | Kiểm tra mục **Tài nguyên** của node trên Hexcore hoặc tạo một Head mới trên Hexcore để được cấp ví node mới có sẵn tADA. |
| `HeadStatus: Closed` | Head vừa nhận lệnh `Close` và đang trong thời gian chờ tranh chấp (`Contestation Period`). | Chờ hết thời gian `contestationDeadline` để Head tự chuyển sang `FanoutPossible`, sau đó chạy `npm run hydra:commit` (script sẽ tự gửi `Fanout` -> `Init` -> `Commit`). Nếu không muốn chờ, tạo một Head mới trên Hexcore và cập nhật `HYDRA_NODE_WS_URL`. |
