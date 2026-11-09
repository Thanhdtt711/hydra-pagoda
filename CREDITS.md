# BẢNG GHI NHẬN NGUỒN GỐC & BẢN QUYỀN (CREDITS & LICENSES)
## Dự án: Vạn Cảnh Thiền Tự (Hydra Pagoda)
*Thế giới 3D tâm linh & game Web3 chánh niệm, phong cách low-poly tối giản*

---

## 1. NỀN TẢNG CÔNG NGHỆ CHÍNH (CORE FRAMEWORK & RUNTIME)

| Thành phần | Phiên bản | Tác giả / Tổ chức | Giấy phép | Mô tả sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Three.js** | `^0.186.1` | Ricardo Cabello (Mr.doob) & cộng đồng | [MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | Engine đồ họa 3D WebGL: Scene, Camera, vật liệu flat-color (`MeshLambertMaterial`), InstancedMesh, hậu kỳ Bloom/Vignette, Raycasting. |
| **Nuxt 3** | `^3.15.4` | Nuxt Team (Pooya Parsa et al.) | [MIT License](https://github.com/nuxt/nuxt/blob/main/LICENSE) | Full-stack Vue 3 framework, SPA routing, WebSocket Nitro server. |
| **Vue 3** | `^3.5.13` | Evan You & Vue Core Team | [MIT License](https://github.com/vuejs/core/blob/main/LICENSE) | Giao diện người dùng Reactive, Component architecture, Composables. |
| **Tailwind CSS** | `^4.3.4` | Tailwind Labs Inc. | [MIT License](https://github.com/tailwindlabs/tailwindcss/blob/next/LICENSE) | Utility-first CSS theo chuẩn Binance Dark (`DESIGN-binance.md`). |
| **Pinia** | `^2.x` | Eduardo San Martin Morote & Vue Team | [MIT License](https://github.com/vuejs/pinia/blob/v2/LICENSE) | Quản lý trạng thái (ví, kinh tế, thẻ bài, người dùng). |
| **TypeScript** | `^5.x` | Microsoft | [Apache 2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) | Type-safety cho toàn bộ client, server và giao thức mạng. |
| **glTF-Transform** | `^4.x` (công cụ offline) | Don McCurdy | [MIT License](https://github.com/donmccurdy/glTF-Transform/blob/main/LICENSE.md) | Nén tượng Phật GLB bằng meshopt + quantization (xem mục 2.5). |
| **meshoptimizer** | (decoder đi kèm Three.js) | Arseny Kapoulkine | [MIT License](https://github.com/zeux/meshoptimizer/blob/master/LICENSE.md) | Giải nén `EXT_meshopt_compression` khi tải GLB. |

---

## 2. ĐỒ HỌA LOW-POLY TỐI GIẢN (FLAT-COLOR GRAPHICS)

Toàn bộ hình khối được sinh thủ tục bằng mã nguồn, **không dùng ảnh texture, PBR map, IBL, GTAO hay outline**. Màu sắc đến từ bảng màu phẳng theo thời điểm trong ngày. Phong cách tham chiếu thẩm mỹ: *Monument Valley*, *Journey* (chỉ lấy cảm hứng, không sử dụng tài sản của các tựa game này).

### 2.1. Bảng màu & vật liệu phẳng (`lib/world3d/style/`)
* **`Palette.ts`**: bảng màu theo slot (đá, tường, gỗ, mái, vàng, cỏ, lá...) cho 3 chế độ **ban ngày / hoàng hôn / ban đêm**, cùng thông số hậu kỳ `POST_STYLE`.
* **`FlatMaterialFactory.ts`**: cache vật liệu `MeshLambertMaterial` flat-shading dùng chung, có gradient theo độ cao (qua `onBeforeCompile`) và đổi palette không cần tạo lại vật liệu.
* **`LowPolyBuilder.ts`**: bộ dựng hình học low-poly (prism, pyramid, jitter, vertex color) và gộp nhiều phần có màu thành một `BufferGeometry`.
* **`SlotBatch.ts`**: gom các phần theo slot màu thành ít draw call nhất có thể.
* **`RoofBuilder.ts`**: sinh mái đao cong bốn mái bằng mặt phẳng tam giác (faceted), không dùng UV hay texture ngói.
* Tác giả: Hydra Pagoda Core Architecture Team. Giấy phép: theo giấy phép của dự án.

### 2.2. Bầu trời, địa hình & khí quyển
* **`SkyDome.ts`**: vòm trời gradient theo thời điểm trong ngày (thay thế bầu trời vật lý kiểu Preetham trước đây, không còn dùng `three/addons/objects/Sky.js`).
* **`TerrainSystem.ts`** và **`DistantMountains.ts`**: địa hình thung lũng 400×400 m và các lớp núi xa faceted, phối hợp sương mù theo lớp.
* **`AtmosphereManager.ts`**: một đèn định hướng duy nhất đổ bóng mềm theo người chơi; chất lượng bóng thấp/trung bình/cao (1024/2048).
* **`PostProcessingManager.ts`**: MSAA → Bloom nhẹ (ngưỡng 1.0) → Vignette nhẹ → OutputPass; có mức chất lượng Low/Medium/High/Ultra.

### 2.3. Thực vật & gió
* **`TreeSpecies.ts`, `TreeSystem.ts`**: 6 loài cây low-poly (bồ đề, đa cổ thụ, thông, trúc, phong/anh đào, cau) dựng bằng InstancedMesh, lắc theo gió qua shader `onBeforeCompile`.
* **`WindGrass.ts`**: cỏ và hoa dạng cụm lá phẳng, gió dùng chung.
* **`WindSystem.ts`**: nguồn gió dùng chung cho cây, cỏ, cánh hoa.
* **`PetalParticleSystem.ts`**: cánh hoa, đom đóm thiền và khói hương chạy trên GPU.

### 2.4. Hình học kiến trúc & vật lý
* Chánh điện, Tam Quan, Lầu Chuông, Hồ Sen (`PagodaSanctuary.ts`, `TamQuanGate.ts`, `BellTower.ts`, `LotusPond.ts`) được dựng hoàn toàn từ khối low-poly và gộp theo slot màu.
* **Nhân vật hành giả** (`lib/world3d/characters/`): tỷ lệ khoảng 7 đầu, các bộ phận cứng ghép nối (rigid-part), 4 mức LOD (`AvatarCrowd.ts`), hiển thị đám đông bằng InstancedMesh theo từng quốc gia.
* **Zero-Allocation Character Controller & Capsule Step-Up** (`CharacterController.ts`, `Collider.ts`): va chạm capsule trượt tường, tự bước lên bậc thềm.
* **`SeededPRNG.ts`, `GeometryMerger.ts`**: số ngẫu nhiên có seed để bố cục xác định, và tiện ích gộp hình học.

### 2.5. Tôn tượng Phật (tài sản bên thứ ba duy nhất)
* **Tệp:** `public/models/the_buddha_statue_in_a_mountain.glb` (tải bởi `SacredBuddhaStatue.ts`).
* **Nguồn gốc:** mô hình xuất từ Sketchfab (generator `Sketchfab-12.65.0`). Tệp GLB không lưu thông tin tác giả. **Cần bổ sung tên tác giả, đường dẫn trang Sketchfab và giấy phép (ví dụ CC-BY) vào đây trước khi phát hành công khai.**
* **Xử lý trong dự án:** bản gốc 10.82 MB được nén offline xuống khoảng 0.10 MB: bỏ toàn bộ texture PBR, UV, tangent và vertex color, hàn đỉnh, lượng tử hóa vị trí/pháp tuyến (`KHR_mesh_quantization`) và nén meshopt (`EXT_meshopt_compression`). Còn 6 mesh, khoảng 11.6 nghìn đỉnh, 21.5 nghìn tam giác.
* **Hiển thị:** toàn bộ vật liệu gốc được thay bằng vật liệu vàng phẳng của `FlatMaterialFactory`, chuẩn hóa chiều cao 4.2 m. Có phương án dự phòng thủ tục nếu tải GLB thất bại.

### 2.6. Giao thức mạng nhị phân & AoI (`NetProtocol.ts`, `server/routes/_ws.ts`)
* Gói di chuyển nhị phân `MSG_MOVE` kích thước **24 byte**, lượng tử hóa vị trí/góc quay, đồng bộ khoảng 20 Hz.
* Lưới quan tâm không gian (AoI) với ô **40×40 m**; ngân sách thiết kế khoảng **200 người chơi đồng thời** (có thể bật bot giả lập bằng `?bots=200`).
* Kiểm tra phía server: giới hạn tốc độ gói (~38 ms/gói), chống dịch chuyển tức thời (> 15 m), loại bỏ giá trị NaN/Infinity, đối chiếu id ngang hàng.
* `InterpolationBuffer.ts` nội suy vị trí người chơi khác phía client để chuyển động mượt.

---

## 3. KIẾN TRÚC CỔ TỰ THỦ TỤC (LOW-POLY PROCEDURAL ARCHITECTURE)

Kiến trúc được dựng bằng khối prism/pyramid và mái đao faceted, lấy cảm hứng từ kiến trúc Phật giáo Đại thừa và Thiền phái Trúc Lâm Yên Tử:

1. **Đại Hùng Bảo Điện (`PagodaSanctuary.ts`, `HallLayout.ts`)**:
   * Chánh điện 28×22 m với khoảng 256 chỗ ngồi thiền, hệ cột gỗ, tường có khoảng hở cửa và cửa bức bàn hai cánh mở bằng chuột phải.
   * Bố cục chỗ ngồi, hành lang và cửa lấy từ một nguồn dữ liệu duy nhất `HallLayout`.
2. **Cổng Tam Quan (`TamQuanGate.ts`)**:
   * Ba lối: Trung Quan, Giả Quan, Không Quan, hoành phi "VẠN CẢNH THIỀN TỰ".
3. **Lầu Chuông & Đại Hồng Chung (`BellTower.ts`)**:
   * Bốn cột gỗ, hai tầng mái đao cong, quả chuông đồng và chày kình đung đưa.
4. **Hồ Sen & Cầu Đá (`LotusPond.ts`)**:
   * Mặt nước phẳng, lá sen, đèn hoa đăng nổi và cầu đá vòm có collider đi bộ được.
5. **Tôn tượng Phật Thích Ca**:
   * Mô hình GLB đã nén (mục 2.5) đặt trên đài sen thủ tục trong chánh điện. Chỉ có một tượng Phật duy nhất.
6. **Bố cục bản đồ (`MapLayout.ts`)**:
   * Nguồn dữ liệu duy nhất cho vị trí công trình, vùng cấm cây, điểm xuất hiện và kiểm tra chồng lấn.

---

## 4. HỆ THỐNG ÂM THANH KHÔNG GIAN PROCEDURAL (3D SPATIAL AUDIO)

* **Tổng hợp âm thanh bằng Web Audio API (`ZenAudio.ts`)**: `BiquadFilterNode`, `OscillatorNode`, `ConvolverNode`, `GainNode`; chuông và bát hát Tây Tạng ở **432 Hz** và **864 Hz**.
* **Tiếng mõ gỗ chùa (Wooden Fish)**: bộ lọc dải thông xung hãm khoảng 680 Hz.
* **Mưa rào mái ngói & suối thiền**: nhiễu hồng/nâu lọc thời gian thực.
* **Tiếng ve & dế đêm**: dao động cao tần điều tần 4.2 kHz - 5.8 kHz.
* Tần số chuẩn **432 Hz** cho thiền định và chánh niệm.

---

## 5. TIÊU CHUẨN WEB3 CARDANO (BLOCKCHAIN STANDARDS)

* **Cardano CIP-30 (cầu nối ví DApp)**: tích hợp các ví Lace, Eternl, Nami, Flint, Vespr (mobile). Chuẩn hóa giao tiếp Ed25519.
* **Cardano CIP-8 (ký thông điệp)**: xác thực đăng nhập bằng chữ ký, cấp phiên JWT.
* **Cardano CIP-68 (metadata NFT mở rộng)**: định hướng phát hành Thẻ Bài Di Sản và vật phẩm tâm linh.
* **Hydra Head L2**: xử lý giao dịch quyên góp công đức và thỉnh vật phẩm vi mô, xác nhận tức thời, không phí gas.

---

## 6. LỜI CẢM ƠN (ACKNOWLEDGEMENTS)

* **Cộng đồng Three.js**: nền tảng WebGL mã nguồn mở cho toàn bộ thế giới 3D.
* **Cộng đồng Cardano & Hydra**: hạ tầng blockchain minh bạch cho công đức vi mô.
* **Tác giả mô hình tôn tượng Phật trên Sketchfab**: xem mục 2.5 (thông tin cần bổ sung).
* Cảm ơn các thiền sư, nghệ nhân và các cộng đồng di sản đã truyền cảm hứng cho dự án, nhằm gìn giữ và lan tỏa văn hóa chùa Việt đến cộng đồng tu tập toàn cầu.
