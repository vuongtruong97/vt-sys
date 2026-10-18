import Link from 'next/link';
import { AnchorHTMLAttributes, ButtonHTMLAttributes, forwardRef } from 'react';
import { ChevronIcon, cx } from './internal';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'light' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Góc 12px, chữ đậm (nút "Buy Now" ở hộp mua khoá học). Mặc định bo tròn hẳn. */
  square?: boolean;
  block?: boolean;
};

const classes = ({ variant = 'primary', size = 'md', square, block }: Common, className?: string) =>
  cx('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, square && 'ui-btn--square', block && 'ui-btn--block', className);

export type ButtonProps = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Đang xử lý: hiện vòng xoay, khoá nút, đọc là "đang tải" với trình đọc màn hình. */
    loading?: boolean;
  };

/** Nút. Figma: Login (49px), Subscribe / Login trên thanh điều hướng (60px), Buy Now (góc 12px). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, square, block, loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, square, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden />}
      {children}
    </button>
  );
});

export type ButtonLinkProps = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Liên kết trông như nút (điều hướng sang trang khác). */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant, size, square, block, className, href, ...rest },
  ref,
) {
  return <Link ref={ref} href={href} className={classes({ variant, size, square, block }, className)} {...rest} />;
});

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Bắt buộc: icon không có chữ nên cần nhãn cho trình đọc màn hình. */
  label: string;
  tone?: 'solid' | 'soft';
  size?: 'sm' | 'md';
};

/** Nút vuông chỉ có icon (mũi tên chuyển trang của dải khoá học: 50×50, teal hoặc teal nhạt). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'solid', size = 'md', className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx('ui-iconbtn', tone === 'soft' && 'ui-iconbtn--soft', size === 'sm' && 'ui-iconbtn--sm', className)}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Cặp nút trước / sau của dải khoá học. */
export function CarouselNav(props: { onPrev: () => void; onNext: () => void; canPrev?: boolean; canNext?: boolean; className?: string }) {
  const { onPrev, onNext, canPrev = true, canNext = true, className } = props;
  return (
    <div className={cx('ui-pager', className)}>
      <IconButton label="Trước" tone="soft" onClick={onPrev} disabled={!canPrev}>
        <ChevronIcon dir="left" />
      </IconButton>
      <IconButton label="Sau" onClick={onNext} disabled={!canNext}>
        <ChevronIcon dir="right" />
      </IconButton>
    </div>
  );
}
