'use client';
import { KeyboardEvent, ReactNode, useId, useRef, useState } from 'react';
import { cx } from './internal';

export type TabItem = { id: string; label: ReactNode; content?: ReactNode; disabled?: boolean };

export type TabsProps = {
  items: TabItem[];
  /** "boxed": tab Overview ở trang chi tiết khoá học. "segmented": thanh chuyển Login / Register. */
  variant?: 'boxed' | 'segmented';
  /** Có thì là tab điều khiển từ ngoài; không thì tự giữ trạng thái. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Tên cho cả nhóm tab, đọc bởi trình đọc màn hình. */
  label: string;
  className?: string;
};

/**
 * Tab theo mẫu WAI-ARIA: mũi tên trái/phải chuyển tab, Home/End về đầu/cuối,
 * chỉ tab đang chọn nằm trong thứ tự Tab của bàn phím.
 */
export function Tabs({ items, variant = 'boxed', value, defaultValue, onChange, label, className }: TabsProps) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? items.find((i) => !i.disabled)?.id);
  const current = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(index);
    let next: number | undefined;
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    refs.current[next]?.focus();
    select(items[next].id);
  };

  const active = items.find((i) => i.id === current);

  return (
    <div className={cx('ui-tabs', `ui-tabs--${variant}`, className)}>
      <div role="tablist" aria-label={label} className="ui-tablist">
        {items.map((it, i) => {
          const selected = it.id === current;
          return (
            <button
              key={it.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${it.id}`}
              aria-selected={selected}
              aria-controls={it.content !== undefined ? `${base}-panel-${it.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={it.disabled}
              className="ui-tab"
              onClick={() => select(it.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      {active?.content !== undefined && (
        <div role="tabpanel" id={`${base}-panel-${active.id}`} aria-labelledby={`${base}-tab-${active.id}`} tabIndex={0} className="ui-tabpanel">
          {active.content}
        </div>
      )}
    </div>
  );
}
