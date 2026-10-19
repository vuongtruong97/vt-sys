'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HTMLAttributes, ReactNode, TableHTMLAttributes, useEffect, useId, useState } from 'react';
import { Avatar, Logo } from './Display';
import { cx } from './internal';

// ---------- Navbar ----------

export type NavLink = { href: string; label: string };

export type NavbarProps = {
  links: NavLink[];
  /** Người đang đăng nhập; null là khách, undefined là đang tải. */
  user?: { name: string; avatar?: string | null; href?: string } | null;
  onLogout?: () => void;
  /** Hiện khi là khách (thường là nút Đăng nhập / Đăng ký). */
  guestActions?: ReactNode;
  brand?: ReactNode;
};

/**
 * Thanh điều hướng (Figma: trang Course, Course Detail: logo, Home/Courses/…, avatar + tên).
 * Trên màn hẹp gom liên kết vào nút menu.
 */
export function Navbar({ links, user, onLogout, guestActions, brand }: NavbarProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

  return (
    <header className="ui-nav">
      <div className="ui-nav__inner">
        {brand ?? <Logo href="/" size={48} name="Bảng Đen" />}
        <button
          type="button"
          className="ui-nav__toggle"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden>{open ? '✕' : '☰'}</span>
        </button>
        <nav id={menuId} className={cx('ui-nav__menu', open && 'ui-nav__menu--open')} aria-label="Điều hướng chính">
          <ul className="ui-nav__links">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="ui-nav__link" aria-current={active(l.href) ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ui-nav__user">
            {user === null && guestActions}
            {user && (
              <>
                <Link href={user.href ?? '#'} className="ui-nav__me" title="Tài khoản">
                  <Avatar name={user.name} src={user.avatar} size={40} decorative />
                  <span>{user.name}</span>
                </Link>
                {onLogout && (
                  <button type="button" className="ui-nav__link ui-nav__logout" onClick={onLogout}>
                    Đăng xuất
                  </button>
                )}
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

// ---------- Page, PageHeader ----------

/** Khung nội dung trang: canh giữa, tối đa 1200px, lề 16px trên điện thoại. */
export function Page({ className, narrow, ...rest }: HTMLAttributes<HTMLElement> & { narrow?: boolean }) {
  return <main className={cx('ui-page', narrow && 'ui-page--narrow', className)} {...rest} />;
}

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Liên kết quay lại, ví dụ { href: '/teach', label: 'Quản lý lớp' }. */
  back?: NavLink;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, back, actions, className }: PageHeaderProps) {
  return (
    <div className={cx('ui-pagehead', className)}>
      {back && (
        <Link href={back.href} className="ui-pagehead__back">
          ← {back.label}
        </Link>
      )}
      <div className="ui-pagehead__row">
        <div className="ui-pagehead__text">
          <h1 className="ui-pagehead__title">{title}</h1>
          {description && <div className="ui-pagehead__desc">{description}</div>}
        </div>
        {actions && <div className="ui-pagehead__actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Khối nội dung có tiêu đề cấp 2 và nút bên phải. */
export function Section({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('ui-sec', className)}>
      {(title || actions) && (
        <div className="ui-sec__head">
          {title && <h2 className="ui-sec__title">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- Alert ----------

export type AlertProps = { tone?: 'error' | 'success' | 'info'; children: ReactNode; className?: string };

/** Thông báo trong trang. Lỗi đọc ngay (role="alert"), thành công/thông tin đọc lịch sự (role="status"). */
export function Alert({ tone = 'info', children, className }: AlertProps) {
  return (
    <div className={cx('ui-alert', `ui-alert--${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Chữ phụ màu xám. */
export function Muted({ children, small, className }: { children: ReactNode; small?: boolean; className?: string }) {
  return <p className={cx('ui-muted', small && 'ui-muted--sm', className)}>{children}</p>;
}

// ---------- Table ----------

/** Bảng: khung bo góc, cuộn ngang trên màn hẹp. Dùng thẻ thead/tbody/th/td như bình thường. */
export function Table({ className, caption, children, ...rest }: TableHTMLAttributes<HTMLTableElement> & { caption?: string }) {
  return (
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={caption ?? 'Bảng'}>
      <table className={cx('ui-table', className)} {...rest}>
        {caption && <caption className="ui-sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

// ---------- Switch ----------

export type SwitchProps = { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; className?: string };

/** Công tắc bật/tắt (checkbox có role="switch"). */
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <label className={cx('ui-switch', className)}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-switch__track" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

// ---------- Stat ----------

/** Số liệu lớn kèm nhãn (Figma Landing: "15K+ Students"). */
export function Stat({ value, label, className }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={cx('ui-card ui-stat', className)}>
      <span className="ui-stat__value">{value}</span>
      <span className="ui-stat__label">{label}</span>
    </div>
  );
}

// ---------- ListRow ----------

export type ListRowProps = {
  /** Cột trái nổi bật, ví dụ giờ và ngày của buổi học. */
  lead?: { top: ReactNode; bottom?: ReactNode };
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Viền teal: đang diễn ra, vào được ngay. */
  highlight?: boolean;
  className?: string;
};

/** Một dòng danh sách dạng thẻ (lịch học, buổi học của khoá, bản ghi, tài liệu). */
export function ListRow({ lead, title, meta, actions, highlight, className }: ListRowProps) {
  return (
    // Thẻ ngoài là container: bố cục bên trong đổi theo bề rộng của chính dòng (không theo màn hình),
    // nên dòng nằm trong cột hẹp vẫn không bị ép tên buổi học.
    <div className={cx('ui-card ui-row', highlight && 'ui-row--hl', className)}>
      <div className={cx('ui-row__grid', !lead && 'ui-row--nolead')}>
        {lead && (
          <div className="ui-row__lead">
            <b>{lead.top}</b>
            {lead.bottom && <span>{lead.bottom}</span>}
          </div>
        )}
        <div className="ui-row__main">
          <div className="ui-row__title">{title}</div>
          {meta && <div className="ui-row__meta">{meta}</div>}
        </div>
        {actions && <div className="ui-row__actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Danh sách các ListRow. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('ui-list', className)}>{children}</div>;
}
