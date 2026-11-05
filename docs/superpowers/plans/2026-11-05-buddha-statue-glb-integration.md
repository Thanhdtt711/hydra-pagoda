# Kế Hoạch Triển Khai: Tích Hợp Tôn Tượng Phật Thích Ca Mâu Ni 3D GLB (Đá Rêu Cổ)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế toàn bộ hình học primitive của tượng Phật Thích Ca Mâu Ni trong Chánh Điện bằng model 3D điêu khắc thật `the_buddha_statue_in_a_mountain.glb` giữ nguyên chất liệu Đá rêu cổ truyền và hiệu ứng hào quang xoay linh thiêng.

**Architecture:** Sử dụng `three/examples/jsm/loaders/GLTFLoader.js` để nạp tệp GLB trong `SacredBuddhaStatue.ts`. Tự động chuẩn hóa kích thước đạt chiều cao $4.2\text{m}$, căn tâm đáy hoa sen tiếp xúc mặt bệ Tam Bảo, bật đổ bóng thể tích (`castShadow`/`receiveShadow`), định vị vòng hào quang `DharmaHalo` sau đầu tượng, và bổ sung cơ chế giải phóng bộ nhớ `dispose()`.

**Tech Stack:** Three.js, GLTFLoader, TypeScript, Nuxt 3, Vite, Puppeteer/Chrome CDP.

## Global Constraints
- Đường dẫn model: `public/models/the_buddha_statue_in_a_mountain.glb`
- Chất liệu: Đá rêu cổ truyền nguyên bản (Texture map $1024 \times 1024$)
- Số lượng đa giác: 21.489 tam giác
- Chiều cao tượng sau chuẩn hóa: $4.2\text{m}$
- Tọa độ gắn: Đáy đài sen tiếp xúc đỉnh bệ Tam Bảo ($Y = 3.05\text{m}$ thế giới)
- Giữ vững 60 FPS và Pass 100% 16/16 test nghiệm thu

---

### Task 1: Viết Test Tự Động Kiểm Định Tôn Tượng GLB

**Files:**
- Create: `scratch/test_buddha_glb_integration.mjs`

**Interfaces:**
- Consumes: `the_buddha_statue_in_a_mountain.glb`
- Produces: Test case kiểm tra file tồn tại, dung lượng hợp lệ, triangle count $\le 25.000$, và tải thành công qua Three.js GLTFLoader.

- [x] **Step 1: Viết test runner độc lập kiểm định GLB**
- [x] **Step 2: Chạy test và xác nhận PASS trước khi sửa code chính**

---

### Task 2: Cập Nhật `SacredBuddhaStatue.ts` Tích Hợp Model GLB

**Files:**
- Modify: `lib/world3d/sanctuary/SacredBuddhaStatue.ts`

**Interfaces:**
- Consumes: `/models/the_buddha_statue_in_a_mountain.glb`
- Produces: `SacredBuddhaStatue` class xuất `root: THREE.Group`, `haloMesh: THREE.Mesh`, `update(delta: number)`, và `dispose()`.

- [x] **Step 1: Import GLTFLoader và cấu hình hàm tải model async**
- [x] **Step 2: Chuẩn hóa tỉ lệ (Auto-scaling height = 4.2m) và căn giữa đáy đài sen (Y = 0)**
- [x] **Step 3: Bật shadow casting & shadow receiving cho toàn bộ meshes**
- [x] **Step 4: Giữ vầng hào quang pháp luân xoay phía sau đầu tượng**
- [x] **Step 5: Bổ sung phương thức `dispose()` an toàn bộ nhớ**

---

### Task 3: Build & Kiểm Tra Tích Hợp Toàn Bộ Hệ Thống

**Files:**
- Build: Nuxt production bundle (`npm run build`)
- Restart server port 3012

- [x] **Step 1: Biên dịch production build đảm bảo không lỗi TypeScript**
- [x] **Step 2: Khởi động lại production server**
- [x] **Step 3: Chạy lại toàn bộ 16 test nghiệm thu trong `scratch/test_phase7_acceptance.mjs`**

---

### Task 4: Chụp Ảnh Nghiệm Thu Trực Quan Đa Góc Nhìn

**Files:**
- Create: `scratch/capture_buddha_statue_verification.mjs`
- Output: `buddha_statue_glb_front_view.png`, `buddha_statue_glb_close_up.png`, `buddha_statue_glb_overview.png`

- [x] **Step 1: Chụp ảnh góc chính diện từ Cửa Giữa Chánh Điện nhìn vào Tôn tượng**
- [x] **Step 2: Chụp ảnh cận cảnh diện mạo từ bi và đài sen đá rêu cổ**
- [x] **Step 3: Chụp ảnh góc nghiêng phối cảnh cùng 500 đệm thiền**
- [x] **Step 4: Xác nhận chất lượng mỹ thuật và gửi ảnh cho người dùng duyệt**
