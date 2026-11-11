# Kế Hoạch Tích Hợp HydraOne Wallet Bridge Cho Vạn Cảnh Thiền Tự

Tài liệu này mô tả chi tiết kiến trúc, cơ chế hoạt động và lộ trình tích hợp hệ thống ví của HydraOne (`@hydraone-sdk/core`) vào **Vạn Cảnh Thiền Tự** (Hydra Pagoda). Mục tiêu là cho phép người chơi khi trải nghiệm game thông qua iframe của HydraOne Portal không phải kết nối ví lần thứ hai, tự động nhận diện địa chỉ ví và số dư từ Header của HydraOne, đồng thời thực hiện các giao dịch nạp Merit Coin (MC) liền mạch.

---

## 1. Tổng Quan & Bối Cảnh

Hiện tại, Vạn Cảnh Thiền Tự đã được triển khai lên Render tại địa chỉ `https://hydra-pagoda.onrender.com` và được nhúng vào hệ sinh thái HydraOne thông qua `apps/portal` với thẻ iframe.

Trong hệ thống HydraOne, thanh Header trang cha đã tích hợp sẵn chức năng kết nối ví Cardano (Lace, Eternl, Vespr, Nami). Việc bắt người chơi tiếp tục bấm kết nối ví một lần nữa bên trong iframe sẽ gây trải nghiệm người dùng trùng lặp và thiếu tự nhiên.

Vì vậy, hệ thống cần hỗ trợ **Kiến Trúc Ví Chế Độ Kép (Dual-Mode Wallet Architecture)**:
1. **Chế độ HydraOne Iframe (Host Bridge):** Game phát hiện đang chạy trong iframe của HydraOne, tự động lắng nghe và đồng bộ dữ liệu ví từ Header trang cha qua giao thức IPC `window.postMessage`, ủy quyền ký giao dịch và nạp MC cho ví của HydraOne.
2. **Chế độ Độc lập (Standalone CIP-30):** Khi người chơi truy cập trực tiếp bằng trình duyệt, game vẫn giữ nguyên modal kết nối ví CIP-30 trực tiếp như thiết kế ban đầu.

---

## 2. Kiến Trúc Hệ Thống & Cơ Chế Hoạt Động

### 2.1. Sơ Đồ Khối Tương Tác

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HydraOne Host Portal                            │
│  [Header: Nút Kết Nối Ví (Lace / Eternl / Vespr) -> Địa chỉ + Balance] │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ window.postMessage (Bridge IPC)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Iframe: Vạn Cảnh Thiền Tự (hydra-pagoda)                  │
│                                                                        │
│   useWalletBridgeClient({ hostOrigin, autoConnect: true })             │
│       │                                                                │
│       ├──> 1. Tự động nhận address & balanceLovelace từ Header         │
│       ├──> 2. Đăng nhập JWT: bridge.signData(nonce) -> Tạo Account MC  │
│       └──> 3. Nạp MC: bridge.signTx() + bridge.submitTx()              │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Giao Thức Trao Đổi Thông Điệp (PostMessage IPC)

Hệ thống sử dụng `@hydraone-sdk/core` để quản lý bắt tay (handshake) và truyền thông điệp hai chiều an toàn:
- **Handshake ban đầu:** Khi iframe tải xong, client gửi sự kiện `CLIENT_READY` lên `window.parent`.
- **Cập nhật trạng thái ví:** Khi người chơi kết nối ví, đổi tài khoản hoặc ngắt kết nối trên Header của HydraOne, trang cha sẽ bắn sự kiện `WALLET_STATE_CHANGED` vào iframe kèm theo các trường dữ liệu:
  - `address`: Địa chỉ ví Bech32 của người chơi (ví dụ: `addr_test1...`).
  - `balanceADA` / `balanceLovelace`: Số dư ADA L1 khả dụng.
  - `isWalletConnected`: Trạng thái kết nối ví (boolean).
- **Yêu cầu ký dữ liệu (`signData`):** Dùng để ký chuỗi nonce xác thực phiên đăng nhập (JWT).
- **Yêu cầu ký giao dịch (`signTx`):** Chuyển giao dịch CBOR lên cho ví trang cha ký và nhận lại chữ ký.
- **Yêu cầu gửi giao dịch (`submitTx`):** Gửi giao dịch đã ký lên mạng blockchain Cardano thông qua node của HydraOne/trình duyệt cha.

---

## 3. Quy Trình Nghiệp Vụ Chi Tiết

### 3.1. Luồng Tự Động Đăng Nhập & Khởi Tạo Phiên (Auto Auth Flow)

1. Khi người dùng mở game trong HydraOne Portal, composable `useHydraOneWallet` phát hiện môi trường `window.parent !== window`.
2. Composable lắng nghe trạng thái từ `useWalletBridgeClient`. Khi `isWalletConnected === true` và nhận được `address`:
3. Client gửi request tới `/api/auth/nonce?address={address}` để nhận chuỗi nonce ngẫu nhiên từ server.
4. Client gọi hàm `bridge.signData(address, hexNonce)`. Header HydraOne sẽ kích hoạt ví để người chơi ký thông điệp xác thực.
5. Client gửi chữ ký và key lên `/api/auth/verify`. Server kiểm tra chữ ký COSE/CIP-8 hợp lệ, sinh JWT session token và trả về tài khoản người chơi.
6. Store Pinia (`stores/wallet.ts`) lưu token, tải số dư Merit Coin (MC) và hồ sơ người chơi. Trạng thái hiển thị trên Top Bar chuyển sang đã đăng nhập.

### 3.2. Luồng Nạp Merit Coin (MC Deposit Flow)

1. Người chơi bấm nút **`+ Nạp`** trên thanh điều hướng hoặc trong Hòm Công Đức, chọn gói nạp ADA mong muốn (ví dụ: 10 ADA = 100 MC).
2. Client gọi API backend `/api/mc/orders` để tạo mã đơn nạp tiền với trạng thái `pending`.
3. Client gọi API `/api/mc/orders/{orderId}/build` để backend dựng giao dịch Cardano chuyển ADA từ địa chỉ người chơi sang địa chỉ Treasury của chùa, trả về chuỗi unsigned CBOR.
4. **Xử lý ký giao dịch:**
   - Trong chế độ iframe: Game gọi `bridge.signTx(unsignedTxCbor, { mergeWitnesses: true })`. Popup ví của extension trên trình duyệt được kích hoạt bởi trang cha để người chơi xác nhận.
   - Game nhận chuỗi signed CBOR từ bridge và gọi `bridge.submitTx(signedTxCbor)`.
5. Sau khi nhận được mã giao dịch (`txHash`), client cập nhật trạng thái đơn hàng lên server.
6. Dịch vụ watcher của backend (`server/utils/wallet/blockfrost.ts` hoặc Koios) tự động phát hiện giao dịch xác nhận trên Cardano Preprod, ghi sổ cái `mc_ledger` và cộng MC vào số dư tài khoản người chơi.

---

## 4. Kế Hoạch Triển Khai Mã Nguồn (5 Bước)

### Bước 1: Cài Đặt Thư Viện & Cấu Hình Môi Trường
- Bổ sung package `@hydraone-sdk/core` (phiên bản `^0.3.0`) vào `package.json`.
- Cập nhật file `nuxt.config.ts`:
  - Bổ sung biến môi trường `runtimeConfig.public.APP_CENTER_ORIGIN` (mặc định cho phép `https://alpha.hydraone.app,https://beta.hydraone.app,https://portal.hydraone.app` hoặc `*` khi chạy local dev).
  - Cấu hình Vite optimizeDeps nếu cần cho các thư viện phụ thuộc của SDK.

### Bước 2: Xây Dựng Composable `composables/useHydraOneWallet.ts`
- Tham khảo từ kiến trúc đã chạy ổn định của `hydra-gacha` và `hydra-mines`:
  - Sử dụng `createSharedComposable` từ `@vueuse/core` để tạo một instance bridge duy nhất cho toàn bộ vòng đời ứng dụng.
  - Thiết lập `autoConnect: true` và `autoRefreshBalance: false` (chỉ refresh khi người chơi mở giao diện nạp tiền để tối ưu hiệu năng và tránh spam postMessage).
  - Cung cấp hàm kiểm tra môi trường: `const isIframe = computed(() => typeof window !== 'undefined' && window.parent !== window)`.

### Bước 3: Nâng Cấp Pinia Store (`stores/wallet.ts`) Sang Chế Độ Kép
- Thêm cờ trạng thái `isIframeMode: boolean` vào state của ví.
- Bổ sung logic khởi tạo:
  - Nếu `isIframeMode = true`: Theo dõi reactive state từ `useHydraOneWallet`. Khi có `address`, tự động gọi chu trình xin nonce và ký xác thực `verifySignature`.
  - Nếu `isIframeMode = false`: Giữ nguyên toàn bộ luồng kết nối CIP-30 qua `window.cardano[walletKey].enable()`.
- Nâng cấp action `depositAda`:
  - Kiểm tra nếu đang ở `isIframeMode`: Thực hiện ký và gửi giao dịch thông qua các hàm `signTx` và `submitTx` của bridge thay vì gọi trực tiếp đối tượng CIP-30.

### Bước 4: Tinh Chỉnh Giao Diện Người Dùng (UI/UX Top Bar & Modal)
- **Top Bar (`components/TopBar.vue`):**
  - Khi `isIframeMode = true` và ví đã kết nối trên HydraOne:
    - Thay thế nút "Ví Cardano" bằng nhãn thông tin đồng bộ: `[ 🟢 HydraOne: addr_test1...9ug9 ]`.
    - Ẩn nút "Ngắt kết nối" trong menu con, vì trạng thái kết nối do Header trang cha quản lý.
  - Khi chưa kết nối ví trên HydraOne: Hiển thị nhãn nhắc nhở: `[ ⚪ Vui lòng kết nối ví trên HydraOne ]`.
- **Modal Kết Nối Ví (`components/ui/WalletConnectModal.vue`):**
  - Nếu người dùng bấm vào vùng trạng thái ví khi đang ở chế độ iframe, hiển thị hướng dẫn rõ ràng: *"Hãy nhấp vào nút 'Kết nối' ở góc phải trên cùng của HydraOne để đăng nhập"* thay vì hiển thị danh sách ví riêng lẻ.

### Bước 5: Kiểm Thử & Xác Minh Hệ Thống (Verification Checklist)
- **Kiểm thử trên trình duyệt độc lập:** Truy cập trực tiếp `localhost:3012` hoặc domain Render để đảm bảo chế độ CIP-30 độc lập vẫn hoạt động bình thường 100%.
- **Kiểm thử trong môi trường nhúng (Iframe Test):** Dùng file HTML giả lập hoặc chạy trực tiếp trong Portal HydraOne để xác minh:
  - Bắt tay handshake `CLIENT_READY` thành công.
  - Đọc chính xác địa chỉ ví và số dư ADA từ Header cha.
  - Ký nonce tạo session đăng nhập thành công.
  - Thực hiện đơn nạp 10 ADA thành công, giao dịch được ký từ ví cha và MC được cộng vào tài khoản.

---

## 5. Vấn Đề Pointer Lock Trong Thẻ Iframe Của HydraOne Portal

### Hiện Tượng
Khi mở game trong iframe trên HydraOne Portal, nhấp chuột trái vào màn hình không kích hoạt được cơ chế ẩn con trỏ chuột (`Pointer Lock`), khiến việc rê chuột để xoay camera 3D bị gián đoạn.

### Nguyên Nhân Gốc Rễ
Theo thông số bảo mật trình duyệt, thẻ `<iframe>` muốn sử dụng API Pointer Lock bắt buộc phải có thuộc tính:
- `allow="pointer-lock ..."`
- `sandbox="... allow-pointer-lock ..."`

Kiểm tra định nghĩa sandbox trong `hydraone-control-plane/packages/contracts/src/registry.ts` cho thấy:
- Danh sách `ALLOW_VALUES` hiện chỉ có: `['fullscreen', 'autoplay', 'clipboard-write', 'clipboard-read', 'accelerometer', 'gyroscope', 'screen-wake-lock']`.
- Danh sách `SANDBOX_VALUES` hiện thiếu cờ `allow-pointer-lock`.

### Hướng Khắc Phục
Bổ sung `pointer-lock` vào danh sách `ALLOW_VALUES` và `allow-pointer-lock` vào `SANDBOX_VALUES` trong mã nguồn của HydraOne Control Plane / Portal. Khi thuộc tính này được cập nhật ở trang cha, tính năng xoay camera 3D trong game sẽ tự động hoạt động trơn tru mà không cần chỉnh sửa mã nguồn Three.js của game.

