import Link from 'next/link';
import { ReactNode } from 'react';
import { Badge, Card, Meta, Person, Progress } from './Display';
import { cx } from './internal';

type Teacher = { name: string; avatar?: string | null };

function Media({ src, alt, className }: { src?: string | null; alt: string; className: string }) {
  return <div className={className}>{src && <img src={src} alt={alt} loading="lazy" />}</div>;
}

/** Giá: giá cũ gạch ngang (nếu có) và giá hiện tại màu teal. Truyền chuỗi đã định dạng ("1.200.000 ₫", "$80"). */
export function Price({ now, old, className }: { now: ReactNode; old?: ReactNode; className?: string }) {
  return (
    <span className={cx('ui-price', className)}>
      {old != null && (
        <s className="ui-price__old">
          <span className="ui-sr-only">Giá cũ </span>
          {old}
        </s>
      )}
      <span className="ui-price__now">
        {old != null && <span className="ui-sr-only">Giá hiện tại </span>}
        {now}
      </span>
    </span>
  );
}

export type CourseCardProps = {
  title: string;
  href?: string;
  image?: string | null;
  /** Ảnh có nội dung riêng thì mô tả; mặc định ảnh chỉ để trang trí. */
  imageAlt?: string;
  category?: string;
  /** Thời lượng, ví dụ "3 tháng". */
  duration?: string;
  description?: string;
  teacher?: Teacher;
  price?: ReactNode;
  oldPrice?: ReactNode;
  /** Chỗ thay cho giá, ví dụ một nút hoặc "12 học viên". */
  footerExtra?: ReactNode;
  className?: string;
};

/**
 * Thẻ khoá học (Figma: "AWS Certified solutions Architect" ở trang Course, 374×617).
 * Có href thì cả thẻ là một liên kết; tiêu đề là tên liên kết.
 */
export function CourseCard(props: CourseCardProps) {
  const { title, href, image, imageAlt = '', category, duration, description, teacher, price, oldPrice, footerExtra, className } = props;
  const body = (
    <>
      <Media src={image} alt={imageAlt} className="ui-course__media" />
      {(category || duration) && (
        <div className="ui-course__meta">
          {category ? <Badge variant="category">{category}</Badge> : <span />}
          {duration && <Meta>{duration}</Meta>}
        </div>
      )}
      <h3 className="ui-course__title">{title}</h3>
      {description && <p className="ui-course__desc">{description}</p>}
      {(teacher || price != null || footerExtra) && (
        <div className="ui-course__foot">
          {teacher ? <Person name={teacher.name} src={teacher.avatar} /> : <span />}
          {price != null ? <Price now={price} old={oldPrice} /> : footerExtra}
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cx('ui-card ui-course', className)}>
      {body}
    </Link>
  ) : (
    <Card className={cx('ui-course', className)}>{body}</Card>
  );
}

export type CourseProgressCardProps = {
  title: string;
  href?: string;
  image?: string | null;
  teacher?: Teacher;
  /** Bài đã học và tổng số bài. */
  done: number;
  total: number;
  className?: string;
};

/** Thẻ "đang học" (Figma: "Welcome back, ready for your next lesson?"): ảnh, tiêu đề, giáo viên, tiến độ. */
export function CourseProgressCard({ title, href, image, teacher, done, total, className }: CourseProgressCardProps) {
  const body = (
    <>
      <Media src={image} alt="" className="ui-course__media" />
      <h3 className="ui-course__title">{title}</h3>
      {teacher && <Person name={teacher.name} src={teacher.avatar} size={42} />}
      <Progress value={done} max={total} label={`Tiến độ ${title}`} />
      <span className="ui-course__lesson">
        Bài {done}/{total}
      </span>
    </>
  );
  const cls = cx('ui-card ui-course ui-course--progress', className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export type CategoryCardProps = {
  title: string;
  description?: string;
  icon: ReactNode;
  /** Màu icon và nền ô icon, ví dụ { fg: 'var(--md-on-tertiary-container)', bg: 'var(--md-tertiary-container)' } (cặp vai trò container của M3). */
  color?: { fg: string; bg: string };
  href?: string;
  className?: string;
};

/** Thẻ danh mục (Figma: Design, Development, Photography… ô icon 90px, tiêu đề 30px). */
export function CategoryCard({ title, description, icon, color = { fg: 'var(--ui-primary-strong)', bg: 'var(--ui-primary-tint)' }, href, className }: CategoryCardProps) {
  const body = (
    <>
      <span className="ui-category__icon" style={{ color: color.fg, background: color.bg }} aria-hidden>
        {icon}
      </span>
      <h3 className="ui-category__title">{title}</h3>
      {description && <p className="ui-category__desc">{description}</p>}
    </>
  );
  const cls = cx('ui-card ui-category', className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export type PriceBoxProps = {
  image?: string | null;
  price: ReactNode;
  oldPrice?: ReactNode;
  /** Ví dụ "Giảm 50%". */
  discount?: ReactNode;
  /** Ví dụ "Còn 11 giờ với giá này". */
  deadline?: ReactNode;
  /** Nút mua (thường là <Button square block>). */
  action: ReactNode;
  /** Các mục bên dưới, mỗi mục có tiêu đề (This Course included, Share this course…). */
  sections?: Array<{ title: string; content: ReactNode }>;
  className?: string;
};

/** Hộp mua khoá học ở cột phải trang chi tiết (Figma: $49.65, Buy Now…). */
export function PriceBox({ image, price, oldPrice, discount, deadline, action, sections = [], className }: PriceBoxProps) {
  return (
    <aside className={cx('ui-card ui-pricebox', className)} aria-label="Mua khoá học">
      {image !== undefined && <Media src={image} alt="" className="ui-pricebox__media" />}
      <div className="ui-pricebox__prices">
        <span className="ui-pricebox__now">{price}</span>
        {oldPrice != null && (
          <s className="ui-pricebox__old">
            <span className="ui-sr-only">Giá cũ </span>
            {oldPrice}
          </s>
        )}
        {discount != null && <span className="ui-pricebox__off">{discount}</span>}
      </div>
      {deadline && <p className="ui-pricebox__deadline">{deadline}</p>}
      {action}
      {sections.map((s) => (
        <section key={s.title} className="ui-pricebox__section">
          <h3 className="ui-pricebox__heading">{s.title}</h3>
          {s.content}
        </section>
      ))}
    </aside>
  );
}
