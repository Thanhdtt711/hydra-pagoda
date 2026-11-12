# Kế Hoạch & Tài Liệu Kỹ Thuật Tích Hợp HydraOne Wallet Bridge Cho Vạn Cảnh Thiền Tự

Tài liệu này mô tả chi tiết kiến trúc, cơ chế hoạt động, các lưu ý quan trọng khi chạy production và toàn bộ lộ trình tích hợp hệ thống ví của HydraOne (`@hydraone-sdk/core`) vào **Vạn Cảnh Thiền Tự** (Hydra Pagoda). Mục tiêu là cho phép người chơi khi trải nghiệm game thông qua iframe của HydraOne Portal không phải kết nối ví lần thứ hai, tự động nhận diện địa chỉ ví và số dư từ Header của HydraOne, đồng thời thực hiện các giao dịch nạp Merit Coin (MC) liền mạch.

---

## 1. Tổng Quan & Bối Cảnh

Hiện tại, Vạn Cảnh Thiền Tự đã được triển khai lên Render tại địa chỉ `https://hydra-pagoda.onrender.com` và được nhúng vào hệ sinh thái HydraOne thông qua `apps/portal` với thẻ iframe.

Trong hệ thống HydraOne, thanh Header trang cha đã tích hợp sẵn chức năng kết nối ví Cardano (Lace, Eternl, Vespr, Nami). Việc bắt người chơi tiếp tục bấm kết nối ví một lần nữa bên trong iframe sẽ gây trải nghiệm người dùng trùng lặp và thiếu tự nhiên.

Vì vậy, hệ thống áp dụng **Kiến Trúc Ví Chế Độ Kép (Dual-Mode Wallet Architecture)**:
1. **Chế độ HydraOne Iframe (Host Bridge):** Game phát hiện đang chạy trong iframe (`window.parent !== window`), tự động bắt tay handshake (`CLIENT_READY`), đồng bộ dữ liệu ví từ Header trang cha qua giao thức IPC `window.postMessage`, ủy quyền ký giao dịch và nạp MC qua ví của HydraOne.
2. **Chế độ Độc lập (Standalone CIP-30):** Khi người chơi truy cập trực tiếp bằng trình duyệt ngoài, game vẫn giữ nguyên luồng kết nối ví CIP-30 trực tiếp như thiết kế ban đầu.

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
│   app.vue (onMounted) -> bridge.init() gửi CLIENT_READY                 │
│       │                                                                │
│       ├──> 1. Tự động nhận address & balanceLovelace (Non-blocking UI) │
│       ├──> 2. Đồng bộ phiên ngầm (/api/auth/me) hoặc ký signData       │
│       └──> 3. Nạp MC: bridge.signTx() + bridge.submitTx()              │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Giao Thức Trao Đổi Thông Điệp (PostMessage IPC)

Hệ thống sử dụng `@hydraone-sdk/core` để quản lý bắt tay (handshake) và truyền thông điệp hai chiều an toàn:
- **Handshake ban đầu (`CLIENT_READY`):** Ngay khi `app.vue` mount xong trong iframe, client bắt buộc phải gọi `bridge.init()` để gửi thông điệp `CLIENT_READY` lên `window.parent` và chờ `HOST_ACK`. Nếu thiếu bước này, trang cha sẽ không gửi dữ liệu ví xuống iframe.
- **Cập nhật trạng thái ví:** Khi người chơi kết nối ví, đổi tài khoản hoặc ngắt kết nối trên Header của HydraOne, trang cha bắn sự kiện `WALLET_STATE_CHANGED` vào iframe kèm theo địa chỉ ví Bech32 (`address`) và số dư ADA (`balanceADA` / `balanceLovelace`).
- **Yêu cầu ký dữ liệu (`signData`):** Dùng để ký chuỗi nonce xác thực phiên đăng nhập (JWT) khi người chơi chủ động đăng nhập/xác thực.
- **Yêu cầu đọc UTxO & ký giao dịch (`getUtxos`, `signTx`, `submitTx`):** Chuyển giao dịch CBOR lên cho ví trang cha ký và phát tán giao dịch lên mạng Cardano.

---

## 3. Quy Trình Nghiệp Vụ & Nguyên Tắc Đồng Bộ Trạng Thái

### 3.1. Nguyên Tắc Đồng Bộ Ví Không Chặn Giao Diện (Non-Blocking UI Sync)

Khác với luồng Standalone CIP-30 (yêu cầu ký xong CIP-8 mới báo đã kết nối), khi chạy trong iframe của HydraOne:
1. Ngay khi `app.vue` chạy `onMounted`, hệ thống gọi `bridge.init()` và tiếp tục gọi `wallet.restore()`.
2. Trong `stores/wallet.ts`, hàm `initHydraBridgeWatcher()` đồng bộ ngay `address`, `balanceLovelace` và đặt ngay `status = 'connected'`, `walletKey = 'hydraone'`, `walletName = 'HydraOne'` ngay khi nhận được địa chỉ từ Header cha.
3. Hệ thống **không chặn hiển thị trạng thái kết nối chỉ vì chờ người dùng ký `signData`**, bởi vì trình duyệt thường chặn pop-up ký tự động nếu không xuất phát từ cú nhấp chuột trực tiếp của người dùng (`user gesture`).
4. Việc đồng bộ tài khoản server (`/api/auth/me`) chạy ngầm qua `syncServerAccount(address)`. Nếu người dùng chưa có phiên JWT hợp lệ hoặc đổi ví trên Header, người dùng có thể xác thực qua `loginWithHydraBridge(address)` khi bấm nút làm mới hoặc khi thực hiện giao dịch nạp MC.

### 3.2. Luồng Nạp Merit Coin (`buyMcWithAda`) Qua Bridge

1. Người chơi bấm nút **`+ Nạp`** trên thanh điều hướng hoặc trong Hòm Công Đức, chọn gói nạp ADA mong muốn (tối thiểu 2 ADA).
2. Client gọi API backend `/api/shop/orders` để tạo mã đơn nạp tiền với trạng thái `pending`.
3. Ở chế độ Iframe (`isIframeMode && !walletApi`), game đọc danh sách UTxO qua `bridge.client.getUtxos()` và lấy `changeAddress` từ `bridge.address.value`.
4. Client gọi API `/api/shop/orders/{orderId}/build` để backend dựng giao dịch Cardano chuyển ADA tới địa chỉ Treasury, trả về chuỗi `unsignedTxCbor`.
5. Game gọi `bridge.signTx(built.unsignedTxCbor, true)` để nhận `witnessHex` từ ví cha trên Header HydraOne.
6. Client gửi `witnessHex` lên `/api/shop/orders/{orderId}/witness` để server ghép thành `signedTxCbor` hoàn chỉnh, sau đó gọi `bridge.submitTx(attached.signedTxCbor)` để phát tán lên mạng Cardano.
7. Client báo `txHash` về `/api/shop/orders/{orderId}/submit` và watcher của backend tự động đối soát xác nhận on-chain để cộng MC vào tài khoản người chơi.

---

## 4. Chi Tiết Triển Khai Mã Nguồn (Thực Tế Codebase)

### Bước 1: Cài Đặt Thư Viện & Cấu Hình Origin (`package.json`, `nuxt.config.ts`)
- Cài đặt package `@hydraone-sdk/core` phiên bản `^0.3.0` trong `package.json`.
- Cấu hình `runtimeConfig.public.appCenterOrigin` trong `nuxt.config.ts`:
  - **Cảnh báo bảo mật Production:** SDK `@hydraone-sdk/core` trong môi trường `production` sẽ chủ động kiểm tra và ném lỗi `HydraSecurityError: Wildcard origin "*" is not allowed in production environment` nếu danh sách `hostOrigin` có chứa ký tự `*`. Vì vậy, **tuyệt đối không để dấu `*`** trong cấu hình production.
  - Phải khai báo đầy đủ các domain thực tế của HydraOne: `https://beta.hydraone.app,https://developers-portal-beta.hydraone.app,https://dev.hydraone.app,https://portal.hydraone.app,https://alpha.hydraone.app,https://hydraone.app`.

### Bước 2: Xây Dựng Composable `composables/useHydraOneWallet.ts`
- Tạo singleton shared instance (`sharedBridgeInstance`) bọc quanh `useWalletBridgeClient` từ `@hydraone-sdk/core/vue` để đảm bảo toàn app chỉ có đúng một bộ listener và trạng thái ví đồng nhất.
- Tự động phát hiện môi trường nhúng bằng `const isIframe = typeof window !== 'undefined' && window.parent !== window`.
- Tự động lọc bỏ ký tự `*` khỏi mảng `origins` khi `!import.meta.dev` và fallback về danh sách `DEFAULT_ORIGINS` hợp lệ của HydraOne.
- Thiết lập `autoConnect: isIframe` và `autoRefreshBalance: false` (chủ động refresh số dư khi cần để tránh spam thông điệp IPC).

### Bước 3: Khởi Tạo Handshake Tại `app.vue` & Nâng Cấp Store `stores/wallet.ts`
- **Tại `app.vue`:** Trong hook `onMounted`, kiểm tra nếu đang chạy trong iframe thì gọi tường minh `await useHydraOneWallet().init()`, sau đó gọi `await wallet.restore()`.
- **Tại `stores/wallet.ts`:**
  - Bổ sung trường trạng thái `isIframeMode: boolean` vào `WalletState`.
  - Bổ sung action `initHydraBridgeWatcher()` theo dõi reactive `[bridge.isWalletConnected.value, bridge.address.value, bridge.balanceLovelace.value]`.
  - Bổ sung `syncServerAccount(address)` và `loginWithHydraBridge(address)` (đảm bảo luôn giữ `status = 'connected'` kể cả khi người dùng đóng hộp thoại ký nonce).
  - Nâng cấp `refreshAdaBalance()` và `buyMcWithAda(adaAmount)` rẽ nhánh sang HydraOne Bridge khi `isIframeMode && !walletApi`.

### Bước 4: Tinh Chỉnh Giao Diện Người Dùng (`components/TempleCanvas.vue`, `components/WalletConnectModal.vue`)
- **Top Bar (`components/TempleCanvas.vue`):**
  - Khi ở chế độ `wallet.isIframeMode`: Nút ví hiển thị `HydraOne: {{ wallet.shortAddress }}` khi đã kết nối, hoặc `Kết nối trên HydraOne` khi Header cha chưa kết nối ví.
- **Modal Kết Nối & Nạp MC (`components/WalletConnectModal.vue`):**
  - Khi chưa kết nối trong iframe: Ẩn danh sách ví extension rời rạc (Eternl), thay bằng thẻ hướng dẫn kết nối ví ở thanh Menu trên cùng của HydraOne kèm nút `Làm Mới Trạng Thái Ví` (`handleSyncHydraBridge`).
  - Khi đã kết nối trong iframe: Hiển thị nhãn `HydraOne` kèm badge `Host Header`, ẩn nút `Ngắt` (vì kết nối do Header cha quản lý) và thay bằng nút `Làm mới`.

### Bước 5: Kiểm Định Chất Lượng & Kiểm Thử (Quality Gates)
- Chạy `node scripts/verify-ui-primitives.mjs` đảm bảo `0 banned symbols` và `0 fonts < 12px`.
- Chạy `node scripts/wallet/test-hydra-l2.mjs` đảm bảo `11/11 test cases PASS`.
- Chạy `nuxt build` đảm bảo đóng gói production client + Nitro server không lỗi.

---

## 5. Cấu Hình Quyền Iframe & Vấn Đề Pointer Lock Trên HydraOne Portal

### 5.1. Danh Sách Quyền Bắt Buộc Khi Tạo Release Trên Developer Portal
Để game hoạt động đầy đủ chức năng (âm thanh thiền 432Hz, fullscreen, đồng bộ ví và nạp MC), bản Release trên HydraOne Developer Portal bắt buộc phải được **Lưu, Gửi duyệt và Đặt làm bản Live (Promote to Live)** với đầy đủ các quyền sau:
- **Sandbox của iframe:** `allow-scripts`, `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-popups-to-escape-sandbox`, `allow-downloads`, và `allow-pointer-lock` (khi Portal hỗ trợ).
- **Tính năng của iframe (`allow`):** `fullscreen`, `autoplay`, `clipboard-write`, `screen-wake-lock`, và `pointer-lock` (khi Portal hỗ trợ).
- **Quyền ví (`bridge`):** Tích chọn đầy đủ cả 7 quyền: `getAddress`, `getNetwork`, `signData`, `signTx`, `getUtxos`, `submitTx`, `connect`.

### 5.2. Xử Lý Sự Cố Pointer Lock (Ẩn Chuột Xoay Camera 3D)
- **Hiện tượng:** Khi click chuột trái vào màn hình game trong iframe, trình duyệt báo lỗi `SecurityError: Blocked pointer lock on an element because the element's frame is sandboxed and the 'allow-pointer-lock' permission is not set`.
- **Nguyên nhân:** Ngay cả khi trang cấu hình Release đã hiển thị checkbox `allow-pointer-lock` và `pointer-lock`, nếu trang Host Shell của HydraOne chưa đưa 2 giá trị này vào bản ghi Live thực tế hoặc bộ kiểm tra hợp lệ của Control Plane (`packages/contracts/src/registry.ts`) chưa xuất ra thuộc tính HTML trên thẻ `<iframe>`, trình duyệt vẫn sẽ chặn API `requestPointerLock()`.
- **Giải pháp song song:**
  1. **Phía Portal:** Đảm bảo bản Release mới đã được Promote to Live và thẻ `<iframe>` khi Inspect Element thực sự có chứa `allow-pointer-lock` trong `sandbox` và `pointer-lock` trong `allow`.
  2. **Phía Game (Đã tích hợp sẵn trong `lib/world3d/TempleStage.ts`):** Khi trình duyệt chặn Pointer Lock, người chơi vẫn có thể **giữ chuột trái hoặc chuột phải và kéo (Drag to Look)** để xoay camera 3D mượt mà, đồng thời dùng phím `A`/`D` hoặc mũi tên và con lăn chuột để điều chỉnh góc nhìn.
