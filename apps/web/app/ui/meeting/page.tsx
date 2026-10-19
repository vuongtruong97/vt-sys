'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SCREENS } from '@/components/meet-mock/Switcher';

/** Khung máy tính 1280×800 co theo bề rộng ô chứa. */
function DesktopFrame({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="mt-frame__box">
      <iframe title="Xem trên máy tính" src={src} style={{ transform: `scale(${scale})` }} />
    </div>
  );
}

/** Mục lục bộ mockup: ảnh xem trước từng màn hình, và xem cùng lúc trên máy tính và điện thoại. */
export default function MeetingMockIndex() {
  const groups = Array.from(new Set(SCREENS.map((s) => s.group)));
  const [preview, setPreview] = useState('/ui/meeting/room?layout=grid');
  return (
    <div className="mt mt-index">
      <div className="mt-index__inner">
        <header style={{ display: 'grid', gap: 8 }}>
          <h1>Mockup phòng học</h1>
          <p>
            Bộ giao diện phòng học kiểu Google Meet cho Bảng Đen: {SCREENS.length} màn hình, dữ liệu giả, bấm thử được (bật tắt mic, camera,
            mở bảng bên, hộp thoại). Không kết nối LiveKit. Thanh nổi trên cùng để nhảy nhanh giữa các màn hình.
          </p>
        </header>

        <section style={{ display: 'grid', gap: 12 }}>
          <div className="mt-row" style={{ justifyContent: 'space-between' }}>
            <h2>Xem trên máy tính và điện thoại</h2>
            <label className="mt-label" style={{ minWidth: 260 }}>
              <span className="mt-sr">Màn hình xem thử</span>
              <select className="mt-select" value={preview} onChange={(e) => setPreview(e.target.value)}>
                {SCREENS.map((s) => (
                  <option key={s.href} value={s.href}>{s.group} · {s.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-devices-view">
            <div className="mt-frame">
              <DesktopFrame src={preview} />
              <span className="mt-muted">Máy tính 1280 × 800 · <Link href={preview}>mở toàn trang</Link></span>
            </div>
            <div className="mt-frame">
              <div className="mt-phone"><iframe title="Xem trên điện thoại" src={preview} /></div>
              <span className="mt-muted" style={{ textAlign: 'center' }}>Điện thoại 366 × 776</span>
            </div>
          </div>
        </section>

        {groups.map((g) => (
          <section key={g} style={{ display: 'grid', gap: 12 }}>
            <h2>{g}</h2>
            <div className="mt-cards">
              {SCREENS.filter((s) => s.group === g).map((s) => (
                <Link key={s.href} href={s.href} className="mt-scard">
                  <span className="mt-scard__thumb">
                    <iframe title={`Xem trước: ${s.label}`} src={s.href} loading="lazy" tabIndex={-1} aria-hidden />
                  </span>
                  <b>{s.label}</b>
                  <span>{s.desc}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
