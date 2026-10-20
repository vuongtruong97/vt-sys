'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Meeting đã gộp vào Lịch học; giữ đường dẫn cũ cho link đã lưu. */
export default function MeetPage() {
  const router = useRouter();
  useEffect(() => router.replace('/schedule'), [router]);
  return null;
}
