'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from './Nav';
import { Alert, Button, Input, Tabs } from '@/components/ui';
import { api } from '@/lib/api';

/** Đăng nhập / đăng ký theo màn "Login" của Figma: ảnh lớn bên trái, form bên phải (điện thoại chỉ còn form). */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
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
          <img src="/ui/auth-hero.jpg" alt="" />
          <div className="ui-auth__caption">
            <b>Học trực tiếp cùng giáo viên</b>
            <span>Ở bất cứ đâu, trên mọi thiết bị</span>
          </div>
        </div>

        <div className="ui-auth__panel">
          <h1 className="ui-auth__welcome">{login ? 'Chào mừng bạn quay lại!' : 'Chào mừng bạn đến với Bảng Đen!'}</h1>
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
            {login
              ? 'Vào lớp học video, xem lịch học, bản ghi và tài liệu của các buổi đã học.'
              : 'Tạo tài khoản học viên miễn phí. Giáo viên sẽ thêm bạn vào khoá học bằng email này.'}
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
