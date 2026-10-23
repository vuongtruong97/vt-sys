'use client';
import { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/meet/icons';
import { handUp, roleOf } from './shared';
import { RoomTile, ShareTile } from './Stage';

/** Document Picture-in-Picture (Chrome, Edge 116+ trên máy tính). Chưa có trong lib.dom của TypeScript. */
type DocumentPip = { requestWindow(o?: { width?: number; height?: number }): Promise<Window>; window: Window | null };
const docPip = () => (typeof window !== 'undefined' ? (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture : undefined);

/** Chép CSS của trang sang cửa sổ nổi (stylesheet cùng nguồn chép nội dung, khác nguồn thì gắn lại link). */
function copyStyles(to: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = to.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      to.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = to.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        to.head.appendChild(link);
      }
    }
  }
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme) to.documentElement.setAttribute('data-theme', theme);
}

/** Mở/đóng cửa sổ nổi. Chỉ có trên trình duyệt máy tính hỗ trợ Document PiP. */
export function useMiniWindow(title: string) {
  const [supported, setSupported] = useState(false);
  const [win, setWin] = useState<Window | null>(null);
  useEffect(() => setSupported(!!docPip()), []);

  const open = useCallback(async () => {
    const api = docPip();
    if (!api) return;
    if (api.window) {
      api.window.focus();
      return;
    }
    const w = await api.requestWindow({ width: 480, height: 400 });
    copyStyles(w.document);
    w.document.title = title;
    w.document.body.style.margin = '0';
    w.addEventListener('pagehide', () => setWin(null), { once: true });
    setWin(w);
  }, [title]);

  const close = useCallback(() => win?.close(), [win]);
  // Rời phòng (component bị gỡ) thì đóng cửa sổ nổi theo.
  useEffect(() => () => win?.close(), [win]);
  return { supported, win, open, close };
}

type Props = {
  win: Window;
  screen: TrackReferenceOrPlaceholder | undefined;
  sharerName: string;
  cameras: TrackReferenceOrPlaceholder[];
  mic: { enabled: boolean; pending: boolean; toggle: () => void };
  cam: { enabled: boolean; pending: boolean; toggle: () => void };
  myHand: boolean;
  toggleHand: () => void;
  hands: number;
  isTeacher: boolean;
  onLeave: () => void;
};

/** Người hiện trong cửa sổ nổi khi không ai chia sẻ màn hình: người đang nói, rồi giáo viên, rồi người khác. */
function featured(cameras: TrackReferenceOrPlaceholder[]) {
  const others = cameras.filter((t) => !t.participant.isLocal);
  return (
    others.find((t) => t.participant.isSpeaking) ??
    others.find((t) => roleOf(t.participant) === 'teacher') ??
    others[0] ??
    cameras[0]
  );
}

/** Số ô tối đa ở dải người dưới ô chính. */
const STRIP_MAX = 4;

/**
 * Dải người dưới ô chính: bỏ người đang ở ô chính và chính mình; người đang nói, đang giơ tay lên trước.
 * Còn người không hiện thì ô cuối là "+N".
 */
function stripOf(cameras: TrackReferenceOrPlaceholder[], main: TrackReferenceOrPlaceholder | undefined, isShare: boolean) {
  const rank = (t: TrackReferenceOrPlaceholder) => (t.participant.isSpeaking ? 0 : handUp(t.participant) ? 1 : 2);
  const rest = cameras
    .filter((t) => !t.participant.isLocal && (isShare || t.participant.identity !== main?.participant.identity))
    .sort((a, b) => rank(a) - rank(b));
  if (rest.length <= STRIP_MAX) return { tiles: rest, more: 0 };
  return { tiles: rest.slice(0, STRIP_MAX - 1), more: rest.length - (STRIP_MAX - 1) };
}

/**
 * Nội dung cửa sổ nổi: màn hình chia sẻ (hoặc người đang nói), dải người trong lớp và các nút micro, camera, giơ tay, rời lớp.
 * Render bằng portal nên vẫn dùng chung context LiveKit của phòng.
 */
export function MiniWindow(p: Props) {
  const root = useRef<HTMLDivElement>(null);
  const main = p.screen ?? featured(p.cameras);
  const strip = stripOf(p.cameras, main, !!p.screen);

  // LiveKit tạm dừng video khi ô không nằm trong khung nhìn của tab chính hoặc tab bị ẩn.
  // Ô trong cửa sổ nổi nằm ở document khác: báo cho LiveKit đây là PiP để video tiếp tục chạy.
  useEffect(() => {
    root.current?.querySelectorAll('video').forEach((v) => {
      if (v.dataset.pip) return;
      v.dataset.pip = '1';
      v.dispatchEvent(new Event('enterpictureinpicture'));
    });
  });

  return createPortal(
    <div ref={root} className="mt mt-pip">
      <div className="mt-pip__stage">
        {main ? (
          p.screen ? <ShareTile trackRef={p.screen} by={p.sharerName} /> : <RoomTile trackRef={main} />
        ) : (
          <div className="mt-prev__off">Chưa có ai trong lớp</div>
        )}
        {p.isTeacher && p.hands > 0 && (
          <span className="mt-pill mt-pip__hands" role="status">
            <Icon name="hand" size={14} /> {p.hands} giơ tay
          </span>
        )}
      </div>
      {strip.tiles.length > 0 && (
        <div className="mt-pip__strip">
          {strip.tiles.map((t) => (
            <RoomTile key={t.participant.identity} trackRef={t} />
          ))}
          {strip.more > 0 && (
            <div className="mt-tile mt-pip__more" title={`Còn ${strip.more} người`}>
              +{strip.more}
            </div>
          )}
        </div>
      )}
      <div className="mt-pip__ctrls">
        <button type="button" className={`mt-cbtn${p.mic.enabled ? '' : ' mt-cbtn--off'}`} aria-pressed={p.mic.enabled} aria-label={p.mic.enabled ? 'Tắt micro' : 'Bật micro'} title={p.mic.enabled ? 'Tắt micro' : 'Bật micro'} disabled={p.mic.pending} onClick={p.mic.toggle}>
          <Icon name={p.mic.enabled ? 'mic' : 'mic-off'} />
        </button>
        <button type="button" className={`mt-cbtn${p.cam.enabled ? '' : ' mt-cbtn--off'}`} aria-pressed={p.cam.enabled} aria-label={p.cam.enabled ? 'Tắt camera' : 'Bật camera'} title={p.cam.enabled ? 'Tắt camera' : 'Bật camera'} disabled={p.cam.pending} onClick={p.cam.toggle}>
          <Icon name={p.cam.enabled ? 'cam' : 'cam-off'} />
        </button>
        {!p.isTeacher && (
          <button type="button" className={`mt-cbtn${p.myHand ? ' mt-cbtn--on' : ''}`} aria-pressed={p.myHand} aria-label={p.myHand ? 'Hạ tay' : 'Giơ tay'} title={p.myHand ? 'Hạ tay' : 'Giơ tay'} onClick={p.toggleHand}>
            <Icon name="hand" />
          </button>
        )}
        <button type="button" className="mt-cbtn" aria-label="Quay lại phòng học" title="Quay lại phòng học" onClick={() => p.win.close()}>
          <Icon name="layout" />
        </button>
        <button type="button" className="mt-cbtn mt-cbtn--leave" aria-label="Rời lớp" title="Rời lớp" onClick={p.onLeave}>
          <Icon name="leave" />
        </button>
      </div>
    </div>,
    p.win.document.body,
  );
}
