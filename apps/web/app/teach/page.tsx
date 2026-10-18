'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Badge, Button, Card, CourseCard, EmptyState, Input, Muted, Page, PageHeader, Section, Switch, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/useMe';

type Course = { id: string; title: string; description: string; published: boolean; _count: { enrollments: number; sessions: number } };

export default function TeachPage() {
  const me = useMe({ redirect: true });
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api<Course[]>('/courses').then(setCourses).catch((e) => setError(e.message));
  useEffect(() => {
    if (me && me.role !== 'STUDENT') load();
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

  if (me && me.role === 'STUDENT') {
    return (
      <>
        <Nav me={me} />
        <Page>
          <Alert tone="info">Trang này chỉ dành cho giáo viên.</Alert>
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
          <Section title="Khoá học của bạn">
            {courses === null && !error && <Muted>Đang tải…</Muted>}
            {courses?.length === 0 && <EmptyState title="Chưa có khoá học" icon="📚">Tạo khoá đầu tiên ở khung bên cạnh.</EmptyState>}
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
                        {c._count.sessions} buổi · {c._count.enrollments} học viên
                      </span>
                      <Badge variant={c.published ? 'soft' : 'neutral'}>{c.published ? 'Công khai' : 'Nháp'}</Badge>
                    </span>
                  }
                />
              ))}
            </div>
          </Section>

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
        </div>
      </Page>
    </>
  );
}
