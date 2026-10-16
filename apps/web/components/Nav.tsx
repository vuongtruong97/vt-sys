'use client';
import Link from 'next/link';
import { api, Me } from '@/lib/api';

export function Nav({ me }: { me: Me | null | undefined }) {
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };
  return (
    <header className="nav">
      <div className="container">
        <Link href="/" className="brand">
          <span className="mark">B</span>Bảng Đen
        </Link>
        {me && (
          <>
            <Link href="/schedule" className="link">Lịch học</Link>
            {me.role === 'TEACHER' && <Link href="/teach" className="link">Quản lý lớp</Link>}
          </>
        )}
        <span className="grow" />
        {me === null && (
          <>
            <Link href="/login" className="link">Đăng nhập</Link>
            <Link href="/register" className="btn sm">Đăng ký</Link>
          </>
        )}
        {me && (
          <>
            <span className="small muted">{me.name}</span>
            <button className="btn ghost sm" onClick={logout}>Đăng xuất</button>
          </>
        )}
      </div>
    </header>
  );
}
