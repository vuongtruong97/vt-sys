'use client';
import { useEffect, useState } from 'react';
import { api, ApiError, Me } from './api';

/** Người dùng đang đăng nhập; undefined khi đang tải, null khi chưa đăng nhập. */
export function useMe(opts: { redirect?: boolean } = {}) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch((e) => {
        setMe(null);
        if (opts.redirect && e instanceof ApiError && e.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
      });
  }, [opts.redirect]);
  return me;
}
