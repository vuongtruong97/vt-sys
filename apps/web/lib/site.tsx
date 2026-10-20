'use client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { DEFAULT_CONTENT, SiteContent } from './siteTypes';

export type { SiteContent } from './siteTypes';

/** Link ảnh của trang (lưu trong DB, API trả kèm cache dài); null khi chưa có ảnh. */
export const assetUrl = (id: string | null | undefined) => (id ? `/api/site/assets/${id}` : null);

const SiteCtx = createContext<SiteContent>(DEFAULT_CONTENT);

/** Nội dung trang công khai (đã xuất bản) cho mọi component; layout lấy phía server rồi truyền vào. */
export const useSite = () => useContext(SiteCtx);

/**
 * Bọc toàn trang. Mở trang với `?preview=1` và có quyền site.manage thì hiện bản nháp thay bản đã xuất bản,
 * kèm thanh "Đang xem bản nháp" để xuất bản hoặc quay lại sửa.
 */
export function SiteProvider({ initial, children }: { initial: SiteContent; children: ReactNode }) {
  const [content, setContent] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewCss, setPreviewCss] = useState<string | null>(null);

  useEffect(() => setContent(initial), [initial]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('preview') !== '1') return;
    api<{ draft: SiteContent }>('/admin/site')
      .then(async (r) => {
        setContent(r.draft);
        setPreview(true);
        // Màu chủ đạo của bản nháp: layout chỉ có màu của bản đã xuất bản, nên sinh lại trên trình duyệt (chỉ khi xem trước).
        const { themeCss } = await import('./siteTheme');
        setPreviewCss(themeCss(r.draft.brand.primaryColor) ?? '');
      })
      .catch(() => {
        /* không có quyền: xem bản đã xuất bản như mọi người */
      });
  }, []);

  const publish = async () => {
    setBusy(true);
    try {
      await api('/admin/site/publish', { method: 'POST' });
      window.location.href = window.location.pathname;
    } catch (e) {
      window.alert((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <SiteCtx.Provider value={content}>
      {children}
      {preview && previewCss !== null && <style dangerouslySetInnerHTML={{ __html: previewCss }} />}
      {preview && (
        <div className="ui-preview-bar" role="status">
          <span>Đang xem bản nháp. Người khác vẫn thấy bản đã xuất bản.</span>
          <a className="ui-btn ui-btn--light ui-btn--sm" href="/admin/site">Quay lại sửa</a>
          <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={busy} onClick={publish}>
            {busy ? 'Đang xuất bản…' : 'Xuất bản'}
          </button>
        </div>
      )}
    </SiteCtx.Provider>
  );
}
