'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { api, ScheduleItem } from '@/lib/api';
import { fmtDay, fmtTime, joinState } from '@/lib/format';
import { useMe } from '@/lib/useMe';

export default function SchedulePage() {
  const me = useMe({ redirect: true });
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!me) return;
    api<ScheduleItem[]>('/schedule').then(setItems).catch(() => setItems([]));
    // Cập nhật nút Vào lớp mỗi 30 giây.
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [me]);

  const now = Date.now();
  const upcoming = items?.filter((s) => new Date(s.endsAt).getTime() > now - 30 * 60_000) ?? [];
  const past = items?.filter((s) => new Date(s.endsAt).getTime() <= now - 30 * 60_000).reverse() ?? [];
  const teacher = me?.role === 'TEACHER';

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <div className="row spread">
          <div>
            <h1>Lịch học</h1>
            <p className="muted small">Học viên vào được lớp từ 10 phút trước giờ học.</p>
          </div>
          {teacher && <Link className="btn ghost" href="/teach">Tạo buổi học</Link>}
        </div>

        {items === null && <p className="muted">Đang tải…</p>}
        {items && upcoming.length === 0 && (
          <div className="card">
            <p>Chưa có buổi học nào sắp tới.</p>
            <p className="muted small">
              {teacher ? 'Vào Quản lý lớp để tạo khoá học và lên lịch buổi đầu tiên.' : 'Khi giáo viên thêm bạn vào khoá học, lịch sẽ hiện ở đây.'}
            </p>
          </div>
        )}

        <div className="list">
          {upcoming.map((s) => {
            const st = teacher ? { open: s.status !== 'CANCELLED', label: s.status === 'LIVE' ? 'Vào lại lớp' : 'Mở lớp' } : joinState(s, now);
            const live = s.status === 'LIVE';
            return (
              <div key={s.id} className={`item${st.open ? ' now' : ''}`}>
                <div className="when"><b>{fmtTime(s.startsAt)}</b><span>{fmtDay(s.startsAt)}</span></div>
                <div className="info">
                  <span className="t">{s.course.title} · {s.title}</span>
                  <span className="small muted">
                    {live && <span className="tag">Đang diễn ra</span>}
                    {s.status === 'CANCELLED' && <span className="tag off">Đã huỷ</span>}
                    {fmtTime(s.startsAt)} – {fmtTime(s.endsAt)} · {s.students} học viên
                  </span>
                </div>
                {st.open ? <Link className="btn" href={`/room/${s.id}`}>{st.label}</Link> : <button className="btn" disabled>{st.label}</button>}
              </div>
            );
          })}
        </div>

        {past.length > 0 && (
          <section className="stack">
            <h2>Đã học</h2>
            <div className="list">
              {past.map((s) => (
                <div key={s.id} className="item">
                  <div className="when"><b>{fmtTime(s.startsAt)}</b><span>{fmtDay(s.startsAt)}</span></div>
                  <div className="info"><span className="t">{s.course.title} · {s.title}</span></div>
                  {teacher ? <Link className="btn ghost sm" href={`/teach/sessions/${s.id}`}>Điểm danh</Link> : <span />}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
