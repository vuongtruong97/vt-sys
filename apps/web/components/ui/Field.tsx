'use client';
import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
  useState,
} from 'react';
import { cx, EyeIcon } from './internal';

type FieldBase = {
  /** Nhãn hiện phía trên ô. Bắt buộc để ô nhập có tên cho trình đọc màn hình. */
  label: ReactNode;
  /** Ẩn nhãn khỏi màn hình nhưng vẫn đọc được (ô nhập email ở footer). */
  hideLabel?: boolean;
  hint?: ReactNode;
  /** Thông báo lỗi; có giá trị thì ô viền đỏ và gắn aria-invalid. */
  error?: ReactNode;
  className?: string;
};

/** Khung chung: nhãn, ô, gợi ý, lỗi; nối id và aria-describedby cho đúng. */
function Field(props: FieldBase & { id: string; children: (aria: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const { label, hideLabel, hint, error, className, id, children } = props;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ui-field', !!error && 'ui-field--invalid', className)}>
      <label htmlFor={id} className={cx('ui-field__label', hideLabel && 'ui-sr-only')}>
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error && (
        <span id={errorId} className="ui-field__error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="ui-field__hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export type InputProps = FieldBase &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
    inputClassName?: string;
    /** Nền tối (ô email ở footer). */
    tone?: 'default' | 'dark';
  };

/** Ô nhập bo tròn, viền teal (Figma: User name / Password ở trang đăng nhập, 54px). Kiểu password có nút hiện/ẩn. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, className, inputClassName, tone = 'default', id, type = 'text', ...rest },
  ref,
) {
  const auto = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className} id={id ?? auto}>
      {(a) => (
        <div className="ui-control">
          <input
            ref={ref}
            id={a.id}
            type={isPassword && show ? 'text' : type}
            aria-invalid={a.invalid || undefined}
            aria-describedby={a.describedBy}
            className={cx('ui-input', tone === 'dark' && 'ui-input--dark', isPassword && 'ui-input--with-action', inputClassName)}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              className="ui-control__action"
              aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={show}
              aria-controls={a.id}
              onClick={() => setShow((s) => !s)}
            >
              {/* Icon "invisible" trong Figma (18×18) */}
              {show ? <EyeIcon /> : <img src="/ui/eye-off.svg" width={18} height={15.54} alt="" />}
            </button>
          )}
        </div>
      )}
    </Field>
  );
});

export type TextareaProps = FieldBase & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className} id={id ?? auto}>
      {(a) => <textarea ref={ref} id={a.id} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} className="ui-textarea" {...rest} />}
    </Field>
  );
});

export type SelectProps = FieldBase &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    /** Dòng đầu chưa chọn, ví dụ "Chọn danh mục". */
    placeholder?: string;
  };

/** Ô chọn cùng kiểu với Input (thẻ select gốc, nên bàn phím và điện thoại dùng được sẵn). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, error, className, id, options, placeholder, ...rest },
  ref,
) {
  const auto = useId();
  return (
    <Field label={label} hideLabel={hideLabel} hint={hint} error={error} className={className} id={id ?? auto}>
      {(a) => (
        <select ref={ref} id={a.id} aria-invalid={a.invalid || undefined} aria-describedby={a.describedBy} className="ui-select" {...rest}>
          {placeholder != null && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
});

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode };

/** Ô vuông 15px viền đen (Figma: "Remember me"). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, className, ...rest }, ref) {
  return (
    <label className={cx('ui-check', className)}>
      <input ref={ref} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
});
