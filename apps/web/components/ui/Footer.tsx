'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button } from './Button';
import { Logo } from './Display';
import { Input } from './Field';

export type FooterProps = {
  tagline?: string;
  links?: Array<{ label: string; href: string }>;
  copyright?: string;
  /** Có thì hiện ô đăng ký bản tin; nhận email, ném lỗi (Error.message) nếu thất bại. */
  onSubscribe?: (email: string) => Promise<void>;
};

/** Footer nền xanh than (Figma: logo, "Virtual Class for Zoom", đăng ký bản tin, liên kết, bản quyền). */
export function Footer({
  tagline = 'Lớp học trực tuyến',
  links = [],
  copyright = `© ${new Date().getFullYear()} Bảng Đen`,
  onSubscribe,
}: FooterProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ busy?: boolean; ok?: string; error?: string }>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onSubscribe) return;
    setState({ busy: true });
    try {
      await onSubscribe(email.trim());
      setEmail('');
      setState({ ok: 'Đã đăng ký. Bản tin sẽ gửi tới email của bạn.' });
    } catch (err) {
      setState({ error: (err as Error).message || 'Chưa đăng ký được, thử lại sau ít phút' });
    }
  };

  return (
    <footer className="ui-footer">
      <div className="ui-footer__inner">
        <div className="ui-footer__brand">
          <Logo tone="light" />
          <span className="ui-footer__tagline">{tagline}</span>
        </div>
        {onSubscribe && (
          <div className="ui-footer__news">
            <h2 className="ui-footer__news-title">Đăng ký nhận bản tin</h2>
            <form className="ui-footer__form" onSubmit={submit}>
              <Input
                label="Email nhận bản tin"
                hideLabel
                tone="dark"
                type="email"
                required
                autoComplete="email"
                placeholder="Email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={state.error}
                hint={state.ok}
              />
              <Button type="submit" size="lg" loading={state.busy}>
                Đăng ký
              </Button>
            </form>
          </div>
        )}
        {links.length > 0 && (
          <ul className="ui-footer__links">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        )}
        <p className="ui-footer__copy">{copyright}</p>
      </div>
    </footer>
  );
}
