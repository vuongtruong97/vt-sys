# 05 · Triển khai lên máy chủ tại nhà (Proxmox VM, sau Nginx Proxy Manager)

Hướng dẫn cho máy chủ cụ thể: VM Ubuntu 22.04 trên Proxmox (máy thật i5-6500T), 2 nhân, 3,8 GB RAM, ổ 30 GB, mạng Viettel 420/422 Mbps, IP LAN `192.168.168.103`. Trên VM đã có Docker (cài qua Snap), Nginx Proxy Manager (NPM) giữ cổng 443, AdGuard Home, Portainer. Tên miền `chapter97.xyz` quản lý DNS trên Cloudflare.

Khác bản VPS ([03-trien-khai-vps.md](03-trien-khai-vps.md)):

| | VPS | Máy chủ tại nhà |
| --- | --- | --- |
| File compose | `deploy/docker-compose.prod.yml` | `deploy/docker-compose.homelab.yml` |
| HTTPS | Caddy trong compose | NPM có sẵn |
| Ghi hình, phát trực tiếp | bật được | tắt (thiếu RAM) |
| Giới hạn RAM | không | có, tổng 2 GB |
| IP | tĩnh | có thể đổi → dịch vụ `ddns` |

## Sơ đồ

```
Internet ──443/tcp──► router ──► VM:443  NPM ─┬─► bangden-web:3000       (chapter97.xyz)
                                               ├─► bangden-livekit:7880   (live.chapter97.xyz, WebSocket)
                                               └─► bangden-board:1234     (board.chapter97.xyz, WebSocket)
Internet ──7881/tcp, 7882/udp, 3478/udp──► router ──► VM ──► livekit (video, âm thanh: không qua NPM)
```

NPM chỉ chuyển được HTTP/WebSocket. Video và âm thanh đi bằng UDP thẳng tới LiveKit, nên router phải mở thêm 3 cổng.

## 1. Kiểm tra trước

Chạy trên VM:

```bash
curl -s https://api.ipify.org; echo
```

So với địa chỉ WAN trong trang quản trị modem Viettel. **Giống nhau** là có IP công khai, đi tiếp. **Khác nhau** là mạng đang dùng NAT chung (CGNAT): gọi Viettel 18008168 xin IP public, nếu không học viên sẽ không vào lớp được.

```bash
sudo docker compose version
sudo ss -tulpn | grep -E ':(7881|7882|3478)\b' || echo "3 cổng LiveKit đang trống"
df -h /
free -h
```

Cần: `docker compose` v2, 3 cổng trống, ổ còn ≥ 10 GB, RAM còn ≥ 2,5 GB. Chụp snapshot VM trong Proxmox trước khi làm tiếp.

## 2. Cloudflare

**DNS** (Cloudflare → `chapter97.xyz` → DNS → Records): 3 bản ghi loại A trỏ về IP nhà (kết quả `curl` ở trên), **đều DNS only (mây xám)**:

| Tên | Bắt buộc DNS only? |
| --- | --- |
| `@` (chapter97.xyz) | không bắt buộc, để DNS only cho đơn giản |
| `live` | **có**: TURN/UDP 3478 không đi qua proxy Cloudflare |
| `board` | không bắt buộc |

Nếu đang có bản ghi `*` (wildcard) bật proxy, bản ghi riêng `live`, `board` sẽ được ưu tiên hơn `*`.

**API token** (dùng cho chứng chỉ SSL và tự cập nhật IP): Cloudflare → My Profile → API Tokens → Create Token → mẫu **Edit zone DNS**, Zone Resources: `chapter97.xyz`. Lưu token, chỉ hiện một lần.

## 3. Router Viettel (NAT / Port Forwarding)

Trỏ về `192.168.168.103`, cùng số cổng ngoài và trong:

| Cổng | Giao thức | Dùng cho |
| --- | --- | --- |
| 443 | TCP | NPM (có thể đã mở) |
| 7881 | TCP | LiveKit: media qua TCP |
| 7882 | UDP | LiveKit: media chính |
| 3478 | UDP | TURN |

Không mở cổng 80, 81 (quản trị NPM), 9443 (Portainer), 5432 ra Internet.

## 4. Lấy code và tạo `.env`

Docker cài qua Snap chỉ đọc được file trong thư mục home, nên đặt repo ở `~/vt-sys`:

```bash
cd ~ && git clone https://github.com/vuongtruong97/vt-sys.git && cd vt-sys
cp .env.example .env
```

Mạng Docker của NPM (container tên `nginx-proxy-manager`):

```bash
sudo docker inspect nginx-proxy-manager --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

- Ra tên khác `bridge` (ví dụ `npm_default`): dùng tên đó cho `NPM_NETWORK`.
- Ra **`bridge`** (mạng mặc định, không cho gọi container bằng tên): tạo mạng riêng và nối NPM vào. NPM không khởi động lại, các trang đang chạy không bị gián đoạn:

  ```bash
  sudo docker network create proxy && sudo docker network connect proxy nginx-proxy-manager
  ```

  Đặt `NPM_NETWORK=proxy`. Nếu sau này tạo lại container NPM (cập nhật trong Portainer), chạy lại `sudo docker network connect proxy nginx-proxy-manager`.

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
DOMAIN=chapter97.xyz
NPM_NETWORK=<tên mạng của NPM>
SEED_TEACHER_EMAIL=<email thật của giáo viên>
SEED_TEACHER_PASSWORD=<mật khẩu mạnh>
SEED_TEACHER_NAME=<tên giáo viên>
CLOUDFLARE_API_TOKEN=<token ở bước 2>
```

`LIVEKIT_API_KEY` phải trùng `webhook.api_key` trong `deploy/livekit.homelab.yaml` (đang là `bangden`). Tài khoản `SEED_TEACHER_EMAIL` là quản trị viên.

Tuỳ chọn: `S3_*` (Cloudflare R2, để tải tài liệu lên), `RESEND_API_KEY` (email nhắc lịch), `GOOGLE_CLIENT_ID`/`SECRET` (đăng nhập Google). Bỏ trống thì tính năng tương ứng ẩn.

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

Dọn bộ nhớ đệm build (giải phóng 2–3 GB):

```bash
sudo docker builder prune -f
```

## 6. Nginx Proxy Manager

Vào giao diện NPM (`http://192.168.168.103:81`, trong mạng nhà hoặc qua Tailscale).

**Chứng chỉ** (SSL Certificates → Add → Let's Encrypt): Domain names `chapter97.xyz`, `*.chapter97.xyz`; bật **Use a DNS Challenge**, chọn **Cloudflare**, dán `dns_cloudflare_api_token = <token>`. Không cần mở cổng 80.

**Proxy Hosts** (Hosts → Proxy Hosts → Add), cả ba đều: Scheme `http`, bật **Websockets Support** và **Block Common Exploits**; tab SSL chọn chứng chỉ vừa tạo, bật **Force SSL** và **HTTP/2**:

| Domain | Forward Hostname | Port |
| --- | --- | --- |
| `chapter97.xyz` | `bangden-web` | 3000 |
| `live.chapter97.xyz` | `bangden-livekit` | 7880 |
| `board.chapter97.xyz` | `bangden-board` | 1234 |

Nếu tải tài liệu lên báo lỗi `413 Request Entity Too Large`, thêm vào tab Advanced của `chapter97.xyz` (API giới hạn mỗi file 50 MB, `MAX_MATERIAL_MB`):

```nginx
client_max_body_size 60m;
```

## 7. Mạng trong nhà (AdGuard)

Nếu router không hỗ trợ NAT loopback, máy trong nhà mở `chapter97.xyz` sẽ không vào được (gói tin đi ra IP công khai rồi không quay về). Sửa bằng AdGuard: Filters → DNS rewrites → thêm 3 dòng `chapter97.xyz`, `live.chapter97.xyz`, `board.chapter97.xyz` → `192.168.168.103`.

Video của máy trong nhà vẫn chạy vì LiveKit gửi cả địa chỉ IP LAN cho trình duyệt.

## 8. Kiểm tra

1. `https://chapter97.xyz` hiện trang chủ, có ổ khoá.
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

## 10. Giới hạn của cấu hình này

- Lớp tối đa 30 người (`max_participants` trong `livekit.homelab.yaml`). Thực tế 2 nhân CPU thoải mái với khoảng 15 người; tăng VM lên 4 nhân trong Proxmox nếu lớp đông hơn.
- Không ghi hình, không phát trực tiếp. Muốn bật: nâng RAM VM lên ≥ 8 GB, thêm dịch vụ `egress` (xem `deploy/docker-compose.prod.yml`) và đặt `RECORDING_ENABLED=true`.
- Mất điện, mất mạng ở nhà là lớp dừng. AdGuard cùng VM: VM tắt thì mạng nhà mất DNS nếu router dùng AdGuard; đặt DNS dự phòng trên router.

## Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân hay gặp |
| --- | --- |
| `network <tên> declared as external, but could not be found` | `NPM_NETWORK` sai tên; xem lại lệnh ở bước 4 |
| NPM báo 502 Bad Gateway | Container chưa chạy (`dc ps`), hoặc NPM và vt-sys không chung mạng |
| Vào lớp được nhưng không thấy video ai | Router chưa mở 7882/udp, 7881/tcp; hoặc `live` đang bật proxy Cloudflare |
| Video chạy trong nhà, ngoài 4G thì không | Port forward hoặc CGNAT (bước 1) |
| Bảng trắng không kết nối | Proxy Host `board` chưa bật Websockets Support |
| `permission denied ... docker.sock` | Thiếu `sudo` (Docker Snap) |
| Container bị khởi động lại liên tục, log có `OOM` | Chạm giới hạn RAM; xem `sudo docker stats`, tăng `mem_limit` của dịch vụ đó |
