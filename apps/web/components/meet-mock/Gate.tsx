'use client';
import { ReactNode, Suspense } from 'react';
import { useMe } from '@/lib/useMe';
import { Switcher } from './Switcher';

/** Như trang /ui: mở tự do khi phát triển, trên production chỉ quản trị viên xem được. */
export function Gate({ children }: { children: ReactNode }) {
  const me = useMe();
  const allowed = process.env.NODE_ENV !== 'production' || me?.role.key === 'admin';
  if (!allowed) {
    return (
      <main className="mt mt-center" style={{ minHeight: '100dvh' }}>
        <p>{me === undefined ? 'Đang tải…' : 'Bộ mockup phòng học chỉ dành cho quản trị viên.'}</p>
      </main>
    );
  }
  return (
    <>
      <Suspense>
        <Switcher />
      </Suspense>
      {children}
    </>
  );
}
