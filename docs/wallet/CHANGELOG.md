# Changelog – Ví Cardano & MC coin

## Bước 1 – Điều tra (2026-11-05)
- **Mới:** `docs/wallet/REUSE_REPORT.md` (báo cáo điều tra), `docs/wallet/CHANGELOG.md`, `docs/wallet/README.md`.
- **Sửa/Xóa:** không có. Không có thay đổi code.

## Bước 2 – Đăng nhập bằng ví Eternl CIP-30 & Gắn danh tính WebSocket (2026-11-05)
- **Mới:**
  - `server/utils/wallet/cose.ts` — xác thực chữ ký CIP-8 / `COSE_Sign1` + `COSE_Key` (ed25519, blake2b-224 payment key hash, bech32).
  - `server/utils/wallet/config.ts` — cấu hình mạng Cardano (`preprod` / `mainnet`), thời hạn phiên, đường dẫn SQLite.
  - `server/db/migrations.ts` — migration #1 (`accounts`, `auth_nonces`, `sessions`, `ws_tickets`).
  - `server/utils/wallet/db.ts` — quản lý kết nối SQLite (`node:sqlite`, WAL, `withTransaction` nguyên tử).
  - `server/utils/wallet/rateLimit.ts` — giới hạn tần suất theo IP (sliding window).
  - `server/utils/wallet/auth.ts` — phát hành nonce 1 lần (TTL 5 phút), xác minh chữ ký CIP-8, quản lý cookie phiên `httpOnly; SameSite=Strict`, cấp/tiêu thụ vé WebSocket 1 lần (`ws_tickets`).
  - `server/api/auth/nonce.post.ts`, `verify.post.ts`, `me.get.ts`, `logout.post.ts`, `ws-ticket.post.ts` — các endpoint xác thực.
  - `lib/cardano/cip30.ts` — helper CIP-30 phía trình duyệt (`enable`, `signData`, `getBalance`, `hexToBech32`, phân loại lỗi từ chối/khóa ví/sai mạng).
  - `.env.example` — mẫu cấu hình biến môi trường.
  - `scripts/wallet/test-auth.mjs` — bộ kiểm thử 19 ca đăng nhập & chống giả mạo (replay nonce, ký bằng ví khác, sai thông điệp, sai mạng, CSRF Origin, giả mạo tên WS, rate limit).
  - `docs/wallet/KIEN_TRUC.md`, `docs/wallet/TEST_REPORT.md` — tài liệu kiến trúc và báo cáo kiểm thử Bước 2.
- **Sửa:**
  - `nuxt.config.ts` — thêm `runtimeConfig` cho ví Cardano và CSDL.
  - `stores/wallet.ts` — thay thế hoàn toàn cơ chế kết nối giả lập bằng luồng CIP-30 + ký CIP-8 + cookie phiên `httpOnly`, tự kết nối lại khi reload, tự đăng xuất khi đổi tài khoản/đổi mạng/khóa ví.
  - `stores/economy.ts` — khởi tạo `meritCoins: 0` (đồng bộ từ `mc_balance` thật trên server).
  - `components/WalletConnectModal.vue` — hiển thị trạng thái mạng (`PREPROD (TESTNET)` / `MAINNET`), hướng dẫn cài đặt Eternl chính thức khi chưa cài, thông báo lỗi rõ ràng, hiển thị số dư MC từ server.
  - `components/TempleCanvas.vue` — hiển thị đơn vị `MC` duy nhất trên thanh trạng thái, nhãn `TESTNET`, tự khôi phục phiên và tự động `rejoin` WebSocket khi đổi trạng thái đăng nhập.
  - `lib/network/MultiplayerClient.ts` — bổ sung `joinProvider` và `rejoin()` gửi kèm `ticket` xác thực một lần.
  - `server/routes/_ws.ts` — kiểm tra `ticket` khi `client:join`, đặt tên theo tài khoản đã xác thực (hoặc `"Khách xxxx"` nếu chưa đăng nhập), chặn giả mạo `id` trong gói `MSG_MOVE`, `emote`, `chat`.

## Bước 3 – Mua MC Coin bằng ADA với `@hydra-sdk/cardano-wasm` & `@hydra-sdk/core` (2026-11-05)
- **Mới:**
  - `server/utils/wallet/txBuilder.ts` — dựng giao dịch L1 chưa ký (`buildOrderUnsignedTx`) và ghép witness chữ ký ví (`attachOrderWitness`) bằng `@hydra-sdk/cardano-wasm` + `@hydra-sdk/core`, gắn metadata nhãn `8181` (`orderId`) + CIP-20 nhãn `674`, kiểm tra `txHash` chống tráo đổi nội dung giao dịch.
  - `server/utils/wallet/blockfrost.ts` — client REST đọc chuỗi Cardano qua Blockfrost (`latestBlockHeight`, `addressTransactions`, `txInfo`, `txUtxos`, `txExists`, `txMetadata`).
  - `server/utils/wallet/orders.ts` — quản lý vòng đời đơn mua MC (`createMcOrder`, `attachSubmittedTxToOrder`, `inspectAndSettleTx`, `refreshOrderOnChain`, `syncPendingOrdersFromChain`), cộng MC nguyên tử sau khi đạt `>= N` xác nhận, idempotent theo `chain_deposits.tx_hash PRIMARY KEY` và `mc_ledger UNIQUE(reason, ref_id)`, xử lý trả thiếu (`underpaid`), trả thừa (cộng theo lovelace thực nhận), đơn hết hạn vẫn có tiền về (`expired_paid`), rollback/reorg trước khi đủ xác nhận và đóng trang giữa chừng.
  - `server/api/shop/orders/index.get.ts`, `index.post.ts`, `[id].get.ts`, `[id]/build.post.ts`, `[id]/witness.post.ts`, `[id]/submit.post.ts` — các API tạo đơn, dựng tx, ghép witness, ghi nhận `txHash` và tra cứu trạng thái đơn / lịch sử nạp.
  - `server/api/shop/webhook/blockfrost.post.ts` — endpoint nhận webhook giao dịch từ Blockfrost.
  - `server/plugins/order-watcher.ts` — Nitro plugin chạy nền mỗi 15 giây quét các đơn đang chờ xác nhận và quét địa chỉ treasury.
  - `scripts/wallet/test-deposit.mjs` — bộ kiểm thử tự động 19 ca cho toàn bộ luồng mua MC bằng ADA.
- **Sửa:**
  - `package.json`, `nuxt.config.ts`, `.env.example` — thêm `@hydra-sdk/cardano-wasm@1.0.0`, `@hydra-sdk/core@1.4.1`, cấu hình `treasuryAddress`, `blockfrostApiKey`, `confirmationsRequired`, `orderTtlMinutes`.
  - `server/db/migrations.ts` — thêm migration #2 (`mc_orders`, `chain_deposits`, `mc_ledger`).
  - `lib/cardano/cip30.ts` — bổ sung `getUtxos()`, `signTx()`, `submitTx()`, mã lỗi `INSUFFICIENT_FUNDS`.
  - `stores/wallet.ts` — bổ sung `buyMcWithAda(adaAmount)`, `loadOrdersAndDeposits()`, polling trạng thái đơn mỗi 5 giây khi có đơn đang chờ xác nhận.
  - `components/WalletConnectModal.vue` — thêm tab **"Mua MC"** (gói nhanh 5/10/50/100 ADA, ô nhập số ADA nguyên >= 2, hiển thị rõ công thức quy đổi & phí mạng ~0.2 ADA, cảnh báo một chiều không đổi ngược MC ra ADA, tiến trình 4 bước trực quan, danh sách đơn & lịch sử nạp kèm liên kết Cardanoscan).
  - `components/TempleCanvas.vue` — thêm nút nhanh **"+ NẠP MC"** trên thanh trạng thái trên cùng mở thẳng tab Mua MC.

## Bước 4 – Tiêu MC Coin (Dịch vụ Ví nội bộ, Cửa hàng/Di sản, Bói quẻ, Hòm công đức) (2026-11-05)
- **Mới:**
  - `server/utils/wallet/mcService.ts` — dịch vụ ví MC trung tâm (`spend(accountId, amount, reason, refId, opts)` chạy nguyên tử trong SQLite transaction `BEGIN IMMEDIATE`, khóa cập nhật có điều kiện `WHERE id = ? AND mc_balance >= ?` chống số dư âm và chống race condition, idempotency qua `UNIQUE(reason, ref_id)` trong `mc_ledger`), danh mục cấu hình dịch vụ (`MC_SERVICES_CONFIG`), danh mục vật phẩm Cửa Hàng/Di Sản (`SHOP_CATALOG`), kho quẻ 6 phương diện sinh tại server (`FORTUNE_CORPUS`, `FORTUNE_TIERS`), và Hòm Công Đức (`MERIT_CONFIG`, tặng vật phẩm tri ân `lotus_lantern` khi công đức `>= 500 MC`).
  - `server/api/mc/catalog.get.ts` (`GET /api/mc/catalog`) — trả về cấu hình dịch vụ, danh mục vật phẩm, cấp độ quẻ, bảng vàng công đức, kho đồ và lịch sử của người chơi.
  - `server/api/mc/shop/buy.post.ts` (`POST /api/mc/shop/buy`) — mua cổ phục, lễ phẩm, thẻ bài di sản 3D bằng MC (idempotent theo `requestId`).
  - `server/api/mc/fortune/draw.post.ts` (`POST /api/mc/fortune/draw`) — gieo quẻ/xem bói bằng MC với kết quả sinh ở server và lưu lịch sử (`fortune_records`).
  - `server/api/mc/merit/donate.post.ts` (`POST /api/mc/merit/donate`) — công đức bằng MC vào Hòm Công Đức (`merit_donations`).
  - `scripts/wallet/test-spend.mjs` — bộ kiểm thử tự động 14 ca cho dịch vụ tiêu MC (mua đồ, cộng dồn lễ phẩm, chặn mua trùng cổ phục, gieo quẻ server, công đức, idempotency, bắn đồng thời 10 luồng kiểm tra chống race condition, đối soát sổ cái).
- **Sửa:**
  - `server/db/migrations.ts` — thêm migration #3 (`account_inventory`, `fortune_records`, `merit_donations`).
  - `server/utils/wallet/blockfrost.ts` — bổ sung `HttpKoiosClient` làm nhà cung cấp chỉ mục công khai dự phòng tự động khi `NUXT_BLOCKFROST_API_KEY` để trống.
  - `stores/economy.ts`, `stores/wallet.ts` — gỡ bỏ hàm trừ tiền giả lập ở client (`recordMeritDeposit`), chuyển toàn bộ sang gọi API tiêu MC phía server (`buyShopItem`, `drawFortune`, `donateMerit`, `fetchCatalog`).
  - `components/SanctuaryDrawer.vue`, `components/SanctuaryShop.vue`, `components/FortuneModal.vue`, `components/MeritBoxModal.vue`, `components/CardCollectionModal.vue`, `components/TempleCanvas.vue` — cập nhật giao diện tiêu MC đồng nhất: hiển thị giá bằng MC từ server, làm mờ nút kèm nút **"+ Nạp MC"** khi không đủ số dư, có bước xác nhận trước khi tiêu, giữ nguyên toàn bộ hiệu ứng 3D (`checkProximity`/`InteractionTarget`).

## Bước 5 – Bảo mật, Vận hành, Script Đối soát & Hoàn thiện Tài liệu (2026-11-05)
- **Mới:**
  - `scripts/wallet/reconcile.mjs` — script đối soát độc lập kiểm tra tổng lovelace nhận tại `chain_deposits` so với tổng MC phát hành trong `mc_ledger`, kiểm tra bất biến `accounts.mc_balance === SUM(mc_ledger.delta_mc)` cho từng tài khoản và liệt kê các giao dịch bất thường (`underpaid`, `expired_paid`, `unmatched`).
  - `docs/wallet/HUONG_DAN_CAI_DAT.md` — hướng dẫn cài đặt môi trường, cấu hình `.env`, tạo ví Treasury Preprod, lấy tADA Faucet, checklist chuyển sang Mainnet và quy trình chạy script đối soát.
  - `docs/wallet/HUONG_DAN_NGUOI_CHOI.md` — hướng dẫn chi tiết cho người chơi từ cài đặt ví Eternl đến nạp và tiêu MC trong chùa.
  - `README.md` — tài liệu gốc của dự án dẫn tới bộ tài liệu `docs/wallet/README.md`.
- **Sửa:**
  - `package.json` — thêm các script tiện ích `wallet:reconcile`, `wallet:test:auth`, `wallet:test:deposit`, `wallet:test:spend`.
  - `docs/wallet/README.md`, `docs/wallet/KIEN_TRUC.md`, `docs/wallet/TEST_REPORT.md` — hoàn thiện toàn bộ sơ đồ Mermaid 3 nghiệp vụ, lược đồ CSDL, danh mục API, mô hình mối đe dọa (Threat Model) và bằng chứng đối soát thực tế trên Preprod.

## Bước 6 – Tích hợp Hybrid Cardano Hydra L2 cho Sổ cái MC Coin (2026-11-05)
- **Kiến trúc:** SQLite `mc_ledger` vẫn là nguồn sự thật. Khi `HYDRA_L2_ENABLED=true` và Head ở trạng thái `Open`, mỗi giao dịch cộng/trừ MC sau khi commit được phản chiếu thành một L2 tx phí 0 (inline datum "State UTxO" + metadata CIP-20 nhãn 674), ký bằng Session Key do server dẫn xuất, gửi qua WebSocket `NewTx`. `TxValid`/`SnapshotConfirmed` cập nhật `hydra_tx_hash`, `hydra_snapshot_no`, `hydra_status`. Tắt hoặc mất kết nối → tự động fallback `offchain`, không ảnh hưởng nghiệp vụ.
- **Mới:**
  - `server/utils/hydra/{config,hydraClient,l2TxBuilder,sessionKey,hydraQueue}.ts` — cấu hình, client WS (WebSocket toàn cục của Node, tự reconnect), dựng/ký L2 tx bằng `@hydra-sdk/cardano-wasm`, khóa phiên + Fuel Pool, hàng đợi tuần tự theo tài khoản.
  - `server/plugins/hydra-l2.ts`, `server/api/hydra/status.get.ts` — khởi động client và API trạng thái.
  - `components/HydraBadge.vue` — huy hiệu `⚡ Hydra L2 Verified · Snapshot #N · Tx: abcd…wxyz`.
  - `scripts/hydra-mock-server.mjs` — hydra-node giả lập (Greetings, GetUTxO, NewTx → TxValid/SnapshotConfirmed/TxInvalid); chạy bằng `npm run hydra:mock`.
  - `scripts/wallet/test-hydra-l2.mjs` — 11 ca kiểm thử E2E (`npm run wallet:test:hydra`, **11/11 PASS**).
- **Sửa:**
  - `server/db/migrations.ts` — migration #4: `mc_ledger.hydra_tx_hash/hydra_snapshot_no/hydra_status`, `accounts.l2_session_vkey/l2_address`.
  - `server/utils/wallet/mcService.ts`, `orders.ts`, `server/api/auth/verify.post.ts` — hook sau commit; `server/api/mc/{fortune/draw,merit/donate,shop/buy}.post.ts` trả thêm `hydra` proof.
  - `stores/economy.ts`, `components/SanctuaryDrawer.vue`, `components/WalletConnectModal.vue` — hiển thị badge và dòng trạng thái Hydra.
  - `nuxt.config.ts`, `.env.example`, `package.json` — biến môi trường `HYDRA_L2_ENABLED`, `HYDRA_NODE_WS_URL`, `NUXT_HYDRA_SESSION_SECRET`, `NUXT_HYDRA_STATE_LOVELACE`, `NUXT_HYDRA_FUEL_TARGET`, `NUXT_HYDRA_SUBMIT_TIMEOUT_MS` và script mới.
- **Lưu ý:** mặc định tắt (`HYDRA_L2_ENABLED=false`). `test-spend.mjs` còn kỳ vọng cũ (bói quẻ 100 MC) trong khi giá hiện hành là 50 MC — không liên quan Hydra.

### Bổ sung: hydra-node thật (offline mode) bằng Docker
- **Mới:** `docker-compose.hydra.yml`, `scripts/hydra-prepare.mjs`, npm scripts `hydra:prepare|up|down|logs`, `.gitignore` thêm `.hydra-offline/`, `/api/hydra/status` trả thêm `fuelAddress`.
- **Đã chạy thật:** hydra-node `0.22.4` offline → Head `Open`; nạp +2000 MC, gieo quẻ −50, cúng dường −50 đều `snapshot_confirmed` (snapshot #2–#4, `invalid=0`); State UTxO trên Head có inline datum `[balance_after, ledger_id, delta_mc, account_id]` khớp SQLite (ví dụ `[1100, 4, -800, 1]`), 3 Fuel UTxO được tách tự động.
- **Lỗi đã gặp:** image `2.4.2` thoát exit code 132 (SIGILL) trên CPU không có AVX2 → restart loop; đã chuyển sang `0.22.4`.

### Bổ sung: hiển thị chế độ sổ cái trên giao diện (Hydra L2 / SQLite)
- **Chỉ báo toàn cục (HUD):** huy hiệu 'Hydra L2' (xanh) hoặc 'SQLite' (xám) cạnh nút ví trong `components/TempleCanvas.vue`; di chuột để xem giải thích. Dữ liệu từ `stores/hydra.ts` (thăm dò `/api/hydra/status` mỗi 15 giây).
- **Huy hiệu từng giao dịch:** `components/HydraBadge.vue` viết lại dùng `UiBadge`: 'Hydra L2 · Snapshot #N · Tx abcd…wxyz' khi đã xác nhận, 'SQLite · Ghi ở sổ cái cục bộ' khi giao dịch chỉ nằm ở SQLite. Hiện ở kết quả gieo quẻ, cúng dường, mua đồ và mở khóa thẻ (`components/SanctuaryDrawer.vue`).
- **Lịch sử:** `getMcOverviewAndHistory` trả thêm `hydra` cho mỗi quẻ trong `fortuneHistory` (JOIN `mc_ledger`); lượt miễn phí 0 MC không có bút toán nên không hiện huy hiệu. Danh sách lịch sử quẻ hiện huy hiệu rút gọn.
- **Kiểm tra:** `npm run build` OK; `npm run wallet:test:hydra` 11/11 PASS.

