'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Button, Muted } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { GgbApi } from '@/lib/geogebra';
import { useMe } from '@/lib/useMe';

// Tách GeoGebra khỏi bundle chung: chỉ tải khi mở trang này.
const GeoGebraBoard = dynamic(() => import('@/components/geogebra/GeoGebraBoard').then((m) => m.GeoGebraBoard), { ssr: false });

type Doc = { id: string; title: string; appName: 'classic'; base64: string; version: number; canEdit: boolean; sessionId: string | null };
type SaveState = 'saved' | 'saving' | 'dirty' | 'error' | 'conflict';

const LABEL: Record<SaveState, string> = {
  saved: 'Đã lưu',
  saving: 'Đang lưu…',
  dirty: 'Chưa lưu',
  error: 'Chưa lưu được, sẽ thử lại khi bạn vẽ tiếp',
  conflict: 'Bài đã được sửa ở nơi khác. Tải lại trang để lấy bản mới nhất.',
};

/** Thu nhỏ ảnh cho danh sách tối đa mỗi 30 giây. */
const THUMB_EVERY = 30_000;

export default function GgbEditorPage({ params }: { params: { id: string } }) {
  const me = useMe({ redirect: true });
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [state, setState] = useState<SaveState>('saved');
  const [title, setTitle] = useState('');
  // next/dynamic không chuyển ref, nên giữ api nhận từ onReady.
  const board = useRef<GgbApi | null>(null);
  const version = useRef(0);
  // Một lần lưu tại một thời điểm; trong lúc đang lưu mà bài đổi tiếp thì lưu bản mới nhất ngay sau đó.
  const inFlight = useRef(false);
  const pending = useRef<string | null>(null);
  const lastThumb = useRef(0);

  useEffect(() => {
    if (!me) return;
    api<Doc>(`/ggb-documents/${params.id}`)
      .then((d) => {
        version.current = d.version;
        setTitle(d.title);
        setDoc(d);
      })
      .catch((e) => setError(e.message));
  }, [me, params.id]);

  const uploadThumb = useCallback(() => {
    if (Date.now() - lastThumb.current < THUMB_EVERY) return;
    const raw = board.current?.getPNGBase64(0.4, false, 72);
    if (!raw) return;
    const png = `data:image/png;base64,${raw}`;
    lastThumb.current = Date.now();
    api(`/ggb-documents/${params.id}/thumbnail`, { method: 'PUT', json: { png } }).catch(() => {});
  }, [params.id]);

  const save = useCallback(
    async (base64: string) => {
      if (inFlight.current) {
        pending.current = base64;
        return;
      }
      inFlight.current = true;
      setState('saving');
      try {
        const r = await api<{ version: number }>(`/ggb-documents/${params.id}`, { method: 'PUT', json: { base64, version: version.current } });
        version.current = r.version;
        setState(pending.current ? 'dirty' : 'saved');
        uploadThumb();
      } catch (e) {
        setState(e instanceof ApiError && e.status === 409 ? 'conflict' : 'error');
        pending.current = null;
      } finally {
        inFlight.current = false;
        const next = pending.current;
        pending.current = null;
        if (next) save(next);
      }
    },
    [params.id, uploadThumb],
  );

  const onChange = useCallback(
    (base64: string) => {
      if (state === 'conflict') return;
      setState('dirty');
      save(base64);
    },
    [save, state],
  );

  // Đóng tab khi còn thay đổi chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === 'saving' || state === 'dirty') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!doc || !t || t === doc.title) return;
    try {
      await api(`/ggb-documents/${doc.id}`, { method: 'PATCH', json: { title: t } });
      setDoc({ ...doc, title: t });
    } catch (err) {
      setError((err as Error).message);
      setTitle(doc.title);
    }
  };

  return (
    <>
      <Nav me={me} />
      <main className="ggb-editor">
        <div className="ggb-editor__bar">
          <Link href="/ggb" className="ui-pagehead__back">← Bài GeoGebra</Link>
          {doc && doc.canEdit ? (
            <form className="ggb-editor__title" onSubmit={rename}>
              <label className="ui-sr-only" htmlFor="ggb-title">Tên bài</label>
              <input id="ggb-title" className="ui-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} onBlur={rename} />
            </form>
          ) : (
            doc && <b className="ggb-editor__name">{doc.title}</b>
          )}
          {doc?.canEdit && (
            <span className={`ggb-editor__state ggb-editor__state--${state}`} role="status">
              {LABEL[state]}
            </span>
          )}
          {doc && !doc.canEdit && <Muted small>Chỉ xem: thay đổi của bạn không được lưu.</Muted>}
          {state === 'conflict' && <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Tải lại</Button>}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {doc && (
          <GeoGebraBoard
            onReady={(a) => (board.current = a)}
            className="ggb-editor__board"
            initialBase64={doc.base64 || undefined}
            readOnly={!doc.canEdit}
            onChange={doc.canEdit ? onChange : undefined}
          />
        )}
        {!doc && !error && <Muted>Đang mở bài…</Muted>}
      </main>
    </>
  );
}
