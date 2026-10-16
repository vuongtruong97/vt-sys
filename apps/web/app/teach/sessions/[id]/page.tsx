'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Row = {
  user: { id: string; name: string; email: string };
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

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <p className="small"><Link href="/schedule">← Lịch học</Link></p>
        {error && <p className="error">{error}</p>}
        {data && (
          <>
            <div className="stack" style={{ gap: 4 }}>
              <h1>Điểm danh · {data.session.title}</h1>
              <p className="muted">
                {fmtDay(data.session.startsAt)}, {fmtTime(data.session.startsAt)} – {fmtTime(data.session.endsAt)} · có mặt {present}/{data.rows.length}
              </p>
            </div>
            <div className="tbl">
              <table>
                <thead><tr><th>Học viên</th><th>Trạng thái</th><th>Vào lúc</th><th>Rời lúc</th><th>Thời gian</th><th>Số lần vào</th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.user.id}>
                      <td>{r.user.name}<br /><span className="small muted">{r.user.email}</span></td>
                      <td><span className={`tag${r.present ? '' : ' off'}`}>{r.present ? 'Có mặt' : 'Vắng'}</span></td>
                      <td className="num">{r.firstJoin ? fmtTime(r.firstJoin) : '—'}</td>
                      <td className="num">{r.lastLeave ? fmtTime(r.lastLeave) : r.present ? 'Đang trong lớp' : '—'}</td>
                      <td className="num">{r.minutes} phút</td>
                      <td className="num">{r.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">Dữ liệu ghi tự động từ sự kiện vào/ra phòng của LiveKit.</p>
          </>
        )}
      </main>
    </>
  );
}
