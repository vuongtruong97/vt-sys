'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Nav } from './Nav';
import { api } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
            <p className="small muted">
              {mode === 'login' ? <>Chưa có tài khoản? <Link href="/register">Đăng ký</Link></> : <>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></>}
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
