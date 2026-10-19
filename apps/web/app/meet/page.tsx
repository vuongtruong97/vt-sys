'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Input,
  List,
  ListRow,
  Modal,
  Muted,
  Page,
  PageHeader,
  Section,
  Select,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime, toLocalInput } from '@/lib/format';
import { can } from '@/lib/can';
import { useMe } from '@/lib/useMe';

type Meeting = { id: string; title: string; startsAt: string; endsAt: string; status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED' };

const linkOf = (id: string) => `${window.location.origin}/room/${id}`;

/** Meeting độc lập kiểu Google Meet: họp ngay hoặc hẹn giờ, mời bằng link, khách vào qua phòng chờ. */
export default function MeetPage() {
  const me = useMe({ redirect: true });
  const router = useRouter();
  const [items, setItems] = useState<Meeting[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [starting, setStarting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [created, setCreated] = useState<Meeting | null>(null);

  const load = useCallback(() => api<Meeting[]>('/meetings').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  const teacher = can(me, 'meeting.create');

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(id));
      setMsg('Đã sao chép link mời');
    } catch {
      setMsg(`Link mời: ${linkOf(id)}`);
    }
  };

  const startNow = async () => {
    setError('');
    setStarting(true);
    try {
      const m = await api<Meeting>('/meetings', { json: {} });
      router.push(`/room/${m.id}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  };

  const schedule = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    try {
      const m = await api<Meeting>('/meetings', {
        json: {
          title: String(f.get('title') || '').trim() || undefined,
          startsAt: new Date(String(f.get('startsAt'))).toISOString(),
          durationMinutes: Number(f.get('minutes')),
        },
      });
      setScheduling(false);
      setCreated(m);
      load();
    } catch (err) {
      setError((err as Error).message);
      setScheduling(false);
    }
  };

  const cancel = async (m: Meeting) => {
    if (!window.confirm(`Huỷ "${m.title}"? Người có link sẽ không vào được nữa.`)) return;
    setError('');
    try {
      await api(`/meetings/${m.id}/cancel`, { method: 'POST' });
      setMsg('Đã huỷ meeting');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const now = Date.now();
  const active = (m: Meeting) => m.status === 'LIVE' || (m.status === 'SCHEDULED' && new Date(m.endsAt).getTime() > now - 30 * 60_000);
  const upcoming = items?.filter(active).reverse() ?? [];
  const past = items?.filter((m) => !active(m)) ?? [];

  const defaultStart = new Date(Date.now() + 3600_000);
  defaultStart.setMinutes(0, 0, 0);

  if (me && !teacher) {
    return (
      <>
        <Nav me={me} />
        <Page narrow>
          <EmptyState title="Chỉ giáo viên tạo được meeting" icon="🔒">
            Nếu được mời, hãy mở link giáo viên gửi để xin vào phòng.
          </EmptyState>
        </Page>
      </>
    );
  }

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader
          title="Meeting"
          description="Họp trực tuyến không cần khoá học. Gửi link cho người tham gia; họ xin vào và bạn duyệt trong phòng."
          actions={
            <>
              <Button onClick={startNow} loading={starting}>Họp ngay</Button>
              <Button variant="outline" onClick={() => setScheduling(true)}>Hẹn giờ</Button>
            </>
          }
        />
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}

        {items === null && !error && <Muted>Đang tải…</Muted>}
        {items && upcoming.length === 0 && (
          <EmptyState title="Chưa có meeting nào sắp tới" icon="📹">
            Bấm Họp ngay để mở phòng và lấy link mời, hoặc Hẹn giờ để lên lịch trước.
          </EmptyState>
        )}

        <List>
          {upcoming.map((m) => (
            <ListRow
              key={m.id}
              highlight={m.status === 'LIVE'}
              lead={{ top: fmtTime(m.startsAt), bottom: fmtDay(m.startsAt) }}
              title={m.title}
              meta={
                <>
                  {m.status === 'LIVE' && <Badge>Đang diễn ra</Badge>}
                  {fmtTime(m.startsAt)} – {fmtTime(m.endsAt)}
                </>
              }
              actions={
                <>
                  <ButtonLink href={`/room/${m.id}`} size="sm">{m.status === 'LIVE' ? 'Vào lại' : 'Mở phòng'}</ButtonLink>
                  <Button variant="outline" size="sm" onClick={() => copy(m.id)}>Sao chép link</Button>
                  <Button variant="ghost" size="sm" onClick={() => cancel(m)}>Huỷ</Button>
                </>
              }
            />
          ))}
        </List>

        {past.length > 0 && (
          <Section title="Đã kết thúc">
            <List>
              {past.map((m) => (
                <ListRow
                  key={m.id}
                  lead={{ top: fmtTime(m.startsAt), bottom: fmtDay(m.startsAt) }}
                  title={m.title}
                  meta={m.status === 'CANCELLED' ? <Badge variant="neutral">Đã huỷ</Badge> : undefined}
                  actions={m.status !== 'CANCELLED' && <ButtonLink href={`/teach/sessions/${m.id}`} variant="outline" size="sm">Điểm danh</ButtonLink>}
                />
              ))}
            </List>
          </Section>
        )}
      </Page>

      <Modal open={scheduling} onClose={() => setScheduling(false)} title="Hẹn giờ meeting">
        <form id="meet-schedule" className="ui-form" onSubmit={schedule}>
          <Input label="Tên meeting" name="title" placeholder={me ? `Meeting của ${me.name}` : ''} maxLength={160} />
          <div className="ui-form-row">
            <Input label="Bắt đầu" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(defaultStart)} />
            <Select
              label="Thời lượng"
              name="minutes"
              defaultValue="60"
              options={[30, 45, 60, 90, 120].map((v) => ({ value: String(v), label: `${v} phút` }))}
            />
          </div>
          <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setScheduling(false)}>Thôi</Button>
            <Button type="submit">Tạo meeting</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Đã tạo meeting">
        {created && (
          <div className="ui-form">
            <Muted>
              <b>{created.title}</b>, {fmtDay(created.startsAt)} lúc {fmtTime(created.startsAt)}. Gửi link này cho người tham gia:
            </Muted>
            <Input label="Link mời" readOnly value={linkOf(created.id)} onFocus={(e) => e.currentTarget.select()} />
            <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setCreated(null)}>Đóng</Button>
              <Button onClick={() => copy(created.id)}>Sao chép link</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
