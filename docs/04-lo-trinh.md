# 04 · Trạng thái và lộ trình

## Trạng thái hiện tại

| Hạng mục | Trạng thái |
| --- | --- |
| Code giai đoạn 1 (api, web, whiteboard, compose) | Xong |
| Giai đoạn 2 (phần không cần dịch vụ ngoài + ghi hình, tài liệu, nhắc lịch) | Xong về code; xem bảng giai đoạn 2 bên dưới |
| Giai đoạn 3 (quản trị, chia nhóm, webinar) | Xong về code; thanh toán, gói học, AI chưa làm |
| Build (`npm ci`, `tsc`, `next build`) | **Qua** trên Node 22/24, cả ba app; có `package-lock.json` |
| Kiểm thử tự động | 41 test Jest cho API (`cd apps/api && npm test`), chạy không cần DB |
| Khởi động API | Đã thử: mọi module và route khởi tạo được, chỉ dừng ở bước kết nối DB khi không có Postgres |
| Schema | Prisma migrate (`prisma/migrations/`), API chạy `migrate deploy` khi khởi động |
| Chạy thử bằng Docker Compose trên máy | **Chưa**: máy phát triển chưa chạy được Docker Desktop lúc viết |
| Triển khai VPS | Có cấu hình trong `deploy/`, chưa chạy thử |

## Việc cần làm ngay

Theo thứ tự:

1. **Chạy `docker compose up --build`** và sửa lỗi lúc chạy (cái mà build không bắt được: kết nối giữa các dịch vụ, cookie qua rewrite, webhook).
2. **Kiểm thử thủ công** theo [02-phat-trien.md](02-phat-trien.md#kiểm-thử-thủ-công-một-buổi-học): 2–3 trình duyệt, đủ các chức năng, gồm chat, câu hỏi nhanh, tài liệu và ghi hình.
3. **Kiểm tra ghi hình** (cần `node_ip` là IP LAN, xem mục dưới): bắt đầu, dừng, chờ trạng thái READY, mở "Xem lại".
4. Viết test Playwright cho luồng đăng nhập → vào lớp → chat, khi đã có môi trường chạy được.
5. Triển khai VPS theo [03-trien-khai-vps.md](03-trien-khai-vps.md) và dạy thử một buổi thật.

### DB đã tạo bằng `db push` trước đây

Bản cũ đồng bộ schema bằng `prisma db push`, không có lịch sử migration. Với DB như vậy, đánh dấu migration đầu là đã áp dụng một lần rồi khởi động lại API:

```bash
docker compose run --rm api npx prisma migrate resolve --applied 0_init
```

DB mới tạo (volume trống) thì không cần bước này.

### Lỗi đã sửa khi build lần đầu

- `livekit-server-sdk` 2.7 chỉ có bản ESM, còn API biên dịch ra CommonJS. Node 20 không `require` được gói ESM nên API sẽ sập khi khởi động. Dockerfile đã chuyển sang `node:22-bookworm-slim` (Node 22.12+ hỗ trợ `require(esm)`). **Không hạ về Node 20.**
- Next.js 14.2.15 có lỗ hổng bảo mật, đã nâng lên 14.2.35.

## Điểm cần kiểm tra kỹ khi chạy thử

- **Giao diện phòng học:** các lớp CSS trong `app/globals.css` (phần "Phòng học") ghi đè biến `--lk-*` của `@livekit/components-styles`. Bố cục `.stage`, `.focus`, `.strip` có thể cần chỉnh khi thấy giao diện thật, nhất là trên điện thoại.
- **Giơ tay:** dựa vào `RoomEvent.ParticipantAttributesChanged` và `localParticipant.setAttributes`. Cần LiveKit server 1.8 trở lên (compose đang dùng 1.8.0).
- **Quyền chia sẻ màn hình của học viên:** sau khi giáo viên tắt quyền, LiveKit gỡ track màn hình của học viên. Phía client còn có `useEffect` trong `Classroom.tsx` để tắt chia sẻ. Kiểm tra cả hai chiều bật/tắt.
- **Webhook:** LiveKit gửi `Content-Type: application/webhook+json`; `main.ts` đã khai báo body parser cho kiểu này và bật `rawBody` để kiểm tra chữ ký.
- **Cookie qua rewrite:** đăng nhập phải đặt được cookie `bd_session` khi đi qua `/api/*` của Next.js.
- **Múi giờ:** API định dạng giờ theo `Asia/Ho_Chi_Minh`. Ô nhập giờ ở trang tạo buổi học dùng giờ của máy người dùng.
- **Ghi hình trên máy:** egress chạy trong container, kết nối media tới `rtc.node_ip`. Với `node_ip: 127.0.0.1`, egress gọi vào chính nó nên không nhận được video. Muốn thử ghi hình, đổi `node_ip` trong `livekit.yaml` sang IP LAN của máy (như khi thử bằng điện thoại).
- **Ghi hình trên VPS:** egress gọi tới IP công khai của chính VPS (hairpin NAT). Thường chạy được với Docker; nếu bản ghi FAILED với lỗi kết nối, chạy egress với `network_mode: host`.
- **Phiên bản egress:** compose dùng `livekit/egress:v1.8.6` cho hợp với LiveKit server 1.8.0. Nâng LiveKit server thì nâng egress cùng lúc.
- **Chữ ký link tải:** `S3_PUBLIC_ENDPOINT` phải là địa chỉ trình duyệt mở được (trên máy là `http://localhost:9000`); chữ ký gắn với host nên không thay host trong URL sau khi ký.
- **Tải tài liệu lên:** đi qua Next.js rewrite rồi tới API (multipart, tối đa `MAX_MATERIAL_MB`, mặc định 50 MB, giữ trong RAM). Kiểm tra file lớn đi qua rewrite trọn vẹn.

## Khác biệt so với thiết kế

| Thiết kế | Code hiện tại | Lý do |
| --- | --- | --- |
| Auth.js, đăng nhập Google | Email + mật khẩu, JWT tự ký | Chạy được ngay trên máy, không cần tạo OAuth client. Thêm Google ở giai đoạn sau |
| tldraw hoặc Excalidraw | Canvas vẽ phấn tự viết trên Yjs | Ít phụ thuộc, dễ kiểm soát đồng bộ. Có thể thay bằng tldraw nếu cần hình khối, chữ |
| Redis, BullMQ | Redis chỉ cho LiveKit + Egress; nhắc lịch không dùng BullMQ | Nhắc lịch quét DB mỗi phút, bảng `reminders` chống gửi trùng: đơn giản hơn, không mất việc khi Redis khởi động lại |
| Chat qua data channel | Chat đi qua API (`POST /sessions/:id/chat`), API lưu rồi phát xuống phòng | Người vào muộn thấy lịch sử; tên người gửi do server xác định |
| Trang `/recordings/[id]` | Trang `/sessions/[id]` gom bản ghi và tài liệu của buổi | Học viên có một chỗ để xem lại cả hai |
| MinIO cho S3 trên máy | RustFS | MinIO đã ngừng phát hành image cộng đồng |
| Prometheus, Grafana, Sentry | Chưa có | Còn lại của giai đoạn 2 |

## Giai đoạn 2: trước và sau giờ học

| Việc | Trạng thái | Ghi chú, file |
| --- | --- | --- |
| Ghi hình | **Xong** (code) | Egress RoomComposite → MP4 lên S3/R2; webhook `egress_*`. `recording.service.ts`, `media.module.ts`. Chưa chạy thử thật |
| Xem lại bản ghi | **Xong** | `/sessions/[id]`, link ký có hạn 4 giờ |
| Lưu chat | **Xong** | `interaction.module.ts`, `components/room/interaction.ts` |
| Nhắc lịch | **Xong** (email) | `reminder.module.ts`, Resend. Zalo OA chưa làm |
| Tài liệu theo buổi | **Xong** | Tài liệu chung của khoá hoặc theo buổi; tab Tài liệu trong phòng |
| Câu hỏi nhanh | **Xong** | Trắc nghiệm có đáp án hoặc thăm dò; kết quả trực tiếp cho giáo viên |
| Kiểm thử tự động | **Một phần** | Jest cho API: chat, câu hỏi nhanh, ghi hình, nhắc lịch, chia nhóm, webinar. Chưa có Playwright |
| Giám sát | Chưa | Prometheus lấy metrics LiveKit (`prometheus_port`), Grafana, Sentry cho web/API |
| Kiểm thử tải | Chưa | `lk load-test` với 30 người giả lập trên VPS thật |

## Giai đoạn 3: kinh doanh và quy mô

| Việc | Trạng thái | Ghi chú, file |
| --- | --- | --- |
| Nhiều giáo viên, quản trị | **Xong** (code) | Vai trò ADMIN, trang `/admin`: đổi vai trò, chuyển khoá học. `admin.module.ts` |
| Chia nhóm nhỏ | **Xong** (code) | Phòng con `<roomName>-g<n>`, `breakout.module.ts`, `components/room/Breakout.tsx`. Chưa chạy thử với nhiều trình duyệt |
| Webinar HLS | **Xong** (code) | Egress HLS → S3 → API chuyển tiếp (có header cho CDN), trang `/live/[id]`. Chưa chạy thử thật |
| Meeting độc lập (kiểu Google Meet) | **Xong** | `/meet`: họp ngay hoặc hẹn giờ, khách vào qua phòng chờ. `meetings.module.ts`, migration `8_meetings`. Đã chạy thử tạo, duyệt, vào, huỷ qua API; chưa thử có video thật. Chưa có tài liệu, ghi hình, phát trực tiếp trong meeting |
| Phông nền camera | **Xong** | Làm mờ, ảnh có sẵn, ảnh tự tải; chọn trước khi vào và trong phòng. `components/room/BackgroundPicker.tsx`, `lib/videoEffect.ts`. Đã thử bằng luồng video giả (canvas); chưa thử với camera thật và trên điện thoại |
| Cửa sổ thu nhỏ (máy tính) | **Xong** | Document PiP, `components/room/MiniWindow.tsx`. Đã thử portal và chép CSS sang document khác; chưa thử mở cửa sổ thật có video (trình duyệt trong app không mở được cửa sổ) |
| GeoGebra: lưu và mở bài | **Xong** | `/ggb`, `ggb.module.ts`, migration `9_ggb_documents`. Nhúng GeoGebra Classic từ CDN (đổi sang tự host bằng `NEXT_PUBLIC_GGB_SRC`, `NEXT_PUBLIC_GGB_CODEBASE`). Dùng theo giấy phép phi thương mại của GeoGebra: thu học phí thì phải ký hợp đồng với GeoGebra (office@geogebra.org) |
| GeoGebra trong phòng học | Đang làm | Bảng GeoGebra đồng bộ qua Hocuspocus, chỉ giáo viên vẽ |
| Thanh toán (VietQR + SePay/Casso) | Chưa | Cần tài khoản SePay/Casso và tài khoản ngân hàng thật |
| Gói học (theo khoá, số buổi, tháng; 1-1) | Chưa | Phụ thuộc thanh toán |
| Chép lời, tóm tắt bằng AI | Chưa | Cần dịch vụ nhận dạng giọng nói tiếng Việt (chạy trên bản ghi MP4) và một mô hình ngôn ngữ để tóm tắt |

### Điểm cần kiểm tra kỹ (giai đoạn 3)

- **Chuyển phòng khi chia nhóm:** trình duyệt gắn lại `LiveKitRoom` với `key={token}`, cờ `switching` chặn màn hình "Bạn đã rời lớp" trong 1,5 giây. Kiểm tra trên mạng chậm: nếu phòng cũ ngắt kết nối muộn hơn, tăng thời gian chờ trong `app/room/[id]/page.tsx`.
- **Điểm danh khi chia nhóm:** mỗi lần chuyển phòng là một cặp rời/vào, nên cột "Số lần vào" tăng; tổng số phút vẫn đúng.
- **Bảng trắng và ghi hình** chỉ ở phòng chính; bản ghi không có nội dung các nhóm.
- **Tên file HLS:** API giả định Egress đặt playlist và đoạn video cùng thư mục với `filenamePrefix` (`live/<id>/<thời điểm>/`). Nếu trang xem báo "Luồng chưa sẵn sàng" mãi, xem đường dẫn thật trên bucket và sửa `live.service.ts`.
- **Webinar riêng tư** không được CDN cache (`Cache-Control: private`), mọi người xem đều tải từ VPS.
- **Đổi vai trò:** mọi guard đọc vai trò trong DB nên cấp/thu quyền có hiệu lực ngay với API; giao diện đổi theo ở lần tải trang tiếp theo (qua `/auth/me`).
- **Đếm đăng nhập sai** nằm trong RAM của tiến trình API: khởi động lại API là xoá; chạy nhiều bản API thì chuyển sang Redis. Giới hạn số lần gọi của `@nestjs/throttler` cũng lưu trong RAM.

## Ghi chú cho người làm tiếp

- Tài liệu thiết kế gốc nằm ngoài repo (xem [README](README.md#tài-liệu-thiết-kế-gốc)). Chỗ nào làm khác thiết kế thì ghi vào bảng "Khác biệt so với thiết kế" ở trên.
- Sau mỗi giai đoạn, cập nhật bảng "Trạng thái hiện tại".
