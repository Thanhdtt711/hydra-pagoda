# Bản đồ code (Giai đoạn 1.1)

Bản đồ này chỉ ghi những gì đã đọc hoặc đo trực tiếp. Mục nào chưa kiểm chứng thì ghi rõ. Chưa quét mã chết và chưa đo hàm dài nhất trên toàn repo.

## Luồng phụ thuộc chính

- `components/TempleCanvas.vue` (HUD, vòng đời cảnh) điều khiển `lib/world3d/TempleStage.ts` (render, di chuyển, va chạm) và mở `SanctuaryDrawer.vue`, `AbbotChatDrawer.vue`. Hai drawer này giờ được tải theo yêu cầu.
- Store Pinia (`stores/*`) gọi Nitro API `server/api/mc/*`, `server/api/auth/*`, `server/api/shop/*`. API gọi `server/utils/wallet/*`.
- Thay đổi số dư MC đi qua `mcService.ts`. Ràng buộc idempotency nằm ở sổ cái `mc_ledger`.
- `withTransaction` trong `server/utils/wallet/db.ts` dùng lại giao dịch ngoài khi gọi lồng nhau (đã đọc mã: nhánh `if (inTx) return fn(conn)`). Vì vậy `credit()` gọi bên trong `withTransaction` nằm chung một giao dịch.
- `lib/time/vietnamDay.ts` (mới) là nguồn duy nhất của khóa ngày và mốc đầu ngày giờ Việt Nam (UTC+7).

## File lớn nhất (đã đếm dòng)

| File | Số dòng |
|---|---|
| `components/SanctuaryDrawer.vue` | 2881 |
| `components/TempleCanvas.vue` | 2223 |
| `lib/world3d/TempleStage.ts` | 2150 |
| `server/utils/wallet/mcService.ts` | 1740 |
| `server/utils/wallet/hauDongService.ts` | 799 |

## Dung lượng `public/` (đã đo)

Tổng 110.8 MB. Các file lớn nhất:

| File | Dung lượng |
|---|---|
| `audio/sfx/zen-meditation-bgm.mp3` | 60 MB |
| `models/buddhist_monk_in_orange_robes.glb` | 16 MB |
| `models/bronze_dragon_incense_urn_scaniverse.glb` | 15.5 MB |
| `audio/sfx/chau-van-ritual-bgm.mp3` | 12.4 MB |
| `models/small_wooden_chest_for_jewlery_or_treasure.glb` | 2.5 MB |
| `models/guanyin_retopo.glb` | 2 MB |

## Mã trùng

- Đã gom: `getVietnamDayKey` (hai bản trong `mcService.ts` và `hauDongService.ts`) và `getStartOfVietnamDayMs` về `lib/time/vietnamDay.ts`.
- Mã chết và hàm dài nhất: chưa kiểm chứng.
