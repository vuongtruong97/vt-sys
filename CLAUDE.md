# CLAUDE.md

Hướng dẫn cho trợ lý AI làm việc trong repo này. Tài liệu đầy đủ ở `docs/` (bắt đầu từ `docs/README.md`).

## Dự án

Bảng Đen: website dạy học trực tuyến cho một giáo viên (video nhiều người, chia sẻ màn hình, bảng trắng, phòng chờ, điểm danh). Chủ dự án là lập trình viên, giao tiếp bằng tiếng Việt.

## Cấu trúc

- `apps/api`: NestJS 10 + Prisma 5 + `livekit-server-sdk` ~2.7. Biên dịch bằng `tsc` (không dùng nest-cli). Mỗi module nằm gọn trong một file `*.module.ts` gồm DTO, service và controller.
- `apps/web`: Next.js 14 App Router, toàn bộ trang là client component, gọi API qua `lib/api.ts` (`/api/*` rewrite sang API). Phòng học dùng `@livekit/components-react` ~2.6.
- `apps/whiteboard`: Hocuspocus 2 (JavaScript ESM), lưu Yjs vào bảng `whiteboards`.
- `deploy/`: compose, Caddy, LiveKit cho VPS. `docker-compose.yml` ở gốc dùng để chạy trên máy.

## Lệnh

```bash
docker compose up --build                                  # chạy toàn bộ trên máy
cd apps/api && npm run build                               # prisma generate + tsc
cd apps/web && npm run typecheck && npm run build
docker compose exec postgres psql -U bangden               # vào DB
```

## Quy ước

- Chuỗi hiển thị cho người dùng và thông báo lỗi viết bằng tiếng Việt, nói rõ chuyện gì xảy ra.
- Mọi endpoint mới phải kiểm tra quyền: `@UseGuards(AuthGuard | TeacherGuard)`; thao tác trên buổi học dùng `ClassroomService.requireTeacher` / `roleOf`.
- DTO luôn có decorator `class-validator` (ValidationPipe bật `whitelist`, thuộc tính không khai báo sẽ bị bỏ).
- Không đưa API secret của LiveKit ra client. Quyền trong phòng chỉ cấp qua token hoặc `RoomServiceClient` phía API.
- `identity` trong LiveKit = `users.id`; vai trò nằm trong metadata `{"role":"teacher"|"student"}`; metadata phòng là `{"board","allowStudentShare"}`.
- Schema đang đồng bộ bằng `prisma db push`; khi thêm migration, cập nhật `apps/api/Dockerfile` và `docs/04-lo-trinh.md`.
- Cập nhật `docs/` khi thay đổi kiến trúc, biến môi trường, API hoặc cách triển khai.

## Lưu ý

- Code giai đoạn 1 chưa từng được build. Gặp lỗi build thì sửa theo phiên bản thư viện thật đã cài, đừng đổi kiến trúc.
- Sau khi `npm install` thành công lần đầu, commit `package-lock.json` của từng app.
