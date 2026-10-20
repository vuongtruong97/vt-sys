'use client';
import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { SiteLogo } from '@/components/SiteLogo';
import {
  ButtonLink,
  CategoryCard,
  ClassroomMockup,
  CourseCard,
  CtaBanner,
  EmptyState,
  Faq,
  FeatureIcon,
  Footer,
  HeroSlider,
  Muted,
  Section,
  Stat,
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

/** Màu ô icon tính năng, lần lượt theo thứ tự (nội dung chỉ chọn icon, màu theo vị trí). */
const FEATURE_COLORS = [
  { fg: 'var(--md-on-primary-container)', bg: 'var(--md-primary-container)' },
  { fg: 'var(--md-on-secondary-container)', bg: 'var(--md-secondary-container)' },
  { fg: 'var(--md-on-success-container)', bg: 'var(--md-success-container)' },
  { fg: 'var(--md-on-tertiary-container)', bg: 'var(--md-tertiary-container)' },
  { fg: 'var(--md-on-primary-container)', bg: 'var(--md-primary-container)' },
  { fg: 'var(--md-on-error-container)', bg: 'var(--md-error-container)' },
];

/** Ảnh minh hoạ cho thẻ khoá học (khoá học chưa có ảnh riêng). */
const COURSE_IMAGES = ['/ui/demo/course-1.jpg', '/ui/demo/course-2.jpg', '/ui/demo/course-3.jpg'];

/** Trang chủ theo màn "Landing" của Figma: mở đầu có hình phòng học, tính năng, khoá học, các bước, giáo viên, câu hỏi, kêu gọi. */
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
  const first = home.hero.slides[0];
  const heroActions = me ? (
    <ButtonLink href="/schedule" variant="light" size="lg">Xem lịch học</ButtonLink>
  ) : (
    <>
      <ButtonLink href="/register" variant="light" size="lg">Tạo tài khoản học viên</ButtonLink>
      <ButtonLink href="/login" variant="glass" size="lg">Đăng nhập</ButtonLink>
    </>
  );
  const join = me ? '/schedule' : '/register';

  return (
    <>
      <Nav me={me} />
      {home.hero.mode === 'slider' ? (
        <HeroSlider
          autoplaySec={home.hero.autoplaySec}
          trust={home.hero.trust}
          actions={heroActions}
          slides={home.hero.slides.map((sl) => ({
            image: assetUrl(sl.imageAssetId),
            accent: sl.accent,
            title: sl.title,
            text: sl.text,
            button: sl.buttonLabel && sl.buttonHref ? { label: sl.buttonLabel, href: sl.buttonHref } : null,
          }))}
        />
      ) : (
        <section className="ui-hero ui-hero--split">
          <div className="ui-hero__inner">
            <div className="ui-hero__copy">
              <h1 className="ui-hero__title">
                {first?.accent && <span className="ui-hero__accent">{first.accent}</span>} {first?.title}
              </h1>
              {first?.text && <p className="ui-hero__text">{first.text}</p>}
              <div className="ui-actions">
                {first?.buttonLabel && first.buttonHref ? (
                  <ButtonLink href={first.buttonHref} variant="light" size="lg">{first.buttonLabel}</ButtonLink>
                ) : (
                  heroActions
                )}
              </div>
              {home.hero.trust.length > 0 && (
                <ul className="ui-hero__trust">
                  {home.hero.trust.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
            <ClassroomMockup />
          </div>
        </section>
      )}

      <main className="ui-page">
        {show.stats && courses && courses.length > 0 && (
          <div className={home.hero.mode === 'slider' ? 'ui-stats ui-stats--float ui-stats--after-slider' : 'ui-stats ui-stats--float'}>
            <Stat value={courses.length} label="khoá học đang mở" />
            <Stat value={totalSessions} label="buổi học" />
            <Stat value={totalStudents} label="học viên" />
          </div>
        )}

        {show.features && (
          <Section>
            <div className="ui-landing-head">
              <h2 className="ui-section-head__title">{home.features.title}</h2>
              {home.features.text && <p>{home.features.text}</p>}
            </div>
            <div className="ui-features">
              {home.features.items.map((f, i) => (
                <CategoryCard key={i} title={f.title} description={f.text} color={FEATURE_COLORS[i % FEATURE_COLORS.length]} icon={<FeatureIcon name={f.icon} size={34} />} />
              ))}
            </div>
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

        {show.teacher && (
          <Section>
            <div className="ui-landing-head">
              <h2 className="ui-section-head__title">Người đứng lớp</h2>
            </div>
            <TeacherIntro
              name={teacherName}
              title={home.teacher.title}
              bio={home.teacher.bio}
              highlights={home.teacher.highlights}
              photo={assetUrl(home.teacher.photoAssetId) ?? ''}
            />
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
                  <ButtonLink href="/login" variant="glass" size="lg">Đăng nhập</ButtonLink>
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
    </>
  );
}
