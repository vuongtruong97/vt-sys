'use client';
import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronIcon, cx } from './internal';
import { IconButton } from './Button';

// ---------- Modal ----------

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Nút ở chân hộp thoại. */
  footer?: ReactNode;
  className?: string;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hộp thoại: Esc hoặc bấm ra ngoài để đóng, focus nằm trong hộp khi mở (Tab vòng lại),
 * đóng thì trả focus về chỗ cũ, khoá cuộn trang phía sau.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus phần tử đầu tiên có thể thao tác (thường là nút đóng).
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="ui-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('ui-modal__panel', className)}>
        <div className="ui-modal__head">
          <h2 id={titleId} className="ui-modal__title">
            {title}
          </h2>
          <button type="button" className="ui-modal__close" aria-label="Đóng" onClick={onClose}>
            ✕
          </button>
        </div>
        {children && <div className="ui-modal__body">{children}</div>}
        {footer && <div className="ui-modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Pagination ----------

/** Danh sách trang cần hiện: luôn có trang đầu, cuối, trang hiện tại ±1; chỗ bỏ qua là "…". */
function pageList(page: number, total: number): Array<number | 'gap'> {
  const keep = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export type PaginationProps = { page: number; total: number; onChange: (page: number) => void; className?: string };

/** Phân trang. Mũi tên giống nút chuyển dải khoá học trong Figma; thêm số trang cho danh sách dài. */
export function Pagination({ page, total, onChange, className }: PaginationProps) {
  if (total <= 1) return null;
  return (
    <nav className={cx('ui-pager', className)} aria-label="Phân trang">
      <IconButton label="Trang trước" tone="soft" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronIcon dir="left" size={18} />
      </IconButton>
      <ul className="ui-pager__pages">
        {pageList(page, total).map((p, i) =>
          p === 'gap' ? (
            <li key={`g${i}`} className="ui-pager__gap" aria-hidden>
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className="ui-pager__page"
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Trang ${p}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>
      <IconButton label="Trang sau" size="sm" disabled={page >= total} onClick={() => onChange(page + 1)}>
        <ChevronIcon dir="right" size={18} />
      </IconButton>
    </nav>
  );
}
