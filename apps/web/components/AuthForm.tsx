'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from './Nav';
import { Alert, Button, Input, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { assetUrl, useSite } from '@/lib/site';

/** Đăng nhập / đăng ký theo màn "Login" của Figma: ảnh lớn bên trái, form bên phải (điện thoại chỉ còn form). */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { auth } = useSite();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [next, setNext] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // Lỗi do API trả về khi đăng nhập Google không thành công (chuyển hướng về /login?error=…).
    if (q.get('error')) setError(q.get('error')!);
    setNext(q.get('next') ?? '');
    api<{ google: boolean }>('/auth/providers').then((p) => setGoogle(p.google)).catch(() => {});
  }, []);

  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api(`/auth/${mode}`, {
        json: { email: f.get('email'), password: f.get('password'), ...(mode === 'register' ? { name: f.get('name') } : {}) },
      });
      window.location.href = next && next.startsWith('/') ? next : '/schedule';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const login = mode === 'login';

  return (
    <>
      <Nav me={undefined} />
      <main className="ui-auth">
        <div className="ui-auth__hero">
          <img src={assetUrl(auth.imageAssetId) ?? '/ui/auth-hero.jpg'} alt="" />
          <div className="ui-auth__caption">
            <b>{auth.captionTitle}</b>
            <span>{auth.captionText}</span>
          </div>
        </div>

        <div className="ui-auth__panel">
          <h1 className="ui-auth__welcome">{login ? auth.loginWelcome : auth.registerWelcome}</h1>
          <Tabs
            variant="segmented"
            className="ui-auth__switch"
            label="Đăng nhập hoặc đăng ký"
            value={mode}
            onChange={(id) => router.push(withNext(`/${id}`))}
            items={[
              { id: 'login', label: 'Đăng nhập' },
              { id: 'register', label: 'Đăng ký' },
            ]}
          />
          <p className="ui-auth__lead">
            {login ? auth.loginLead : auth.registerLead}
          </p>

          <form className="ui-form" onSubmit={submit}>
            {!login && <Input label="Họ và tên" name="name" required minLength={2} autoComplete="name" placeholder="Nhập họ và tên" />}
            <Input label="Email" name="email" type="email" required autoComplete="email" placeholder="Nhập email" />
            <Input
              label="Mật khẩu"
              name="password"
              type="password"
              required
              minLength={login ? 1 : 8}
              autoComplete={login ? 'current-password' : 'new-password'}
              placeholder={login ? 'Nhập mật khẩu' : 'Ít nhất 8 ký tự'}
            />
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" className="ui-auth__submit" loading={busy}>
              {login ? 'Đăng nhập' : 'Tạo tài khoản'}
            </Button>
          </form>

          {google && (
            <>
              <div className="ui-auth__or">hoặc</div>
              {/* Chuyển trang hẳn sang API (không gọi fetch) để trình duyệt đi tới Google. */}
              {/* Thẻ a thường, không dùng next/link: next/link tải trước đường dẫn, có thể khởi động OAuth ngầm. */}
              <a className="ui-btn ui-btn--outline ui-btn--md ui-btn--block" href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
                {/* Logo "G" nhiều màu theo hướng dẫn thương hiệu của Google */}
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                  <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
                </svg>
                {login ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google'}
              </a>
            </>
          )}

          <p className="ui-muted ui-muted--sm" style={{ textAlign: 'center' }}>
            {login ? (
              <>
                Chưa có tài khoản? <Link className="ui-link" href={withNext('/register')}>Đăng ký</Link>
              </>
            ) : (
              <>
                Đã có tài khoản? <Link className="ui-link" href={withNext('/login')}>Đăng nhập</Link>
              </>
            )}
          </p>
        </div>
      </main>
    </>
  );
}
