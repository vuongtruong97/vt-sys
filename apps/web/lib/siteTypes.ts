/**
 * Kiểu và nội dung mặc định của trang công khai: BẢN SAO của apps/api/src/site/site-content.ts
 * (web và API build riêng nên không import chéo được). Đổi bên API thì chép lại phần này.
 * Web dùng bộ mặc định khi không gọi được API, để trang vẫn hiện.
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
        { title: 'Vào lớp đúng giờ', text: 'Bấm "Vào lớp" trên máy tính hoặc điện thoại, kiểm tra camera, micro rồi bắt đầu học.' },
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
        { q: 'Khi nào tôi vào được lớp?', a: 'Nút "Vào lớp" trong Lịch học mở từ 10 phút trước giờ học. Nếu giáo viên mở lớp sớm hơn, bạn vào được ngay.' },
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
