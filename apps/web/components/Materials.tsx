'use client';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import { Alert, Button, ListRow, Muted } from '@/components/ui';

export type Material = { id: string; name: string; contentType: string; sizeBytes: number; sessionId: string | null; createdAt: string };

export const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;

/** Mở link tải có hạn do API ký. */
export async function openSigned(path: string, onError: (m: string) => void) {
  // Mở tab trước khi chờ API, tránh trình duyệt chặn cửa sổ bật lên.
  const tab = window.open('', '_blank');
  try {
    const { url } = await api<{ url: string }>(path);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    onError((e as Error).message);
  }
}

/**
 * Danh sách tài liệu của khoá. Có `sessionId` thì hiện tài liệu của buổi đó và tài liệu chung.
 * Giáo viên tải lên được (gắn vào buổi nếu có `sessionId`) và xoá.
 */
export function Materials(props: {
  courseId: string;
  sessionId?: string;
  canEdit: boolean;
  /** Giao diện tối trong phòng học. */
  room?: boolean;
  onMessage?: (m: string) => void;
}) {
  const { courseId, sessionId, canEdit, room } = props;
  const [items, setItems] = useState<Material[] | null>(null);
  const [storage, setStorage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const say = useCallback((m: string) => (props.onMessage ? props.onMessage(m) : setError(m)), [props.onMessage]);

  const load = useCallback(
    () =>
      api<Material[]>(`/courses/${courseId}/materials${sessionId ? `?sessionId=${sessionId}` : ''}`)
        .then(setItems)
        .catch((e) => {
          setItems([]);
          say(e.message);
        }),
    [courseId, sessionId, say],
  );
  useEffect(() => {
    load();
    api<{ storage: boolean }>('/features').then((f) => setStorage(f.storage)).catch(() => {});
  }, [load]);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        if (sessionId) fd.append('sessionId', sessionId);
        await api(`/courses/${courseId}/materials`, { method: 'POST', body: fd });
      }
      say(files.length > 1 ? `Đã tải lên ${files.length} tài liệu` : `Đã tải lên ${files[0].name}`);
      await load();
    } catch (err) {
      say((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Material) => {
    if (!window.confirm(`Xoá tài liệu "${m.name}"?`)) return;
    try {
      await api(`/materials/${m.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      say((e as Error).message);
    }
  };

  if (!room) {
    // Trang thường: dùng components/ui. Trong phòng học (nền tối) giữ kiểu riêng ở phía dưới.
    return (
      <div className="ui-list">
        {canEdit && storage && (
          <div className="ui-actions">
            <input ref={input} type="file" multiple hidden onChange={upload} />
            <Button size="sm" loading={busy} onClick={() => input.current?.click()}>
              {busy ? 'Đang tải lên…' : sessionId ? 'Tải tài liệu cho buổi này' : 'Tải tài liệu lên'}
            </Button>
          </div>
        )}
        {canEdit && !storage && <Alert tone="info">Chưa cấu hình nơi lưu trữ nên chưa tải tài liệu lên được.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        {items === null && <Muted small>Đang tải…</Muted>}
        {items?.length === 0 && <Muted small>Chưa có tài liệu.</Muted>}
        {items?.map((m) => (
          <ListRow
            key={m.id}
            title={`📄 ${m.name}`}
            meta={`${fmtSize(m.sizeBytes)} · ${fmtDay(m.createdAt)} · ${m.sessionId ? 'theo buổi' : 'tài liệu chung'}`}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => openSigned(`/materials/${m.id}/url`, say)}>Mở</Button>
                {canEdit && <Button variant="ghost" size="sm" onClick={() => remove(m)}>Xoá</Button>}
              </>
            }
          />
        ))}
      </div>
    );
  }

  const btn = 'mini';

  return (
    <div className="stack" style={{ gap: 8 }}>
      {canEdit && storage && (
        <div className="row" style={{ gap: 8 }}>
          <input ref={input} type="file" multiple hidden onChange={upload} />
          <button className={room ? 'mini pri' : 'btn sm'} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Đang tải lên…' : sessionId ? 'Tải tài liệu cho buổi này' : 'Tải tài liệu lên'}
          </button>
        </div>
      )}
      {canEdit && !storage && <p className={room ? 'sub' : 'small muted'}>Chưa cấu hình nơi lưu trữ nên chưa tải tài liệu lên được.</p>}
      {!room && error && <p className="error" role="alert">{error}</p>}
      {items === null && <p className={room ? 'sub' : 'muted small'}>Đang tải…</p>}
      {items?.length === 0 && <p className={room ? 'sub' : 'muted small'}>Chưa có tài liệu.</p>}
      {items?.map((m) => (
        <div key={m.id} className={room ? 'person' : 'item'}>
          <span className={room ? 'pn' : 'info'} style={{ minWidth: 0 }}>
            <span className={room ? '' : 't'} style={{ overflowWrap: 'anywhere' }}>📄 {m.name}</span>
            {!room && (
              <span className="small muted">
                {fmtSize(m.sizeBytes)} · {fmtDay(m.createdAt)}
                {m.sessionId ? ' · theo buổi' : ' · tài liệu chung'}
              </span>
            )}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button className={btn} onClick={() => openSigned(`/materials/${m.id}/url`, say)}>Mở</button>
            {canEdit && <button className={room ? 'mini warn' : 'btn ghost sm'} onClick={() => remove(m)}>Xoá</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
