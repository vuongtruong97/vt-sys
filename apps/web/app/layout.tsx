import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@/components/ui/tokens.css';
import '@/components/ui/ui.css';

export const metadata: Metadata = {
  title: 'Bảng Đen · Lớp học trực tuyến',
  description: 'Lớp học video trực tiếp: chia sẻ màn hình, bảng trắng chung, điểm danh tự động.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap"
        />
        <meta name="theme-color" content="#fef7ff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#141218" media="(prefers-color-scheme: dark)" />
      </head>
      <body>{children}</body>
    </html>
  );
}
