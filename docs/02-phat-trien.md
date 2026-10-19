# 02 · Phát triển trên máy

## Cài đặt trên máy mới

Cần có:

| Phần mềm | Phiên bản | Dùng cho |
| --- | --- | --- |
| Git | bất kỳ | lấy code |
| Docker Desktop (Windows/macOS) hoặc Docker Engine + Compose v2 (Linux) | Compose ≥ 2.20 | chạy toàn bộ hệ thống |
| Node.js | 20 LTS | chỉ khi chạy từng app ngoài Docker |
| Trình duyệt Chrome hoặc Edge | mới | thử phòng học (cần quyền camera, micro) |

Các bước:

```bash
git clone https://github.com/vuongtruong97/vt-sys.git
cd vt-sys
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
docker compose up --build
```

Lần đầu mất 3–10 phút để tải image và cài thư viện. Xong khi log có các dòng:

```
api-1         | API chạy ở cổng 3001
whiteboard-1  | Máy chủ bảng trắng chạy ở cổng 1234
web-1         | ▲ Next.js 14.2.15 ... Ready
```

Mở http://localhost:3000.

### Tài khoản mẫu (khi `SEED_DEMO=true`)

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Giáo viên | `giaovien@bangden.local` | `doimatkhau123` |
| Học viên | `hocvien1@bangden.local` … `hocvien5@bangden.local` | `hocvien123` |

Seed chỉ chạy dữ liệu mẫu khi giáo viên chưa có khoá học nào. Buổi học mẫu "Buổi 5" bắt đầu 5 phút sau lần khởi động đầu tiên. Nếu nó đã quá giờ, giáo viên tạo buổi mới trong **Quản lý lớp**.

### Kiểm thử thủ công một buổi học

1. Cửa sổ 1: giáo viên → Lịch học → **Mở lớp**.
2. Cửa sổ ẩn danh: `hocvien1@bangden.local` → **Vào lớp**.
3. Một trình duyệt khác: **Đăng ký** tài khoản mới rồi mở cùng URL `/room/<id>`. Người này phải vào phòng chờ; giáo viên thấy yêu cầu ở tab **Học viên** và bấm **Cho vào**.
4. Thử lần lượt:
   - chia sẻ màn hình của giáo viên;
   - bật quyền chia sẻ cho học viên, rồi học viên chia sẻ;
   - mở bảng trắng, vẽ ở cả hai máy;
   - học viên giơ tay, giáo viên **Mời phát biểu**;
   - tắt mic từng người, tắt mic tất cả, mời ra;
   - chat; tải lại trang học viên, tin cũ vẫn còn;
   - giáo viên tab **Câu hỏi** → gửi câu có đáp án đúng; học viên trả lời trên thẻ nổi, đổi ý; giáo viên thấy số liệu chạy, bấm **Đóng và công bố**;
   - tab **Tài liệu**: giáo viên tải file lên, học viên bấm **Mở**;
   - **Ghi hình** → vài phút → **Dừng ghi hình** (cần `node_ip` là IP LAN, xem bên dưới).
5. Giáo viên **Kết thúc buổi học**, rồi mở **Điểm danh** và **Xem lại** (bản ghi, tài liệu) của buổi đó.

### Thử ghi hình trên máy

Ghi hình mặc định tắt. Bật: đặt `RECORDING_ENABLED=true` trong `.env` rồi chạy `docker compose --profile recording up -d` (thêm dịch vụ `egress`).

Egress chạy trong container và kết nối media tới `rtc.node_ip`. Mặc định `127.0.0.1` thì egress không nhận được video. Đổi `node_ip` trong `livekit.yaml` thành IP LAN (ví dụ `192.168.1.10`), rồi `docker compose up -d livekit`. Bản ghi xong nằm trong bucket `bangden` của dịch vụ `s3` (RustFS, cổng 9000).

### Nhắc lịch

Không có `RESEND_API_KEY` thì API chỉ ghi log: `docker compose logs -f api | grep Email`. Tạo một buổi học bắt đầu sau 15 phút cho khoá có học viên, chờ tối đa 1 phút sẽ thấy dòng nhắc lịch.

## Biến môi trường

Tất cả nằm trong `.env` ở thư mục gốc; `docker-compose.yml` truyền vào từng app.

| Biến | App | Ý nghĩa | Mặc định trong `.env.example` |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | postgres, api, whiteboard | Mật khẩu DB | `bangden_dev_pw` |
| `JWT_SECRET` | api | Ký cookie đăng nhập | đổi thành chuỗi ngẫu nhiên |
| `WHITEBOARD_SECRET` | api, whiteboard | Ký token bảng trắng; hai app phải giống nhau | đổi thành chuỗi ngẫu nhiên |
| `LIVEKIT_API_KEY` | livekit, api | Tên khoá. **Phải trùng `webhook.api_key` trong `livekit.yaml`** | `bangden` |
| `LIVEKIT_API_SECRET` | livekit, api | Secret, ít nhất 32 ký tự | đổi |
| `LIVEKIT_PUBLIC_URL` | api | URL trình duyệt kết nối LiveKit | `ws://localhost:7880` |
| `WHITEBOARD_PUBLIC_URL` | web (lúc build) | URL trình duyệt kết nối bảng trắng | `ws://localhost:1234` |
| `SEED_TEACHER_EMAIL`, `SEED_TEACHER_PASSWORD`, `SEED_TEACHER_NAME` | api | Tài khoản giáo viên tạo lúc khởi động | xem file |
| `SEED_DEMO` | api | `true` thì tạo dữ liệu mẫu | `true` |
| `COOKIE_SECURE` | api | `true` khi chạy sau HTTPS | `false` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | api | Đăng nhập bằng Google. Tạo OAuth client loại "Web application" trong Google Cloud Console, thêm URI chuyển hướng `<APP_URL>/api/auth/google/callback` (trên máy: `http://localhost:3000/api/auth/google/callback`). Google không nhận IP LAN nên thử bằng điện thoại phải qua tên miền thật | trống (ẩn nút Google) |
| `TRUST_PROXY` | api | Số lớp `X-Forwarded-For` được tin để lấy IP thật cho giới hạn số lần gọi. Giữ 1: Next.js chỉ đặt header khi chưa có, trên VPS Caddy ghi đè bằng IP thật. Chạy trên máy không có Caddy thì giả được IP, chỉ chấp nhận khi phát triển | không đặt (mặc định 1) |
| `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | s3, api, s3-init | Nơi lưu bản ghi và tài liệu. Bỏ trống `S3_BUCKET` thì hai tính năng này tắt | `bangden`, xem file |
| `S3_ENDPOINT`, `S3_REGION` | api (chỉ VPS) | Địa chỉ R2/S3. Trên máy compose đặt sẵn `http://s3:9000` | trống, `auto` |
| `RESEND_API_KEY`, `EMAIL_FROM` | api | Gửi email nhắc lịch. Bỏ trống thì chỉ ghi log | trống |

Biến cố định trong compose: `LIVEKIT_URL=http://livekit:7880` (API gọi RoomService), `API_INTERNAL_URL=http://api:3001` (web rewrite, đặt lúc build), `S3_ENDPOINT=http://s3:9000` và `S3_PUBLIC_ENDPOINT=http://localhost:9000` (trình duyệt mở link tải), `APP_URL` (link trong email), `TZ=Asia/Ho_Chi_Minh`.

Chạy app ngoài Docker cần **Node 22.12 trở lên**: `livekit-server-sdk` chỉ có bản ESM và API (CommonJS) cần `require(esm)`.

**Lưu ý:** `WHITEBOARD_PUBLIC_URL` và `API_INTERNAL_URL` được ghi cứng vào web lúc build. Đổi chúng thì phải `docker compose up --build web`.

## Chạy từng app ngoài Docker (khi sửa code)

Cách này cho hot reload nhanh hơn. Hạ tầng vẫn chạy bằng Docker:

```bash
docker compose up postgres redis livekit s3 s3-init          # thêm egress (--profile recording) nếu cần ghi hình
```

**API** (terminal 1):

```bash
cd apps/api
npm install
cat > .env.local <<'EOF'
DATABASE_URL=postgresql://bangden:bangden_dev_pw@localhost:5432/bangden
JWT_SECRET=dev-jwt
WHITEBOARD_SECRET=dev-board
LIVEKIT_API_KEY=bangden
LIVEKIT_API_SECRET=doi-secret-livekit-nay-dai-it-nhat-32-ky-tu
LIVEKIT_URL=http://localhost:7880
LIVEKIT_PUBLIC_URL=ws://localhost:7880
SEED_DEMO=true
S3_BUCKET=bangden
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=bangden-s3
S3_SECRET_KEY=doi-secret-s3-nay-di
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
EOF
set -a; . ./.env.local; set +a
npm run build && npm run db:migrate && npm run seed
npm start                      # hoặc: npm run dev (tsc --watch) rồi chạy lại npm start
```

**Bảng trắng** (terminal 2):

```bash
cd apps/whiteboard && npm install
DATABASE_URL=postgresql://bangden:bangden_dev_pw@localhost:5432/bangden WHITEBOARD_SECRET=dev-board npm start
```

**Web** (terminal 3):

```bash
cd apps/web && npm install
API_INTERNAL_URL=http://localhost:3001 NEXT_PUBLIC_WHITEBOARD_URL=ws://localhost:1234 npm run dev
```

Khi API chạy ngoài Docker, LiveKit không gọi được `http://api:3001`. Sửa `livekit.yaml` cho máy của bạn (đừng commit thay đổi này):

```yaml
webhook:
  urls:
    - http://host.docker.internal:3001/webhooks/livekit
```

Trên Linux, thêm `extra_hosts: ["host.docker.internal:host-gateway"]` vào service `livekit`.

## Quy trình làm việc

- Nhánh `main` luôn chạy được. Làm việc trên nhánh riêng: `feat/ghi-hinh`, `fix/webhook-diem-danh`.
- Commit nhỏ, mô tả bằng tiếng Việt hoặc tiếng Anh, nói rõ thay đổi gì và vì sao.
- Sửa schema thì sửa `apps/api/prisma/schema.prisma`, rồi tạo migration (cần Postgres đang chạy): `cd apps/api && npm run db:new-migration -- --name ten-thay-doi`. Đọc lại file SQL trong `prisma/migrations/` trước khi commit. API tự áp migration (`prisma migrate deploy`) khi khởi động.
- Thêm endpoint thì kiểm tra quyền bằng `AuthGuard`/`TeacherGuard` và `ClassroomService.requireTeacher`. Mọi DTO phải có `class-validator`, vì `ValidationPipe` đang bật `whitelist`.
- Chuỗi hiển thị cho người dùng viết bằng tiếng Việt, nói rõ việc gì xảy ra và cách sửa.
- Trước khi mở PR: `cd apps/api && npm run build && npm test`, `cd apps/web && npm run typecheck && npm run build`.
- Test API nằm trong `apps/api/test/`, dùng Prisma và LiveKit giả nên không cần DB. Jest không nạp được `livekit-server-sdk` (ESM), nên `jest.config.js` thay nó bằng `test/livekit-stub.ts`.

## Lệnh hay dùng

```bash
docker compose logs -f api                      # xem log một app
docker compose up --build api                   # build lại một app
docker compose exec postgres psql -U bangden    # vào DB
docker compose down                             # dừng (giữ dữ liệu)
docker compose down -v                          # dừng và XOÁ dữ liệu DB
```

Nâng một tài khoản lên giáo viên:

```sql
UPDATE users SET role = 'TEACHER' WHERE email = 'ten@example.com';
```

## Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân hay gặp | Cách sửa |
| --- | --- | --- |
| Vào lớp được nhưng không thấy video người khác, hoặc kẹt "đang kết nối" | Cổng UDP 50000–50100 bị chặn, hoặc `rtc.node_ip` sai | Trên máy: giữ `node_ip: 127.0.0.1`. Thử bằng điện thoại: đổi thành IP LAN. Kiểm tra firewall |
| Đăng nhập xong vẫn bị đẩy về trang đăng nhập | Đặt `COOKIE_SECURE=true` khi đang chạy http | Đặt `false` khi chạy trên máy |
| Điểm danh trống | Webhook không tới API hoặc sai chữ ký | Xem `docker compose logs livekit`. `LIVEKIT_API_KEY` phải trùng `webhook.api_key` |
| API dừng với "Thiếu biến môi trường …" | Thiếu biến trong `.env` | So với `.env.example` |
| LiveKit báo secret quá ngắn | `LIVEKIT_API_SECRET` dưới 32 ký tự | Dùng `openssl rand -hex 32` |
| Bảng trắng "Không kết nối được" | Sai `WHITEBOARD_PUBLIC_URL`, hoặc `WHITEBOARD_SECRET` của api và whiteboard khác nhau | Sửa `.env` rồi `docker compose up --build web whiteboard` |
| Prisma báo thiếu libssl/openssl | Image không có OpenSSL | Dockerfile của API đã cài `openssl`; build lại không dùng cache: `docker compose build --no-cache api` |
| Camera không mở trên điện thoại | Trình duyệt chỉ cho dùng camera trên localhost hoặc HTTPS | Thử qua HTTPS (tunnel) hoặc triển khai lên VPS |
| Học viên báo "Lớp mở cửa lúc …" | Chưa tới 10 phút trước giờ học | Đúng theo thiết kế; đổi `openBeforeMinutes` trong `apps/api/src/common/config.ts` nếu muốn |
