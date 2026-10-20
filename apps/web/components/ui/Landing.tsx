import { ReactNode } from 'react';
import { Avatar } from './Display';
import { cx } from './internal';
import { Icon } from '@/components/meet/icons';

// ---------- Hình minh hoạ phòng học ----------

const MOCK_PEOPLE = ['Thầy Minh', 'Lan Anh', 'Quốc Bảo', 'Hà My'];

/**
 * Hình minh hoạ phòng học cho phần mở đầu trang chủ, dựng bằng HTML/CSS (không cần ảnh):
 * bảng phấn, dải video, thanh điều khiển, hai nhãn nổi. Chỉ để trang trí nên ẩn khỏi trình đọc màn hình.
 */
export function ClassroomMockup({ className }: { className?: string }) {
  return (
    <div className={cx('ui-mock', className)} aria-hidden>
      <div className="ui-mock__window">
        <div className="ui-mock__bar">
          <span /> <span /> <span />
          <b>Python cơ bản · Buổi 6: Hàm</b>
        </div>
        <div className="ui-mock__board">
          <svg viewBox="0 0 320 150" className="ui-mock__chalk">
            <text x="18" y="38" className="ui-mock__chalk-text">def chao(ten):</text>
            <text x="44" y="70" className="ui-mock__chalk-text ui-mock__chalk-text--y">print(&quot;Xin chào&quot;, ten)</text>
            <path d="M20 96 C 70 86, 120 104, 170 92" className="ui-mock__chalk-line" />
            <path d="M250 40 l 26 0 m -10 -10 l 10 10 l -10 10" className="ui-mock__chalk-line ui-mock__chalk-line--p" />
            <circle cx="262" cy="104" r="22" className="ui-mock__chalk-line ui-mock__chalk-line--b" />
          </svg>
        </div>
        <div className="ui-mock__strip">
          {MOCK_PEOPLE.map((name, i) => (
            <div key={name} className={cx('ui-mock__tile', i === 0 && 'ui-mock__tile--speaking')}>
              <Avatar name={name} size={30} decorative />
              <span>{name}</span>
            </div>
          ))}
        </div>
        <div className="ui-mock__controls">
          <span><Icon name="mic" size={16} /></span>
          <span><Icon name="cam" size={16} /></span>
          <span><Icon name="screen" size={16} /></span>
          <span className="ui-mock__ctrl--on"><Icon name="pen" size={16} /></span>
          <span className="ui-mock__ctrl--leave">Rời lớp</span>
        </div>
      </div>
      <div className="ui-mock__chip ui-mock__chip--live">
        <i /> Đang học · 18 người
      </div>
      <div className="ui-mock__chip ui-mock__chip--hand"><Icon name="hand" size={18} /> Lan Anh giơ tay</div>
    </div>
  );
}

// ---------- Icon tính năng ----------

export type FeatureIconName = 'video' | 'screen' | 'board' | 'quiz' | 'groups' | 'record';

const ICON_PATHS: Record<FeatureIconName, ReactNode> = {
  video: (
    <>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="m16 11 5-3v8l-5-3" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4M9 10l3-3 3 3M12 7v6" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M7 13c2-3 3 1 5-2s3 0 5-1M8 21l2-4M16 21l-2-4" />
    </>
  ),
  quiz: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </>
  ),
  groups: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M2.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15.2c2.6-.6 5.6.4 6.5 3.8" />
    </>
  ),
  record: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
};

/** Bộ icon nét cho khối tính năng; màu theo `currentColor`. */
export function FeatureIcon({ name, size = 40 }: { name: FeatureIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON_PATHS[name]}
    </svg>
  );
}

// ---------- Các bước ----------

/** Danh sách bước đánh số, nối bằng đường kẻ (màn hẹp xếp dọc). */
export function Steps({ items, className }: { items: { title: string; text: ReactNode }[]; className?: string }) {
  return (
    <ol className={cx('ui-steps', className)}>
      {items.map((s, i) => (
        <li key={s.title} className="ui-steps__item">
          <span className="ui-steps__num" aria-hidden>
            {i + 1}
          </span>
          <h3 className="ui-steps__title">{s.title}</h3>
          <p className="ui-steps__text">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

// ---------- Giới thiệu giáo viên ----------

export type TeacherIntroProps = {
  name: string;
  title: string;
  bio: string;
  highlights: string[];
  /** Ảnh giáo viên; không có thì dùng ảnh lớp học minh hoạ. */
  photo?: string;
  /** Dòng nhỏ phía trên tên, ví dụ "Người đứng lớp". */
  eyebrow?: string;
  className?: string;
};

const CLASSROOM_PHOTO = '/ui/skilline/classroom.jpg';

/**
 * Giới thiệu giáo viên theo khối "Everything you can do in a physical classroom" của Figma Skilline:
 * chữ bên trái, ảnh bên phải với hai khối màu ở góc.
 */
export function TeacherIntro({ name, title, bio, highlights, photo, eyebrow, className }: TeacherIntroProps) {
  return (
    <div className={cx('ui-teacher', className)}>
      <div className="ui-teacher__body">
        {eyebrow && <p className="ui-teacher__role">{eyebrow}</p>}
        <h3 className="ui-teacher__name">
          {name}
          {title && (
            <>
              , <span className="ui-teacher__sub">{title}</span>
            </>
          )}
        </h3>
        <p className="ui-teacher__bio">{bio}</p>
        {highlights.length > 0 && (
          <ul className="ui-teacher__list">
            {highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="ui-teacher__media">
        <img src={photo || CLASSROOM_PHOTO} alt={photo ? `Ảnh ${name}` : ''} />
      </div>
    </div>
  );
}

// ---------- Thẻ nổi trên ảnh đầu trang ----------

export type HeroIconName = 'calendar' | 'users' | 'chart';

const HERO_ICONS: Record<HeroIconName, ReactNode> = {
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <circle cx="5.5" cy="10" r="2.2" />
      <circle cx="18.5" cy="10" r="2.2" />
      <path d="M6.5 19c.5-3 2.8-4.8 5.5-4.8s5 1.8 5.5 4.8M1.8 18c.3-2 1.6-3.3 3.4-3.5M22.2 18c-.3-2-1.6-3.3-3.4-3.5" />
    </>
  ),
  chart: <path d="M6 18V11M10 18V6M14 18V9M18 18V13" />,
};

function HeroIcon({ name, size = 24 }: { name: HeroIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {HERO_ICONS[name]}
    </svg>
  );
}

/** Thẻ kính nổi trên ảnh đầu trang (Figma: "250k Assisted Student"). `place`: vị trí a (trên trái) hoặc b (giữa phải). */
export function HeroCard({ icon, color, title, text, place }: { icon: HeroIconName; color: string; title: ReactNode; text: ReactNode; place: 'a' | 'b' }) {
  return (
    <div className={`ui-hero-card ui-hero-card--${place}`}>
      <span className="ui-hero-card__icon" style={{ background: color }}>
        <HeroIcon name={icon} />
      </span>
      <span className="ui-hero-card__text">
        <b>{title}</b>
        <span>{text}</span>
      </span>
    </div>
  );
}

/** Thẻ buổi học sắp tới (Figma: "User Experience Class · Today at 12.00 PM · Join Now"). */
export function HeroClassCard({ teacher, title, text, href, label }: { teacher: string; title: string; text: string; href: string; label: string }) {
  return (
    <div className="ui-hero-card ui-hero-card--class">
      <span className="ui-hero-card__row">
        <Avatar name={teacher} size={46} decorative />
        <span className="ui-hero-card__text">
          <b>{title}</b>
          <span>{text}</span>
        </span>
      </span>
      <a className="ui-hero-card__btn" href={href}>
        {label}
      </a>
    </div>
  );
}

/** Ô biểu đồ hồng góc trên ảnh (chỉ trang trí). */
export function HeroChip() {
  return (
    <span className="ui-hero__chip" aria-hidden>
      <HeroIcon name="chart" size={26} />
    </span>
  );
}

// ---------- Câu hỏi thường gặp ----------

/** Câu hỏi thường gặp dạng mở/đóng, dùng details/summary nên sẵn hỗ trợ bàn phím và trình đọc màn hình. */
export function Faq({ items, className }: { items: { q: string; a: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('ui-faq', className)}>
      {items.map((it) => (
        <details key={it.q} className="ui-faq__item">
          <summary className="ui-faq__q">{it.q}</summary>
          <p className="ui-faq__a">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
