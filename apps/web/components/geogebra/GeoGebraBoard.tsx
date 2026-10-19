'use client';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { GgbApi, GGB_CODEBASE, GGBApplet, loadGeoGebra } from '@/lib/geogebra';

export type GeoGebraBoardProps = {
  /** Bài đã lưu; chỉ đọc lúc khởi tạo. Đổi bài khi đang mở thì gọi getApi().setBase64(). */
  initialBase64?: string;
  /** Gọi sau mỗi lần bài thay đổi (đã gom theo saveDelay), với getBase64() mới nhất. */
  onChange?: (base64: string) => void;
  onReady?: (api: GgbApi) => void;
  appName?: 'classic' | 'graphing' | 'geometry' | '3d' | 'notes';
  /** Chỉ xem: ẩn thanh công cụ, ô nhập lệnh, menu chuột phải; kéo chuột là di chuyển khung nhìn. */
  readOnly?: boolean;
  saveDelay?: number;
  className?: string;
};

export type GeoGebraBoardHandle = {
  getApi(): GgbApi | null;
  getBase64(): string | undefined;
  /** Ảnh PNG dạng data URL (cho ảnh thu nhỏ). */
  getPNG(scale?: number): string | undefined;
};

/** Mã chế độ "Di chuyển khung nhìn" của GeoGebra: kéo chuột không làm xê dịch đối tượng. */
const MODE_MOVE_VIEW = 40;

/**
 * Bảng GeoGebra Classic nhúng trong trang. Tự co theo khung bao (ResizeObserver + setSize),
 * nạp script một lần, gỡ applet khi unmount để không rò bộ nhớ.
 */
export const GeoGebraBoard = forwardRef<GeoGebraBoardHandle, GeoGebraBoardProps>(function GeoGebraBoard(
  { initialBase64, onChange, onReady, appName = 'classic', readOnly = false, saveDelay = 1500, className },
  ref,
) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const containerId = `ggb-${uid}`;
  const wrap = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GgbApi | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Giữ hàm mới nhất trong ref: đổi callback không phải dựng lại applet.
  const cb = useRef({ onChange, onReady });
  cb.current = { onChange, onReady };
  const initial = useRef(initialBase64);

  useImperativeHandle(ref, () => ({
    getApi: () => apiRef.current,
    getBase64: () => apiRef.current?.getBase64(),
    getPNG: (scale = 0.5) => {
      const png = apiRef.current?.getPNGBase64(scale, false, 72);
      return png ? `data:image/png;base64,${png}` : undefined;
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let api: GgbApi | null = null;
    let resize: ResizeObserver | undefined;
    const emit = () => {
      clearTimeout(timer);
      timer = setTimeout(() => api && cb.current.onChange?.(api.getBase64()), saveDelay);
    };
    const box = wrap.current!;

    loadGeoGebra()
      .then(() => {
        if (cancelled) return;
        const rect = box.getBoundingClientRect();
        const params: Record<string, unknown> = {
          id: `ggbApplet${uid}`,
          appName,
          language: 'vi',
          width: Math.max(320, Math.round(rect.width)),
          height: Math.max(240, Math.round(rect.height)),
          showToolBar: !readOnly,
          showAlgebraInput: !readOnly,
          showMenuBar: false,
          showResetIcon: false,
          showFullscreenButton: true,
          enableRightClick: !readOnly,
          enableLabelDrags: !readOnly,
          enableShiftDragZoom: true,
          useBrowserForJS: false,
          // Không giành focus và không bật bàn phím ảo khi mở trang; người dùng tự bấm nút bàn phím nếu cần.
          preventFocus: true,
          showKeyboardOnFocus: false,
          borderColor: 'transparent',
          ...(initial.current ? { ggbBase64: initial.current } : {}),
          appletOnLoad: (a: GgbApi) => {
            if (cancelled) return;
            api = a;
            apiRef.current = a;
            setStatus('ready');
            if (readOnly) a.setMode(MODE_MOVE_VIEW);
            else {
              a.registerAddListener(emit);
              a.registerRemoveListener(emit);
              a.registerUpdateListener(emit);
              a.registerRenameListener(emit);
            }
            cb.current.onReady?.(a);
            // Khung bao đổi cỡ (xoay máy, mở bảng bên) thì applet co theo.
            resize = new ResizeObserver(([e]) => {
              const { width, height } = e.contentRect;
              if (width > 0 && height > 0) a.setSize(Math.round(width), Math.round(height));
            });
            resize.observe(box);
          },
        };
        const applet = new (GGBApplet())(params, true);
        if (GGB_CODEBASE) applet.setHTML5Codebase(GGB_CODEBASE);
        applet.inject(containerId);
      })
      .catch(() => !cancelled && setStatus('error'));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      resize?.disconnect();
      if (api && !readOnly) {
        api.unregisterAddListener(emit);
        api.unregisterRemoveListener(emit);
        api.unregisterUpdateListener(emit);
        api.unregisterRenameListener(emit);
      }
      try {
        api?.remove?.();
      } catch {
        /* applet đã bị gỡ */
      }
      apiRef.current = null;
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = '';
    };
  }, [containerId, uid, appName, readOnly, saveDelay]);

  return (
    <div ref={wrap} className={`ggb-wrap${className ? ` ${className}` : ''}`}>
      {status === 'loading' && <p className="ggb-wrap__msg" role="status">Đang tải GeoGebra…</p>}
      {status === 'error' && (
        <p className="ggb-wrap__msg" role="alert">
          Không tải được GeoGebra. Kiểm tra kết nối mạng rồi tải lại trang.
        </p>
      )}
      <div id={containerId} className="ggb-wrap__applet" />
    </div>
  );
});
