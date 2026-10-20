# 01 · Tổng quan và kiến trúc

## Mục tiêu

Một giáo viên tự dạy lớp trực tuyến trên website của mình, thay cho Zoom hoặc Google Meet:

- lớp từ 1–30 người bật camera (thiết kế cho phép tới khoảng 50);
- chia sẻ màn hình để dạy slide và code;
- quản lý khoá học, lịch học, danh sách học viên, điểm danh;
- về sau: ghi hình, xem lại, tóm tắt bằng AI, thu học phí.

## Kiến trúc

```
                  ┌───────────────────────── Trình duyệt ─────────────────────────┐
                  │  Next.js UI  ·  LiveKit client SDK  ·  Yjs + Hocuspocus provider │
                  └──────┬────────────────────────┬──────────────────────┬─────────┘
                    HTTP │ /api/*            WebRTC│ (UDP, dự phòng TCP)    │ WebSocket
                         ▼                        ▼                      ▼
                 ┌──────────────┐        ┌──────────────────┐   ┌──────────────────┐
                 │ web (Next.js)│        │ livekit (SFU)    │   │ whiteboard       │
                 │ :3000        │        │ :7880 signal     │   │ (Hocuspocus)     │
                 │ rewrite /api │        │ :7881 TCP media  │   │ :1234            │
                 └──────┬───────┘        │ :50000+ UDP media│   └────────┬─────────┘
                        │ proxy           └───┬──────────▲───┘            │ SQL
                        ▼                     │ webhook  │ RoomService    │
                 ┌──────────────┐◄────────────┘          │ (token, mute…) │
                 │ api (NestJS) │────────────────────────┘                │
                 │ :3001        │                                         │
                 └──────┬───────┘                                         │
                        │ Prisma                                          │
                        ▼                                                 ▼
                 ┌─────────────────────────── PostgreSQL :5432 ───────────────────┐
                 └────────────────────────────────────────────────────────────────┘
```

Nguyên tắc chính:

1. **Video không đi qua web hay API.** Trình duyệt kết nối thẳng tới LiveKit, nên tải video không làm chậm web.
2. **API là nơi duy nhất cấp quyền.** Nó kiểm tra tài khoản, danh sách lớp và giờ học, rồi ký token LiveKit có hạn ngắn ghi rõ quyền. Trình duyệt không bao giờ giữ API secret của LiveKit.
3. **Cùng site cho cookie.** Trình duyệt chỉ gọi `/api/*` trên tên miền web; Next.js rewrite sang API. Cookie đăng nhập `bd_session` (httpOnly) vì vậy là cookie cùng site.
4. **Giới hạn số lần gọi.** `@nestjs/throttler` toàn cục: 300 lần/phút mỗi IP; `/auth/login`, `/auth/register`, `/auth/password` chỉ 10 lần/phút. Bỏ qua `/health`, webhook LiveKit và file HLS. IP đọc từ `X-Forwarded-For` theo `TRUST_PROXY`.
5. **Modular monolith.** API là một tiến trình, chia module theo nghiệp vụ, để sau này tách thành dịch vụ riêng nếu cần.

## Các thành phần

### apps/api (NestJS 10, Prisma 5)

| Module | File | Việc |
| --- | --- | --- |
| Auth | `src/auth/auth.module.ts`, `auth.guard.ts` | Đăng ký, đăng nhập (mật khẩu hoặc Google), đổi/đặt mật khẩu, đăng xuất mọi nơi. JWT 7 ngày trong cookie `bd_session` mang `ver` = `users.tokenVersion`; mọi guard (`AuthGuard`, `TeacherGuard`, `AdminGuard`) đọc lại tài khoản trong DB qua `currentUser()`, `ver` lệch thì coi như chưa đăng nhập, vai trò luôn lấy từ DB. Sai mật khẩu 5 lần trong 15 phút thì khoá email đó 15 phút |
| Courses | `src/courses/courses.module.ts` | Khoá học, thêm/xoá học viên bằng email, tạo và huỷ buổi học, lịch học (`/schedule`) |
| Classroom | `src/classroom/classroom.module.ts` | Vào lớp, phòng chờ, quyền giáo viên, token bảng trắng, điểm danh, webhook LiveKit |
| LiveKit | `src/classroom/livekit.service.ts` | Ký token; gọi RoomService để tạo phòng, đổi metadata, tắt mic, mời ra, đổi quyền, phát tin dữ liệu xuống phòng (`broadcast`) |
| Interaction | `src/classroom/interaction.module.ts` | Chat lưu DB rồi phát xuống phòng (chủ đề `chat`); câu hỏi nhanh (chủ đề `quiz`) |
| Ghi hình | `src/classroom/recording.service.ts` | Bắt đầu/dừng LiveKit Egress, cập nhật trạng thái từ webhook `egress_*` |
| Media | `src/classroom/media.module.ts` | API ghi hình, danh sách bản ghi, tải lên và mở tài liệu (link ký có hạn) |
| Nhắc lịch | `src/notifications/reminder.module.ts` | Quét mỗi phút, gửi email nhắc lịch qua Resend |
| Chia nhóm | `src/classroom/breakout.module.ts` | Xếp nhóm, gọi về, nhắn mọi nhóm; phòng nhóm `<roomName>-g<n>` |
| Webinar | `src/classroom/live.service.ts`, `webinar.module.ts` | Egress phát HLS lên S3; API chuyển tiếp playlist và đoạn video cho người xem |
| Quản trị | `src/admin/admin.module.ts`, `src/auth/permissions.ts` | Thống kê, tài khoản, vai trò và quyền (`RolesService`: không trao quyền mình không có, không tự đổi vai trò, luôn còn người quản lý vai trò), khoá học của mọi giáo viên, chuyển khoá. Mỗi endpoint cần quyền riêng qua `PermissionGuard` + `@Need` |
| Common | `src/common/config.ts`, `prisma.service.ts`, `storage.service.ts` | Đọc biến môi trường (thiếu là dừng ngay), kết nối Prisma, lưu file lên S3/R2 |
| Seed | `src/seed.ts` | Tạo tài khoản giáo viên; `SEED_DEMO=true` thì thêm dữ liệu mẫu |

### apps/web (Next.js 14 App Router)

| Đường dẫn | File | Việc |
| --- | --- | --- |
| `/` | `app/page.tsx` | Trang chủ, các khoá học công khai |
| `/login`, `/register` | `components/AuthForm.tsx` | Đăng nhập, đăng ký (tài khoản mới luôn là học viên). Nút Google hiện khi API có `GOOGLE_CLIENT_ID`; lỗi đăng nhập Google hiện qua `?error=` |
| `/account` | `app/account/page.tsx`, `components/AvatarEditor.tsx` | Hồ sơ (bấm tên trên thanh điều hướng): tab Hồ sơ (ảnh đại diện có cắt ảnh, họ tên, số điện thoại, ngày sinh, giới thiệu) và tab Bảo mật (đổi/đặt mật khẩu, đăng xuất mọi nơi) |
| `/schedule` | `app/schedule/page.tsx` | Lịch học; nút "Vào lớp" mở trước giờ học 10 phút |
| `/teach` | `app/teach/page.tsx` | Giáo viên: danh sách khoá học, tạo khoá |
| `/teach/courses/[id]` | `app/teach/courses/[id]/page.tsx` | Buổi học, thêm học viên, công khai khoá |
| `/teach/sessions/[id]` | `app/teach/sessions/[id]/page.tsx` | Bảng điểm danh |
| `/sessions/[id]` | `app/sessions/[id]/page.tsx` | Xem lại buổi học: bản ghi hình và tài liệu (giáo viên và học viên) |
| `/live/[id]` | `app/live/[id]/page.tsx` | Xem phát trực tiếp bằng hls.js; luồng công khai không cần đăng nhập |
| `/admin/site` | `app/admin/site/page.tsx` | Sửa nội dung trang công khai: thương hiệu (tên, logo, favicon, màu chủ đạo), slider đầu trang, các khối trang chủ (bật/tắt, tính năng, các bước, banner), giáo viên, câu hỏi, chân trang, SEO, trang đăng nhập. Tự lưu nháp, Xem trước (`/?preview=1`), Xuất bản, Bỏ nháp. Ảnh thu nhỏ trên trình duyệt trước khi tải |
| `/admin` | `app/admin/page.tsx` | Quản trị: thống kê, vai trò tài khoản, chuyển khoá học |
| `/room/[id]` | `app/room/[id]/page.tsx` | Phòng kiểm tra thiết bị (PreJoin), phòng chờ, phòng học |

Giao diện chung ở `components/ui` theo Figma "Online Learning Landing Page" (Skilline): cam `#F48C06`, navy `#2F327D`, xanh ngọc `#23BDEE`, tiêu đề Be Vietnam Pro, đoạn văn Nunito Sans, chỉ chế độ sáng. Token và các chỗ khác Figma có chủ ý ghi trong `apps/web/components/ui/README.md`. Ảnh mặc định của trang chủ ở `public/ui/skilline/`.

`components/Materials.tsx` và `components/Recordings.tsx` dùng chung cho trang khoá học, trang xem lại và phòng học.

Phòng học nằm trong `components/room/`, giao diện kiểu Google Meet dùng chung `components/meet/` (`meet.css` tiền tố `mt-`, bộ icon SVG `icons.tsx`, hộp thoại `Dialog.tsx`). Bộ mockup cùng kiểu, dữ liệu giả, ở `components/meet-mock/` và trang `/ui/meeting`:

- `Lobby.tsx`: kiểm tra thiết bị trước khi vào (xem trước camera, mức micro, chọn thiết bị bằng hook của LiveKit), chờ duyệt, đã rời lớp, buổi học kết thúc.
- `Stage.tsx`: ô video tự vẽ bằng `VideoTrack` (tên, mic tắt, đang nói, giơ tay), lưới tự chia cột, khung lớn (màn hình chia sẻ, bảng trắng) kèm dải người.
- `Settings.tsx`: hộp thoại đổi micro, loa, camera khi đang học (`useMediaDeviceSelect`).
- `BackgroundPicker.tsx` + `lib/videoEffect.ts`: phông nền camera (không, làm mờ nhẹ/mạnh, ảnh có sẵn trong `public/backgrounds/`, ảnh tự tải). Dùng `@livekit/track-processors` (MediaPipe, tải động; model lấy từ CDN khi bật hiệu ứng lần đầu). Lựa chọn lưu ở localStorage `bd-video-effect`, ảnh tự tải thu về ≤1280×720 lưu ở `bd-video-bg-custom`, không gửi lên máy chủ. Mở từ nút ✨ ở màn xem trước, mục "Phông nền" trong menu Thêm, hoặc Cài đặt → Video. Bật lại camera là track mới nên `Classroom` áp lại hiệu ứng mỗi khi track đổi.
- `MiniWindow.tsx`: cửa sổ thu nhỏ luôn nổi trên ứng dụng khác (Document Picture-in-Picture, chỉ Chrome/Edge máy tính; trình duyệt khác không hiện nút). Mở bằng nút ở góc phải thanh điều khiển hoặc menu Thêm. Nội dung render bằng `createPortal` vào cửa sổ mới (CSS được chép sang), nên dùng chung context LiveKit: màn hình chia sẻ hoặc người đang nói, nút micro, camera, giơ tay, quay lại, rời lớp. Ô video trong cửa sổ nổi được báo `enterpictureinpicture` để adaptive stream của LiveKit không tạm dừng video khi tab chính bị ẩn.

- `Classroom.tsx`: thanh trên (ghi hình, phát trực tiếp, giơ tay, nhóm), sân khấu, thanh điều khiển tròn (micro, camera, chia sẻ, giơ tay, bảng trắng, menu Thêm, rời lớp), nút bảng bên, thông báo góc dưới; nhận tin điều khiển từ giáo viên.
- `SidePanel.tsx`: bảng bên nền sáng: Người tham gia (phòng chờ, giơ tay, tắt mic, mời phát biểu, mời ra, quyền chia sẻ), Trò chuyện, Tài liệu, Hoạt động của giáo viên (câu hỏi nhanh, chia nhóm, bảng trắng, ghi hình, phát trực tiếp). Các bảng cũ (`Quiz.tsx`, `Breakout.tsx`, `Materials`) dùng lại nguyên, đổi tông màu bằng biến CSS trong `.mt-panel--live`.
- `interaction.ts`: hook `useRoomChat` (lịch sử từ API + tin mới qua chủ đề `chat`, đếm chưa đọc) và `useQuizzes`.
- `Quiz.tsx`: tab Câu hỏi của giáo viên và thẻ trả lời nổi của học viên.
- `Breakout.tsx`: tab Nhóm của giáo viên (xếp nhóm, ghé nhóm, nhắn, gọi về). Trang phòng (`app/room/[id]/page.tsx`) có `switchRoom`: gọi lại `/join` rồi gắn lại `LiveKitRoom` bằng token mới.
- `Whiteboard.tsx`: canvas vẽ phấn, đồng bộ qua Yjs. Bảng có kích thước logic 1600×900, mỗi máy co giãn cho vừa khung.
- `shared.ts`: kiểu dữ liệu chung, đọc vai trò và trạng thái giơ tay của người tham gia.

### apps/whiteboard (Hocuspocus 2)

`src/server.js` xác thực bằng JWT do API cấp (`/sessions/:id/board-token`). Mỗi buổi học là một tài liệu Yjs tên `session:<id>`, lưu vào bảng `whiteboards` (gom thay đổi, tối đa 2 giây ghi một lần).

### LiveKit Server 1.8

Image chính thức `livekit/livekit-server`. Khoá API truyền qua biến `LIVEKIT_KEYS`. Webhook gửi về `http://api:3001/webhooks/livekit`. LiveKit dùng Redis để giao việc ghi hình cho dịch vụ `egress`.

### Egress, Redis, S3

- `livekit/egress` mở phòng bằng Chrome không giao diện, ghép video (bố cục `speaker`) và tải MP4 thẳng lên bucket.
- Trên máy, dịch vụ `s3` là RustFS (tương thích MinIO); `s3-init` tạo bucket. Trên VPS dùng Cloudflare R2 hoặc S3 thật.
- Bucket không công khai: API ký link tải có hạn (`StorageService.downloadUrl`). Tài liệu tải lên đi qua API (multipart), nên không cần cấu hình CORS cho bucket.

## Mô hình dữ liệu (`apps/api/prisma/schema.prisma`)

| Bảng | Ý nghĩa | Ghi chú |
| --- | --- | --- |
| `users` | Tài khoản | `roleId` → `roles`. Tài khoản trong `SEED_TEACHER_EMAIL` luôn là quản trị viên. Hồ sơ: `phone`, `bio`, `birthday`, `avatarVersion` (0 = chưa có ảnh; tăng mỗi lần đổi ảnh để làm mới cache) |
| `user_avatars` | Ảnh đại diện | Byte ảnh (WebP/JPEG 512×512 đã cắt ở trình duyệt), tách khỏi `users` để truy vấn người dùng không kéo theo ảnh. Lưu trong Postgres, nằm trong bản sao lưu DB |
| `roles` | Vai trò | `key` (`admin`, `teacher`, `student` cho 3 vai trò hệ thống, `system: true`, không xoá được), `permissions` là mảng mã quyền. Quản trị viên luôn có mọi quyền |
| `courses` | Khoá học | `published` quyết định hiện trên trang chủ |
| `enrollments` | Học viên thuộc khoá | khoá duy nhất (userId, courseId) |
| `sessions` | Buổi học hoặc meeting, một phòng LiveKit | `roomName` dạng `bd-<hex>`; `status`: SCHEDULED, LIVE, ENDED, CANCELLED; `allowStudentShare`. Buổi học có `courseId`; meeting độc lập có `courseId` null và `hostId` là người tạo |
| `attendance` | Mỗi lần vào/ra phòng | ghi từ webhook `participant_joined` / `participant_left` |
| `join_requests` | Xin vào lớp khi chưa có trong danh sách | PENDING, APPROVED, DENIED |
| `whiteboards` | Trạng thái Yjs của bảng | cột snake_case vì máy chủ bảng trắng dùng SQL trực tiếp |
| `chat_messages` | Tin nhắn trong buổi | API trả 200 tin gần nhất khi vào phòng |
| `quizzes`, `quiz_answers` | Câu hỏi nhanh và câu trả lời | `correct` null là câu thăm dò; mỗi học viên một câu trả lời, đổi được tới khi đóng |
| `recordings` | Bản ghi hình | `egressId` duy nhất; STARTING → RECORDING → PROCESSING → READY hoặc FAILED |
| `materials` | Tài liệu | `sessionId` null là tài liệu chung của khoá |
| `breakout_groups` | Nhóm nhỏ của buổi | `members` là mảng `users.id`; `sessions.breakoutActive` bật thì học viên vào phòng nhóm |
| `live_streams` | Phát trực tiếp, một dòng mỗi buổi | `public`: ai có link cũng xem; `prefix`: thư mục HLS trên bucket |
| `ggb_documents` | Bài GeoGebra | `base64` là `getBase64()` của applet (tối đa 2 MB); `version` tăng mỗi lần lưu, lưu bằng version cũ trả 409; `thumbnailKey` ảnh PNG trên S3 (bỏ qua khi chưa cấu hình S3); `sessionId` khi lưu từ bảng của buổi học |
| `ggb_boards` | Bảng GeoGebra của buổi học | Trạng thái Yjs do máy chủ bảng trắng ghi (tài liệu `ggb:<session_id>`); tách khỏi `whiteboards` vì khoá chính là `session_id` |
| `site_content` | Nội dung trang công khai | Hai dòng `key`: `draft`, `published`; `data` JSON theo kiểu `SiteContent` (`apps/api/src/site/site-content.ts`), luôn qua `sanitize` khi lưu và khi đọc |
| `site_assets` | Ảnh của trang (slider, logo, favicon, ảnh giáo viên…) | Lưu byte trong Postgres (homelab không có S3); không sửa sau khi tải: đổi ảnh là id mới, nên trả cache 1 năm |
| `reminders` | Nhắc lịch đã gửi | khoá duy nhất (sessionId, userId, kind, startsAt): đổi giờ buổi học thì nhắc lại |

## Phân quyền

Vai trò do quản trị viên tạo ở `/admin` (tab Vai trò), mỗi vai trò tick một tập quyền. Ba vai trò hệ thống: Quản trị viên (mọi quyền), Giáo viên (`course.create`, `meeting.create`, `ggb.create`, `session.record`), Học viên (không quyền). Người đăng ký mới là Học viên.

| Mã quyền | Cho phép |
| --- | --- |
| `course.create` | Tạo và dạy khoá học của mình |
| `meeting.create` | Tạo phòng họp nhanh |
| `ggb.create` | Tạo bài GeoGebra qua API `/ggb-documents` (giao diện hiện chưa dùng; bảng GeoGebra trong phòng học chỉ cần là giáo viên của buổi) |
| `session.record` | Ghi hình, phát trực tiếp buổi mình dạy |
| `course.view_all` | Xem mọi khoá học, điểm danh, bản ghi; vào lớp như học viên |
| `course.manage_all` | Sửa mọi khoá học, vào lớp với quyền giáo viên, chuyển khoá |
| `stats.view` | Thống kê hệ thống |
| `user.manage` | Danh sách tài khoản, đổi vai trò |
| `role.manage` | Tạo, sửa, xoá vai trò |

API đọc vai trò và quyền từ DB mỗi lần gọi (`currentUser`), nên đổi vai trò có hiệu lực ngay. Web chỉ dùng quyền để ẩn/hiện (`lib/can.ts`).

## Phân quyền trong phòng học

| Việc | Cách làm |
| --- | --- |
| Vai trò | Ghi trong metadata của token LiveKit: `{"role":"teacher"}` hoặc `"student"` |
| Giáo viên | `roomAdmin: true`, phát mọi nguồn |
| Học viên | `canPublishSources` chỉ có camera và micro. Thêm màn hình khi giáo viên bật quyền |
| Bật/tắt quyền chia sẻ | `POST /sessions/:id/mod/allow-share`: lưu vào DB, gọi `updateParticipant` cho từng học viên đang trong phòng, cập nhật metadata phòng để giao diện đổi theo |
| Bảng trắng mở hay đóng | Metadata phòng `{"board":true, "boardKind":"chalk"|"ggb"}`; mọi máy cùng chuyển sang bảng phấn hoặc bảng GeoGebra |
| Bảng GeoGebra | Chỉ giáo viên/chủ phòng vẽ. Máy chủ bảng trắng đặt `connection.readOnly` cho token không phải giáo viên với tài liệu `ggb:` nên học viên không ghi được kể cả khi tự gửi tin Yjs |
| Giơ tay | Attribute `hand` = `"1"` của người tham gia (token có `canUpdateOwnMetadata`) |
| Mời phát biểu, hạ tay | Giáo viên gửi tin dữ liệu chủ đề `control` riêng cho học viên đó; trình duyệt học viên tự hạ tay và bật micro |
| Tắt mic | API gọi `mutePublishedTrack` trên track micro |
| Mời ra | API gọi `removeParticipant` và đổi yêu cầu vào lớp (nếu có) sang DENIED |
| Chủ phòng | Buổi học: giáo viên của khoá (`course.teacherId`). Meeting: `hostId`. Dùng `hostIdOf(s)` trong `classroom.module.ts`, không đọc thẳng `s.course` |
| Giờ vào lớp | Học viên vào được từ 10 phút trước giờ học đến 30 phút sau giờ kết thúc (`config.ts`). Giáo viên vào lúc nào cũng được |
| Chat, câu hỏi nhanh | Gửi qua API (kiểm tra quyền, lưu DB), API phát xuống phòng bằng `sendData`. Kết quả câu hỏi đang mở chỉ gửi riêng cho giáo viên; đáp án đúng chỉ lộ khi đóng câu |
| Đang ghi hình | Metadata phòng `{"recording":true}`; mọi người thấy biểu tượng ● Đang ghi hình |
| Đang phát trực tiếp | Metadata phòng `{"live":true}` |
| Chia nhóm | `POST /join` quyết định phòng: học viên có trong `breakout_groups` vào phòng nhóm; giáo viên gửi `{group}` để ghé. Tin `breakout` (`start`/`end`) chỉ báo trình duyệt gọi lại `/join`. Chat, câu hỏi, tắt mic, mời ra, quyền chia sẻ áp dụng cho mọi phòng của buổi (`ClassroomService.rooms`) |
| Quản trị | Mọi guard đọc vai trò trong DB mỗi lần gọi, nên cấp hay thu quyền có hiệu lực ngay, không phải đăng nhập lại |

## Luồng chính

### Vào lớp

1. `/room/[id]` gọi `GET /sessions/:id`, hiện PreJoin (chọn camera, micro).
2. Bấm "Vào lớp" thì gọi `POST /sessions/:id/join`.
   - Có trong danh sách lớp hoặc đã được duyệt: kiểm tra giờ, `ensureRoom`, ký token và trả về `{status:'ok', token, url, role}`.
   - Chưa có quyền: tạo `join_requests` PENDING, trả về `{status:'waiting'}`. Trình duyệt gọi lại mỗi 3 giây cho tới khi được duyệt.
3. Trình duyệt kết nối LiveKit. LiveKit gửi webhook `participant_joined`, API ghi điểm danh.

### Meeting

Buổi học và meeting nằm chung trang Lịch học (`/schedule`, `/meet` chuyển hướng về đây), chia theo ngày. Nút "Tạo buổi học / cuộc họp" mở một form: chọn loại (cuộc họp, hoặc buổi học của một khoá mình dạy), giờ bắt đầu mặc định là bây giờ, thời lượng mặc định 120 phút, tối đa 240. Có hai loại link mời: `/room/:id` (cần duyệt: người nhận xin vào qua phòng chờ, chủ phòng duyệt) và `/room/:id?key=<inviteKey>` (vào thẳng: đúng khoá thì API tự duyệt). `inviteKey` sinh khi tạo meeting, chỉ chủ phòng thấy qua `GET /meetings` và `GET /schedule`; meeting tạo trước khi có cột này chỉ có link cần duyệt. Meeting hiện trong Lịch học của người tạo, không gửi email nhắc lịch, chưa có tài liệu, ghi hình, phát trực tiếp (quyền xem các mục đó dựa trên danh sách lớp).

### Kết thúc buổi

Giáo viên bấm "Kết thúc buổi học" thì gọi `POST /sessions/:id/end`: chuyển status sang ENDED, dừng ghi hình nếu đang ghi, rồi `deleteRoom`. Mọi người bị ngắt kết nối với lý do `ROOM_DELETED`. Webhook `room_finished` đóng các dòng điểm danh còn mở.

### Đăng nhập bằng Google

1. Nút trên `/login` mở `/api/auth/google`: API tạo `state` ngẫu nhiên, lưu vào cookie `bd_oauth` (10 phút, chỉ gửi cho `/api/auth/google*`) cùng trang cần quay về, rồi chuyển sang Google.
2. Google gọi lại `/api/auth/google/callback?code&state`. API so `state` với cookie, đổi `code` lấy `id_token` (phía server, có client secret), kiểm tra `aud`, `iss`, hạn và `email_verified`.
3. Tìm tài khoản theo `users.googleId`; chưa có thì gắn vào tài khoản cùng email; chưa có tài khoản thì tạo học viên mới với `passwordHash` null. Đặt cookie `bd_session` như đăng nhập thường rồi chuyển về trang cũ (chỉ nhận đường dẫn trong trang).
4. Lỗi ở bất kỳ bước nào: chuyển về `/login?error=<thông báo tiếng Việt>`.

### Bảng GeoGebra trong phòng học

Giáo viên mở từ Hoạt động hoặc menu Thêm (`boardKind: 'ggb'`). `GgbStage` lấy token `GET /sessions/:id/board-token?kind=ggb`, kết nối Hocuspocus với tài liệu `ggb:<id>`, gắn applet bằng `components/geogebra/syncGgb.ts`:

- Map `ggb` (snapshot): toàn bộ `getXML()` khi cấu trúc đổi (thêm, xoá, đổi tên, sửa định nghĩa), gom 400 ms, tối đa 1,5 giây một lần. Máy xem `setXML`.
- Map `ggbLive`: khi kéo, toạ độ điểm (`setCoords`) hoặc giá trị thanh trượt (`setValue`), 50 ms một lần, khoảng 90 byte mỗi tin; đối tượng phụ thuộc tự tính lại ngay. Loại khác gửi XML (`evalXML` rồi `UpdateConstruction`) và ghi thêm snapshot khi ngừng kéo.
- Người vào muộn: nạp snapshot rồi áp các giá trị trong `ggbLive`.

Học viên mở applet chỉ xem với `perspective: 'G'` (chỉ vùng hình vẽ, ẩn danh sách đối tượng); snapshot mang bố cục của giáo viên nên sau mỗi lần nạp gọi lại `setPerspective('G')`.

Con trỏ laser và nét bút đang vẽ của giáo viên đi qua awareness của Hocuspocus (tin tức thời, không lưu DB), `components/geogebra/pointerGgb.ts` (gửi) và `components/room/GgbPointerLayer.tsx` (lớp SVG ở máy học viên):

- Giáo viên bật nút Laser (phím L); toạ độ gửi là toạ độ hình học nên đúng ở mọi cỡ màn hình. Laser mờ dần sau 1,5 giây đứng yên.
- Khi dùng công cụ Bút (mode 62), các điểm của nét được gửi dần (chỉ phần mới, khoảng 150 byte/tin, tối đa ~30 tin/giây); nhấc bút thì nét thật được ghi snapshot ngay (khoảng 50 ms tới máy học viên) và nét tạm biến mất khi số nét bút trên bảng tăng (dự phòng: 2 giây).
- Máy chủ không chặn awareness của kết nối chỉ đọc, nên máy nhận chỉ vẽ trạng thái có `user.role: 'teacher'`. Học viên sửa code trình duyệt vẫn giả được chấm laser trên màn hình người khác, nhưng không sửa được bảng.

Đo trong spike: nạp snapshot ở máy xem khoảng 110 ms với 30 đối tượng (XML 14 KB), 1,2 giây với 200 đối tượng (XML 73 KB). Bảng rất lớn sẽ khựng một chút ở máy xem mỗi lần thêm/xoá đối tượng. `setXML` đặt góc nhìn của máy xem theo giáo viên. Nút "Lưu thành bài" tạo `ggb_documents` có `sessionId`, học viên của lớp xem lại được (chỉ đọc).

### Bảng trắng

Giáo viên bật bảng thì metadata phòng `board=true`. Mỗi máy lấy token `GET /sessions/:id/board-token` rồi kết nối Hocuspocus. Nét vẽ là `Y.Map {c, w, pts: Y.Array<number>}` trong `Y.Array 'strokes'`; điểm được thêm khi đang kéo, nên người khác thấy nét vẽ hiện ra ngay.

## Danh sách API

| Phương thức | Đường dẫn | Quyền |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | mọi người |
| GET | `/auth/me` | đã đăng nhập |
| GET, PATCH | `/me/profile` `{name?, phone?, bio?, birthday?}` | đã đăng nhập |
| PUT, DELETE | `/me/avatar` (multipart `file`, tối đa 2 MB, JPEG/PNG/WebP) | đã đăng nhập |
| GET | `/users/:id/avatar?v=` | đã đăng nhập; 404 khi chưa có ảnh (giao diện hiện chữ cái đầu) |
| POST | `/auth/password` `{currentPassword, newPassword}` | đã đăng nhập; tăng `tokenVersion`, máy khác bị đăng xuất |
| POST | `/auth/logout-all` | đã đăng nhập; tăng `tokenVersion` |
| GET | `/auth/methods` | đã đăng nhập (`{hasPassword, google}`) |
| GET | `/auth/providers` | mọi người (`{google}`: có bật đăng nhập Google không) |
| GET | `/auth/google?next=`, `/auth/google/callback` | mọi người; chuyển hướng qua Google rồi đặt cookie |
| GET | `/courses/public` | mọi người |
| GET, POST | `/courses` | giáo viên |
| GET, PATCH | `/courses/:id` | giáo viên của khoá |
| POST | `/courses/:id/enrollments` `{email}` | giáo viên của khoá |
| DELETE | `/courses/:id/enrollments/:userId` | giáo viên của khoá |
| POST | `/courses/:id/sessions` `{title, startsAt, endsAt}` | giáo viên của khoá |
| PATCH | `/sessions/:id` `{title?, startsAt?, endsAt?, cancelled?}` | giáo viên của khoá, hoặc chủ meeting |
| GET | `/site`, `/site/assets/:id` | mọi người (không cần đăng nhập); nội dung đã xuất bản (cache 30 giây), ảnh (cache 1 năm) |
| GET | `/admin/site` | `site.manage`: `{draft, published, draftUpdatedAt, publishedAt}` |
| PUT | `/admin/site/draft` `{content}` | `site.manage`; làm sạch rồi lưu nháp |
| POST | `/admin/site/publish`, `/admin/site/discard` | `site.manage`; xuất bản nháp, hoặc đưa nháp về bản đã xuất bản |
| POST | `/admin/site/assets` (multipart `file`, ≤ 3 MB), `/admin/site/assets/cleanup` | `site.manage`; chỉ nhận JPEG/PNG/WebP (kiểm magic bytes, không nhận SVG); dọn ảnh không dùng quá 1 ngày |
| GET, POST | `/ggb-documents` | xem danh sách: bài của mình; tạo: giáo viên. Giao diện hiện chưa dùng (đã bỏ trang /ggb và nút lưu thành bài trong phòng học); API và bảng `ggb_documents` giữ lại cho dữ liệu cũ |
| GET | `/ggb-documents/:id` | chủ bài, hoặc thành viên buổi học nếu bài gắn buổi học (kèm `canEdit`) |
| PUT | `/ggb-documents/:id` `{base64, version}` | chủ bài; 409 khi version cũ; 60 lần/phút |
| PATCH, DELETE | `/ggb-documents/:id` `{title}` | chủ bài |
| PUT | `/ggb-documents/:id/thumbnail` `{png}` | chủ bài; không có S3 thì bỏ qua |
| GET, POST | `/meetings` `{title?, startsAt?, durationMinutes?}` | giáo viên; bỏ trống `startsAt` là họp ngay |
| POST | `/meetings/:id/cancel` | chủ meeting |
| GET | `/schedule` | đã đăng nhập |
| GET | `/sessions/:id` | đã đăng nhập (trả về kèm `role`, `kind`: `class` hoặc `meeting`; `course` null với meeting) |
| POST | `/sessions/:id/join` | đã đăng nhập |
| GET | `/sessions/:id/board-token?kind=ggb` | trong lớp; `kind=ggb` là bảng GeoGebra |
| GET | `/sessions/:id/join-requests` | giáo viên |
| POST | `/sessions/:id/join-requests/:reqId` `{approve}` | giáo viên |
| POST | `/sessions/:id/mod/mute` `{identity}`, `/mod/mute-all`, `/mod/remove` `{identity}` | giáo viên |
| POST | `/sessions/:id/mod/allow-share` `{allow}`, `/mod/board` `{open, kind?}` | giáo viên |
| POST | `/sessions/:id/end` | giáo viên |
| GET | `/sessions/:id/attendance` | giáo viên |
| GET, POST | `/sessions/:id/chat` `{text}` | trong lớp |
| GET, POST | `/sessions/:id/quizzes` `{question, options[], correct?}` | xem: trong lớp; tạo: giáo viên |
| POST | `/sessions/:id/quizzes/:quizId/answer` `{choice}` | học viên trong lớp |
| POST | `/sessions/:id/quizzes/:quizId/close` | giáo viên |
| POST | `/sessions/:id/recording/start`, `/recording/stop` | giáo viên, khi lớp đang diễn ra |
| GET | `/sessions/:id/recordings` | giáo viên (mọi bản), học viên đã đăng ký (bản READY) |
| GET | `/recordings/:id/url`; DELETE `/recordings/:id` | xem: thành viên khoá; xoá: giáo viên |
| GET | `/courses/:id/materials?sessionId=` | thành viên khoá |
| POST | `/courses/:id/materials` (multipart `file`, `sessionId?`) | giáo viên của khoá |
| GET | `/materials/:id/url`; DELETE `/materials/:id` | xem: thành viên khoá; xoá: giáo viên |
| GET | `/features` | đã đăng nhập (`{storage}`: đã cấu hình lưu trữ chưa) |
| GET, POST | `/sessions/:id/breakouts` `{groups:[{name, members[]}], minutes?}` | giáo viên |
| POST | `/sessions/:id/breakouts/end`, `/breakouts/announce` `{text}` | giáo viên |
| POST | `/sessions/:id/live/start` `{public?}`, `/live/stop` | giáo viên, khi lớp đang diễn ra |
| GET | `/live/:id`, `/live/:id/:file` (playlist, đoạn video) | luồng công khai: mọi người; riêng tư: thành viên khoá |
| GET | `/admin/stats` | `stats.view` |
| GET | `/admin/users?q=&roleId=` · PATCH `/admin/users/:id` `{roleId}` | `user.manage` |
| GET | `/admin/roles`, `/admin/permissions` | `role.manage` hoặc `user.manage` |
| POST, PATCH, DELETE | `/admin/roles`, `/admin/roles/:id` `{name, description?, permissions[]}` | `role.manage` |
| GET | `/admin/courses` | `course.view_all` hoặc `course.manage_all` |
| GET | `/admin/teachers` · PATCH `/admin/courses/:id/teacher` `{teacherId}` | `course.manage_all` |
| POST | `/webhooks/livekit` | LiveKit (kiểm tra chữ ký) |
| GET | `/health` | kiểm tra sống |

`identity` của người tham gia LiveKit chính là `users.id`.
