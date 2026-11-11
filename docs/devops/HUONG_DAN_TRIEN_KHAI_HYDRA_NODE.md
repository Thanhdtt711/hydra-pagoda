# Hướng Dẫn Kỹ Thuật Triển Khai Dedicated Hydra Node L2 Cho Đội Ngũ DevOps

Tài liệu này cung cấp toàn bộ quy trình thiết lập, cấu hình bảo mật, vận hành và giám sát **Hydra Node (Cardano Layer 2 Head)** độc lập dành riêng cho dự án **Vạn Cảnh Thiền Tự** (`hydra-pagoda`). Tài liệu được biên soạn để đội ngũ DevOps có thể triển khai nhanh chóng lên máy chủ Cloud (VPS/Dedicated Server) và tích hợp an toàn với backend của game đang chạy trên Render.

---

## 1. Tổng Quan Kiến Trúc & Yêu Cầu Hạ Tầng

```
┌─────────────────────────────────┐
│   Người chơi (Trình duyệt/Web)  │
│  Nhúng Iframe trong HydraOne    │
└────────────────┬────────────────┘
                 │ HTTPS API
                 ▼
┌────────────────────────────────────────────────────────┐
│         Backend Game (Render Node.js Service)          │
│  - Lưu SQLite: Sổ cái tức thì                          │
│  - Tạo giao dịch L2 Notary qua WebSocket WSS           │
└────────────────┬───────────────────────────────────────┘
                 │ Secure WebSocket (wss://hydra.your-domain.com)
                 ▼
┌────────────────────────────────────────────────────────┐
│             Máy Chủ DevOps (Ubuntu VPS)                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Reverse Proxy: Nginx / Caddy (SSL Let's Encrypt) │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │ Proxy pass ws://127.0.0.1:4001
│  ┌──────────────────────▼───────────────────────────┐  │
│  │ Container Docker: hydra-node:0.22.4              │  │
│  │ - Head State: Luôn Open, 0 phí gas               │  │
│  │ - Volume Persistence: /data, /state              │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 1.1. Yêu Cầu Phần Cứng Máy Chủ (VPS)
- **Hệ điều hành:** Ubuntu 22.04 LTS hoặc Ubuntu 24.04 LTS (x86_64).
- **CPU:** Tối thiểu 2 vCPU.
- **RAM:** Tối thiểu 4 GB RAM (khuyến nghị 8 GB nếu muốn chạy kèm monitoring).
- **Ổ cứng (Disk):** 40 GB SSD trở lên.
- **Mạng (Network):** 1 IP tĩnh công khai (Static Public IPv4), mở các cổng inbound:
  - Cổng `80` (HTTP - để cấp phát chứng chỉ SSL).
  - Cổng `443` (HTTPS / WSS - cổng kết nối WebSocket an toàn).
  - Cổng `22` (SSH quản trị).
  - **Lưu ý an ninh:** Tuyệt đối không mở cổng nội bộ `4001` ra Internet; chỉ cho phép Nginx chuyển tiếp nội bộ `127.0.0.1:4001`.

### 1.2. Phần Mềm Tiền Đề Cần Cài Sẵn
- Docker Engine phiên bản `>= 24.0`.
- Docker Compose v2 (`docker compose`).
- Nginx hoặc Caddy Server.
- Certbot (nếu dùng Nginx để cấp SSL miễn phí Let's Encrypt).

---

## 2. Quy Trình Cài Đặt Từng Bước Trên VPS

### Bước 1: Chuẩn Bị Thư Mục Dự Án
Đăng nhập SSH vào máy chủ VPS và tạo cấu trúc thư mục làm việc:
```bash
sudo mkdir -p /opt/hydra-node/.hydra-offline /opt/hydra-node/state
sudo chown -R $USER:$USER /opt/hydra-node
cd /opt/hydra-node
```

### Bước 2: Tải Bộ Tham Số Giao Thức (Protocol Parameters)
Tải file cấu hình tham số giao thức (phí gas bằng 0) từ kho mã nguồn chính thức của Hydra:
```bash
curl -sS -o /opt/hydra-node/.hydra-offline/protocol-parameters.json \
  https://raw.githubusercontent.com/cardano-scaling/hydra/0.22.4/hydra-cluster/config/protocol-parameters.json
```

### Bước 3: Sinh Cặp Khóa Ký Hydra (Hydra Signing & Verification Key)
Sử dụng chính Docker image của Hydra Node để sinh cặp khóa:
```bash
docker run --rm -v /opt/hydra-node/.hydra-offline:/data \
  ghcr.io/cardano-scaling/hydra-node:0.22.4 \
  gen-hydra-key --output-file /data/hydra
```
Sau lệnh này, thư mục `/opt/hydra-node/.hydra-offline/` sẽ xuất hiện 2 file:
- `hydra.sk`: Khóa bí mật (Private Signing Key).
- `hydra.vk`: Khóa công khai (Public Verification Key).
Đặt quyền bảo mật chặt chẽ cho file khóa:
```bash
chmod 600 /opt/hydra-node/.hydra-offline/hydra.sk
```

### Bước 4: Tạo File UTxO Ban Đầu (`utxo.json`)
Head L2 khi khởi động cần có một lượng tiền khởi tạo (Initial Fuel UTxO) để thực hiện các giao dịch phân phối coin.
Tạo file `/opt/hydra-node/.hydra-offline/utxo.json`:
```json
{
  "0000000000000000000000000000000000000000000000000000000000000001#0": {
    "address": "addr_test1vqg9j47wqefh67yxf76v00x9s9a52l27s2r28d3m8f3k2qsf3qf4a",
    "value": {
      "lovelace": 1000000000000
    },
    "datum": null,
    "datumhash": null,
    "inlineDatum": null,
    "inlineDatumRaw": null,
    "referenceScript": null
  }
}
```

### Bước 5: Cấu Hình Docker Compose
Tạo file `/opt/hydra-node/docker-compose.yml`:
```yaml
services:
  hydra-node:
    image: ghcr.io/cardano-scaling/hydra-node:0.22.4
    container_name: hydra-pagoda-l2
    restart: always
    command:
      - --node-id
      - pagoda-l2-main
      - --api-host
      - 0.0.0.0
      - --api-port
      - "4001"
      - --hydra-signing-key
      - /data/hydra.sk
      - --offline-head-seed
      - "000102030405060708090a0b0c0d0e0f"
      - --initial-utxo
      - /data/utxo.json
      - --ledger-protocol-parameters
      - /data/protocol-parameters.json
      - --persistence-dir
      - /state
    ports:
      - "127.0.0.1:4001:4001"
    volumes:
      - /opt/hydra-node/.hydra-offline:/data:ro
      - /opt/hydra-node/state:/state:rw
```
> **Ghi chú về phiên bản Image:** Khuyến nghị giữ nguyên image `ghcr.io/cardano-scaling/hydra-node:0.22.4`. Các phiên bản `1.x` hoặc `2.x` mới hơn yêu cầu tập lệnh CPU AVX2 mở rộng, nếu chạy trên các dòng máy chủ VPS dùng CPU đời cũ sẽ gây lỗi `SIGILL (exit 132)` làm container bị crash liên tục.

Khởi động container:
```bash
docker compose up -d
```
Kiểm tra logs xem node đã khởi động thành công và mở Head chưa:
```bash
docker compose logs -f
```
Khi thấy dòng log chứa `HeadIsOpen` hoặc `Listening on ws://0.0.0.0:4001` là node đã hoạt động chuẩn xác.

---

## 3. Cấu Hình Reverse Proxy & Bảo Mật SSL (WSS)

Vì frontend và backend của game chạy trên môi trường HTTPS an toàn tại `https://hydra-pagoda.onrender.com`, các kết nối WebSocket đến máy chủ Hydra bắt buộc phải sử dụng giao thức bảo mật `wss://` (WebSocket over TLS).

### 3.1. Trỏ Bản Ghi DNS
Tạo một bản ghi `A Record` trên tên miền của bạn trỏ về địa chỉ IP của VPS:
- **Tên miền ví dụ:** `hydra.your-domain.com`
- **Loại:** `A`
- **Giá trị:** `<Địa chỉ IP của VPS>`

### 3.2. Cấu Hình Nginx
Cài đặt Nginx và Certbot:
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```
Tạo file cấu hình virtual host `/etc/nginx/sites-available/hydra.conf`:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    server_name hydra.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Tăng thời gian chờ timeout cho kết nối WebSocket thường trực
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
Kích hoạt cấu hình và cấp chứng chỉ SSL:
```bash
sudo ln -s /etc/nginx/sites-available/hydra.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d hydra.your-domain.com
```

---

## 4. Cấu Hình Tích Hợp Vào Backend Game Trên Render

Sau khi máy chủ Hydra Node đã sẵn sàng và kiểm tra kết nối SSL thành công, DevOps truy cập trang quản trị dịch vụ Render (`Dashboard -> hydra-pagoda -> Environment`):

Thêm hoặc cập nhật các biến môi trường sau:

| Tên Biến | Giá Trị Mẫu | Mô Tả |
| :--- | :--- | :--- |
| `HYDRA_L2_ENABLED` | `true` | Bật tính năng định tuyến sổ cái Merit Coin qua Hydra L2 |
| `HYDRA_NODE_WS_URL` | `wss://hydra.your-domain.com` | Địa chỉ WebSocket an toàn trỏ đến node VPS vừa dựng |
| `NUXT_HYDRA_SESSION_SECRET` | `64_ky_tu_hex_ngau_nhien` | Chuỗi bí mật 32-byte dùng để dẫn xuất khóa ký L2 Fuel |
| `NUXT_HYDRA_STATE_LOVELACE` | `2000000` | Số Lovelace khóa trong State UTxO của mỗi tài khoản (2 ADA) |

Sau khi cập nhật biến môi trường, bấm **Manual Deploy -> Deploy latest commit** trên Render.

---

## 5. Kiểm Tra Sức Khỏe & Giám Sát (Health Check)

### 5.1. Kiểm Tra Kết Nối WebSocket Trực Tiếp
DevOps có thể kiểm tra trực tiếp từ máy tính cá nhân bằng công cụ `wscat`:
```bash
npm install -g wscat
wscat -c wss://hydra.your-domain.com
```
Nếu màn hình phản hồi các sự kiện JSON của Hydra Node như `Greetings`, `HeadIsOpen` là cổng WebSocket đã thông suốt.

### 5.2. Chạy Test Suite Tự Động Từ Kho Mã Nguồn
Để đảm bảo toàn bộ luồng tạo giao dịch L2, ký số và chứng thực snapshot hoạt động hoàn hảo 100%, chạy lệnh kiểm thử tích hợp sẵn:
```bash
npm run wallet:test:hydra
```
**Tiêu chí thành công:** Toàn bộ `11/11 test cases` phải trả về trạng thái `PASS`.

---

## 6. Quy Trình Vận Hành & Khắc Phục Sự Cố (Runbook)

### 6.1. Xem Nhật Ký Hoạt Động (Logs)
```bash
docker compose -f /opt/hydra-node/docker-compose.yml logs -f --tail=100
```

### 6.2. Sao Lưu Dữ Liệu Sổ Cái L2 (Backup State)
Thư mục `/opt/hydra-node/state` chứa toàn bộ lịch sử snapshot và trạng thái UTxO hiện tại. DevOps có thể lập cron job sao lưu hàng ngày:
```bash
tar -czvf /backup/hydra-state-$(date +%F).tar.gz /opt/hydra-node/state
```

### 6.3. Khởi Động Lại Hoặc Làm Mới Trạng Thái (Reset Head)
Nếu cần khôi phục lại trạng thái ban đầu của Head:
```bash
cd /opt/hydra-node
docker compose down
sudo rm -rf state/*
docker compose up -d
```
Backend của game được lập trình với cơ chế tự phục hồi: ngay khi Hydra Node mở lại hoặc gặp sự cố mất mạng, backend sẽ tự động chuyển sang chế độ dự phòng SQLite (Fallback Mode) để người chơi trong chùa không bao giờ bị gián đoạn trải nghiệm.

