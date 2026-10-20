import { CSSProperties, ReactNode } from 'react';

/** Bộ icon nét cho mockup phòng học (24×24, màu theo currentColor). */
export type IconName =
  | 'mic' | 'mic-off' | 'cam' | 'cam-off' | 'screen' | 'hand' | 'board' | 'chat' | 'people' | 'poll' | 'groups'
  | 'files' | 'record' | 'more' | 'settings' | 'leave' | 'layout' | 'close' | 'send' | 'pin' | 'info' | 'smile'
  | 'live' | 'search' | 'check' | 'x' | 'spark' | 'speaker' | 'captions' | 'shield' | 'clock' | 'chevron' | 'star'
  | 'phone' | 'monitor' | 'copy' | 'apps' | 'upload'
  | 'book' | 'calendar' | 'lock' | 'film' | 'pen' | 'briefcase' | 'party'
  | 'arrow-left' | 'arrow-right' | 'arrow-up' | 'arrow-down';

const P: Record<IconName, ReactNode> = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  'mic-off': <><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18" /></>,
  cam: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  'cam-off': <><path d="M16 16v1a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1M10 6h5a1 1 0 0 1 1 1v3l5-3v10M3 3l18 18" /></>,
  screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M9 10l3-3 3 3M12 7v6" /></>,
  hand: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 5V3.5a1.5 1.5 0 0 1 3 0V11M14 5.5a1.5 1.5 0 0 1 3 0V12M8 9.5a1.5 1.5 0 0 0-3 0V14a7 7 0 0 0 7 7h1a5 5 0 0 0 5-5v-6a1.5 1.5 0 0 0-3 0" /></>,
  board: <><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M7 13c2-3 3 1 5-2s3 0 5-1M8 21l2-4M16 21l-2-4" /></>,
  chat: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.6c2.6-.3 5 1.2 5.5 4.4" /></>,
  poll: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  groups: <><circle cx="7" cy="8" r="2.5" /><circle cx="17" cy="8" r="2.5" /><circle cx="12" cy="16" r="2.5" /><path d="M2.5 14c.4-1.8 2.2-3 4.5-3M21.5 14c-.4-1.8-2.2-3-4.5-3" /></>,
  files: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  record: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" /></>,
  more: <><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  leave: <><path d="M3.5 13.5c4.7-4.7 12.3-4.7 17 0l-1.8 2.3-3.4-1.2V12a10 10 0 0 0-6.6 0v2.6l-3.4 1.2z" /></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M10 10v10" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  send: <><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></>,
  pin: <><path d="M12 17v4M8 3h8l-1 6 3 3v2H6v-2l3-3z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
  live: <><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  x: <><path d="M7 7l10 10M17 7 7 17" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
  speaker: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>,
  captions: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3" /></>,
  shield: <><path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
  star: <><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11M12 15v2" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  pen: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></>,
  party: <><path d="M4 20 8.5 8l7.5 7.5z" /><path d="M14 4v2M18 8h2M16.5 5.5l-1.5 1.5M12.5 10.5c1-2 3-3 5.5-3" /></>,
  'arrow-left': <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  'arrow-right': <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  'arrow-up': <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  'arrow-down': <><path d="M12 5v14M6 13l6 6 6-6" /></>,
  apps: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
};

export function Icon({ name, size = 22, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {P[name]}
    </svg>
  );
}
