'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Badge, Button, Card, CourseCard, EmptyState, Input, Muted, Page, PageHeader, Section, Switch, Textarea } from '@/components/ui';
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

export default function TeachPage() {
  const me = useMe({ redirect: true });
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api<Course[]>('/courses').then(setCourses).catch((e) => setError(e.message));
  useEffect(() => {
    if (canTeachArea(me)) load();
  }, [me]);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError('');
    setBusy(true);
    try {
      await api('/courses', { json: { title: f.get('title'), description: f.get('description'), published } });
      form.reset();
      setPublished(false);
      load();
    } catch (err) {
      setError((err as Error).message);
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

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader title="Quản lý lớp" description="Tạo khoá học, lên lịch buổi học và thêm học viên." />
        <div className="ui-cols">
          <Section title={canCreate && !can(me, 'course.view_all', 'course.manage_all') ? 'Khoá học của bạn' : 'Khoá học'}>
            {courses === null && !error && <Muted>Đang tải…</Muted>}
            {courses?.length === 0 && <EmptyState title="Chưa có khoá học" icon="📚">{canCreate ? 'Tạo khoá đầu tiên ở khung bên cạnh.' : 'Chưa có giáo viên nào tạo khoá học.'}</EmptyState>}
            <div className="ui-list">
              {courses?.map((c) => (
                <CourseCard
                  key={c.id}
                  href={`/teach/courses/${c.id}`}
                  title={c.title}
                  description={c.description || undefined}
                  footerExtra={
                    <span className="ui-actions">
                      <span className="ui-meta">
                        {c._count.sessions} buổi · {c._count.enrollments} học viên{c.mine ? '' : ` · ${c.teacher.name}`}
                      </span>
                      <Badge variant={c.published ? 'soft' : 'neutral'}>{c.published ? 'Công khai' : 'Nháp'}</Badge>
                    </span>
                  }
                />
              ))}
            </div>
          </Section>

          {canCreate && (
          <Section title="Tạo khoá học">
            <Card padded>
              <form className="ui-form" onSubmit={create}>
                <Input label="Tên khoá học" name="title" required minLength={3} placeholder="Ví dụ: Python cơ bản" />
                <Textarea label="Mô tả" name="description" rows={3} placeholder="Khoá học dành cho ai, học xong làm được gì" />
                <Switch checked={published} onChange={setPublished} label="Hiện trên trang chủ" />
                {error && <Alert tone="error">{error}</Alert>}
                <div className="ui-actions">
                  <Button type="submit" loading={busy}>
                    Tạo khoá học
                  </Button>
                </div>
              </form>
            </Card>
          </Section>
          )}
        </div>
      </Page>
    </>
  );
}
