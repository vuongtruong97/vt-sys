# vt-sys · Bảng Đen

Nền tảng dạy học trực tuyến cho giáo viên cá nhân: lớp học video nhiều người, chia sẻ màn hình, bảng trắng chung, phòng chờ duyệt và điểm danh tự động. Từ giai đoạn 2 có thêm: chat lưu lại, câu hỏi nhanh trong lớp, ghi hình và xem lại, tài liệu theo buổi, email nhắc lịch. Giai đoạn 3: nhiều giáo viên với trang quản trị, chia nhóm nhỏ, phát trực tiếp (webinar HLS).

Chạy thử trên máy bằng Docker Compose; trạng thái từng phần xem [docs/04-lo-trinh.md](docs/04-lo-trinh.md).

> **Người mới nhận dự án:** đọc [docs/README.md](docs/README.md) trước. Trong đó có kiến trúc, hướng dẫn cài đặt, triển khai VPS và việc cần làm tiếp.

## Thành phần

| Thư mục | Công nghệ | Việc |
| --- | --- | --- |
| `apps/web` | Next.js 14, `@livekit/components-react` | Trang chủ, đăng nhập, lịch học, quản lý lớp, phòng chờ, phòng học |
| `apps/api` | NestJS 10, Prisma 5, `livekit-server-sdk` | Tài khoản, khoá học, buổi học, cấp token LiveKit, quyền giáo viên, webhook điểm danh, chat, câu hỏi nhanh, ghi hình, tài liệu, nhắc lịch |
| `apps/whiteboard` | Hocuspocus 2, Yjs | Đồng bộ nét vẽ bảng trắng, lưu vào Postgres |
| `livekit` (image) | LiveKit Server 1.8 | SFU: video, âm thanh, chia sẻ màn hình, tin dữ liệu |
| `egress` (image) | LiveKit Egress 1.8 | Ghi hình và phát trực tiếp. **Mặc định tắt**: bật bằng `RECORDING_ENABLED=true` và `--profile recording` |
| `redis` (image) | Redis 7.4 | LiveKit giao việc ghi hình cho egress |
| `s3` (image) | RustFS (tương thích S3) | Lưu bản ghi và tài liệu khi chạy trên máy; VPS dùng Cloudflare R2 |
| `postgres` (image) | PostgreSQL 16 | Dữ liệu chính |

Trình duyệt chỉ gọi `/api/*` trên cùng tên miền với web; Next.js chuyển tiếp sang API, nên cookie đăng nhập là cookie cùng site. Video đi thẳng từ trình duyệt tới LiveKit.

## Chạy thử trên máy

Cần Docker Desktop (hoặc Docker Engine + Compose v2).

```bash
cp .env.example .env        # đổi các secret nếu muốn
docker compose up --build
```

Lần đầu build mất vài phút. Khi log có dòng `API chạy ở cổng 3001`, mở http://localhost:3000.

Với `SEED_DEMO=true`, hệ thống tạo sẵn:

| Tài khoản | Email | Mật khẩu |
| --- | --- | --- |
| Giáo viên, quản trị viên | `giaovien@bangden.local` | `doimatkhau123` |
| 5 học viên | `hocvien1@bangden.local` … `hocvien5@bangden.local` | `hocvien123` |

Kèm khoá "Python cơ bản" với một buổi học bắt đầu sau 5 phút, nên học viên vào lớp được ngay.

### Thử một buổi học

1. Cửa sổ thường: đăng nhập giáo viên → **Lịch học** → **Mở lớp**.
2. Cửa sổ ẩn danh (hoặc trình duyệt khác): đăng nhập `hocvien1@bangden.local` → **Vào lớp**.
3. Cửa sổ ẩn danh thứ hai: **đăng ký** một tài khoản mới rồi mở cùng link phòng (`/room/<id>`). Người này vào phòng chờ, giáo viên thấy yêu cầu ở tab **Học viên** và bấm **Cho vào**.
4. Thử chia sẻ màn hình, bảng trắng, giơ tay → giáo viên **Mời phát biểu**, tắt mic, bật quyền chia sẻ cho học viên.
5. Thử chat, tab **Câu hỏi** (giáo viên) và tab **Tài liệu**.
6. Rời lớp, rồi xem **Điểm danh** và **Xem lại** của buổi đó.

Ghi hình trên máy cần đổi `rtc.node_ip` trong `livekit.yaml` sang IP LAN, xem [docs/02-phat-trien.md](docs/02-phat-trien.md#thử-ghi-hình-trên-máy).

### Thử bằng điện thoại trong cùng Wi-Fi

Trình duyệt chỉ cho dùng camera trên `localhost` hoặc HTTPS. Muốn thử bằng điện thoại, bạn cần HTTPS (ví dụ dùng tunnel như Cloudflare Tunnel cho web), và:

- trong `livekit.yaml`, đổi `rtc.node_ip` thành IP LAN của máy (ví dụ `192.168.1.10`);
- trong `.env`, đổi `LIVEKIT_PUBLIC_URL` và `WHITEBOARD_PUBLIC_URL` sang địa chỉ điện thoại truy cập được, rồi `docker compose up --build web`.

## Chạy từng phần khi phát triển

```bash
docker compose up postgres livekit           # chỉ hạ tầng

cd apps/api && npm install
export DATABASE_URL=postgresql://bangden:bangden_dev_pw@localhost:5432/bangden \
  JWT_SECRET=dev1 WHITEBOARD_SECRET=dev2 LIVEKIT_API_KEY=bangden \
  LIVEKIT_API_SECRET=doi-secret-livekit-nay-dai-it-nhat-32-ky-tu \
  LIVEKIT_URL=http://localhost:7880 LIVEKIT_PUBLIC_URL=ws://localhost:7880 SEED_DEMO=true
npm run build && npm run db:migrate && npm run seed && npm start   # cần Node 22.12+

cd apps/whiteboard && npm install
DATABASE_URL=... WHITEBOARD_SECRET=dev2 npm start

cd apps/web && npm install && npm run dev      # http://localhost:3000
```

Khi chạy API ngoài Docker, webhook điểm danh của LiveKit (`http://api:3001/...` trong `livekit.yaml`) cần đổi thành `http://host.docker.internal:3001/webhooks/livekit`.

## API chính

| Phương thức | Đường dẫn | Ai dùng |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/logout`; GET `/auth/me` | mọi người |
| GET | `/courses/public` | trang chủ |
| GET, POST, PATCH | `/courses`, `/courses/:id` | giáo viên |
| POST, DELETE | `/courses/:id/enrollments` | giáo viên |
| POST | `/courses/:id/sessions`; PATCH `/sessions/:id` | giáo viên |
| GET | `/schedule` | giáo viên, học viên |
| POST | `/sessions/:id/join` → token LiveKit hoặc `waiting` | giáo viên, học viên |
| GET | `/sessions/:id/board-token` | trong lớp |
| GET, POST | `/sessions/:id/join-requests[/:reqId]` | giáo viên |
| POST | `/sessions/:id/mod/{mute,mute-all,remove,allow-share,board}`, `/sessions/:id/end` | giáo viên |
| GET | `/sessions/:id/attendance` | giáo viên |
| GET, POST | `/sessions/:id/chat`, `/sessions/:id/quizzes[/:quizId/{answer,close}]` | trong lớp (tạo/đóng câu hỏi: giáo viên) |
| POST | `/sessions/:id/recording/{start,stop}`; GET `/sessions/:id/recordings`, `/recordings/:id/url` | giáo viên; xem lại: thành viên khoá |
| GET, POST | `/courses/:id/materials`; GET `/materials/:id/url` | thành viên khoá; tải lên: giáo viên |
| POST | `/webhooks/livekit` | LiveKit |

## Cách phân quyền trong phòng

- Token LiveKit do API ký, hạn 10 phút (LiveKit tự gia hạn khi đang kết nối). Metadata của token ghi vai trò.
- Học viên chỉ được phát camera và micro. Quyền chia sẻ màn hình được cấp khi giáo viên bật **Cho phép học viên chia sẻ màn hình**: API cập nhật quyền của từng học viên ngay trên LiveKit.
- Giơ tay là attribute `hand` của người tham gia. **Mời phát biểu** là tin nhắn dữ liệu riêng gửi tới học viên đó; trình duyệt học viên tự hạ tay và bật micro.
- Học viên vào được từ 10 phút trước giờ học đến 30 phút sau giờ kết thúc. Người ngoài danh sách lớp phải chờ duyệt.

## Giới hạn hiện tại

- Chưa chạy thử toàn bộ bằng Docker Compose; build và test đơn vị đã qua (xem [docs/04-lo-trinh.md](docs/04-lo-trinh.md)).
- Nhắc lịch mới có email (Resend), chưa có Zalo.
- Chưa có giám sát (Prometheus, Grafana, Sentry), test Playwright, thanh toán, gói học, tóm tắt bằng AI.

## Đưa lên VPS

Xem [docs/03-trien-khai-vps.md](docs/03-trien-khai-vps.md). Máy chủ tại nhà, đặt sau Nginx Proxy Manager: [docs/05-trien-khai-homelab.md](docs/05-trien-khai-homelab.md). File cấu hình nằm trong `deploy/`.
