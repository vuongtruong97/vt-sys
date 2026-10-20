'use client';
import { ReactNode, useId, useRef, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { assetUrl } from '@/lib/site';

/** Cỡ ảnh tối đa theo chỗ dùng; ảnh lớn hơn được thu nhỏ trên trình duyệt trước khi gửi. */
export const IMAGE_KINDS = {
  wide: { max: 1920, type: 'image/jpeg', hint: 'Ảnh ngang, nên từ 1600px trở lên. Tự thu về tối đa 1920px.' },
  og: { max: 1200, type: 'image/jpeg', hint: 'Ảnh hiện khi chia sẻ link lên Facebook, Zalo: nên 1200×630.' },
  square: { max: 512, type: 'image/png', hint: 'Ảnh vuông hoặc ngang, nền trong suốt càng tốt. Tự thu về tối đa 512px.' },
  favicon: { max: 64, type: 'image/png', hint: 'Biểu tượng trên tab trình duyệt: ảnh vuông, tự thu về 64px.' },
} as const;
export type ImageKind = keyof typeof IMAGE_KINDS;

/** Thu nhỏ ảnh bằng canvas, giữ tỉ lệ; JPEG nén 0,85, PNG giữ nền trong suốt. */
async function resize(file: File, kind: ImageKind): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type)) throw new Error('Chỉ chọn được ảnh JPG, PNG hoặc WebP');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh này, thử ảnh khác');
  }
  const { max, type } = IMAGE_KINDS[kind];
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const g = c.getContext('2d')!;
  if (type === 'image/jpeg') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Không nén được ảnh'))), type, 0.85));
}

/** Chọn ảnh: xem trước, tải ảnh (thu nhỏ rồi gửi lên /admin/site/assets), bỏ ảnh. */
export function ImageField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  kind: ImageKind;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const id = useId();
  const url = assetUrl(value);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const blob = await resize(f, kind);
      const fd = new FormData();
      fd.append('file', blob, kind === 'square' || kind === 'favicon' ? 'anh.png' : 'anh.jpg');
      const r = await fetch('/api/admin/site/assets', { method: 'POST', body: fd, credentials: 'include' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((Array.isArray(data.message) ? data.message[0] : data.message) || 'Không tải ảnh lên được');
      onChange(data.id);
      setInfo(`${data.width}×${data.height}px · ${Math.round(data.size / 1024)} KB`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="sa-image">
      <span className="ui-field__label" id={id}>{label}</span>
      <div className={`sa-image__box sa-image__box--${kind}`} aria-labelledby={id}>
        {url ? <img src={url} alt="" /> : <span className="sa-image__empty">Chưa có ảnh</span>}
      </div>
      <div className="ui-actions">
        <Button size="sm" variant="outline" loading={busy} onClick={() => input.current?.click()}>
          {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
        </Button>
        {value && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Bỏ ảnh
          </Button>
        )}
        {info && <span className="ui-muted ui-muted--sm">{info}</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-labelledby={id} onChange={(e) => pick(e.target.files?.[0])} />
      <span className="ui-field__hint">{IMAGE_KINDS[kind].hint}</span>
      {error && <span className="ui-field__error" role="alert">{error}</span>}
    </div>
  );
}

/** Danh sách sửa được: thêm, xoá, đổi thứ tự bằng nút (dùng được bằng bàn phím). */
export function ListEditor<T>({
  items,
  onChange,
  render,
  create,
  max,
  addLabel,
  itemLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, set: (next: T) => void, index: number) => ReactNode;
  create: () => T;
  max: number;
  addLabel: string;
  itemLabel: (index: number) => string;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="sa-list">
      {items.map((it, i) => (
        <fieldset key={i} className="sa-list__item">
          <legend>{itemLabel(i)}</legend>
          <div className="sa-list__tools">
            <Button size="sm" variant="ghost" disabled={i === 0} aria-label={`Chuyển ${itemLabel(i)} lên`} onClick={() => move(i, -1)}>↑</Button>
            <Button size="sm" variant="ghost" disabled={i === items.length - 1} aria-label={`Chuyển ${itemLabel(i)} xuống`} onClick={() => move(i, 1)}>↓</Button>
            <Button size="sm" variant="ghost" aria-label={`Xoá ${itemLabel(i)}`} onClick={() => onChange(items.filter((_, k) => k !== i))}>Xoá</Button>
          </div>
          {render(it, (next) => onChange(items.map((x, k) => (k === i ? next : x))), i)}
        </fieldset>
      ))}
      {items.length < max ? (
        <Button size="sm" variant="outline" onClick={() => onChange([...items, create()])}>{addLabel}</Button>
      ) : (
        <span className="ui-muted ui-muted--sm">Tối đa {max} mục.</span>
      )}
    </div>
  );
}

/** Danh sách các dòng chữ ngắn (dòng ✓ dưới hero, điểm nổi bật của giáo viên). */
export function TextList({ label, items, onChange, max, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string }) {
  return (
    <div className="sa-textlist">
      <span className="ui-field__label">{label}</span>
      {items.map((t, i) => (
        <div key={i} className="sa-textlist__row">
          <Input label={`${label} ${i + 1}`} hideLabel value={t} placeholder={placeholder} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} />
          <Button size="sm" variant="ghost" aria-label={`Xoá dòng ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))}>Xoá</Button>
        </div>
      ))}
      {items.length < max && (
        <Button size="sm" variant="outline" onClick={() => onChange([...items, ''])}>Thêm dòng</Button>
      )}
    </div>
  );
}

/** Kiểm tra link như API (an toàn: đường dẫn trong trang, https://, mailto:). Trả câu báo lỗi hoặc undefined. */
export function hrefError(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  if (/^\/(?!\/)/.test(s) || /^https:\/\/\S+$/i.test(s) || /^mailto:[^\s@]+@[^\s@]+$/i.test(s)) return undefined;
  return 'Link phải bắt đầu bằng /, https:// hoặc mailto:. Link khác sẽ bị bỏ khi lưu.';
}
