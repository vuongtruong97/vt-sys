'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Badge, Button, ButtonLink, EmptyState, Input, Modal, Muted, Page, PageHeader, Section, Select, Switch, Table, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { can, canTeachArea } from '@/lib/can';
import { useMe } from '@/lib/useMe';

type Course = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  mine: boolean;
  teacher: { id: string; name: string };
  _count: { enrollments: number; sessions: number };
};

/** Quản lý lớp: bảng khoá học (của mình, hoặc mọi khoá nếu có quyền xem/quản lý toàn hệ thống), tạo khoá qua hộp thoại. */
export default function TeachPage() {
  const me = useMe({ redirect: true });
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [creating, setCreating] = useState(false);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => api<Course[]>('/courses').then(setCourses).catch((e) => setError(e.message));
  useEffect(() => {
    if (canTeachArea(me)) load();
  }, [me]);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setFormError('');
    setBusy(true);
    try {
      const title = String(f.get('title') ?? '').trim();
      await api('/courses', { json: { title, description: f.get('description'), published } });
      setCreating(false);
      setPublished(false);
      setMsg(`Đã tạo khoá "${title}". Bấm Quản lý để lên lịch buổi học và thêm học viên.`);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canCreate = can(me, 'course.create');
  if (me && !canTeachArea(me)) {
    return (
      <>
        <Nav me={me} />
        <Page>
          <Alert tone="info">Tài khoản của bạn chưa có quyền dạy học. Liên hệ quản trị viên nếu bạn cần mở khoá học.</Alert>
        </Page>
      </>
    );
  }

  // Có khoá của giáo viên khác (người xem/quản lý mọi khoá): hiện cột Giáo viên và bộ lọc "Của tôi".
  const others = !!courses?.some((c) => !c.mine);
  const term = q.trim().toLowerCase();
  const shown = (courses ?? []).filter(
    (c) => (scope === 'all' || c.mine) && (!term || c.title.toLowerCase().includes(term) || c.teacher.name.toLowerCase().includes(term)),
  );
  const openCreate = () => {
    setFormError('');
    setCreating(true);
  };

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader
          title="Quản lý lớp"
          description="Khoá học, lịch buổi học và danh sách học viên."
          actions={canCreate && <Button onClick={openCreate}>Tạo khoá học</Button>}
        />
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}

        <Section>
          {courses === null && !error && <Muted>Đang tải…</Muted>}
          {courses?.length === 0 && (
            <EmptyState title="Chưa có khoá học" icon="📚" action={canCreate && <Button onClick={openCreate}>Tạo khoá học đầu tiên</Button>}>
              {canCreate ? 'Tạo khoá học, rồi lên lịch buổi học và thêm học viên bằng email.' : 'Chưa có giáo viên nào tạo khoá học.'}
            </EmptyState>
          )}

          {!!courses?.length && (
            <>
              <div className="ui-form-row" style={{ alignItems: 'end' }}>
                <Input label="Tìm khoá học" value={q} onChange={(e) => setQ(e.target.value)} placeholder={others ? 'Tên khoá hoặc giáo viên' : 'Tên khoá học'} />
                {others && (
                  <Select
                    label="Hiện"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'all' | 'mine')}
                    options={[
                      { value: 'all', label: 'Tất cả khoá học' },
                      { value: 'mine', label: 'Khoá tôi dạy' },
                    ]}
                  />
                )}
              </div>
              <Muted small>
                {shown.length === courses.length ? `${courses.length} khoá học` : `${shown.length} / ${courses.length} khoá học`}
              </Muted>
              <Table caption="Khoá học">
                <thead>
                  <tr>
                    <th>Khoá học</th>
                    {others && <th>Giáo viên</th>}
                    <th className="ui-num">Buổi</th>
                    <th className="ui-num">Học viên</th>
                    <th>Trạng thái</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <a className="ui-link" href={`/teach/courses/${c.id}`}>{c.title}</a>
                        {c.description && <span className="ui-sub ui-clamp-1">{c.description}</span>}
                      </td>
                      {others && <td>{c.mine ? 'Bạn' : c.teacher.name}</td>}
                      <td className="ui-num">{c._count.sessions}</td>
                      <td className="ui-num">{c._count.enrollments}</td>
                      <td>
                        <Badge variant={c.published ? 'soft' : 'neutral'}>{c.published ? 'Công khai' : 'Nháp'}</Badge>
                      </td>
                      <td>
                        <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
                          <ButtonLink href={`/teach/courses/${c.id}`} variant="outline" size="sm">Quản lý</ButtonLink>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {shown.length === 0 && <Muted small>Không có khoá học nào khớp.</Muted>}
            </>
          )}
        </Section>
      </Page>

      <Modal open={creating} onClose={() => setCreating(false)} title="Tạo khoá học">
        <form className="ui-form" onSubmit={create}>
          <Input label="Tên khoá học" name="title" required minLength={3} placeholder="Ví dụ: Python cơ bản" />
          <Textarea label="Mô tả" name="description" rows={3} placeholder="Khoá học dành cho ai, học xong làm được gì" />
          <Switch checked={published} onChange={setPublished} label="Hiện trên trang chủ" />
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Huỷ</Button>
            <Button type="submit" loading={busy}>Tạo khoá học</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
