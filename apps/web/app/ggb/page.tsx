'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Button, ButtonLink, EmptyState, Muted, Page, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Item = { id: string; title: string; appName: string; sessionId: string | null; updatedAt: string; thumbnailUrl: string | null };

/** Bài GeoGebra của giáo viên: tạo mới, mở để sửa, xoá. */
export default function GgbListPage() {
  const me = useMe({ redirect: true });
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => api<Item[]>('/ggb-documents').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  const teacher = !!me && me.role !== 'STUDENT';

  const create = async () => {
    setError('');
    setCreating(true);
    try {
      const d = await api<{ id: string }>('/ggb-documents', { json: {} });
      router.push(`/ggb/${d.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  const remove = async (it: Item) => {
    if (!window.confirm(`Xoá bài "${it.title}"? Không khôi phục được.`)) return;
    try {
      await api(`/ggb-documents/${it.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader
          title="GeoGebra"
          description="Soạn bài dựng hình, đồ thị bằng GeoGebra Classic. Bài tự lưu khi bạn vẽ."
          actions={teacher && <Button onClick={create} loading={creating}>Bài mới</Button>}
        />
        {error && <Alert tone="error">{error}</Alert>}
        {items === null && !error && <Muted>Đang tải…</Muted>}
        {items?.length === 0 && (
          <EmptyState title="Chưa có bài GeoGebra nào" icon="📐">
            {teacher ? 'Bấm Bài mới để mở bảng GeoGebra và bắt đầu vẽ.' : 'Bài GeoGebra giáo viên chia sẻ trong buổi học sẽ hiện ở đây.'}
          </EmptyState>
        )}
        {items && items.length > 0 && (
          <div className="ui-grid-cards">
            {items.map((it) => (
              <div key={it.id} className="ui-card ggb-card">
                <Link href={`/ggb/${it.id}`} className="ggb-card__thumb" aria-label={`Mở ${it.title}`}>
                  {it.thumbnailUrl ? <img src={it.thumbnailUrl} alt="" /> : <span aria-hidden>📐</span>}
                </Link>
                <div className="ggb-card__body">
                  <b className="ggb-card__title">{it.title}</b>
                  <span className="ggb-card__meta">
                    Sửa lúc {fmtTime(it.updatedAt)} {fmtDay(it.updatedAt)}
                    {it.sessionId ? ' · từ buổi học' : ''}
                  </span>
                  <div className="ui-actions">
                    <ButtonLink href={`/ggb/${it.id}`} size="sm">Mở</ButtonLink>
                    <Button variant="ghost" size="sm" onClick={() => remove(it)}>Xoá</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Muted small>GeoGebra được dùng theo giấy phép phi thương mại của GeoGebra GmbH.</Muted>
      </Page>
    </>
  );
}
