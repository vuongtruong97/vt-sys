'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Badge, Button, ButtonLink, EmptyState, Input, List, ListRow, Modal, Muted, Page, PageHeader, Section, Select } from '@/components/ui';
import { api, ScheduleItem } from '@/lib/api';
import { fmtDay, fmtTime, joinState, toLocalInput } from '@/lib/format';
import { can } from '@/lib/can';
import { useMe } from '@/lib/useMe';
import { Icon } from '@/components/meet/icons';

type Course = { id: string; title: string; mine: boolean };
type Created = { id: string; title: string; startsAt: string; inviteKey: string | null };

const titleOf = (s: ScheduleItem) => (s.course ? `${s.course.title} · ${s.title}` : s.title);

/** Link cần duyệt: người nhận xin vào qua phòng chờ. Có khoá: vào thẳng. */
const linkOf = (id: string, key?: string | null) => `${window.location.origin}/room/${id}${key ? `?key=${key}` : ''}`;

/**
 * Đã xong: huỷ, quá giờ 30 phút, hoặc đã kết thúc sau khi bắt đầu.
 * Buổi "đã kết thúc" mà chưa tới giờ (mở thử sớm rồi đóng) vẫn tính là sắp tới, vào lại được.
 */
const isPast = (s: ScheduleItem, now: number) =>
  s.status === 'CANCELLED' ||
  (s.status !== 'LIVE' && new Date(s.endsAt).getTime() <= now - 30 * 60_000) ||
  (s.status === 'ENDED' && new Date(s.startsAt).getTime() <= now);

/** Số dòng lịch sử hiện sẵn; còn lại bấm Xem thêm. */
const PAST_LIMIT = 5;

/** Gom theo ngày, giữ thứ tự: [["Hôm nay", [...]], ["Ngày mai", [...]], ...]. */
function byDay(items: ScheduleItem[]) {
  const groups = new Map<string, ScheduleItem[]>();
  for (const s of items) {
    const k = fmtDay(s.startsAt);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups];
}

/**
 * Lịch học và cuộc họp ở một chỗ: buổi học của khoá (mình dạy hoặc học) và meeting mình tạo.
 * Một nút Tạo cho cả hai loại; mỗi dòng có Vào phòng và các thao tác của chủ phòng.
 */
export default function SchedulePage() {
  const me = useMe({ redirect: true });
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState('meeting');
  const [created, setCreated] = useState<Created | null>(null);
  const [cancelling, setCancelling] = useState<ScheduleItem | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [, tick] = useState(0);

  const canMeet = can(me, 'meeting.create');
  const canCourse = can(me, 'course.create');

  const load = useCallback(() => api<ScheduleItem[]>('/schedule').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => {
    if (!me) return;
    load();
    if (can(me, 'course.create')) api<Course[]>('/courses').then((c) => setCourses(c.filter((x) => x.mine))).catch(() => {});
    // Cập nhật nút Vào phòng mỗi 30 giây.
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [me, load]);

  const copy = async (id: string, key?: string | null) => {
    const link = linkOf(id, key);
    try {
      await navigator.clipboard.writeText(link);
      setMsg(key ? 'Đã sao chép link vào thẳng. Ai có link sẽ vào phòng ngay, không cần duyệt.' : 'Đã sao chép link cần duyệt. Người nhận sẽ chờ bạn duyệt trong phòng.');
    } catch {
      setMsg(`Link mời: ${link}`);
    }
  };

  const openCreate = () => {
    setError('');
    setKind(canMeet ? 'meeting' : courses[0]?.id ?? 'meeting');
    setCreating(true);
  };

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title') || '').trim();
    const start = new Date(String(f.get('startsAt')));
    const minutes = Number(f.get('minutes'));
    setError('');
    try {
      if (kind === 'meeting') {
        const m = await api<Created>('/meetings', {
          json: { title: title || undefined, startsAt: start.toISOString(), durationMinutes: minutes },
        });
        setCreated(m);
      } else {
        const end = new Date(start.getTime() + minutes * 60_000);
        await api(`/courses/${kind}/sessions`, { json: { title, startsAt: start.toISOString(), endsAt: end.toISOString() } });
        setMsg('Đã thêm buổi học');
      }
      setCreating(false);
      load();
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  const cancel = async (s: ScheduleItem) => {
    const what = s.course ? 'buổi học' : 'cuộc họp';
    setCancelling(null);
    setError('');
    try {
      if (s.course) await api(`/sessions/${s.id}`, { method: 'PATCH', json: { cancelled: true } });
      else await api(`/meetings/${s.id}/cancel`, { method: 'POST' });
      setMsg(`Đã huỷ ${what}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const now = Date.now();
  const upcoming = items?.filter((s) => !isPast(s, now)) ?? [];
  // Lịch sử: mới nhất trước; mục đã huỷ ẩn mặc định.
  const pastAll = items?.filter((s) => isPast(s, now)).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)) ?? [];
  const cancelledCount = pastAll.filter((s) => s.status === 'CANCELLED').length;
  const pastShown = pastAll.filter((s) => showCancelled || s.status !== 'CANCELLED');
  const past = showAllPast ? pastShown : pastShown.slice(0, PAST_LIMIT);
  const canCreate = canMeet || (canCourse && courses.length > 0);

  // Mặc định bắt đầu ngay; muốn hẹn trước thì đổi giờ.
  const defaultStart = new Date();
  defaultStart.setSeconds(0, 0);

  const row = (s: ScheduleItem) => {
    const st = s.mine ? { open: true, label: s.status === 'LIVE' ? 'Vào lại' : 'Vào phòng' } : joinState(s, now);
    return (
      <ListRow
        key={s.id}
        highlight={s.status === 'LIVE'}
        lead={{ top: fmtTime(s.startsAt), bottom: fmtTime(s.endsAt) }}
        title={titleOf(s)}
        meta={
          <>
            {s.status === 'LIVE' && <Badge>Đang diễn ra</Badge>}
            <Badge variant="neutral">{s.course ? 'Buổi học' : 'Cuộc họp'}</Badge>
            {s.course && ` ${s.students} học viên`}
          </>
        }
        actions={
          <>
            {st.open ? <ButtonLink href={`/room/${s.id}`} size="sm">{st.label}</ButtonLink> : <Button size="sm" disabled>{st.label}</Button>}
            {s.mine && !s.course && s.inviteKey && <Button variant="outline" size="sm" onClick={() => copy(s.id, s.inviteKey)}>Link vào thẳng</Button>}
            {s.mine && <Button variant="outline" size="sm" onClick={() => copy(s.id)}>{s.course ? 'Sao chép link mời' : 'Link cần duyệt'}</Button>}
            {s.mine && s.status === 'SCHEDULED' && <Button variant="ghost" size="sm" onClick={() => setCancelling(s)}>Huỷ</Button>}
          </>
        }
      />
    );
  };

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader
          title="Lịch học"
          description="Buổi học và cuộc họp của bạn, xếp theo ngày. Học viên vào phòng được từ 10 phút trước giờ bắt đầu."
          actions={canCreate && <Button onClick={openCreate}>Tạo buổi học / cuộc họp</Button>}
        />
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}

        {items === null && !error && <Muted>Đang tải…</Muted>}
        {items && upcoming.length === 0 && (
          <EmptyState
            title={canCreate ? 'Chưa có lịch sắp tới' : 'Chưa có buổi học nào'}
            icon={<Icon name="calendar" size={32} />}
            action={canCreate && <Button onClick={openCreate}>Tạo buổi học / cuộc họp</Button>}
          >
            {canCreate ? 'Lên lịch buổi học hoặc cuộc họp và lấy link mời.' : 'Khi giáo viên thêm bạn vào khoá học, lịch sẽ hiện ở đây.'}
          </EmptyState>
        )}

        {byDay(upcoming).map(([day, list]) => (
          <Section key={day} title={day}>
            <List>{list.map(row)}</List>
          </Section>
        ))}

        {pastAll.length > 0 && (
          <Section
            title="Đã kết thúc"
            actions={
              cancelledCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowCancelled(!showCancelled)}>
                  {showCancelled ? 'Ẩn mục đã huỷ' : `Hiện ${cancelledCount} mục đã huỷ`}
                </Button>
              )
            }
          >
            <List>
              {past.map((s) => (
                <ListRow
                  key={s.id}
                  lead={{ top: fmtTime(s.startsAt), bottom: fmtDay(s.startsAt) }}
                  title={titleOf(s)}
                  meta={
                    <>
                      {s.status === 'CANCELLED' && <Badge variant="danger">Đã huỷ</Badge>}
                      <Badge variant="neutral">{s.course ? 'Buổi học' : 'Cuộc họp'}</Badge>
                    </>
                  }
                  actions={
                    s.status !== 'CANCELLED' && (
                      <>
                        {s.course && <ButtonLink href={`/sessions/${s.id}`} variant="outline" size="sm">Xem lại</ButtonLink>}
                        {s.mine && <ButtonLink href={`/teach/sessions/${s.id}`} variant="outline" size="sm">Điểm danh</ButtonLink>}
                      </>
                    )
                  }
                />
              ))}
            </List>
            {pastShown.length > PAST_LIMIT && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllPast(!showAllPast)}>
                {showAllPast ? 'Thu gọn' : `Xem thêm ${pastShown.length - PAST_LIMIT} mục`}
              </Button>
            )}
          </Section>
        )}
      </Page>

      <Modal open={creating} onClose={() => setCreating(false)} title="Tạo buổi học / cuộc họp">
        <form className="ui-form" onSubmit={create}>
          {(canCourse && courses.length > 0) && (
            <Select
              label="Loại"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={[
                ...(canMeet ? [{ value: 'meeting', label: 'Cuộc họp: mời bằng link, không cần khoá học' }] : []),
                ...courses.map((c) => ({ value: c.id, label: `Buổi học: ${c.title}` })),
              ]}
            />
          )}
          <Input
            key={kind}
            label={kind === 'meeting' ? 'Tên cuộc họp' : 'Tên buổi'}
            name="title"
            required={kind !== 'meeting'}
            minLength={2}
            maxLength={160}
            placeholder={kind === 'meeting' ? (me ? `Cuộc họp của ${me.name}` : '') : 'Buổi 1: …'}
          />
          <div className="ui-form-row">
            <Input label="Bắt đầu" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(defaultStart)} />
            <Select
              label="Thời lượng"
              name="minutes"
              defaultValue="120"
              options={[30, 45, 60, 90, 120, 180, 240].map((v) => ({ value: String(v), label: `${v} phút` }))}
            />
          </div>
          <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCreating(false)}>Thôi</Button>
            <Button type="submit">Tạo</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title={cancelling ? `Huỷ ${cancelling.course ? 'buổi học' : 'cuộc họp'} "${cancelling.title}"?` : ''}
      >
        {cancelling && (
          <div className="ui-form">
            <Muted>
              {cancelling.course ? 'Học viên' : 'Người có link'} sẽ không vào được nữa. Không hoàn tác được.
            </Muted>
            <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setCancelling(null)}>Giữ lại</Button>
              <Button onClick={() => cancel(cancelling)}>Huỷ {cancelling.course ? 'buổi học' : 'cuộc họp'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Đã tạo cuộc họp">
        {created && (
          <div className="ui-form">
            <Muted>
              <b>{created.title}</b>, {fmtDay(created.startsAt)} lúc {fmtTime(created.startsAt)}. Gửi link cho người tham gia:
            </Muted>
            {[
              { label: 'Link vào thẳng (không cần duyệt)', key: created.inviteKey },
              { label: 'Link cần duyệt (xin vào qua phòng chờ)', key: null },
            ]
              .filter((l, i) => i === 1 || l.key)
              .map(({ label, key }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Input label={label} readOnly value={linkOf(created.id, key)} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                  <Button variant="outline" onClick={() => copy(created.id, key)}>Sao chép</Button>
                </div>
              ))}
            <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setCreated(null)}>Đóng</Button>
              <ButtonLink href={`/room/${created.id}`}>Vào phòng</ButtonLink>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
