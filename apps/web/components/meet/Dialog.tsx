'use client';
import { ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './icons';

/** Hộp thoại kiểu Meet: Esc hoặc bấm nền để đóng, focus vào hộp khi mở, trả focus khi đóng. */
export function Dialog({ title, onClose, children, footer, small }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; small?: boolean }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  // Giữ onClose mới nhất trong ref: hiệu ứng chỉ chạy một lần khi mở, focus không bị giật về đầu mỗi lần render lại.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button, select, input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, []);
  return (
    <div className="mt-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={`mt-dialog${small ? ' mt-dialog--sm' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="mt-dialog__head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="mt-panel__close" aria-label="Đóng" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="mt-dialog__body">{children}</div>
        {footer && <div className="mt-dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}
