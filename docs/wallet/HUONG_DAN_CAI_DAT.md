# Hướng dẫn Cài đặt, Vận hành & Đối soát (`HUONG_DAN_CAI_DAT.md`)

Tài liệu dành cho lập trình viên và quản trị viên hệ thống khi triển khai, cấu hình, chuyển đổi mạng Preprod ↔ Mainnet và vận hành đối soát cho **Vạn Cảnh Thiền Tự (`hydra-pagoda`)**.

---

## 1. Yêu cầu Môi trường

- **Node.js**: `>= 22.5.0` (khuyến nghị **Node.js v22 LTS** hoặc **Node.js v24** để có sẵn module tích hợp `node:sqlite`).
- **Trình quản lý gói**: `pnpm` hoặc `npm`.
- **Trình duyệt kiểm thử**: Chrome / Brave / Edge có cài tiện ích mở rộng **Eternl Wallet**.

---

## 2. Cấu hình Biến Môi trường (`.env`)

Sao chép file mẫu `.env.example` sang `.env`:

```powershell
Copy-Item .env.example .env
```

Giải thích chi tiết các biến trong [`.env.example`](../../.env.example):

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `NUXT_PUBLIC_CARDANO_NETWORK` | `preprod` | Mạng Cardano đang chạy: `preprod` (thử nghiệm, hiện nhãn `TESTNET` trên UI) hoặc `mainnet` (chạy thật). |
| `NUXT_DB_PATH` | `./.data/pagoda.sqlite` | Đường dẫn file CSDL SQLite (chế độ WAL). Tự động tạo thư mục và chạy migration khi khởi động. |
| `NUXT_SESSION_TTL_HOURS` | `168` | Thời hạn phiên đăng nhập cookie `httpOnly` (mặc định 168 giờ = 7 ngày). |
| `NUXT_TRUST_PROXY` | `false` | Chỉ bật `true` khi chạy sau reverse proxy tin cậy (Nginx/Cloudflare) để lấy IP thật cho `rateLimit`. |
| `NUXT_TREASURY_ADDRESS` | *(Bắt buộc khi mua MC)* | Địa chỉ ví nhận ADA của chùa (`addr_test1...` trên Preprod hoặc `addr1...` trên Mainnet). **Chỉ cấu hình ở server, không có khóa bí mật nào trong code.** |
| `NUXT_BLOCKFROST_API_KEY` | *(Tùy chọn)* | Project ID của Blockfrost (`preprod...` hoặc `mainnet...`). **Nếu để trống**, server tự động chuyển sang dùng **Koios Public REST API v1** (`https://preprod.koios.rest/api/v1` hoặc `https://api.koios.rest/api/v1`). |
| `NUXT_BLOCKFROST_BASE_URL` | *(Tự suy theo mạng)* | Ghi đè URL chỉ mục khi dùng node tự vận hành hoặc mock server kiểm thử. |
| `NUXT_CONFIRMATIONS_REQUIRED` | `0` *(Tự chọn)* | Số xác nhận khối tối thiểu trước khi cộng MC. Để `0` sẽ tự dùng `1` trên `preprod` và `3` trên `mainnet`. |
| `NUXT_ORDER_TTL_MINUTES` | `30` | Thời hạn của một đơn mua MC (phút). |
| `NUXT_ORDER_METADATA_LABEL` | `8181` | Nhãn metadata giao dịch Cardano chứa `{ v: 1, app: "hydra-pagoda", orderId }`. |
| `NUXT_WEBHOOK_SECRET` | *(Tùy chọn)* | Bí mật xác thực webhook từ Blockfrost (`POST /api/shop/webhook/blockfrost`). |

> [!CAUTION]
> **Nguyên tắc Bảo mật Bí mật:**
> - Tuyệt đối **không commit** file `.env` lên Git.
> - Hệ thống chỉ cần **địa chỉ nhận công khai (`NUXT_TREASURY_ADDRESS`)** để nhận ADA. **Không bao giờ** đưa seed phrase hay private key của ví Treasury vào máy chủ hay mã nguồn.

---

## 3. Tạo Ví Treasury trên Preprod & Lấy tADA từ Cardano Faucet

1. Mở tiện ích **Eternl Wallet** trên trình duyệt → Chuyển công tắc mạng ở góc dưới bên trái sang **Preprod Testnet**.
2. Tạo một ví mới dành riêng làm **Ví Treasury của Chùa** (lưu giữ seed phrase an toàn bên ngoài máy chủ).
3. Vào mục **Receive (Nhận)** → Sao chép địa chỉ `addr_test1...` và điền vào `NUXT_TREASURY_ADDRESS` trong file `.env`.
4. Để lấy **tADA (Test ADA)** cho ví người chơi thử nghiệm:
   - Truy cập Cardano Testnet Faucet chính thức: https://docs.cardano.org/cardano-testnets/tools/faucet
   - Chọn mạng **Preprod Testnet**, hành động **Receive test ADA**, dán địa chỉ `addr_test1...` của ví người chơi và bấm **Request funds**.

---

## 4. Khởi chạy Dự án & Chạy Kiểm thử Tự động

### 4.1. Chạy môi trường phát triển (Dev Server)
```powershell
npm.cmd run dev
```
- Mở trình duyệt tại: `http://127.0.0.1:3012`
- Khi khởi động lần đầu, `server/utils/wallet/db.ts` sẽ tự động tạo `.data/pagoda.sqlite` và thực thi toàn bộ 3 bản migration trong `server/db/migrations.ts`.

### 4.2. Biên dịch Production & Chạy Bộ Kiểm thử Tự động
```powershell
# 1. Biên dịch Nuxt + Nitro
npm.cmd run build

# 2. Chạy kiểm thử Bước 2 (Đăng nhập CIP-8 & WebSocket): 19 test cases
npm.cmd run wallet:test:auth

# 3. Chạy kiểm thử Bước 3 (Mua MC bằng ADA với @hydra-sdk): 19 test cases
npm.cmd run wallet:test:deposit

# 4. Chạy kiểm thử Bước 4 (Tiêu MC nguyên tử & Chống Race Condition): 14 test cases
npm.cmd run wallet:test:spend

# 5. Chạy kiểm thử Bước 6 (Hydra L2 với hydra-node giả lập): 11 test cases
npm.cmd run wallet:test:hydra

# (Tùy chọn) Chạy hydra-node giả lập độc lập khi dev (đặt HYDRA_L2_ENABLED=true, HYDRA_NODE_WS_URL=ws://127.0.0.1:4001)
npm.cmd run hydra:mock -- --port 4001
```

### 4.3. Chạy hydra-node THẬT ở chế độ Offline bằng Docker (không cần cardano-node)

Chế độ offline của hydra-node mở sẵn một Head (`Open`) với UTxO ban đầu do ta cấp (1000 ADA tại địa chỉ Fuel), phí giao dịch = 0. Phù hợp để dev/test lớp Hydra L2 với node thật.

```powershell
# 1. Sinh .hydra-offline/ (khóa Hydra, utxo.json, protocol-parameters.json) và ghi HYDRA_L2_ENABLED / NUXT_HYDRA_SESSION_SECRET vào .env
npm.cmd run hydra:prepare

# 2. Khởi động hydra-node (WebSocket API tại ws://127.0.0.1:4001)
npm.cmd run hydra:up

# 3. Chạy dev server / build+start rồi kiểm tra: GET /api/hydra/status => connected=true, headStatus="Open"
npm.cmd run dev

# Xem log / dừng (down = reset Head về trạng thái ban đầu)
npm.cmd run hydra:logs
npm.cmd run hydra:down
```

Lưu ý:
- **Cổng 4001 đang bận** (ví dụ `hydra:mock`): chạy `$env:HYDRA_API_PORT='4002'; npm.cmd run hydra:up` và đặt `HYDRA_NODE_WS_URL=ws://127.0.0.1:4002` trong `.env`.
- **Phiên bản image:** dùng `ghcr.io/cardano-scaling/hydra-node:0.22.4`. Các bản 1.x/2.x biên dịch cần AVX2; trên CPU cũ (vd: Xeon E5 đời Sandy/Ivy Bridge) container thoát ngay với exit code `132` (SIGILL) và lặp vô hạn log `NodeOptions`/`LoadingTrustedSetup`. Nếu CPU có AVX2, có thể đổi sang bản mới hơn ở `docker-compose.hydra.yml` và `scripts/hydra-prepare.mjs`.
- **`NUXT_HYDRA_SESSION_SECRET` phải khớp với `.hydra-offline/utxo.json`** (địa chỉ Fuel được dẫn xuất từ secret). Nếu đổi secret, chạy lại `hydra:prepare` rồi `hydra:down` + `hydra:up`, và khởi động lại server.
- Thư mục `.hydra-offline/` đã nằm trong `.gitignore` (chứa khóa Hydra).

---

## 5. Checklist Chuyển từ Preprod Testnet sang Mainnet

Trước khi chuyển công tắc sang **Mainnet** phục vụ người chơi thật, bắt buộc kiểm tra từng mục sau:

- [ ] **1. Đổi mạng cấu hình**: Đặt `NUXT_PUBLIC_CARDANO_NETWORK=mainnet` trong `.env`. Kiểm tra giao diện **không** còn hiện nhãn vàng `TESTNET`.
- [ ] **2. Cập nhật địa chỉ Treasury Mainnet**: Tạo ví lạnh / ví phần cứng (Ledger/Trezor qua Eternl) trên Mainnet, lấy địa chỉ `addr1...` và gán vào `NUXT_TREASURY_ADDRESS`. Kiểm tra server từ chối khởi tạo đơn nếu `NUXT_TREASURY_ADDRESS` vẫn là `addr_test1...`.
- [ ] **3. Cấu hình Blockfrost Mainnet API Key**: Tạo project **Cardano Mainnet** trên https://blockfrost.io, điền `NUXT_BLOCKFROST_API_KEY=mainnet...` để có SLA ổn định (Koios vẫn tự động đóng vai trò dự phòng).
- [ ] **4. Số xác nhận khối (`Confirmations`)**: Đặt `NUXT_CONFIRMATIONS_REQUIRED=3` (hoặc để `0` để hệ thống tự áp mức `3` xác nhận trên Mainnet).
- [ ] **5. Sao lưu CSDL định kỳ**: Tạo bản sao lưu mới cho `.data/pagoda.sqlite` (tách biệt hoàn toàn dữ liệu thử nghiệm Preprod với dữ liệu Mainnet) và thiết lập cron backup SQLite hàng ngày.
- [ ] **6. Thử nghiệm giao dịch thật quy mô nhỏ**: Thực hiện 1 giao dịch mua gói tối thiểu `2 ADA` (`2.000 MC`) trên Mainnet, kiểm tra Cardanoscan và chạy `npm.cmd run wallet:reconcile` để xác nhận khớp 100%.

---

## 6. Vận hành Đối soát (`reconcile.mjs`) & Xử lý Đơn Kẹt / Lệch

### 6.1. Chạy Script Đối soát Sổ cái
Chạy lệnh sau bất kỳ lúc nào để đối soát tổng lovelace nhận ở Treasury với tổng MC đã phát và số dư từng tài khoản:

```powershell
npm.cmd run wallet:reconcile
```

Script sẽ kiểm tra 4 hạng mục:
1. `SUM(chain_deposits.lovelace WHERE status='credited') / 1000 === SUM(chain_deposits.mc_credited) === SUM(mc_ledger.delta_mc WHERE reason='deposit_ada')`.
2. Thống kê tổng MC nạp và tiêu theo từng loại nghiệp vụ (`deposit_ada`, `shop_purchase`, `fortune_divination`, `merit_donation`).
3. Với mọi tài khoản: `accounts.mc_balance === SUM(mc_ledger.delta_mc)` và `mc_balance >= 0`.
4. Liệt kê toàn bộ bản ghi trong `chain_deposits` có trạng thái `underpaid`, `expired_paid` hoặc `unmatched`.

### 6.2. Cách xử lý các trường hợp đặc biệt
- **Đơn đang chờ xác nhận nhưng người chơi đã tắt trình duyệt**: Tiến trình nền `server/plugins/order-watcher.ts` tự động quét mỗi 15 giây (hoặc ngay khi người chơi mở lại trang) và cộng MC tự động ngay khi giao dịch đạt đủ xác nhận.
- **Đơn hết hạn nhưng người chơi vẫn chuyển tiền (`expired_paid`)** hoặc **chuyển thiếu ADA (`underpaid`)**: Hệ thống ghi nhận đầy đủ `tx_hash` và số `lovelace` thực nhận vào bảng `chain_deposits` (không tự động cộng MC) và in cảnh báo trong `npm.cmd run wallet:reconcile` để quản trị viên kiểm tra trên Cardanoscan và đối soát thủ công.

