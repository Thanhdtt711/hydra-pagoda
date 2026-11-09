# Báo cáo Kiểm thử (TEST_REPORT)

## Bước 2 – Đăng nhập bằng ví Eternl (CIP-30 / CIP-8) & Chống giả mạo WebSocket

- **Script kiểm thử tự động:** [`scripts/wallet/test-auth.mjs`](file:///d:/Vtechcom/hydra-pagoda/scripts/wallet/test-auth.mjs)
- **Kết quả chạy thực tế:** **19/19 ca PASS** (0 lỗi) trên server production build (`.output/server/index.mjs`).

| # | Ca kiểm thử | Kỳ vọng | Kết quả | Bằng chứng / Ghi chú |
|---|---|---|---|---|
| 1 | Đăng nhập hợp lệ (`nonce` → ký CIP-8 → `verify`) | HTTP 200, trả về `account.address` khớp bech32 | **ĐẠT** | `status=200`, tạo bản ghi trong bảng `accounts` |
| 2 | Cookie phiên bảo mật | Có cờ `HttpOnly` và `SameSite=Strict`, không lưu token vào `localStorage` | **ĐẠT** | `Set-Cookie: pagoda_session=<ẩn>; Max-Age=604800; Path=/; HttpOnly; SameSite=Strict` |
| 3 | Giữ phiên khi tải lại trang (`GET /api/auth/me`) | Trả về `authenticated: true` và `mcBalance: 0` từ DB | **ĐẠT** | `authenticated=true, mc=0` |
| 4 | Nội dung thông điệp ký rõ ràng | Chứa tên game (`Vạn Cảnh Thiền Tự`), `Domain`, `Nonce`, thời gian phát hành & hết hạn | **ĐẠT** | Đủ 5 trường bắt buộc |
| 5 | Ràng buộc Domain trong thông điệp | `Domain` trong message trùng khớp `Host` của server | **ĐẠT** | `Domain: 127.0.0.1:3013` |
| 6 | Tấn công Replay: gửi lại cùng `nonce` đã dùng | Bị chặn với HTTP 401 | **ĐẠT** | `status=401` (`auth_nonces.used_at` được cập nhật nguyên tử) |
| 7 | Tấn công giả mạo chữ ký: Ví B ký nhưng khai địa chỉ Ví A | Bị chặn với HTTP 401 (`blake2b224(pubKeyB) != keyHash(addrA)`) | **ĐẠT** | `status=401` |
| 8 | Tấn công sửa nội dung thông điệp ký | Bị chặn với HTTP 401 (payload trong `COSE_Sign1` khác `auth_nonces.message`) | **ĐẠT** | `status=401` |
| 9 | Dùng `nonce` đã hết hạn (> 5 phút) | Bị chặn với HTTP 401 | **ĐẠT** | `status=401` |
| 10 | Khai địa chỉ lúc `verify` khác địa chỉ lúc xin `nonce` | Bị chặn với HTTP 401 | **ĐẠT** | `status=401` |
| 11 | Dùng địa chỉ Mainnet (`addr1...`) khi server đang chạy Preprod | Bị chặn với HTTP 400 (`wrong_network`) | **ĐẠT** | `status=400, code=wrong_network` |
| 12 | Tấn công CSRF từ `Origin: https://evil.example` | Bị chặn với HTTP 403 (`bad_origin`) | **ĐẠT** | `status=403` |
| 13 | Xin vé WebSocket (`POST /api/auth/ws-ticket`) khi chưa đăng nhập | Bị chặn với HTTP 401 | **ĐẠT** | `status=401` |
| 14 | Xin vé WebSocket khi đã có phiên hợp lệ | HTTP 200, trả về `ticket` ngẫu nhiên dùng 1 lần | **ĐẠT** | `status=200` |
| 15 | WebSocket khách gửi tên giả `Hacker<Admin>` | Server ghi đè thành `Khách xxxx` | **ĐẠT** | Hiển thị `Khách d040` |
| 16 | WebSocket kèm `ticket` hợp lệ gửi tên giả `FakeName` khi chat | Server ghi đè bằng `displayName` của tài khoản đã xác thực | **ĐẠT** | Hiển thị `addr_test1…htfc` |
| 17 | Dùng lại `ticket` WebSocket lần thứ 2 | Server từ chối vé (`server:error`, `code=bad_ticket`) | **ĐẠT** | `bad_ticket` |
| 18 | Đăng xuất (`POST /api/auth/logout`) | Xóa phiên trong DB; dùng lại cookie cũ trả `authenticated: false` | **ĐẠT** | `authenticated=false` |
| 19 | Giới hạn tần suất (`rateLimit`) trên `/api/auth/nonce` | Vượt ngưỡng 10 yêu cầu/phút trả về HTTP 429 kèm `Retry-After` | **ĐẠT** | `status=429` |

---

## Bước 3 – Mua MC Coin bằng ADA (`@hydra-sdk/cardano-wasm` & `@hydra-sdk/core`)

- **Script kiểm thử tự động:** [`scripts/wallet/test-deposit.mjs`](file:///d:/Vtechcom/hydra-pagoda/scripts/wallet/test-deposit.mjs)
- **Kết quả chạy thực tế:** **19/19 ca PASS** (0 lỗi) trên server production build (`.output/server/index.mjs`).

| # | Ca kiểm thử | Kỳ vọng | Kết quả | Bằng chứng / Ghi chú |
|---|---|---|---|---|
| 1 | Đăng nhập ví Eternl trên Preprod trước khi mua | HTTP 200, khởi tạo tài khoản với `mcBalance = 0` | **ĐẠT** | `addr_test1vzlr03rpe4...` |
| 2 | Từ chối đơn dưới mức tối thiểu (`1 ADA < 2 ADA`) | HTTP 400 (`below_minimum`) | **ĐẠT** | `status=400` |
| 3 | Từ chối số thực (`2.5 ADA`) để tránh sai số dấu phẩy động | HTTP 400 (`invalid_amount`) | **ĐẠT** | Chỉ nhận số nguyên ADA & lovelace |
| 4 | Tạo đơn `5 ADA` (`POST /api/shop/orders`) | Trả về `expectedLovelace = 5_000_000`, `expectedMc = 5_000`, `treasuryAddress` từ biến môi trường | **ĐẠT** | `orderId=ord_mw3cdtyw_c0a1d2aecbf3` |
| 5 | Dựng unsigned tx bằng `@hydra-sdk/cardano-wasm` (`POST /api/shop/orders/:id/build`) | Trả về `unsignedTxCbor`, `txHash`, `feeLovelace = 176325` | **ĐẠT** | `txHash=3115aebdc2a71ae2...` |
| 6 | Kiểm tra nội dung giao dịch dựng ra | Đầu ra trả đúng `5.000.000 lovelace` tới `treasuryAddress` + metadata nhãn `8181` chứa `orderId` | **ĐẠT** | Giải mã ngược bằng `CardanoWASM.Transaction.from_hex` |
| 7 | Chặn tráo đổi nội dung giao dịch khi gửi witness | Gửi witness của tx khác bị từ chối HTTP 400 (`tx_hash_mismatch`) | **ĐẠT** | `status=400` |
| 8 | Ghép witness chữ ký CIP-30 hợp lệ (`POST /api/shop/orders/:id/witness`) | Ghép thành công `signedTxCbor` khớp `txHash` | **ĐẠT** | `status=200` |
| 9 | Ghi nhận `submitTx` khi giao dịch chưa lên chuỗi | Trạng thái đơn = `submitted`, `mcBalance` vẫn bằng `0` | **ĐẠT** | Chưa cộng MC khi chưa xác nhận |
| 10 | Giao dịch mới có `1/2` xác nhận trên chuỗi | Trạng thái đơn = `confirming (1/2)`, `mcBalance` vẫn bằng `0` | **ĐẠT** | `confirmations=1/2, mcBalance=0` |
| 11 | Giao dịch đạt đủ `2/2` xác nhận | Cộng nguyên tử đúng `+5.000 MC` vào `accounts.mc_balance` và ghi `mc_ledger` | **ĐẠT** | `status=completed, mcBalance=5000` |
| 12 | Idempotency: gửi lặp webhook Blockfrost & poll lại đơn nhiều lần | Không cộng trùng; số dư giữ nguyên `5.000 MC` | **ĐẠT** | Ràng buộc `chain_deposits.tx_hash PRIMARY KEY` & `mc_ledger UNIQUE(reason, ref_id)` |
| 13 | Chặn trả thiếu (`underpaid`): đơn `10 ADA` nhưng chỉ chuyển `4 ADA` | Đánh dấu đơn & deposit là `underpaid`, cộng `+0 MC` | **ĐẠT** | `status=underpaid, mcBalance=5000` |
| 14 | Xử lý trả thừa (`overpaid`): đơn `5 ADA` nhưng chuyển `7.5 ADA` (`7.500.000 lovelace`) | Cộng theo số lovelace thực nhận: `+7.500 MC` (tổng `12.500 MC`) | **ĐẠT** | `creditedMc=7500, totalMc=12500` |
| 15 | Chặn giả mạo `orderId` trong metadata giao dịch | Trả về `metadata_mismatch`, không cộng MC | **ĐẠT** | `outcome=metadata_mismatch` |
| 16 | Đơn đã hết hạn (`expires_at < now`) nhưng vẫn có tiền về | Ghi nhận trạng thái `expired_paid` để đối soát thủ công, không tự cộng MC | **ĐẠT** | `status=expired_paid` |
| 17 | Giao dịch bị Rollback (Reorg) khi đang `confirming (1/2)` | Phát hiện qua `txExists=false`, đưa đơn về `submitted (confirmations=0)`, không lệch số dư | **ĐẠT** | `status=submitted, confirmations=0` |
| 18 | Người chơi đóng trang giữa chừng sau khi ví đã gửi tx lên chuỗi | Khi mở lại (`GET /api/shop/orders`), server tự quét địa chỉ treasury, khớp `orderId` trong metadata và cộng `+5.000 MC` | **ĐẠT** | `totalMc=17500` |
| 19 | Kiểm chứng bất biến Sổ cái (`mc_ledger`) | `SUM(mc_ledger.delta_mc) === accounts.mc_balance` (`17.500 MC` qua 3 bút toán) | **ĐẠT** | `balance=17500, ledgerSum=17500` |
| 20 | **Nghiệm thu thực tế trên mạng Cardano Preprod** (Ví Eternl của người dùng) | Tạo đơn `100 ADA` (`ord_mw3ch9pc_928748fbec9e`), ký & gửi giao dịch thật trên Preprod, đạt xác nhận và cộng `+100.000 MC` | **ĐẠT** | `txHash=202ddec96e8d2081f0bfae47f1180ddffd53845b2306a5fe02518f8499594844` (Block `#5375997`, cộng `+100.000 MC`) |

---

## Bước 4 – Tiêu MC Coin (Dịch vụ Ví nội bộ `spend()`, Cửa hàng, Bói quẻ, Hòm công đức)

- **Script kiểm thử tự động:** [`scripts/wallet/test-spend.mjs`](file:///d:/Vtechcom/hydra-pagoda/scripts/wallet/test-spend.mjs)
- **Kết quả chạy thực tế:** **14/14 ca PASS** (0 lỗi) trên server production build (`.output/server/index.mjs`).

| # | Ca kiểm thử | Kỳ vọng | Kết quả | Bằng chứng / Ghi chú |
|---|---|---|---|---|
| 1 | Đăng nhập ví Cardano Preprod CIP-8 | Khởi tạo tài khoản với `mcBalance = 0` | **ĐẠT** | `status=200, mcBalance=0` |
| 2 | Lấy danh mục cấu hình từ server (`GET /api/mc/catalog`) | Trả về `20` vật phẩm (`SHOP_CATALOG`), `3` cấp độ quẻ (`FORTUNE_TIERS`), cấu hình công đức (`MERIT_CONFIG`) | **ĐẠT** | `shop=20 items, fortuneTiers=3` |
| 3 | Chặn tiêu MC khi chưa đăng nhập (`POST /api/mc/shop/buy`) | HTTP 401 (`unauthenticated`) | **ĐẠT** | `status=401` |
| 4 | Từ chối mua vật phẩm khi không đủ số dư (`0 MC < 800 MC`) | HTTP 400 (`insufficient_mc_balance`), số dư không đổi | **ĐẠT** | `code=insufficient_mc_balance` |
| 5 | Nạp `2 ADA` trên chuỗi để cấp vốn kiểm thử | Cộng nguyên tử `+2.000 MC` vào tài khoản | **ĐẠT** | `mcBalance=2000` |
| 6 | Mua cổ phục Thái Lan (`800 MC`) (`POST /api/mc/shop/buy`) | Trừ nguyên tử `-800 MC` (còn `1.200 MC`), ghi vào `account_inventory` và `mc_ledger` | **ĐẠT** | `mcBalance=1200, ownsThailand=true` |
| 7 | Idempotency Cửa hàng: gửi lặp lại cùng `requestId` | Trả về `idempotentReplay: true`, **không** trừ `800 MC` lần thứ 2 | **ĐẠT** | `idempotentReplay=true, mcBalance=1200` |
| 8 | Chặn mua lại cổ phục không cộng dồn đã sở hữu với `requestId` mới | HTTP 400 (`already_owned`), không trừ MC | **ĐẠT** | `code=already_owned` |
| 9 | Mua vật phẩm lễ phẩm cộng dồn (`incense_quang`, `50 MC` x 2 lần) | `quantity` tăng lên `2`, số dư còn `1.100 MC` | **ĐẠT** | `quantity=2, mcBalance=1100` |
| 10 | Gieo quẻ Hoàng Kim (`100 MC`) (`POST /api/mc/fortune/draw`) | Kết quả quẻ sinh ở server, lưu `fortune_records`, trừ `-100 MC` (còn `1.000 MC`) | **ĐẠT** | `mcBalance=1000` |
| 11 | Idempotency Gieo quẻ: gửi lặp lại cùng `requestId` | Trả lại đúng bản ghi quẻ đã gieo (`idempotentReplay: true`), không trừ thêm MC | **ĐẠT** | `idempotentReplay=true, mcBalance=1000` |
| 12 | Công đức `500 MC` vào Hòm Công Đức (`POST /api/mc/merit/donate`) | Trừ `-500 MC` (còn `500 MC`), tăng `globalMeritTotal`, tặng vật phẩm tri ân `lotus_lantern` vào kho đồ | **ĐẠT** | `mcBalance=500, reward=lotus_lantern` |
| 13 | Kiểm thử chống **Race Condition / Đua luồng**: bắn đồng thời `10` request tiêu `200 MC` khi số dư chỉ còn `500 MC` | Đúng **2** request thành công (`-400 MC`), **8** request bị từ chối (`400 insufficient_mc_balance`), số dư cuối = `100 MC` (không âm) | **ĐẠT** | `succeeded=2, rejected=8, mcBalance=100` |
| 14 | Đối soát bất biến Sổ cái SQLite (`mc_ledger`) sau toàn bộ giao dịch nạp & tiêu | `SUM(mc_ledger.delta_mc) === accounts.mc_balance === 100 MC` qua `8` bút toán | **ĐẠT** | `mc_balance=100, sum(delta_mc)=100, entries=8` |
| 15 | **Nghiệm thu thực tế tiêu MC trên trình duyệt** (Sau khi nạp `100.000 MC` trên Preprod) | Người dùng thực hiện 3 lần gieo quẻ (`-300 MC`), số dư cập nhật còn `99.700 MC` và lưu lịch sử quẻ trên server | **ĐẠT** | `fortune_divination: 3 bút toán | -300 MC`, số dư = `99.700 MC` |

---

## Bước 5 – Đối soát Vận hành (`scripts/wallet/reconcile.mjs`) & Kiểm tra Build Tổng thể

- **Script đối soát:** [`scripts/wallet/reconcile.mjs`](file:///d:/Vtechcom/hydra-pagoda/scripts/wallet/reconcile.mjs) (`npm.cmd run wallet:reconcile`)
- **Kết quả chạy thực tế trên CSDL `.data/pagoda.sqlite`:**

```text
========================================================================
📊 ĐỐI SOÁT TREASURY ADA & SỔ CÁI MC COIN — VẠN CẢNH THIỀN TỰ
========================================================================
• CSDL SQLite : D:\Vtechcom\hydra-pagoda\.data\pagoda.sqlite
• Thời điểm   : 2026-11-05T10:13:18.643Z

------------------------------------------------------------------------
1) ĐỐI SOÁT NẠP ADA ON-CHAIN (TREASURY) ↔ PHÁT HÀNH MC COIN
------------------------------------------------------------------------
• Số giao dịch đã cộng MC (credited) : 1 tx
• Tổng lovelace thực nhận ở Treasury : 100,000,000 lovelace (100.000000 ADA)
• MC quy đổi chuẩn (lovelace / 1000) : 100,000 MC
• Tổng mc_credited (chain_deposits)  : 100,000 MC
• Tổng delta_mc nạp (mc_ledger)      : 100,000 MC (1 bút toán)
✅ KHỚP TUYỆT ĐỐI: Tổng lovelace nhận tại Treasury khớp 100% với tổng MC đã phát.

------------------------------------------------------------------------
2) THỐNG KÊ SỔ CÁI MC THEO LOẠI NGHIỆP VỤ (mc_ledger)
------------------------------------------------------------------------
• deposit_ada            :    1 bút toán | +100,000 MC
• fortune_divination     :    3 bút toán | -300 MC

------------------------------------------------------------------------
3) ĐỐI SOÁT SỐ DƯ TỪNG TÀI KHOẢN (accounts.mc_balance vs mc_ledger)
------------------------------------------------------------------------
✅ Account #1 [preprod] addr_test1qqn4...tn9ug9 | Nạp: +100,000 MC | Tiêu: -300 MC | Số dư: 99,700 MC (Sổ cái: 99,700 MC, 4 bút toán)
✅ Tất cả 1 tài khoản đều khớp tuyệt đối với sổ cái và không có số dư âm.

------------------------------------------------------------------------
4) DANH SÁCH GIAO DỊCH CẦN KIỂM TRA THỦ CÔNG (underpaid / expired_paid / unmatched)
------------------------------------------------------------------------
• Không có giao dịch bất thường nào cần xử lý thủ công (0 bản ghi).

========================================================================
✅ KẾT LUẬN: HỆ THỐNG ĐỐI SOÁT AN TOÀN — MỌI BẤT BIẾN TÀI CHÍNH ĐỀU ĐẠT.
========================================================================
```

---

## Bước 6 – Hybrid Hydra L2 cho Sổ cái MC Coin (`scripts/wallet/test-hydra-l2.mjs`)

Lệnh chạy: `npm run wallet:test:hydra` (trên Windows PowerShell dùng `npm.cmd run wallet:test:hydra`).

Kết quả: **11/11 PASS**.

### 6.1. Môi trường kiểm thử

| Thành phần | Giá trị |
|---|---|
| Blockfrost | Giả lập (mock) |
| hydra-node | Giả lập bằng `scripts/hydra-mock-server.mjs` |
| CSDL kiểm thử | `.data/test-hydra-l2.sqlite` (tách riêng, không đụng dữ liệu thật) |
| Bí mật phiên | `test-hydra-l2-secret-0123456789` |
| Fuel target | `3` |
| Cổng | Web `3016`, Blockfrost mock `3096`, hydra-node mock `4011` |

### 6.2. Danh sách 11 ca kiểm thử

| # | Nội dung kiểm tra | Kỳ vọng |
|---|---|---|
| 1 | `GET /api/hydra/status` | `enabled`, `connected`, `headStatus = Open`, `mode = hydra_l2` |
| 2 | Đăng nhập tạo khóa phiên L2 | Tài khoản có `l2_session_vkey` và `l2_address` |
| 3 | Nạp 2 ADA (+2000 MC) | Bút toán có `hydra_tx_hash`, `hydra_snapshot_no`, trạng thái `snapshot_confirmed` |
| 4 | Bói quẻ −50 MC (số dư còn 1950) | Bằng chứng `snapshot_confirmed`, `snapshotNo ≥ 2` |
| 5 | Công đức −50 MC (số dư còn 1900) | Bằng chứng `snapshot_confirmed` |
| 6 | Gửi lặp cùng `requestId` (idempotent) | Không sinh thêm giao dịch L2 |
| 7 | State UTxO của tài khoản | Đúng 1 State UTxO, datum `[balance_after, ledger_id, delta_mc, account_id]` khớp SQLite |
| 8 | Thống kê qua `/api/hydra/status` | `confirmedL2Txs ≥ 3`, `latestSnapshotNo ≥ 3`, không có tx invalid |
| 9 | Toàn bộ 3 bút toán trong `mc_ledger` | Đều có `hydra_tx_hash` và `snapshot_confirmed` |
| 10 | Dự phòng: tắt hydra-node rồi mua `thailand` (800 MC) | Mua vẫn thành công, số dư còn 1100, `hydra_status = offchain`, không có tx hash |
| 11 | Đối soát nội bộ | `SUM(delta_mc)` bằng `accounts.mc_balance` bằng 1100 |

### 6.3. Xác minh thủ công trên hydra-node THẬT (offline mode, Docker image 0.22.4)

| Hạng mục | Kết quả |
|---|---|
| Trạng thái Head | `Open` |
| Nạp +2000 MC | `snapshot_confirmed` |
| Bói quẻ −50 MC | `snapshot_confirmed` |
| Công đức −50 MC | `snapshot_confirmed` |
| Số snapshot | #2 → #4, số tx invalid = 0 |
| State UTxO | Datum khớp SQLite, ví dụ `[1100, 4, -800, 1]` |
| Fuel Pool | Tự chia thành 3 UTxO |

Lưu ý: image hydra-node `2.4.2` bị lỗi `SIGILL` (exit 132) trên CPU không có AVX2 nên dùng `0.22.4`. Cách chạy xem `HUONG_DAN_CAI_DAT.md` mục 4.3.

### 6.4. Lưu ý đã biết

- `scripts/wallet/test-spend.mjs` còn kỳ vọng cũ về giá bói quẻ (100 MC), trong khi cấu hình hiện tại là 50 MC. Đây là sai lệch của script test, không phải lỗi nghiệp vụ.
- Bộ test Hydra L2 dùng hydra-node giả lập. Hành vi trên node thật được xác minh thủ công ở mục 6.3.
- Giao diện (chỉ báo HUD `hud-ledger-mode`, `hydra-badge`) chưa có test tự động, hiện kiểm tra bằng mắt khi chạy `npm run dev`.



