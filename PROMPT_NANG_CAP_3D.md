# PROMPT HOÀN CHỈNH: NÂNG CẤP & TỐI ƯU 3D DỰ ÁN "VẠN CẢNH THIỀN TỰ" (hydra-pagoda)

*(Copy toàn bộ nội dung dưới đây giao cho AI. Prompt này chỉ mô tả yêu cầu và hiện trạng đã đối chiếu với code thật. Bản này đã được cập nhật sau khi đọc toàn bộ các file Three.js: `TempleStage`, `PilgrimAvatar`, `NameplateHelper`, `PagodaSanctuary`, `SacredBuddhaStatue`, `collision/*`, `LotusPond`, `BellTower`, `TamQuanGate`, `WindGrass`, `AtmosphereManager`, `PBRMaterialFactory`, `PostProcessingManager`, `MultiplayerClient`, `_ws.ts`, `TempleCanvas.vue` phần script.)*

---

## 0. VAI TRÒ & NGUYÊN TẮC LÀM VIỆC

Bạn là Senior Three.js / WebGL Graphics Engineer kiêm Multiplayer Netcode Engineer. Bạn đang làm việc trên dự án **Nuxt 3 + Vue 3 + TypeScript + Three.js ^0.186** (pnpm, dev port 3012). Dự án là game đi chùa ảo nhiều người chơi, kết nối bằng WebSocket Nitro (crossws) tại `/_ws`.

Quy tắc bắt buộc:
1. **Làm theo từng Phase** ở mục 7. Hết mỗi Phase phải chạy được, `pnpm build` không lỗi TypeScript, rồi mới sang Phase sau.
2. **Không phá tính năng đang chạy.** Danh sách cần giữ nguyên nằm ở mục 8.
3. Trước khi sửa một file, đọc lại file đó. **Giữ nguyên chữ ký public API** mà `components/TempleCanvas.vue` đang gọi (liệt kê ở mục 8.1). Nếu buộc phải đổi, sửa luôn nơi gọi và ghi rõ.
4. Chỉ dùng thư viện đã có trong `package.json` và `three/examples/jsm` (GLTFLoader, MeshoptDecoder, KTX2Loader, BufferGeometryUtils, SMAAPass…). Nếu dùng asset ngoài (`.glb`, texture) phải ghi nguồn và giấy phép vào `CREDITS.md`.
5. Không dùng `Math.random()` để sinh nội dung thế giới (cây, cỏ, núi, hoa sen). Dùng PRNG có seed để mọi lần tải và mọi client thấy cùng một thế giới.
6. Mỗi Phase phải kèm số đo trước/sau (FPS, `renderer.info.render.calls`, `renderer.info.render.triangles`, `renderer.info.memory.geometries/textures`).
7. Mọi tài nguyên tạo ra (geometry, material, texture, render target, listener, timer) phải có đường `dispose`/gỡ rõ ràng.

---

## 1. CẤU TRÚC HIỆN TẠI (đã đối chiếu code thật)

| Nhóm | File | Ghi chú đã xác minh |
|---|---|---|
| Sân khấu chính | `lib/world3d/TempleStage.ts` (~1675 dòng) | God-class: renderer, camera, input, VFX, nhân vật, người chơi từ xa, collider, UI-callback |
| Nhân vật | `lib/world3d/PilgrimAvatar.ts` (~841 dòng) | 9 bảng màu `PALETTES`, dựng từ primitive |
| Nameplate | `lib/world3d/NameplateHelper.ts` | `createPilgrimNameplate`, `createSpeechBubbleSprite` (canvas → `Sprite`) |
| Chánh điện | `lib/world3d/sanctuary/PagodaSanctuary.ts` (~881 dòng) | `PagodaSanctuaryHall`, tâm z = -10, tự dựng 100% bằng primitive |
| Tượng Phật | `lib/world3d/sanctuary/SacredBuddhaStatue.ts` | **Code chết**: không nơi nào `new SacredBuddhaStatue`. Tượng đang hiển thị là Phật nhỏ dựng bên trong `PagodaSanctuaryHall` (`buddhaGroup`) |
| Va chạm | `lib/world3d/collision/{CollisionWorld,Collider,CharacterController,CameraSpringArm}.ts` | Quét tuyến tính, nhiều cấp phát bộ nhớ (mục 2.6) |
| Môi trường | `environment/AtmosphereManager.ts` | Preetham Sky, 3 preset ngày/hoàng hôn/đêm |
| Hậu kỳ | `postprocessing/PostProcessingManager.ts` | Thực tế chỉ có RenderPass + OutputPass (mục 2.6) |
| Vật liệu | `materials/PBRMaterialFactory.ts` | Texture canvas 2D tự sinh |
| Công trình | `architecture/BellTower.ts`, `architecture/TamQuanGate.ts`, `nature/LotusPond.ts`, `nature/WindGrass.ts` | Xem lỗi cụ thể ở mục 2.4–2.5 |
| Mạng | `lib/network/MultiplayerClient.ts`, `server/routes/_ws.ts` | JSON, in-memory, một kênh `sangha-temple` |
| Giao diện | `components/TempleCanvas.vue` (~1010 dòng) | Khởi tạo `TempleStage`, nối `MultiplayerClient`, phím tắt |
| Asset sẵn có chưa dùng | `public/models/npc/{caretaker,gardener,guard,stonemason,visitor}.glb` | Không file TS/Vue nào tham chiếu. `TempleStage.ts` có `import { GLTFLoader }` nhưng không dùng. Kiểm tra nội dung (số tris, có skeleton/animation không, giấy phép) trước khi quyết định tái dụng làm base mesh |

Thứ tự dựng cảnh trong constructor `TempleStage`: `buildSkyAndDistantMountains` → `buildCinematicLighting` → `buildGroundWithLanternLightPools` → `buildPlayerCharacter` → `initCollisionWorld` → `buildPagodaSanctuary` → `buildSacredBuddha` → `buildBellPavilionAndPond` → `buildBodhiTreeWithWindPetals` → `buildDetailedIncenseAltar` → `buildMeritAndFortuneStations` → `setTimeOfDay('day')` → `bindControls` → `animate`.

Lưu ý thứ tự: `initCollisionWorld` chạy trước `buildPagodaSanctuary`, nhưng `buildPagodaSanctuary` lại tự gọi `registerColliders` lần nữa, còn `initCollisionWorld` chỉ đăng ký khi `this.sanctuaryHall` đã tồn tại. Cần thống nhất một điểm đăng ký duy nhất.

---

## 2. VẤN ĐỀ CỤ THỂ ĐÃ XÁC MINH TRONG CODE

### 2.1. Nhân vật (`PilgrimAvatar.ts`)
1. **Quá nhiều mesh/material trên mỗi người**: ~150 mesh, 8+ material riêng. Các hàm dựng: `buildLegs` (295), `buildSkirt` (328), `buildTorso` (355), `buildRosaryNecklace` (397: 32 `SphereGeometry` riêng cho hạt chuỗi), `buildArmsAndHands` (429), `buildHead` (532), `updateHeadwear` (611), `buildFootstepsPool` (691: 12 dấu chân hoa sen, mỗi cái 6 `ConeGeometry` cánh hoa, tổng 72 mesh). Nhân 500 người ≈ 75.000 mesh và hàng chục nghìn draw call.
2. `createMaterials` (203) tạo 8+ material riêng mỗi avatar, không dùng chung.
3. `updateHeadwear` (611) gọi `hatGroup.clear()` nhưng **không dispose** geometry/material cũ → rò rỉ mỗi lần đổi quốc gia.
4. **Tỷ lệ & chi tiết thô**: thân/chân/tay là cylinder/capsule/sphere, không có cổ/vai/ngón tay thật, mặt chỉ có màu phẳng, không texture, không nếp vải.
5. **Không đa dạng**: 9 quốc gia dùng chung một silhouette (chỉ đổi màu và mũ qua `PALETTES`); chiều cao cố định ~1.5 m; không có giới tính, tuổi, dáng người, tông da ngoài bảng màu.
6. **Animation thô**: `update` (747) chỉ xoay nhóm khớp bằng hàm sin; tham số `moveSpeed` không được dùng (`walkTime += delta*8.5` cố định); tay không đánh khi đi, không chuyển trọng tâm, không blend giữa trạng thái.
7. **Bug dấu chân hoa sen**: `spawnFootstepLotus` (715) gắn dấu chân vào `this.root` nên dấu chân di chuyển/xoay theo avatar. Đúng ra phải ở world space.
8. `lotusLampLight` khai báo nhưng không dùng. Trạng thái avatar `'standing'|'walking'|'bowing'|'meditating'` không khớp tên emote mạng `'bow'|'meditate'|'pray'`; `TempleCanvas.vue` đang ép kiểu `as any`.

### 2.2. Người chơi từ xa & nameplate (`TempleStage.ts` 1466–1583, `NameplateHelper.ts`, `TempleCanvas.vue`)
1. `upsertRemotePilgrim` (1466) tạo `new PilgrimAvatar()` đầy đủ cho từng người; không LOD, không culling; `avatar.update` được gọi cho tất cả mỗi frame; ngưỡng di chuyển `4.0` hard-code; nội suy `lerp(delta*12)` không dùng snapshot buffer nên giật khi mạng trễ.
2. `removeRemotePilgrim` (1510) chỉ `scene.remove`, **không dispose** geometry/material/texture của avatar và nameplate.
3. Mỗi nameplate (`createPilgrimNameplate` 18, `createSpeechBubbleSprite` 91) là một `CanvasTexture` 512×128 riêng. 500 người ≈ 500 texture ≈ 128 MB GPU, không pool.
4. `showSpeechBubble` (1532) dùng `setTimeout` lưu theo từng người; không dọn khi người đó rời đi.
5. **`TempleCanvas.vue` gọi `stage.upsertRemotePilgrim` với `name: ''`, `title: ''`, `country: ''` từ `onPilgrimMove`**. Gói `move` chỉ mang vị trí nhưng lại đi qua hàm "tạo/ghi đè". Hàm `upsert` phải hỗ trợ **cập nhật một phần** (partial), tuyệt đối không làm mất tên/quốc gia đã có hoặc tạo nameplate rỗng.
6. Nội suy vị trí từ xa, trạng thái emote và bong bóng chat không có hàng đợi; gói `emote` đến trước `join` sẽ bị bỏ qua.

### 2.3. Cây cối & thảm thực vật (`TempleStage.buildBodhiTreeWithWindPetals` 842, `WindGrass.ts`, `buildSkyAndDistantMountains` 542)
1. Chỉ **một** cây bồ đề: 1 `CylinderGeometry(0.8,1.4,8,12)` làm thân + 6 `SphereGeometry` làm tán, vị trí lá dùng `Math.random()`, dùng một `MeshStandardMaterial` xanh phẳng. Không cành, không lá, không rễ, không loài nào khác.
2. **Bug va chạm**: cây hiển thị ở (-11, 0, 12) nhưng collider `bodhi_tree_trunk` đăng ký ở (13, 2.5, 4). Người chơi xuyên thân cây thật và bị chặn bởi không khí.
3. Cây không có gió. Chỉ 350 `Points` cánh hoa cập nhật bằng CPU mỗi frame với `needsUpdate = true`.
4. `WindGrass`: 2200 instance rải bằng `Math.random()` (mỗi lần tải khác nhau); vùng cấm (courtyard, pond, bell, hall) hard-code, trùng lặp với `TempleStage`; `ShaderMaterial` không có fog/ánh sáng/bóng; uniform `time` riêng; chỉ phủ 88×88 m.
5. 12 ngọn núi `ConeGeometry` ngẫu nhiên mỗi lần tải. Nhìn giả và không ổn định giữa các client.

### 2.4. Bản đồ & công trình phụ
**Phạm vi**
1. Vùng đi được chỉ **46 × 50 m ≈ 2.300 m²**: courtyard `BoxGeometry(46,0.22,50)` tại (0, 0.08, 3); 4 collider biên tại x = ±23.5, z = -22.5 và z = 28.5; nền cỏ `PlaneGeometry(120,120)`.
2. Tọa độ hard-code lặp ở nhiều nơi: `lanternCoords` (2 chỗ, `buildGroundWithLanternLightPools` và `initCollisionWorld`), điểm tương tác trong `checkProximity` (1332): (0,0,1.5), (3.5,0,1.5), (-3.5,0,1.5), (0,1.35,-4), (0,1.35,-13.5), (-14,0,0).
3. 8 đèn lồng, mỗi cái một `PointLight` (cộng thêm 6 `PointLight` đèn nổi trong `LotusPond`, 3 `PointLight` trong chánh điện) → tổng ~17 điểm sáng.
4. Camera `far = 1000` nhưng vòm trời `Sky` chỉ `scale 450`; `Fog(0x18131d, 18, 95)` trong `TempleStage` bị `AtmosphereManager.setTimeOfDay` ghi đè (day 35→180, sunset 25→140, night 15→80). Khi mở rộng bản đồ 400×400 phải nâng đồng bộ sky, fog, camera far, vùng bóng.

**`TamQuanGate.ts` (vị trí z = 24.5)**
- 4 trụ tại x = -6.2, -2.2, 2.2, 6.2; tường dài 16 m mỗi bên chạy từ x = ±6.6 đến ±22.6 (cao 3.2 m) nhưng dùng vật liệu `createStonePavementMaterial` (vật liệu lát nền, sai cho tường).
- **Hở 0,9 m**: tường kết thúc tại x = ±22.6 còn collider biên ở x = ±23.5; capsule người chơi đường kính 0,76 m có thể lách qua và bỏ qua cổng tam quan. Ngoài ra cổng đặt ở z = 24.5 còn collider biên ở z = 28.5 nên có 4 m sân phía sau cổng đi được.
- Mái là 3 `ConeGeometry` 4 mặt (kim tự tháp phẳng), **không cong đao** dù comment ghi `buildTripleCurvedRoofs`.
- Bảng hiệu "VẠN CẢNH THIỀN TỰ" là canvas texture tạo riêng.

**`BellTower.ts` (vị trí (15,0,0))**
- Bệ đá collider `bell_tower_base` (6.4×0.7×6.4, `isWalkable = false`) cao 0,7 m > `stepHeight 0.45` ⇒ **không thể bước lên bệ để vào lầu chuông**. Bên trong lầu chỉ có 4 cột và lan can nên về mặt thiết kế phải vào được.
- Mái 2 tầng là `ConeGeometry` 4 mặt (xoay 45°), không cong đao dù comment.
- Gọi `createGraniteStepMaterial` ~7 lần ⇒ 7 canvas + 7 texture trùng nhau.
- Chuông (`LatheGeometry`) có `swingBell(delta, elapsed)` nhưng chưa nối với âm thanh/tương tác; không có `dispose`.

**`LotusPond.ts` (tâm (-14,0,0), bán kính 8.5)**
- 24 khối viền hồ, mỗi khối một `BoxCollider` `pond_curb_i` + một mesh riêng (24 collider chỉ để bao một vòng tròn).
- **Cầu đá vòm**: ~70 mesh (20 ván + 40 trụ + nụ sen), mỗi mesh geometry riêng. Collider cầu `bridge_slope_south/north` (3.2×0.9×7.5, tâm y 0.55) và `bridge_crest` (y 1.15) đều **`isWalkable = false`**, đỉnh cao 1.0–1.35 m > `stepHeight`; lan can `bridge_rail_left/right` (0.4×1.6×17). Hệ quả: cầu **không đi qua được** (hoặc bị coi là tường) mặc dù hiển thị như một cầu vòm. Cần collider dạng dốc/bậc thang hoặc `getSurfaceY` hỗ trợ độ cao thay đổi.
- Mặt nước `ShaderMaterial` (CircleGeometry(8.4,48), sóng ở vertex shader) có `sunDirection` hard-code, không đọc từ `AtmosphereManager`, không fog, không phản chiếu thật.
- 32 cụm hoa sen, mỗi cụm tạo `CircleGeometry` lá và hoa 8 cánh `ConeGeometry` riêng, vị trí dùng `Math.random()`.
- 6 đèn nổi, mỗi cái một `PointLight` (không bóng).
- `TempleStage.buildBellPavilionAndPond` (825) `traverse` vào `lotusPondInstance.floatingLanterns` để chỉnh – phụ thuộc cấu trúc nội bộ.

### 2.5. Chánh điện (`PagodaSanctuary.ts`, `TempleStage.buildPagodaSanctuary` 762)
**Số liệu thật**
- Sàn trong `BoxGeometry(15.6, 0.1, 11.6)` tại y = 1.35 ⇒ **≈ 181 m²**. Ba bậc đá hoa cương 25×21, 23×19, 21×17 (cao 0,45 m mỗi bậc, y = 0.22/0.67/1.12).
- 10 cột ngoài (x = ±8.5/±3, z = -16.5/-10/-3.5, cao 5.9) + 4 cột trong (x = ±4, z = -7.5/-12.5, cao 5.5), mỗi cột có đế riêng.
- Tường hậu z = -16, tường tây x = -8, tường đông x = 8, tường tiền z = -4 chia 2 đoạn 6,2 m + lanh tô, **cửa rộng 3,6 m** (1 cửa), 4 cửa sổ chấn song `PlaneGeometry(2.4×2.2)`, 2 cánh cửa `BoxGeometry(1.72, 3.65, 0.1)` xoay quanh bản lề (±1.75, 1.4, -4), mở vào trong tối đa 1,35 rad.
- Trần `Box(15.8, 0.2, 11.8)` y = 6.75; bệ thờ `Box(5.2,1.25,2.8)` tại (0,1.95,-13.5); bàn lễ `Box(4.2,0.95,1.1)` tại (0,1.82,-11.5).
- Chỉ có **4** đệm thiền (`meditationMats`) tại (±1.2, -7.5/-9.5).
- Sau khi trừ bàn thờ, cột, lối đi, chỉ còn ≈ 100–110 m² dùng được ⇒ tối đa ~90 người (1,2 m²/người). **Chỉ bằng ~1/5 mục tiêu 500.**

**Vấn đề kỹ thuật**
1. **3 `PointLight` đổ bóng trong điện** (2 đèn nến `intensity 2.2, distance 9.5` + `chandelierLight distance 16`): mỗi đèn điểm đổ bóng render 6 mặt cube shadow map ⇒ tốn GPU nặng nhất của cảnh nội thất. Thêm `buddhaHaloLight`.
2. **Phật bị nhân đôi về mặt code**: `PagodaSanctuaryHall` tự dựng Phật (thân `ConeGeometry`, đầu `SphereGeometry`, hào quang mandala 3.6×3.6, 3 lớp đài sen) trong khi `SacredBuddhaStatue` (bệ bát giác, 16 cánh sen, ~40 mesh, vòng hào quang) bị bỏ không dùng.
3. Vật liệu trong điện đều là `MeshStandardMaterial` mới, **không dùng `PBRMaterialFactory`**; 5 canvas texture riêng (gỗ, chấn song, mandala, bảng hiệu…) cho mỗi hall.
4. Mọi cột/tường/cửa sổ đều là `Mesh` + geometry riêng, không gộp, không instance (cột: 14 cột × 2 mesh).
5. `update(delta, elapsed, playerPos)` tạo `new THREE.Vector3(0, 1.35, -4)` **mỗi frame**; khói 75 điểm cập nhật CPU với `Math.random()` và `needsUpdate` mỗi frame; ánh sáng nến nhấp nháy `2.2 + sin(...)*0.35` áp lên mọi `flickerLights`.
6. `isInside(pos)` hard-code `|x| < 7.6 && z in (-15.8, -4.1) && y >= 1.2`: sẽ sai ngay khi đổi kích thước hall.
7. Collider cánh cửa `door_leaf_left/right` được `has()/remove()/add()` **mỗi frame** khi góc cửa vượt 0.35 rad – khó bảo trì, dễ lệch trạng thái. Cửa tự mở khi cách < 4.2 m, tự đóng > 6.0 m, đặt lại thủ công > 9.0 m; tốc độ lerp cửa 4.5, `interiorFactor` lerp 3.5.
8. Mái nằm trong `TempleStage.buildPagodaSanctuary` (không nằm trong class hall): 3 `ConeGeometry` 4 mặt (tâm z = -10, y = 7.8 / 11 / 13.9) + `finial` tại y = 16.6 – không cong đao, không ngói, không dougong.
9. Code chết trong `TempleStage.ts`: `createStonePaveTexture`, `createLightHaloTexture`, và toàn bộ nhánh sau `if (this.atmosphere) return` trong `applyCountryAtmosphere` (1030).

### 2.6. Vòng lặp, render, va chạm, vật liệu, hậu kỳ

**Va chạm (hot spot khi thêm hàng trăm collider cho chánh điện 500 người)**
- `CollisionWorld` lưu `Map<string, Collider>`; `testCapsule` (34) và `raycast` (49) **quét tuyến tính toàn bộ collider**, không broadphase, cấp phát mảng kết quả mỗi lần gọi. `getSurfaceY` (68) tạo 2 `Vector3` mỗi lần và `highestFloor` luôn bằng 0.
- `BoxCollider.testCapsule` (64–178) cấp phát nhiều `Vector3` (5 điểm lấy mẫu `lerpVectors`, vector kẹp, vector điểm gần nhất) **cho mỗi collider mỗi lần gọi**; `raycast` tạo `Ray`, `Box3`, `Vector3` mỗi lần. `CylinderCollider` chỉ là hình trụ đứng 2D (không có nắp trên/dưới, raycast kiểu vòng tròn vô hạn).
- `CharacterController.integrateSubStep`: 3 sub-step/frame (dt giới hạn 0.05) × tối đa 3 vòng lặp + 1 kiểm tra dọc ≈ **12 lần quét toàn bộ collider mỗi frame**, `getCapsule()` cấp phát 2 `Vector3` mỗi lần, `moveDirection.clone()` / `velocity.clone()` mỗi sub-step. Mặt đất cố định y = 0 (không có địa hình).
- Thông số hiện có (giữ làm chuẩn cảm giác điều khiển): bán kính 0.38, cao 1.75 (cúi 1.40), `stepHeight 0.45`, `gravity -22`, `jumpStrength 7.2`.
- `CameraSpringArm`: `cameraRadius 0.28`, `minDistance 0.45`, `currentDistance 4.2`, cấp phát `Vector3` mỗi lần `computePosition`.

**Hậu kỳ — sự thật so với tài liệu `TIEN_DO_DU_AN.md`**
- `PostProcessingManager` import `GTAOPass`, `ShaderPass`, định nghĩa `CinematicToneShader` nhưng **không thêm vào composer**. Composer chỉ có `RenderPass → UnrealBloomPass → OutputPass`, và `setQuality` **luôn đặt `bloomPass.enabled = false`**. Vậy **bloom và GTAO đều đang KHÔNG hoạt động** (tài liệu tiến độ ghi sai).
- Mức chất lượng chỉ đổi `pixelRatio` (low 1.0, medium 1.2, high `min(dpr,1.5)`, ultra `min(dpr,2)`); không đổi shadow map, mật độ cỏ/cây, LOD.
- `EffectComposer` render vào render target không MSAA ⇒ `antialias: true` của renderer không còn tác dụng; không có SMAA/FXAA/TAA ⇒ răng cưa trên cột, mái, cành cây.
- `setSize` không đồng bộ pixelRatio theo quality.

**Môi trường — `AtmosphereManager`**
- `scene.environment = null`; `updateEnvironmentMap` chỉ gán null ⇒ **không có IBL**, vật liệu kim loại (đồng, vàng lá) không có phản chiếu, nhìn xỉn.
- `keyLight`: `DirectionalLight` shadow map 2048, camera bóng ±26 m (chỉ 52 m), far 95, `bias -0.0003`, `normalBias 0.032`. Comment ghi "Cascaded" nhưng thực tế **chỉ có một bản bóng follower** (`updateShadowFollower` đặt đèn cách 55 m, `Math.max(y, 25)`), không có cascade.
- `Sky` scale 450; chế độ đêm ẩn sky; `scene.background = new THREE.Color(...)` tạo mới mỗi lần `setTimeOfDay`; có `rimLight` tại (-18, 24, -28); uniform sky truy cập qua `as any`.

**Vật liệu — `PBRMaterialFactory`**
- Texture sinh bằng canvas 2D (đá lát 1024² có normal/roughness/AO; granite 512²; ironwood 512²; ngói âm dương 512²; đồng cổ; vàng lá không texture; đất rêu 512²), có dùng `Math.random()` ⇒ không tất định.
- `createStonePavementMaterial` có cache texture nhưng **trả về material mới mỗi lần gọi**; `createGraniteStepMaterial` và `createIronwoodMaterial` **không cache texture** ⇒ mỗi lần gọi tạo thêm canvas + texture (`BellTower` ~7 lần, `LotusPond` 2, `TamQuanGate` 1…).
- `prepareTexture` ghi đè khóa cache mà không dispose texture cũ (rò rỉ).
- Chất lượng thấp so với PBR thật: không có ảnh texture thật, không KTX2.

**Vòng lặp chung**
- `checkProximity` (1332) và `updatePlayerAndCamera` (1187) gọi `new THREE.Vector3` mỗi frame (cộng `PagodaSanctuaryHall.update`, `CollisionWorld`, `Collider`, `CameraSpringArm`).
- CPU particle mỗi frame: khói hương, khói trong điện 75 điểm, cánh hoa 350, mote ~45 – `needsUpdate = true`.
- `destroy()` (1636) không gỡ đủ listener `window` (`mousemove`, `mousedown`, `resize`, `keydown`, `keyup`) đã thêm trong `bindControls` ⇒ rò rỉ khi chuyển trang/Hot reload.
- `setGraphicsQuality` (1626) chỉ gọi `postProcessing.setQuality` (xem trên), `TempleCanvas.vue` có phím F4 xoay vòng chất lượng.

### 2.7. Mạng (`MultiplayerClient.ts`, `_ws.ts`)
1. Server phát lại **mọi** gói `move` cho tất cả bằng `peer.publish('sangha-temple', …)`. Với 500 người × 20 gói/giây = **~250.000 message/giây** cần gửi (mỗi người nhận 499 gói/giây·người). Client JSON.parse từng gói.
2. Không rate-limit, không kiểm tra hợp lệ (NaN, teleport), không dọn người chết; một kênh duy nhất cho toàn bộ người chơi.
3. `server:snapshot` gửi toàn bộ danh sách dạng JSON mỗi khi có người vào. Client `streamMove` throttle 50 ms nhưng không delta/quantize.
4. Join mặc định tại `[0, 0, 10]` do `TempleCanvas.vue` gửi — mọi người xuất hiện chồng lên nhau.

---

## 3. YÊU CẦU 1 — NHÂN VẬT GIỐNG THẬT & ĐẸP HƠN

**Mục tiêu**: tỷ lệ người thật (~7,5 đầu), trang phục có nếp vải, vật liệu có texture, animation mượt, đa dạng ngoại hình, nhưng đủ rẻ để vẽ 500 người cùng lúc.

### 3.1. Kiến trúc mới
Tạo thư mục `lib/world3d/avatar/`:
- `AvatarKit.ts`: **một bản duy nhất** geometry, material, texture dùng chung (singleton, ref-count, có `dispose()`).
- `AvatarFactory.ts`: tạo avatar từ `AvatarDescriptor`.
- `AvatarCrowd.ts`: quản lý đám đông (mục 5).

Giữ `PilgrimAvatar` làm lớp vỏ tương thích, bên trong dùng AvatarKit. Chữ ký công khai `setCountryStyle`, `setAction`, `triggerBow`, `update`, `root` giữ nguyên.

`AvatarDescriptor`: `{ country, gender, bodyType (4–6 kiểu), height (0.92–1.08), ageGroup, skinTone, hairStyle (8–12), outfitPalette, accessories }`. Sinh tất định từ `seed = hash(peerId)` để một người luôn có cùng ngoại hình trên mọi client; người chơi cục bộ cho chọn trong tủ đồ.

### 3.2. Hình học
- Hai hướng được phép (ghi rõ lựa chọn trong báo cáo Phase):
  - (a) **GLB low-poly có skeleton** 3–5k tris (LOD0) đặt ở `public/models/pilgrim/`, nạp bằng `GLTFLoader` + meshopt/KTX2; hoặc tái dụng/khảo sát `public/models/npc/*.glb` nếu đạt chuẩn.
  - (b) Sinh `BufferGeometry` thủ tục nhưng **gộp một lần** bằng `BufferGeometryUtils.mergeGeometries` thành 1–3 mesh/người ở LOD0.
- LOD0 ≤ 8 mesh/avatar; LOD1 một mesh gộp ≤ 1.500 tris; không còn 32 `SphereGeometry` hạt chuỗi: dùng `TubeGeometry`/`InstancedMesh` 32 hạt dùng chung.
- Dấu chân hoa sen: một `InstancedMesh` toàn cục (world space, vòng đệm ~256 instance), sửa bug gắn nhầm vào `root`.

### 3.3. Trang phục theo quốc gia (thật sự khác silhouette)
- Việt Nam: áo nhật bình / áo lam, nón lá, nón quai thao; sư Bắc tông áo hậu.
- Nhật Bản: kimono / samue, kasa.
- Thái Lan: cà sa vàng cam quấn một bên vai (Theravada), đầu cạo.
- Hàn Quốc: hanbok / áo Seon, gat.
- Đài Loan, Singapore: áo Đường / áo sư Hán truyền.
- Ấn Độ: kurta / dhoti.
- Tây Tạng: chuba, đỏ thẫm.
- Phương Tây: trang phục thiền đơn giản.

Mỗi bộ có tối thiểu normal map (nếp vải), roughness map, ORM nén; texture atlas 2048² dùng chung cho cả đám đông.

### 3.4. Vật liệu
- Dùng chung `PBRMaterialFactory` (đã sửa cache, mục 2.6). Vải: `MeshStandardMaterial`/`MeshPhysicalMaterial` sheen nhẹ; da: rim-lighting giả SSS trong `onBeforeCompile`; tóc: alpha-tested.
- Màu từng người đi qua **instance attribute** hoặc `paletteIndex`, không clone material.
- `setOutfitColor` (`TempleStage` 1176, hiện `traverse` đổi màu từng mesh) phải đổi sang uniform/instance attribute.

### 3.5. Animation
- LOD0: `AnimationMixer` + `SkinnedMesh`, clip: idle, walk, run nhẹ, bow, pray (chắp tay), meditate (ngồi kiết già), kneel/prostrate; blend 0,2–0,3 s; tốc độ chân theo `moveSpeed` thật.
- LOD1: Vertex Animation Texture (VAT) cho `InstancedMesh`; mỗi instance có `animClip`, `animPhase`, `animSpeed`.
- Một bảng ánh xạ duy nhất giữa emote mạng (`bow|meditate|pray`) và action avatar, **không dùng `as any`**.

### 3.6. Giữ nguyên
`setCountryStyle`, `setAction('standing'|'walking'|'bowing'|'meditating')`, `triggerBow` (1,8 s), halo aura, nameplate, nón/mũ theo quốc gia.

---

## 4. YÊU CẦU 2 — CÂY CỐI GIỐNG THẬT & ĐẸP HƠN

Tạo `lib/world3d/nature/TreeSystem.ts` (+ `TreeSpecies.ts`, `WindSystem.ts`). Thay hoàn toàn `buildBodhiTreeWithWindPetals` nhưng giữ hiệu ứng cánh hoa rơi/mote (chuyển lên GPU).

### 4.1. Dữ liệu & va chạm
- Một nguồn dữ liệu `treeSpawns: { id, species, x, z, scale, rotY, seed }[]` (seeded PRNG), nằm trong `MapLayout`.
- Collider thân cây **sinh tự động từ chính `treeSpawns`** (`CylinderCollider` bán kính = bán kính thân thực tế). Sửa triệt để lỗi lệch cây (-11,0,12) và collider (13,2.5,4). Tán lá không có collider.

### 4.2. Loài cây (tối thiểu 6)
Bồ đề (cây chủ đề, tán lớn, lá tim), đa/đề cổ thụ (rễ phụ), tre/trúc (cụm), thông, phong/đào/anh đào (theo quốc gia), cọ/dừa (Thái, Ấn), chuối/cau cảnh, bụi hoa và cây cảnh.

### 4.3. Hình học & vật liệu
- Thân/cành: L-system hoặc thủ tục → `BufferGeometry`, 3 mức LOD hình học (6–8 cạnh gần, 4 cạnh xa), UV theo chiều dài, PBR vỏ cây có normal + AO.
- Tán lá: **thẻ lá alpha-tested `InstancedMesh`** (3–6k thẻ/cây gần, ít hơn khi xa), mỗi thẻ là cụm lá trên atlas texture, màu biến thiên nhẹ theo instance, theo mùa/quốc gia (anh đào, phong đỏ, lá vàng).
- Bóng đổ cho thân cây gần; tán lá dùng `customDepthMaterial` alpha-test hoặc tắt bóng ở xa.

### 4.4. Gió
- `WindSystem` duy nhất cấp uniform dùng chung: `uTime`, `uWindDir`, `uWindStrength`, `uGust` (noise). **`WindGrass` cũng đọc cùng uniform.**
- Vertex shader (qua `onBeforeCompile`): thân uốn theo độ cao, cành lắc lệch pha, lá rung tần số cao; biên độ lấy từ vertex color/attribute "độ cứng". Chuyển động liên tục, không giật.

### 4.5. LOD & số lượng
- 3 mức: cây đầy đủ ≤ 25 m, cây rút gọn 25–70 m, **billboard impostor** > 70 m. Mỗi loài/mỗi LOD là **một** `InstancedMesh`.
- 400–1500 cây trên toàn bản đồ lớn, **≤ 40 draw call cho toàn bộ thực vật**.
- Cỏ: `WindGrass` lên bản đồ mới, rải bằng seeded PRNG và mask khu vực từ `MapLayout` (bỏ `inCourtyard/inPond/inBell/inHall` hard-code), thêm fog + chiếu sáng cơ bản trong fragment shader, chỉ dựng trong bán kính ~60 m quanh camera (chunk).

### 4.6. Núi xa
Thay 12 `ConeGeometry` bằng dải núi dựng từ heightmap/noise có seed cố định (ridge noise), nhiều lớp mờ sương (aerial perspective), nằm ngoài biên bản đồ.

---

## 5. HIỆU NĂNG CHO 500 NHÂN VẬT (QUAN TRỌNG NHẤT)

**Ngân sách mục tiêu** (tại 500 người có mặt):
| Chỉ số | Mức High | Mức Low |
|---|---|---|
| FPS | ≥ 60 (RTX 3050 / M1) | ≥ 30 (iGPU) |
| Draw call | ≤ 300 | ≤ 150 |
| Tam giác | ≤ 2 triệu | ≤ 800k |
| GPU memory | ≤ 1 GB | ≤ 500 MB |
| CPU JS/frame | ≤ 8 ms | ≤ 10 ms |
| Băng thông mỗi client | ≤ 200 kbps | — |

### 5.1. `AvatarCrowd` (thay `remotePilgrims: Map<string, RemotePilgrimInstance>`)
- **LOD0 (≤ 15 m, tối đa ~40 người)**: `SkinnedMesh` + `AnimationMixer`, pool tái sử dụng (không tạo/hủy liên tục), có nameplate, có bóng.
- **LOD1 (15–45 m)**: `InstancedMesh` mỗi kiểu thân (~1.500 tris), animation VAT, không bóng, không nameplate.
- **LOD2 (45–110 m)**: impostor/billboard instanced (atlas nhiều góc nhìn và pose), ≤ 200 tris.
- **LOD3 (> 110 m hoặc ngoài frustum)**: ẩn, không update.
- Thuộc tính theo instance (`InstancedBufferAttribute`): `instanceColor`, `paletteIndex`, `animClip`, `animPhase`, `animSpeed`, `skinTone`. Khác biệt cá nhân **không** qua material riêng.
- Với đám đông ngồi thiền trong chánh điện (hàng trăm người cùng pose tĩnh): dùng một clip "ngồi thiền" VAT, chỉ nhúc nhích nhẹ (hơi thở) – rẻ nhất.

### 5.2. Update & culling
- Spatial hash (ô 16–32 m) chọn người theo khoảng cách. `update` đầy đủ chỉ cho LOD0; LOD1 cập nhật vị trí 30 Hz, LOD2 10 Hz.
- Cập nhật ma trận `InstancedMesh` theo lô, chỉ đánh dấu dirty phần thay đổi (dùng `addUpdateRange`).
- Nội suy snapshot: hàng đợi ~100 ms, nội suy giữa hai snapshot (thay `lerp(delta*12)`).
- Không đưa người từ xa vào `CollisionWorld` (chỉ người chơi cục bộ va chạm; người từ xa bám vị trí server).

### 5.3. Nameplate
- Atlas texture 512–2048² chứa nhiều tên (SDF font hoặc canvas atlas), pool ~30 sprite chỉ cho LOD0; tên khác không hiển thị. Bong bóng chat dùng chung pool, 8–16 cái đồng thời; timer dọn khi người rời đi.

### 5.4. Ánh sáng, bóng, vật liệu
- Không `PointLight` riêng cho avatar/đèn lồng: chuyển đèn lồng sang **emissive + sprite glow**, giữ tối đa 3–4 `PointLight` thật (chọn động gần camera nhất), **không PointLight đổ bóng** (bỏ cube shadow của 3 đèn trong điện; dùng ánh sáng baked/emissive + 1 `SpotLight`/`DirectionalLight` bóng).
- Chỉ ánh sáng định hướng chính đổ bóng; nếu cần bao phủ bản đồ lớn thì 2–3 cascade thật (CSM) hoặc 1 bản follow; tắt `castShadow` cho LOD1+ và vật nhỏ.
- Gộp geometry tĩnh (cột, lan can, đèn lồng, ván cầu, viền hồ) thành `InstancedMesh` hoặc mesh gộp theo vật liệu; dùng chung material qua `PBRMaterialFactory` (cache cả material lẫn texture).
- **Bật lại IBL**: tạo PMREM từ Sky (hoặc `RoomEnvironment`/HDR nhỏ), gán `scene.environment`, cập nhật theo `setTimeOfDay` (không mỗi frame).
- **Hậu kỳ thật sự**: thêm anti-aliasing (MSAA render target `samples = 4` hoặc `SMAAPass`), bật bloom nhẹ cho đèn/nến (chỉ ở High), GTAO tùy chọn ở Ultra. Cập nhật `TIEN_DO_DU_AN.md` cho đúng thực tế.
- `setGraphicsQuality` phải điều khiển thật: shadow map size, pixelRatio (1–2), số LOD0, khoảng cách LOD, bloom/GTAO bật/tắt, mật độ cỏ/cây.

### 5.5. Dọn rác trong vòng lặp & va chạm
- Scratch object (`Vector3`, `Quaternion`, `Matrix4`, `Box3`, `Ray`) ở cấp module/class cho: `checkProximity`, `updatePlayerAndCamera`, `updateRemotePilgrims`, `PagodaSanctuaryHall.update`, `CollisionWorld.getSurfaceY`, `BoxCollider.testCapsule/raycast`, `CylinderCollider.*`, `CharacterController.getCapsule/integrateSubStep`, `CameraSpringArm.computePosition`.
- `CollisionWorld`: thêm **broadphase** (lưới đều 4–8 m hoặc BVH/AABB tree cho collider tĩnh), `testCapsule` chỉ xét collider trong ô quanh capsule; trả về mảng tái sử dụng; `getSurfaceY` trả độ cao thật (hỗ trợ dốc/cầu/bậc thang). Mục tiêu: ≤ 0,3 ms/frame cho cả bộ điều khiển với ≥ 500 collider.
- Gộp collider tương tự (24 viền hồ → 1 collider vòng; cột hàng loạt → danh sách cylinder chung).
- Hạt khói/cánh hoa/mote chuyển sang GPU (shader theo `uTime`, không `needsUpdate` mỗi frame).
- Cửa chánh điện: collider cánh cửa tạo một lần, bật/tắt bằng cờ `enabled` thay vì `add/remove` mỗi frame.

### 5.6. Mạng cho 500 người (`MultiplayerClient.ts`, `_ws.ts`)
- Server tick cố định 10–20 Hz: gom mọi cập nhật vào **một gói nhị phân** (quantize vị trí 16-bit, yaw 8-bit) rồi phát; không relay từng gói `move`.
- **Interest management**: chia ô (32 m); mỗi client chỉ nhận người trong ~120 m, ngoài tầm nhận bản tóm tắt tần suất thấp; chia thành nhiều topic/phòng.
- Giới hạn tỷ lệ: ≤ 5 `move`/giây từ client sau khi quantize; chat ≤ 1 tin/s; emote ≤ 1/s; kiểm tra NaN, tốc độ tối đa (chống teleport), kích thước chuỗi; dọn người treo quá 15 s.
- `server:snapshot` chỉ gửi lần đầu và dạng nén; đẩy delta về sau. Client tự nhận biết `join` thiếu để tạo sau (hàng đợi emote/chat).
- Join đặt vào vị trí spawn phân tán (vòng tròn/lưới quanh cổng) thay vì cùng `[0,0,10]`.

### 5.7. Công cụ kiểm thử bắt buộc
- Overlay thống kê bật bằng **F2** (F3 = collider debug, F4 = đổi chất lượng đồ họa đã dùng trong `TempleCanvas.vue`): FPS, `renderer.info.render.calls/triangles`, `memory.geometries/textures`, số avatar mỗi LOD, CPU ms mỗi hệ thống.
- Chế độ **bot** `?bots=N`: sinh N người giả di chuyển theo quỹ đạo có seed (không cần server), phân bố cả trong chánh điện lẫn ngoài sân (500 bot ngồi đúng ô từ `HallLayout`).
- Script load-test server: tạo N client WebSocket giả, đo CPU/băng thông ở 100/250/500 người.

---

## 6. YÊU CẦU 3 & 4 — BẢN ĐỒ MỞ RỘNG & CHÁNH ĐIỆN 500 NGƯỜI

### 6.1. `MapLayout` (một nguồn dữ liệu duy nhất)
Tạo `lib/world3d/world/MapLayout.ts` chứa toàn bộ tọa độ: công trình, hồ, cây (`treeSpawns`), đèn, điểm tương tác, vùng cấm của cỏ, vùng spawn, tuyến camera. Mọi hàm `build*`, `initCollisionWorld`, `checkProximity`, `WindGrass`, `TreeSystem` đọc từ đây. Xóa tọa độ hard-code lặp (`lanternCoords` 2 chỗ, điểm tương tác trong `checkProximity`).

### 6.2. Bố cục thế giới ~400 × 400 m, vùng đi được ≥ 160 × 200 m
Tọa độ gợi ý (sắp theo trục Bắc–Nam, trục chính z; cổng ở phía Nam, chánh điện ở phía Bắc):
1. **Cổng ngoại + đường dẫn** (z ≈ +180): đường đá 8 m, hàng cây hai bên.
2. **Cổng Tam Quan** (`TamQuanGate`, z ≈ +120): 3 lối đi, tường bao thật sự nối liền với hàng rào (sửa lỗ hở 0,9 m), mái cong đao.
3. **Sân hành lễ lớn** (≈ 60 × 70 m, **4.200 m²**; ~6.000 m² gồm hành lang): chứa khoảng 6.000 người đứng ở 0,7 m²/người hoặc 500 người thoải mái; lát đá có normal.
4. **Hồ Sen** (`LotusPond`) phía Tây, **Lầu Chuông** (`BellTower`) phía Đông (đối xứng), cầu vòm đi qua được, lầu chuông bước vào được.
5. **Chánh điện** (mục 6.3) ở phía Bắc sân, hướng Nam.
6. **Nhà Tăng, nhà ăn, thư viện** hai bên chánh điện (khối đơn giản, có thể vào hành lang).
7. **Vườn thiền + rừng trúc + đồi cây** phía Bắc/Tây/Đông; **Tháp bảo / điện phụ** làm điểm nhấn.
8. **Con đường mòn** nối các khu, địa hình thoải (heightmap thấp, đồi nhẹ), suối nhỏ.

Kỹ thuật bản đồ:
- Ground: heightmap terrain (lưới chia chunk 64 m), splat texture (đất, đá lát, rêu), thay `PlaneGeometry(120,120)`. Sân đá lát riêng có normal. `CollisionWorld.getSurfaceY` phải đọc được độ cao terrain.
- Chunk streaming: ẩn/hiện theo khoảng cách để chia tải draw call và bộ nhớ.
- Đồng bộ: `camera.far` ≈ 600, `Fog` near/far theo `AtmosphereManager` preset (ví dụ 60–420), `Sky.scale` ≥ 450 → ≥ 1.5 × far hoặc chuyển sang dome cố định theo camera, vùng bóng follower, biên collider bám hàng rào tường (thay 4 collider bao 46×50 m).
- Điểm tương tác (hương, hòm công đức, quẻ, cửa, tượng Phật, hồ) chuyển sang danh sách trong `MapLayout`, mỗi điểm có `id`, `position`, `radius`, `action` ('incense' | 'merit_box' | 'fortune' | 'meditation' | 'lantern' | 'door' khớp với `InteractionTarget` của `TempleCanvas.vue`).

### 6.3. Thiết kế lại Chánh điện để chứa 500 người

**Hiện tại**: sàn 15,6 × 11,6 ≈ 181 m², dùng được ≈ 100 m² ⇒ ~90 người, chỉ 4 đệm.

**Thiết kế mới** (tính toán diện tích cụ thể):
- Kích thước thông thủy: **40 m × 30 m = 1.200 m²**.
- Phân bổ chiều sâu 30 m (Bắc → Nam): khu bàn thờ + bệ Phật + lễ vật **6,5 m**; vùng đệm trước bàn thờ **1,0 m**; vùng ngồi thiền **20,9 m (19 hàng × 1,1 m)**; vùng đệm cửa vào phía Nam **1,6 m**. Tổng = 30 m.
- Phân bổ chiều ngang 40 m: tường + cột sát tường **2 × 0,5 m = 1 m**; lối đi dọc hai bên **2 × 1,5 m = 3 m**; lối đi trung tâm **3 m**; vùng ngồi **30 đệm × 1,1 m = 33 m**. Tổng = 40 m.
- Diện tích: khu bàn thờ 40 × 6,5 = 260 m²; vùng ngồi 33 × 20,9 ≈ **690 m²**; lối đi, vùng đệm, tường ≈ 250 m². Tổng ≈ 1.200 m².
- Mỗi chỗ ngồi **1,1 m × 1,1 m = 1,21 m²/người**. Cột hiên nằm ở hàng cột sát tường (bước cột 8 m), không nằm trong vùng ngồi; vị trí chi tiết tính trong code `HallLayout`.
- Hàng ngang: 30 đệm (15 mỗi bên lối đi giữa). Số hàng: 19.
- Tổng lý thuyết 30 × 19 = **570 chỗ**; sau khi tránh cột còn **≥ 500 chỗ**. Bắt buộc kiểm tra bằng code và `assert` (`HallLayout.getMeditationSlots().length >= 500`, không slot nào nằm trong collider).
- Chế độ đứng cúng bái dày 0,6 m²/người ⇒ ≈ 1.100 người (chỉ kiểm tra dự phòng).
- Phần mái, sườn: mái tầng chồng, mái cong đao, hiên bao quanh 2,5 m ba mặt; **bệ nền ≈ 46 × 36 m**. Thay 3 `ConeGeometry` bằng mái dựng từ profile cong (`BufferGeometry` có đầu đao), ngói `InstancedMesh` hoặc texture ngói có normal. Thêm vì kèo/dougong ở hiên (instanced).
- Lối vào: **3 cửa chính (cửa bức bàn)** rộng 3,6 m ở mặt Nam + **2 cửa phụ** hai bên để 500 người vào không tắc. Giữ cơ chế `doorAngle`, `toggleDoor`, `interiorFactor` (chuyển exposure trong/ngoài), mở rộng cho nhiều cánh cửa; `isInside()` suy ra từ `HallLayout` (AABB hall + cao độ sàn), không hard-code.
- Collider: tường, cột, bệ bàn thờ sinh từ `HallLayout`/`MapLayout`; cột gom thành danh sách `CylinderCollider` có broadphase; bậc thềm có thể đi lên (`isWalkable = true`) và thang/dốc khuyết tật.
- `HallLayout.getMeditationSlots()` trả về ≥ 500 slot (vị trí, hướng nhìn, hàng), dùng chung cho: người chơi thật tìm chỗ ngồi gần nhất khi bấm M, bot ngồi, và đệm thiền hiển thị (`InstancedMesh` 500 đệm).
- Nội thất: dùng **một** tượng Phật (hoặc nâng cấp `SacredBuddhaStatue` rồi xóa bản Phật dựng thô trong `PagodaSanctuaryHall`); bàn thờ Tam Bảo, khói hương; ánh sáng nội thất ≤ 4 `PointLight` không bóng + AO baked/emissive; camera spring arm vẫn hoạt động trong điện, không xuyên cột/tường.

---

## 7. THỨ TỰ THỰC HIỆN (ƯU TIÊN)

**Phase 0 — Chuẩn bị & đo đạc**
- Overlay thống kê (F2) và chế độ `?bots=N` (mục 5.7). Đo baseline với 0/50/200/500 bot.
- Sửa nhanh lỗi an toàn: dispose đầy đủ (`removeRemotePilgrim`, `updateHeadwear`, `showSpeechBubble`, `PBRMaterialFactory.prepareTexture`), gỡ hết listener `window` trong `destroy()`, scratch Vector3, xóa code chết (`createStonePaveTexture`, `createLightHaloTexture`, nhánh chết `applyCountryAtmosphere`, import `GLTFLoader` thừa nếu chưa dùng).
- Sửa bug collider cây (-11,0,12) vs (13,2.5,4); thống nhất điểm đăng ký collider chánh điện; sửa `upsertRemotePilgrim` hỗ trợ partial update (move không xóa tên/quốc gia).

**Phase 1 — Nền tảng dữ liệu & hạ tầng dùng chung**
- `MapLayout`, `HallLayout`, `WindSystem`, `treeSpawns`; cache material/texture trong `PBRMaterialFactory` (granite, ironwood, pavement trả về material dùng chung); bật IBL; sửa hậu kỳ (MSAA/SMAA, bloom thật) và cập nhật `setGraphicsQuality`.
- Refactor `TempleStage` tách các `build*` thành module nhưng chưa đổi hình dạng.
- Tối ưu va chạm: broadphase + zero-allocation + gộp collider; test hồi quy cảm giác điều khiển (cùng `stepHeight`, `gravity`, `jumpStrength`).

**Phase 2 — Đám đông 500 người (ưu tiên cao nhất)**
- `AvatarKit` chia sẻ geometry/material; dấu chân hoa sen thành `InstancedMesh` toàn cục; nameplate atlas + pool.
- `AvatarCrowd`: LOD0 pool + LOD1 instanced VAT, culling, spatial hash, nội suy snapshot.
- Mục tiêu: 500 bot ≥ 45 FPS ở High.

**Phase 3 — Mạng**
- Tick server, gói nhị phân, interest management, rate-limit/validate, spawn phân tán. Load-test 100/250/500.

**Phase 4 — Nhân vật đẹp & thật**
- Hình học/skeleton mới, trang phục theo quốc gia, atlas texture, animation blend, VAT; giữ API tương thích.

**Phase 5 — Cây cối & môi trường**
- `TreeSystem`, 6 loài, gió chung `WindSystem`, `WindGrass` trên bản đồ mới, núi xa ổn định, hạt GPU.

**Phase 6 — Bản đồ lớn & Chánh điện 500 người**
- Terrain + chunk; dựng lại hall theo mục 6.3; sửa Tam Quan (hở 0,9 m, vật liệu tường, mái cong), Lầu Chuông (vào được bệ, mái cong), Hồ Sen (cầu đi qua được, collider viền hồ gộp, nước đọc hướng mặt trời từ `AtmosphereManager`).
- Dùng `HallLayout.getMeditationSlots()` cho 500 bot; kiểm tra `assert ≥ 500`.

**Phase 7 — Hoàn thiện**
- Tinh chỉnh LOD, bộ nhớ, texture KTX2; cập nhật `TIEN_DO_DU_AN.md` (sửa thông tin sai về bloom/GTAO) và `CREDITS.md`; chạy toàn bộ tiêu chí mục 9.

---

## 8. TÍNH NĂNG PHẢI GIỮ NGUYÊN

### 8.1. API công khai mà `TempleCanvas.vue` đang dùng (không đổi chữ ký)
`new TempleStage(container)`, các callback `onNearTarget`, `onRightClick`, `onCameraModeChange`, `onLocalMove`, và các phương thức `upsertRemotePilgrim`, `removeRemotePilgrim`, `triggerRemoteEmote`, `showSpeechBubble` (có id `'local'`), `triggerLocalEmote('standing'|'walking'|'bowing'|'meditating')`, `toggleDebugColliders`, `toggleSanctuaryDoor`, `isNearDoor`, `setCountry`, `setTimeOfDay`, `setOutfitColor`, `setGraphicsQuality`, `cycleCameraMode`, `requestPointerLock`, `exitPointerLock`, `destroy`.

### 8.2. Tính năng
- Điều khiển WASD / chuột / pointer lock, 3 chế độ camera (`fpp`, `tpp_back`, `tpp_front`), `CharacterController` capsule, `CameraSpringArm`.
- Phím tắt hiện có trong `TempleCanvas.vue`: Alt (nhả pointer lock), 1/2/3 (menu), Esc, B (cúi lạy), M (thiền), C (ngăn Sangha), X (bánh xe emote), **F3 (collider debug), F4 (xoay vòng chất lượng đồ họa)**. Phím mới phải tránh trùng (đề xuất F2 cho overlay thống kê).
- Cửa chánh điện mở/đóng bằng chuột phải (`toggleSanctuaryDoor`), tự mở khi lại gần, chuyển exposure trong/ngoài.
- 9 quốc gia (`setCountry`, `AtmosphereManager`), ngày/hoàng hôn/đêm (`setTimeOfDay`).
- Hồ sen, lầu chuông, cổng tam quan, tượng Phật, bàn thờ hương, hòm công đức, bàn quẻ, đèn lồng (tương tác qua `checkProximity`/`InteractionTarget`).
- Đa người chơi: join/move/emote/chat/leave, nameplate, bong bóng chat, `OnlinePilgrimsModal`.
- Emote wheel, thiền nhóm, âm thanh `ZenAudio`, ví Cardano, store Pinia: không được đụng vào logic.
- Khí quyển Preetham Sky + tone mapping ACES. *(Bloom/GTAO hiện chưa chạy; nếu bật thì coi là cải tiến, không phải "giữ nguyên".)*

---

## 9. TIÊU CHÍ HOÀN THÀNH (NGHIỆM THU)

**Hiệu năng (đo bằng overlay F2 và `?bots=500`)**
- [ ] 500 avatar hiển thị/quản lý cùng lúc: **≥ 60 FPS** ở High (RTX 3050 / M1), **≥ 30 FPS** ở Low (iGPU).
- [ ] Draw call ≤ 300 (High) / ≤ 150 (Low); tam giác ≤ 2 triệu; GPU memory ≤ 1 GB; CPU JS ≤ 8 ms/frame.
- [ ] Cho 10 người vào/ra liên tục × 500 lượt: `renderer.info.memory.geometries/textures` không tăng đơn điệu (không rò rỉ); mở/tắt trang 15 lần không tăng bộ nhớ đáng kể.
- [ ] Collision: `CharacterController.update` ≤ 0,3 ms/frame với ≥ 500 collider; 0 cấp phát đối tượng mới trong vòng lặp nóng (kiểm tra bằng profiler).
- [ ] Mạng: server ≤ 20 gói/s/client xuống, ≤ 200 kbps/client; CPU server chấp nhận được với 500 client giả; không tin tin giả (NaN/teleport/spam).

**Chất lượng hình ảnh**
- [ ] Nhân vật: tỷ lệ ~7,5 đầu, có cổ/vai/ngón tay, ít nhất 9 silhouette trang phục khác nhau, ≥ 4 dáng người, animation có blend; không còn 72 mesh dấu chân mỗi người.
- [ ] Cây: ≥ 6 loài, cấu trúc thân–cành–tán rõ ràng, đung đưa theo gió liên tục, cỏ cùng nhịp gió, không còn "quả cầu xanh".
- [ ] Bản đồ: vùng đi được ≥ 160 × 200 m trong thế giới ~400 × 400 m, bố cục theo mục 6.2, núi xa ổn định mỗi lần tải; không có lỗ hở bỏ qua cổng tam quan.
- [ ] Chánh điện: sàn ≥ 1.200 m², ≥ 500 chỗ thiền hợp lệ (có test `assert`), 3 cửa chính + 2 cửa phụ, mái cong đao có ngói, chỉ **một** tượng Phật, không PointLight đổ bóng cube.
- [ ] Vật liệu kim loại có phản chiếu IBL; có anti-aliasing; răng cưa cột/mái giảm rõ.

**Gameplay**
- [ ] Không đi xuyên tường, cột, thân cây, nước; **cầu vòm đi qua được; lầu chuông vào được**; vào/ra chánh điện mượt kể cả khi đông người; camera không xuyên tường.
- [ ] Mọi tính năng ở mục 8 vẫn chạy; `pnpm build` và `pnpm dev` không lỗi TypeScript.

---

*Hết prompt.*
