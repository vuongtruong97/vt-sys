import { argbFromHex, hexFromArgb, Hct, MaterialDynamicColors, SchemeTonalSpot } from '@material/material-color-utilities';

/**
 * Màu chủ đạo quản trị viên chọn (trang /admin/site) thay cho cam Skilline #F48C06.
 * Nút chính dùng đúng mã màu đã chọn; chữ trên nút là trắng hoặc navy tuỳ màu nào dễ đọc hơn.
 * Nền nhạt (primary-container) và màu đảo sinh bằng material-color-utilities. Chỉ có chế độ sáng.
 */
const ROLES: [string, keyof typeof MaterialDynamicColors][] = [
  ['primary-container', 'primaryContainer'],
  ['on-primary-container', 'onPrimaryContainer'],
  ['inverse-primary', 'inversePrimary'],
];

/** Độ sáng tương đối theo WCAG. */
function luminance(hex: string) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const NAVY = '#252641';

/** CSS cho thẻ <style> trong layout; null khi chưa chọn màu (giữ cam của tokens.css). */
export function themeCss(primaryColor: string | null): string | null {
  if (!primaryColor || !/^#[0-9a-f]{6}$/i.test(primaryColor)) return null;
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(primaryColor)), false, 0);
  const l = luminance(primaryColor);
  const onPrimary = contrast(l, 1) >= contrast(l, luminance(NAVY)) ? '#ffffff' : NAVY;
  const roles = ROLES.map(([name, key]) => {
    const color = MaterialDynamicColors[key] as { getArgb(s: SchemeTonalSpot): number };
    return `--md-${name}:${hexFromArgb(color.getArgb(scheme))};`;
  }).join('');
  return `:root{--md-primary:${primaryColor.toLowerCase()};--md-on-primary:${onPrimary};--ui-deco-orange:${primaryColor.toLowerCase()};${roles}}`;
}
