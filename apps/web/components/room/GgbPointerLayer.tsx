'use client';
import { useEffect, useRef } from 'react';
import { graphicsArea, Pointer, toScreen } from '@/components/geogebra/pointerGgb';
import type { GgbApi } from '@/lib/geogebra';

type AwarenessLike = {
  getStates(): Map<number, Record<string, unknown>>;
  on(ev: 'change', fn: () => void): void;
  off(ev: 'change', fn: () => void): void;
};

/** Laser mờ dần sau 1,5 giây không di chuyển, biến mất sau 2 giây. */
const LASER_HOLD = 1500;
const LASER_FADE = 500;
/** Nét tạm đã nhấc bút: chờ nét thật (snapshot) tối đa 2 giây. */
const INK_WAIT = 2000;

/**
 * Lớp phủ ở máy học viên: vẽ con trỏ laser và nét bút đang vẽ của giáo viên (awareness Hocuspocus).
 * Chỉ đọc trạng thái của client tự khai báo là giáo viên; không chặn chuột (pointer-events: none).
 * `snapshotTick` tăng mỗi lần nạp bảng mới: vẽ lại, nét tạm nào đã có nét thật trên bảng thì bỏ.
 */
export function GgbPointerLayer({
  api,
  root,
  awareness,
  snapshotTick,
}: {
  api: GgbApi;
  root: HTMLElement;
  awareness: AwarenessLike;
  snapshotTick: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const state = useRef({
    laser: null as { x: number; y: number; t: number } | null,
    /** penBase: số nét bút thật trên bảng lúc nét tạm bắt đầu; có thêm nét thật nghĩa là nét này đã về. */
    strokes: new Map<number, { pts: number[]; doneAt: number; penBase: number }>(),
    raf: 0,
    kick: () => {},
  });

  // Snapshot mới về: nét thật đã nằm trong bảng, bỏ các nét tạm đã nhấc bút.
  useEffect(() => {
    const s = state.current;
    s.kick();
  }, [snapshotTick]);

  useEffect(() => {
    const s = state.current;
    const penCount = () => {
      try {
        return api.getAllObjectNames('penstroke').length;
      } catch {
        return 0;
      }
    };
    const draw = () => {
      s.raf = 0;
      const el = svg.current;
      if (!el) return;
      const g = graphicsArea(api, root);
      const host = el.parentElement!.getBoundingClientRect();
      const now = Date.now();
      let html = '';
      // Nét thật đã có trên bảng (snapshot về trước hoặc sau tin nhấc bút đều được): bỏ nét tạm.
      const pens = s.strokes.size ? penCount() : 0;
      s.strokes.forEach((v, id) => v.doneAt && pens > v.penBase && s.strokes.delete(id));
      if (g) {
        const pt = (x: number, y: number) => {
          const p = toScreen(g.view, g.rect, x, y);
          return [p.left - host.left, p.top - host.top];
        };
        s.strokes.forEach((v, id) => {
          if (v.doneAt && now - v.doneAt > INK_WAIT) {
            s.strokes.delete(id);
            return;
          }
          const pts: string[] = [];
          for (let i = 0; i + 1 < v.pts.length; i += 2) pts.push(pt(v.pts[i], v.pts[i + 1]).map((n) => n.toFixed(1)).join(','));
          if (pts.length === 1) pts.push(pts[0]);
          html += `<polyline points="${pts.join(' ')}" class="mt-ggb-ink" />`;
        });
        if (s.laser) {
          const age = now - s.laser.t;
          if (age > LASER_HOLD + LASER_FADE) s.laser = null;
          else {
            const [x, y] = pt(s.laser.x, s.laser.y);
            const op = age < LASER_HOLD ? 1 : 1 - (age - LASER_HOLD) / LASER_FADE;
            html += `<g opacity="${op.toFixed(2)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" class="mt-ggb-laser__glow" /><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="mt-ggb-laser" /></g>`;
          }
        }
      }
      el.innerHTML = html;
      // Còn laser đang mờ dần hoặc nét chờ xoá thì vẽ tiếp.
      if (s.laser || s.strokes.size) s.raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!s.raf) s.raf = requestAnimationFrame(draw);
    };
    s.kick = kick;

    const onChange = () => {
      let p: Pointer | null | undefined;
      awareness.getStates().forEach((st) => {
        const user = st.user as { role?: string } | undefined;
        if (user?.role === 'teacher' && p === undefined) p = (st.pointer as Pointer | null | undefined) ?? null;
      });
      if (p === undefined) return;
      if (!p) s.laser = null;
      else if (p.kind === 'laser') s.laser = { x: p.x, y: p.y, t: Date.now() };
      else {
        s.laser = null;
        const cur = s.strokes.get(p.id);
        if (!cur || p.from === 0) s.strokes.set(p.id, { pts: p.pts.slice(), doneAt: p.done ? Date.now() : 0, penBase: penCount() });
        else {
          // Bỏ phần trùng nếu nhận lại; thiếu đoạn (vào giữa nét) thì nối tiếp phần nhận được.
          const have = cur.pts.length / 2;
          cur.pts.push(...(p.from < have ? p.pts.slice((have - p.from) * 2) : p.pts));
          if (p.done) cur.doneAt = Date.now();
        }
      }
      kick();
    };
    awareness.on('change', onChange);
    // Khung đổi cỡ, giáo viên phóng to: vẽ lại theo toạ độ mới.
    const ro = new ResizeObserver(kick);
    ro.observe(root);
    return () => {
      awareness.off('change', onChange);
      ro.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [api, root, awareness]);

  return <svg ref={svg} className="mt-ggb-pointer" aria-hidden />;
}
