'use client';
import { HocuspocusProvider } from '@hocuspocus/provider';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { bindGgbToYDoc } from '@/components/geogebra/syncGgb';
import { api } from '@/lib/api';
import type { GgbApi } from '@/lib/geogebra';

// GeoGebra nặng vài MB: chỉ tải khi giáo viên mở bảng GeoGebra.
const GeoGebraBoard = dynamic(() => import('@/components/geogebra/GeoGebraBoard').then((m) => m.GeoGebraBoard), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WHITEBOARD_URL || 'ws://localhost:1234';

/**
 * Bảng GeoGebra của phòng học: giáo viên vẽ, cả lớp xem trực tiếp (đồng bộ qua máy chủ bảng trắng,
 * tài liệu "ggb:<buổi học>"). Học viên mở chế độ chỉ xem; máy chủ cũng từ chối mọi thay đổi của họ.
 */
export function GgbStage({ sessionId, title, canWrite, say }: { sessionId: string; title: string; canWrite: boolean; say: (m: string) => void }) {
  const [ggb, setGgb] = useState<GgbApi | null>(null);
  const [doc, setDoc] = useState<{ ydoc: Y.Doc; synced: boolean } | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [saving, setSaving] = useState(false);
  const writer = useRef(canWrite);
  writer.current = canWrite;

  // Kết nối máy chủ bảng trắng.
  useEffect(() => {
    const ydoc = new Y.Doc();
    let provider: HocuspocusProvider | undefined;
    let cancelled = false;
    setDoc({ ydoc, synced: false });
    api<{ token: string; document: string }>(`/sessions/${sessionId}/board-token?kind=ggb`)
      .then(({ token, document }) => {
        if (cancelled) return;
        provider = new HocuspocusProvider({
          url: WS_URL,
          name: document,
          document: ydoc,
          token,
          onSynced: () => {
            setStatus('ready');
            setDoc({ ydoc, synced: true });
          },
          onAuthenticationFailed: () => setStatus('error'),
        });
      })
      .catch(() => setStatus('error'));
    return () => {
      cancelled = true;
      provider?.destroy();
      ydoc.destroy();
    };
  }, [sessionId]);

  // Gắn applet vào tài liệu khi cả hai đã sẵn sàng.
  useEffect(() => {
    if (!ggb || !doc?.synced) return;
    const binding = bindGgbToYDoc(ggb, doc.ydoc, () => writer.current);
    binding.synced();
    return () => binding.destroy();
  }, [ggb, doc]);

  const onReady = useCallback((a: GgbApi) => setGgb(a), []);

  /** Lưu bảng hiện tại thành một bài GeoGebra, học viên của lớp xem lại được ở /ggb. */
  const saveCopy = async () => {
    // next/dynamic không chuyển ref, nên dùng api nhận từ onReady.
    const base64 = ggb?.getBase64();
    if (!base64) return;
    setSaving(true);
    try {
      await api('/ggb-documents', { json: { title: `Bảng GeoGebra · ${title}`.slice(0, 120), base64, sessionId } });
      say('Đã lưu bảng GeoGebra vào mục GeoGebra của bạn');
    } catch (e) {
      say((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-ggb">
      <GeoGebraBoard className="mt-ggb__board" readOnly={!canWrite} onReady={onReady} />
      {status !== 'ready' && (
        <span className="mt-ggb__status" role="status">
          {status === 'error' ? 'Không kết nối được bảng GeoGebra' : 'Đang kết nối bảng GeoGebra…'}
        </span>
      )}
      {canWrite && status === 'ready' && (
        <button type="button" className="mt-pbtn mt-pbtn--sm mt-ggb__save" disabled={saving} onClick={saveCopy}>
          {saving ? 'Đang lưu…' : 'Lưu thành bài'}
        </button>
      )}
      {!canWrite && <span className="mt-ggb__badge">Giáo viên đang vẽ · bạn đang xem</span>}
    </div>
  );
}
