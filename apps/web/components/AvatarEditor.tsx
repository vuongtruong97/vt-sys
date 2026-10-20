'use client';
import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal } from '@/components/ui';

/** Kích thước khung cắt trên màn hình và kích thước ảnh gửi lên (vuông). */
const VIEW = 280;
const OUT = 512;

/** Xuất canvas thành WebP; trình duyệt không hỗ trợ WebP (Safari cũ) thì dùng JPEG. */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === 'image/webp') return resolve(webp);
        canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error('Không xử lý được ảnh'))), 'image/jpeg', 0.9);
      },
      'image/webp',
      0.9,
    );
  });
}

/**
 * Cắt ảnh đại diện thành hình vuông ngay trên trình duyệt: kéo ảnh để đặt vị trí, thanh trượt để phóng to.
 * Ảnh gửi lên đã thu nhỏ còn 512×512 nên nhẹ (khoảng 30–80 KB).
 */
export function AvatarEditor({ file, onCancel, onSave }: { file: File | null; onCancel: () => void; onSave: (blob: Blob) => Promise<void> }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    setImg(null);
    setError('');
    setZoom(1);
    setPos({ x: 0, y: 0 });
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Chọn ảnh JPEG, PNG hoặc WebP');
      return;
    }
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError('Không đọc được ảnh này');
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Tỉ lệ để cạnh ngắn của ảnh vừa khung (zoom = 1), rồi nhân thêm zoom.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : 0;
  const h = img ? img.naturalHeight * scale : 0;
  // Không để lộ khoảng trống trong khung. z: mức phóng muốn tính (mặc định mức hiện tại).
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    const k = z / zoom;
    return { x: Math.min(0, Math.max(VIEW - w * k, p.x)), y: Math.min(0, Math.max(VIEW - h * k, p.y)) };
  };

  // Ảnh mới hoặc đổi zoom: giữ tâm khung.
  useEffect(() => {
    if (!img) return;
    setPos((p) => clamp(p.x === 0 && p.y === 0 ? { x: (VIEW - w) / 2, y: (VIEW - h) / 2 } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, zoom]);

  const onDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }));
  };
  const onUp = () => (drag.current = null);

  const changeZoom = (z: number) => {
    // Phóng to quanh tâm khung.
    const c = VIEW / 2;
    const k = z / zoom;
    setPos(clamp({ x: c - (c - pos.x) * k, y: c - (c - pos.y) * k }, z));
    setZoom(z);
  };

  const save = async () => {
    if (!img) return;
    setSaving(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
      ctx.imageSmoothingQuality = 'high';
      // Vùng nguồn tương ứng với khung VIEW×VIEW.
      ctx.drawImage(img, -pos.x / scale, -pos.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT);
      await onSave(await toBlob(canvas));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!file}
      onClose={onCancel}
      title="Cắt ảnh đại diện"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Huỷ</Button>
          <Button loading={saving} disabled={!img} onClick={save}>Lưu ảnh</Button>
        </>
      }
    >
      <div className="avatar-editor">
        <div
          className="avatar-editor__frame"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="img"
          aria-label="Kéo ảnh để chọn vùng hiển thị"
        >
          {img && <img src={img.src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />}
          <span className="avatar-editor__mask" aria-hidden />
        </div>
        <label className="avatar-editor__zoom">
          <span>Phóng to</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} disabled={!img} onChange={(e) => changeZoom(Number(e.target.value))} />
        </label>
        <p className="ui-muted ui-muted--sm">Kéo ảnh để chọn vùng hiển thị. Ảnh hiện dạng tròn ở mọi nơi trong trang.</p>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
