# CLAUDE.md

Hướng dẫn cho trợ lý AI làm việc trong repo này. Tài liệu đầy đủ ở `docs/` (bắt đầu từ `docs/README.md`).

## Dự án

Bảng Đen: website dạy học trực tuyến cho một giáo viên (video nhiều người, chia sẻ màn hình, bảng trắng, phòng chờ, điểm danh). Chủ dự án là lập trình viên, giao tiếp bằng tiếng Việt.

## Cấu trúc

- `apps/api`: NestJS 10 + Prisma 5 + `livekit-server-sdk` ~2.7. Biên dịch bằng `tsc` (không dùng nest-cli). Mỗi module nằm gọn trong một file `*.module.ts` gồm DTO, service và controller. Cần Node 22.12+ (SDK chỉ có ESM, API là CommonJS).
- `apps/web`: Next.js 14 App Router, toàn bộ trang là client component, gọi API qua `lib/api.ts` (`/api/*` rewrite sang API). Phòng học dùng `@livekit/components-react` ~2.6.
- `apps/whiteboard`: Hocuspocus 2 (JavaScript ESM), lưu Yjs vào bảng `whiteboards`.
- `deploy/`: compose, Caddy, LiveKit cho VPS. `docker-compose.yml` ở gốc dùng để chạy trên máy.

## Lệnh

```bash
docker compose up --build                                  # chạy toàn bộ trên máy
cd apps/api && npm run build && npm test                   # prisma generate + tsc; Jest không cần DB
cd apps/web && npm run typecheck && npm run build
docker compose exec postgres psql -U bangden               # vào DB
```

## Quy ước

- Chuỗi hiển thị cho người dùng và thông báo lỗi viết bằng tiếng Việt, nói rõ chuyện gì xảy ra.
- Mọi endpoint mới phải kiểm tra quyền: `@UseGuards(AuthGuard | TeacherGuard)`; thao tác trên buổi học dùng `ClassroomService.requireTeacher` / `roleOf`.
- DTO luôn có decorator `class-validator` (ValidationPipe bật `whitelist`, thuộc tính không khai báo sẽ bị bỏ).
- Không đưa API secret của LiveKit ra client. Quyền trong phòng chỉ cấp qua token hoặc `RoomServiceClient` phía API.
- `identity` trong LiveKit = `users.id`; vai trò nằm trong metadata `{"role":"teacher"|"student"}`; metadata phòng là `{"board","allowStudentShare","recording"}`.
- Tin dữ liệu do server phát (chat, quiz, breakout) đi qua API rồi `LivekitService.broadcast`; client không tự phát những chủ đề này. Tin gửi cả lớp dùng `ClassroomService.rooms(s)` để tới cả các phòng nhóm.
- Giao diện mới dùng `apps/web/components/ui` (dựng từ Figma, xem README.md trong đó); không thêm class rời vào `globals.css`. Màu, cỡ chữ, bo góc lấy từ biến `--ui-*` trong `tokens.css`.
- Vai trò: ADMIN ⊃ TEACHER. Kiểm tra "là giáo viên" bằng `role !== 'STUDENT'`, không so sánh `=== 'TEACHER'`.
- Schema dùng Prisma migrate: sửa `schema.prisma` thì thêm thư mục mới trong `prisma/migrations/` (API chạy `migrate deploy` khi khởi động). Không sửa migration đã commit.
- File lưu qua `StorageService` (S3/R2); không để bucket công khai, link tải là URL ký có hạn.
- Cập nhật `docs/` khi thay đổi kiến trúc, biến môi trường, API hoặc cách triển khai.

## Lưu ý

- Cả ba app đã build được và có `package-lock.json`; Dockerfile dùng `npm ci`. Thêm thư viện thì commit lockfile cùng lúc.
- Chưa chạy thử toàn bộ bằng Docker Compose; xem việc còn lại ở `docs/04-lo-trinh.md`.
