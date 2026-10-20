'use client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronIcon, cx, PauseIcon, PlayIcon } from './internal';

export type HeroSlide = {
  /** Ảnh bên phải; không có thì dùng ảnh học viên minh hoạ của Figma. */
  image: string | null;
  /** Phần chữ nhấn màu cam trước tiêu đề, có thể trống. */
  accent?: string;
  title: string;
  text?: string;
  /** Nút riêng của slide; không có thì dùng nút chung (`actions`). */
  button?: { label: string; href: string } | null;
};

type Shared = {
  /** Nút chung dưới chữ (đăng ký, đăng nhập…), hiện ở slide không có nút riêng. */
  actions?: ReactNode;
  /** Các dòng ✓ dưới nút. */
  trust?: string[];
  /** Thẻ nổi trên ảnh (số liệu, buổi học sắp tới). */
  decor?: ReactNode;
};

/** Ảnh học viên đã tách nền, cùng màu nền kem của hero (Figma "Header"). */
export const HERO_FALLBACK_IMAGE = '/ui/skilline/hero-student.jpg';

/** Nội dung một màn hero: chữ bên trái, ảnh và thẻ nổi bên phải. */
function HeroContent({ slide, heading, actions, trust, decor }: Shared & { slide: HeroSlide; heading: 'h1' | 'h2' }) {
  const H = heading;
  return (
    <div className="ui-hero__inner">
      <div className="ui-hero__copy">
        <H className="ui-hero__title">
          {slide.accent && <span className="ui-hero__accent">{slide.accent}</span>} {slide.title}
        </H>
        {slide.text && <p className="ui-hero__text">{slide.text}</p>}
        <div className="ui-actions">
          {slide.button ? (
            <a className="ui-btn ui-btn--primary ui-btn--lg" href={slide.button.href}>
              {slide.button.label}
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
      <div className={cx('ui-hero__media', slide.image && 'ui-hero__media--framed')}>
        <img className="ui-hero__photo" src={slide.image || HERO_FALLBACK_IMAGE} alt="" />
        {decor}
      </div>
    </div>
  );
}

/** Đầu trang chủ một màn (không chuyển slide). */
export function Hero({ slide, className, ...shared }: Shared & { slide: HeroSlide; className?: string }) {
  return (
    <section className={cx('ui-hero', className)}>
      <HeroContent slide={slide} heading="h1" {...shared} />
    </section>
  );
}

export type HeroSliderProps = Shared & {
  slides: HeroSlide[];
  /** Số giây mỗi slide; 0 là không tự chuyển. */
  autoplaySec?: number;
  className?: string;
};

/**
 * Slider đầu trang chủ. Tự chuyển theo `autoplaySec`, dừng khi rê chuột hoặc focus vào slider, có nút
 * tạm dừng (WCAG 2.2.2), nút trước/sau và chấm chọn slide. Người dùng bật "giảm chuyển động" thì không tự chuyển.
 */
export function HeroSlider({ slides, autoplaySec = 6, className, ...shared }: HeroSliderProps) {
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
      className={cx('ui-slider', n > 1 && 'ui-slider--multi', className)}
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
            className={cx('ui-slider__slide', i === index && 'ui-slider__slide--on')}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${n}`}
            aria-hidden={i !== index}
            // Slide đang ẩn: không cho focus vào nút bên trong (inert chưa có trong kiểu React 18).
            {...(i !== index ? ({ inert: '' } as Record<string, string>) : {})}
          >
            <HeroContent slide={s} heading={i === 0 ? 'h1' : 'h2'} {...shared} />
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="ui-slider__bar">
          <div className="ui-slider__bar-inner">
            <div className="ui-slider__controls">
              <button type="button" className="ui-slider__btn" aria-label="Slide trước" onClick={() => go(index - 1)}><ChevronIcon dir="left" /></button>
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
              <button type="button" className="ui-slider__btn" aria-label="Slide sau" onClick={() => go(index + 1)}><ChevronIcon dir="right" /></button>
              {auto && (
                <button type="button" className="ui-slider__btn" aria-label={paused ? 'Tiếp tục tự chuyển' : 'Tạm dừng tự chuyển'} onClick={() => setPaused(!paused)}>
                  {paused ? <PlayIcon /> : <PauseIcon />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
