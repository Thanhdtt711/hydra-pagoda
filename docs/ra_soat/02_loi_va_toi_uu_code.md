# Lỗi và tối ưu code (Giai đoạn 1.2 - 1.4)

Phạm vi: hầu đồng, sổ cái MC, parkour, bói đôi, dâng hương, vòng đời `TempleCanvas`, vòng di chuyển trong `TempleStage`. Giai đoạn này chưa rà toàn repo. Phần chưa rà nằm ở mục "Chưa kiểm tra".

## Lỗi đã sửa

| # | Mức | Vị trí | Vấn đề |
|---|---|---|---|
| 1 | Cao | `hauDongService.ts` `claimHauDongBlessing` | `credit()` chạy ngoài giao dịch. Lỗi ở bước sau để lại MC đã cộng mà quỹ không giảm. Gọi lặp (idempotent replay) còn trừ quỹ thêm lần nữa |
| 2 | Cao | `hauDongService.ts` heartbeat | Server tin `deltaSec` do client gửi, có thể bơm `watch_seconds` |
| 3 | Trung bình | `parkourService`, `coupleFortuneService`, `incense/offer.post.ts`, `stores/user.ts` | Khóa ngày dùng UTC, trong khi thiền và hầu đồng dùng giờ Việt Nam. Hạn mức "mỗi ngày" reset lệch giờ giữa các tính năng |
| 4 | Trung bình | `hau-dong/heartbeat, claim, donate`, `incense/offer` | Không có `rateLimit` |
| 5 | Trung bình | `TempleCanvas.vue` `hauDongSyncTimer` | `setInterval` async không chống chồng yêu cầu, vẫn chạy khi tab bị ẩn |
| 6 | Thấp | `TempleStage.ts` | Cấp phát `THREE.Vector3` mới mỗi khung hình ở 4 chỗ |
| 7 | Thấp | `TempleCanvas.vue` | `SanctuaryDrawer` và `AbbotChatDrawer` nạp tĩnh vào chunk vào trang |

## Cách sửa

- **#1:** Bọc toàn bộ claim trong `withTransaction`. Chỉ trừ quỹ khi `creditRes.idempotentReplay` là false.
- **#2:** Số giây cộng thêm bị chặn bởi thời gian thực từ `last_heartbeat_at`. Nếu bằng 0 thì trả trạng thái hiện tại, không ghi DB. Luồng hợp lệ (client gửi mỗi 2 giây) không bị ảnh hưởng.
- **#3:** Tạo `lib/time/vietnamDay.ts`, các nơi trên dùng chung.
- **#4:** Giới hạn: heartbeat 120 mỗi phút, claim 30, donate 20, incense 30.
- **#5:** Thêm cờ chống chồng, bỏ qua khi `document.hidden`, bọc try/catch/finally.
- **#6, #7:** Dùng vector tái sử dụng ở cấp class. Drawer dùng `defineAsyncComponent`, chỉ import tĩnh `type DrawerTab`.

## Cố ý chưa sửa

- **Hiệu ứng một lần khi đổi khóa ngày.** Dữ liệu cũ theo khóa UTC. Quanh thời điểm chuyển, hạn mức ngày có thể lệch tối đa một ngày với một số tài khoản. Vá an toàn cần migrate dữ liệu.
- **Tách `SanctuaryDrawer.vue`, `TempleStage.ts`, `mcService.ts`.** Không có test giao diện để chứng minh hành vi giữ nguyên. Rủi ro hồi quy cao hơn lợi ích.
- **Route khác chưa có `rateLimit`.** Chưa rà từng route, chưa đánh giá rủi ro, nên chưa thêm ngưỡng.


## Chưa kiểm tra

- Three.js dispose và `cancelAnimationFrame` trong `TempleStage`.
- Nonce và replay của `abbot/ask`, `fortune/draw`. `auth/nonce` đã có rate limit 10 lần mỗi phút nhưng chưa rà logic.
- Các chỗ khác dùng `toISOString().slice(0,10)`, chưa grep lại.
- Hydra L2 (`hydraClient`, `l2TxBuilder`, `sessionKey`).
- Thời gian tải trang và FPS thực tế, chưa đo.

## Đã xử lý ở lượt hai

- **Dọn `hauDongSyncTimer` khi unmount:** đã đọc `TempleCanvas.vue`, `onUnmounted` gọi `clearInterval` và gán lại `null`. Không cần sửa.
- **Test hầu đồng:** thêm `scripts/wallet/test-hau-dong.mjs` (8/8, script `wallet:test:hau-dong`). Bao gồm 10 claim đồng thời chỉ cộng một lần, trần 250 MC mỗi ngày, cắt phần dư còn 10 MC, quỹ Ban Lộc còn 865 MC và đối soát sổ cái. Heartbeat dồn 30 lần với `deltaSec=15` chỉ ghi 15 giây xem. Giá trị tối đa nếu không chặn là 96, do SQL đã giới hạn `MIN(96, ...)`.
- **Test tự dựng server:** thêm `scripts/wallet/_server.mjs`. `test-auth.mjs` và `test-deposit.mjs` giờ tự khởi động server trên cổng riêng (3017 và 3016) với DB thử, không còn `ECONNREFUSED` khi thiếu server chạy sẵn. Đặt `BASE_URL` để dùng server có sẵn như trước.
- **`wallet:test:deposit`:** test giả định đúng 2 xác nhận nên server thử được đặt `NUXT_CONFIRMATIONS_REQUIRED=2` ngay trong test. Kết quả 19/19. Không đổi `config.ts`, vì mặc định 1 xác nhận cho testnet là chủ đích của code.
- **`wallet:test:auth`, cookie `SameSite`:** `auth.ts` đặt `Lax` trên HTTP và `None` kèm `Secure` trên HTTPS, để chạy được trong iframe cross-site. Code đã có từ HEAD và có chủ đích, nên tôi sửa test theo code chứ không đổi cookie. Test giờ kiểm tra đúng giá trị theo giao thức. Kết quả 19/19. Comment ở `assertSameOrigin` vẫn ghi `SameSite=Strict`, đã lỗi thời nhưng tôi chưa sửa vì ngoài phạm vi.
- **Typecheck:** thêm `vue-tsc` (devDependency) và script `typecheck`. Việc này cũng làm thay đổi `pnpm-lock.yaml`.
- **Baseline bundle:** đã build lại với import tĩnh để lấy số "trước", rồi khôi phục `defineAsyncComponent` và build lại để lấy số "sau".


## Typecheck

**Cập nhật lượt ba: `vue-tsc --noEmit` còn 0 lỗi (trước đó 144).** Phần dưới đây là số liệu trước khi dọn, giữ lại để đối chiếu. Các thay đổi đã làm nằm ở mục "Dọn 144 lỗi typecheck (lượt ba)" cuối file.

Trước khi dọn, `npm run typecheck` báo **144 lỗi** trên khoảng 28 file, exit 2.

- 84 lỗi TS2339 (thuộc tính không tồn tại), 24 lỗi TS2554 (sai số tham số), 15 lỗi TS2322, 6 lỗi TS5097 (import đuôi `.ts`).
- File nhiều lỗi nhất: `server/api/mc/fortune/draw.post.ts` (27), `components/SanctuaryShop.vue` (18), `components/SanctuaryDrawer.vue` (16), `lib/world3d/TempleStage.ts` (15).
- Trong các file tôi đã sửa, tôi đối chiếu số dòng báo lỗi với các hunk thay đổi (`git diff -U0`). Lỗi ở `TempleStage.ts` (dòng 853 đến 943) nằm ngoài các hunk tôi sửa. `TempleCanvas.vue` báo 1 lỗi ở dòng 1724 (`variant="danger"`), tôi chưa đối chiếu dòng này với hunk. Lỗi import `.ts` ở `mcService.ts` và `db.ts` có sẵn từ HEAD. `hauDongService.ts`, `parkourService.ts`, `coupleFortuneService.ts` và `lib/time/vietnamDay.ts` không có lỗi. Đây là đối chiếu theo dòng, chưa so sánh danh sách lỗi trước và sau khi sửa.

## Số liệu bundle (đo trước và sau)

Thư mục `.output/public/_nuxt`, các file `.js`. "Trước" là import tĩnh hai drawer. "Sau" là `defineAsyncComponent`.

| | Chunk lớn nhất | Tổng JS | Số file |
|---|---|---|---|
| Trước | 774.2 KB | 1781.7 KB | 12 |
| Sau | 618.4 KB | 1782.9 KB | 15 |


## Tài nguyên `public/`

- **GLB đang dùng:** chỉ `models/the_buddha_statue_in_a_mountain.glb` (0.1 MB), được tham chiếu bởi `SacredBuddhaStatue.ts` và `public/preview_buddha.html`. Bạn xác nhận hiện chỉ dùng tượng Thích Ca, khớp với kết quả grep.
- **GLB không có tham chiếu:** `buddhist_monk_in_orange_robes` (16 MB), `bronze_dragon_incense_urn_scaniverse` (15.5 MB), `small_wooden_chest_for_jewlery_or_treasure` (2.5 MB), `guanyin_retopo` (2 MB), `bell_pagoda`, `japanese_stone_lantern_minecraft_entity`, `lowpoly_textured_floating_lotus_lantern` và 5 file `models/npc/*.glb` (mỗi file 0.02 MB). Đã grep `components`, `lib`, `stores`, `server`, `pages`, `app.vue`, `scripts`, `nuxt.config.ts`, `package.json`. `docs/PROMPT_NANG_CAP_3D.md` có nhắc `models/npc/*.glb` như tài nguyên dự phòng cho NPC sau này.
- **Ảnh hưởng:** các GLB này không được nạp khi không có mã gọi, nên không làm chậm tải trang. Chúng chỉ làm phình thư mục `public/` (khoảng 34 MB riêng hai GLB lớn) và bản deploy.
- **Đã xóa (lượt ba, theo quyết định của bạn):** 7 GLB không dùng, gồm `bell_pagoda`, `bronze_dragon_incense_urn_scaniverse`, `buddhist_monk_in_orange_robes`, `guanyin_retopo`, `japanese_stone_lantern_minecraft_entity`, `lowpoly_textured_floating_lotus_lantern`, `small_wooden_chest_for_jewlery_or_treasure`. Khoảng 36 MB. Các file vẫn khôi phục được từ git. Giữ lại `the_buddha_statue_in_a_mountain.glb` và `models/npc/*.glb` (tài liệu 3D còn nhắc tới).
- **BGM:** `zen-meditation-bgm.mp3` dài khoảng 65 phút, 128 kbps, nặng 60 MB. `ZenAudio.ts` đặt `preload = 'metadata'` cho cả hai BGM, nên trình duyệt chỉ tải phần đầu, phần còn lại tải dần khi phát. Chưa đo thực tế trong trình duyệt. Nén lại ở 64 kbps sẽ còn khoảng 30 MB (ước tính theo bit rate), nhưng đổi chất lượng âm thanh nên tôi chưa làm.

## Quality gate

| Kiểm tra | Kết quả |
|---|---|
| `node scripts/verify-ui-primitives.mjs` | PASS (41 file, 0 ký tự cấm, 0 font nhỏ hơn 12px) |
| `npm run build` | exit 0 (build lại hai lần trong lượt này) |
| `npm run wallet:test:auth` | 19/19 |
| `npm run wallet:test:deposit` | 19/19 |
| `npm run wallet:test:meditation` | 14/14 |
| `npm run wallet:test:spend` | 14/14 |
| `npm run wallet:test:hydra` | 11/11 |
| `npm run wallet:test:hau-dong` | 8/8 |
| `npm run wallet:test:vietnam-day` | 6/6 |
| `npm run wallet:reconcile` | Đối soát an toàn |
| `npm run boi:test` | 21/21 |
| `npm run boi:test:golden` | 39/39 |
| `vue-tsc --noEmit` | PASS, 0 lỗi (lượt ba) |
| `npm run build` (lượt ba) | exit 0, chunk lớn nhất 618.4 KB, tổng JS 1782.9 KB, 15 file (không đổi so với bản "sau") |
| Các test ví, MC, Hydra, thiền, hầu đồng, vietnam-day, bói quẻ (lượt ba) | Đạt toàn bộ: 19/19, 19/19, 14/14, 14/14, 11/11, 8/8, 6/6, 21/21, 39/39, đối soát an toàn |

Chưa kiểm chứng: test hầu đồng mới chưa được chạy trên mã cũ để xác nhận nó thật sự thất bại khi chưa có bản sửa. Hiện chỉ biết nó đạt trên mã đã sửa.

## Dọn 144 lỗi typecheck (lượt ba)

Kết quả: `vue-tsc --noEmit` từ 144 lỗi xuống 0. Phần lớn lỗi có chung vài nguyên nhân gốc, nên sửa theo nguyên nhân thay vì từng dòng.

| Nhóm | Số lỗi | Nguyên nhân | Cách sửa |
|---|---|---|---|
| `readBody` trả `{}` | khoảng 60 | `.catch(() => ({}))` làm kiểu body thu hẹp thành `{}` | Gán kiểu tường minh cho `body` và `.catch(() => null)`, ở 11 route `server/api` |
| Sai số tham số `SlotBatch.box` và `cylinder` | 24 | Mã gọi truyền thêm góc xoay `rx, ry, rz`, nhưng hàm chỉ nhận `ry` | `SlotBatch` nhận đủ `rx, ry, rz` và áp vào `rotation`. Sửa 1 lời gọi ở `LotusPond.ts` truyền `ry` ở vị trí `rx` cũ |
| Component mồ côi | khoảng 40 | `FortuneModal`, `MeritBoxModal`, `CardCollectionModal`, `SanctuaryShop` gọi hàm store không còn tồn tại (`drawServerFortune`, `donateToMeritBox`, `recordMeritDeposit`, kiểu `ShopCatalogItem`) và không có nơi nào import | Xóa 4 file (grep sau khi xóa: 0 tham chiếu) |
| Prop primitive thiếu giá trị | 12 | `UiCard variant="subtle"`, `UiInput type="date"`, icon `wallet`, `profile` chưa có | Thêm `subtle` vào `UiCard`, `date` vào `UiInput`, thêm hai icon vào `ZenIcon`. `ui/ZenIcon.vue` dùng kiểu `WhitelistedIconName` |
| Import đuôi `.ts` | 6 | `db.ts` và `mcService.ts` import `.ts` để chạy bằng Node strip-types | `allowImportingTsExtensions: true` trong `nuxt.config.ts` |
| Lỗi lẻ | 2 | `ContentRepository.ts` thiếu import `GenderType`. `CoupleDivinationLogic.ts` dùng kiểu `FortuneResult` không tồn tại | Thêm import, đổi sang `FortuneDrawResult` |
| Đổi tên prop | 4 | `SanctuaryDrawer` truyền `category` thay vì `mon` cho `generateFortune`. `CardDetailViewer` dùng icon `volume`. `CardPackCard` dùng badge `primary`. `TempleCanvas` dùng nút `danger` | Đổi sang `mon`, `volume-2`, `gold`, `secondary` |
| Khác | 3 | `$fetch` quá sâu kiểu route (TS2321) ở `WalletConnectModal`. `tryOnOutfit` nhận `string \| undefined`. `isItemUnlocked` nhận id thay vì object | Ép kiểu có chủ đích ở `$fetch`, thêm guard, truyền `item` |

Ba thay đổi đổi hành vi, bạn nên biết:

0. **Cảnh 3D: các khối có góc xoay giờ được xoay thật.** `SlotBatch.box` và `cylinder` trước đây chỉ nhận `ry` (box) hoặc không nhận góc nào (cylinder). Các lời gọi truyền thêm `rx, ry, rz` (khoảng 52 lời gọi ở `TempleStage.ts`, `PagodaSanctuary.ts`, `MountainParkourSystem.ts`) bị JS bỏ qua đối số thừa, nên các khối đó trước đây đứng thẳng, không xoay. Sau khi sửa chữ ký, chúng xoay đúng như tác giả viết. Ví dụ: chân kiệu, cánh sen, dây cáp cầu treo (`rz = 1.57`, trước đây dựng thẳng đứng thay vì nằm ngang). Đây có thể là sửa lỗi hiển thị, nhưng cũng có thể làm vài chi tiết trông khác bản bạn đã quen. Tôi chưa chạy cảnh để xem. Nếu cần quay lại hành vi cũ, đổi `SlotBatch` về chữ ký cũ và sửa các lời gọi.
1. **`SanctuaryDrawer` khi bói miễn phí lúc chưa nối ví:** trước đây truyền `category` (bị engine bỏ qua, nên engine luôn rơi về môn mặc định `xin_xam`). Giờ truyền `mon`, nên môn được chọn có hiệu lực. Đồng thời tôi bỏ biến `recentBlockIds` vì `FortuneDrawInput` không có trường đó và `selectedBlockIds` không tồn tại trong kiểu kết quả, nên danh sách này luôn rỗng. Chức năng tránh trùng quẻ gần đây thực tế chưa hoạt động ở nhánh offline này, tôi chưa làm lại.
2. **Dòng `Can Chi · Nạp Âm` ở thẻ hồ sơ:** `savedProfile.canChiNam` và `napAmName` không có trong kiểu `SavedFortuneProfile`, nên nhánh `v-if` luôn sai và không bao giờ hiện. Tôi gỡ nhánh chết này. Nếu muốn hiện thông tin đó, cần tính từ `previewProfileMetaphysics`.

Chưa kiểm chứng: tôi chưa chạy game trong trình duyệt sau các thay đổi này. Typecheck, build và các test server đều đạt, nhưng chưa có gì kiểm tra giao diện thật. Việc đổi `SlotBatch` chỉ có kiểm tra kiểu, tôi chưa so ảnh cảnh 3D trước và sau cho 52 lời gọi có xoay.

## Còn nợ

1. Đo tải trang thực tế trong trình duyệt để biết tách drawer có hiệu quả không.
2. Nén BGM: bạn chọn không làm.
3. Các mục ở phần "Chưa kiểm tra".
4. Kiểm tra bằng mắt cảnh 3D có dùng `box`/`cylinder` xoay (52 lời gọi) sau khi `SlotBatch` đổi chữ ký.

Ở bản "sau", bốn chunk lớn nhất là 618.4, 414.1, 351.8 và 314.3 KB. Bản "trước" có chunk 774.2 KB. Tên file chunk được băm lại giữa hai lần build nên tôi không đối chiếu từng chunk. Tôi suy ra chunk 774.2 KB tách thành hai chunk (414.1 và 351.8 KB), vì 414.1 + 351.8 = 765.9 KB gần bằng 774.2 KB. Đây là suy luận từ kích thước, chưa kiểm chứng nội dung. Tổng JS gần như không đổi (+1.2 KB), vì mã chỉ chuyển chỗ chứ không giảm.

Chưa đo thời gian tải trang. Chưa biết drawer có được mount ngay lúc khởi động hay chỉ khi mở. Nếu mount ngay thì trình duyệt vẫn tải cả hai chunk, lợi ích chỉ là chia nhỏ phần phân tích và thực thi. Cần đo trong trình duyệt thật mới kết luận được.

