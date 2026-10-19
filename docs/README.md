# Tài liệu dự án vt-sys (Bảng Đen)

Thư mục này là nơi bắt đầu cho bất kỳ ai nhận tiếp dự án, kể cả trợ lý AI. Đọc theo thứ tự:

| Tài liệu | Nội dung | Ai cần đọc |
| --- | --- | --- |
| [01-tong-quan.md](01-tong-quan.md) | Mục tiêu, kiến trúc, các thành phần, mô hình dữ liệu, luồng hoạt động chính | Mọi người |
| [02-phat-trien.md](02-phat-trien.md) | Cài đặt máy mới, chạy trên máy, biến môi trường, quy trình làm việc, xử lý lỗi thường gặp | Lập trình viên |
| [03-trien-khai-vps.md](03-trien-khai-vps.md) | Đưa lên máy chủ thật: VPS, tên miền, HTTPS, LiveKit, sao lưu, cập nhật | Người vận hành |
| [05-trien-khai-homelab.md](05-trien-khai-homelab.md) | Đưa lên máy chủ tại nhà (Proxmox VM) sau Nginx Proxy Manager, tắt ghi hình, giới hạn RAM | Người vận hành |
| [04-lo-trinh.md](04-lo-trinh.md) | Trạng thái hiện tại, việc còn dang dở, kế hoạch giai đoạn 2 và 3 | Người làm tiếp |
| [../CLAUDE.md](../CLAUDE.md) | Quy ước ngắn cho trợ lý AI làm việc trong repo | Trợ lý AI |

## Tóm tắt trong 30 giây

- **Sản phẩm:** website dạy học trực tuyến cho một giáo viên. Có lớp video nhiều người, chia sẻ màn hình, chat lưu lại, giơ tay, câu hỏi nhanh, bảng trắng chung, phòng chờ duyệt, điểm danh tự động, ghi hình và xem lại, tài liệu theo buổi, email nhắc lịch.
- **Công nghệ:**
  - Next.js 14 (web)
  - NestJS 10 + Prisma 5 + PostgreSQL 16 (API)
  - LiveKit 1.8 (video, chạy tự host)
  - Hocuspocus + Yjs (bảng trắng)
  - Docker Compose để chạy toàn bộ
- **Trạng thái:** giai đoạn 1 đã viết xong nhưng **chưa được build và chạy thử lần nào**. Việc đầu tiên của người nhận là chạy `docker compose up --build` và sửa lỗi phát sinh (xem [04-lo-trinh.md](04-lo-trinh.md#việc-cần-làm-ngay)).
- **Chạy nhanh:**
  ```bash
  git clone https://github.com/vuongtruong97/vt-sys.git && cd vt-sys
  cp .env.example .env
  docker compose up --build
  # mở http://localhost:3000, đăng nhập giaovien@bangden.local / doimatkhau123
  ```

## Cấu trúc repo

```
vt-sys/
├── apps/
│   ├── api/            NestJS + Prisma: tài khoản, khoá học, buổi học, token LiveKit, quyền giáo viên, webhook
│   │   ├── prisma/schema.prisma
│   │   └── src/{auth,courses,classroom,common}/
│   ├── web/            Next.js App Router: các trang và phòng học
│   │   ├── app/        trang: /, /login, /register, /schedule, /teach, /room/[id]
│   │   ├── components/ Nav, AuthForm, room/{Classroom,SidePanel,Whiteboard,shared}
│   │   └── lib/        api client, định dạng giờ, hook useMe
│   └── whiteboard/     Máy chủ Hocuspocus đồng bộ bảng trắng
├── deploy/             Cấu hình máy chủ thật: compose, Caddy, LiveKit
├── docs/               Tài liệu này
├── docker-compose.yml  Chạy thử trên máy
├── livekit.yaml        Cấu hình LiveKit khi chạy trên máy
└── .env.example        Mẫu biến môi trường
```

## Tài liệu thiết kế gốc

Ngoài repo còn hai tài liệu thiết kế, lập ra trước khi viết code (chỉ chủ dự án mở được):

- [Thiết kế hệ thống](https://claude.ai/code/artifact/b82e1a0f-3a82-483f-89a7-2ffd37db78f4): bóc tách module, chọn công nghệ, ước tính tải và cách mở rộng.
- [Bản mẫu giao diện, sơ đồ kiến trúc và các luồng hoạt động](https://claude.ai/artifact/PyRnF4mwiFy21ceUj2EHmG).

Repo này làm theo hai tài liệu đó. Chỗ nào code khác thiết kế đều được ghi trong [04-lo-trinh.md](04-lo-trinh.md#khác-biệt-so-với-thiết-kế).
