# 05 · Triển khai lên máy chủ tại nhà (Proxmox VM, sau Nginx Proxy Manager)

Hướng dẫn cho máy chủ cụ thể: VM Ubuntu 22.04 trên Proxmox (máy thật i5-6500T), 2 nhân, 3,8 GB RAM, ổ 30 GB, mạng Viettel 420/422 Mbps, IP LAN `192.168.168.103`. Trên VM đã có Docker (cài qua Snap), Nginx Proxy Manager (NPM) giữ cổng 443, AdGuard Home, Portainer. Tên miền `chapter97.xyz` quản lý DNS trên Cloudflare; NPM đã có sẵn các Proxy Host khác (ví dụ `chapter97.xyz`, `home.`, `adguard.`), trỏ theo kiểu `http://192.168.168.103:<cổng>`.

vt-sys dùng ba tên miền:

| Tên miền | Dùng cho | NPM trỏ tới |
| --- | --- | --- |
| `hoc.chapter97.xyz` | trang web | `192.168.168.103:5100` |
| `live.chapter97.xyz` | LiveKit (báo hiệu WebSocket, TURN) | `192.168.168.103:5101` |
| `board.chapter97.xyz` | bảng trắng (WebSocket) | `192.168.168.103:5102` |

Khác bản VPS ([03-trien-khai-vps.md](03-trien-khai-vps.md)):

| | VPS | Máy chủ tại nhà |
| --- | --- | --- |
| File compose | `deploy/docker-compose.prod.yml` | `deploy/docker-compose.homelab.yml` |
| HTTPS | Caddy trong compose | NPM có sẵn |
| Tên miền | `DOMAIN`, `live.DOMAIN`, `board.DOMAIN` | `APP_DOMAIN`, `LIVE_DOMAIN`, `BOARD_DOMAIN` đặt riêng |
| Ghi hình, phát trực tiếp | bật được | tắt (thiếu RAM) |
| Giới hạn RAM | không | có, tổng 2 GB |
| IP | tĩnh | có thể đổi → dịch vụ `ddns` |

## Sơ đồ

```
Internet ──443/tcp──► router ──► VM:443  NPM ─┬─► 192.168.168.103:5100  web          (hoc.chapter97.xyz)
                                               ├─► 192.168.168.103:5101  livekit:7880 (live.chapter97.xyz)
                                               └─► 192.168.168.103:5102  whiteboard   (board.chapter97.xyz)
Internet ──7881/tcp, 7882/udp, 3478/udp──► router ──► VM ──► livekit (video, âm thanh: không qua NPM)
```

NPM chỉ chuyển được HTTP/WebSocket. Video và âm thanh đi bằng UDP thẳng tới LiveKit, nên router phải mở thêm 3 cổng. Cổng 5100–5102 chỉ mở trong mạng nhà, **không** chuyển ra Internet trên router.

## 1. Kiểm tra trước

Chạy trên VM:

```bash
curl -s https://api.ipify.org; echo
```

So với địa chỉ WAN trong trang quản trị modem Viettel. **Giống nhau** là có IP công khai, đi tiếp. **Khác nhau** là mạng đang dùng NAT chung (CGNAT): gọi Viettel 18008168 xin IP public, nếu không học viên sẽ không vào lớp được.

```bash
sudo docker compose version
sudo ss -tulpn | grep -E ':(5100|5101|5102|7881|7882|3478)\b' || echo "Các cổng cần dùng đều trống"
df -h /
free -h
```

Cần: `docker compose` v2, 6 cổng trống, ổ còn ≥ 10 GB, RAM còn ≥ 2,5 GB. Nếu cổng 5100–5102 đã có ứng dụng khác dùng, đổi sang cổng khác bằng `WEB_PORT`, `LIVEKIT_HTTP_PORT`, `BOARD_PORT` trong `.env` và trỏ NPM theo đó.

Chụp snapshot VM trong Proxmox trước khi làm tiếp.

## 2. Cloudflare

**DNS** (Cloudflare → `chapter97.xyz` → DNS → Records): 3 bản ghi loại A trỏ về IP nhà (kết quả `curl` ở trên):

| Tên | Proxy |
| --- | --- |
| `hoc` | DNS only hoặc Proxied đều được |
| `live` | **bắt buộc DNS only (mây xám)**: TURN/UDP 3478 không đi qua proxy Cloudflare |
| `board` | DNS only hoặc Proxied đều được |

Nếu đang có bản ghi `*` (wildcard) bật proxy, bản ghi riêng `live` được ưu tiên hơn `*`, nên chỉ cần tạo `live` (DNS only) là đủ. Dịch vụ `ddns` (bước 5) quản lý cả ba bản ghi và để chúng DNS only.

**API token** (dùng cho chứng chỉ SSL và tự cập nhật IP): Cloudflare → My Profile → API Tokens → Create Token → mẫu **Edit zone DNS**, Zone Resources: `chapter97.xyz`. Lưu token, chỉ hiện một lần.

## 3. Router Viettel (NAT / Port Forwarding)

Trỏ về `192.168.168.103`, cùng số cổng ngoài và trong:

| Cổng | Giao thức | Dùng cho |
| --- | --- | --- |
| 443 | TCP | NPM (đã mở) |
| 7881 | TCP | LiveKit: media qua TCP |
| 7882 | UDP | LiveKit: media chính |
| 3478 | UDP | TURN |

Không mở 5100–5102, 81 (quản trị NPM), 9443 (Portainer), 5432 ra Internet.

## 4. Lấy code và tạo `.env`

Docker cài qua Snap chỉ đọc được file trong thư mục home, nên đặt repo ở `~/vt-sys`:

```bash
cd ~ && git clone https://github.com/vuongtruong97/vt-sys.git && cd vt-sys
cp .env.example .env
```

Tạo secret ngẫu nhiên:

```bash
for k in POSTGRES_PASSWORD JWT_SECRET WHITEBOARD_SECRET LIVEKIT_API_SECRET; do echo "$k=$(openssl rand -hex 32)"; done
```

Sửa `.env` (`nano .env`), tối thiểu:

```ini
POSTGRES_PASSWORD=<từ lệnh trên>
JWT_SECRET=<từ lệnh trên>
WHITEBOARD_SECRET=<từ lệnh trên>
LIVEKIT_API_KEY=bangden
LIVEKIT_API_SECRET=<từ lệnh trên>
APP_DOMAIN=hoc.chapter97.xyz
LIVE_DOMAIN=live.chapter97.xyz
BOARD_DOMAIN=board.chapter97.xyz
SEED_TEACHER_EMAIL=<email thật của giáo viên>
SEED_TEACHER_PASSWORD=<mật khẩu mạnh>
SEED_TEACHER_NAME=<tên giáo viên>
CLOUDFLARE_API_TOKEN=<token ở bước 2>
```

- `LIVEKIT_API_KEY` phải trùng `webhook.api_key` trong `deploy/livekit.homelab.yaml` (đang là `bangden`).
- `LIVE_DOMAIN` phải trùng `turn.domain` trong `deploy/livekit.homelab.yaml` (đang là `live.chapter97.xyz`).
- Tài khoản `SEED_TEACHER_EMAIL` là quản trị viên.

Tuỳ chọn: `S3_*` (Cloudflare R2, để tải tài liệu lên), `RESEND_API_KEY` (email nhắc lịch), `GOOGLE_CLIENT_ID`/`SECRET` (đăng nhập Google; Authorized redirect URI là `https://hoc.chapter97.xyz/api/auth/google/callback`). Bỏ trống thì tính năng tương ứng ẩn.

## 5. Build và chạy

Đặt alias cho gọn (thêm vào `~/.bashrc`):

```bash
echo "alias dc='sudo docker compose -f $HOME/vt-sys/deploy/docker-compose.homelab.yml --env-file $HOME/vt-sys/.env'" >> ~/.bashrc && source ~/.bashrc
```

Build **từng image một** (máy 3,8 GB RAM; `next build` cần khoảng 1–1,5 GB). Lần đầu mất 10–20 phút:

```bash
dc build api && dc build whiteboard && dc build web
```

Chạy, kèm dịch vụ tự cập nhật IP:

```bash
dc --profile ddns up -d
dc ps
dc logs -f api   # chờ dòng "API chạy ở cổng 3001", Ctrl+C để thoát
```

Kiểm tra từ VM trước khi cấu hình NPM:

```bash
curl -sI http://192.168.168.103:5100 | head -1   # web: HTTP/1.1 200
curl -s  http://192.168.168.103:5101; echo        # livekit: OK
```

Dọn bộ nhớ đệm build (giải phóng 2–3 GB):

```bash
sudo docker builder prune -f
```

## 6. Nginx Proxy Manager

**Chứng chỉ** (SSL Certificates → Add → Let's Encrypt). Nếu đã có chứng chỉ `*.chapter97.xyz`, dùng lại. Nếu chưa: Domain names `chapter97.xyz`, `*.chapter97.xyz`; bật **Use a DNS Challenge**, chọn **Cloudflare**, dán `dns_cloudflare_api_token = <token>`. Không cần mở cổng 80.

**Proxy Hosts** (Hosts → Proxy Hosts → Add Proxy Host), giống cách các host hiện có đang làm:

| Domain Names | Scheme | Forward Hostname / IP | Forward Port | Websockets Support |
| --- | --- | --- | --- | --- |
| `hoc.chapter97.xyz` | http | `192.168.168.103` | 5100 | bật |
| `live.chapter97.xyz` | http | `192.168.168.103` | 5101 | **bắt buộc bật** |
| `board.chapter97.xyz` | http | `192.168.168.103` | 5102 | **bắt buộc bật** |

Cả ba: tab SSL chọn chứng chỉ `*.chapter97.xyz`, bật **Force SSL** và **HTTP/2 Support**.

Tab **Advanced** của `live.` và `board.`: giữ kết nối lâu (lớp học kéo dài cả buổi):

```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

Nếu tải tài liệu lên báo lỗi `413 Request Entity Too Large`, thêm vào tab Advanced của `hoc.` (API giới hạn mỗi file 50 MB, `MAX_MATERIAL_MB`):

```nginx
client_max_body_size 60m;
```

## 7. Mạng trong nhà (AdGuard)

Nếu router không hỗ trợ NAT loopback, máy trong nhà mở `hoc.chapter97.xyz` sẽ không vào được (gói tin đi ra IP công khai rồi không quay về). Sửa bằng AdGuard: Filters → DNS rewrites → thêm 3 dòng `hoc.chapter97.xyz`, `live.chapter97.xyz`, `board.chapter97.xyz` → `192.168.168.103`.

Video của máy trong nhà vẫn chạy vì LiveKit gửi cả địa chỉ IP LAN cho trình duyệt.

## 8. Kiểm tra

1. `https://hoc.chapter97.xyz` hiện trang chủ, có ổ khoá.
2. Đăng nhập bằng `SEED_TEACHER_EMAIL`; tạo khoá học và một buổi học bắt đầu ngay.
3. Vào lớp bằng **điện thoại dùng 4G** (ngoài mạng nhà) và một máy tính: thấy và nghe nhau. Mở `chrome://webrtc-internals` để xem kết nối dùng UDP.
4. Mở bảng trắng, vẽ ở cả hai máy.
5. Rời lớp, xem Điểm danh có dữ liệu (webhook chạy).
6. `sudo docker stats --no-stream`: không dịch vụ nào chạm giới hạn RAM.

## 9. Vận hành

**Sao lưu** DB mỗi đêm (crontab của root, vì Docker cần sudo):

```bash
mkdir -p ~/backups/bangden && sudo crontab -e
```

Thêm dòng:

```
15 3 * * * COMPOSE_FILE_NAME=docker-compose.homelab.yml BACKUP_DIR=/home/vuongtq/backups/bangden /home/vuongtq/vt-sys/deploy/backup.sh >> /home/vuongtq/backups/bangden.log 2>&1
```

Giữ 14 bản gần nhất. Nên chép thư mục `~/backups` sang nơi khác (Google Drive qua `rclone`, hoặc Proxmox Backup Server), cộng với snapshot VM định kỳ.

**Cập nhật phiên bản mới:**

```bash
cd ~/vt-sys && git pull
dc build api && dc build whiteboard && dc build web
dc --profile ddns up -d
sudo docker builder prune -f
```

API tự áp migration DB khi khởi động. Nên chụp snapshot VM trước mỗi lần cập nhật.

**Xem log, khởi động lại:** `dc logs -f <dịch vụ>`, `dc restart <dịch vụ>`. Portainer cũng thấy các container trong stack `bangden` (chỉ nên dùng để xem; build và cập nhật làm bằng lệnh trên).

## 10. Bảo mật trang quản trị NPM

Nếu NPM có Proxy Host trỏ vào chính trang quản trị của nó (ví dụ `proxy.chapter97.xyz` → cổng 81), ai biết địa chỉ cũng thấy trang đăng nhập NPM; đoán được mật khẩu là kiểm soát được mọi tên miền và chứng chỉ. Chọn một:

- **Access List** (Access Lists → Add): chỉ cho IP mạng nhà và Tailscale (`192.168.168.0/24`, `100.64.0.0/10`), gán vào Proxy Host đó.
- Hoặc xoá Proxy Host đó, chỉ vào NPM qua Tailscale bằng `http://192.168.168.103:81`.

Áp dụng tương tự cho các trang quản trị khác đang mở ra Internet (AdGuard, Portainer).

## 11. Giới hạn của cấu hình này

- Lớp tối đa 30 người (`max_participants` trong `livekit.homelab.yaml`). Thực tế 2 nhân CPU thoải mái với khoảng 15 người; tăng VM lên 4 nhân trong Proxmox nếu lớp đông hơn.
- Không ghi hình, không phát trực tiếp. Muốn bật: nâng RAM VM lên ≥ 8 GB, thêm dịch vụ `egress` (xem `deploy/docker-compose.prod.yml`) và đặt `RECORDING_ENABLED=true`.
- Mất điện, mất mạng ở nhà là lớp dừng. AdGuard cùng VM: VM tắt thì mạng nhà mất DNS nếu router dùng AdGuard; đặt DNS dự phòng trên router.
- NPM là điểm hỏng duy nhất: NPM dừng thì không ai vào thêm được (lớp đang diễn ra vẫn tiếp tục vì video không qua NPM).

## Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân hay gặp |
| --- | --- |
| NPM báo 502 Bad Gateway | Container chưa chạy (`dc ps`), hoặc cổng trong NPM sai so với `WEB_PORT`/`LIVEKIT_HTTP_PORT`/`BOARD_PORT` |
| `port is already allocated` khi `up` | Cổng 5100–5102 đã có ứng dụng khác; đổi cổng trong `.env` và trong NPM |
| Không vào được lớp ("không kết nối được") | Proxy Host `live.` chưa bật Websockets Support |
| Vào lớp được nhưng không thấy video ai | Router chưa mở 7882/udp, 7881/tcp; hoặc `live` đang bật proxy Cloudflare |
| Video chạy trong nhà, ngoài 4G thì không | Port forward hoặc CGNAT (bước 1) |
| Bảng trắng không kết nối | Proxy Host `board.` chưa bật Websockets Support |
| Học viên bị rớt lớp đều đặn sau khoảng 1 phút | Thiếu `proxy_read_timeout` ở tab Advanced của `live.`/`board.` |
| Lỗi 403 khó hiểu khi thao tác | Tắt **Block Common Exploits** của `hoc.` |
| Tải tài liệu báo 413 | Thêm `client_max_body_size 60m;` ở tab Advanced của `hoc.` |
| `permission denied ... docker.sock` | Thiếu `sudo` (Docker Snap) |
| Container khởi động lại liên tục, log có `OOM` | Chạm giới hạn RAM; xem `sudo docker stats`, tăng `mem_limit` của dịch vụ đó |
