# Thiết Kế Tích Hợp Tôn Tượng Phật Thích Ca Mâu Ni 3D GLB (Đá Rêu Cổ)

- **Ngày tạo:** 2026-11-05
- **Trạng thái:** Chờ phê duyệt (Pending Approval)
- **Tác giả:** Antigravity & User

---

## 1. Mục Tiêu & Bối Cảnh
Tôn tượng Đức Phật Thích Ca Mâu Ni trong Chánh Điện hiện tại được tạo bằng các khối hình học cơ bản (`Cylinder`, `Sphere`, `Cone`), dẫn đến đường nét thô sơ, chưa phản ánh đúng sự trang nghiêm và mỹ thuật Phật giáo cổ truyền.

Người dùng đã lựa chọn **Phương án 2 - Lựa chọn A**: Tích hợp model 3D điêu khắc thật định dạng `.glb` (`public/models/the_buddha_statue_in_a_mountain.glb`) với chất liệu **Đá rêu cổ truyền** nguyên bản.

---

## 2. Thông Số Kỹ Thuật Model 3D (`the_buddha_statue_in_a_mountain.glb`)
- **Vị trí tệp:** `d:\Vtechcom\hydra-pagoda\public\models\the_buddha_statue_in_a_mountain.glb`
- **Dung lượng:** 11.3 MB
- **Cấu trúc hình học (Meshes):**
  - `fo_L:polySurface18_fo_L`: Thân Tôn tượng Đức Phật Thích Ca Mâu Ni tọa thiền kiết già, áo cà sa rủ sóng lượn, tay bắt ấn thiền (8.993 tam giác).
  - `all_LOW:di_zuoLgroup2`: Bệ đài hoa sen (1.120 tam giác).
  - `all_LOW:group3polySurface12, 15, 16, 17`: Các lớp cánh sen và hoa văn điêu khắc chân đài (11.376 tam giác).
- **Tổng số đa giác:** **21.489 tam giác** (hoàn toàn tối ưu cho Three.js, không gây sụt FPS).
- **Textures:** 2 map độ phân giải $1024 \times 1024$ sắc nét (vân đá tự nhiên, rêu phong cổ kính).
- **Hướng mặt (Facing):** Quay về trục $+Z$ trong không gian cục bộ $\rightarrow$ Hướng thẳng ra Chính Môn (Cửa Giữa) của Chánh Điện.

---

## 3. Kiến Trúc Triển Khai

### 3.1. Cập nhật `SacredBuddhaStatue.ts`
- **Thay thế khởi tạo hình học thô:**
  - Loại bỏ các hàm dựng primitives: `buildOctagonalPedestal()`, `buildLotusThrone()`, `buildBuddhaFigure()`.
  - Khởi tạo `GLTFLoader` từ `three/examples/jsm/loaders/GLTFLoader.js` để nạp tệp `/models/the_buddha_statue_in_a_mountain.glb`.
- **Căn chỉnh Tọa độ & Tỉ lệ (Normalization & Auto-scaling):**
  - Tự động đo `Box3` của model sau khi nạp.
  - Chuẩn hóa chiều cao Tôn tượng đạt **$4.2\text{m}$** (chiều rộng $\approx 4.0\text{m}$ tương xứng hoàn hảo với bệ đá Tam Bảo $12\text{m} \times 4.2\text{m}$ trong điện cao $15.5\text{m}$).
  - Căn tâm đáy đài sen đặt chính xác ở cao độ $Y = 0$ của `root` (khi gắn vào `altarGroup` tại $Y = 1.7$ thì đáy tượng nằm đúng mặt trên bệ đá Tam Bảo tại cao độ thế giới $Y = 3.05\text{m}$).
- **Thiết lập Đổ bóng & Vật liệu:**
  - Duyệt toàn bộ `mesh`: bật `castShadow = true` và `receiveShadow = true`.
  - Giữ nguyên texture đá rêu cổ truyền (`MeshStandardMaterial` PBR), chỉnh nhẹ `roughness: 0.82`, `metalness: 0.05` để bắt ánh nến và đèn lồng ấm áp.
- **Vầng Hào Quang Quang Minh (Dharma Halo):**
  - Tự động định vị vòng hào quang `haloMesh` ngay phía sau đầu Tôn tượng (tại $Y \approx 3.7\text{m}, Z \approx -0.4\text{m}$).
  - Giữ hiệu ứng xoay chậm (`update(delta)`) biểu trưng cho bánh xe Pháp luân luân chuyển.
- **Giải phóng Bộ nhớ (`dispose`):**
  - Bổ sung hàm `dispose()` hủy đầy đủ geometry, textures và materials khi tháo dỡ màn chơi.

### 3.2. Kiểm định Tích Hợp & Chống Xung Đột
- Tôn tượng nằm hoàn toàn trên đỉnh bệ đá Tam Bảo, không lấn xuống sàn gỗ hay đệm thiền.
- Khoảng cách từ chân bệ thờ đến hàng đệm gần nhất vẫn giữ nguyên an toàn $\ge 0.63\text{m}$ (đã nghiệm thu ở bước trước).

---

## 4. Kế Hoạch Kiểm Thử & Nghiệm Thu
1. **Kiểm thử tự động:**
   - Chạy script kiểm tra `GLTFLoader` nạp thành công, kiểm tra bounding box và chiều cao tượng $\approx 4.2\text{m}$.
   - Chạy lại bộ test `test_phase7_acceptance.mjs` đảm bảo 16/16 test đều PASS.
2. **Nghiệm thu hình ảnh thực tế (Headless Chrome CDP):**
   - Chụp ảnh chính diện từ cửa Chánh Điện nhìn vào Tôn tượng mới.
   - Chụp góc cận cảnh chi tiết khuôn mặt từ bi và đài sen đá rêu cổ.
   - Đo FPS đạt $\ge 60$ FPS ổn định.

