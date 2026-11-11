# Kế Hoạch Triển Khai: Tọa Thiền Định Tâm Chánh Điện & Nhận Thưởng MC (Meditate-to-Earn)

> **Trạng thái**: Tài liệu thiết kế & Kế hoạch triển khai (Chưa code - Đã cập nhật theo yêu cầu trải nghiệm 3D thực tế)  
> **Mục tiêu**: Xây dựng trải nghiệm Tọa Thiền Chánh Niệm tương tác 3D chân thực bên trong Đại Hùng Bảo Điện, kết hợp cơ chế kiểm tra vị trí nhân vật, tự động tìm bồ đoàn (đệm thiền) gần nhất, tự xoay mặt về bàn thờ Phật Thích Ca, xử lý trạng thái hết chỗ và tích hợp hệ thống thưởng MC Coin (Meditate-to-Earn) xác thực qua sổ cái máy chủ và Hydra L2.

---

## 1. Luồng Trải Nghiệm Người Dùng Chi Tiết (User Experience Flow)

```
[Người chơi mở Tab "Thiền" trên Drawer]
                     │
                     ▼
        [Bấm "Bắt Đầu Tọa Thiền"]
                     │
                     ▼
     ┌───────────────────────────────┐
     │ Kiểm tra vị trí nhân vật 3D?   │
     └───────────────────────────────┘
          │                     │
          ▼ (Đang ở ngoài)       ▼ (Đã ở trong Chánh Điện)
┌──────────────────────┐  ┌────────────────────────────────────┐
│ HIỆN CẢNH BÁO:       │  │ Quét 500 bồ đoàn trong HallLayout  │
│ "Đạo hữu cần đi vào  │  └────────────────────────────────────┘
│ trong Chánh Điện     │                     │
│ mới có thể tọa thiền"│                     ▼
│ [Nút Dẫn Đường]      │         ┌────────────────────────┐
└──────────────────────┘         │ Còn chỗ trống không?   │
                                 └────────────────────────┘
                                      │              │
                    (Hết bồ đoàn)     ▼              ▼ (Còn chỗ)
         ┌───────────────────────────────┐   ┌───────────────────────────────────┐
         │ HIỆN THÔNG BÁO:               │   │ 1. Tìm bồ đoàn gần nhất           │
         │ "Bồ đoàn trong Chánh Điện đã  │   │ 2. Nhân vật auto-walk đến đệm     │
         │ kín chỗ. Xin đạo hữu hoan hỷ  │   │ 3. Xoay mặt trực diện bàn Phật   │
         │ chờ hoặc quay lại sau."       │   │ 4. Chuyển animation ngồi kiết già │
         └───────────────────────────────┘   │ 5. Khởi động Chuông xoay & Nhạc   │
                                             │ 6. Bắt đầu phiên thiền nhận MC    │
                                             └───────────────────────────────────┘
```

### Bước 1: Kiểm tra Không Gian Vị Trí (Boundary Check)
- Khi người chơi bấm nút **"Bắt Đầu Tọa Thiền"** tại giao diện Drawer:
  - Hệ thống kiểm tra tọa độ hiện tại $(x, y, z)$ của nhân vật trong `TempleStage`.
  - Nếu nhân vật đang ở ngoài sân, cổng tam quan, vườn hoa, v.v. (nằm ngoài vùng `HallLayout.BOUNDS.interior`):
    - **Chặn không cho bắt đầu phiên thiền.**
    - Hiển thị Toast thông báo trang nghiêm:  
      *⚠️ "Đạo hữu cần bước vào bên trong Đại Hùng Bảo Điện (khu vực bồ đoàn) mới có thể bắt đầu thời khóa tọa thiền."*
    - Cung cấp nút hành động phụ: **"Dẫn bước vào Chánh Điện"** (hệ thống tự điều khiển nhân vật đi qua Chính Môn vào điện).

### Bước 2: Tìm Bồ Đoàn (Meditation Mat) Trống Gần Nhất
- Khi nhân vật đã ở bên trong Chánh Điện:
  - Hệ thống truy vấn danh sách 500 bồ đoàn thiền từ `HallLayout.getMeditationSlots()`.
  - **Trường hợp Hết Chỗ (`nearestSlot === null` hoặc tất cả đều `isOccupied`):**
    - Hệ thống thông báo rõ ràng:  
      *🛑 "Hiện tại toàn bộ 500 bồ đoàn tọa thiền trong Chánh Điện đều đã có đồng tu tĩnh tọa. Kính mong đạo hữu hoan hỷ chờ đợi giây lát hoặc quay lại sau."*
  - **Trường hợp Còn Chỗ:**
    - Hệ thống gọi thuật toán `HallLayout.findNearestAvailableSlot(playerX, playerZ)` để chọn ra bồ đoàn gần nhân vật nhất.
    - Đánh dấu vị trí đó là `isOccupied = true` (gắn mã định danh người chơi).

### Bước 3: Nhân Vật Tự Động Di Chuyển & Căn Chỉnh Hướng Ngồi
- **Tự động di chuyển (Auto-pathfinding / Tween):** Nhân vật tự động bước đi khoan thai theo lối đi thông thủy (`AISLES`) đến tâm của đệm thiền được chọn $(slot.x, slot.floorY, slot.z)$.
- **Xoay người chuẩn góc hướng Phật (Auto-Align Yaw):** Khi đến đệm, nhân vật tự động xoay người theo góc $yaw$ của slot, đảm bảo **mặt luôn hướng thẳng lên Tôn tượng Phật Thích Ca Mâu Ni** trên Bàn Thờ Tam Bảo (không bao giờ quay lưng hay quay ngang vào tượng).
- **Tư thế Tọa Thiền (Meditation Pose):** Nhân vật hạ người ngồi xuống tư thế kiết già thanh tịnh (chuyển sang state animation `sit_meditation`).
- **Chuyển Camera Chánh Niệm:** Camera 3D nhẹ nhàng trượt về góc nhìn thiền định (nửa người hoặc góc nhìn qua vai ngắm nhìn Phật Đài huyền ảo với khói trầm và ánh nến).

### Bước 4: Khởi Động Thời Khóa Tọa Thiền & Cơ Chế Nhận MC
- Đóng/thu gọn Drawer, kích hoạt thanh Mandala điều hòa hơi thở 4-4-6.
- Ngân tiếng chuông xoay Tây Tạng 432Hz giúp thư giãn sâu.
- Gửi yêu cầu `POST /api/mc/meditation/start` lên máy chủ để khóa phiên thiền (`started_at`).
- Người chơi có thể ấn **"Xả Thiền Sớm"** nếu có việc gấp (nhân vật sẽ đứng dậy, giải phóng chỗ ngồi, nhưng không nhận được MC nếu chưa hoàn thành thời lượng tối thiểu).

### Bước 5: Hoàn Mãn Thời Khóa & Phát Thưởng Sổ Cái MC
- Khi đồng hồ đếm ngược về `0`:
  - Chuông đại hồng chung chùa ngân vang ngân nga (`zenAudio.playTempleBell()`).
  - Gửi yêu cầu `POST /api/mc/meditation/complete` lên máy chủ.
  - Máy chủ xác thực thời gian thực, cộng thưởng MC vào tài khoản, ghi bút toán `mc_ledger` và bằng chứng giao dịch Hydra L2 Head.
  - Nhân vật từ tốn xả thiền và đứng dậy, bồ đoàn được trả về trạng thái trống (`isOccupied = false`).
  - Hiển thị hộp thoại viên mãn công đức:
    *✨ "Viên mãn thời khóa tọa thiền! Bạn nhận được +30 MC Công Đức (Mã giao dịch L2 #...)."*

---

## 2. Bảng Cấu Hình Phần Thưởng & Giới Hạn Ngày (Economy Rules)

| Gói Thời Lượng | Thời Gian Thực | Số Chu Kỳ Thở 4-4-6 | Thưởng MC | Ứng Dụng Trong Hệ Sinh Thái |
| :--- | :---: | :---: | :---: | :--- |
| **3 Phút** | `180s` | ~13 chu kỳ | **`+15 MC`** | Đủ gieo 1 Quẻ Cơ Bản (10 MC) + dư 5 MC |
| **5 Phút** | `300s` | ~21 chu kỳ | **`+30 MC`** | Đủ thỉnh Trầm Hương hoặc tích lũy cho Quẻ Phổ Biến |
| **15 Phút** | `900s` | ~64 chu kỳ | **`+80 MC`** | Đủ gieo Quẻ Phổ Biến (50 MC) + dư 30 MC |
| **30 Phút** | `1800s` | ~128 chu kỳ | **`+150 MC`** | Đủ gieo Quẻ Kim Quyển (100 MC) + tích lũy mở Thẻ Bài |

- **Hạn mức nhận thưởng tối đa (`DAILY_MEDITATION_CAP_MC`)**: **`200 MC / ngày / tài khoản ví`** (reset lúc 00:00 UTC+7).
- Nếu đã đạt mốc 200 MC trong ngày, người chơi vẫn có thể tọa thiền để định tâm và tăng điểm chuyên cần (`streakDays`), nhưng hệ thống trả về `rewardMc = 0` kèm thông báo *"Đã đạt giới hạn công đức thiền hôm nay"*.

---

## 3. Kiến Trúc Kỹ Thuật (Architecture & Components)

### 3.1. Không Gian 3D & Chỗ Ngồi (`lib/world3d/`)
1. **`lib/world3d/world/HallLayout.ts`** (Nguồn chân lý duy nhất):
   - `isInsideSanctuary(x, z): boolean`: Kiểm tra tọa độ có nằm trong `interior` Chánh Điện $[-19.4 \le x \le 19.4]$ và $[-28.9 \le z \le -0.1]$ hay không.
   - `findNearestAvailableSlot(x, z): MeditationSlot | null`: Trả về bồ đoàn trống gần nhất kèm tọa độ $(x, z)$ và góc quay mặt hướng Phật ($yaw$).
   - `occupySlot(slotId, userId)` & `releaseSlot(slotId)`: Quản lý trạng thái bồ đoàn theo thời gian thực.
2. **`lib/world3d/TempleStage.ts`**:
   - `navigateToMeditationSlot(slot: MeditationSlot, onArrive: () => void)`: Điều khiển nhân vật đi bộ tự động tới đệm thiền, xoay đúng góc $yaw$, chuyển sang pose ngồi kiết già.
   - `standUpFromMeditation()`: Đứng dậy và trả lại quyền điều khiển tự do cho người chơi.

### 3.2. Cơ Sở Dữ Liệu SQLite (`server/db/migrations.ts`)
```sql
CREATE TABLE IF NOT EXISTS meditation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  slot_id INTEGER,                      -- Mã bồ đoàn đã ngồi
  duration_min INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  expected_reward_mc INTEGER NOT NULL,
  credited_mc INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'cancelled'
  day_key TEXT NOT NULL,                 -- 'YYYY-MM-DD' (UTC+7)
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  ledger_id INTEGER REFERENCES mc_ledger(id)
);

CREATE INDEX IF NOT EXISTS idx_meditation_account_day
  ON meditation_sessions(account_id, day_key, status);
```

### 3.3. Dịch Vụ Máy Chủ (`server/utils/wallet/mcService.ts`)
- `startMeditationSession(accountId, durationMin, slotId)`:
  - Hủy các phiên cũ chưa hoàn thành.
  - Sinh `session_token` duy nhất, lưu thời điểm `started_at = Date.now()`.
- `completeMeditationSession(accountId, sessionToken, requestId)`:
  - Chống gian lận tua thời gian: Xác thực `Date.now() - started_at >= (duration_sec - 3) * 1000`.
  - Tính toán số MC cộng theo hạn mức ngày còn lại.
  - Ghi nhận `mc_ledger` với lý do `meditation_reward`, đẩy giao dịch lên Hydra L2 Head Notary.

### 3.4. Giao Diện Người Dùng (`components/SanctuaryDrawer.vue`)
- Hiển thị thông báo Toast chuẩn Binance Dark khi:
  - Nhân vật đang ở ngoài Chánh Điện.
  - Toàn bộ bồ đoàn bị kín chỗ.
- Cung cấp trạng thái trực quan: Số bồ đoàn đang trống trong điện (ví dụ: *Còn trống 482/500 đệm thiền*).
- Trong lúc thiền: Hiển thị bộ đếm lùi, vòng nhịp thở Mandala và nút **"Xả Thiền Sớm"**.

---

## 4. Kế Hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Kiểm tra vị trí ngoài điện:**
   - Nhân vật đứng ở Cổng Tam Quan hoặc sân chùa $\rightarrow$ Bấm "Bắt Đầu Tọa Thiền" $\rightarrow$ Bị chặn, hiện thông báo yêu cầu vào trong điện.
2. **Kiểm tra tự động tìm chỗ & xoay hướng mặt:**
   - Nhân vật bước vào điện $\rightarrow$ Bấm "Bắt Đầu Tọa Thiền" $\rightarrow$ Nhân vật tự bước tới bồ đoàn gần nhất, ngồi xuống và mặt hướng thẳng lên tượng Phật.
3. **Kiểm tra khi hết bồ đoàn:**
   - Giả lập cả 500 chỗ đều `isOccupied = true` $\rightarrow$ Hệ thống báo hết chỗ ngồi, không cho bắt đầu phiên mới.
4. **Kiểm tra chống tua giờ (Anti-Cheat):**
   - Bắt đầu gói 5 phút (300s), gọi API hoàn thành sau 5 giây $\rightarrow$ Máy chủ từ chối `400 meditation_incomplete`, không cộng MC.
5. **Kiểm tra cộng MC & Hydra L2 Proof:**
   - Ngồi đủ thời gian $\rightarrow$ Số dư MC tăng chuẩn xác, có bằng chứng `hydra_status = snapshot_confirmed`.
6. **Kiểm tra UI Binance Dark:**
   - 100% font chữ $\ge 12px$, thông báo lỗi màu đỏ `#f6465d`, thành công màu xanh `#0ecb81`, điểm nhấn vàng `#fcd535`.
