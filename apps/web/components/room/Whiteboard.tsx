'use client';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { api } from '@/lib/api';

/** Bảng có kích thước logic cố định; mỗi máy co giãn cho vừa khung, nên nét vẽ khớp nhau giữa các màn hình. */
const BW = 1600;
const BH = 900;
const COLORS = [
  { id: 'white', label: 'Phấn trắng', css: '--chalk-white' },
  { id: 'yellow', label: 'Vàng', css: '--chalk-yellow' },
  { id: 'pink', label: 'Hồng', css: '--chalk-pink' },
  { id: 'blue', label: 'Xanh', css: '--chalk-blue' },
] as const;
type Tool = (typeof COLORS)[number]['id'] | 'erase';

const WS_URL = process.env.NEXT_PUBLIC_WHITEBOARD_URL || 'ws://localhost:1234';

export function Whiteboard({ sessionId, canClear }: { sessionId: string; canClear: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<Y.Doc>();
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [tool, setTool] = useState<Tool>('white');
  const current = useRef<Y.Array<number> | null>(null);

  const strokes = () => doc.current!.getArray<Y.Map<unknown>>('strokes');

  const draw = useCallback(() => {
    const cv = canvas.current;
    if (!cv || !doc.current) return;
    const ctx = cv.getContext('2d')!;
    const s = Math.min(cv.width / BW, cv.height / BH);
    const ox = (cv.width - BW * s) / 2;
    const oy = (cv.height - BH * s) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, BW, BH);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const css = getComputedStyle(document.documentElement);
    for (const st of strokes().toArray()) {
      const pts = st.get('pts') as Y.Array<number> | undefined;
      if (!pts || pts.length < 2) continue;
      const p = pts.toArray();
      const color = COLORS.find((c) => c.id === st.get('c')) ?? COLORS[0];
      ctx.strokeStyle = css.getPropertyValue(color.css).trim() || '#eef2e6';
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = (st.get('w') as number) || 4;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      if (p.length === 2) ctx.lineTo(p[0] + 0.1, p[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, []);

  // Kết nối máy chủ bảng trắng.
  useEffect(() => {
    let provider: HocuspocusProvider | undefined;
    const ydoc = new Y.Doc();
    doc.current = ydoc;
    const onChange = () => requestAnimationFrame(draw);
    ydoc.getArray('strokes').observeDeep(onChange);
    let cancelled = false;
    api<{ token: string; document: string }>(`/sessions/${sessionId}/board-token`)
      .then(({ token, document }) => {
        if (cancelled) return;
        provider = new HocuspocusProvider({
          url: WS_URL,
          name: document,
          document: ydoc,
          token,
          onSynced: () => {
            setStatus('ready');
            draw();
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
  }, [sessionId, draw]);

  // Giữ canvas đúng kích thước khung.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * d));
      cv.height = Math.max(1, Math.round(r.height * d));
      draw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [draw]);

  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget;
    const r = cv.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    const s = Math.min(cv.width / BW, cv.height / BH);
    const ox = (cv.width - BW * s) / 2;
    const oy = (cv.height - BH * s) / 2;
    return [Math.round(((e.clientX - r.left) * d - ox) / s), Math.round(((e.clientY - r.top) * d - oy) / s)] as const;
  };

  const eraseAt = (x: number, y: number) => {
    const arr = strokes();
    const list = arr.toArray();
    for (let i = list.length - 1; i >= 0; i--) {
      const p = (list[i].get('pts') as Y.Array<number>).toArray();
      for (let j = 0; j < p.length; j += 2) {
        if (Math.hypot(p[j] - x, p[j + 1] - y) < 18) {
          arr.delete(i, 1);
          return;
        }
      }
    }
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'ready') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toBoard(e);
    if (tool === 'erase') return eraseAt(x, y);
    const ydoc = doc.current!;
    ydoc.transact(() => {
      const m = new Y.Map<unknown>();
      strokes().push([m]);
      const pts = new Y.Array<number>();
      m.set('c', tool);
      m.set('w', 4);
      m.set('pts', pts);
      pts.push([x, y]);
      current.current = pts;
    });
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!(e.buttons & 1) || status !== 'ready') return;
    const [x, y] = toBoard(e);
    if (tool === 'erase') return eraseAt(x, y);
    current.current?.push([x, y]);
  };
  const up = () => {
    current.current = null;
  };

  return (
    <div className="board">
      <div className="board-tools">
        {COLORS.map((c) => (
          <button key={c.id} aria-pressed={tool === c.id} onClick={() => setTool(c.id)}>
            <span className="sw" style={{ background: `var(${c.css})` }} />
            {c.label}
          </button>
        ))}
        <button aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}>Tẩy</button>
        {canClear && (
          <button onClick={() => window.confirm('Xoá toàn bộ bảng?') && strokes().delete(0, strokes().length)}>Xoá bảng</button>
        )}
        <span className="hint">
          {status === 'connecting' ? 'Đang kết nối bảng trắng…' : status === 'error' ? 'Không kết nối được bảng trắng' : 'Cả lớp cùng vẽ được'}
        </span>
      </div>
      <canvas
        ref={canvas}
        aria-label="Bảng trắng chung"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  );
}
