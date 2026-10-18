'use client';
import { ButtonLink, Navbar, NavLink } from '@/components/ui';
import { api, Me } from '@/lib/api';

export function Nav({ me }: { me: Me | null | undefined }) {
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };
  const links: NavLink[] = [{ href: '/', label: 'Trang chủ' }];
  if (me) {
    links.push({ href: '/schedule', label: 'Lịch học' });
    if (me.role !== 'STUDENT') links.push({ href: '/teach', label: 'Quản lý lớp' });
    if (me.role === 'ADMIN') links.push({ href: '/admin', label: 'Quản trị' });
  }
  return (
    <Navbar
      links={links}
      user={me ? { name: me.name, href: '/account' } : me}
      onLogout={logout}
      guestActions={
        <>
          <ButtonLink href="/login" variant="ghost" size="sm">Đăng nhập</ButtonLink>
          <ButtonLink href="/register" size="sm">Đăng ký</ButtonLink>
        </>
      }
    />
  );
}
