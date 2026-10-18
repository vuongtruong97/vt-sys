import Link from 'next/link';
import { HTMLAttributes, ReactNode } from 'react';
import { ClockIcon, cx, GridIcon } from './internal';

// ---------- Card ----------

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Đệm 20px như thẻ trong Figma. */
  padded?: boolean;
  /** Nền xanh nhạt, không bóng (hộp đánh giá, dải khoá học). */
  tone?: 'surface' | 'section';
};

/** Thẻ trắng góc 20px, bóng nhẹ. Nền tảng của CourseCard, CategoryCard, PriceBox. */
export function Card({ padded, tone = 'surface', className, ...rest }: CardProps) {
  return <div className={cx('ui-card', padded && 'ui-card--pad', tone === 'section' && 'ui-card--section', className)} {...rest} />;
}

// ---------- Badge ----------

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** "category": nhãn danh mục có icon ô vuông. "soft": viên thuốc teal nhạt. "discount": ô đỏ "50%" trên ảnh ưu đãi. */
  variant?: 'category' | 'soft' | 'discount';
};

export function Badge({ variant = 'soft', className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx('ui-badge', variant !== 'category' && `ui-badge--${variant}`, className)} {...rest}>
      {variant === 'category' && <GridIcon className="ui-badge__icon" />}
      {children}
    </span>
  );
}

/** Thông tin phụ có icon đồng hồ, ví dụ "3 tháng". */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('ui-meta', className)}>
      <ClockIcon />
      {children}
    </span>
  );
}

// ---------- Avatar ----------

export type AvatarProps = { name: string; src?: string | null; size?: number; className?: string };

/** Ảnh tròn; không có ảnh thì hiện chữ cái đầu của tên. */
export function Avatar({ name, src, size = 44, className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span className={cx('ui-avatar', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {src ? <img src={src} alt="" /> : <span aria-hidden>{initials}</span>}
      <span className="ui-sr-only">{name}</span>
    </span>
  );
}

/** Avatar kèm tên (giáo viên trên thẻ khoá học). */
export function Person({ name, src, size = 44, className }: AvatarProps) {
  return (
    <span className={cx('ui-person', className)}>
      <span className="ui-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
        {src ? <img src={src} alt="" /> : name.trim()[0]?.toUpperCase()}
      </span>
      {name}
    </span>
  );
}

// ---------- Progress ----------

export type ProgressProps = { value: number; max?: number; label: string; className?: string };

/** Thanh tiến độ 8px, teal trên xám (Figma: tiến độ bài học, thanh phân bố đánh giá). */
export function Progress({ value, max = 100, label, className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cx('ui-progress', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="ui-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Rating ----------

/** Hàng 5 sao lấy từ Figma (/ui/stars-5.svg, 130×22, màu #FDB022); phần lẻ được cắt theo điểm. */
export function Stars({ value, height = 22, className }: { value: number; height?: number; className?: string }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  const width = Math.round((130 / 22) * height);
  return (
    <span className={cx('ui-stars', className)} style={{ width, height }} role="img" aria-label={`${value.toLocaleString('vi-VN')} trên 5 sao`}>
      <img src="/ui/stars-5.svg" width={width} height={height} alt="" className="ui-stars__base" />
      <span className="ui-stars__fill" style={{ width: `${pct}%` }}>
        <img src="/ui/stars-5.svg" width={width} height={height} alt="" />
      </span>
    </span>
  );
}

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cx('ui-rating', className)}>
      <Stars value={value} height={16} />
      <span className="ui-rating__value">
        {value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
        {count != null && ` (${count.toLocaleString('vi-VN')})`}
      </span>
    </span>
  );
}

export type RatingSummaryProps = {
  /** Điểm trung bình, ví dụ 4.2 */
  average: number;
  /** Số lượt theo từng mức, phần tử 0 là 5 sao … phần tử 4 là 1 sao. */
  counts: [number, number, number, number, number];
  caption?: string;
  className?: string;
};

/** Hộp tổng hợp đánh giá (Figma: "4 out of 5 · Top Raiting" và 5 thanh phân bố). */
export function RatingSummary({ average, counts, caption = 'Đánh giá chung', className }: RatingSummaryProps) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className={cx('ui-ratingsum', className)}>
      <div className="ui-ratingsum__score">
        <span className="ui-ratingsum__big">{average.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / 5</span>
        <Stars value={average} />
        <span className="ui-ratingsum__caption">{caption}</span>
      </div>
      <ul className="ui-ratingsum__rows">
        {counts.map((c, i) => {
          const stars = 5 - i;
          const pct = Math.round((c / total) * 100);
          return (
            <li key={stars} className="ui-ratingsum__row">
              <span>{stars} sao</span>
              <Progress value={pct} label={`${stars} sao: ${pct}%`} />
              <span className="ui-ratingsum__pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Review ----------

export type ReviewProps = { author: string; avatar?: string | null; rating?: number; time?: string; children: ReactNode; className?: string };

/** Một nhận xét của học viên (avatar, tên, sao, thời gian, nội dung). */
export function Review({ author, avatar, rating, time, children, className }: ReviewProps) {
  return (
    <article className={cx('ui-review', className)}>
      <div className="ui-review__head">
        <div className="ui-review__who">
          <Avatar name={author} src={avatar} size={70} />
          <div>
            <div className="ui-review__name">{author}</div>
            {rating != null && <Stars value={rating} height={18} />}
          </div>
        </div>
        {time && <Meta>{time}</Meta>}
      </div>
      <p className="ui-review__text">{children}</p>
    </article>
  );
}

// ---------- SectionHeader ----------

/** Tiêu đề khối kèm liên kết "Xem tất cả" (Figma: "Recommended for you … See all"). */
export function SectionHeader(props: { title: ReactNode; actionLabel?: string; actionHref?: string; as?: 'h2' | 'h3'; className?: string }) {
  const { title, actionLabel = 'Xem tất cả', actionHref, as: H = 'h2', className } = props;
  return (
    <div className={cx('ui-section-head', className)}>
      <H className="ui-section-head__title">{title}</H>
      {actionHref && (
        <Link className="ui-link" href={actionHref}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

// ---------- EmptyState ----------

export function EmptyState(props: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string }) {
  const { title, children, icon, action, className } = props;
  return (
    <div className={cx('ui-empty', className)}>
      {icon && (
        <div className="ui-empty__icon" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="ui-empty__title">{title}</h3>
      {children && <p className="ui-empty__text">{children}</p>}
      {action}
    </div>
  );
}

// ---------- CtaBanner ----------

/** Khối kêu gọi nền xanh than (Figma: "Online coaching lessons for remote learning."). */
export function CtaBanner({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cx('ui-cta', className)}>
      <h2 className="ui-cta__title">{title}</h2>
      {children && <p className="ui-cta__text">{children}</p>}
      {action}
    </section>
  );
}

// ---------- Logo ----------

/** Logo TOTC: khung thoi viền teal tải từ Figma (/ui/logo-mark.svg) và chữ. */
export function Logo({ text = 'TOTC', size = 83, tone = 'dark', href, className }: { text?: string; size?: number; tone?: 'dark' | 'light'; href?: string; className?: string }) {
  const inner = (
    <>
      <img src="/ui/logo-mark.svg" width={size} height={size} alt="" />
      <span style={{ fontSize: Math.round(size * 0.385) }}>{text}</span>
    </>
  );
  const cls = cx('ui-logo', tone === 'light' && 'ui-logo--light', className);
  return href ? (
    <Link href={href} className={cls} style={{ width: size, height: size }} aria-label={`${text}, về trang chủ`}>
      {inner}
    </Link>
  ) : (
    <span className={cls} style={{ width: size, height: size }}>
      {inner}
    </span>
  );
}
