'use client';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Avatar, Badge, ButtonLink, Muted, Page, PageHeader, Stat, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Row = {
  user: { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null };
  firstJoin: string | null;
  lastLeave: string | null;
  minutes: number;
  visits: number;
  present: boolean;
};
type Data = { session: { id: string; title: string; startsAt: string; endsAt: string }; rows: Row[] };

export default function AttendancePage({ params }: { params: { id: string } }) {
  const me = useMe({ redirect: true });
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (me) api<Data>(`/sessions/${params.id}/attendance`).then(setData).catch((e) => setError(e.message));
  }, [me, params.id]);

  const present = data?.rows.filter((r) => r.present).length ?? 0;
  const avgMinutes = data && present ? Math.round(data.rows.filter((r) => r.present).reduce((a, r) => a + r.minutes, 0) / present) : 0;

  return (
    <>
      <Nav me={me} />
      <Page>
        {error && <Alert tone="error">{error}</Alert>}
        {!data && !error && <Muted>Đang tải…</Muted>}
        {data && (
          <>
            <PageHeader
              back={{ href: '/schedule', label: 'Lịch học' }}
              title={`Điểm danh · ${data.session.title}`}
              description={`${fmtDay(data.session.startsAt)}, ${fmtTime(data.session.startsAt)} – ${fmtTime(data.session.endsAt)}`}
              actions={<ButtonLink href={`/sessions/${data.session.id}`} variant="outline">Ghi hình, tài liệu</ButtonLink>}
            />
            <div className="ui-stats">
              <Stat value={`${present}/${data.rows.length}`} label="có mặt" />
              <Stat value={data.rows.length - present} label="vắng" />
              <Stat value={`${avgMinutes} phút`} label="thời gian trung bình" />
            </div>
            <Table caption="Điểm danh học viên">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Trạng thái</th>
                  <th>Vào lúc</th>
                  <th>Rời lúc</th>
                  <th>Thời gian</th>
                  <th>Số lần vào</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.user.id}>
                    <td>
                      <span className="ui-who">
                              <Avatar name={r.user.name} src={r.user.avatarUrl} size={32} decorative />
                              <span>
                                {r.user.name}
                                <span className="ui-sub">{[r.user.email, r.user.phone].filter(Boolean).join(' · ')}</span>
                              </span>
                            </span>
                    </td>
                    <td>
                      <Badge variant={r.present ? 'soft' : 'neutral'}>{r.present ? 'Có mặt' : 'Vắng'}</Badge>
                    </td>
                    <td className="ui-num">{r.firstJoin ? fmtTime(r.firstJoin) : '—'}</td>
                    <td className="ui-num">{r.lastLeave ? fmtTime(r.lastLeave) : r.present ? 'Đang trong lớp' : '—'}</td>
                    <td className="ui-num">{r.minutes} phút</td>
                    <td className="ui-num">{r.visits}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Muted small>Dữ liệu ghi tự động từ sự kiện vào/ra phòng của LiveKit.</Muted>
          </>
        )}
      </Page>
    </>
  );
}
