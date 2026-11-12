# PROMPT: RÀ SOÁT LỖI, TỐI ƯU CODE, TỐI ƯU GIAO DIỆN, REDESIGN BỚT "AI LÀM" VÀ GIẢM CHỮ

Tài liệu này là prompt để giao cho AI agent (Claude Code, Codex, Antigravity...) thực hiện theo từng giai đoạn. Có thể dán toàn bộ phần "PROMPT CHÍNH" vào agent, hoặc giao riêng từng giai đoạn nếu muốn kiểm soát từng bước.

## 0. Cách dùng

- Dán phần "PROMPT CHÍNH" bên dưới vào agent, đặt workspace là `d:/Vtechcom/hydra-pagoda`.
- Agent phải làm tuần tự theo giai đoạn, dừng lại cuối mỗi giai đoạn để báo cáo và chờ duyệt trước khi sang giai đoạn sau, đặc biệt trước giai đoạn redesign (Giai đoạn 3) vì thay đổi lớn về diện mạo.
- Nếu muốn chạy nhanh, thêm câu: "Không cần chờ duyệt giữa các giai đoạn, chỉ dừng khi gặp quyết định không đảo ngược được".
- Kết quả mỗi giai đoạn được ghi vào thư mục `docs/ra_soat/` để lần sau đọc lại, không phải rà soát từ đầu.

## 1. Bối cảnh rút ra từ rà soát nhanh codebase

Những quan sát này đã kiểm tra trực tiếp trong repo, agent cần xác minh lại chứ không tin tuyệt đối.

### 1.1. File quá lớn, dễ chứa lỗi và khó bảo trì

| File | Số dòng (xấp xỉ) | Nhận xét |
|------|------------------|----------|
| `components/SanctuaryDrawer.vue` | 3134 | Một component gánh quá nhiều tab, cần tách theo từng tab/tính năng |
| `lib/world3d/TempleStage.ts` | 2418 | Input, camera, tương tác, vòng lặp render gộp một chỗ |
| `components/TempleCanvas.vue` | 2415 | HUD, menu, toast, minimap, hotkeys, popup thiền đều nằm trong một file |
| `server/utils/wallet/mcService.ts` | 1867 | Sổ cái MC, cần soát kỹ giao dịch, race condition, làm tròn |
| `lib/world3d/sanctuary/HauDongSanctuary.ts` | 1702 | Dựng cảnh 3D, cần soát dispose geometry/material |
| `stores/wallet.ts` | 966 | Store lớn, soát watcher và hủy đăng ký sự kiện |
| `server/utils/wallet/hauDongService.ts` | 863 | Logic server phần Hầu Đồng |

### 1.2. Dấu hiệu giao diện "giống AI tạo ra" đã thấy trong code

- Mọi thứ đều là thẻ bo góc: `rounded-xl`, `rounded-2xl`, `rounded-lg` xuất hiện dày đặc trong `CardDetailViewer.vue`, `CardGalleryView.vue`, `CardRevealModal.vue`, `TempleCanvas.vue`.
- Cùng một công thức lặp lại: `bg-surface-card border border-hairline rounded-md shadow-2xl p-3` cho gần như mọi popover (`TempleCanvas.vue`, `ZenChatDrawer.vue`, `UiModal.vue`, `UiTooltip.vue`).
- Lạm dụng gradient, bóng phát sáng vàng và `animate-pulse`: `HeritageCardItem.vue`, `CardPackCard.vue`, `SanctuaryDrawer.vue`, `TempleCanvas.vue`.
- Lạm dụng `backdrop-blur` kiểu kính mờ: `CardRevealModal.vue`, `CardDetailViewer.vue`, `TempleCanvas.vue`.
- Tiêu đề phụ dạng `text-xs font-bold uppercase tracking-wider` lặp ở khắp nơi, đúng mẫu "dashboard AI".
- Icon trong ô vuông bo tròn có viền vàng và bóng phát sáng đứng cạnh tiêu đề (`w-9 h-9 rounded-xl ... text-gold shadow-[0_0_14px...]`), lặp ở nhiều modal.
- Toàn bộ giao diện là phong cách sàn giao dịch (Binance Dark: đen, vàng, xanh/đỏ giao dịch) đặt lên một ngôi chùa. Bản thân tông này lệch với chủ đề tâm linh, làm trải nghiệm có cảm giác "ứng dụng crypto" hơn là "không gian thiền".
- Bảng, drawer, popup đều cùng một khuôn: tiêu đề, đường kẻ mảnh, danh sách các hàng đều nhau, không có nhịp điệu hay điểm nhấn riêng.

### 1.3. Chữ quá nhiều

- Nhiều popup có tiêu đề, mô tả, chú thích, nhãn nhỏ, kinh văn và gợi ý chồng lên nhau.
- Bảng phím tắt, menu thiền, menu di sản, tooltip, toast đều dùng câu dài.
- Người chơi vào game để đi dạo, thiền, xin quẻ, không phải để đọc hướng dẫn.

## 2. PROMPT CHÍNH (dán vào agent)

```text
Bạn là kỹ sư frontend/fullstack kiêm design director, làm việc trong repo `d:/Vtechcom/hydra-pagoda` (Nuxt 3 SPA, Vue 3, TypeScript strict, Three.js, Pinia, Nitro, SQLite, Cardano + Hydra L2). Đọc `AGENTS.md`, `DESIGN.md`, `GAME_DESIGN_DOCUMENT.md` và `docs/TOI_UU_UX_THAO_TAC.md` trước khi làm.

Mục tiêu có 4 phần, làm theo đúng thứ tự giai đoạn bên dưới:
1. Đọc toàn bộ code, rà soát lỗi và tối ưu code.
2. Rà soát giao diện hiện tại và tối ưu giao diện.
3. Thiết kế lại các components để không còn cảm giác "do AI tạo ra".
4. Lập kế hoạch và thực hiện giảm chữ trong game nhưng người chơi vẫn hiểu.

Quy tắc chung:
- Ưu tiên dùng codegraph MCP để tra cứu symbol, tham chiếu, luồng gọi, thay cho grep.
- Trả lời trong chat bằng tiếng Việt, viết file markdown bằng tiếng Việt, không ngắt dòng giữa câu trong file markdown.
- Không thêm dòng co-authored-by vào commit message.
- Không phá hành vi hiện có: ví MC, sổ cái, Hydra L2, bói quẻ tất định theo seed, thiền 432Hz, thẻ bài, multiplayer. Mọi thay đổi ở server/ledger phải giữ kết quả test cũ.
- Không sửa dữ liệu nội dung tâm linh/pháp lý trong `data/` nếu không có lý do rõ. Nội dung được rút gọn ở giao diện, không xóa khỏi nguồn.
- Mỗi giai đoạn kết thúc bằng một báo cáo ngắn trong `docs/ra_soat/` rồi chạy đủ quality gate. Cuối mỗi giai đoạn dừng và hỏi tôi có sang giai đoạn tiếp không.

==============================
GIAI ĐOẠN 1. RÀ SOÁT LỖI VÀ TỐI ƯU CODE
==============================

Bước 1.1. Lập bản đồ.
- Dùng codegraph MCP liệt kê module, điểm vào, luồng dữ liệu chính (Pinia store, API route, service, 3D stage).
- Ghi vào `docs/ra_soat/01_ban_do_code.md`: sơ đồ phụ thuộc ngắn gọn, file lớn nhất, hàm dài nhất, mã chết (không ai gọi), mã trùng lặp.

Bước 1.2. Rà soát lỗi theo nhóm, ghi từng phát hiện kèm mức độ (nghiêm trọng, trung bình, nhẹ), file:dòng, cách tái hiện, cách sửa.
- Logic và đúng đắn: điều kiện biên, null/undefined, async không await, promise không bắt lỗi, race condition khi bấm nhanh hoặc mở nhiều tab, trạng thái store lệch với server.
- Sổ cái MC và tiền: giao dịch SQLite có bọc transaction chưa, trừ/cộng MC có kiểm tra số dư âm, idempotency khi gửi lặp request (mua shop, quyên góp, nhận thưởng thiền, claim Hầu Đồng, parkour), giới hạn 200 MC/ngày có chống vượt khi gọi song song, `mc_ledger` đối chiếu `accounts.mc_balance`.
- Bảo mật server: xác thực JWT ở mọi route `server/api/**`, kiểm tra đầu vào (kiểu, độ dài, phạm vi), rate limit cho `abbot/ask`, `fortune/draw`, `auth/nonce`; nonce CIP-8 một lần dùng và có hạn; ws-ticket; không lộ khóa Blockfrost/Koios/Hydra ở client; SQL luôn dùng tham số hóa.
- Hydra L2: xử lý ngắt kết nối WebSocket, thử lại, trạng thái `hydra_status`, chế độ `NUXT_HYDRA_L2_ENABLED=false`.
- Three.js và bộ nhớ: mọi `geometry`, `material`, `texture`, `renderTarget` có `dispose()` khi rời cảnh, listener `window`/`document` được gỡ trong `onUnmounted`, `requestAnimationFrame` được hủy, không tạo object mới mỗi frame (Vector3, Color, Matrix4), instancing/merge cho vật thể lặp (cây, cỏ, 500 chiếu thiền, đèn lồng), giới hạn pixel ratio, tắt hậu kỳ nặng trên máy yếu.
- Vue: watcher/computed nặng, `v-for` thiếu `key`, props mutate trực tiếp, store bị phân rã (destructure mất reactive), component không unmount sạch, memory leak từ `setInterval`/`setTimeout`.
- TypeScript: dùng `any`, ép kiểu `as`, bỏ qua lỗi, thiếu kiểu trả về ở API.
- Đa ngôn ngữ và ngày giờ: lệch múi giờ ở "bói quẻ miễn phí mỗi ngày" và hạn mức ngày, seed hằng ngày tất định.

Bước 1.3. Tối ưu.
- Tách các file khổng lồ ở mục 1.1 thành module nhỏ có trách nhiệm rõ ràng, giữ nguyên hành vi: ví dụ `SanctuaryDrawer.vue` tách theo tab thành component con lazy-load (`defineAsyncComponent`), `TempleCanvas.vue` tách HUD, minimap, hotkeys, menu thiền/di sản, toast thành component và composable riêng, `TempleStage.ts` tách input, camera, interaction.
- Lazy-load các modal/drawer nặng, các model `.glb` lớn (`public/models/*.glb`), nén Draco/meshopt nếu chưa; kiểm tra kích thước bundle (`npm run build`) và ghi số liệu trước/sau.
- Loại mã chết, import thừa, console.log, comment lỗi thời, tài nguyên không dùng.
- Đo hiệu năng trước/sau bằng `lib/world3d/debug/PerformanceProfiler.ts`: FPS, draw call, số triangle, bộ nhớ GPU. Đặt mục tiêu: không giảm FPS, ưu tiên giảm draw call và GC spike.
- Mỗi lần sửa lỗi nghiêm trọng, thêm hoặc cập nhật test trong `scripts/` nếu phù hợp.

Bước 1.4. Cổng chất lượng của giai đoạn.
- `node scripts/verify-ui-primitives.mjs`
- `npm run wallet:test:auth`, `wallet:test:deposit`, `wallet:test:spend`, `wallet:test:hydra` (phải 11/11), `wallet:test:meditation`, `wallet:reconcile`, `boi:test`, `boi:test:golden`
- `npm run build` thoát mã 0

Sản phẩm: `docs/ra_soat/02_loi_va_toi_uu_code.md` gồm bảng lỗi, những gì đã sửa, những gì cố ý chưa sửa và lý do, số liệu hiệu năng trước/sau.

==============================
GIAI ĐOẠN 2. RÀ SOÁT VÀ TỐI ƯU GIAO DIỆN
==============================

Bước 2.1. Chạy game thật (`npm run dev`, cổng 3012), duyệt mọi màn hình ở 3 cỡ: 375px, 768px, 1440px. Chụp ảnh từng màn: tải game, HUD khi đi dạo, SanctuaryDrawer (mọi tab), Shop, Hòm công đức, Bói quẻ (cả 6 môn), Thiền, Thẻ bài (gallery, mở gói, chi tiết), Hầu Đồng, Trụ Trì chat, ví, bảng phím tắt, minimap.

Bước 2.2. Đánh giá theo từng màn, ghi vào `docs/ra_soat/03_danh_gia_giao_dien.md`:
- Phân cấp thị giác: thứ gì quan trọng nhất ở màn này, mắt người chơi dừng ở đâu đầu tiên.
- Bố cục, khoảng cách, nhịp điệu: có đang dùng một khoảng cách đều đều cho mọi thứ không.
- Chữ: cỡ, độ tương phản, độ dài dòng, số lượng nhãn trên một màn.
- Màu: chỗ nào vàng bị dùng quá nhiều, chỗ nào xanh/đỏ giao dịch bị dùng sai ngữ nghĩa.
- Tương tác: vùng bấm tối thiểu 40px, trạng thái hover/focus/active/disabled/loading/lỗi/rỗng, phím tắt, bàn phím, `aria-*`, thứ tự Tab, `prefers-reduced-motion`.
- Che khuất cảnh 3D: HUD và drawer có đang che những thứ người chơi cần nhìn không.
- Đáp ứng (responsive) và màn hình cảm ứng: popup tràn màn hình, nút chồng nhau, drawer 440px trên điện thoại.
- Hiệu năng giao diện: `backdrop-blur` và bóng lớn trên nhiều lớp chồng, animation làm layout thrash.

Bước 2.3. Sửa các lỗi giao diện thực sự (không phải thẩm mỹ): tràn, chồng chéo, thiếu trạng thái, thiếu focus, độ tương phản kém, vùng bấm nhỏ, animation gây giật. Việc đổi diện mạo để Giai đoạn 3 xử lý.

Sản phẩm: `docs/ra_soat/03_danh_gia_giao_dien.md` kèm ảnh chụp (lưu trong `docs/ra_soat/anh/`), danh sách lỗi đã sửa và còn lại.

==============================
GIAI ĐOẠN 3. REDESIGN COMPONENTS ĐỂ KHÔNG GIỐNG AI TẠO RA
==============================

Quyền hạn: được phép thay đổi `DESIGN.md`, token màu, kiểu chữ, bộ primitive trong `components/ui/`. Hãy coi diện mạo Binance Dark hiện tại là bằng chứng và là phản ví dụ, không giữ lại chỉ vì đã có. Giữ nguyên: chức năng, nội dung, luồng, phím tắt, các tên prop công khai của primitive trừ khi báo cáo rõ.

Bước 3.1. Chốt hướng thiết kế TRƯỚC khi viết code.
- Đưa ra 2 đến 3 hướng thiết kế khác hẳn nhau, mỗi hướng mô tả bằng: một câu định vị, bảng màu (cụ thể mã), cặp font, ngôn ngữ hình khối (góc, viền, chất liệu), cách thể hiện nút/thẻ/drawer/tab, cách dùng họa tiết hoặc đồ vật thật của chùa. Gợi ý nguồn cảm hứng thực tế thay vì phong cách có sẵn: giấy dó và mực tàu, sơn mài và vàng thếp, gỗ mít chùa, bia đá khắc, tem/ấn son đỏ, bảng gỗ hoành phi, thẻ xăm tre, lá bùa, nhang và tro, sổ công đức viết tay.
- Dừng lại và hỏi tôi chọn hướng nào (hoặc kết hợp), không tự chọn rồi làm hết.
- Đặt yêu cầu: giao diện phải gợi "không gian thiền và chùa Việt", không gợi "ứng dụng giao dịch" hay "dashboard SaaS".

Bước 3.2. Danh sách dấu hiệu "AI làm" phải loại bỏ (checklist bắt buộc kiểm tra từng component).
- Mọi thẻ cùng một độ bo góc và cùng khuôn viền mảnh + bóng đổ.
- Bố cục "thẻ trong thẻ trong thẻ" (card trong card), lưới thẻ đều tăm tắp không có điểm nhấn.
- Icon đặt trong ô vuông bo tròn phát sáng cạnh mọi tiêu đề.
- Gradient tím/xanh/vàng, bóng phát sáng (glow), `animate-pulse` trang trí, hiệu ứng kính mờ (glassmorphism) tràn lan.
- Tiêu đề nhỏ chữ hoa giãn chữ (`uppercase tracking-wider`) cho mọi nhãn.
- Mỗi khối đều có "tiêu đề + dòng mô tả xám + hành động" theo cùng một công thức.
- Bố cục đối xứng nhàm chán, mọi thứ căn giữa, khoảng cách luôn bằng nhau.
- Chữ marketing sáo rỗng, câu cảm thán, emoji/biểu tượng trang trí.
- Dải màu xanh/đỏ giao dịch dùng làm màu trang trí (chỉ được dùng cho số liệu tăng/giảm).
- Dùng một font không cá tính cho mọi thứ.

Bước 3.3. Nguyên tắc thay thế.
- Mỗi màn hình có MỘT điểm nhấn rõ ràng và phần còn lại lùi xuống. Chênh lệch kích thước, trọng lượng, khoảng trắng phải có chủ đích, không đều.
- Dùng đồ vật làm giao diện: nút xin xăm là ống xăm, hòm công đức là hòm gỗ, thẻ bài có chất liệu giấy/ấn, danh sách là cuốn sổ, thay vì khung chữ nhật xám.
- Hạn chế số kiểu bo góc xuống còn 2 (ví dụ vuông hoặc bo rất nhỏ, và tròn cho vật tròn). Hạn chế số cấp bóng đổ. Không dùng viền cho mọi thứ, dùng khoảng trắng, nền khác sắc độ, hoặc đường kẻ có chủ đích để phân nhóm.
- Chuyển động ít nhưng có ý nghĩa: nhang cháy, chuông ngân, lá rơi, mực loang khi mở xăm. Tôn trọng `prefers-reduced-motion`.
- Chữ: chọn 2 họ font có cá tính (một cho tiêu đề mang hơi thở thư pháp/khắc bia, một cho thân dễ đọc), có hỗ trợ tiếng Việt đầy đủ dấu. Giữ cỡ tối thiểu 12px và `font-numbers` cho số/hash.
- Màu: ít màu hơn, độ bão hòa thấp hơn, có một màu nhấn duy nhất dùng tiết kiệm (ví dụ son đỏ ấn hoặc vàng thếp), không phủ vàng lên mọi nút.
- Giữ mô hình drawer trượt từ phải để cảnh 3D vẫn hiển thị và tương tác, trừ khi hướng thiết kế đã chọn có lý do tốt hơn.

Bước 3.4. Thực hiện.
- Cập nhật `DESIGN.md` và token trước. Sau đó làm lại bộ primitive `components/ui/*` (UiButton, UiCard, UiModal, UiTabs, UiBadge, UiChip, UiInput, UiStatCell, UiDataRow, UiTooltip, UiKeycap, UiSelectableCard) và `ZenIcon.vue`.
- Áp dụng lên các component theo thứ tự ưu tiên theo mức độ người chơi nhìn thấy: HUD trong `TempleCanvas.vue`, `SanctuaryDrawer.vue`, Bói quẻ (`FortuneModal.vue`), Thiền (`MeditationModal.vue`), Hòm công đức, Shop, Thẻ bài (`components/cards/*`), Trụ Trì chat, ví, Hầu Đồng.
- Cập nhật `scripts/verify-ui-primitives.mjs` cho khớp quy tắc mới (giữ luật 0 chữ dưới 12px, 0 ký hiệu cấm; thêm luật cho các dấu hiệu "AI làm" đã loại bỏ nếu kiểm tra tự động được).
- Mỗi component sau khi làm lại phải được chụp ảnh trước/sau ở 375, 768, 1440 px và đủ các trạng thái: mặc định, hover, focus, disabled, loading, lỗi, rỗng.

Sản phẩm: `DESIGN.md` mới, `docs/ra_soat/04_redesign.md` (hướng đã chọn, token, ảnh trước/sau, checklist "AI làm" đã đạt từng component).

==============================
GIAI ĐOẠN 4. GIẢM CHỮ NHƯNG NGƯỜI CHƠI VẪN HIỂU
==============================

Nguyên tắc: người chơi hiểu qua hình, màu, biểu tượng, âm thanh, chuyển động và bối cảnh trước, rồi mới đến chữ. Chữ chỉ còn lại khi không thể thay bằng thứ khác. Không mất thông tin, chỉ chuyển sang dạng người chơi chủ động mở ra.

Bước 4.1. Kiểm kê chữ.
- Quét mọi chuỗi hiển thị trong `components/**`, `pages/**`, `stores/**` (toast, thông báo lỗi), `lib/ui/controlHints.ts`, nội dung kinh văn, mô tả thẻ bài, mô tả vật phẩm shop, mô tả bói quẻ.
- Lập bảng trong `docs/ra_soat/05_kiem_ke_chu.md`: màn hình, số từ, số dòng, loại chữ (tiêu đề, nhãn, mô tả, hướng dẫn, thông báo, nội dung văn hóa), mức cần thiết (bắt buộc, nên có, bỏ được).

Bước 4.2. Quy tắc giảm chữ (áp dụng cho tất cả).
1. Mỗi màn hình tối đa 1 tiêu đề, 1 hành động chính. Nhãn nút là động từ ngắn, 1 đến 3 từ ("Thắp nhang", "Gieo quẻ", "Ngồi thiền").
2. Thay mô tả bằng biểu tượng + số: giá, phần thưởng, thời gian, số lượng hiển thị bằng icon và số, không viết "Bạn sẽ nhận được ... Merit Coin".
3. Thay câu hướng dẫn bằng minh họa hoặc hoạt ảnh nhỏ tại chỗ (mũi tên, vòng sáng quanh vật thể tương tác, bàn tay chỉ), thay vì đoạn văn.
4. Hướng dẫn theo ngữ cảnh, đúng lúc: chỉ hiện gợi ý khi người chơi lần đầu gặp tình huống đó, hiện một lần rồi tự ẩn, có nút "xem lại" ở nơi cố định. Không hiện bảng hướng dẫn khi mới vào.
5. Tiết lộ dần (progressive disclosure): mặc định chỉ hiện dòng tóm tắt, phần giải thích dài nằm sau nút "i" hoặc "Xem thêm". Kinh văn, lịch sử thẻ, lời giải quẻ chi tiết nằm ở lớp thứ hai.
6. Thông báo (toast) tối đa 6 từ kèm icon ngữ nghĩa, ví dụ "+5 MC", "Đủ rồi hôm nay". Lỗi nói thẳng cách khắc phục trong một câu ngắn, không dùng mã lỗi kỹ thuật ở giao diện.
7. Một khái niệm một từ, dùng thống nhất ở mọi nơi (MC, công đức, hòm công đức, quẻ, xăm...). Lập bảng thuật ngữ và áp dụng đồng nhất.
8. Bỏ lặp: tiêu đề và nhãn nút không nhắc cùng một ý; không có câu "chào mừng", "hãy", "vui lòng" thừa.
9. Dùng âm thanh và hình ảnh thay lời: chuông cho thành công, tiếng mõ khi nhận, hiệu ứng vật thể, rung nhẹ thị giác khi lỗi.
10. Phím tắt: gom thành một dải biểu tượng bàn phím nhỏ theo ngữ cảnh, bảng đầy đủ chỉ mở khi người chơi gọi.
11. Văn hóa/giáo lý: cho nghe (audio) hoặc đọc theo lớp, mặc định chỉ một câu cốt lõi, bản đầy đủ mở khi người chơi muốn.

Bước 4.3. Ngân sách chữ (để đo được) — đặt làm mục tiêu và kiểm tra bằng script đếm từ.

| Loại | Ngân sách đề xuất |
|------|--------------------|
| Nhãn nút | tối đa 3 từ |
| Toast / thông báo | tối đa 6 từ |
| Tiêu đề màn / drawer | tối đa 3 từ |
| Mô tả mặc định dưới tiêu đề | tối đa 1 câu, tối đa 12 từ, hoặc bỏ |
| Tooltip | tối đa 1 câu, tối đa 12 từ |
| Khối chữ hiển thị mặc định | tối đa 2 dòng, phần còn lại nằm sau "Xem thêm" |
| Lời Trụ Trì và kinh văn | 1 câu cốt lõi mặc định, bản đầy đủ khi người chơi mở |
| Tổng chữ cố định trên một màn (không tính nội dung do người chơi chọn mở) | tối đa khoảng 40 từ |

Bước 4.4. Cơ chế "hiểu mà không cần đọc".
- Lần đầu chơi: chuỗi hướng dẫn hành động 5 bước ngắn trong chính cảnh 3D (đi tới, thắp nhang, quyên góp, xin quẻ, ngồi thiền), mỗi bước một biểu tượng + một vòng sáng + tối đa 4 từ, hoàn thành bằng hành động thật chứ không phải bấm "Tiếp".
- Điểm tương tác trong cảnh có biểu tượng nổi và vòng sáng, chỉ hiện chữ khi đứng gần ("E: Thắp nhang").
- Trạng thái trên HUD dùng thanh, vòng tiến độ, biểu tượng và số, không dùng câu.
- Phần thưởng và giới hạn ngày dùng vòng tròn đầy dần, không giải thích bằng văn bản.
- Kiểm thử khả dụng: soạn kịch bản để 5 người chưa chơi bao giờ thử trong 3 phút, đo họ có tự làm được: thắp nhang, quyên góp, xin một quẻ, ngồi thiền, mở thẻ bài hay không mà không hỏi. Ghi kết quả; nếu thất bại ở bước nào thì khôi phục lượng chữ tối thiểu ở đúng chỗ đó.

Bước 4.5. Thực hiện.
- Tách toàn bộ chuỗi hiển thị về một nơi (ví dụ `lib/ui/copy.ts` hoặc `i18n`) để sửa một chỗ, kiểm soát ngân sách chữ, dễ thêm tiếng Anh sau này.
- Viết lại chuỗi theo quy tắc ở 4.2 và ngân sách ở 4.3 cho mọi màn ở Giai đoạn 2.
- Thêm script `scripts/verify-copy-budget.mjs` đếm từ theo loại và báo lỗi khi vượt ngân sách, gắn vào quality gate.

Sản phẩm: `docs/ra_soat/05_kiem_ke_chu.md` (số liệu trước/sau theo màn), `docs/ra_soat/06_ke_hoach_giam_chu.md` (quy tắc, bảng thuật ngữ, kịch bản hướng dẫn lần đầu, kết quả kiểm thử khả dụng).

==============================
CỔNG CHẤT LƯỢNG CUỐI CÙNG
==============================

Chỉ được báo hoàn tất khi tất cả đều đạt:
1. `node scripts/verify-ui-primitives.mjs` báo ALL CHECKS PASSED.
2. `npm run wallet:test:hydra` đạt 11/11, các test ví/MC/thiền/bói quẻ khác không hồi quy, `wallet:reconcile` không lệch.
3. `npm run build` thoát mã 0, kích thước bundle không tăng so với trước (hoặc có giải thích).
4. FPS và bộ nhớ cảnh 3D không tệ hơn trước khi làm.
5. `verify-copy-budget.mjs` đạt (sau Giai đoạn 4).
6. Ảnh chụp trước/sau ở 375, 768, 1440 px cho mọi màn đã redesign.
7. Báo cáo cuối `docs/ra_soat/00_tong_ket.md`: đã làm gì, chưa làm gì, rủi ro còn lại, việc nên làm tiếp.
```

## 3. Các prompt rút gọn (giao từng giai đoạn)

### 3.1. Chỉ rà soát lỗi và tối ưu code

```text
Đọc toàn bộ code repo hydra-pagoda bằng codegraph MCP. Rà soát lỗi theo các nhóm: logic, sổ cái MC (transaction, idempotency, race condition, hạn mức ngày), bảo mật API (JWT, validate, rate limit, nonce CIP-8), Hydra L2, rò rỉ bộ nhớ Three.js (dispose, listener, rAF), Vue (watcher, key, unmount), TypeScript (any, ép kiểu). Tách các file quá lớn (SanctuaryDrawer.vue, TempleCanvas.vue, TempleStage.ts, mcService.ts) mà không đổi hành vi. Ghi báo cáo vào docs/ra_soat/02_loi_va_toi_uu_code.md với bảng mức độ, file:dòng, cách sửa. Chạy đủ quality gate trong AGENTS.md trước khi báo xong.
```

### 3.2. Chỉ rà soát và redesign giao diện

```text
Chạy game, chụp mọi màn ở 375/768/1440px, đánh giá phân cấp, khoảng cách, màu, trạng thái, responsive, a11y. Sau đó thiết kế lại components cho bớt "AI làm": bỏ thẻ bo góc đồng loạt, glow, gradient, glassmorphism, tiêu đề uppercase tracking-wider lặp lại, icon trong ô bo tròn; thay bằng ngôn ngữ thiết kế gợi chùa Việt (giấy dó, sơn mài, gỗ, bia đá, ấn son). Đưa 2 đến 3 hướng thiết kế khác nhau và hỏi tôi chọn trước khi viết code. Cập nhật DESIGN.md, bộ components/ui/*, verify-ui-primitives.mjs.
```

### 3.3. Chỉ giảm chữ

```text
Kiểm kê toàn bộ chuỗi hiển thị trong game và lập bảng số từ theo màn. Lập kế hoạch giảm chữ mà người chơi vẫn hiểu: nhãn nút tối đa 3 từ, toast tối đa 6 từ, mô tả mặc định tối đa 1 câu hoặc bỏ, thay mô tả bằng icon + số + hoạt ảnh, hướng dẫn theo ngữ cảnh chỉ hiện một lần, nội dung dài (kinh văn, lời giải quẻ, lịch sử thẻ) chuyển sang lớp "Xem thêm" hoặc audio. Gom chuỗi về một file, thêm script kiểm tra ngân sách chữ, viết kịch bản kiểm thử khả dụng cho 5 người chơi mới.
```

## 4. Lưu ý khi giao việc

- Giai đoạn 3 thay đổi diện mạo toàn game và có thể xung đột với `DESIGN.md` hiện tại (đang ghi "Binance Dark"). Chỉ giao giai đoạn này khi đã sẵn sàng bỏ phong cách đó.
- Giai đoạn 4 nên làm sau hoặc song song với Giai đoạn 3 vì bố cục mới phụ thuộc vào lượng chữ còn lại. Nếu làm riêng, hãy làm Giai đoạn 4 trước để không phải thiết kế lại khung chứa chữ.
- Thứ tự khuyến nghị nếu muốn ít rủi ro: 1 (code), 4 (giảm chữ), 2 (lỗi giao diện), 3 (redesign).
- Các lệnh trong quality gate đều có trong `package.json`; kịch bản `boi:test` và `boi:test:golden` cần Node có `--experimental-strip-types`.
