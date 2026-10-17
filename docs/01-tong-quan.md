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
4. **Modular monolith.** API là một tiến trình, chia module theo nghiệp vụ, để sau này tách thành dịch vụ riêng nếu cần.

## Các thành phần

### apps/api (NestJS 10, Prisma 5)

| Module | File | Việc |
| --- | --- | --- |
| Auth | `src/auth/auth.module.ts`, `auth.guard.ts` | Đăng ký, đăng nhập, JWT 7 ngày trong cookie `bd_session`. Có `AuthGuard`, `TeacherGuard` và decorator `@CurrentUser()` |
| Courses | `src/courses/courses.module.ts` | Khoá học, thêm/xoá học viên bằng email, tạo và huỷ buổi học, lịch học (`/schedule`) |
| Classroom | `src/classroom/classroom.module.ts` | Vào lớp, phòng chờ, quyền giáo viên, token bảng trắng, điểm danh, webhook LiveKit |
| LiveKit | `src/classroom/livekit.service.ts` | Ký token; gọi RoomService để tạo phòng, đổi metadata, tắt mic, mời ra, đổi quyền, phát tin dữ liệu xuống phòng (`broadcast`) |
| Interaction | `src/classroom/interaction.module.ts` | Chat lưu DB rồi phát xuống phòng (chủ đề `chat`); câu hỏi nhanh (chủ đề `quiz`) |
| Ghi hình | `src/classroom/recording.service.ts` | Bắt đầu/dừng LiveKit Egress, cập nhật trạng thái từ webhook `egress_*` |
| Media | `src/classroom/media.module.ts` | API ghi hình, danh sách bản ghi, tải lên và mở tài liệu (link ký có hạn) |
| Nhắc lịch | `src/notifications/reminder.module.ts` | Quét mỗi phút, gửi email nhắc lịch qua Resend |
| Chia nhóm | `src/classroom/breakout.module.ts` | Xếp nhóm, gọi về, nhắn mọi nhóm; phòng nhóm `<roomName>-g<n>` |
| Webinar | `src/classroom/live.service.ts`, `webinar.module.ts` | Egress phát HLS lên S3; API chuyển tiếp playlist và đoạn video cho người xem |
| Quản trị | `src/admin/admin.module.ts` | Thống kê, đổi vai trò tài khoản, chuyển khoá học giữa giáo viên (`AdminGuard` đọc vai trò từ DB) |
| Common | `src/common/config.ts`, `prisma.service.ts`, `storage.service.ts` | Đọc biến môi trường (thiếu là dừng ngay), kết nối Prisma, lưu file lên S3/R2 |
| Seed | `src/seed.ts` | Tạo tài khoản giáo viên; `SEED_DEMO=true` thì thêm dữ liệu mẫu |

### apps/web (Next.js 14 App Router)

| Đường dẫn | File | Việc |
| --- | --- | --- |
| `/` | `app/page.tsx` | Trang chủ, các khoá học công khai |
| `/login`, `/register` | `components/AuthForm.tsx` | Đăng nhập, đăng ký (tài khoản mới luôn là học viên) |
| `/schedule` | `app/schedule/page.tsx` | Lịch học; nút "Vào lớp" mở trước giờ học 10 phút |
| `/teach` | `app/teach/page.tsx` | Giáo viên: danh sách khoá học, tạo khoá |
| `/teach/courses/[id]` | `app/teach/courses/[id]/page.tsx` | Buổi học, thêm học viên, công khai khoá |
| `/teach/sessions/[id]` | `app/teach/sessions/[id]/page.tsx` | Bảng điểm danh |
| `/sessions/[id]` | `app/sessions/[id]/page.tsx` | Xem lại buổi học: bản ghi hình và tài liệu (giáo viên và học viên) |
| `/live/[id]` | `app/live/[id]/page.tsx` | Xem phát trực tiếp bằng hls.js; luồng công khai không cần đăng nhập |
| `/admin` | `app/admin/page.tsx` | Quản trị: thống kê, vai trò tài khoản, chuyển khoá học |
| `/room/[id]` | `app/room/[id]/page.tsx` | Phòng kiểm tra thiết bị (PreJoin), phòng chờ, phòng học |

`components/Materials.tsx` và `components/Recordings.tsx` dùng chung cho trang khoá học, trang xem lại và phòng học.

Phòng học nằm trong `components/room/`:

- `Classroom.tsx`: bố cục sân khấu (lưới video, màn hình chia sẻ, bảng trắng), thanh điều khiển, giơ tay, ghi hình, nhận tin điều khiển từ giáo viên.
- `SidePanel.tsx`: tab Trò chuyện, tab Học viên (phòng chờ, tắt mic, mời ra, cho chia sẻ màn hình, mời phát biểu), tab Câu hỏi (giáo viên) và tab Tài liệu.
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
| `users` | Tài khoản | `role`: ADMIN, TEACHER, STUDENT. Tài khoản trong `SEED_TEACHER_EMAIL` là ADMIN; ADMIN cấp quyền giáo viên ở `/admin` |
| `courses` | Khoá học | `published` quyết định hiện trên trang chủ |
| `enrollments` | Học viên thuộc khoá | khoá duy nhất (userId, courseId) |
| `sessions` | Buổi học, một phòng LiveKit | `roomName` dạng `bd-<hex>`; `status`: SCHEDULED, LIVE, ENDED, CANCELLED; `allowStudentShare` |
| `attendance` | Mỗi lần vào/ra phòng | ghi từ webhook `participant_joined` / `participant_left` |
| `join_requests` | Xin vào lớp khi chưa có trong danh sách | PENDING, APPROVED, DENIED |
| `whiteboards` | Trạng thái Yjs của bảng | cột snake_case vì máy chủ bảng trắng dùng SQL trực tiếp |
| `chat_messages` | Tin nhắn trong buổi | API trả 200 tin gần nhất khi vào phòng |
| `quizzes`, `quiz_answers` | Câu hỏi nhanh và câu trả lời | `correct` null là câu thăm dò; mỗi học viên một câu trả lời, đổi được tới khi đóng |
| `recordings` | Bản ghi hình | `egressId` duy nhất; STARTING → RECORDING → PROCESSING → READY hoặc FAILED |
| `materials` | Tài liệu | `sessionId` null là tài liệu chung của khoá |
| `breakout_groups` | Nhóm nhỏ của buổi | `members` là mảng `users.id`; `sessions.breakoutActive` bật thì học viên vào phòng nhóm |
| `live_streams` | Phát trực tiếp, một dòng mỗi buổi | `public`: ai có link cũng xem; `prefix`: thư mục HLS trên bucket |
| `reminders` | Nhắc lịch đã gửi | khoá duy nhất (sessionId, userId, kind, startsAt): đổi giờ buổi học thì nhắc lại |

## Phân quyền trong phòng học

| Việc | Cách làm |
| --- | --- |
| Vai trò | Ghi trong metadata của token LiveKit: `{"role":"teacher"}` hoặc `"student"` |
| Giáo viên | `roomAdmin: true`, phát mọi nguồn |
| Học viên | `canPublishSources` chỉ có camera và micro. Thêm màn hình khi giáo viên bật quyền |
| Bật/tắt quyền chia sẻ | `POST /sessions/:id/mod/allow-share`: lưu vào DB, gọi `updateParticipant` cho từng học viên đang trong phòng, cập nhật metadata phòng để giao diện đổi theo |
| Bảng trắng mở hay đóng | Metadata phòng `{"board":true}`; mọi máy cùng chuyển sang bảng |
| Giơ tay | Attribute `hand` = `"1"` của người tham gia (token có `canUpdateOwnMetadata`) |
| Mời phát biểu, hạ tay | Giáo viên gửi tin dữ liệu chủ đề `control` riêng cho học viên đó; trình duyệt học viên tự hạ tay và bật micro |
| Tắt mic | API gọi `mutePublishedTrack` trên track micro |
| Mời ra | API gọi `removeParticipant` và đổi yêu cầu vào lớp (nếu có) sang DENIED |
| Giờ vào lớp | Học viên vào được từ 10 phút trước giờ học đến 30 phút sau giờ kết thúc (`config.ts`). Giáo viên vào lúc nào cũng được |
| Chat, câu hỏi nhanh | Gửi qua API (kiểm tra quyền, lưu DB), API phát xuống phòng bằng `sendData`. Kết quả câu hỏi đang mở chỉ gửi riêng cho giáo viên; đáp án đúng chỉ lộ khi đóng câu |
| Đang ghi hình | Metadata phòng `{"recording":true}`; mọi người thấy biểu tượng ● Đang ghi hình |
| Đang phát trực tiếp | Metadata phòng `{"live":true}` |
| Chia nhóm | `POST /join` quyết định phòng: học viên có trong `breakout_groups` vào phòng nhóm; giáo viên gửi `{group}` để ghé. Tin `breakout` (`start`/`end`) chỉ báo trình duyệt gọi lại `/join`. Chat, câu hỏi, tắt mic, mời ra, quyền chia sẻ áp dụng cho mọi phòng của buổi (`ClassroomService.rooms`) |
| Quản trị | `AdminGuard` đọc vai trò trong DB mỗi lần gọi. `/auth/me` cấp lại cookie khi vai trò đổi, nên người được cấp quyền giáo viên không phải đăng nhập lại |

## Luồng chính

### Vào lớp

1. `/room/[id]` gọi `GET /sessions/:id`, hiện PreJoin (chọn camera, micro).
2. Bấm "Vào lớp" thì gọi `POST /sessions/:id/join`.
   - Có trong danh sách lớp hoặc đã được duyệt: kiểm tra giờ, `ensureRoom`, ký token và trả về `{status:'ok', token, url, role}`.
   - Chưa có quyền: tạo `join_requests` PENDING, trả về `{status:'waiting'}`. Trình duyệt gọi lại mỗi 3 giây cho tới khi được duyệt.
3. Trình duyệt kết nối LiveKit. LiveKit gửi webhook `participant_joined`, API ghi điểm danh.

### Kết thúc buổi

Giáo viên bấm "Kết thúc buổi học" thì gọi `POST /sessions/:id/end`: chuyển status sang ENDED, dừng ghi hình nếu đang ghi, rồi `deleteRoom`. Mọi người bị ngắt kết nối với lý do `ROOM_DELETED`. Webhook `room_finished` đóng các dòng điểm danh còn mở.

### Bảng trắng

Giáo viên bật bảng thì metadata phòng `board=true`. Mỗi máy lấy token `GET /sessions/:id/board-token` rồi kết nối Hocuspocus. Nét vẽ là `Y.Map {c, w, pts: Y.Array<number>}` trong `Y.Array 'strokes'`; điểm được thêm khi đang kéo, nên người khác thấy nét vẽ hiện ra ngay.

## Danh sách API

| Phương thức | Đường dẫn | Quyền |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | mọi người |
| GET | `/auth/me` | đã đăng nhập |
| GET | `/courses/public` | mọi người |
| GET, POST | `/courses` | giáo viên |
| GET, PATCH | `/courses/:id` | giáo viên của khoá |
| POST | `/courses/:id/enrollments` `{email}` | giáo viên của khoá |
| DELETE | `/courses/:id/enrollments/:userId` | giáo viên của khoá |
| POST | `/courses/:id/sessions` `{title, startsAt, endsAt}` | giáo viên của khoá |
| PATCH | `/sessions/:id` `{title?, startsAt?, endsAt?, cancelled?}` | giáo viên của khoá |
| GET | `/schedule` | đã đăng nhập |
| GET | `/sessions/:id` | đã đăng nhập (trả về kèm `role`) |
| POST | `/sessions/:id/join` | đã đăng nhập |
| GET | `/sessions/:id/board-token` | trong lớp |
| GET | `/sessions/:id/join-requests` | giáo viên |
| POST | `/sessions/:id/join-requests/:reqId` `{approve}` | giáo viên |
| POST | `/sessions/:id/mod/mute` `{identity}`, `/mod/mute-all`, `/mod/remove` `{identity}` | giáo viên |
| POST | `/sessions/:id/mod/allow-share` `{allow}`, `/mod/board` `{open}` | giáo viên |
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
| GET | `/admin/stats`, `/admin/users?q=&role=`, `/admin/courses` | quản trị viên |
| PATCH | `/admin/users/:id` `{role}`, `/admin/courses/:id/teacher` `{teacherId}` | quản trị viên |
| POST | `/webhooks/livekit` | LiveKit (kiểm tra chữ ký) |
| GET | `/health` | kiểm tra sống |

`identity` của người tham gia LiveKit chính là `users.id`.
