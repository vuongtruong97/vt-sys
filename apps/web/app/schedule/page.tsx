'use client';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Badge, Button, ButtonLink, EmptyState, List, ListRow, Muted, Page, PageHeader, Section } from '@/components/ui';
import { api, ScheduleItem } from '@/lib/api';
import { fmtDay, fmtTime, joinState } from '@/lib/format';
import { useMe } from '@/lib/useMe';

export default function SchedulePage() {
  const me = useMe({ redirect: true });
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!me) return;
    api<ScheduleItem[]>('/schedule').then(setItems).catch(() => setItems([]));
    // Cập nhật nút Vào lớp mỗi 30 giây.
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [me]);

  const now = Date.now();
  const upcoming = items?.filter((s) => new Date(s.endsAt).getTime() > now - 30 * 60_000) ?? [];
  const past = items?.filter((s) => new Date(s.endsAt).getTime() <= now - 30 * 60_000).reverse() ?? [];
  const teacher = !!me && me.role !== 'STUDENT';

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader
          title="Lịch học"
          description="Học viên vào được lớp từ 10 phút trước giờ học."
          actions={teacher && <ButtonLink href="/teach" variant="outline">Tạo buổi học</ButtonLink>}
        />

        {items === null && <Muted>Đang tải…</Muted>}
        {items && upcoming.length === 0 && (
          <EmptyState title="Chưa có buổi học nào sắp tới" icon="🗓️">
            {teacher ? 'Vào Quản lý lớp để tạo khoá học và lên lịch buổi đầu tiên.' : 'Khi giáo viên thêm bạn vào khoá học, lịch sẽ hiện ở đây.'}
          </EmptyState>
        )}

        <List>
          {upcoming.map((s) => {
            const st = teacher ? { open: s.status !== 'CANCELLED', label: s.status === 'LIVE' ? 'Vào lại lớp' : 'Mở lớp' } : joinState(s, now);
            return (
              <ListRow
                key={s.id}
                highlight={st.open}
                lead={{ top: fmtTime(s.startsAt), bottom: fmtDay(s.startsAt) }}
                title={`${s.course.title} · ${s.title}`}
                meta={
                  <>
                    {s.status === 'LIVE' && <Badge>Đang diễn ra</Badge>}
                    {s.status === 'CANCELLED' && <Badge variant="neutral">Đã huỷ</Badge>}
                    {fmtTime(s.startsAt)} – {fmtTime(s.endsAt)} · {s.students} học viên
                  </>
                }
                actions={st.open ? <ButtonLink href={`/room/${s.id}`}>{st.label}</ButtonLink> : <Button disabled>{st.label}</Button>}
              />
            );
          })}
        </List>

        {past.length > 0 && (
          <Section title="Đã học">
            <List>
              {past.map((s) => (
                <ListRow
                  key={s.id}
                  lead={{ top: fmtTime(s.startsAt), bottom: fmtDay(s.startsAt) }}
                  title={`${s.course.title} · ${s.title}`}
                  meta={s.status === 'CANCELLED' ? <Badge variant="neutral">Đã huỷ</Badge> : undefined}
                  actions={
                    <>
                      {s.status !== 'CANCELLED' && <ButtonLink href={`/sessions/${s.id}`} variant="outline" size="sm">Xem lại</ButtonLink>}
                      {teacher && <ButtonLink href={`/teach/sessions/${s.id}`} variant="outline" size="sm">Điểm danh</ButtonLink>}
                    </>
                  }
                />
              ))}
            </List>
          </Section>
        )}
      </Page>
    </>
  );
}
