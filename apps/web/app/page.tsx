'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type PublicCourse = {
  id: string;
  title: string;
  description: string;
  teacher: string;
  students: number;
  sessions: number;
  nextSession: string | null;
};

export default function Home() {
  const me = useMe();
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);
  useEffect(() => {
    api<PublicCourse[]>('/courses/public').then(setCourses).catch(() => setCourses([]));
  }, []);

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <section className="stack" style={{ maxWidth: 680 }}>
          <h1>Học trực tiếp cùng giáo viên, ở bất cứ đâu</h1>
          <p className="muted">
            Lớp học video nhiều người, chia sẻ màn hình, bảng trắng chung và bản ghi điểm danh sau mỗi buổi.
          </p>
          <div className="row">
            {me ? (
              <Link className="btn" href="/schedule">Xem lịch học</Link>
            ) : (
              <>
                <Link className="btn" href="/register">Tạo tài khoản học viên</Link>
                <Link className="btn ghost" href="/login">Đăng nhập</Link>
              </>
            )}
          </div>
        </section>

        <section className="stack">
          <h2>Khoá học đang mở</h2>
          {courses === null && <p className="muted">Đang tải…</p>}
          {courses?.length === 0 && <p className="muted">Chưa có khoá học công khai.</p>}
          <div className="courses">
            {courses?.map((c) => (
              <article key={c.id} className="card stack">
                <h3>{c.title}</h3>
                <p className="muted small">{c.description || 'Chưa có mô tả.'}</p>
                <p className="small">
                  {c.teacher} · {c.sessions} buổi · {c.students} học viên
                </p>
                {c.nextSession && (
                  <p className="small"><span className="tag">Buổi tới</span>{fmtDay(c.nextSession)}, {fmtTime(c.nextSession)}</p>
                )}
              </article>
            ))}
          </div>
          <p className="small muted">Muốn tham gia khoá học? Đăng ký tài khoản rồi gửi email cho giáo viên để được thêm vào lớp.</p>
        </section>
      </main>
    </>
  );
}
