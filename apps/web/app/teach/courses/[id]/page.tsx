'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Materials } from '@/components/Materials';
import { Nav } from '@/components/Nav';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  List,
  ListRow,
  Muted,
  Page,
  PageHeader,
  Section,
  Select,
  Switch,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime, toLocalInput } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Session = { id: string; title: string; startsAt: string; endsAt: string; status: string };
type Course = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  sessions: Session[];
  enrollments: { id: string; user: { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null } }[];
};

const statusLabel: Record<string, string> = { SCHEDULED: 'Đã lên lịch', LIVE: 'Đang diễn ra', ENDED: 'Đã kết thúc', CANCELLED: 'Đã huỷ' };

/** Thời lượng chọn được khi thêm buổi (giống form trong Lịch học). */
const DURATIONS = [30, 45, 60, 90, 120, 180, 240];

type SessionLite = { status: string; startsAt: string; endsAt: string };

/** Buổi đã xong: huỷ, quá giờ kết thúc, hoặc đã kết thúc sau giờ bắt đầu (cùng cách tính với Lịch học). */
const isDone = (s: SessionLite) =>
  s.status === 'CANCELLED' ||
  (s.status !== 'LIVE' && new Date(s.endsAt).getTime() < Date.now()) ||
  (s.status === 'ENDED' && new Date(s.startsAt).getTime() <= Date.now());

/** Buổi sắp tới trước (gần nhất lên đầu), buổi đã xong sau (mới nhất lên đầu). */
function sortSessions<T extends SessionLite>(list: T[]) {
  const t = (s: T) => new Date(s.startsAt).getTime();
  const next = list.filter((s) => !isDone(s)).sort((a, b) => t(a) - t(b));
  const done = list.filter(isDone).sort((a, b) => t(b) - t(a));
  return [...next, ...done];
}

export default function CoursePage({ params }: { params: { id: string } }) {
  const me = useMe({ redirect: true });
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => api<Course>(`/courses/${params.id}`).then(setCourse).catch((e) => setError(e.message)), [params.id]);
  useEffect(() => {
    if (me) load();
  }, [me, load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError('');
    setMsg('');
    try {
      await fn();
      if (ok) setMsg(ok);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addSession = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const start = new Date(String(f.get('startsAt')));
    const end = new Date(start.getTime() + Number(f.get('minutes')) * 60_000);
    run(() => api(`/courses/${params.id}/sessions`, { json: { title: f.get('title'), startsAt: start.toISOString(), endsAt: end.toISOString() } }), 'Đã thêm buổi học').then(() => form.reset());
  };

  const enroll = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get('email'));
    run(() => api(`/courses/${params.id}/enrollments`, { json: { email } }), `Đã thêm ${email} vào lớp`).then(() => form.reset());
  };

  const defaultStart = new Date(Date.now() + 24 * 3600_000);
  defaultStart.setHours(19, 30, 0, 0);

  return (
    <>
      <Nav me={me} />
      <Page>
        {!course && !error && <Muted>Đang tải…</Muted>}
        {course && (
          <PageHeader
            back={{ href: '/teach', label: 'Quản lý lớp' }}
            title={course.title}
            description={course.description}
            actions={
              <Switch
                checked={course.published}
                onChange={(v) => run(() => api(`/courses/${course.id}`, { method: 'PATCH', json: { published: v } }), v ? 'Khoá học đã hiện trên trang chủ' : 'Đã ẩn khoá học khỏi trang chủ')}
                label="Hiện trên trang chủ"
              />
            }
          />
        )}
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}

        {course && (
          <>
            <div className="ui-cols">
              <Section title={`Buổi học (${course.sessions.length})`}>
                {course.sessions.length === 0 && <Muted>Chưa có buổi nào. Thêm buổi đầu tiên bên dưới.</Muted>}
                <List>
                  {sortSessions(course.sessions).map((s) => (
                    <ListRow
                      key={s.id}
                      highlight={s.status === 'LIVE'}
                      lead={{ top: fmtTime(s.startsAt), bottom: fmtDay(s.startsAt) }}
                      title={s.title}
                      meta={
                        <>
                          <Badge variant={s.status === 'CANCELLED' || s.status === 'ENDED' ? 'neutral' : 'soft'}>{statusLabel[s.status]}</Badge>
                          đến {fmtTime(s.endsAt)}
                        </>
                      }
                      actions={
                        <>
                          {!isDone(s) && <ButtonLink href={`/room/${s.id}`} size="sm">{s.status === 'LIVE' ? 'Vào lại' : 'Vào phòng'}</ButtonLink>}
                          {isDone(s) && s.status !== 'CANCELLED' && (
                            <>
                              <ButtonLink href={`/teach/sessions/${s.id}`} variant="outline" size="sm">Điểm danh</ButtonLink>
                              <ButtonLink href={`/sessions/${s.id}`} variant="outline" size="sm">Ghi hình, tài liệu</ButtonLink>
                            </>
                          )}
                          {s.status === 'SCHEDULED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm(`Huỷ buổi "${s.title}"? Học viên sẽ không vào được buổi này.`)) {
                                  run(() => api(`/sessions/${s.id}`, { method: 'PATCH', json: { cancelled: true } }), 'Đã huỷ buổi học');
                                }
                              }}
                            >
                              Huỷ
                            </Button>
                          )}
                        </>
                      }
                    />
                  ))}
                </List>
                <Card padded>
                  <form className="ui-form" onSubmit={addSession}>
                    <h3 className="ui-sec__title" style={{ fontSize: 20 }}>Thêm buổi học</h3>
                    <Input label="Tên buổi" name="title" required placeholder={`Buổi ${course.sessions.length + 1}: …`} />
                    <div className="ui-form-row">
                      <Input label="Bắt đầu" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(defaultStart)} />
                      <Select
                        label="Thời lượng"
                        name="minutes"
                        defaultValue="120"
                        options={DURATIONS.map((m) => ({ value: String(m), label: `${m} phút` }))}
                      />
                    </div>
                    <div className="ui-actions">
                      <Button type="submit">Thêm buổi học</Button>
                    </div>
                  </form>
                </Card>
              </Section>

              <Section title={`Học viên (${course.enrollments.length})`}>
                <form className="ui-form-row" style={{ alignItems: 'end' }} onSubmit={enroll}>
                  <Input
                    label="Thêm bằng email"
                    name="email"
                    type="email"
                    required
                    placeholder="hocvien@gmail.com"
                    hint="Học viên cần tạo tài khoản trước. Người chưa có trong danh sách vẫn xin vào được qua phòng chờ."
                  />
                  <div className="ui-actions" style={{ alignSelf: 'start', marginTop: 32 }}>
                    <Button type="submit">Thêm</Button>
                  </div>
                </form>
                {course.enrollments.length > 0 && (
                  <Table caption="Học viên của khoá" style={{ minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th>Học viên</th>
                        <th>
                          <span className="ui-sr-only">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.enrollments.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <span className="ui-who">
                              <Avatar name={e.user.name} src={e.user.avatarUrl} size={32} decorative />
                              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                {e.user.name}
                                <span className="ui-sub">{e.user.email}{e.user.phone && ` · ${e.user.phone}`}</span>
                              </span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm(`Xoá ${e.user.name} khỏi khoá học?`)) {
                                  run(() => api(`/courses/${course.id}/enrollments/${e.user.id}`, { method: 'DELETE' }), `Đã xoá ${e.user.name} khỏi lớp`);
                                }
                              }}
                            >
                              Xoá
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Section>
            </div>

            <Section title="Tài liệu của khoá">
              <Muted small>
                Tài liệu tải lên ở đây dùng chung cho mọi buổi. Tài liệu riêng từng buổi tải trong trang &quot;Ghi hình, tài liệu&quot; của buổi đó hoặc ngay trong phòng học.
              </Muted>
              <Materials courseId={course.id} canEdit />
            </Section>
          </>
        )}
      </Page>
    </>
  );
}
