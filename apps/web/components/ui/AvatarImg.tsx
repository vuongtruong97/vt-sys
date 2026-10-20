'use client';
import { useState } from 'react';

/**
 * Ảnh trong Avatar: phủ lên chữ cái đầu, tự ẩn khi tải lỗi (người dùng chưa có ảnh → API trả 404),
 * để chữ cái đầu bên dưới hiện ra.
 */
export function AvatarImg({ src }: { src: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return null;
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />;
}
