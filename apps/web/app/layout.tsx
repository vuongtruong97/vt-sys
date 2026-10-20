import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@/components/ui/tokens.css';
import '@/components/ui/ui.css';
import { SiteProvider } from '@/lib/site';
import { themeCss } from '@/lib/siteTheme';
import { DEFAULT_CONTENT, SiteContent } from '@/lib/siteTypes';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3001';

/**
 * Nội dung trang đã xuất bản (quản trị ở /admin/site). Lấy phía server, làm mới tối đa 30 giây một lần;
 * API chưa chạy (lúc build) hoặc lỗi thì dùng nội dung mặc định để trang vẫn hiện.
 */
async function loadSite(): Promise<SiteContent> {
  try {
    const r = await fetch(`${API}/site`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(3000) });
    if (r.ok) return (await r.json()) as SiteContent;
  } catch {
    /* dùng mặc định */
  }
  return DEFAULT_CONTENT;
}

const asset = (id: string | null) => (id ? `/api/site/assets/${id}` : undefined);

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSite();
  const og = asset(s.seo.ogImageAssetId);
  const icon = asset(s.brand.faviconAssetId);
  return {
    // Link tuyệt đối cho ảnh chia sẻ mạng xã hội (APP_URL do compose đặt).
    metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
    title: s.seo.title,
    description: s.seo.description,
    ...(icon ? { icons: { icon } } : {}),
    openGraph: { title: s.seo.title, description: s.seo.description, siteName: s.brand.name, type: 'website', ...(og ? { images: [og] } : {}) },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await loadSite();
  const theme = themeCss(site.brand.primaryColor);
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
        {/* Màu chủ đạo do quản trị viên chọn: chỉ chứa mã màu #rrggbb đã kiểm tra (siteTheme.ts). */}
        {theme && <style dangerouslySetInnerHTML={{ __html: theme }} />}
      </head>
      <body>
        <SiteProvider initial={site}>{children}</SiteProvider>
      </body>
    </html>
  );
}
