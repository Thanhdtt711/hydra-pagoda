# BẢNG GHI NHẬN NGUỒN GỐC & BẢN QUYỀN (CREDITS & LICENSES)
## Dự án: Vạn Cảnh Thiền Tự (Hydra Pagoda)
*Thế Giới 3D Tâm Linh & Game Web3 Chánh Niệm Chuẩn AAA*

---

## 1. NỀN TẢNG CÔNG NGHỆ CHÍNH (CORE FRAMEWORK & RUNTIME)

| Thành phần | Phiên bản | Tác giả / Tổ chức | Giấy phép | Mô tả sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Three.js** | `^0.186.1` | Ricardo Cabello (Mr.doob) & cộng đồng | [MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | Engine đồ họa 3D WebGL chính, quản lý Scene, Camera, PBR Shaders, Post-processing, Math & Raycasting. |
| **Nuxt 3** | `^3.15.4` | Nuxt Team (Pooya Parsa et al.) | [MIT License](https://github.com/nuxt/nuxt/blob/main/LICENSE) | Full-stack Vue 3 framework, quản lý SPA routing, WebSocket Nitro server, SSR/CSR hydration. |
| **Vue 3** | `^3.5.13` | Evan You & Vue Core Team | [MIT License](https://github.com/vuejs/core/blob/main/LICENSE) | Giao diện người dùng Reactive, Component architecture, Composables lifecycle. |
| **Tailwind CSS** | `^4.3.4` | Tailwind Labs Inc. | [MIT License](https://github.com/tailwindlabs/tailwindcss/blob/next/LICENSE) | Hệ thống utility-first styling, bảng màu Binance Dark/Gold chuẩn Web3 (`DESIGN-binance.md`). |
| **Pinia** | `^3.0.1` | Eduardo San Martin Morote (posva) | [MIT License](https://github.com/vuejs/pinia/blob/v2/LICENSE) | Quản lý state toàn cục (User, Wallet CIP-30, Economy, Audio Soundscape). |
| **TypeScript** | `^5.7.3` | Microsoft Corporation | [Apache 2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) | Type-safety, định kiểu dữ liệu 3D vector, collision proxies, và packet MMO 20Hz. |

---

## 2. HỆ THỐNG ĐỒ HỌA 3D & SHADERS (GRAPHICS & PBR MATERIALS)

### 2.1. Thư viện Vật liệu PBR Thủ tục (Procedural PBR Material Factory)
Toàn bộ texture (BaseColor, NormalMap, RoughnessMap, AmbientOcclusionMap) được tổng hợp bằng thuật toán Canvas 2D thời gian thực với chất lượng $1024\text{px} - 2048\text{px}$, không phụ thuộc vào file ảnh tĩnh bên ngoài, tối ưu hóa $100\%$ bộ nhớ tải trang:
* **Nguồn tham khảo chuẩn thẩm mỹ**: [ambientCG](https://ambientcg.com/) & [Poly Haven](https://polyhaven.com/) (Theo giấy phép **CC0 1.0 Universal - Public Domain Dedication**).
* **Đá phiến sân chùa (`stonePavement`)**: Mô phỏng đá xẻ xanh rêu Thanh Hóa, chống trượt, rãnh vữa so le.
* **Đá granite hoa cương (`graniteStep`)**: Bậc thềm tam cấp cổ mài vát góc vi mô, chịu lực.
* **Gỗ Lim cột chùa (`ironwood`)**: Gỗ lim già Bắc Bộ xẻ dọc thớ mịn, bóng sáp tự nhiên.
* **Ngói âm dương cổ tự (`yinYangRoof`)**: Sống ngói lượn sóng phủ rêu phong sương gió.
* **Đồng cổ đúc (`antiqueBronze`)**: Đồng đỏ pha thiếc hun khói trầm với lớp gỉ đồng xanh (verdigris patina).
* **Vàng lá thếp Tam Bảo (`sacredGoldLeaf`)**: Vàng quỳ Kiêu Kỵ dát mỏng phản quang kim loại tôn nghiêm.
* **Đất cỏ rêu ẩm (`mossyEarth`)**: Đất mùn vườn thiền phủ rêu tự nhiên quanh hồ sen.

### 2.2. Khí Quyển & Bầu Trời Vật Lý
* **Mô hình Preetham Analytical Skydome**:
  * Dựa trên công trình nghiên cứu: *A Practical Analytic Model for Daylight* (A. J. Preetham, Peter Shirley, Brian Smits).
  * Mã nguồn tham khảo từ `three/addons/objects/Sky.js` (MIT License).
  * Tính toán trực tiếp tán xạ Rayleigh (phân tử không khí) và Mie (bụi sương mù) theo góc nâng và phương vị mặt trời.

### 2.3. Shader Tùy Biến (Custom Shaders)
* **Water Surface Ripple Shader (`LotusPond.ts`)**:
  * Tác giả: Hydra Pagoda Core Graphics Team.
  * Thuật toán: Dịch chuyển đỉnh 2 lớp sóng độc lập (`dual-frequency sin/cos wave displacement`) kết hợp phản xạ quang học Fresnel và lấp lánh ánh kim Specular.
* **Instanced Wind Grass Shader (`WindGrass.ts`)**:
  * Tác giả: Hydra Pagoda Core Graphics Team.
  * Thuật toán: Uốn cong ngọn cỏ theo hàm sóng gió hữu cơ trong khi ghim chặt gốc cỏ, chỉ tiêu tốn **1 Draw Call** cho 2.200 cụm cỏ.

### 2.4. Thuật Toán Hình Học Thủ Tục & Động Cơ Vật Lý (Procedural Geometry & Physics)
* **Curved Hip Pagoda Roof Geometry (`PagodaSanctuary.ts`, `BellTower.ts`, `TamQuanGate.ts`)**:
  * Tác giả: Hydra Pagoda Core Architecture Team.
  * Thuật toán: Sinh diện mái cong 4 đầu đao truyền thống Việt Nam bằng nội suy mặt cong nhị thức bậc 1.35 kết hợp uốn vểnh góc đao parabol $eaveLift$, tự động tính toán pháp tuyến chuẩn và tọa độ UV ngói âm dương.
* **Hệ Sinh Thái 6 Loài Cây Cổ Tự (`TreeSpecies.ts`, `TreeSystem.ts`)**:
  * 6 Loài cây đặc trưng: Bồ Đề Bát Nhã, Đa cổ thụ, Thông phong cách Zen, Trúc thiền tông, Phong đỏ/Anh đào và Hàng cau Nam Á.
  * Tối ưu hóa GPU Instancing kết hợp gió chung `WindSystem`.
* **Zero-Allocation Character Controller & Capsule Step-Up (`CharacterController.ts`, `Collider.ts`)**:
  * Động cơ va chạm Capsule trượt tường (Wall-Sliding), bước lên bậc tam cấp tự động (Step-Up cho bậc $\le 0.18\text{m}$) và sàn địa hình tự nhiên giải tích không tiêu tốn bộ nhớ GC trong vòng lặp chuyển động.

### 2.5. Giao Thức Mạng Nhị Phân & AoI Spatial Grid (`NetProtocol.ts`, `server/routes/_ws.ts`)
* Tác giả: Hydra Pagoda Multiplayer Network Team.
* Giao thức nhị phân nén nhỏ gọn 35 bytes (gồm Action Code, Timestamp, Position, Yaw), nén phân vùng không gian Area-of-Interest (AoI Grid 40x40m) cho phép 500 đồng tu online đồng thời với băng thông $< 12\text{ kbps/client}$.
* Bộ lọc xác thực an toàn server-side loại bỏ gói tin rác (NaN/Infinity) và chống hack tốc độ/teleport.

---

## 3. KIẾN TRÚC CỔ TỰ & MÔ HÌNH THỦ TỤC 3D (PROCEDURAL ARCHITECTURE)

Toàn bộ các công trình kiến trúc đều được thiết kế và dựng hình bằng thuật toán hình học thủ tục độ chi tiết cao (`ExtrudeGeometry`, `LatheGeometry`, `TubeGeometry`, `InstancedMesh`), kế thừa chuẩn mực kiến trúc Phật giáo Đại thừa và Thiền phái Trúc Lâm Yên Tử:
1. **Chánh Điện Rỗng & Cửa Bức Bàn (`PagodaSanctuary.ts`)**:
   * Hệ vách gỗ, cửa sổ song lăng chữ Vạn dán giấy xuyên sáng.
   * Ngưỡng cửa / bậu cửa gỗ Lim cao $0.14\text{m}$.
   * Cửa bức bàn 2 cánh tương tác đóng/mở tự động và thủ công bằng chuột phải.
2. **Cổng Tam Quan Cổ Kính (`TamQuanGate.ts`)**:
   * Cấu trúc 3 lối: Trung Quan, Giả Quan, Không Quan.
   * Hoành phi đại tự sơn son thếp vàng "VẠN CẢNH THIỀN TỰ".
3. **Lầu Chuông & Đại Hồng Chung (`BellTower.ts`)**:
   * Hệ 4 cột gỗ lim đặt trên chân tảng đá quả bồng, 2 tầng mái đao cong.
   * Quả chuông đồng cổ tiện bằng `LatheGeometry` theo tỷ lệ Đại Hồng Chung Chùa Một Cột / Chùa Thiên Mụ.
   * Chày kình gỗ gõ chuông đung đưa nhịp nhàng.
4. **Hồ Sen & Cầu Đá Vòm Cong (`LotusPond.ts`)**:
   * Cầu vòm đá cong parabol với 12 búp sen đá chạm khắc hai bên thành cầu.
   * Đèn hoa đăng tứ giác giấy bồi thả trôi bập bềnh theo sóng nước.
5. **Kim Thân Đức Phật Thích Ca Mâu Ni (`SacredBuddhaStatue.ts`)**:
   * Tọa thiền kiết già (`Padmasana`), ấn Thiền Định (`Dhyana Mudra`), áo cà sa hở vai phải.
   * Đỉnh đầu nhục kế (`Ushnisha`), đài sen 16 cánh và vầng quang minh Mandala luân chuyển.

---

## 4. HỆ THỐNG ÂM THANH KHÔNG GIAN PROCEDURAL (3D SPATIAL AUDIO)

* **Engine Tổng hợp Web Audio (`ZenAudio.ts`)**:
  * Chạy trực tiếp bằng thuật toán dao động toán học của trình duyệt (BiquadFilterNode, OscillatorNode, ConvolverNode, GainNode), không tải file mp3 nặng.
  * **Chuông xoay Tây Tạng (Tibetan Singing Bowl)**: Tần số cộng hưởng kép $432\text{Hz}$ và $864\text{Hz}$.
  * **Tiếng Mõ Gỗ Chùa (Wooden Fish)**: Bộ lọc dải thông xung hãm $680\text{Hz}$.
  * **Mưa rào mái ngói & Suối thiền**: Lọc nhiễu trắng Pink/Brownian Noise thời gian thực.
  * **Tiếng ve & dế đêm**: Dao động tần số cao điều tần $4.2\text{kHz} - 5.8\text{kHz}$.
  * Tần số chuẩn: **$432\text{Hz}$** (Tần số chữa lành và chánh niệm tự nhiên).

---

## 5. TIÊU CHUẨN WEB3 CARDANO (BLOCKCHAIN STANDARDS)

* **Cardano CIP-30 (Signer DApp-Wallet Web Bridge)**:
  * Tích hợp các ví: Lace, Eternl, Nami, Flint, Vespr (Mobile).
  * Chuẩn hóa giao tiếp Ed25519, chữ ký phân tán không gây phiền nhiễu cho người dùng.
* **Cardano CIP-68 (Rich Non-Fungible Metadata Standard)**:
  * Quy chuẩn phát hành Thẻ Bài Di Sản NFT mini và vật phẩm tâm linh.
* **Hydra Head L2 State Channels**:
  * Xử lý giao dịch quyên góp công đức và thỉnh kinh phí vi mô (Micropayments) với tốc độ tức thời và phí mạng bằng $0$.

---

## 6. LỜI CẢM ƠN (ACKNOWLEDGEMENTS)

Dự án **Vạn Cảnh Thiền Tự** xin gửi lời tri ân sâu sắc tới:
* **Cộng đồng nguồn mở Three.js**: Những người đã kiến tạo nên nền tảng đồ họa 3D vĩ đại cho trình duyệt web.
* **Thiền phái Trúc Lâm Yên Tử & Làng Mai**: Nguồn cảm hứng tâm linh bất tận cho từng viên gạch, mái ngói, câu kệ chánh niệm và âm điệu chuông chùa trong toàn bộ thế giới ảo.
* **Cộng đồng Lập trình viên Cardano**: Đã tiên phong phát triển các công nghệ phi tập trung vì cộng đồng.

*Dự án phát triển vì mục đích bảo tồn di sản văn hóa, ứng dụng công nghệ Web3 nhân văn và lan tỏa năng lượng bình an cho cộng đồng đồng tu toàn cầu.*
