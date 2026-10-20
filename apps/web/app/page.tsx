'use client';
import { ReactNode, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { SiteLogo } from '@/components/SiteLogo';
import {
  ButtonLink,
  CategoryCard,
  CourseCard,
  CtaBanner,
  EmptyState,
  Faq,
  FeatureIcon,
  Footer,
  Hero,
  HeroCard,
  HeroChip,
  HeroClassCard,
  HeroSlider,
  Muted,
  Section,
  Steps,
  TeacherIntro,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { assetUrl, useSite } from '@/lib/site';
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

/** Màu vòng tròn icon tính năng, lần lượt theo thứ tự (Figma "All-In-One": xanh dương, cam, xanh ngọc). */
const FEATURE_COLORS = ['var(--ui-deco-blue)', 'var(--ui-deco-orange)', 'var(--ui-deco-cyan)', 'var(--ui-deco-pink)', 'var(--ui-deco-sand)', 'var(--ui-deco-rose)'].map((bg) => ({ fg: '#fff', bg }));

/** Ảnh minh hoạ cho thẻ khoá học (khoá học chưa có ảnh riêng). */
const COURSE_IMAGES = ['/ui/demo/course-1.jpg', '/ui/demo/course-2.jpg', '/ui/demo/course-3.jpg'];

/**
 * Trang chủ theo Figma "Online Learning Landing Page" (Skilline): đầu trang nền kem với ảnh và thẻ nổi,
 * tính năng, khoá học, các bước, giáo viên, câu hỏi, kêu gọi. Nội dung lấy từ /admin/site.
 */
export default function Home() {
  const me = useMe();
  const site = useSite();
  const { home } = site;
  const show = home.show;
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);
  useEffect(() => {
    api<PublicCourse[]>('/courses/public').then(setCourses).catch(() => setCourses([]));
  }, []);

  const totalStudents = courses?.reduce((a, c) => a + c.students, 0) ?? 0;
  const totalSessions = courses?.reduce((a, c) => a + c.sessions, 0) ?? 0;
  const teacherName = home.teacher.name || courses?.[0]?.teacher || 'Giáo viên của bạn';
  const join = me ? '/schedule' : '/register';
  const heroActions = me ? (
    <ButtonLink href="/schedule" size="lg">Xem lịch học</ButtonLink>
  ) : (
    <>
      <ButtonLink href="/register" size="lg">Tạo tài khoản học viên</ButtonLink>
      <ButtonLink href="/login" variant="light" size="lg">Đăng nhập</ButtonLink>
    </>
  );

  // Thẻ nổi trên ảnh đầu trang: số liệu thật của các khoá học công khai và buổi học gần nhất.
  const next = courses
    ?.filter((c) => c.nextSession)
    .sort((a, b) => a.nextSession!.localeCompare(b.nextSession!))[0];
  let decor: ReactNode = <HeroChip />;
  if (show.stats && courses && courses.length > 0) {
    decor = (
      <>
        <HeroChip />
        <HeroCard place="a" icon="calendar" color="var(--ui-deco-cyan)" title={`${totalSessions} buổi học`} text={`${courses.length} khoá học đang mở`} />
        <HeroCard place="b" icon="users" color="var(--ui-deco-orange)" title={`${totalStudents} học viên`} text="đang theo học" />
        {next?.nextSession && (
          <HeroClassCard
            teacher={next.teacher}
            title={next.title}
            text={`Buổi tới ${fmtDay(next.nextSession)}, ${fmtTime(next.nextSession)}`}
            href={join}
            label={me ? 'Xem lịch' : 'Đăng ký'}
          />
        )}
      </>
    );
  }

  const slides = home.hero.slides.map((sl) => ({
    image: assetUrl(sl.imageAssetId),
    accent: sl.accent,
    title: sl.title,
    text: sl.text,
    button: sl.buttonLabel && sl.buttonHref ? { label: sl.buttonLabel, href: sl.buttonHref } : null,
  }));

  return (
    <div className="ui-landing">
      <Nav me={me} />
      {home.hero.mode === 'slider' ? (
        <HeroSlider autoplaySec={home.hero.autoplaySec} trust={home.hero.trust} actions={heroActions} decor={decor} slides={slides} />
      ) : (
        slides[0] && <Hero slide={slides[0]} trust={home.hero.trust} actions={heroActions} decor={decor} />
      )}

      <main className="ui-page ui-page--landing">
        {show.features && (
          <Section>
            <div className="ui-landing-head">
              <h2 className="ui-section-head__title">{home.features.title}</h2>
              {home.features.text && <p>{home.features.text}</p>}
            </div>
            <div className="ui-features">
              {home.features.items.map((f, i) => (
                <CategoryCard key={i} title={f.title} description={f.text} color={FEATURE_COLORS[i % FEATURE_COLORS.length]} icon={<FeatureIcon name={f.icon} size={40} />} />
              ))}
            </div>
          </Section>
        )}

        {show.teacher && (
          <Section>
            <TeacherIntro
              eyebrow="Người đứng lớp"
              name={teacherName}
              title={home.teacher.title}
              bio={home.teacher.bio}
              highlights={home.teacher.highlights}
              photo={assetUrl(home.teacher.photoAssetId) ?? undefined}
            />
          </Section>
        )}

        {show.courses && (
          <Section>
            <div className="ui-landing-head">
              <h2 className="ui-section-head__title">{home.courses.title}</h2>
              {home.courses.text && <p>{home.courses.text}</p>}
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
        )}

        {show.steps && home.steps.items.length > 0 && (
          <Section>
            <div className="ui-landing-head">
              <h2 className="ui-section-head__title">{home.steps.title}</h2>
            </div>
            <Steps items={home.steps.items} />
          </Section>
        )}

        {show.faq && home.faq.items.length > 0 && (
          <Section>
            <div className="ui-landing-faq">
              <div className="ui-landing-head">
                <h2 className="ui-section-head__title">{home.faq.title}</h2>
                {home.faq.text && <p>{home.faq.text}</p>}
              </div>
              <Faq items={home.faq.items} />
            </div>
          </Section>
        )}

        {show.cta && (
          <CtaBanner
            title={home.cta.title}
            action={
              !me && (
                <div className="ui-actions" style={{ justifyContent: 'center' }}>
                  {home.cta.buttonLabel && home.cta.buttonHref && <ButtonLink href={home.cta.buttonHref} size="lg">{home.cta.buttonLabel}</ButtonLink>}
                  <ButtonLink href="/login" variant="light" size="lg">Đăng nhập</ButtonLink>
                </div>
              )
            }
          >
            {home.cta.text}
          </CtaBanner>
        )}
      </main>

      <Footer
        logo={<SiteLogo tone="light" size={64} />}
        tagline={site.footer.tagline}
        copyright={site.footer.copyright || `© ${new Date().getFullYear()} ${site.brand.name}`}
        links={[
          ...site.footer.links,
          { label: me ? 'Tài khoản' : 'Đăng nhập', href: me ? '/account' : '/login' },
        ]}
      />
    </div>
  );
}
