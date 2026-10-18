/** Tiện ích dùng chung trong components/ui (không export ra ngoài). */

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type IconProps = { size?: number; className?: string };
const svg = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  className,
});

/** Đồng hồ (thời lượng khoá học). Figma dùng ký tự Font Awesome; vẽ lại bằng SVG để không phải nạp font icon. */
export const ClockIcon = ({ size = 20, className }: IconProps) => (
  <svg {...svg(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** Bốn ô vuông (danh mục khoá học). */
export const GridIcon = ({ size = 18, className }: IconProps) => (
  <svg {...svg(size, className)} strokeWidth={1.4}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export const ChevronIcon = ({ dir, size = 20, className }: IconProps & { dir: 'left' | 'right' }) => (
  <svg {...svg(size, className)} strokeWidth={2.2}>
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

/** Mắt mở (đang hiện mật khẩu). Trạng thái ẩn dùng icon "invisible" tải từ Figma: /ui/eye-off.svg. */
export const EyeIcon = ({ size = 18, className }: IconProps) => (
  <svg {...svg(size, className)} strokeWidth={2}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const BookIcon = ({ size = 30, className }: IconProps) => (
  <svg {...svg(size, className)}>
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
    <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4" />
  </svg>
);
