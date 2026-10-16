# 04 · Trạng thái và lộ trình

## Trạng thái hiện tại

| Hạng mục | Trạng thái |
| --- | --- |
| Code giai đoạn 1 (api, web, whiteboard, compose) | Đã viết xong |
| Build (`npm install`, `tsc`, `next build`) | **Chưa chạy lần nào.** Code được viết trong môi trường không tải được thư viện npm |
| Kiểm tra cú pháp TypeScript/JS | Đã qua |
| Đối chiếu API thư viện | Đã đối chiếu với mã nguồn `livekit-server-sdk` 2.7.2, `@livekit/components-react` 2.6.9, `livekit-client` 2.x, Hocuspocus 2.13 |
| Chạy thử trên máy | Chưa |
| Triển khai VPS | Có cấu hình mẫu trong `deploy/`, chưa chạy thử |
| Kiểm thử tự động | Chưa có |

## Việc cần làm ngay

Theo thứ tự:

1. **Build và sửa lỗi.** Chạy `docker compose up --build`. Lỗi có khả năng gặp nhất:
   - lệch kiểu TypeScript với thư viện;
   - thiếu import;
   - Next.js báo lỗi lúc prerender trang client.

   Chạy riêng `npm run build` trong `apps/api` và `npm run typecheck` trong `apps/web` để xem lỗi rõ hơn.
2. **Tạo `package-lock.json`** cho cả ba app sau khi `npm install` thành công, rồi commit, để các lần build sau dùng đúng phiên bản thư viện.
3. **Kiểm thử thủ công** theo [02-phat-trien.md](02-phat-trien.md#kiểm-thử-thủ-công-một-buổi-học): 2–3 trình duyệt, đủ các chức năng.
4. **Chuyển sang Prisma migrate** trước khi có dữ liệu thật:
   ```bash
   cd apps/api
   npx prisma migrate dev --name init     # tạo prisma/migrations/
   ```
   Sau đó trong `apps/api/Dockerfile`, đổi `prisma db push --skip-generate` thành `prisma migrate deploy`.
5. Triển khai VPS theo [03-trien-khai-vps.md](03-trien-khai-vps.md) và dạy thử một buổi thật.

## Điểm cần kiểm tra kỹ khi chạy thử

- **Giao diện phòng học:** các lớp CSS trong `app/globals.css` (phần "Phòng học") ghi đè biến `--lk-*` của `@livekit/components-styles`. Bố cục `.stage`, `.focus`, `.strip` có thể cần chỉnh khi thấy giao diện thật, nhất là trên điện thoại.
- **Giơ tay:** dựa vào `RoomEvent.ParticipantAttributesChanged` và `localParticipant.setAttributes`. Cần LiveKit server 1.8 trở lên (compose đang dùng 1.8.0).
- **Quyền chia sẻ màn hình của học viên:** sau khi giáo viên tắt quyền, LiveKit gỡ track màn hình của học viên. Phía client còn có `useEffect` trong `Classroom.tsx` để tắt chia sẻ. Kiểm tra cả hai chiều bật/tắt.
- **Webhook:** LiveKit gửi `Content-Type: application/webhook+json`; `main.ts` đã khai báo body parser cho kiểu này và bật `rawBody` để kiểm tra chữ ký.
- **Cookie qua rewrite:** đăng nhập phải đặt được cookie `bd_session` khi đi qua `/api/*` của Next.js.
- **Múi giờ:** API định dạng giờ theo `Asia/Ho_Chi_Minh`. Ô nhập giờ ở trang tạo buổi học dùng giờ của máy người dùng.

## Khác biệt so với thiết kế

| Thiết kế | Code hiện tại | Lý do |
| --- | --- | --- |
| Auth.js, đăng nhập Google | Email + mật khẩu, JWT tự ký | Chạy được ngay trên máy, không cần tạo OAuth client. Thêm Google ở giai đoạn sau |
| tldraw hoặc Excalidraw | Canvas vẽ phấn tự viết trên Yjs | Ít phụ thuộc, dễ kiểm soát đồng bộ. Có thể thay bằng tldraw nếu cần hình khối, chữ |
| Redis, BullMQ | Chưa dùng | Giai đoạn 1 chưa có việc chạy nền; một node LiveKit không cần Redis |
| Lưu chat vào `chat_messages` | Chat chỉ trong phiên (data channel của LiveKit) | Để giai đoạn 2 |
| Prometheus, Grafana, Sentry | Chưa có | Để giai đoạn 2 |

## Giai đoạn 2: trước và sau giờ học

| Việc | Gợi ý cách làm | File liên quan |
| --- | --- | --- |
| Ghi hình | Thêm service `livekit/egress` vào compose (cần Redis). API gọi `EgressClient.startRoomCompositeEgress`, lưu MP4 lên R2/S3. Thêm bảng `recordings`; webhook `egress_ended` cập nhật trạng thái | `classroom.module.ts`, `schema.prisma`, compose |
| Xem lại bản ghi | Trang `/recordings/[id]`, URL ký có hạn tới R2 | web mới |
| Lưu chat | Webhook không có nội dung chat: client gửi kèm lên API, hoặc dùng agent/data stream. Đơn giản nhất: `POST /sessions/:id/chat` mỗi lần gửi | `SidePanel.tsx`, API |
| Nhắc lịch | BullMQ + Redis: job 60 phút và 10 phút trước giờ học, gửi email (Resend, SES) hoặc Zalo OA | module Notification mới |
| Tài liệu theo buổi | Bảng `materials`, tải lên R2, hiện trong lịch học và phòng học | |
| Câu hỏi nhanh | Tin dữ liệu chủ đề `quiz` trong phòng, kết quả lưu qua API | `Classroom.tsx` |
| Giám sát | Prometheus lấy metrics LiveKit (`prometheus_port`), Grafana, Sentry cho web/API | compose |
| Kiểm thử tải | `lk load-test` với 30 người giả lập trên VPS thật | |
| Kiểm thử tự động | Jest cho API (service + controller), Playwright cho luồng đăng nhập, vào lớp | |

## Giai đoạn 3: kinh doanh và quy mô

- Thanh toán: VietQR + đối soát chuyển khoản (SePay/Casso) để tự thêm học viên vào khoá khi nhận tiền.
- Gói học: theo khoá, theo số buổi, theo tháng; học 1-1 với lịch trống của giáo viên.
- Chép lời và tóm tắt bằng AI từ bản ghi.
- Chia nhóm nhỏ: tạo phòng LiveKit con, chuyển token.
- Chế độ webinar: Egress phát HLS qua CDN cho lớp hàng nghìn người.
- Nhiều giáo viên: thêm trang quản trị, phân quyền admin.

## Ghi chú cho người làm tiếp

- Tài liệu thiết kế gốc nằm ngoài repo (xem [README](README.md#tài-liệu-thiết-kế-gốc)). Chỗ nào làm khác thiết kế thì ghi vào bảng "Khác biệt so với thiết kế" ở trên.
- Sau mỗi giai đoạn, cập nhật bảng "Trạng thái hiện tại".
