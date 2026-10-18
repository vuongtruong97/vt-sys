'use client';
import { FormEvent, useState } from 'react';
import { Nav } from '@/components/Nav';
import { api } from '@/lib/api';
import { useMe } from '@/lib/useMe';

export default function AccountPage() {
  const me = useMe({ redirect: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError('');
    setDone('');
    if (f.get('newPassword') !== f.get('confirm')) {
      setError('Hai lần nhập mật khẩu mới không khớp');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password', { json: { currentPassword: f.get('currentPassword'), newPassword: f.get('newPassword') } });
      form.reset();
      setDone('Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logoutAll = async () => {
    if (!window.confirm('Đăng xuất khỏi mọi thiết bị, kể cả máy này?')) return;
    try {
      await api('/auth/logout-all', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <div>
          <h1>Tài khoản</h1>
          {me && <p className="muted small">{me.name} · {me.email}</p>}
        </div>

        <form className="card stack" style={{ maxWidth: 440 }} onSubmit={changePassword}>
          <h2>Đổi mật khẩu</h2>
          <label className="field" htmlFor="currentPassword">Mật khẩu hiện tại
            <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
          </label>
          <label className="field" htmlFor="newPassword">Mật khẩu mới (ít nhất 8 ký tự)
            <input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <label className="field" htmlFor="confirm">Nhập lại mật khẩu mới
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {done && <p className="small" role="status" style={{ color: 'var(--good)' }}>{done}</p>}
          <div className="row">
            <button className="btn" disabled={busy} aria-busy={busy}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button>
          </div>
        </form>

        <div className="card stack" style={{ maxWidth: 440 }}>
          <h2>Phiên đăng nhập</h2>
          <p className="muted small">Quên đăng xuất ở máy khác, hoặc nghi lộ tài khoản? Đăng xuất khỏi mọi thiết bị rồi đăng nhập lại.</p>
          <div className="row">
            <button className="btn ghost" type="button" onClick={logoutAll}>Đăng xuất khỏi mọi thiết bị</button>
          </div>
        </div>
      </main>
    </>
  );
}
