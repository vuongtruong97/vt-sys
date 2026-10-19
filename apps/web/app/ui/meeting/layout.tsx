import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Gate } from '@/components/meet-mock/Gate';
import '@/components/meet/meet.css';

export const metadata: Metadata = { title: 'Mockup phòng học · Bảng Đen' };

/** Bộ mockup giao diện phòng học kiểu Google Meet: dữ liệu giả, không kết nối LiveKit. */
export default function MeetingMockLayout({ children }: { children: ReactNode }) {
  return <Gate>{children}</Gate>;
}
