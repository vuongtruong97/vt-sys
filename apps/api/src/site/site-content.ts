/**
 * Nội dung trang công khai mà quản trị viên sửa được ở /admin/site (bản nháp, bản đã xuất bản).
 * Web có bản sao kiểu này ở apps/web/lib/siteTypes.ts: đổi ở đây thì đổi cả bên đó.
 */

export const FEATURE_ICONS = ['video', 'screen', 'board', 'quiz', 'groups', 'record'] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];

export type Slide = { imageAssetId: string | null; title: string; accent: string; text: string; buttonLabel: string; buttonHref: string };
export type Link = { label: string; href: string };

export type SiteContent = {
  brand: { name: string; short: string; primaryColor: string | null; logoAssetId: string | null; faviconAssetId: string | null };
  seo: { title: string; description: string; ogImageAssetId: string | null };
  home: {
    show: { stats: boolean; features: boolean; courses: boolean; steps: boolean; teacher: boolean; faq: boolean; cta: boolean };
    hero: { mode: 'slider' | 'illustration'; autoplaySec: number; trust: string[]; slides: Slide[] };
    features: { title: string; text: string; items: { icon: FeatureIcon; title: string; text: string }[] };
    courses: { title: string; text: string };
    steps: { title: string; items: { title: string; text: string }[] };
    teacher: { name: string; title: string; photoAssetId: string | null; bio: string; highlights: string[] };
    faq: { title: string; text: string; items: { q: string; a: string }[] };
    cta: { title: string; text: string; buttonLabel: string; buttonHref: string };
  };
  footer: { tagline: string; links: Link[]; copyright: string };
  auth: {
    imageAssetId: string | null;
    captionTitle: string;
    captionText: string;
    loginWelcome: string;
    loginLead: string;
    registerWelcome: string;
    registerLead: string;
  };
};

/** Nội dung trước khi có trang quản trị: chưa sửa gì thì trang giữ nguyên như cũ. */
export const DEFAULT_CONTENT: SiteContent = {
  brand: { name: 'Bảng Đen', short: 'BĐ', primaryColor: null, logoAssetId: null, faviconAssetId: null },
  seo: {
    title: 'Bảng Đen · Lớp học trực tuyến',
    description: 'Lớp học video trực tiếp: chia sẻ màn hình, bảng trắng chung, điểm danh tự động.',
    ogImageAssetId: null,
  },
  home: {
    show: { stats: true, features: true, courses: true, steps: true, teacher: true, faq: true, cta: true },
    hero: {
      mode: 'illustration',
      autoplaySec: 6,
      trust: ['Không cần cài đặt', 'Máy tính và điện thoại', 'Xem lại bản ghi'],
      slides: [
        {
          imageAssetId: null,
          accent: 'Học trực tuyến',
          title: 'giờ đơn giản hơn nhiều',
          text: 'Lớp học video nhiều người, chia sẻ màn hình, bảng trắng chung và điểm danh tự động sau mỗi buổi.',
          buttonLabel: '',
          buttonHref: '',
        },
      ],
    },
    features: {
      title: 'Mọi thứ cho một buổi học trực tuyến',
      text: 'Mọi công cụ nằm ngay trong trình duyệt: giáo viên dạy, học viên học, không phải chuyển qua lại nhiều ứng dụng.',
      items: [
        { icon: 'video', title: 'Video nhiều người', text: 'Cả lớp bật camera cùng lúc, tối đa 30 người. Âm thanh rõ, tự giảm tiếng ồn.' },
        { icon: 'screen', title: 'Chia sẻ màn hình', text: 'Giáo viên trình chiếu slide và code. Học viên được chia sẻ khi giáo viên cho phép.' },
        { icon: 'board', title: 'Bảng trắng chung', text: 'Viết, vẽ cùng nhau theo thời gian thực. Bảng được lưu lại cho buổi sau.' },
        { icon: 'quiz', title: 'Câu hỏi nhanh', text: 'Trắc nghiệm ngay trong giờ học, giáo viên xem kết quả của cả lớp tức thì.' },
        { icon: 'groups', title: 'Chia nhóm nhỏ', text: 'Chia lớp thành các phòng nhóm để thảo luận, giáo viên ghé từng nhóm và gọi về.' },
        { icon: 'record', title: 'Điểm danh và xem lại', text: 'Tự ghi điểm danh mỗi buổi. Bản ghi hình và tài liệu luôn sẵn để xem lại.' },
      ],
    },
    courses: { title: 'Khoá học đang mở', text: 'Đăng ký tài khoản rồi gửi email cho giáo viên để được thêm vào lớp.' },
    steps: {
      title: 'Tham gia lớp học trong 3 bước',
      items: [
        { title: 'Tạo tài khoản', text: 'Đăng ký bằng email hoặc tài khoản Google, mất chưa đến một phút.' },
        { title: 'Vào danh sách lớp', text: 'Gửi email cho giáo viên để được thêm vào khoá học. Lịch học hiện ngay trong tài khoản của bạn.' },
        { title: 'Vào lớp đúng giờ', text: 'Bấm "Vào phòng" trên máy tính hoặc điện thoại, kiểm tra camera, micro rồi bắt đầu học.' },
      ],
    },
    teacher: {
      name: '',
      title: 'Giáo viên lập trình',
      photoAssetId: null,
      bio: 'Dạy lập trình cho người mới bắt đầu, tập trung vào hiểu bản chất và tự viết được chương trình nhỏ sau mỗi buổi. Lớp học nhỏ để thầy kịp xem bài và trả lời từng bạn.',
      highlights: ['Lớp nhỏ, tối đa 30 học viên', 'Mỗi buổi có bài tập và chữa bài trực tiếp', 'Bản ghi và tài liệu xem lại sau buổi học'],
    },
    faq: {
      title: 'Câu hỏi thường gặp',
      text: 'Chưa thấy câu trả lời bạn cần? Hỏi giáo viên trực tiếp trong buổi học hoặc qua email.',
      items: [
        { q: 'Tôi cần cài đặt gì để vào lớp?', a: 'Không cần cài gì. Lớp học chạy ngay trên trình duyệt Chrome, Edge, Safari hoặc Firefox bản mới. Nên dùng tai nghe để không bị vọng tiếng.' },
        { q: 'Học bằng điện thoại được không?', a: 'Được. Mở trang web bằng trình duyệt trên điện thoại, cho phép dùng camera và micro khi được hỏi. Màn hình lớn hơn sẽ dễ xem bảng trắng và màn hình chia sẻ hơn.' },
        { q: 'Khi nào tôi vào được lớp?', a: 'Nút "Vào phòng" trong Lịch học mở từ 10 phút trước giờ học. Nếu giáo viên mở lớp sớm hơn, bạn vào được ngay.' },
        { q: 'Làm sao để tham gia một khoá học?', a: 'Tạo tài khoản học viên, rồi gửi email đăng ký cho giáo viên để được thêm vào khoá. Nếu bạn vào lớp khi chưa có trong danh sách, giáo viên sẽ thấy yêu cầu và duyệt cho bạn vào.' },
        { q: 'Lỡ buổi học thì xem lại ở đâu?', a: 'Trong Lịch học, mỗi buổi đã học có nút "Xem lại": mở bản ghi hình (nếu giáo viên ghi lại) và tài liệu của buổi đó.' },
        { q: 'Tôi quên mật khẩu thì sao?', a: 'Nếu email tài khoản là email Google, bấm "Đăng nhập bằng Google" để vào mà không cần mật khẩu. Nếu không, liên hệ giáo viên để được hỗ trợ.' },
      ],
    },
    cta: {
      title: 'Học trực tuyến cùng giáo viên, ở bất cứ đâu.',
      text: 'Vào lớp bằng trình duyệt trên máy tính hoặc điện thoại, không cần cài đặt. Bản ghi và tài liệu luôn sẵn để xem lại.',
      buttonLabel: 'Bắt đầu học ngay',
      buttonHref: '/register',
    },
  },
  footer: { tagline: 'Lớp học trực tuyến', links: [{ label: 'Lịch học', href: '/schedule' }], copyright: '' },
  auth: {
    imageAssetId: null,
    captionTitle: 'Học trực tiếp cùng giáo viên',
    captionText: 'Ở bất cứ đâu, trên mọi thiết bị',
    loginWelcome: 'Chào mừng bạn quay lại!',
    loginLead: 'Vào lớp học video, xem lịch học, bản ghi và tài liệu của các buổi đã học.',
    registerWelcome: 'Chào mừng bạn đến với Bảng Đen!',
    registerLead: 'Tạo tài khoản học viên miễn phí. Giáo viên sẽ thêm bạn vào khoá học bằng email này.',
  },
};

// ----- Làm sạch dữ liệu gửi lên -----

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Chuỗi: bỏ ký tự điều khiển, cắt độ dài. Không phải chuỗi thì lấy mặc định. */
function str(v: unknown, max: number, def: string): string {
  if (typeof v !== 'string') return def;
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
}

const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);

/** Link an toàn: đường dẫn trong trang, https:// hoặc mailto:. Còn lại (javascript:, data:…) thành chuỗi rỗng. */
export function safeHref(v: unknown, def = ''): string {
  if (typeof v !== 'string') return def;
  const s = v.trim().slice(0, 500);
  if (s === '') return '';
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(s)) return s;
  return '';
}

function arr<T>(v: unknown, max: number, item: (x: unknown, i: number) => T, def: T[]): T[] {
  if (!Array.isArray(v)) return def;
  return v.slice(0, max).map(item);
}

/**
 * Làm sạch nội dung gửi lên: chỉ giữ trường đã khai báo, cắt độ dài, giới hạn số phần tử,
 * link phải an toàn, màu #rrggbb, ảnh phải có trong bảng site_assets (`assetIds`).
 * Trường thiếu lấy theo DEFAULT_CONTENT.
 */
export function sanitize(input: unknown, assetIds: ReadonlySet<string>): SiteContent {
  const D = DEFAULT_CONTENT;
  const asset = (v: unknown) => (typeof v === 'string' && assetIds.has(v) ? v : null);
  const i = obj(input);

  const b = obj(i.brand);
  const brand: SiteContent['brand'] = {
    name: str(b.name, 60, D.brand.name) || D.brand.name,
    short: str(b.short, 4, D.brand.short) || D.brand.short,
    primaryColor: typeof b.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.primaryColor) ? b.primaryColor.toLowerCase() : null,
    logoAssetId: asset(b.logoAssetId),
    faviconAssetId: asset(b.faviconAssetId),
  };

  const s = obj(i.seo);
  const seo: SiteContent['seo'] = {
    title: str(s.title, 120, D.seo.title) || D.seo.title,
    description: str(s.description, 300, D.seo.description),
    ogImageAssetId: asset(s.ogImageAssetId),
  };

  const h = obj(i.home);
  const show = obj(h.show);
  const hero = obj(h.hero);
  const feat = obj(h.features);
  const courses = obj(h.courses);
  const steps = obj(h.steps);
  const teacher = obj(h.teacher);
  const faq = obj(h.faq);
  const cta = obj(h.cta);
  const DS = D.home.show;
  const home: SiteContent['home'] = {
    show: {
      stats: bool(show.stats, DS.stats),
      features: bool(show.features, DS.features),
      courses: bool(show.courses, DS.courses),
      steps: bool(show.steps, DS.steps),
      teacher: bool(show.teacher, DS.teacher),
      faq: bool(show.faq, DS.faq),
      cta: bool(show.cta, DS.cta),
    },
    hero: {
      mode: hero.mode === 'slider' ? 'slider' : hero.mode === 'illustration' ? 'illustration' : D.home.hero.mode,
      autoplaySec: typeof hero.autoplaySec === 'number' && Number.isFinite(hero.autoplaySec) ? Math.min(30, Math.max(0, Math.round(hero.autoplaySec))) : D.home.hero.autoplaySec,
      trust: arr(hero.trust, 6, (x) => str(x, 60, ''), D.home.hero.trust),
      slides: arr(
        hero.slides,
        8,
        (x) => {
          const o = obj(x);
          return {
            imageAssetId: asset(o.imageAssetId),
            accent: str(o.accent, 80, ''),
            title: str(o.title, 140, ''),
            text: str(o.text, 400, ''),
            buttonLabel: str(o.buttonLabel, 40, ''),
            buttonHref: safeHref(o.buttonHref),
          };
        },
        D.home.hero.slides,
      ),
    },
    features: {
      title: str(feat.title, 120, D.home.features.title),
      text: str(feat.text, 400, D.home.features.text),
      items: arr(
        feat.items,
        12,
        (x) => {
          const o = obj(x);
          return {
            icon: (FEATURE_ICONS as readonly string[]).includes(o.icon as string) ? (o.icon as FeatureIcon) : 'video',
            title: str(o.title, 80, ''),
            text: str(o.text, 300, ''),
          };
        },
        D.home.features.items,
      ),
    },
    courses: { title: str(courses.title, 120, D.home.courses.title), text: str(courses.text, 400, D.home.courses.text) },
    steps: {
      title: str(steps.title, 120, D.home.steps.title),
      items: arr(steps.items, 6, (x) => ({ title: str(obj(x).title, 80, ''), text: str(obj(x).text, 300, '') }), D.home.steps.items),
    },
    teacher: {
      name: str(teacher.name, 80, D.home.teacher.name),
      title: str(teacher.title, 80, D.home.teacher.title),
      photoAssetId: asset(teacher.photoAssetId),
      bio: str(teacher.bio, 1500, D.home.teacher.bio),
      highlights: arr(teacher.highlights, 8, (x) => str(x, 120, ''), D.home.teacher.highlights),
    },
    faq: {
      title: str(faq.title, 120, D.home.faq.title),
      text: str(faq.text, 400, D.home.faq.text),
      items: arr(faq.items, 30, (x) => ({ q: str(obj(x).q, 200, ''), a: str(obj(x).a, 1500, '') }), D.home.faq.items),
    },
    cta: {
      title: str(cta.title, 140, D.home.cta.title),
      text: str(cta.text, 400, D.home.cta.text),
      buttonLabel: str(cta.buttonLabel, 40, D.home.cta.buttonLabel),
      buttonHref: safeHref(cta.buttonHref, D.home.cta.buttonHref),
    },
  };

  const f = obj(i.footer);
  const footer: SiteContent['footer'] = {
    tagline: str(f.tagline, 80, D.footer.tagline),
    links: arr(f.links, 10, (x) => ({ label: str(obj(x).label, 40, ''), href: safeHref(obj(x).href) }), D.footer.links).filter((l) => l.label && l.href),
    copyright: str(f.copyright, 120, D.footer.copyright),
  };

  const a = obj(i.auth);
  const DA = D.auth;
  const auth: SiteContent['auth'] = {
    imageAssetId: asset(a.imageAssetId),
    captionTitle: str(a.captionTitle, 80, DA.captionTitle),
    captionText: str(a.captionText, 120, DA.captionText),
    loginWelcome: str(a.loginWelcome, 80, DA.loginWelcome),
    loginLead: str(a.loginLead, 300, DA.loginLead),
    registerWelcome: str(a.registerWelcome, 80, DA.registerWelcome),
    registerLead: str(a.registerLead, 300, DA.registerLead),
  };

  return { brand, seo, home, footer, auth };
}

/** Mọi id ảnh mà nội dung đang dùng (để dọn ảnh không dùng). */
export function assetIdsIn(c: SiteContent): string[] {
  const ids = [
    c.brand.logoAssetId,
    c.brand.faviconAssetId,
    c.seo.ogImageAssetId,
    c.home.teacher.photoAssetId,
    c.auth.imageAssetId,
    ...c.home.hero.slides.map((s) => s.imageAssetId),
  ];
  return ids.filter((x): x is string => !!x);
}
