import { argbFromHex, hexFromArgb, Hct, MaterialDynamicColors, SchemeTonalSpot } from '@material/material-color-utilities';

/**
 * Bảng màu Material 3 sinh từ màu chủ đạo quản trị viên chọn (trang /admin/site).
 * Trả CSS ghi đè các biến --md-* trong components/ui/tokens.css cho cả chế độ sáng và tối.
 * Màu "thành công" (--md-success*) và màu sao giữ nguyên vì M3 không có vai trò này.
 */
const ROLES: [string, keyof typeof MaterialDynamicColors][] = [
  ['primary', 'primary'],
  ['on-primary', 'onPrimary'],
  ['primary-container', 'primaryContainer'],
  ['on-primary-container', 'onPrimaryContainer'],
  ['secondary', 'secondary'],
  ['on-secondary', 'onSecondary'],
  ['secondary-container', 'secondaryContainer'],
  ['on-secondary-container', 'onSecondaryContainer'],
  ['tertiary', 'tertiary'],
  ['on-tertiary', 'onTertiary'],
  ['tertiary-container', 'tertiaryContainer'],
  ['on-tertiary-container', 'onTertiaryContainer'],
  ['surface', 'surface'],
  ['on-surface', 'onSurface'],
  ['surface-variant', 'surfaceVariant'],
  ['on-surface-variant', 'onSurfaceVariant'],
  ['surface-container-lowest', 'surfaceContainerLowest'],
  ['surface-container-low', 'surfaceContainerLow'],
  ['surface-container', 'surfaceContainer'],
  ['surface-container-high', 'surfaceContainerHigh'],
  ['surface-container-highest', 'surfaceContainerHighest'],
  ['outline', 'outline'],
  ['outline-variant', 'outlineVariant'],
  ['inverse-surface', 'inverseSurface'],
  ['inverse-on-surface', 'inverseOnSurface'],
  ['inverse-primary', 'inversePrimary'],
];

function vars(hex: string, dark: boolean) {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(hex)), dark, 0);
  return ROLES.map(([name, key]) => {
    const color = MaterialDynamicColors[key] as { getArgb(s: SchemeTonalSpot): number };
    return `--md-${name}:${hexFromArgb(color.getArgb(scheme))};`;
  }).join('');
}

/** CSS cho thẻ <style> trong layout; null khi chưa chọn màu (giữ baseline tím của tokens.css). */
export function themeCss(primaryColor: string | null): string | null {
  if (!primaryColor || !/^#[0-9a-f]{6}$/i.test(primaryColor)) return null;
  const light = vars(primaryColor, false);
  const dark = vars(primaryColor, true);
  // Cùng độ ưu tiên với tokens.css nhưng nằm sau nên thắng; giữ nguyên quy tắc ép chế độ bằng data-theme.
  return (
    `:root{${light}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}}}` +
    `:root[data-theme="dark"]{${dark}}`
  );
}
