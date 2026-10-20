'use client';
import { HocuspocusProvider } from '@hocuspocus/provider';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { attachPointerSender } from '@/components/geogebra/pointerGgb';
import { bindGgbToYDoc } from '@/components/geogebra/syncGgb';
import { Icon } from '@/components/meet/icons';
import { api } from '@/lib/api';
import type { GgbApi } from '@/lib/geogebra';
import { GgbPointerLayer } from './GgbPointerLayer';

// GeoGebra nặng vài MB: chỉ tải khi giáo viên mở bảng GeoGebra.
const GeoGebraBoard = dynamic(() => import('@/components/geogebra/GeoGebraBoard').then((m) => m.GeoGebraBoard), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WHITEBOARD_URL || 'ws://localhost:1234';

/**
 * Bảng GeoGebra của phòng học: giáo viên vẽ, cả lớp xem trực tiếp (đồng bộ qua máy chủ bảng trắng,
 * tài liệu "ggb:<buổi học>"). Học viên mở chế độ chỉ xem, chỉ thấy vùng hình vẽ; máy chủ cũng từ chối
 * mọi thay đổi của họ. Con trỏ laser và nét bút đang vẽ của giáo viên đi qua awareness (không lưu).
 */
export function GgbStage({ sessionId, title, canWrite, say }: { sessionId: string; title: string; canWrite: boolean; say: (m: string) => void }) {
  const [ggb, setGgb] = useState<GgbApi | null>(null);
  const [conn, setConn] = useState<{ ydoc: Y.Doc; provider: HocuspocusProvider | null; synced: boolean } | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [laser, setLaser] = useState(false);
  const [tick, setTick] = useState(0);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const writer = useRef(canWrite);
  writer.current = canWrite;
  const laserRef = useRef(laser);
  laserRef.current = laser;

  // Kết nối máy chủ bảng trắng.
  useEffect(() => {
    const ydoc = new Y.Doc();
    let provider: HocuspocusProvider | undefined;
    let cancelled = false;
    setConn({ ydoc, provider: null, synced: false });
    api<{ token: string; document: string }>(`/sessions/${sessionId}/board-token?kind=ggb`)
      .then(({ token, document }) => {
        if (cancelled) return;
        const p = new HocuspocusProvider({
          url: WS_URL,
          name: document,
          document: ydoc,
          token,
          onSynced: () => {
            setStatus('ready');
            setConn({ ydoc, provider: p, synced: true });
          },
          onAuthenticationFailed: () => setStatus('error'),
        });
        provider = p;
        // Người nhận chỉ vẽ laser/nét của client khai báo là giáo viên.
        p.setAwarenessField('user', { role: writer.current ? 'teacher' : 'student' });
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
    if (!ggb || !conn?.synced) return;
    const binding = bindGgbToYDoc(ggb, conn.ydoc, () => writer.current, {
      afterLoad: () => {
        // Bảng của giáo viên mang theo bố cục có danh sách đối tượng: học viên chỉ xem vùng hình vẽ.
        if (!writer.current) ggb.setPerspective('G');
        setTick((t) => t + 1);
      },
    });
    binding.synced();
    return () => binding.destroy();
  }, [ggb, conn]);

  // Giáo viên: gửi laser và nét bút đang vẽ.
  const sender = useRef<ReturnType<typeof attachPointerSender> | null>(null);
  useEffect(() => {
    const awareness = conn?.provider?.awareness;
    if (!canWrite || !ggb || !root || !awareness) return;
    const s = attachPointerSender(root, ggb, awareness, () => laserRef.current);
    sender.current = s;
    return () => {
      s.destroy();
      sender.current = null;
    };
  }, [canWrite, ggb, root, conn]);

  const toggleLaser = useCallback(() => {
    setLaser((on) => {
      if (on) sender.current?.clear();
      return !on;
    });
  }, []);

  // Phím L bật/tắt laser (không tính khi đang gõ trong ô nhập của GeoGebra).
  useEffect(() => {
    if (!canWrite) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== 'l' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      toggleLaser();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canWrite, toggleLaser]);

  const onReady = useCallback((a: GgbApi) => setGgb(a), []);

  const awareness = conn?.provider?.awareness;
  return (
    <div ref={setRoot} className={`mt-ggb${canWrite && laser ? ' mt-ggb--laser' : ''}`}>
      <GeoGebraBoard className="mt-ggb__board" readOnly={!canWrite} graphicsOnly={!canWrite} onReady={onReady} />
      {!canWrite && ggb && root && awareness && <GgbPointerLayer api={ggb} root={root} awareness={awareness} snapshotTick={tick} />}
      {status !== 'ready' && (
        <span className="mt-ggb__status" role="status">
          {status === 'error' ? 'Không kết nối được bảng GeoGebra' : 'Đang kết nối bảng GeoGebra…'}
        </span>
      )}
      {canWrite && status === 'ready' && (
        <div className="mt-ggb__tools">
          <button
            type="button"
            className={`mt-pbtn mt-pbtn--sm${laser ? '' : ' mt-pbtn--ghost'} mt-ggb__laser-btn`}
            aria-pressed={laser}
            title="Con trỏ laser cho cả lớp thấy (phím L)"
            onClick={toggleLaser}
          >
            <Icon name="pin" size={16} /> {laser ? 'Tắt laser' : 'Laser'}
          </button>
        </div>
      )}
      {!canWrite && <span className="mt-ggb__badge">Giáo viên đang vẽ · bạn đang xem</span>}
    </div>
  );
}
