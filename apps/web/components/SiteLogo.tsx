'use client';
import { Logo, LogoProps } from '@/components/ui';
import { assetUrl, useSite } from '@/lib/site';

/** Logo theo nội dung trang (tên, chữ viết tắt, ảnh logo đặt ở /admin/site). */
export function SiteLogo(props: Omit<LogoProps, 'text' | 'name' | 'image'> & { hideName?: boolean }) {
  const { brand } = useSite();
  const { hideName, ...rest } = props;
  return <Logo {...rest} text={brand.short} name={hideName ? undefined : brand.name} image={assetUrl(brand.logoAssetId)} />;
}
