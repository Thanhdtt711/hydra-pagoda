# Kế hoạch nâng cấp lại giao diện 3D "Vạn Cảnh Thiền Tự": Low-poly tối giản (kiểu Monument Valley / Journey)

- **Ngày:** 2026-11-06
- **Trạng thái:** Chờ duyệt
- **Thay thế định hướng của:** `PROMPT_NANG_CAP_3D.md` và `2026-11-04-3d-upgrade-van-canh-thien-tu.md`. Hai tài liệu này đi theo hướng PBR/realistic và chibi toon, không còn phù hợp.
- **Giữ lại:** phần hạ tầng kỹ thuật tốt của lần nâng cấp trước (collision, network, crowd/LOD, layout, profiler).

---

## 1. Các quyết định đã chốt

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Phong cách | **Low-poly tối giản**: mảng màu phẳng, hình khối gọn, sương mù nhiều lớp. Không texture ảnh, không PBR map. |
| 2 | Bảng màu | **Mỗi thời điểm một palette phẳng riêng**: `day`, `sunset`, `night`. Giữ 3 chế độ hiện có. |
| 3 | Nhân vật | Tỉ lệ người thật **~7 đầu**, low-poly facet, có đầu/tay/chân rõ, **silhouette trang phục khác nhau theo quốc gia**. |
| 4 | Kỹ thuật dựng nhân vật | **Rigid-part (không skeleton)**: ~8–10 bộ phận xoay theo khớp bằng code. Gần dùng `Group`, xa dùng `InstancedMesh` tĩnh. |
| 5 | Công trình | **Chánh điện và Tam quan chi tiết hơn** (mái cong đao, cột, ngói khối). **Cảnh phụ (núi, nhà phụ) tối giản** kiểu hình khối thuần. |
| 6 | Prop và GLB | **Chỉ giữ tượng Phật GLB** làm điểm nhấn, giữ nguyên tam giác. Đổi sang vật liệu phẳng màu và nén meshopt. **Mọi prop khác dựng lại bằng geometry thủ tục.** |
| 7 | Ánh sáng và hậu kỳ | Flat shading, bóng đổ mềm, gradient màu theo độ cao, sương mù nhiều lớp. **Thêm bloom nhẹ** (đèn lồng, nến, hoa đăng) và **vignette nhẹ**. Không outline, không IBL, không GTAO. |
| 8 | Quy mô | Bản đồ **400×400 m**. **Mục tiêu 200 người đồng thời**. Chánh điện **~250 chỗ thiền**. |
| 9 | Thực vật | Cây hình khối (tán là 2–4 khối cầu/nón facet). 5–6 loài. Địa hình đồi mềm tô màu theo độ cao. Núi xếp lớp phẳng phủ sương. **Tán lá đổi màu theo mùa/quốc gia** (anh đào hồng, phong đỏ...). |
| 10 | Xử lý code cũ | Do tôi đánh giá (mục 2). Đề xuất: **giữ hạ tầng, làm lại toàn bộ lớp hình ảnh**. |

---

## 2. Đánh giá code hiện tại và đề xuất

Các số liệu dưới đây lấy từ code thật. `TempleStage.ts` có ~1593 dòng, `ProceduralAvatarModel.ts` ~944 dòng.

### 2.1. GIỮ NGUYÊN (hạ tầng tốt, không phụ thuộc phong cách)

| Module | Lý do giữ |
|---|---|
| `collision/*` (`CollisionWorld`, `Collider`, `CharacterController`, `CameraSpringArm`) | Logic va chạm độc lập với hình ảnh. Chỉ chỉnh khi đổi kích thước công trình. |
| `lib/network/*`, `server/routes/_ws.ts` (`InterpolationBuffer`, `NetProtocol`, `MultiplayerClient`) | Đã có snapshot buffer và giao thức. Chỉ hạ tải mục tiêu từ 500 xuống 200 người. |
| `utils/SeededPRNG.ts`, `utils/GeometryMerger.ts` | Dùng lại để gộp geometry và rải cây có seed. |
| `debug/PerformanceProfiler.ts` (F2) và chế độ bot `?bots=N` | Công cụ đo bắt buộc. |
| `world/MapLayout.ts`, `world/HallLayout.ts` | Nguồn dữ liệu tọa độ duy nhất. Chỉnh lại số liệu cho chánh điện 250 chỗ. |
| `world/TerrainSystem.ts` | Giữ cấu trúc chunk. Đổi cách tô màu (vertex color theo độ cao, không splat texture). |
| `characters/AvatarCrowd.ts`, `NameplateAtlas.ts`, `FootstepSystem.ts` | Giữ khung LOD, spatial culling, atlas tên và dấu chân. Đổi nguồn geometry. |
| `nature/WindSystem.ts`, `nature/PetalParticleSystem.ts` | Giữ. Đổi màu và hình cánh hoa sang facet. |
| API công khai của `TempleStage`, `TempleCanvas.vue`, Pinia, ví Cardano, `ZenAudio` | Không đụng. |

### 2.2. LÀM LẠI (phụ thuộc phong cách cũ)

| Module | Vấn đề với phong cách mới | Hướng làm |
|---|---|---|
| `characters/ProceduralAvatarModel.ts` (944 dòng, chibi 3.8 đầu, `MeshToonMaterial`, mặt dán) | Sai tỉ lệ, sai shader. | Viết lại thành `LowPolyAvatarModel` (7 đầu, rigid-part). Vẫn implement `AvatarModel`. |
| `characters/AvatarKit.ts` | LOD1/LOD2 theo chibi, `MeshStandardMaterial` có normal map. | Sinh lại LOD1/LOD2 theo thân 7 đầu, vertex color, vật liệu dùng chung. |
| `characters/ToonShaderUtils.ts`, `FaceAtlas.ts` | Toon ramp và outline hull không còn dùng. `FaceAtlas` là mặt anime. | Xóa `ToonShaderUtils` và outline. `FaceAtlas`: xem câu hỏi mở Q1. |
| `PilgrimAvatar.ts` (wrapper) | Mang `PALETTES` kiểu cũ. | Giữ API (`PilgrimCountry`, `update`, `triggerBow`...), bỏ dữ liệu cũ. Palette chuyển sang `style/`. |
| `materials/PBRMaterialFactory.ts` | Toàn bộ là texture canvas PBR. | Thay bằng `style/FlatMaterialFactory.ts` (xem 3.2). |
| `environment/LightingConfig.ts`, `AtmosphereManager.ts` | Preetham Sky, IBL, exposure theo PBR. | Thay bằng sky gradient dome + palette + fog nhiều lớp. |
| `postprocessing/PostProcessingManager.ts` | Pass cũ (Render, Bloom, SMAA, Output). | Giữ MSAA. Bloom giữ nhưng chỉnh. Thêm `VignettePass` nhẹ. Bỏ SMAA nếu MSAA đủ. |
| `sanctuary/PagodaSanctuary.ts` (881 dòng), `architecture/TamQuanGate.ts`, `BellTower.ts`, `nature/LotusPond.ts` | Dựng theo canvas texture PBR. | Dựng lại bằng builder low-poly (3.3). Chánh điện và Tam quan chi tiết, Lầu chuông và Hồ sen gọn. |
| `nature/TreeSystem.ts`, `TreeSpecies.ts`, `DistantMountains.ts`, `WindGrass.ts` | Sinh cây kiểu thực tế, cỏ shader phức tạp. | Viết lại theo hình khối facet (Phase 5). |
| `TempleStage.ts` (god-class ~1593 dòng) | Chứa cả renderer, input, hàm build* và logic mạng. | Tách `build*` ra các module `world/builders/*`. Giữ API công khai. |

### 2.3. XÓA (code chết hoặc trùng lặp)

- `sanctuary/SacredBuddhaStatue.ts`: gộp thành một tượng Phật GLB duy nhất. Xóa bản Phật dựng thô trong `PagodaSanctuaryHall`.
- Trong `TempleStage.ts`: `createRoofTileTexture`, các hàm tạo texture canvas còn sót, nhánh chết trong `applyCountryAtmosphere`.
- Toàn bộ texture sinh từ canvas dành cho vật liệu cũ.
- Logic gọi `PilgrimAvatar` kiểu cũ trong `pages/dev/avatar.vue` (cập nhật trang này theo model mới thay vì xóa).

---

## 3. Hướng dẫn phong cách (Style Guide)

### 3.1. Nguyên tắc hình ảnh

1. **Không texture ảnh.** Màu đến từ vertex color hoặc uniform. Vật liệu dùng chung tối đa.
2. **Flat shading thật**: `toNonIndexed()` rồi `computeVertexNormals()`, hoặc `flatShading: true`. Mỗi mặt một màu sáng.
3. **Gradient theo độ cao**: màu lên cao dần sáng và nhạt (một shader nhỏ qua `onBeforeCompile`, dùng chung cho mọi vật liệu).
4. **Sương mù nhiều lớp**: fog tuyến tính theo khoảng cách cộng một lớp fog theo độ cao ở chân núi. Núi xa dùng màu fog pha để tạo chiều sâu.
5. **Ít ánh sáng**: 1 `HemisphereLight` + 1 `DirectionalLight` đổ bóng mềm (shadow map 1024–2048 tùy chất lượng). Không `PointLight` đổ bóng.
6. **Phát sáng có kiểm soát**: đèn lồng, nến, hoa đăng dùng `emissive` hoặc `MeshBasicMaterial` màu sáng hơn threshold bloom. Bloom nhẹ chỉ bắt các vật đó.
7. **Vignette nhẹ**, không film grain, không chromatic aberration.
8. **Hình khối**: cạnh cắt dứt khoát, ít segment (cylinder 6–8 cạnh, sphere 6×4). Chi tiết bằng khối phụ, không bằng texture.

### 3.2. Hệ thống style mới (`lib/world3d/style/`)

| File | Vai trò |
|---|---|
| `Palette.ts` | Định nghĩa palette 3 thời điểm: sky top/bottom, fog, ground, nước, mái ngói, gỗ, đá, tán lá theo mùa, da, vải, vàng. Một nguồn duy nhất, thay `LightingConfig`. |
| `FlatMaterialFactory.ts` | Cache vật liệu theo khóa màu. Tất cả dùng chung `MeshLambertMaterial` hoặc `MeshStandardMaterial` thô (roughness 1, metalness 0) kèm shader gradient độ cao. `setPalette(mode)` đổi màu hàng loạt không tạo vật liệu mới. |
| `LowPolyBuilder.ts` | Helper dựng và gộp geometry có vertex color: hộp vát, mái cong đao (đường cong thủ tục), cột, bậc, tháp, tán cây. Dùng `GeometryMerger`. |
| `SkyDome.ts` | Dome gradient cố định theo camera (2 màu top/bottom + mặt trời là đĩa phẳng), thay `Sky` Preetham. |

### 3.3. Đề xuất palette (khởi điểm, tinh chỉnh khi xem thực tế)

| Vai trò | Ngày | Hoàng hôn | Đêm |
|---|---|---|---|
| Trời trên | `#8EC5D6` | `#6B4E8F` | `#14172B` |
| Trời dưới/chân trời | `#F4E9D0` | `#F2A66B` | `#2B2F55` |
| Sương mù | `#DCE8E0` | `#E9B28C` | `#232846` |
| Mặt đất sân | `#E8DCC0` | `#D9B592` | `#3A3A55` |
| Cỏ/đồi | `#9CC48A` | `#A89A6A` | `#2E4A47` |
| Mái ngói | `#B5543C` | `#A24B42` | `#4A3A52` |
| Cột/gỗ | `#8A4B35` | `#7C4535` | `#3A2C3A` |
| Vàng/điểm nhấn | `#F2C14E` | `#FFB347` | `#FFD27A` (phát sáng) |
| Nước | `#7FC6C4` | `#E59A7A` | `#2A3F6B` |

Tán cây theo quốc gia hoặc mùa: xanh pastel (mặc định), hồng anh đào (Nhật), đỏ phong (Hàn), vàng cam (Tây Tạng/Ấn).

### 3.4. Nhân vật (7 đầu, rigid-part)

- Chiều cao ~1.7 m (đầu ~0.23 m). Cấu trúc: `root` → `hips` → `torso` → `head`; 2 tay (`upperArm`, `forearm`); 2 chân; thân áo/váy (khối); nón hoặc mũ (khối).
- **Khoảng 8–10 mesh LOD0**, mỗi bộ phận là một mesh vertex-color. Tay, chân xoay bằng `Group.rotation`. Đi, đứng, ngồi thiền, cúi lạy, chắp tay đều là pose theo khớp có nội suy.
- **LOD gần (≤ ~15 m)**: `Group` với các bộ phận trên, pool 25–40 avatar.
- **LOD xa (15–60 m)**: một `InstancedMesh` tĩnh gộp thân (≈ 300–500 tris), màu theo instance.
- **LOD cực xa**: impostor khối ngắn (~60 tris) hoặc ẩn.
- **Silhouette theo quốc gia** (khối khác nhau, không chỉ đổi màu):
  - Việt: áo nhật bình dài, nón lá (nón chóp).
  - Nhật: kimono thẳng, nón kasa tròn rộng.
  - Thái: cà sa cam quấn một bên vai, đầu cạo.
  - Hàn: hanbok, mũ gat.
  - Đài/Singapore: áo Đường, mũ nhỏ.
  - Ấn: kurta/dhoti, khăn.
  - Tây Tạng: chuba rộng, mũ trùm.
  - Phương Tây: áo thiền đơn giản.

### 3.5. Công trình

- **Chánh điện** (chi tiết): nền tam cấp, hàng cột, tường, 3 cửa chính + 2 cửa phụ, mái tầng chồng với mái đao cong (đường cong thủ tục, không dougong chi tiết), ngói là các dải khối. Nội thất: bàn thờ, một tượng Phật GLB, đệm thiền (một `InstancedMesh`).
- **Tam quan** (chi tiết): 4 trụ, mái cong 3 lớp, khe hở đi qua rộng ≥ 0.9 m, cổng bằng khối.
- **Lầu chuông, Hồ sen** (gọn): vẫn nhận ra được, đi vào được; cầu vòm đi qua được (collider dốc hoặc bậc thang).
- **Cảnh phụ** (tối giản kiểu Monument Valley): nhà tăng, nhà ăn, thư viện là hộp + mái chóp; tháp bảo là chồng khối. Núi xa là dải hình khối nhiều lớp phủ sương.
- **Tượng Phật GLB**: chuẩn hóa chiều cao ~4.2 m, bỏ texture gốc, thay vật liệu phẳng màu vàng/đá theo palette (ép theo tên mesh hoặc nhóm). Nén bằng meshopt qua công cụ gltf-transform (bước build offline). Nạp qua `GLTFLoader` + `MeshoptDecoder`.

---

## 4. Ngân sách hiệu năng (200 người)

| Chỉ số | High | Low |
|---|---|---|
| FPS | ≥ 60 | ≥ 30 |
| Draw call | ≤ 150 | ≤ 80 |
| Tam giác | ≤ 600k | ≤ 250k |
| GPU memory | ≤ 400 MB | ≤ 200 MB |
| CPU JS/frame | ≤ 6 ms | ≤ 8 ms |
| Dung lượng tải ban đầu | ≤ 6 MB (tượng Phật GLB ≤ 2–3 MB sau meshopt) | giống nhau |

Không có texture ảnh nên bộ nhớ GPU giảm mạnh so với kế hoạch cũ.

---

## 5. Các giai đoạn thực hiện

Mỗi giai đoạn kết thúc bằng `pnpm build` không lỗi TypeScript và số đo từ F2 (FPS, draw call, tris, geometries, textures).

### Phase 0. Chuẩn bị và dọn dẹp (nhỏ)
- Chụp baseline F2 với `?bots=0/50/200` (bản hiện tại).
- Xóa code chết (mục 2.3). Dọn listener, dispose đầy đủ nếu còn sót.
- Tạo nhánh git `feat/lowpoly-redesign`.
- **Tiêu chí:** build sạch, có bảng baseline.

### Phase 1. Nền style (`lib/world3d/style/`)
- `Palette.ts`, `FlatMaterialFactory.ts`, `LowPolyBuilder.ts`, `SkyDome.ts`.
- Shader gradient theo độ cao dùng chung (`onBeforeCompile`).
- Thay `LightingConfig` và `AtmosphereManager` bằng palette + SkyDome + fog nhiều lớp. Giữ API `setTimeOfDay('day'|'sunset'|'night')` và `applyCountryAtmosphere`.
- Hậu kỳ: bloom nhẹ + vignette. Chỉnh `setGraphicsQuality` (pixelRatio, shadow size, bloom bật/tắt).
- **Tiêu chí:** cảnh trống (chỉ nền + trời + fog) đã đẹp ở cả 3 thời điểm. Chuyển thời điểm không tạo vật liệu mới.

### Phase 2. Địa hình và núi xa
- `TerrainSystem`: đồi mềm, vertex color theo độ cao, chunk 64 m, sân đá lát là mảng phẳng màu riêng.
- `DistantMountains`: dải khối nhiều lớp, mờ theo sương. Đồng bộ `camera.far`, fog, sky scale cho bản đồ 400×400.
- `CollisionWorld.getSurfaceY` đọc độ cao terrain (nếu chưa có).
- **Tiêu chí:** đi quanh bản đồ thấy chiều sâu sương mù, không lỗ hở, không đi xuyên đất.

### Phase 3. Nhân vật 7 đầu rigid-part
- `LowPolyAvatarModel` implement `AvatarModel`. 8–10 bộ phận, pose và nội suy khớp (đi, đứng, ngồi thiền, cúi lạy, chắp tay, emote).
- 8 silhouette theo quốc gia (mục 3.4).
- `AvatarKit`: LOD1 (thân gộp) và LOD2 (impostor) mới. `AvatarCrowd` đổi nguồn geometry, giữ LOD pool và culling.
- Cập nhật `pages/dev/avatar.vue` để xem từng quốc gia và pose.
- **Tiêu chí:** 200 bot ổn định ≥ 60 FPS (High); 9 silhouette phân biệt được từ xa; không rò rỉ geometry/material khi vào/ra liên tục.

### Phase 4. Công trình
- Chánh điện (chi tiết) theo `HallLayout` ~250 chỗ. Đệm thiền là một `InstancedMesh`.
- Tam quan (chi tiết), Lầu chuông, Hồ sen (gọn, cầu đi qua được), prop (hương, hòm công đức, bàn quẻ, đèn lồng, đèn đá) dựng thủ tục.
- Tượng Phật GLB: nén meshopt, ép vật liệu phẳng màu, chuẩn hóa kích thước. Xóa `SacredBuddhaStatue` trùng.
- Cảnh phụ tối giản: nhà tăng, nhà ăn, thư viện, tháp bảo.
- Đèn: ≤ 4 `PointLight` không bóng cho nội thất, ánh sáng còn lại bằng emissive + bloom.
- **Tiêu chí:** mọi điểm tương tác (`checkProximity`/`InteractionTarget`) vẫn chạy; camera không xuyên tường; chỉ một tượng Phật; không `PointLight` đổ bóng.

### Phase 5. Thực vật theo mùa/quốc gia
- `TreeSpecies`/`TreeSystem`: 5–6 loài (bồ đề, đa, tre, thông, phong/anh đào, cọ), mỗi loài LOD hình khối, một `InstancedMesh` cho mỗi loài/LOD.
- Màu tán lá theo quốc gia/mùa qua `instanceColor` (không tạo vật liệu mới).
- Collider thân cây sinh từ `treeSpawns` (sửa triệt để lỗi lệch cây).
- Cỏ/hoa tối giản: mảng màu nền + vài cụm low-poly thưa; gió chỉ nhún nhẹ cây và cánh hoa (qua `WindSystem`).
- Cánh hoa rơi: hạt facet, màu theo mùa.
- **Tiêu chí:** ≤ 25 draw call cho toàn bộ thực vật; đổi quốc gia đổi màu tán không giật.

### Phase 6. Mạng, đám đông và hoàn thiện
- Hạ ngân sách mạng xuống 200 người (rate-limit, validate đã có; kiểm lại tải).
- Tinh chỉnh LOD distance, chất lượng Low/Medium/High, test rò rỉ bộ nhớ.
- Cập nhật `TIEN_DO_DU_AN.md`, `CREDITS.md` (GLB tượng Phật), `GAME_DESIGN_DOCUMENT.md` mục đồ họa.
- **Tiêu chí:** mục 6.

---

## 6. Tiêu chí nghiệm thu

**Hình ảnh**
- [ ] 3 thời điểm có palette phẳng riêng, nhìn nhất quán, sương mù tạo chiều sâu.
- [ ] Không còn texture ảnh (trừ atlas tên và tượng Phật nếu giữ màu gốc, nhưng đã chốt bỏ texture).
- [ ] Nhân vật ~7 đầu, 8 silhouette quốc gia phân biệt được.
- [ ] Chánh điện và Tam quan chi tiết hơn rõ rệt so với cảnh phụ.

**Hiệu năng (F2, `?bots=200`)**
- [ ] ≥ 60 FPS (High), ≥ 30 FPS (Low).
- [ ] Draw call ≤ 150 (High) / ≤ 80 (Low); tris ≤ 600k.
- [ ] Không rò rỉ khi 10 người vào/ra × 500 lượt.

**Gameplay**
- [ ] Không đi xuyên tường, cột, cây, nước. Cầu vòm đi qua được, Lầu chuông vào được.
- [ ] Chánh điện có ≥ 250 chỗ thiền hợp lệ (có `assert`).
- [ ] Mọi tính năng ở `PROMPT_NANG_CAP_3D.md` mục 8 vẫn chạy (API `TempleCanvas.vue`, đa người chơi, emote, thiền nhóm, ZenAudio, ví Cardano, Pinia).
- [ ] `pnpm build` và `pnpm dev` không lỗi.

---

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Phong cách khó đẹp ngay từ code | Làm Phase 1 trước, duyệt bằng ảnh chụp 3 thời điểm trước khi làm tiếp. |
| Tượng Phật GLB nhiều mesh/texture, ép phẳng màu có thể mất chi tiết | Ép theo nhóm mesh; nếu xấu thì phương án dự phòng là dựng thủ tục (đã loại ở lựa chọn hiện tại, chỉ dùng khi bạn đồng ý). |
| Rigid-part có thể trông cứng hơn skeleton | Nội suy khớp mượt, thêm nhún thân (bob), lắc vai theo nhịp bước. |
| Tách `TempleStage` dễ làm hỏng API | Tách từng hàm `build*` một, chạy build và kiểm tra tay sau mỗi hàm. |

---

## 8. Câu hỏi còn mở (đang dùng mặc định, bạn có thể đổi)

| # | Câu hỏi | Lựa chọn | Mặc định đang dùng |
|---|---|---|---|
| Q1 | Mặt nhân vật | (a) Không mặt, chỉ đầu tròn + tóc/nón (kiểu Journey) (b) Mắt/miệng là vài khối phẳng nhỏ (c) Giữ `FaceAtlas` biểu cảm anime | (a) |
| Q2 | Mặt trời, trăng, sao | (a) Đĩa phẳng gradient trên dome (b) Không vẽ, chỉ màu trời | (a) |
| Q3 | Tắt/bật bóng đổ ở mức Low | (a) Tắt hẳn bóng ở Low (b) Giữ bóng 512 ở Low | (a) |
| Q4 | Nén tượng Phật GLB | (a) Chạy `gltf-transform` offline một lần, commit file mới (b) Thêm bước script `pnpm` | (a) |
| Q5 | Kích thước chánh điện cho 250 chỗ | (a) Thu nhỏ còn ~28×22 m (b) Giữ 40×30 m với đệm thưa hơn | (a) |
