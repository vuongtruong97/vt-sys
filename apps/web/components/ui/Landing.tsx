import { ReactNode } from 'react';
import { Avatar } from './Display';
import { cx } from './internal';

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
          <span>🎙</span>
          <span>📷</span>
          <span>🖥</span>
          <span className="ui-mock__ctrl--on">✏️</span>
          <span className="ui-mock__ctrl--leave">Rời lớp</span>
        </div>
      </div>
      <div className="ui-mock__chip ui-mock__chip--live">
        <i /> Đang học · 18 người
      </div>
      <div className="ui-mock__chip ui-mock__chip--hand">✋ Lan Anh giơ tay</div>
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

export type TeacherIntroProps = { name: string; title: string; bio: string; highlights: string[]; photo?: string; className?: string };

/** Thẻ giới thiệu giáo viên: ảnh (hoặc chữ cái đầu) bên trái, giới thiệu bên phải. */
export function TeacherIntro({ name, title, bio, highlights, photo, className }: TeacherIntroProps) {
  return (
    <div className={cx('ui-card ui-teacher', className)}>
      <div className="ui-teacher__photo">
        <Avatar name={name} src={photo || null} size={168} decorative />
      </div>
      <div className="ui-teacher__body">
        <p className="ui-teacher__role">{title}</p>
        <h3 className="ui-teacher__name">{name}</h3>
        <p className="ui-teacher__bio">{bio}</p>
        <ul className="ui-teacher__list">
          {highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
    </div>
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
