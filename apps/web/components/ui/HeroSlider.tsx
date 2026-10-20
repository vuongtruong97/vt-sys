'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cx } from './internal';

export type HeroSlide = {
  /** Ảnh nền; không có thì dùng nền primary-container. */
  image: string | null;
  /** Phần chữ nhấn (gạch chân) trước tiêu đề, có thể trống. */
  accent?: string;
  title: string;
  text?: string;
  /** Nút riêng của slide; không có thì dùng nút chung (`actions`). */
  button?: { label: string; href: string } | null;
};

export type HeroSliderProps = {
  slides: HeroSlide[];
  /** Số giây mỗi slide; 0 là không tự chuyển. */
  autoplaySec?: number;
  /** Nút chung dưới chữ (đăng ký, đăng nhập…), hiện ở slide không có nút riêng. */
  actions?: ReactNode;
  /** Các dòng ✓ dưới nút. */
  trust?: string[];
  className?: string;
};

/**
 * Slider đầu trang chủ. Tự chuyển theo `autoplaySec`, dừng khi rê chuột hoặc focus vào slider, có nút
 * tạm dừng (WCAG 2.2.2), nút trước/sau và chấm chọn slide. Người dùng bật "giảm chuyển động" thì không tự chuyển.
 */
export function HeroSlider({ slides, autoplaySec = 6, actions, trust, className }: HeroSliderProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const n = slides.length;
  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const auto = n > 1 && autoplaySec > 0 && !reduced;
  const running = auto && !paused && !hover;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => go(index + 1), autoplaySec * 1000);
    return () => clearTimeout(t);
  }, [running, index, autoplaySec, go]);

  useEffect(() => {
    if (index >= n) setIndex(0);
  }, [index, n]);

  if (n === 0) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
  };

  return (
    <section
      ref={root}
      className={cx('ui-slider', className)}
      aria-roledescription="carousel"
      aria-label="Giới thiệu"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={(e) => !root.current?.contains(e.relatedTarget as Node) && setHover(false)}
      onKeyDown={onKey}
    >
      <div className="ui-slider__track" aria-live={running ? 'off' : 'polite'}>
        {slides.map((s, i) => (
          <div
            key={i}
            className={cx('ui-slider__slide', i === index && 'ui-slider__slide--on', !s.image && 'ui-slider__slide--plain')}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${n}`}
            aria-hidden={i !== index}
            // Slide đang ẩn: không cho focus vào nút bên trong (inert chưa có trong kiểu React 18).
            {...(i !== index ? ({ inert: '' } as Record<string, string>) : {})}
            style={s.image ? { backgroundImage: `url("${s.image}")` } : undefined}
          >
            <div className="ui-slider__inner">
              <div className="ui-hero__copy">
                {i === 0 ? (
                  <h1 className="ui-hero__title">
                    {s.accent && <span className="ui-hero__accent">{s.accent}</span>} {s.title}
                  </h1>
                ) : (
                  <h2 className="ui-hero__title">
                    {s.accent && <span className="ui-hero__accent">{s.accent}</span>} {s.title}
                  </h2>
                )}
                {s.text && <p className="ui-hero__text">{s.text}</p>}
                <div className="ui-actions">
                  {s.button ? (
                    <a className="ui-btn ui-btn--light ui-btn--lg" href={s.button.href}>
                      {s.button.label}
                    </a>
                  ) : (
                    actions
                  )}
                </div>
                {trust && trust.length > 0 && (
                  <ul className="ui-hero__trust">
                    {trust.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="ui-slider__controls">
          <button type="button" className="ui-slider__btn" aria-label="Slide trước" onClick={() => go(index - 1)}>‹</button>
          <div className="ui-slider__dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className="ui-slider__dot"
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index || undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button type="button" className="ui-slider__btn" aria-label="Slide sau" onClick={() => go(index + 1)}>›</button>
          {auto && (
            <button type="button" className="ui-slider__btn" aria-label={paused ? 'Tiếp tục tự chuyển' : 'Tạm dừng tự chuyển'} onClick={() => setPaused(!paused)}>
              {paused ? '▶' : '❚❚'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
