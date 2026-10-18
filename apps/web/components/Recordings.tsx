'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtTime } from '@/lib/format';
import { fmtSize, openSigned } from './Materials';
import { Alert, Badge, Button, ListRow, Muted } from '@/components/ui';

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
    <div className="ui-list">
      {error && <Alert tone="error">{error}</Alert>}
      {items === null && !error && <Muted small>Đang tải…</Muted>}
      {items?.length === 0 && <Muted small>Buổi này chưa có bản ghi hình.</Muted>}
      {items?.map((r, i) => (
        <ListRow
          key={r.id}
          title={`🎬 Bản ghi ${i + 1} · bắt đầu ${fmtTime(r.startedAt)}`}
          meta={
            <>
              <Badge variant={r.status === 'READY' ? 'soft' : 'neutral'}>{label[r.status]}</Badge>
              {r.durationSec != null && fmtDuration(r.durationSec)}
              {r.sizeBytes != null && ` · ${fmtSize(r.sizeBytes)}`}
              {r.status === 'FAILED' && r.error && ` · ${r.error}`}
            </>
          }
          actions={
            <>
              {r.status === 'READY' && <Button size="sm" onClick={() => openSigned(`/recordings/${r.id}/url`, setError)}>Xem lại</Button>}
              {canEdit && r.status !== 'STARTING' && r.status !== 'RECORDING' && (
                <Button variant="ghost" size="sm" onClick={() => remove(r)}>Xoá</Button>
              )}
            </>
          }
        />
      ))}
    </div>
  );
}
