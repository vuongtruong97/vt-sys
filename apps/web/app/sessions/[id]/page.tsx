'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Materials } from '@/components/Materials';
import { Nav } from '@/components/Nav';
import { Recordings } from '@/components/Recordings';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Info = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  course: { id: string; title: string };
  role: 'teacher' | 'student' | null;
};

/** Xem lại buổi học: bản ghi hình và tài liệu. */
export default function SessionReviewPage({ params }: { params: { id: string } }) {
  const me = useMe({ redirect: true });
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (me) api<Info>(`/sessions/${params.id}`).then(setInfo).catch((e) => setError(e.message));
  }, [me, params.id]);

  const teacher = info?.role === 'teacher';

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <p className="small"><Link href="/schedule">← Lịch học</Link></p>
        {error && <p className="error" role="alert">{error}</p>}
        {info && !info.role && <p className="error">Bạn chưa được vào khoá học này.</p>}
        {info?.role && (
          <>
            <div className="row spread">
              <div className="stack" style={{ gap: 4 }}>
                <h1>{info.course.title} · {info.title}</h1>
                <p className="muted">{fmtDay(info.startsAt)}, {fmtTime(info.startsAt)} – {fmtTime(info.endsAt)}</p>
              </div>
              {teacher && <Link className="btn ghost" href={`/teach/sessions/${info.id}`}>Điểm danh</Link>}
            </div>
            <div className="grid2">
              <section className="stack">
                <h2>Bản ghi hình</h2>
                <Recordings sessionId={info.id} canEdit={teacher} />
              </section>
              <section className="stack">
                <h2>Tài liệu</h2>
                <Materials courseId={info.course.id} sessionId={info.id} canEdit={teacher} />
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
