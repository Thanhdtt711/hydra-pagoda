# Báo cáo điều tra & tái dùng (Bước 1)

> Trạng thái: **Đã hoàn thành Bước 2 – cập nhật danh sách file đã tái dùng.**
> Nguồn tham khảo (chỉ ĐỌC): `D:\Vtechcom\hydra-graveyard`. Không đọc file `.env`, không sao chép bất kỳ khóa/seed nào.

## 0. Các file đã tái dùng thực tế ở Bước 2

| File đích trong `hydra-pagoda` | File nguồn tham khảo trong `hydra-graveyard` | Nội dung tái dùng & Điều chỉnh |
|---|---|---|
| [`server/utils/wallet/cose.ts`](file:///d:/Vtechcom/hydra-pagoda/server/utils/wallet/cose.ts) | `apps/graveyard-engine/src/auth/cose.ts` | Tái dùng thuật toán giải mã `COSE_Sign1`/`COSE_Key`, kiểm tra chữ ký Ed25519 trên `Sig_structure`, băm `blake2b224` khóa công khai so với payment key hash trong địa chỉ và chuyển đổi bech32. Đã bổ sung kiểm tra loại địa chỉ Shelley (`[0,2,4,6]`), giải mã bech32 và hàm `bytesEqual` hằng thời gian. |
| [`server/utils/wallet/auth.ts`](file:///d:/Vtechcom/hydra-pagoda/server/utils/wallet/auth.ts) | `apps/graveyard-engine/src/auth/signature-verifier.ts` | Tái dùng nguyên tắc "owner chỉ suy ra từ chữ ký CIP-8" và kiểm tra `networkId` từ header byte địa chỉ; viết mới hoàn toàn cho Nitro + SQLite với cơ chế đốt `nonce` 1 lần nguyên tử, cookie phiên `httpOnly; SameSite=Strict` và vé WebSocket `ws_tickets`. |
| [`lib/cardano/cip30.ts`](file:///d:/Vtechcom/hydra-pagoda/lib/cardano/cip30.ts) & [`stores/wallet.ts`](file:///d:/Vtechcom/hydra-pagoda/stores/wallet.ts) | `apps/web-client/app/stores/wallet.ts` & `app/lib/cardano.ts` | Tham khảo luồng `enable()` → `getNetworkId()` → `getUsedAddresses()` → `signData()` và khôi phục phiên; dùng `@scure/base` để đổi hex CBOR sang bech32 và không lưu token xác thực vào `localStorage`. |
| [`server/utils/wallet/txBuilder.ts`](file:///d:/Vtechcom/hydra-pagoda/server/utils/wallet/txBuilder.ts) | `apps/graveyard-engine/src/commands/deposit-builder.service.ts` & `apps/web-client/app/lib/engine/deposit.ts` | Sử dụng `@hydra-sdk/cardano-wasm` và `@hydra-sdk/core` (`DEFAULT_PROTOCOL_PARAMETERS`) để dựng giao dịch nạp ADA trả vào `treasuryAddress` kèm metadata `orderId` (nhãn `8181` + CIP-20 `674`) trên server và ghép witness `attachOrderWitness` từ `signTx(partialSign=true)`. |
| [`server/utils/wallet/blockfrost.ts`](file:///d:/Vtechcom/hydra-pagoda/server/utils/wallet/blockfrost.ts) & [`server/utils/wallet/orders.ts`](file:///d:/Vtechcom/hydra-pagoda/server/utils/wallet/orders.ts) | `apps/graveyard-engine/src/bridge/blockfrost.client.ts` & `bridge.service.ts` | Tái dùng client REST Blockfrost (`latestBlockHeight`, `addressTransactions`, `txUtxos` lọc collateral/reference, `txExists`, `txMetadata`) và mẫu idempotency theo `tx_hash PRIMARY KEY`. Điều chỉnh để **chỉ cộng MC sau khi đạt `>= N` xác nhận** và đối chiếu `orderId` trong metadata. |

## 1. Hiện trạng `hydra-pagoda`

### 1.1 Stack
Nuxt 3.15 (`ssr: false`, SPA), Vue 3, Pinia, Nitro (WebSocket bật), Tailwind 4, Three.js. Node v24.18.
`package.json` **không có** thư viện Cardano nào (không Mesh, Lucid, CSL, hydra-sdk) và **không có** CSDL.

### 1.2 Ví Cardano hiện có

| File | Vai trò | Vấn đề |
|---|---|---|
| `stores/wallet.ts` | Store ví: `detectInstalledWallets`, `connectWallet`, `recordMeritDeposit` | Gọi `enable()` nhưng **không kiểm tra mạng, không ký xác thực**; địa chỉ lấy từ `getUsedAddresses()` ở dạng **hex CBOR** (chưa đổi bech32); khi ví không có/từ chối sẽ **giả lập địa chỉ ngẫu nhiên** `addr_test1qrz9pagoda...` và vẫn "đã kết nối" |
| `components/WalletConnectModal.vue` | Modal chọn ví (Eternl, Lace, Nami, Flint, Vespr) | Không có hướng dẫn cài khi thiếu ví, không báo lỗi từ chối/khóa ví |
| `lib/cardano/ephemeralKey.ts` | "Khóa tạm" ký nghi lễ | **Giả**: chữ ký là hash 32-bit tự chế, khóa riêng lưu `localStorage`. Không có giá trị bảo mật; chỉ dùng trang trí |
| `components/TempleCanvas.vue` (dòng ~662–690) | Thanh trên cùng + nút "VÍ CARDANO" | Đọc `economy.meritCoins`, `economy.divineLotus`, `wallet.adaBalance` |

### 1.3 Nguồn dữ liệu 1.250 / 108 / 45,5
Tất cả là **giá trị khởi tạo cứng ở client**, không đến từ server hay chuỗi:
- **1.250** = `stores/economy.ts` → `meritCoins: 1250` (Tâm Duyên).
- **108** = `stores/economy.ts` → `divineLotus: 108` (Bảo Ngọc Sen Vàng).
- **45,5** = `stores/wallet.ts` → `balanceLovelace: 45500000n` (mặc định "giả lập"), hiển thị qua getter `adaBalance`. (`economy.adaBalance: 45.5` cũng tồn tại, trùng lặp.)

Không có lưu trữ: reload trang là reset.

### 1.4 Nơi đang tiêu coin (đều ở client – phải chuyển sang server ở Bước 4)

| File | Hành vi hiện tại |
|---|---|
| `FortuneModal.vue` | Trừ `economy.meritCoins -= tier.coins` tại client; kết quả quẻ sinh ở client; gọi `wallet.recordMeritDeposit()` sinh **txHash giả** |
| `MeritBoxModal.vue` | `economy.meritCoins += amount*100`; `donateToMeritBox()` |
| `SanctuaryDrawer.vue` | Gọi `economy.spendMerit(...)`, `economy.addKarma(...)` — **hai hàm này KHÔNG tồn tại trong store** (lỗi runtime tiềm ẩn đang có sẵn) |
| `SanctuaryShop.vue` | `economy.meritCoins -= item.priceCoins`, giá nằm trong file client |
| `CardCollectionModal.vue` | Mint NFT giả, `recordMeritDeposit(2.5)` |

Hệ quả: hiện có **ba đơn vị** (Tâm Duyên, Sen Vàng, ADA) và giá ghi theo cả ADA lẫn "coins" ở nhiều nơi. Mô hình mới chỉ có **MC** (1 ADA = 1000 MC) → cần thống nhất cách ánh xạ (xem câu hỏi mục 5).

### 1.5 Server
- Chỉ có `server/routes/_ws.ts`: WebSocket **in-memory** (Map), không CSDL, không xác thực.
- `client:join` tin hoàn toàn `data.id`, `data.name` từ client ⇒ giả mạo tên/danh tính dễ dàng. `client:chat` cũng dùng `data.name` dự phòng.
- Không có route `/api/*`, không có session/cookie, không có rate limit ngoài giới hạn gói `move`.
- `.gitignore` đã loại `.env*` trừ `.env.example` (chưa có file `.env.example`).
- Chưa có thư mục `docs/wallet/` (chỉ có `docs/superpowers`).

## 2. `hydra-graveyard` – có gì tái dùng được

Stack: monorepo pnpm; `apps/graveyard-engine` (NestJS + **Postgres** + `node-pg-migrate`), `apps/web-client` (Nuxt 4), `packages/graveyard-core`, `onchain/` (Aiken), `infra/`. Ví dùng `@hydra-sdk/*` (WASM CSL) + `@noble/*`, `cbor2`.

### 2.1 Có thể tái dùng (lấy logic, viết lại cho Nitro)

| Nhu cầu | File nguồn (đường dẫn tương đối `hydra-graveyard`) | Ghi chú / mức độ |
|---|---|---|
| Xác thực chữ ký CIP-8 (COSE_Sign1) | `apps/graveyard-engine/src/auth/cose.ts` | **Tái dùng cao.** Thuần TS, chỉ cần `@noble/curves`, `@noble/hashes`, `@scure/base`, `cbor2`. Không phụ thuộc Nest. Có: verify ed25519 trên Sig_structure, tách address/pubkey, kiểm tra `blake2b224(pubkey) == payment key hash`, đổi bech32 |
| Logic ràng buộc: network, key↔address, chữ ký phủ đúng thông điệp | `.../auth/signature-verifier.ts` (`Cip8Verifier.deriveOwner`, `assertCovers`) | Lấy logic; bỏ decorator Nest và các tầng "demo/silent/ephemeral". **Nguyên tắc `owner` chỉ lấy từ chữ ký** (AD-15) giữ nguyên |
| Đọc chuỗi qua Blockfrost | `.../bridge/blockfrost.client.ts` | **Tái dùng cao.** Interface + HTTP client gọn: `latestBlockHeight`, `addressTransactions`, `txUtxos` (lọc collateral/reference), `txExists` (phát hiện rollback), `txMetadata` |
| Bridge nạp tiền: dedup, xác nhận theo độ sâu, clawback khi rollback | `.../bridge/bridge.service.ts` + `migrations/1753000003000_bridge-ledger.sql`, `…002000_credit-l1txhash-dedup.sql` | **Tái dùng ý tưởng, viết lại.** Mẫu hay: "claim" `tx_hash` bằng `PRIMARY KEY … ON CONFLICT DO NOTHING` *trước khi* cộng; trạng thái credited→confirmed→clawed. Khác: graveyard *cộng lạc quan* khi chưa đủ xác nhận và xác định chủ theo *địa chỉ gửi*; ta yêu cầu **chỉ cộng sau ≥N xác nhận** và khớp theo **orderId trong metadata** |
| Đổi hex CBOR → bech32 | `apps/web-client/app/lib/cardano.ts` (`hexToBech32`) | Lấy ý tưởng. Dùng CSL WASM; có thể thay bằng `@scure/base` bech32 (đã dùng trong `cose.ts`) để khỏi cần WASM ở client |
| Ghép witness của ví vào tx | `apps/web-client/app/lib/engine/deposit.ts` (`attachWitness`, `ensureSignedTx`) | Cần nếu dùng CIP-30 `signTx(partialSign=true)` rồi `submitTx` |
| Dựng tx nạp (UTxO ví → treasury + metadata) | `apps/graveyard-engine/src/commands/deposit-builder.service.ts`; client `useEngine.ts` / `stores/wallet.ts` (`depositInputs`, `submitBuiltTx`) | Lấy ý tưởng "server dựng tx chưa ký, client chỉ ký + submit" → server kiểm soát số tiền/địa chỉ/metadata. Cần chọn thư viện dựng tx (xem mục 4) |
| Luồng CIP-30 phía client (enable, kiểm tra `getNetworkId`, `signData`, restore phiên) | `apps/web-client/app/stores/wallet.ts` (~400 dòng; `connect`, `signData`, `restore`) | Lấy cấu trúc; **bỏ** lưu khóa ví vào `localStorage` làm cơ sở xác thực (ta dùng cookie httpOnly) và bỏ phần "App Center bridge" |
| UI trạng thái nạp (đang ký / chờ / xác nhận) và link explorer | `apps/web-client/app/components/TopUpModal.vue` | Chỉ tham khảo bố cục trạng thái; giao diện pagoda dùng style Binance riêng |
| Lược đồ idempotency theo tx hash | `bridge_deposits (l1_tx_hash PK, owner, lovelace, status, …)` | Mẫu cho bảng `deposits` của ta |

### 2.2 Không dùng được / không nên dùng

| Phần | Lý do |
|---|---|
| NestJS (module, controller, guard, DTO) | Khác stack – ta dùng Nitro (`defineEventHandler`) |
| `@hydra-sdk/*` toàn bộ, Hydra Head relayer (`relayer/`, `infra/hydra`, `preprod-offline`), Aiken validators (`onchain/`) | Khác mô hình: graveyard dùng Hydra L2 + vault on-chain; ta chỉ cần **thanh toán L1 một chiều → điểm off-chain**. Thêm WASM nặng vào bundle SPA không cần thiết |
| Event-sourcing (`engine/event-log`, `reducer`, `projection`) | Quá nặng cho một sổ cái số dư; ta dùng bảng ledger append-only đơn giản |
| Chế độ `AUTH_MODE=demo`, `DEMO_TOPUP`, `OPERATOR_TOKEN=dev-operator-token`, endpoint `/demo/topup` | **Rủi ro bảo mật**: cho phép client tự nhận chủ sở hữu / tự nạp coin. Tuyệt đối không mang sang |
| "Cộng lạc quan khi chưa đủ xác nhận + clawback" | Trái yêu cầu "chỉ cộng sau khi xác nhận". Nếu rollback sau khi người chơi đã tiêu thì không thu hồi được → không dùng |
| Chủ sở hữu suy ra từ *địa chỉ gửi* của deposit | Dễ sai với ví nhiều địa chỉ/giao dịch từ nhiều input; ta ràng buộc bằng `orderId` gắn với tài khoản đã đăng nhập |
| `RELAYER_SKEY_PATH`, `credentials/*/payment.skey`, `scripts/mnemonic-wallet.ts` | **Khóa bí mật** – KHÔNG đọc/sao chép. Ví treasury của ta chỉ cần *địa chỉ nhận* (không cần khóa trên server) |
| `.env`, `devnet-preprod.env.example` có giá trị thật | Không sao chép; chỉ tham khảo *tên biến* trong `.env.example` |

## 3. CSDL phía server & đề xuất

Hiện tại: **không có** (chỉ Map trong RAM của `_ws.ts`; `.data/` của Nitro chỉ là cache dev).

Yêu cầu của bài toán: giao dịch nguyên tử, ràng buộc `UNIQUE(tx_hash)`, cập nhật có điều kiện để không âm số dư, sổ cái bất biến, truy vấn lịch sử.

| Phương án | Ưu | Nhược | Khuyến nghị |
|---|---|---|---|
| **SQLite (WAL)** qua `node:sqlite` (Node 24 có sẵn, kiểm tra OK) hoặc `better-sqlite3` | Không cần dịch vụ ngoài, ACID, `UNIQUE`/`CHECK balance>=0`, ghi tuần tự an toàn, dễ backup file, đủ cho một tiến trình Nitro | Một máy/một tiến trình; `node:sqlite` còn đánh dấu experimental, `better-sqlite3` cần build native trên Windows | **Chọn cho Preprod/giai đoạn đầu** |
| **PostgreSQL** (đã có kinh nghiệm + `node-pg-migrate` + docker-compose ở graveyard) | Nhiều instance, `SELECT … FOR UPDATE`, sao lưu/giám sát chuẩn | Cần chạy DB, thêm hạ tầng | **Khuyến nghị cho Mainnet**/khi scale ngang |
| Redis | Nhanh | Không phù hợp làm nguồn chân lý tài chính | Chỉ dùng nếu cần rate-limit phân tán / pub-sub sau này |

Đề xuất kiến trúc: viết **lớp truy cập (repository) mỏng** với SQL tương thích cả hai (kiểu `INTEGER`/`BIGINT` cho số nguyên, không float). Bắt đầu SQLite + migration `.sql` đánh số; chuyển Postgres khi lên Mainnet chỉ đổi driver.

Khuyến nghị thư viện (không có sẵn hiện giờ, cần thêm khi code): `@noble/curves`, `@noble/hashes`, `@scure/base`, `cbor2` (xác thực CIP-8, theo graveyard); dựng/serialize tx: `@emurgo/cardano-serialization-lib-browser` hoặc **MeshJS** – cần bạn chọn (xem câu hỏi).

## 4. Rủi ro/điểm cần lưu ý đã phát hiện
1. Mô hình 3 đơn vị hiện tại (Tâm Duyên/Sen Vàng/ADA) ↔ chỉ còn MC: cần quyết định số phận của Sen Vàng và "Tâm Duyên kiếm miễn phí qua thiền".
2. `economy.spendMerit/addKarma` không tồn tại → sẽ viết lại khi chuyển sang server.
3. `_ws.ts` tin danh tính từ client → sẽ gắn với session (Bước 2.6).
4. Cardanoscan Preprod: `https://preprod.cardanoscan.io/transaction/<hash>`; Mainnet: `https://cardanoscan.io/transaction/<hash>`.
5. Bundle SPA: ưu tiên không kéo WASM CSL vào client nếu không cần (dựng tx ở server, client chỉ ký/submit).

## 5. Xác nhận bảo mật
- Chưa sao chép bất kỳ file/khóa/seed/`.env`/API key/địa chỉ ví thật nào từ `hydra-graveyard`.
- Chỉ đọc các file mã nguồn liệt kê ở mục 2.1 và `.env.example` (tên biến).

