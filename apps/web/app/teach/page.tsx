'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { api } from '@/lib/api';
import { useMe } from '@/lib/useMe';

type Course = { id: string; title: string; description: string; published: boolean; _count: { enrollments: number; sessions: number } };

export default function TeachPage() {
  const me = useMe({ redirect: true });
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState('');

  const load = () => api<Course[]>('/courses').then(setCourses).catch((e) => setError(e.message));
  useEffect(() => {
    if (me?.role === 'TEACHER') load();
  }, [me]);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError('');
    try {
      await api('/courses', { json: { title: f.get('title'), description: f.get('description'), published: f.get('published') === 'on' } });
      form.reset();
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (me && me.role !== 'TEACHER') {
    return (<><Nav me={me} /><main className="container page"><p>Trang này chỉ dành cho giáo viên.</p></main></>);
  }

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <h1>Quản lý lớp</h1>
        <div className="grid2">
          <section className="stack">
            <h2>Khoá học của bạn</h2>
            {courses === null && <p className="muted">Đang tải…</p>}
            {courses?.length === 0 && <p className="muted">Chưa có khoá học. Tạo khoá đầu tiên ở bên cạnh.</p>}
            <div className="list">
              {courses?.map((c) => (
                <Link key={c.id} href={`/teach/courses/${c.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="row spread">
                    <h3>{c.title}</h3>
                    <span className={`tag${c.published ? '' : ' off'}`}>{c.published ? 'Công khai' : 'Nháp'}</span>
                  </div>
                  <p className="small muted">{c._count.sessions} buổi · {c._count.enrollments} học viên</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="card">
            <form className="stack" onSubmit={create}>
              <h2>Tạo khoá học</h2>
              <label className="field" htmlFor="c-title">Tên khoá học<input id="c-title" name="title" required minLength={3} placeholder="Python cơ bản" /></label>
              <label className="field" htmlFor="c-desc">Mô tả<textarea id="c-desc" name="description" rows={3} /></label>
              <label className="switch" htmlFor="c-pub"><input id="c-pub" name="published" type="checkbox" />Hiện trên trang chủ</label>
              {error && <p className="error">{error}</p>}
              <button className="btn">Tạo khoá học</button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
