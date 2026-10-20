const tz = 'Asia/Ho_Chi_Minh';

export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: tz });

export const fmtDay = (d: string | Date) => {
  const date = new Date(d);
  const today = new Date();
  const key = (x: Date) => x.toLocaleDateString('vi-VN', { timeZone: tz });
  if (key(date) === key(today)) return 'Hôm nay';
  const tomorrow = new Date(today.getTime() + 86400_000);
  if (key(date) === key(tomorrow)) return 'Ngày mai';
  return date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: tz });
};

/** Giá trị cho <input type="datetime-local"> theo giờ máy người dùng. */
export const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const OPEN_BEFORE_MIN = 10;
export const CLOSE_AFTER_MIN = 30;

/** Trạng thái nút "Vào phòng" của học viên. */
export function joinState(s: { startsAt: string; endsAt: string; status: string }, now = Date.now()) {
  if (s.status === 'CANCELLED') return { open: false, label: 'Đã huỷ' };
  if (s.status === 'LIVE') return { open: true, label: 'Vào phòng' };
  const opens = new Date(s.startsAt).getTime() - OPEN_BEFORE_MIN * 60_000;
  const closes = new Date(s.endsAt).getTime() + CLOSE_AFTER_MIN * 60_000;
  if (s.status === 'ENDED' || now > closes) return { open: false, label: 'Đã kết thúc' };
  if (now < opens) return { open: false, label: `Mở lúc ${fmtTime(new Date(opens))}` };
  return { open: true, label: 'Vào phòng' };
}
