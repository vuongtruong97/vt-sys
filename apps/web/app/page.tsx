'use client';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import {
  ButtonLink,
  CategoryCard,
  ClassroomMockup,
  CourseCard,
  CtaBanner,
  EmptyState,
  Faq,
  FeatureIcon,
  FeatureIconName,
  Footer,
  Muted,
  Section,
  Stat,
  Steps,
  TeacherIntro,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { faq, teacher } from '@/lib/site';
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

const FEATURES: { icon: FeatureIconName; title: string; text: string; color: { fg: string; bg: string } }[] = [
  { icon: 'video', title: 'Video nhiều người', text: 'Cả lớp bật camera cùng lúc, tối đa 30 người. Âm thanh rõ, tự giảm tiếng ồn.', color: { fg: '#328182', bg: 'rgba(73,187,189,.14)' } },
  { icon: 'screen', title: 'Chia sẻ màn hình', text: 'Giáo viên trình chiếu slide và code. Học viên được chia sẻ khi giáo viên cho phép.', color: { fg: '#3d5ca8', bg: 'rgba(91,114,238,.12)' } },
  { icon: 'board', title: 'Bảng trắng chung', text: 'Viết, vẽ cùng nhau theo thời gian thực. Bảng được lưu lại cho buổi sau.', color: { fg: '#2f7a46', bg: 'rgba(47,138,79,.12)' } },
  { icon: 'quiz', title: 'Câu hỏi nhanh', text: 'Trắc nghiệm ngay trong giờ học, giáo viên xem kết quả của cả lớp tức thì.', color: { fg: '#a15c00', bg: 'rgba(244,140,6,.14)' } },
  { icon: 'groups', title: 'Chia nhóm nhỏ', text: 'Chia lớp thành các phòng nhóm để thảo luận, giáo viên ghé từng nhóm và gọi về.', color: { fg: '#8a3f9b', bg: 'rgba(176,96,196,.13)' } },
  { icon: 'record', title: 'Điểm danh và xem lại', text: 'Tự ghi điểm danh mỗi buổi. Bản ghi hình và tài liệu luôn sẵn để xem lại.', color: { fg: '#b0473f', bg: 'rgba(238,100,91,.13)' } },
];

const STEPS = [
  { title: 'Tạo tài khoản', text: 'Đăng ký bằng email hoặc tài khoản Google, mất chưa đến một phút.' },
  { title: 'Vào danh sách lớp', text: 'Gửi email cho giáo viên để được thêm vào khoá học. Lịch học hiện ngay trong tài khoản của bạn.' },
  { title: 'Vào lớp đúng giờ', text: 'Bấm "Vào lớp" trên máy tính hoặc điện thoại, kiểm tra camera, micro rồi bắt đầu học.' },
];

/** Ảnh minh hoạ cho thẻ khoá học (khoá học chưa có ảnh riêng). */
const COURSE_IMAGES = ['/ui/demo/course-1.jpg', '/ui/demo/course-2.jpg', '/ui/demo/course-3.jpg'];

/** Trang chủ theo màn "Landing" của Figma: mở đầu có hình phòng học, tính năng, khoá học, các bước, giáo viên, câu hỏi, kêu gọi. */
export default function Home() {
  const me = useMe();
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);
  useEffect(() => {
    api<PublicCourse[]>('/courses/public').then(setCourses).catch(() => setCourses([]));
  }, []);

  const totalStudents = courses?.reduce((a, c) => a + c.students, 0) ?? 0;
  const totalSessions = courses?.reduce((a, c) => a + c.sessions, 0) ?? 0;
  const teacherName = teacher.name || courses?.[0]?.teacher || 'Giáo viên của bạn';
  const join = me ? '/schedule' : '/register';

  return (
    <>
      <Nav me={me} />
      <section className="ui-hero ui-hero--split">
        <div className="ui-hero__inner">
          <div className="ui-hero__copy">
            <h1 className="ui-hero__title">
              <span className="ui-hero__accent">Học trực tuyến</span> giờ đơn giản hơn nhiều
            </h1>
            <p className="ui-hero__text">
              Lớp học video nhiều người, chia sẻ màn hình, bảng trắng chung và điểm danh tự động sau mỗi buổi.
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
            <ul className="ui-hero__trust">
              <li>Không cần cài đặt</li>
              <li>Máy tính và điện thoại</li>
              <li>Xem lại bản ghi</li>
            </ul>
          </div>
          <ClassroomMockup />
        </div>
      </section>

      <main className="ui-page">
        {courses && courses.length > 0 && (
          <div className="ui-stats ui-stats--float">
            <Stat value={courses.length} label="khoá học đang mở" />
            <Stat value={totalSessions} label="buổi học" />
            <Stat value={totalStudents} label="học viên" />
          </div>
        )}

        <Section>
          <div className="ui-landing-head">
            <h2 className="ui-section-head__title">Mọi thứ cho một buổi học trực tuyến</h2>
            <p>Mọi công cụ nằm ngay trong trình duyệt: giáo viên dạy, học viên học, không phải chuyển qua lại nhiều ứng dụng.</p>
          </div>
          <div className="ui-features">
            {FEATURES.map((f) => (
              <CategoryCard key={f.title} title={f.title} description={f.text} color={f.color} icon={<FeatureIcon name={f.icon} size={34} />} />
            ))}
          </div>
        </Section>

        <Section>
          <div className="ui-landing-head">
            <h2 className="ui-section-head__title">Khoá học đang mở</h2>
            <p>Đăng ký tài khoản rồi gửi email cho giáo viên để được thêm vào lớp.</p>
          </div>
          {courses === null && <Muted>Đang tải…</Muted>}
          {courses?.length === 0 && <EmptyState title="Chưa có khoá học công khai" icon="📚">Giáo viên đang chuẩn bị, quay lại sau nhé.</EmptyState>}
          <div className="ui-grid-cards">
            {courses?.map((c, i) => (
              <CourseCard
                key={c.id}
                href={join}
                image={COURSE_IMAGES[i % COURSE_IMAGES.length]}
                title={c.title}
                description={c.description || 'Chưa có mô tả.'}
                category="Khoá học"
                duration={c.nextSession ? `Buổi tới ${fmtDay(c.nextSession)}, ${fmtTime(c.nextSession)}` : undefined}
                teacher={{ name: c.teacher }}
                footerExtra={<span className="ui-meta">{c.sessions} buổi · {c.students} học viên</span>}
              />
            ))}
          </div>
        </Section>

        <Section>
          <div className="ui-landing-head">
            <h2 className="ui-section-head__title">Tham gia lớp học trong 3 bước</h2>
          </div>
          <Steps items={STEPS} />
        </Section>

        <Section>
          <div className="ui-landing-head">
            <h2 className="ui-section-head__title">Người đứng lớp</h2>
          </div>
          <TeacherIntro name={teacherName} title={teacher.title} bio={teacher.bio} highlights={teacher.highlights} photo={teacher.photo} />
        </Section>

        <Section>
          <div className="ui-landing-faq">
            <div className="ui-landing-head">
              <h2 className="ui-section-head__title">Câu hỏi thường gặp</h2>
              <p>Chưa thấy câu trả lời bạn cần? Hỏi giáo viên trực tiếp trong buổi học hoặc qua email.</p>
            </div>
            <Faq items={faq} />
          </div>
        </Section>

        <CtaBanner
          title="Học trực tuyến cùng giáo viên, ở bất cứ đâu."
          action={
            !me && (
              <div className="ui-actions" style={{ justifyContent: 'center' }}>
                <ButtonLink href="/register" size="lg">Bắt đầu học ngay</ButtonLink>
                <ButtonLink href="/login" variant="glass" size="lg">Đăng nhập</ButtonLink>
              </div>
            )
          }
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
