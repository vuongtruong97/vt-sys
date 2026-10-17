# 03 · Triển khai lên VPS

Hướng dẫn đưa hệ thống lên một VPS bằng Docker Compose, có HTTPS tự động (Caddy). Cấu hình nằm trong `deploy/`:

| File | Việc |
| --- | --- |
| `deploy/docker-compose.prod.yml` | Toàn bộ dịch vụ cho máy chủ thật: không mở cổng DB/API ra ngoài, tự khởi động lại |
| `deploy/Caddyfile` | HTTPS và reverse proxy cho `DOMAIN`, `live.DOMAIN`, `board.DOMAIN` |
| `deploy/livekit.prod.yaml` | LiveKit dùng IP công khai, một cổng UDP, bật TURN |
| `deploy/backup.sh` | Sao lưu Postgres hằng ngày |

> Cấu hình này **chưa được chạy thử trên VPS thật**. Lần đầu triển khai nên dành thời gian kiểm tra từng bước theo mục "Kiểm tra sau khi triển khai".

## 1. Chuẩn bị

### Máy chủ

| Quy mô | Cấu hình | Băng thông |
| --- | --- | --- |
| Lớp ≤ 5 người, không ghi hình | 2 vCPU / 4 GB RAM / 40 GB SSD | ~15 Mbps lúc dạy |
| Lớp ≤ 30 người | 4 vCPU / 8 GB RAM / 60 GB SSD | ~75 Mbps lúc dạy, ~3 TB/tháng nếu 2 buổi/ngày |
| Có ghi hình | thêm 2–4 vCPU và 2 GB RAM cho egress (Chrome ghép video) | thêm lưu lượng tải MP4 lên R2 |
| Ghi hình và phát trực tiếp cùng lúc | mỗi việc là một egress riêng: tính gấp đôi dòng trên | người xem webinar nên đi qua CDN (xem mục 6) |

Yêu cầu bắt buộc:

- Ubuntu 22.04 hoặc 24.04.
- IPv4 công khai cố định.
- Nhà cung cấp **không chặn UDP**.
- Gói đủ lưu lượng: mỗi học viên tốn khoảng 1,7 GB cho một buổi 90 phút.
- Đặt máy ở Việt Nam hoặc Singapore để độ trễ thấp.

### Tên miền

Tạo 3 bản ghi DNS loại A trỏ về IP của VPS. Thay `example.vn` bằng tên miền của bạn:

| Tên | Dùng cho |
| --- | --- |
| `example.vn` | web |
| `live.example.vn` | LiveKit (signaling + TURN) |
| `board.example.vn` | bảng trắng |

Nếu dùng Cloudflare, để `live` và `board` ở chế độ **DNS only** (mây xám). Proxy của Cloudflare không chuyển tiếp TURN và WebRTC.

### Firewall

| Cổng | Giao thức | Dịch vụ |
| --- | --- | --- |
| 22 | TCP | SSH |
| 80, 443 | TCP | Caddy (HTTP, HTTPS) |
| 443 | UDP | HTTP/3 (không bắt buộc) |
| 7881 | TCP | LiveKit media qua TCP |
| 7882 | UDP | LiveKit media |
| 3478 | UDP | TURN |

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp
sudo ufw allow 7881/tcp && sudo ufw allow 7882/udp && sudo ufw allow 3478/udp
sudo ufw enable
```

Nhà cung cấp có firewall riêng trên trang quản trị (security group) thì mở các cổng này ở đó nữa.

## 2. Cài Docker và lấy code

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

sudo mkdir -p /opt/vt-sys && sudo chown $USER /opt/vt-sys
git clone https://github.com/vuongtruong97/vt-sys.git /opt/vt-sys
cd /opt/vt-sys
```

## 3. Cấu hình

```bash
cp .env.example .env
nano .env
```

Đổi tối thiểu:

```ini
POSTGRES_PASSWORD=<openssl rand -hex 16>
JWT_SECRET=<openssl rand -hex 32>
WHITEBOARD_SECRET=<openssl rand -hex 32>
LIVEKIT_API_KEY=bangden
LIVEKIT_API_SECRET=<openssl rand -hex 32>
SEED_TEACHER_EMAIL=email-that-cua-giao-vien@gmail.com
SEED_TEACHER_PASSWORD=<mật khẩu mạnh>
SEED_TEACHER_NAME=Tên giáo viên
DOMAIN=example.vn
ACME_EMAIL=email-cua-ban@gmail.com
```

`LIVEKIT_PUBLIC_URL`, `WHITEBOARD_PUBLIC_URL`, `COOKIE_SECURE` và `SEED_DEMO` không cần sửa: file compose của máy chủ tự đặt theo `DOMAIN`.

Sửa `deploy/livekit.prod.yaml`: đổi `turn.domain` thành `live.<DOMAIN>` của bạn. Nếu đổi `LIVEKIT_API_KEY`, sửa luôn `webhook.api_key` cho trùng.

### Lưu trữ bản ghi và tài liệu (Cloudflare R2)

Bỏ qua phần này thì nút ghi hình và tải tài liệu sẽ ẩn; các chức năng khác vẫn chạy.

1. Cloudflare → R2 → **Create bucket**, ví dụ `bangden`. Để bucket ở chế độ riêng tư (không bật public access).
2. R2 → **Manage API tokens** → tạo token quyền **Object Read & Write** cho bucket đó.
3. Điền vào `.env`:

```ini
S3_BUCKET=bangden
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<Access Key ID>
S3_SECRET_KEY=<Secret Access Key>
```

Không cần cấu hình CORS: tài liệu tải lên đi qua API, còn link xem lại là link ký có hạn mở thẳng trong trình duyệt.

### Email nhắc lịch (Resend)

1. Tạo tài khoản tại resend.com, xác minh tên miền gửi (thêm bản ghi DNS họ yêu cầu).
2. Tạo API key, điền vào `.env`:

```ini
RESEND_API_KEY=re_...
EMAIL_FROM=Bảng Đen <noreply@example.vn>
```

API gửi email cho học viên khoảng 1 giờ và 10 phút trước mỗi buổi. Không có khoá thì chỉ ghi log.

## 4. Khởi động

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file .env logs -f
```

Lần đầu, Caddy xin chứng chỉ HTTPS mất khoảng 30 giây. Mở `https://example.vn` và đăng nhập bằng tài khoản giáo viên trong `.env`.

Tạo alias cho gọn:

```bash
echo "alias dc='docker compose -f /opt/vt-sys/deploy/docker-compose.prod.yml --env-file /opt/vt-sys/.env'" >> ~/.bashrc && source ~/.bashrc
dc ps
```

## 5. Kiểm tra sau khi triển khai

1. `curl -I https://example.vn` trả về `200`.
2. Mở https://livekit.io/connection-test (công cụ kiểm tra của LiveKit). Nhập `wss://live.example.vn` và một token ký bằng key/secret của bạn. Hoặc đơn giản hơn: vào một buổi học bằng hai thiết bị khác mạng, ví dụ máy tính dùng Wi-Fi và điện thoại dùng 4G.
3. Trong lớp, mở `chrome://webrtc-internals` để xem kết nối dùng UDP hay TCP/TURN.
4. Điểm danh có dữ liệu sau khi rời phòng, nghĩa là webhook đã chạy.
5. Bảng trắng vẽ được và đồng bộ, nghĩa là `board.example.vn` chạy tốt.
6. Bấm **Phát trực tiếp** (công khai), mở link `/live/<id>` bằng điện thoại 4G: video chạy sau 10–20 giây.
7. Ghi hình thử 1 phút rồi dừng; vài phút sau trang **Xem lại** của buổi hiện "Xem được". Bản ghi FAILED thì xem `dc logs egress`.

## 6. Vận hành

### Cập nhật phiên bản mới

```bash
cd /opt/vt-sys
git pull
dc up -d --build
dc image prune -f
```

API chạy `prisma migrate deploy` mỗi lần khởi động, áp các migration mới trong `apps/api/prisma/migrations/`. Migration lỗi thì API dừng và log ghi rõ lý do; dữ liệu cũ không bị đụng tới.

Máy chủ đã chạy bản cũ (đồng bộ bằng `db push`) thì trước lần cập nhật đầu tiên chạy một lần:

```bash
dc run --rm api npx prisma migrate resolve --applied 0_init
```

### Sao lưu

```bash
sudo mkdir -p /var/backups/bangden && sudo chown $USER /var/backups/bangden
crontab -e
# thêm dòng:
15 3 * * * /opt/vt-sys/deploy/backup.sh >> /var/log/bangden-backup.log 2>&1
```

Nên chép thêm thư mục backup sang nơi khác: Cloudflare R2, Google Drive (qua `rclone`) hoặc một máy chủ khác.

Khôi phục:

```bash
gunzip -c /var/backups/bangden/bangden-YYYYMMDD-HHMM.sql.gz | dc exec -T postgres psql -U bangden bangden
```

### Xem log, khởi động lại

```bash
dc logs -f --tail=200 api
dc restart livekit
dc ps
```

### Đổi secret

Sửa `.env` rồi `dc up -d`.

- Đổi `JWT_SECRET`: mọi người phải đăng nhập lại.
- Đổi `LIVEKIT_API_SECRET`: chỉ ảnh hưởng các phòng đang mở.

### Webinar cho nhiều người xem (CDN)

Người xem tải HLS qua `https://<DOMAIN>/api/live/<id>/...`. API đặt sẵn header cache: đoạn video `max-age=86400, immutable`, playlist trực tiếp `max-age=2`. Với vài chục người xem không cần làm gì thêm. Với hàng trăm, hàng nghìn người, bật proxy Cloudflare (mây cam) cho tên miền **chính** (không phải `live`, `board`) và thêm Cache Rule:

- Khi URI path bắt đầu bằng `/api/live/` → **Eligible for cache**, Edge TTL **dùng header của máy chủ** (Respect origin).

Mặc định Cloudflare cache file `.ts` nhưng không cache `.m3u8`; rule trên cho cache cả playlist theo `max-age=2`, nên mỗi vài giây chỉ một yêu cầu tới VPS. Luồng riêng tư (`private`) không được CDN cache, mọi người xem đều đi tới VPS.

## 7. Khi lớp đông hơn

- Trên 30 người bật camera: nâng máy lên 8 vCPU, theo dõi CPU của container `livekit` (`docker stats`).
- Tách LiveKit sang VPS riêng: chạy chỉ service `livekit` ở máy mới; ở máy cũ đổi `LIVEKIT_URL` thành `https://live.example.vn` và trỏ DNS `live` sang máy mới. Webhook trong `livekit.prod.yaml` đổi thành `https://example.vn/api/webhooks/livekit`; đường này đi qua rewrite của web tới API.
- Nhiều node LiveKit: thêm Redis và cấu hình `redis:` trong `livekit.prod.yaml` (xem tài liệu LiveKit về triển khai nhiều node).
