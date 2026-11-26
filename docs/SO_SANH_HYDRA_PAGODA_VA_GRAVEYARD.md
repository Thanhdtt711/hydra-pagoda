# So Sánh Kiến Trúc Blockchain & Kinh Tế: `hydra-pagoda` vs `hydra-graveyard`

Tài liệu này tổng hợp các điểm **giống nhau** và **khác nhau** về kiến trúc Web3, nền kinh tế in-game, Hydra Head L2 và định hướng phát triển on-chain giữa hai dự án cùng hệ sinh thái Cardano/Hydra:
- **Vạn Cảnh Thiền Tự (`hydra-pagoda`)**
- **Onchain Graveyard (`hydra-graveyard`)**

---

## 1. Bảng So Sánh Tổng Quan

| Tiêu chí | `hydra-pagoda` (Vạn Cảnh Thiền Tự) | `hydra-graveyard` (Onchain Graveyard) |
| :--- | :--- | :--- |
| **Thể loại & Trải nghiệm** | 3D WebGL Virtual Sacred Pilgrimage & Zen Sanctuary (chánh điện 3D, bói quẻ 6 môn, thiền 432Hz, hầu đồng, cờ dân gian, thẻ di sản 3D). | 3D/2.5D Isometric Graveyard mini-game (khắc bia mộ vĩnh viễn, dâng nến/hoa tưởng niệm, đảo kỷ vật). |
| **Frontend Stack** | Nuxt 3 SPA (`ssr: false`), Vue 3, Pinia, Three.js, Tailwind CSS v4. | Nuxt 4 SPA (`ssr: false`), Vue 3, Pinia, Three.js (đang nâng cấp từ PixiJS 2D). |
| **Đơn vị kinh tế nội bộ** | **Merit Coin (MC)**: `1 ADA = 1.000 MC` (số nguyên, một chiều, không đổi ngược ra ADA). | **Grave Credit (GC)**: `1 ADA = 1.000 GC` (số nguyên, một chiều, prepaid & non-refundable). |
| **Nạp ADA trên Cardano L1** | Chuyển ADA trực tiếp vào địa chỉ ví kho bạc (`NUXT_TREASURY_ADDRESS`) kèm Metadata `#8181`; backend đối chiếu qua Blockfrost/Koios rồi cộng MC vào DB. | Chuyển ADA trực tiếp vào địa chỉ ví nhận của operator (`receiving address`), không qua custody smart contract ở bản MVP; backend đối chiếu Blockfrost rồi cộng GC vào PostgreSQL. |
| **Xác thực ví (CIP-30 / CIP-8)** | Ký thông điệp nonce bằng `COSE_Sign1` (Ed25519), xác minh `blake2b_224(vk) == keyHash(address)`, cấp phiên cookie `httpOnly`. Hỗ trợ thêm **HydraOne Wallet Bridge** trong iframe. | Ký `COSE_Sign1` (Ed25519) theo mô hình 2 tầng (AD-18): thao tác nghi lễ bật popup `signData`, thao tác nhỏ ký bằng khóa tạm thiết bị. |
| **Cơ sở dữ liệu (Read/Write Model)** | Lớp CSDL kép **PostgreSQL (Supabase Pooler)** hoặc **SQLite WAL** (15 bản migration). | **PostgreSQL** lưu read-model cho frontend hiển thị. |
| **Hydra Head L2 (Giai đoạn hiện tại)** | **Hybrid Notary Mode** chạy trực tiếp trên **Hexcore (`hydra-node v2.4.2`)** hoặc node cục bộ: mỗi bút toán MC sinh giao dịch Conway-era (`NewTx`, phí `0`, `State UTxO` + Inline Datum `Constr 0 [...]` + Metadata CIP-20 `#674`). | **Notary Receipt Mode** chạy trên Hydra Head phí `0` ở giai đoạn MVP; đồng thời đã chuẩn bị bộ validator Aiken cho bước lật sang non-custodial. |
| **Smart Contract / On-chain Assets** | Chưa có custody contract cho MC; định hướng bước tiếp theo là **Mint Thẻ Bài Di Sản thành NFT chuẩn CIP-68 thật trên Cardano L1** (Reference Token `000643b0` + User Token `000de140`) để người chơi sở hữu thật trong ví. | Đã viết bộ **Aiken v1.1.21 (Plutus V3)** gồm `session_vault.ak`, `grave_mint.ak`, `graveyard_vault.ak` (mint bia mộ dạng **Soulbound** khóa trong vault bên trong Hydra Head, chưa nối end-to-end vào engine). |

---

## 2. Những Điểm Giống Nhau Cốt Lõi

1. **Cùng mô hình Hybrid Web3 Gaming (Server-Authoritative + L1 Deposit + Hydra L2):**
   - Cả hai dự án đều không ép người chơi ký giao dịch L1 tốn phí gas cho mỗi thao tác nhỏ trong game. Thay vào đó, người chơi nạp **ADA thật một lần trên Cardano L1** (tỷ lệ `1 ADA = 1.000 đơn vị điểm`) rồi chi tiêu tức thì trong game với **0 phí gas, 0 popup**.
2. **Cùng bộ SDK Cardano/Hydra:**
   - Đều dùng hệ sinh thái `@hydra-sdk/*` (`@hydra-sdk/cardano-wasm`, `@hydra-sdk/core`), không thao tác thủ công bằng thư viện cũ.
3. **Cùng cơ chế chống cộng trùng & bảo toàn số dư:**
   - Đều lưu khóa duy nhất theo `tx_hash` nạp L1 (`chain_deposits` / `bridge_deposits`), dùng số nguyên tuyệt đối cho tiền tệ, và có cơ chế xác thực chữ ký CIP-8 (`COSE_Sign1`) khớp với ví thật như Eternl/Lace.
4. **Cùng dùng Hydra Head L2 để công chứng hoạt động trong game:**
   - Cả hai đều có giao diện bảng **HYDRA HEAD** hiển thị trạng thái `OPEN`, số `UTxO`, tổng ADA khóa, tốc độ `ms/tx` và danh sách giao dịch L2 gần nhất (`IN-HEAD ACTIVITY`).

---

## 3. Những Điểm Khác Nhau Chính

1. **Hướng đi On-chain Asset (CIP-68 L1 NFT vs Soulbound trong Hydra Head):**
   - **`hydra-graveyard`** tập trung vào **tính vĩnh cửu không thể chuyển nhượng (Soulbound)** của bia mộ ngay bên trong Hydra Head (dùng `grave_mint.ak` + `graveyard_vault.ak` không có nhánh burn và không rút ra L1).
   - **`hydra-pagoda`** có bộ sưu tập **Thẻ Bài Di Sản Cổ Tự 3D** (`card_inventory`), phù hợp nhất với chuẩn **CIP-68 NFT thật trên Cardano L1**: người chơi sau khi sưu tầm thẻ trong game có thể bấm **Đúc NFT CIP-68**, nhận **User Token `(222)`** trực tiếp về ví Eternl/Lace để trưng bày trên Cardanoscan/Pool.pm hoặc trao đổi tự do, trong khi **Reference Token `(100)`** mang **Inline Datum CIP-68** lưu siêu dữ liệu chuẩn on-chain.
2. **Mức độ tích hợp Hydra Head v2 (Hexcore) & Hệ sinh thái Gameplay:**
   - **`hydra-pagoda`** đã chạy thông suốt trực tiếp với **Hexcore Managed Hydra (`hydra-node 2.4.2`)** qua cả WebSocket và HTTP REST `/socket/*`, tự động commit Fuel L1 bằng `npm run hydra:commit`, đọc nóng `.env`, và kết nối trực tiếp vào **HydraOne Wallet Bridge** khi chạy trong iframe.
   - **`hydra-graveyard`** đang phát triển sâu về kiểm chứng chữ ký `COSE_Sign1` trực tiếp trong Plutus V3 (`lib/cose.ak`, `session_vault.ak`) để tiến tới kiến trúc non-custodial hoàn toàn cho số dư GC bên trong Head.

---

## 4. Kết Luận & Định Hướng Triển Khai Cho `hydra-pagoda`

Với mô hình hiện tại, `hydra-pagoda` đã đạt chuẩn **Hybrid Cardano dApp (powered by Hydra L2)**. Để tiến thêm một bước rõ ràng về quyền sở hữu tài sản số thực thụ cho người chơi mà vẫn giữ nguyên tốc độ mượt mà của MC + Hydra L2, bước triển khai ưu tiên là:

> **Mint Thẻ Bài Di Sản Cổ Tự thành NFT chuẩn CIP-68 thật trên Cardano L1 (Preprod / Mainnet):**
> - Giữ nguyên hệ thống sưu tầm & Gacha bằng MC + Hydra L2.
> - Bổ sung nút **"Đúc NFT CIP-68"** ngay trên màn hình chi tiết từng Thẻ Bài Di Sản đã sở hữu (`CardDetailViewer.vue`).
> - Giao dịch Mint L1 tạo đồng thời **2 token theo chuẩn CIP-68**:
>   - **Reference NFT (`000643b0` — label 100):** Gửi về địa chỉ lưu trữ siêu dữ liệu (`NUXT_TREASURY_ADDRESS` / Reference Store) kèm **Plutus Inline Datum CIP-68** (`Constr 0 [metadataMap, version=1, extra]`) chứa `name`, `image`, `mediaType`, `description`, `rarity`, `pagoda`, `cardId`.
>   - **User NFT (`000de140` — label 222):** Gửi thẳng về **ví Cardano của người chơi** (hiển thị ngay trong ví Eternl / Lace và Cardanoscan).
> - Đính kèm chữ ký Policy Key của máy chủ (server co-sign) + chữ ký trả phí gas L1 của người chơi (CIP-30 `signTx`), sau đó xác nhận on-chain và cập nhật `card_inventory.is_nft_minted = 1` & `nft_asset_id`.
