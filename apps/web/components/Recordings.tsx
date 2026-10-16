'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtTime } from '@/lib/format';
import { fmtSize, openSigned } from './Materials';

type Recording = {
  id: string;
  status: 'STARTING' | 'RECORDING' | 'PROCESSING' | 'READY' | 'FAILED';
  durationSec: number | null;
  sizeBytes: number | null;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
};

const label: Record<Recording['status'], string> = {
  STARTING: 'Đang bắt đầu',
  RECORDING: 'Đang ghi',
  PROCESSING: 'Đang xử lý',
  READY: 'Xem được',
  FAILED: 'Lỗi',
};

const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} giờ ${m} phút` : `${Math.max(1, m)} phút`;
};

/** Bản ghi hình của một buổi. Giáo viên thấy cả bản đang xử lý và xoá được. */
export function Recordings({ sessionId, canEdit }: { sessionId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Recording[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api<Recording[]>(`/sessions/${sessionId}/recordings`).then(setItems).catch((e) => setError(e.message)),
    [sessionId],
  );
  useEffect(() => {
    load();
  }, [load]);
  // Bản ghi đang xử lý thì kiểm tra lại mỗi 10 giây.
  const pending = items?.some((r) => r.status !== 'READY' && r.status !== 'FAILED');
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [pending, load]);

  const remove = async (r: Recording) => {
    if (!window.confirm('Xoá bản ghi này? Học viên sẽ không xem lại được nữa.')) return;
    try {
      await api(`/recordings/${r.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {error && <p className="error" role="alert">{error}</p>}
      {items === null && !error && <p className="muted small">Đang tải…</p>}
      {items?.length === 0 && <p className="muted small">Buổi này chưa có bản ghi hình.</p>}
      {items?.map((r, i) => (
        <div key={r.id} className="item">
          <div className="info">
            <span className="t">🎬 Bản ghi {i + 1} · bắt đầu {fmtTime(r.startedAt)}</span>
            <span className="small muted">
              <span className={`tag${r.status === 'READY' ? '' : ' off'}`}>{label[r.status]}</span>
              {r.durationSec != null && fmtDuration(r.durationSec)}
              {r.sizeBytes != null && ` · ${fmtSize(r.sizeBytes)}`}
              {r.status === 'FAILED' && r.error && ` · ${r.error}`}
            </span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {r.status === 'READY' && <button className="btn sm" onClick={() => openSigned(`/recordings/${r.id}/url`, setError)}>Xem lại</button>}
            {canEdit && r.status !== 'STARTING' && r.status !== 'RECORDING' && (
              <button className="btn ghost sm" onClick={() => remove(r)}>Xoá</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
