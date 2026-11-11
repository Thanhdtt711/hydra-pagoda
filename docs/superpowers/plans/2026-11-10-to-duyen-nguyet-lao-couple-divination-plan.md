# Kế Hoạch Triển Khai: Đài Tơ Duyên Nguyệt Lão (Bói Duyên Cặp Đôi Đồng Tu)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh tính năng Đài Tơ Duyên Nguyệt Lão gồm cảnh quan 3D Cây Nguyệt Lão bên Hồ Sen, án thư gieo quẻ tương tác, API kết duyên đôi lứa (1 lượt free/ngày, lượt sau 10 MC), thuật toán Bát Tự tính điểm tương hợp % và xuất Thẻ Bài Song Duyên kèm tặng Bùa Chỉ Đỏ Uyên Ương.

**Architecture:** Bổ sung thực thể 3D `LoveTreeProp.ts` tích hợp trong `TempleStage.ts` với collider và tương tác phím `E`; xây dựng service backend `coupleFortuneService.ts` kết hợp `CoupleDivinationLogic.ts` và trừ MC qua `mcService.ts`; tích hợp UI Drawer Binance Dark và module render thẻ ảnh PNG `CoupleShareCardRenderer.ts`.

**Tech Stack:** Nuxt 3, Vue 3, Three.js, TypeScript, SQLite (`node:sqlite`), Tailwind CSS v4, HTML5 Canvas API.

## Global Constraints
- Tuân thủ nghiêm ngặt Design System Binance Dark (`DESIGN.md`): Nền `#0b0e11`, Card `#1e2329`, Border `#2b3139`, Vàng `#fcd535`.
- Tuyệt đối không dùng font chữ nhỏ hơn 12px (`text-xs` là tối thiểu). Không sử dụng emoji thô, chỉ dùng `ZenIcon.vue` SVG vectors.
- Viết markdown không ngắt dòng giữa câu theo quy tắc dự án.
- Mọi kiểm thử phải chạy qua `node scripts/verify-ui-primitives.mjs` và `npm.cmd run build` exit code 0.

---

### Task 1: Backend Service & API Bói Duyên Cặp Đôi

**Files:**
- Create: `lib/boi/CoupleDivinationLogic.ts`
- Create: `server/utils/wallet/coupleFortuneService.ts`
- Create: `server/api/mc/fortune/draw-couple.post.ts`
- Create: `scripts/boi/test-couple-divination.mjs`

**Interfaces:**
- Consumes: `MetaphysicsService.analyzeMetaphysics(profile, mon, partnerProfile)`, `spend()` & `credit()` từ `server/utils/wallet/mcService.ts`, `data/boi/to_duyen.json`.
- Produces: `drawCoupleFortune(accountId, profile, partnerProfile, paymentMode, requestId): CoupleFortuneResultDto`.

- [x] **Step 1: Viết test case cho logic Bói Duyên Cặp Đôi trong `scripts/boi/test-couple-divination.mjs`**
- [x] **Step 2: Hiện thực `lib/boi/CoupleDivinationLogic.ts` & `server/utils/wallet/coupleFortuneService.ts`**
  - Xử lý kiểm tra lượt miễn phí trong ngày (bảng `fortune_records` với môn `love_couple`).
  - Lượt 1: `0 MC`. Lượt 2 trở đi: trừ `10 MC` qua hàm `spend()` với refType `custom_service`.
  - Tính toán điểm tương hợp `%` từ $60\%$ đến $99\%$ dựa trên Ngũ Hành nạp âm và Cung Phi.
  - Phân cấp danh vị: Duyên Tiền Định, Tri Kỷ Tương Phùng, Bằng Hữu Đồng Tâm, Nghịch Duyên Tu Tâm.
  - Bốc ngẫu nhiên 1 quẻ từ `data/boi/to_duyen.json`.
  - Tặng vật phẩm phong thủy `love_knot_charm` (Bùa Chỉ Đỏ Uyên Ương) vào tài khoản.
- [x] **Step 3: Hiện thực API Route `server/api/mc/fortune/draw-couple.post.ts`**
  - Xác thực session đăng nhập người dùng qua `requireSession(event)`.
  - Validate dữ liệu đầu vào: `profile` và `partnerProfile` (fullName, birthDate, gender).
  - Gọi service và trả về kết quả chuẩn DTO.
- [x] **Step 4: Chạy script test xác nhận 100% test cases PASS**

---

### Task 2: Cảnh Quan 3D Cây Nguyệt Lão & Án Thư Tương Tác

**Files:**
- Create: `lib/world3d/nature/LoveTreeProp.ts`
- Modify: `lib/world3d/world/MapLayout.ts`
- Modify: `lib/world3d/TempleStage.ts`

**Interfaces:**
- Consumes: `FlatMaterialFactory`, `LowPolyBuilder`, `CollisionWorld`, `CylinderCollider`, `BoxCollider`.
- Produces: Class `LoveTreeProp` quản lý mesh Cây Nguyệt Lão, dải lụa đỏ, chuông gió, án thư gieo quẻ tại tọa độ $(x = -10.5, y = 0.0, z = 18.0)$.

- [x] **Step 1: Tạo class `LoveTreeProp.ts`**
  - Dựng thân cây đại thụ gỗ nâu cổ kính uốn khúc mềm mại.
  - Tán lá đỏ hồng phong cách low-poly phẳng màu.
  - 8 dải lụa đỏ buông rủ từ các cành cây lớn, gắn chuông đồng nhỏ đung đưa theo gió.
  - Bàn án thư gỗ hương chạm hoa sen, trên bàn có lư hương khói trầm thoang thoảng và tráp đựng chỉ hồng.
  - 2 đệm quỳ cói màu đỏ gạch phía trước bàn.
  - Thêm `CylinderCollider` cho gốc cây và `BoxCollider` cho án thư vào `CollisionWorld`.
- [x] **Step 2: Cập nhật `MapLayout.ts`**
  - Thêm landmark `love_tree_shrine` tại $(-10.5, 0.0, 17.5)$ với vùng bảo vệ exclusion zone $3.2\text{m}$.
- [x] **Step 3: Tích hợp vào `TempleStage.ts`**
  - Khởi tạo `LoveTreeProp` trong vòng đời khởi dựng sân Chùa.
  - Thêm điểm kiểm tra khoảng cách tương tác `love_tree` trong vòng lặp `checkProximity()` ($d \le 2.8\text{m}$).
  - Cập nhật animation đung đưa dải lụa và khói trầm trong hàm `update()`.

---

### Task 3: Giao Diện Drawer Bói Duyên Đôi Lứa & Xuất Thẻ Ảnh Song Duyên

**Files:**
- Create: `lib/boi/CoupleShareCardRenderer.ts`
- Modify: `components/SanctuaryDrawer.vue`
- Modify: `components/TempleCanvas.vue`

**Interfaces:**
- Consumes: API `/api/mc/fortune/draw-couple`, dữ liệu profile người dùng từ `user.ts`.
- Produces: Modal/Drawer tab Bói Duyên Cặp Đôi, hiển thị kết quả tương hợp và nút tải ảnh PNG độ phân giải $1080 \times 1920$.

- [x] **Step 1: Tạo module `CoupleShareCardRenderer.ts`**
  - Vẽ thẻ bài Song Duyên chuẩn tỷ lệ $9:16$ ($1080 \times 1920\text{px}$) bằng Canvas API.
  - Hiển thị tên hai người, bản mệnh Can Chi, điểm số tương hợp %, danh vị duyên số, 4 câu thơ Nguyệt Lão và mã kiểm chứng `receiptHash`.
  - Xuất ra Data URL PNG chất lượng cao để tải về máy.
- [x] **Step 2: Cập nhật `SanctuaryDrawer.vue`**
  - Thêm tab `love_couple` (Đài Tơ Duyên Nguyệt Lão) vào `DrawerTab` và `TAB_NAV`.
  - Form nhập liệu 2 cột: Hồ sơ bản thân (tự điền) & Hồ sơ người thương (nhập tên, ngày sinh, giới tính).
  - Lựa chọn phương thức thanh toán: Lượt miễn phí hôm nay ($0\text{ MC}$) hoặc Thêm lượt ($10\text{ MC}$).
  - Giao diện kết quả: Vòng tròn điểm tương hợp %, danh vị duyên số, lời thơ Nguyệt Lão, lời khuyên dung hòa và thông báo tặng Bùa Chỉ Đỏ Uyên Ương.
  - Nút "Xuất Thẻ Song Duyên" kích hoạt `CoupleShareCardRenderer.ts` và nút "Tải ảnh PNG về máy".
- [x] **Step 3: Cập nhật `TempleCanvas.vue`**
  - Xử lý khi `nearTarget === 'love_tree'` thì hiện gợi ý `[E]: Thỉnh Quẻ Tơ Duyên (Nguyệt Lão Thắt Chỉ Hồng)`.
  - Mở thẳng ngăn kéo với tab `love_couple`.

---

### Task 4: Kiểm Thử Toàn Diện & Quality Gates

**Files:**
- Verify: `scripts/verify-ui-primitives.mjs`
- Verify: `scripts/boi/test-couple-divination.mjs`
- Verify: `scripts/boi/test-fortune-engine.mjs`
- Verify: `npm.cmd run build`

- [x] **Step 1: Chạy kiểm tra UI Primitives**
  - Đảm bảo 0 font < 12px và 0 ký tự cấm.
- [x] **Step 2: Chạy bộ test Bát Tự & Fortune Engine**
  - Đảm bảo toàn bộ test case Bát Tự (21/21) và test case Bói Duyên Cặp Đôi (3/3) đều PASS.
- [x] **Step 3: Chạy biên dịch Nuxt Production Build**
  - Đảm bảo `npm.cmd run build` hoàn thành với mã thoát 0.
