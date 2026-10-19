'use client';
import * as Y from 'yjs';
import type { GgbApi } from '@/lib/geogebra';

/**
 * Đồng bộ một applet GeoGebra với Y.Doc (bảng GeoGebra trong phòng học).
 * Người cầm bút ghi, người khác chỉ nhận (máy chủ bảng trắng cũng chặn ghi với họ).
 *
 * Hai loại tin (đã đo trong spike, xem docs/01-tong-quan.md):
 * - "snapshot": toàn bộ getXML() khi cấu trúc bài đổi (thêm, xoá, đổi tên, sửa định nghĩa).
 *   Gom lại: ghi 400 ms sau thay đổi cuối, tối đa 1,5 giây một lần. Nạp snapshot ở máy xem tốn
 *   khoảng 110 ms với 30 đối tượng, 1,2 giây với 200 đối tượng, nên không gửi dồn dập.
 * - "live": khi kéo, gửi toạ độ điểm tự do hoặc giá trị thanh trượt, 50 ms/lần. Máy xem dùng
 *   setCoords/setValue nên đối tượng phụ thuộc tự tính lại ngay (evalXML thì không).
 *   Đối tượng tự do loại khác gửi XML, máy xem evalXML rồi UpdateConstruction; trường hợp này
 *   ghi thêm snapshot sau khi ngừng kéo cho chắc khớp.
 */
export const SNAPSHOT = 'ggb';
export const LIVE = 'ggbLive';
const LOCAL = 'ggb-local';

type Live = { k: 'pt'; x: number; y: number; z: number } | { k: 'num'; v: number } | { k: 'xml'; xml: string };

/** Gọi fn sau `wait` ms không có lệnh mới, nhưng không trễ quá `maxWait` ms kể từ lệnh đầu. */
function debounce(fn: () => void, wait: number, maxWait = Infinity) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = 0;
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    first = 0;
    fn();
  };
  const d = () => {
    const now = Date.now();
    if (!first) first = now;
    clearTimeout(timer);
    timer = setTimeout(run, Math.min(wait, Math.max(0, first + maxWait - now)));
  };
  d.cancel = () => {
    clearTimeout(timer);
    first = 0;
  };
  return d;
}

function throttle(fn: () => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    last = Date.now();
    timer = undefined;
    fn();
  };
  const t = () => {
    const wait = ms - (Date.now() - last);
    if (wait <= 0) run();
    else timer ??= setTimeout(run, wait);
  };
  t.cancel = () => clearTimeout(timer);
  return t;
}

function encode(api: GgbApi, name: string): Live {
  const type = api.getObjectType(name);
  if (type === 'point') return { k: 'pt', x: api.getXcoord(name), y: api.getYcoord(name), z: api.getZcoord(name) };
  if (type === 'numeric') return { k: 'num', v: api.getValue(name) };
  return { k: 'xml', xml: api.getXML(name) };
}

/** Gắn applet vào Y.Doc. `canWrite` đọc lại mỗi lần nên đổi người cầm bút không cần gắn lại. */
export type BindOptions = {
  /** Gọi sau mỗi lần nạp snapshot (setXML), ví dụ để ẩn lại danh sách đối tượng ở máy học viên. */
  afterLoad?: () => void;
};

export function bindGgbToYDoc(api: GgbApi, ydoc: Y.Doc, canWrite: () => boolean, opts: BindOptions = {}) {
  const snapshot = ydoc.getMap<string>(SNAPSHOT);
  const live = ydoc.getMap<string>(LIVE);
  let applying = false;
  const dirty = new Set<string>();
  let usedXmlLive = false;

  // ---- ghi (người cầm bút) ----
  const writeSnapshot = () => {
    usedXmlLive = false;
    ydoc.transact(() => {
      snapshot.set('xml', api.getXML());
      live.clear();
    }, LOCAL);
  };
  const structure = debounce(writeSnapshot, 400, 1500);
  // Chỉ cần ghi lại snapshot sau khi kéo nếu có đối tượng gửi bằng XML (không chắc khớp tuyệt đối).
  const settle = debounce(() => usedXmlLive && writeSnapshot(), 800);
  const flushLive = throttle(() => {
    ydoc.transact(() => {
      dirty.forEach((n) => {
        if (!api.exists(n)) return;
        const msg = encode(api, n);
        if (msg.k === 'xml') usedXmlLive = true;
        live.set(n, JSON.stringify(msg));
      });
    }, LOCAL);
    dirty.clear();
  }, 50);

  const local = () => canWrite() && !applying;
  const onStructure = () => {
    if (local()) structure();
  };
  /** Nét bút vừa vẽ xong: gửi ngay để nét thật thay nét tạm ở máy học viên, không chờ gom 400 ms. */
  const onAdd = (name: string) => {
    if (!local()) return;
    if (api.getObjectType(name) === 'penstroke') {
      structure.cancel();
      writeSnapshot();
    } else structure();
  };
  const onRename = () => onStructure();
  // Kéo điểm cũng làm các đối tượng phụ thuộc phát sự kiện update: chỉ coi là sửa định nghĩa
  // khi quanh đó không có đối tượng tự do nào vừa đổi.
  let lastIndependent = 0;
  const onUpdate = (name: string) => {
    if (!local()) return;
    if (api.isIndependent(name)) {
      lastIndependent = Date.now();
      dirty.add(name);
      flushLive();
      settle();
    } else {
      setTimeout(() => {
        if (Date.now() - lastIndependent > 300) structure();
      }, 0);
    }
  };
  api.registerAddListener(onAdd);
  api.registerRemoveListener(onStructure);
  api.registerRenameListener(onRename);
  api.registerUpdateListener(onUpdate);

  // ---- đọc (mọi người) ----
  const apply = (fn: () => void) => {
    applying = true;
    try {
      fn();
    } finally {
      applying = false;
    }
  };
  const loadSnapshot = () => {
    const xml = snapshot.get('xml');
    if (!xml) return;
    apply(() => api.setXML(xml));
    opts.afterLoad?.();
  };
  const onSnapshot = (e: Y.YMapEvent<string>) => {
    if (e.transaction.origin !== LOCAL && e.keysChanged.has('xml')) loadSnapshot();
  };
  /** Áp toạ độ / giá trị đang kéo (các khoá trong map live) lên applet. */
  const applyLive = (keys: Iterable<string>) =>
    apply(() => {
      let needUpdate = false;
      for (const n of keys) {
        const raw = live.get(n);
        if (!raw || !api.exists(n)) continue;
        try {
          const m = JSON.parse(raw) as Live;
          if (m.k === 'pt') api.setCoords(n, m.x, m.y, m.z);
          else if (m.k === 'num') api.setValue(n, m.v);
          else {
            api.evalXML(m.xml);
            needUpdate = true;
          }
        } catch {
          /* tin hỏng: chờ snapshot kế tiếp */
        }
      }
      if (needUpdate) api.evalCommand('UpdateConstruction()');
    });
  const onLive = (e: Y.YMapEvent<string>) => {
    if (e.transaction.origin !== LOCAL) applyLive(e.keysChanged);
  };
  snapshot.observe(onSnapshot);
  live.observe(onLive);

  /** Gọi khi Y.Doc đã đồng bộ với máy chủ: dựng lại từ bảng hiện có, hoặc người cầm bút đưa bài của mình lên. */
  const synced = () => {
    if (snapshot.get('xml')) {
      loadSnapshot();
      // Sau lần kéo cuối có thể chưa có snapshot mới (kéo điểm không ghi snapshot): áp vị trí đang lưu trong live.
      applyLive(live.keys());
    } else if (canWrite()) writeSnapshot();
  };

  return {
    synced,
    destroy() {
      structure.cancel();
      settle.cancel();
      flushLive.cancel();
      snapshot.unobserve(onSnapshot);
      live.unobserve(onLive);
      api.unregisterAddListener(onAdd);
      api.unregisterRemoveListener(onStructure);
      api.unregisterRenameListener(onRename);
      api.unregisterUpdateListener(onUpdate);
    },
  };
}
