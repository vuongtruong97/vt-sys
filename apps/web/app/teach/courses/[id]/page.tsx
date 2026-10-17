'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Materials } from '@/components/Materials';
import { Nav } from '@/components/Nav';
import { api } from '@/lib/api';
import { fmtDay, fmtTime, toLocalInput } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Session = { id: string; title: string; startsAt: string; endsAt: string; status: string };
type Course = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  sessions: Session[];
  enrollments: { id: string; user: { id: string; name: string; email: string } }[];
};

const statusLabel: Record<string, string> = { SCHEDULED: 'Đã lên lịch', LIVE: 'Đang diễn ra', ENDED: 'Đã kết thúc', CANCELLED: 'Đã huỷ' };

export default function CoursePage({ params }: { params: { id: string } }) {
  const me = useMe({ redirect: true });
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => api<Course>(`/courses/${params.id}`).then(setCourse).catch((e) => setError(e.message)), [params.id]);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError('');
    setMsg('');
    try {
      await fn();
      if (ok) setMsg(ok);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addSession = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const start = new Date(String(f.get('startsAt')));
    const end = new Date(start.getTime() + Number(f.get('minutes')) * 60_000);
    run(() => api(`/courses/${params.id}/sessions`, { json: { title: f.get('title'), startsAt: start.toISOString(), endsAt: end.toISOString() } }), 'Đã thêm buổi học').then(() => form.reset());
  };

  const enroll = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get('email'));
    run(() => api(`/courses/${params.id}/enrollments`, { json: { email } }), `Đã thêm ${email} vào lớp`).then(() => form.reset());
  };

  const defaultStart = new Date(Date.now() + 24 * 3600_000);
  defaultStart.setHours(19, 30, 0, 0);

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <p className="small"><Link href="/teach">← Quản lý lớp</Link></p>
        {!course && !error && <p className="muted">Đang tải…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {msg && <p className="small" role="status" style={{ color: 'var(--good)' }}>{msg}</p>}
        {course && (
          <>
            <div className="row spread">
              <div className="stack" style={{ gap: 4 }}>
                <h1>{course.title}</h1>
                <p className="muted">{course.description}</p>
              </div>
              <label className="switch" htmlFor="pub">
                <input id="pub" type="checkbox" checked={course.published}
                  onChange={(e) => run(() => api(`/courses/${course.id}`, { method: 'PATCH', json: { published: e.target.checked } }))} />
                Hiện trên trang chủ
              </label>
            </div>

            <div className="grid2">
              <section className="stack">
                <h2>Buổi học</h2>
                {course.sessions.length === 0 && <p className="muted">Chưa có buổi nào.</p>}
                <div className="list">
                  {course.sessions.map((s) => (
                    <div key={s.id} className="item">
                      <div className="when"><b>{fmtTime(s.startsAt)}</b><span>{fmtDay(s.startsAt)}</span></div>
                      <div className="info">
                        <span className="t">{s.title}</span>
                        <span className="small muted">{statusLabel[s.status]} · đến {fmtTime(s.endsAt)}</span>
                      </div>
                      <div className="row">
                        {s.status !== 'CANCELLED' && <Link className="btn sm" href={`/room/${s.id}`}>Mở lớp</Link>}
                        <Link className="btn ghost sm" href={`/teach/sessions/${s.id}`}>Điểm danh</Link>
                        <Link className="btn ghost sm" href={`/sessions/${s.id}`}>Ghi hình, tài liệu</Link>
                        {s.status === 'SCHEDULED' && (
                          <button className="btn ghost sm" onClick={() => run(() => api(`/sessions/${s.id}`, { method: 'PATCH', json: { cancelled: true } }), 'Đã huỷ buổi học')}>Huỷ</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <form className="card stack" onSubmit={addSession}>
                  <h3>Thêm buổi học</h3>
                  <label className="field" htmlFor="s-title">Tên buổi<input id="s-title" name="title" required placeholder={`Buổi ${course.sessions.length + 1}: …`} /></label>
                  <div className="row">
                    <label className="field" htmlFor="s-start" style={{ flex: 2, minWidth: 200 }}>Bắt đầu
                      <input id="s-start" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(defaultStart)} />
                    </label>
                    <label className="field" htmlFor="s-min" style={{ flex: 1, minWidth: 120 }}>Thời lượng
                      <select id="s-min" name="minutes" defaultValue="90">
                        <option value="45">45 phút</option><option value="60">60 phút</option><option value="90">90 phút</option><option value="120">120 phút</option>
                      </select>
                    </label>
                  </div>
                  <button className="btn">Thêm buổi học</button>
                </form>
              </section>

              <section className="stack">
                <h2>Học viên ({course.enrollments.length})</h2>
                <form className="row" onSubmit={enroll}>
                  <label className="field" htmlFor="e-email" style={{ flex: 1, minWidth: 200 }}>Thêm bằng email
                    <input id="e-email" name="email" type="email" required placeholder="hocvien@gmail.com" />
                  </label>
                  <button className="btn" style={{ alignSelf: 'end' }}>Thêm</button>
                </form>
                <p className="small muted">Học viên cần tạo tài khoản trước. Người chưa có trong danh sách vẫn xin vào được qua phòng chờ.</p>
                <div className="tbl">
                  <table>
                    <thead><tr><th>Họ tên</th><th>Email</th><th /></tr></thead>
                    <tbody>
                      {course.enrollments.map((e) => (
                        <tr key={e.id}>
                          <td>{e.user.name}</td>
                          <td>{e.user.email}</td>
                          <td><button className="btn ghost sm" onClick={() => run(() => api(`/courses/${course.id}/enrollments/${e.user.id}`, { method: 'DELETE' }), `Đã xoá ${e.user.name} khỏi lớp`)}>Xoá</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="stack">
              <h2>Tài liệu của khoá</h2>
              <p className="small muted">Tài liệu tải lên ở đây dùng chung cho mọi buổi. Tài liệu riêng từng buổi tải trong trang "Ghi hình, tài liệu" của buổi đó hoặc ngay trong phòng học.</p>
              <Materials courseId={course.id} canEdit />
            </section>
          </>
        )}
      </main>
    </>
  );
}
