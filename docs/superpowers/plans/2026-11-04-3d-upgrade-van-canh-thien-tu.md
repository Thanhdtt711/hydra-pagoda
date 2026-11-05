# Kế Hoạch Triển Khai Nâng Cấp & Tối Ưu 3D "Vạn Cảnh Thiền Tự" (Phases 0 → 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn diện thế giới 3D "Vạn Cảnh Thiền Tự" (Three.js ^0.186 + Nuxt 3) đạt chuẩn đồ họa chân thực, mở rộng bản đồ 400x400m, thiết kế lại Chánh điện chứa >= 500 người thiền tọa, và tối ưu hiệu năng đạt >= 60 FPS (High) / >= 30 FPS (Low) với 500 avatar đồng thời.

**Architecture:** Kiến trúc phân tầng module hóa: `MapLayout` + `HallLayout` làm nguồn dữ liệu tọa độ duy nhất; `AvatarKit` + `AvatarCrowd` đa tầng LOD (LOD0 SkinnedMesh pool, LOD1 InstancedMesh VAT, LOD2 billboard impostor) kết hợp spatial hash và snapshot buffer; `CollisionWorld` broadphase lưới đều zero-allocation; `TreeSystem` + `WindSystem` đồng bộ shader gió; server WebSocket nhị phân quantize 16/8-bit phân vùng interest management 32m.

**Tech Stack:** Three.js ^0.186, Vue 3, Nuxt 3, TypeScript, WebGL, GLTFLoader, BufferGeometryUtils, SMAAPass, UnrealBloomPass, WebSockets (Nitro crossws).

## Global Constraints
- Tuân thủ nghiêm ngặt thứ tự Phase 0 → 7. Không nhảy cóc. Cuối mỗi Phase phải chạy `pnpm.cmd build` không lỗi TypeScript và chạy được `pnpm.cmd dev` (port 3012).
- Giữ nguyên 100% chữ ký public API của `TempleStage` mà `TempleCanvas.vue` đang gọi (mục 8.1).
- Giữ nguyên 100% tính năng hiện có ở mục 8.2 (WASD, chuột, pointer lock, 3 camera mode, SpringArm, phím tắt Alt/1/2/3/Esc/B/M/C/X/F3/F4, 9 quốc gia, ngày/hoàng hôn/đêm, tương tác Chánh điện, ZenAudio, Pinia store, ví Cardano).
- Không dùng `Math.random()` để sinh dữ liệu thế giới (cây, cỏ, núi, vị trí, hoa sen); sử dụng PRNG có seed (xoshiro128 / mulberry32).
- Mọi tài nguyên tạo ra (geometry, material, texture, render target, event listener, timer) phải có cơ chế `dispose()` và dọn dẹp triệt để.
- Chỉ sử dụng thư viện đã có trong `package.json` và `three/examples/jsm`. Ghi nhận asset ngoài vào `CREDITS.md`.
- Không đụng vào logic Pinia, ví Cardano CIP-30, ZenAudio.
- Mỗi Phase báo cáo kèm số đo trước/sau (FPS, `renderer.info.render.calls`, `renderer.info.render.triangles`, `renderer.info.memory.geometries/textures`).

---

## Danh Sách Các Phase Triển Khai

### Phase 0: Chuẩn Bị, Đo Đạc Baseline & Sửa Nhanh Lỗi An Toàn

#### Task 0.1: Hệ Thống Thống Kê Hiệu Năng HUD [F2] & Chế Độ Bot Giả Lập (`?bots=N`)
**Files:**
- Create: `lib/world3d/debug/PerformanceProfiler.ts`
- Modify: `lib/world3d/TempleStage.ts`
- Modify: `components/TempleCanvas.vue`

**Interfaces:**
- Consumes: `renderer.info`, Three.js scene, performance.now()
- Produces: `stage.toggleStatsOverlay(): boolean`, benchmark bots generator `stage.spawnDebugBots(count: number)`

- [ ] **Step 1: Tạo module `PerformanceProfiler.ts`**
  - Hiển thị FPS, Frame Time (ms), CPU JS ms/frame.
  - Hiển thị `renderer.info.render.calls`, `renderer.info.render.triangles`, `renderer.info.render.lines/points`.
  - Hiển thị `renderer.info.memory.geometries`, `renderer.info.memory.textures`.
  - Hiển thị số lượng avatar theo từng cấp độ LOD (LOD0/LOD1/LOD2/LOD3).
  - Tích hợp phím tắt F2 để bật/tắt HUD overlay (tránh đè F3 collider debug, F4 graphics quality).

- [ ] **Step 2: Thêm chế độ `?bots=N` giả lập chuyển động có seed**
  - Đọc query param `bots` từ URL (ví dụ `?bots=50`, `?bots=200`, `?bots=500`).
  - Sinh N bot giả lập di chuyển tuần hoàn theo quỹ đạo seeded PRNG (mulberry32).
  - Phân bổ bot cả ngoài sân chùa lẫn các vị trí thiền trong chánh điện.

- [ ] **Step 3: Đo đạc và ghi nhận chỉ số Baseline**
  - Đo tại 0 bot, 50 bot, 200 bot, 500 bot.
  - Ghi nhận FPS, Calls, Triangles, Memory Geometries/Textures.

#### Task 0.2: Sửa Nhanh Các Lỗi An Toàn, Rò Rỉ Bộ Nhớ & Đồng Bộ Collider
**Files:**
- Modify: `lib/world3d/TempleStage.ts`
- Modify: `lib/world3d/PilgrimAvatar.ts`
- Modify: `lib/world3d/NameplateHelper.ts`
- Modify: `lib/world3d/materials/PBRMaterialFactory.ts`

- [ ] **Step 1: Gỡ bỏ toàn bộ event listener window trong `TempleStage.destroy()`**
  - Lưu tham chiếu các hàm callback: `mousemove`, `mousedown`, `mouseup`, `click`, `pointerlockchange`, `contextmenu`, `wheel`.
  - Tháo gỡ đầy đủ các listener trong `destroy()`.

- [ ] **Step 2: Sửa dọn dẹp bộ nhớ trong `removeRemotePilgrim` và `showSpeechBubble`**
  - Khi xóa remote pilgrim: dispose geometry/material/texture của avatar, nameplate sprite và speech bubble sprite.
  - Khi đổi trang phục `updateHeadwear`: traverse và dispose geometry/material cũ trước khi clear nhóm `hatGroup`.
  - Trong `PBRMaterialFactory.prepareTexture`: kiểm tra khóa cache cũ, gọi `dispose()` texture cũ trước khi gán đè.

- [ ] **Step 3: Sửa bug lệch collider cây Bồ đề và thống nhất điểm đăng ký collider Chánh điện**
  - Đồng bộ collider cây Bồ đề `bodhi_tree_trunk` về đúng tọa độ hiển thị `(-11, 2.5, 12)` với bán kính gốc cây thực tế.
  - Xóa bỏ việc kiểm tra `if (this.sanctuaryHall)` vô hiệu trong `initCollisionWorld`, tập trung đăng ký collider Chánh điện tại duy nhất `buildPagodaSanctuary`.

- [ ] **Step 4: Hỗ trợ Cập nhật Một Phần (Partial Update) cho `upsertRemotePilgrim`**
  - Khi nhận gói `onPilgrimMove` với `name: ''`, `country: ''`: không làm mất dữ liệu người chơi đã lưu; nếu người chơi chưa tồn tại thì gán giá trị mặc định hợp lệ thay vì tạo nameplate rỗng.

- [ ] **Step 5: Dọn dẹp code chết trong `TempleStage.ts`**
  - Xóa hàm không dùng: `createStonePaveTexture`, `createLightHaloTexture`.
  - Xóa nhánh code chết `if (this.atmosphere) return` trong `applyCountryAtmosphere`.
  - Xóa import thừa `GLTFLoader` khi chưa dùng.

- [ ] **Step 6: Kiểm tra xác nhận `pnpm.cmd build` & `pnpm.cmd dev`**
  - Build không lỗi TypeScript, mở browser kiểm tra không lỗi runtime console.

---

### Phase 1: Nền Tảng Dữ Liệu & Hạ Tầng Dùng Chung

#### Task 1.1: Thiết Kế `MapLayout` & `HallLayout` Làm Nguồn Dữ Liệu Duy Nhất
**Files:**
- Create: `lib/world3d/world/MapLayout.ts`
- Create: `lib/world3d/world/HallLayout.ts`
- Modify: `lib/world3d/TempleStage.ts`
- Modify: `lib/world3d/sanctuary/PagodaSanctuary.ts`

- [ ] **Step 1: Tạo `MapLayout.ts` với Seeded PRNG**
  - Định nghĩa tọa độ duy nhất cho các công trình: Chánh điện, Cổng Tam Quan, Hồ Sen, Lầu Chuông, Lư hương, Hòm công đức, Bàn xăm, Đèn lồng.
  - Danh sách `treeSpawns` sinh từ PRNG có seed cố định.
  - Tích hợp `InteractionPoint`: `{ id, position, radius, action }` khớp với `InteractionTarget`.
  - Thay thế toàn bộ tọa độ hard-code trùng lặp trong `TempleStage` và `PagodaSanctuary`.

- [ ] **Step 2: Tạo `HallLayout.ts` thiết kế Chánh điện 1.200 m² và >= 500 Chỗ Thiền**
  - Kích thước thông thủy 40m x 30m, bệ nền 46m x 36m.
  - Lưới chỗ ngồi 19 hàng x 30 đệm (khoảng cách 1.1m x 1.1m = 1.21 m²/người), chừa hành lang giữa 3m và 2 lối bên 1.5m.
  - Hàm `getMeditationSlots()` trả về >= 500 slot, kiểm tra va chạm tránh cột, có `console.assert(slots.length >= 500)`.

#### Task 1.2: Hệ Thống Gió Dùng Chung `WindSystem.ts`
**Files:**
- Create: `lib/world3d/nature/WindSystem.ts`
- Modify: `lib/world3d/nature/WindGrass.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Triển khai `WindSystem` quản lý uniform gió tập trung**
  - Quản lý uniform: `uWindTime`, `uWindDirection`, `uWindStrength`, `uWindGust`.
  - Cập nhật thời gian thực theo hàm sin kết hợp nhiễu vi mô.
  - Nối `WindGrass` đọc chung uniform gió từ `WindSystem`.

#### Task 1.3: Cải Tiến `PBRMaterialFactory`: Cache Toàn Diện & Tái Kích Hoạt IBL
**Files:**
- Modify: `lib/world3d/materials/PBRMaterialFactory.ts`
- Modify: `lib/world3d/environment/AtmosphereManager.ts`

- [ ] **Step 1: Cache toàn diện cả Material lẫn Texture**
  - `createStonePavementMaterial`, `createGraniteStepMaterial`, `createIronwoodMaterial` lưu cache material singleton, tái sử dụng giữa các mesh thay vì tạo mới.
  - Thay thế `Math.random()` trong quá trình tạo canvas texture bằng PRNG có seed.

- [ ] **Step 2: Tái kích hoạt IBL (Image-Based Lighting) cho PBR Materials**
  - Trong `AtmosphereManager`: render PMREM cubemap từ Preetham Sky vào `currentEnvRenderTarget` khi gọi `setTimeOfDay`.
  - Gán `scene.environment = envMap` để các vật liệu kim loại (đồng cổ, vàng lá) có phản chiếu môi trường sống động.

#### Task 1.4: Nâng Cấp Pipeline Hậu Kỳ (MSAA / SMAA & Bloom Thật)
**Files:**
- Modify: `lib/world3d/postprocessing/PostProcessingManager.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Cấu hình Render Target có Anti-Aliasing (MSAA / SMAAPass)**
  - Hỗ trợ WebGLRenderTarget `samples = 4` khi thiết bị hỗ trợ, hoặc bổ sung `SMAAPass` vào composer để khử răng cưa cho cột, mái và cành cây.

- [ ] **Step 2: Kích hoạt Bloom dịu nhẹ thực tế & Đồng bộ `setGraphicsQuality`**
  - Bật lại `UnrealBloomPass` ở High/Ultra với thông số thanh tịnh (`strength: 0.25`, `radius: 0.3`, `threshold: 0.95`).
  - Cập nhật `setGraphicsQuality` điều khiển thực tế: shadow map resolution (512 - 2048), pixelRatio (1.0 - 2.0), bloom bật/tắt, khoảng cách LOD.

#### Task 1.5: Tối Ưu Hóa Hệ Thống Va Chạm: Broadphase & Zero Allocation
**Files:**
- Modify: `lib/world3d/collision/CollisionWorld.ts`
- Modify: `lib/world3d/collision/Collider.ts`
- Modify: `lib/world3d/collision/CharacterController.ts`
- Modify: `lib/world3d/collision/CameraSpringArm.ts`

- [ ] **Step 1: Thêm Broadphase Spatial Grid (ô 4m - 8m) vào `CollisionWorld`**
  - Đưa các collider tĩnh vào lưới ô không gian 2D/3D.
  - `testCapsule` và `raycast` chỉ truy vấn các collider thuộc các ô xung quanh bounding box của capsule/tia ray.

- [ ] **Step 2: Tái sử dụng Scratch Objects (Zero Allocation trong vòng lặp)**
  - Định nghĩa bộ scratch objects (`Vector3`, `Box3`, `Ray`) tĩnh trong `Collider.ts`, `CharacterController.ts`, `CameraSpringArm.ts`.
  - Tái sử dụng mảng kết quả `CollisionResult[]` thay vì tạo mảng mới mỗi lần gọi.
  - Nâng cấp `getSurfaceY` trả về độ cao chính xác hỗ trợ mặt nghiêng, dốc và cầu vòm.

- [ ] **Step 3: Chạy test hồi quy cảm giác điều khiển**
  - Đảm bảo giữ nguyên các thông số điều khiển: bán kính 0.38m, chiều cao 1.75m, `stepHeight = 0.45m`, `gravity = -22.0`, `jumpStrength = 7.2`.

- [ ] **Step 4: Kiểm tra xác nhận `pnpm.cmd build` & `pnpm.cmd dev`**
  - Đo đạc thời gian CPU ms/frame của hệ thống va chạm trước và sau tối ưu.

---

### Phase 2: Đám Đông 500 Người (Ưu Tiên Hiệu Năng Cao Nhất)

#### Task 2.1: `AvatarKit`: Dùng Chung Hình Học & Vật Liệu
**Files:**
- Create: `lib/world3d/avatar/AvatarKit.ts`
- Create: `lib/world3d/avatar/AvatarDescriptor.ts`
- Modify: `lib/world3d/PilgrimAvatar.ts`

- [ ] **Step 1: Triển khai `AvatarKit.ts` (Singleton Resource Manager)**
  - Quản lý một bộ Geometry và Material duy nhất cho toàn bộ avatar.
  - Hỗ trợ đổi bảng màu qua `InstancedBufferAttribute` hoặc uniform index thay vì nhân bản material.
  - Gộp các chi tiết nhỏ: thay 32 khối cầu tràng hạt bằng 1 geometry ống dây hoặc thẻ hạt gộp.

- [ ] **Step 2: Tách Dấu Chân Hoa Sen thành Global `InstancedMesh`**
  - Chuyển 12 dấu chân hoa sen x 6 cánh của từng avatar thành **một** `InstancedMesh` toàn cục trong `TempleStage` (vòng đệm 256 instance) đặt ở World Space.
  - Sửa dứt điểm lỗi dấu chân xoay theo nhân vật.

#### Task 2.2: Hệ Thống Nameplate & Bong Bóng Chat Dùng Chung (Atlas & Pool)
**Files:**
- Create: `lib/world3d/avatar/NameplateAtlas.ts`
- Modify: `lib/world3d/NameplateHelper.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Tạo Nameplate Texture Atlas & Sprite Pool**
  - Ghép nhiều nameplate vào một Canvas Texture Atlas duy nhất.
  - Quản lý pool ~30-40 sprite nameplate cho người chơi ở LOD0 (cự ly gần <= 15m).
  - Tự động ẩn nameplate cho người chơi ở xa (> 15m).

- [ ] **Step 2: Quản lý Bong Bóng Thoại Chat bằng Pool**
  - Duy trì pool 8-16 bong bóng thoại đồng thời, tự động thu hồi và dọn timer khi hết hạn hoặc người chơi rời phòng.

#### Task 2.3: `AvatarCrowd`: Quản Lý Đám Đông Phân Tầng LOD & Spatial Culling
**Files:**
- Create: `lib/world3d/avatar/AvatarCrowd.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Xây dựng hệ thống phân tầng LOD cho 500 người**
  - **LOD0 (<= 15m, tối đa ~40 người)**: Avatar đầy đủ, có nameplate, đổ bóng.
  - **LOD1 (15m - 45m)**: `InstancedMesh` theo kiểu dáng thân, không nameplate, không đổ bóng.
  - **LOD2 (45m - 110m)**: Billboard impostor instanced tiết kiệm triệt để.
  - **LOD3 (> 110m hoặc ngoài Frustum)**: Ẩn hoàn toàn, bỏ qua bước update.

- [ ] **Step 2: Spatial Hash Grid & Cập Nhật Ma Trận Theo Lô**
  - Chia thế giới thành các ô không gian (16m - 32m).
  - Cập nhật ma trận `InstancedMesh` chỉ cho các instance thay đổi vị trí (`addUpdateRange`).

- [ ] **Step 3: Bộ Đệm Nội Suy Snapshot (Snapshot Interpolation Buffer)**
  - Hàng đợi snapshot 100ms, nội suy mượt mà vị trí và góc quay yaw giữa hai snapshot liên tiếp (thay thế `lerp(delta * 12)`).

- [ ] **Step 4: Kiểm tra đo đạc với chế độ `?bots=500`**
  - Đo FPS, Calls, Triangles, GPU memory. Mục tiêu: đạt >= 45 - 60 FPS ở cấu hình High với 500 bot.

---

### Phase 3: Mạng & Đồng Bộ Đa Người Chơi (Multiplayer Netcode)

#### Task 3.1: Tối Ưu Hóa Giao Thức Mạng WebSocket & Gói Nhị Phân Quantized
**Files:**
- Modify: `server/routes/_ws.ts`
- Modify: `lib/network/MultiplayerClient.ts`

- [ ] **Step 1: Thiết kế cấu trúc gói nhị phân (Binary Packed Packet)**
  - Quantize tọa độ vị trí 16-bit nguyên, góc yaw 8-bit, action code 8-bit (chỉ ~6-8 bytes/người chơi thay vì chuỗi JSON hàng trăm bytes).
  - Server tick cố định 10Hz - 20Hz: gom dữ liệu các người chơi thành một gói nhị phân duy nhất gửi về client.

- [ ] **Step 2: Interest Management theo Phân Vùng Không Gian (Spatial Partitioning)**
  - Chia bản đồ thành các ô 32m. Client chỉ nhận gói tin chi tiết của người chơi trong bán kính ~120m.
  - Ngoài cự ly 120m chỉ gửi gói tóm tắt tần số thấp (1Hz - 2Hz).

- [ ] **Step 3: Rate Limiting, Validation & Dọn Phiên Treo**
  - Giới hạn client gửi tối đa 5 move/giây sau khi quantize, 1 chat/giây, 1 emote/giây.
  - Kiểm tra tính hợp lệ: phát hiện NaN, kiểm tra tốc độ tối đa chống teleport.
  - Tự động ngắt kết nối và dọn phiên không phản hồi quá 15 giây.

- [ ] **Step 4: Vị Trí Xuất Hiện Phân Tán (Distributed Spawn Points)**
  - Client mới tham gia được xếp vào các vị trí spawn phân tán hình nan quạt hoặc lưới quanh Cổng Tam Quan, không xuất hiện đè lên nhau tại `[0, 0, 10]`.

- [ ] **Step 5: Viết kịch bản kiểm thử tải máy chủ (Load-test Script)**
  - Tạo script Node giả lập 100, 250 và 500 client kết nối gửi nhận dữ liệu để đo đạc CPU server và băng thông mạng.

---

### Phase 4: Nhân Vật Đẹp & Tỷ Lệ Thực

#### Task 4.1: Tạo Hình Học Nhân Vật Tỷ Lệ Thực (~7.5 Đầu)
**Files:**
- Create: `lib/world3d/avatar/ProceduralAvatarModel.ts` (hoặc cấu hình nạp base mesh GLB nếu kiểm chứng đạt chuẩn)
- Modify: `lib/world3d/avatar/AvatarKit.ts`
- Modify: `lib/world3d/PilgrimAvatar.ts`

- [ ] **Step 1: Khảo sát các base mesh hiện có `public/models/npc/*.glb`**
  - Kiểm tra số polygon, skeleton, rig xương, animation clip và bản quyền.
  - Quyết định hướng tối ưu nhất: sử dụng low-poly base mesh hoặc tạo `BufferGeometry` thủ tục gộp qua `BufferGeometryUtils.mergeGeometries` (<= 8 mesh ở LOD0, <= 1.500 tris ở LOD1).

- [ ] **Step 2: Thiết kế Cổ Phục & Mũ Nón Riêng Biệt Theo 9 Quốc Gia**
  - Tái hiện rõ nét silhouette đặc trưng cho từng quốc gia:
    - Việt Nam: Áo Tấc / Áo Nhật Bình / Áo Lam, Nón Lá dát viền chỉ vàng kim.
    - Nhật Bản: Samue / Kimono Zen, Nón rơm Kasa.
    - Thái Lan: Y Cà Sa Theravada vàng saffron hở một bên vai.
    - Hàn Quốc: Hanbok Durumagi, Mũ Gat Joseon.
    - Đài Loan / Singapore: Pháp phục cận đại / Áo Đường thêu sen.
    - Ấn Độ: Y Dhoti / Kurta đất Phật.
    - Tây Tạng: Chuba đỏ thẫm ấm áp.
    - Phương Tây: Trang phục thiền Làng Mai giản dị.
  - Tạo Texture Atlas 2048x2048 chứa Normal Map (nếp vải) và Roughness Map dùng chung.

- [ ] **Step 3: Nâng Cấp Hệ Thống Hoạt Ảnh (Animation Blending)**
  - LOD0: Tích hợp `AnimationMixer` với các clip: `idle`, `walk`, `run`, `bow`, `pray` (chắp tay), `meditate` (ngồi kiết già).
  - Tốc độ nhịp chân chuyển động khớp chính xác với `moveSpeed` thực tế.
  - Chuyển đổi trạng thái mượt mà (Crossfade blend 0.2s - 0.3s).
  - Xây dựng bảng mapping tường minh giữa Emote mạng (`bow|meditate|pray`) và Action của Avatar, loại bỏ triệt để việc ép kiểu `as any`.

---

### Phase 5: Cây Cối, Thực Vật & Môi Trường Tự Nhiên

#### Task 5.1: `TreeSystem`: Hệ Thống Cây 6 Loài, Cấu Trúc Thân - Cành - Tán & Gió
**Files:**
- Create: `lib/world3d/nature/TreeSpecies.ts`
- Create: `lib/world3d/nature/TreeSystem.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Định nghĩa 6 loài cây đặc trưng chốn thiền môn**
  - Cây Bồ đề cổ thụ (cây tâm điểm, tán rộng, lá hình tim).
  - Đa/Đề cổ thụ (gốc bạnh, rễ phụ buông rủ).
  - Rừng Trúc / Khóm Tre xanh thanh tịnh.
  - Thông núi / Tùng La Hán cổ thụ.
  - Cây Phong đỏ / Hoa Anh Đào (tùy chỉnh theo quốc gia).
  - Cau cảnh / Dừa nước ven hồ.

- [ ] **Step 2: Dựng hình học thân cây và tán lá Instanced Cards**
  - Thân cây có UV dọc và PBR vỏ cây (Normal + AO).
  - Tán lá sử dụng thẻ lá alpha-tested `InstancedMesh` gắn vào cành.
  - Tích hợp Vertex Shader uốn lượn theo `WindSystem` (thân uốn chậm, cành rung nhịp nhàng, lá rung tần số cao).
  - Tự động sinh `CylinderCollider` từ danh sách `treeSpawns` khớp 100% vị trí thân cây thực tế.

- [ ] **Step 3: Phân tầng LOD Cây Cối**
  - LOD0 (<= 25m): Cây đầy đủ chi tiết, cành lá đung đưa, có bóng đổ.
  - LOD1 (25m - 70m): Cây rút gọn polygon.
  - LOD2 (> 70m): Billboard impostor instanced cực nhẹ.
  - Tổng số draw call cho toàn bộ cây cối thực vật trên bản đồ <= 40 calls.

#### Task 5.2: Nâng Cấp `WindGrass` Phân Mảng Chunk & Shader Tích Hợp
**Files:**
- Modify: `lib/world3d/nature/WindGrass.ts`

- [ ] **Step 1: Rải cỏ theo Seeded PRNG và MapLayout Mask**
  - Loại bỏ hoàn toàn `Math.random()`, rải cỏ theo lưới chunk 64m dựa vào dữ liệu mask của `MapLayout`.
  - Cập nhật Fragment Shader hỗ trợ sương mù `fog` của Three.js và ánh sáng môi trường.

#### Task 5.3: Dải Núi Xa Ổn Định & Chuyển Hạt Lên GPU
**Files:**
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Dựng dải núi xa bằng Heightmap Ridge Noise Seeded**
  - Thay thế 12 khối nón ngẫu nhiên bằng dãy núi chân trời nhiều lớp mờ sương (Aerial Perspective) cố định mọi lần tải.

- [ ] **Step 2: Chuyển toàn bộ hệ thống hạt sang GPU Shader**
  - Khói trầm, cánh hoa bồ đề bay, đom đóm thiền quang tính toán chuyển động trong Vertex Shader theo `uTime`, không gọi `needsUpdate = true` trên CPU mỗi frame.

---

### Phase 6: Bản Đồ Lớn 400x400m & Chánh Điện 500 Người

#### Task 6.1: Mở Rộng Địa Hình Thế Giới ~400x400m (Playable >= 160x200m)
**Files:**
- Create: `lib/world3d/world/TerrainSystem.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Triển khai Terrain Heightmap chia Chunk**
  - Sân gạch đại lễ 60m x 70m lát đá PBR có Normal map.
  - Nền đất tự nhiên chia chunk 64m streaming theo khoảng cách.
  - Đồng bộ `camera.far = 600`, vòm trời `Sky`, sương mù `Fog` (60m - 420m) và vùng bao collider bám sát hàng rào tường bao chùa.

#### Task 6.2: Thiết Kế Lại Toàn Bộ Chánh Điện 1.200 m² (Chứa 500 Người)
**Files:**
- Modify: `lib/world3d/sanctuary/PagodaSanctuary.ts`
- Modify: `lib/world3d/TempleStage.ts`

- [ ] **Step 1: Dựng cấu trúc Chánh điện mới 40m x 30m**
  - Bệ tam cấp granite rộng 46m x 36m, có đường dốc thoải hỗ trợ di chuyển.
  - 3 cửa chính (cửa bức bàn) rộng 3.6m ở mặt Nam + 2 cửa phụ hai bên Đông/Tây để chống tắc nghẽn khi đông người.
  - Mái nhiều tầng uốn cong đầu đao truyền thống, ngói lợp instanced hoặc normal map chất lượng cao, có vì kèo dougong hiên chùa.

- [ ] **Step 2: Bố trí Nội Thất & 500 Chỗ Thiền Tọa Hợp Lệ**
  - Hiển thị 500 đệm thiền (`InstancedMesh`) tại các vị trí sinh ra từ `HallLayout.getMeditationSlots()`.
  - Tích hợp kiểm tra `console.assert(HallLayout.getMeditationSlots().length >= 500)`.
  - Hợp nhất tôn tượng Phật: sử dụng một tượng Phật trang nghiêm duy nhất, bỏ bản trùng lặp.
  - Ánh sáng nội thất: tối đa 3-4 PointLight không bóng kết hợp ambient/emissive dịu mắt, loại bỏ hoàn toàn shadow cube map gây nặng GPU.

#### Task 6.3: Sửa Lỗi Các Công Trình Phụ: Tam Quan, Lầu Chuông, Hồ Sen
**Files:**
- Modify: `lib/world3d/architecture/TamQuanGate.ts`
- Modify: `lib/world3d/architecture/BellTower.ts`
- Modify: `lib/world3d/nature/LotusPond.ts`

- [ ] **Step 1: Sửa Cổng Tam Quan**
  - Nối liền tường bao với biên rào, triệt tiêu khe hở 0.9m.
  - Chuyển vật liệu tường sang vật liệu đá/vôi tường thay vì vật liệu lát nền `createStonePavementMaterial`.
  - Dựng mái uốn cong đầu đao.

- [ ] **Step 2: Sửa Lầu Chuông**
  - Đặt bệ đá `bell_tower_base` có bậc tam cấp bước lên được (`isWalkable: true`).
  - Dựng mái 2 tầng uốn cong đầu đao.
  - Nối chuông đồng với âm thanh khi người chơi tương tác.

- [ ] **Step 3: Sửa Hồ Sen & Cầu Đá Vòm Cong**
  - Đặt collider cầu đá `bridge_slope_south`, `bridge_crest`, `bridge_slope_north` thành `isWalkable = true` để người chơi đi qua cầu mượt mà.
  - Gộp 24 collider viền bờ hồ thành một cấu trúc vòng tối ưu.
  - Shader mặt nước đọc hướng mặt trời thực tế từ `AtmosphereManager`.

---

### Phase 7: Hoàn Thiện, Đóng Gói & Nghiệm Thu Toàn Diện

#### Task 7.1: Tinh Chỉnh Hiệu Năng & Nén Tài Nguyên
**Files:**
- Modify: `lib/world3d/*`
- Modify: `CREDITS.md`
- Modify: `TIEN_DO_DU_AN.md`

- [ ] **Step 1: Kiểm thử Rò rỉ Bộ nhớ (Memory Leak Verification)**
  - Chạy kịch bản 10 người vào/ra liên tục 500 lượt: xác nhận `renderer.info.memory.geometries/textures` không tăng đơn điệu.
  - Đóng/mở trang 15 lần xác nhận bộ nhớ giải phóng sạch sẽ.

- [ ] **Step 2: Cập Nhật Tài Liệu Dự Án**
  - Cập nhật `TIEN_DO_DU_AN.md`: ghi đúng thực tế các cải tiến về Bloom, IBL, Khử răng cưa, Cây cối, Chánh điện 500 người.
  - Ghi nhận đầy đủ bản quyền các asset được sử dụng vào `CREDITS.md`.

#### Task 7.2: Chạy Toàn Bộ Tiêu Chí Nghiệm Thu (Mục 9)
- [ ] **Hiệu năng:**
  - 500 avatar hiển thị: >= 60 FPS (High), >= 30 FPS (Low).
  - Draw call <= 300 (High) / <= 150 (Low); Triangles <= 2 triệu; GPU memory <= 1 GB; CPU JS <= 8 ms/frame.
  - Collision controller update <= 0.3 ms/frame với >= 500 collider; 0 cấp phát object mới trong hot loop.
  - Mạng: server <= 20 gói/s/client, <= 200 kbps/client.
- [ ] **Chất lượng hình ảnh:**
  - Nhân vật tỷ lệ thực ~7.5 đầu, 9 silhouette trang phục, animation blend mượt.
  - Cây cối 6 loài có thân-cành-tán, lay động theo gió liên tục đồng bộ cùng thảm cỏ.
  - Bản đồ lớn >= 160x200m đi được, Chánh điện >= 1.200 m² có >= 500 chỗ thiền (có test `assert`).
  - Vật liệu kim loại phản chiếu IBL, có khử răng cưa mượt mà.
- [ ] **Gameplay & Tương Thích:**
  - Cầu vòm đi qua được, lầu chuông vào được, camera không xuyên tường.
  - Giữ nguyên 100% public API và tính năng mục 8.
  - `pnpm.cmd build` và `pnpm.cmd dev` chạy hoàn hảo không lỗi.

---
*Kế hoạch hoàn tất, sẵn sàng chuyển giao thực hiện theo từng Phase sau khi được phê duyệt.*

