'use client';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { ButtonLink, CourseCard, CtaBanner, EmptyState, Footer, Muted, Section, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type PublicCourse = {
  id: string;
  title: string;
  description: string;
  teacher: string;
  students: number;
  sessions: number;
  nextSession: string | null;
};

/** Trang chủ theo màn "Landing" của Figma: phần mở đầu nền teal, danh sách khoá học, khối kêu gọi, footer. */
export default function Home() {
  const me = useMe();
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);
  useEffect(() => {
    api<PublicCourse[]>('/courses/public').then(setCourses).catch(() => setCourses([]));
  }, []);

  const totalStudents = courses?.reduce((a, c) => a + c.students, 0) ?? 0;
  const totalSessions = courses?.reduce((a, c) => a + c.sessions, 0) ?? 0;

  return (
    <>
      <Nav me={me} />
      <section className="ui-hero">
        <div className="ui-hero__inner">
          <h1 className="ui-hero__title">
            <span className="ui-hero__accent">Học trực tuyến</span> giờ đơn giản hơn nhiều
          </h1>
          <p className="ui-hero__text">
            Lớp học video nhiều người, chia sẻ màn hình, bảng trắng chung và bản ghi điểm danh sau mỗi buổi.
          </p>
          <div className="ui-actions">
            {me ? (
              <ButtonLink href="/schedule" variant="light" size="lg">Xem lịch học</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/register" variant="light" size="lg">Tạo tài khoản học viên</ButtonLink>
                <ButtonLink href="/login" variant="glass" size="lg">Đăng nhập</ButtonLink>
              </>
            )}
          </div>
        </div>
      </section>

      <main className="ui-page">
        {courses && courses.length > 0 && (
          <div className="ui-stats">
            <Stat value={courses.length} label="khoá học đang mở" />
            <Stat value={totalSessions} label="buổi học" />
            <Stat value={totalStudents} label="học viên" />
          </div>
        )}

        <Section title="Khoá học đang mở">
          {courses === null && <Muted>Đang tải…</Muted>}
          {courses?.length === 0 && <EmptyState title="Chưa có khoá học công khai" icon="📚">Giáo viên đang chuẩn bị, quay lại sau nhé.</EmptyState>}
          <div className="ui-grid-cards">
            {courses?.map((c) => (
              <CourseCard
                key={c.id}
                title={c.title}
                description={c.description || 'Chưa có mô tả.'}
                category="Khoá học"
                duration={c.nextSession ? `Buổi tới ${fmtDay(c.nextSession)}, ${fmtTime(c.nextSession)}` : undefined}
                teacher={{ name: c.teacher }}
                footerExtra={<span className="ui-meta">{c.sessions} buổi · {c.students} học viên</span>}
              />
            ))}
          </div>
          <Muted small>Muốn tham gia khoá học? Đăng ký tài khoản rồi gửi email cho giáo viên để được thêm vào lớp.</Muted>
        </Section>

        <CtaBanner
          title="Học trực tuyến cùng giáo viên, ở bất cứ đâu."
          action={!me && <ButtonLink href="/register" size="lg">Bắt đầu học ngay</ButtonLink>}
        >
          Vào lớp bằng trình duyệt trên máy tính hoặc điện thoại, không cần cài đặt. Bản ghi và tài liệu luôn sẵn để xem lại.
        </CtaBanner>
      </main>

      <Footer
        tagline="Lớp học trực tuyến"
        links={[
          { label: 'Lịch học', href: '/schedule' },
          { label: me ? 'Tài khoản' : 'Đăng nhập', href: me ? '/account' : '/login' },
        ]}
      />
    </>
  );
}
