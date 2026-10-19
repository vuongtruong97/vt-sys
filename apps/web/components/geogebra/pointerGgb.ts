'use client';
import type { GgbApi } from '@/lib/geogebra';

/**
 * Con trỏ laser và nét bút đang vẽ của giáo viên trên bảng GeoGebra, gửi qua awareness của Hocuspocus
 * (tin tức thời, không lưu). Toạ độ là toạ độ hình học nên đúng ở mọi cỡ màn hình học viên.
 */
export type Pointer =
  | { kind: 'laser'; x: number; y: number; t: number }
  /**
   * Phần mới của nét đang vẽ: `pts` = [x, y, x, y, …] bắt đầu từ điểm thứ `from` của nét `id`.
   * Gửi từng phần để tin luôn nhỏ (nét dài không làm tin to dần). `done` khi nhấc bút.
   */
  | { kind: 'ink'; id: number; from: number; pts: number[]; done?: boolean; t: number };

/** Mã công cụ Bút của GeoGebra (getMode). */
export const MODE_PEN = 62;
/** Gửi tối đa ~30 lần/giây. */
const SEND_EVERY = 33;
/** Nét quá dài thì ngừng gửi phần tiếp (nét thật vẫn tới khi nhấc bút). */
const MAX_POINTS = 4000;

export type View = { xMin: number; yMin: number; invXscale: number; invYscale: number; width: number; height: number };

/**
 * Khung vùng hình vẽ trên màn hình: canvas lớn nhất trong applet.
 * Kích thước CSS của canvas có thể khác kích thước view GeoGebra báo (applet co giãn), nên đổi toạ độ
 * theo tỉ lệ giữa hai kích thước thay vì coi 1 điểm ảnh CSS = 1 điểm ảnh của view.
 */
export function graphicsArea(api: GgbApi, root: HTMLElement): { view: View; rect: DOMRect } | null {
  let view: View;
  try {
    view = JSON.parse(api.getViewProperties());
  } catch {
    return null;
  }
  let best: DOMRect | null = null;
  for (const c of Array.from(root.querySelectorAll('canvas'))) {
    const r = c.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (!best || r.width * r.height > best.width * best.height)) best = r;
  }
  return best && view.width > 0 && view.height > 0 ? { view, rect: best } : null;
}

export const toWorld = (v: View, rect: DOMRect, clientX: number, clientY: number) => ({
  x: v.xMin + ((clientX - rect.left) * v.width / rect.width) * v.invXscale,
  y: v.yMin + ((rect.height - (clientY - rect.top)) * v.height / rect.height) * v.invYscale,
});

export const toScreen = (v: View, rect: DOMRect, x: number, y: number) => ({
  left: rect.left + ((x - v.xMin) / v.invXscale) * rect.width / v.width,
  top: rect.top + rect.height - ((y - v.yMin) / v.invYscale) * rect.height / v.height,
});

type AwarenessLike = { setLocalStateField(field: string, value: unknown): void };

/**
 * Phía giáo viên: nghe chuột/bút ở pha capture trên khung bao applet (không chặn thao tác GeoGebra).
 * - Laser bật: gửi vị trí chuột.
 * - Công cụ Bút và đang nhấn: gửi dần các điểm của nét.
 */
export function attachPointerSender(root: HTMLElement, api: GgbApi, awareness: AwarenessLike, laserOn: () => boolean) {
  /** Việc chờ gửi: laser (vị trí mới nhất) hoặc phần nét chưa gửi. */
  let laser: Pointer | null | undefined;
  let stroke: { id: number; pts: number[]; sent: number; done: boolean } | null = null;
  let strokeId = 0;
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    last = Date.now();
    if (stroke && (stroke.pts.length / 2 > stroke.sent || stroke.done)) {
      const from = stroke.sent;
      awareness.setLocalStateField('pointer', {
        kind: 'ink',
        id: stroke.id,
        from,
        pts: stroke.pts.slice(from * 2),
        done: stroke.done || undefined,
        t: Date.now(),
      } satisfies Pointer);
      stroke.sent = stroke.pts.length / 2;
      if (stroke.done) stroke = null;
      laser = undefined;
    } else if (laser !== undefined) {
      awareness.setLocalStateField('pointer', laser);
      laser = undefined;
    }
  };
  /** Gửi tối đa SEND_EVERY ms một lần; `now` thì gửi ngay (nhấc bút, tắt laser). */
  const schedule = (now = false) => {
    if (now) {
      clearTimeout(timer);
      flush();
      return;
    }
    const wait = SEND_EVERY - (Date.now() - last);
    if (wait <= 0) flush();
    else timer ??= setTimeout(flush, wait);
  };

  const world = (e: PointerEvent) => {
    const g = graphicsArea(api, root);
    if (!g) return null;
    const { rect, view } = g;
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return null;
    const w = toWorld(view, rect, e.clientX, e.clientY);
    // Làm tròn tới khoảng 1/4 điểm ảnh cho tin ngắn.
    const digits = Math.max(0, Math.min(8, Math.ceil(-Math.log10(view.invXscale / 4))));
    return { x: +w.x.toFixed(digits), y: +w.y.toFixed(digits) };
  };

  const onDown = (e: PointerEvent) => {
    if (api.getMode() !== MODE_PEN) return;
    const w = world(e);
    if (!w) return;
    stroke = { id: ++strokeId, pts: [w.x, w.y], sent: 0, done: false };
    schedule();
  };
  const onMove = (e: PointerEvent) => {
    const w = world(e);
    if (stroke && !stroke.done && e.buttons) {
      if (!w || stroke.pts.length >= MAX_POINTS * 2) return;
      stroke.pts.push(w.x, w.y);
      schedule();
    } else if (laserOn()) {
      laser = w ? { kind: 'laser', x: w.x, y: w.y, t: Date.now() } : null;
      schedule();
    }
  };
  const onUp = () => {
    if (!stroke || stroke.done) return;
    stroke.done = true;
    schedule(true);
  };
  const onLeave = () => {
    if (!stroke && laserOn()) {
      laser = null;
      schedule(true);
    }
  };

  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointerleave', onLeave);
  return {
    /** Tắt laser: xoá chấm ở máy học viên ngay. */
    clear() {
      laser = null;
      schedule(true);
    },
    destroy() {
      clearTimeout(timer);
      root.removeEventListener('pointerdown', onDown, true);
      root.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      root.removeEventListener('pointerleave', onLeave);
      awareness.setLocalStateField('pointer', null);
    },
  };
}
