'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from './Nav';
import { api } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
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

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api(`/auth/${mode}`, {
        json: { email: f.get('email'), password: f.get('password'), ...(mode === 'register' ? { name: f.get('name') } : {}) },
      });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next && next.startsWith('/') ? next : '/schedule';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <Nav me={undefined} />
      <main className="container">
        <div className="card auth">
          <form onSubmit={submit}>
            <h1>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
            {mode === 'register' && (
              <label className="field" htmlFor="name">Họ và tên
                <input id="name" name="name" required minLength={2} autoComplete="name" />
              </label>
            )}
            <label className="field" htmlFor="email">Email
              <input id="email" name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field" htmlFor="password">Mật khẩu
              <input id="password" name="password" type="password" required minLength={mode === 'register' ? 8 : 1}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn" disabled={busy}>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
            {google && (
              <>
                <p className="small muted" style={{ textAlign: 'center' }}>hoặc</p>
                {/* Chuyển trang hẳn sang API (không gọi fetch) để trình duyệt đi tới Google. */}
                <a className="btn ghost" style={{ justifyContent: 'center' }} href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
                  {mode === 'login' ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google'}
                </a>
              </>
            )}
            <p className="small muted">
              {mode === 'login' ? <>Chưa có tài khoản? <Link href="/register">Đăng ký</Link></> : <>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></>}
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
