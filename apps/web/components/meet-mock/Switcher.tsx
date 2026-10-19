'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/** Mọi màn hình của bộ mockup, dùng cho thanh chọn và trang mục lục. */
export const SCREENS: { href: string; label: string; group: string; desc: string }[] = [
  { group: 'Vào lớp', href: '/ui/meeting/prejoin', label: 'Kiểm tra thiết bị', desc: 'Xem trước camera, bật tắt micro, chọn thiết bị, ai đang trong lớp.' },
  { group: 'Vào lớp', href: '/ui/meeting/waiting', label: 'Chờ duyệt', desc: 'Học viên chưa có trong danh sách lớp chờ giáo viên cho vào.' },
  { group: 'Vào lớp', href: '/ui/meeting/left', label: 'Đã rời lớp', desc: 'Vào lại, đánh giá buổi học, tóm tắt thời gian học.' },
  { group: 'Vào lớp', href: '/ui/meeting/ended', label: 'Buổi học kết thúc', desc: 'Giáo viên kết thúc buổi, liên kết xem lại.' },
  { group: 'Phòng học', href: '/ui/meeting/room?layout=grid', label: 'Lưới', desc: 'Cả lớp dạng lưới, người đang nói có viền sáng, tay giơ.' },
  { group: 'Phòng học', href: '/ui/meeting/room?layout=speaker', label: 'Người nói', desc: 'Người đang nói khung lớn, dải người bên cạnh.' },
  { group: 'Phòng học', href: '/ui/meeting/room?layout=screen', label: 'Chia sẻ màn hình', desc: 'Slide và code của giáo viên, dải người bên cạnh.' },
  { group: 'Phòng học', href: '/ui/meeting/room?layout=board', label: 'Bảng trắng', desc: 'Bảng phấn chung, thanh công cụ, con trỏ người khác.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=people', label: 'Người tham gia', desc: 'Giơ tay, phòng chờ, tắt mic, ghim, mời ra.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=chat', label: 'Trò chuyện', desc: 'Tin ghim, tin nhắn, cho phép học viên nhắn.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=quiz', label: 'Câu hỏi nhanh', desc: 'Kết quả trực tiếp và tạo câu hỏi mới.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=breakout', label: 'Chia nhóm', desc: 'Xếp nhóm, đếm giờ, nhắn mọi nhóm, gọi về.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=files', label: 'Tài liệu', desc: 'Tài liệu của buổi học, tải lên.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=activities', label: 'Hoạt động', desc: 'Ghi hình, phát trực tiếp, câu hỏi, chia nhóm.' },
  { group: 'Bảng bên', href: '/ui/meeting/room?panel=info', label: 'Thông tin buổi học', desc: 'Liên kết, mã phòng, lịch, quyền.' },
  { group: 'Cài đặt', href: '/ui/meeting/room?modal=settings', label: 'Cài đặt', desc: 'Âm thanh, video, bố cục, quyền của học viên.' },
  { group: 'Cài đặt', href: '/ui/meeting/room?modal=record', label: 'Bắt đầu ghi hình', desc: 'Xác nhận trước khi ghi, thông báo cho cả lớp.' },
  { group: 'Cài đặt', href: '/ui/meeting/room?menu=more', label: 'Menu thêm', desc: 'Bố cục, toàn màn hình, phụ đề, báo lỗi…' },
  { group: 'Cài đặt', href: '/ui/meeting/room?menu=react', label: 'Cảm xúc', desc: 'Thả cảm xúc nổi lên màn hình.' },
];

/** Thanh nổi trên cùng để nhảy nhanh giữa các màn hình mockup. */
export function Switcher() {
  const path = usePathname();
  const q = useSearchParams();
  const current = path + (q.toString() ? `?${q}` : '');
  const quick = SCREENS.filter((s) => ['Kiểm tra thiết bị', 'Chờ duyệt', 'Lưới', 'Chia sẻ màn hình', 'Bảng trắng', 'Người tham gia', 'Trò chuyện', 'Cài đặt', 'Đã rời lớp'].includes(s.label));
  return (
    <nav className="mt-switcher" aria-label="Chọn màn hình mockup">
      <Link className="mt-switcher__home" href="/ui/meeting" aria-current={path === '/ui/meeting' ? 'page' : undefined}>
        Mockup
      </Link>
      <span className="mt-switcher__sep" aria-hidden />
      {quick.map((s) => (
        <Link key={s.href} href={s.href} aria-current={current === s.href ? 'page' : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
