'use client';
import { useEffect, useState } from 'react';
import { Materials } from '@/components/Materials';
import { Nav } from '@/components/Nav';
import { Recordings } from '@/components/Recordings';
import { Alert, ButtonLink, Muted, Page, PageHeader, Section } from '@/components/ui';
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

  // Ghi hình đang tắt trên máy chủ và buổi chưa có bản ghi nào thì ẩn khối "Bản ghi hình".
  const [showRecordings, setShowRecordings] = useState(true);

  useEffect(() => {
    if (!me) return;
    api<Info>(`/sessions/${params.id}`).then(setInfo).catch((e) => setError(e.message));
    Promise.all([api<{ recording: boolean }>('/features'), api<unknown[]>(`/sessions/${params.id}/recordings`)])
      .then(([f, recs]) => setShowRecordings(!!f.recording || recs.length > 0))
      .catch(() => {});
  }, [me, params.id]);

  const teacher = info?.role === 'teacher';

  return (
    <>
      <Nav me={me} />
      <Page>
        {error && <Alert tone="error">{error}</Alert>}
        {!info && !error && <Muted>Đang tải…</Muted>}
        {info && !info.role && <Alert tone="error">Bạn chưa được vào khoá học này.</Alert>}
        {info?.role && (
          <>
            <PageHeader
              back={{ href: '/schedule', label: 'Lịch học' }}
              title={`${info.course.title} · ${info.title}`}
              description={`${fmtDay(info.startsAt)}, ${fmtTime(info.startsAt)} – ${fmtTime(info.endsAt)}`}
              actions={teacher && <ButtonLink href={`/teach/sessions/${info.id}`} variant="outline">Điểm danh</ButtonLink>}
            />
            <div className="ui-cols">
              {showRecordings && (
                <Section title="Bản ghi hình">
                  <Recordings sessionId={info.id} canEdit={teacher} />
                </Section>
              )}
              <Section title="Tài liệu">
                <Materials courseId={info.course.id} sessionId={info.id} canEdit={teacher} />
              </Section>
            </div>
          </>
        )}
      </Page>
    </>
  );
}
