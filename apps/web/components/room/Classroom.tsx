'use client';
import {
  isTrackReference,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useRoomInfo,
  useTrackToggle,
  useTracks,
} from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/meet/icons';
import { api } from '@/lib/api';
import type { GroupInfo } from './shared';
import { useQuizzes, useRoomChat } from './interaction';
import { QuizCard } from './Quiz';
import { SettingsDialog } from './Settings';
import { handUp, Panel, roleOf, RoomMeta } from './shared';
import { SidePanel } from './SidePanel';
import { FocusStage, GridStage, ShareTile } from './Stage';
import { Whiteboard } from './Whiteboard';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Bắt render lại khi người tham gia đổi attribute (giơ tay) hoặc metadata. */
function useAttributeTick() {
  const room = useRoomContext();
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    room.on(RoomEvent.ParticipantAttributesChanged, bump).on(RoomEvent.ParticipantMetadataChanged, bump);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, bump).off(RoomEvent.ParticipantMetadataChanged, bump);
    };
  }, [room]);
}

/** Giờ hiện tại và số phút còn lại của buổi học. */
function useClock(endsAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const left = Math.round((new Date(endsAt).getTime() - now) / 60_000);
  return {
    time: new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    left: left > 0 ? `còn ${left} phút` : 'đã quá giờ',
  };
}

type Toast = { id: number; text: string };

export function Classroom(props: {
  sessionId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  endsAt: string;
  role: 'teacher' | 'student';
  /** Phòng nhóm đang ở; null là phòng chính. */
  group: GroupInfo | null;
  switchRoom: (group?: number) => Promise<void>;
}) {
  const { sessionId, role, group, switchRoom } = props;
  const isTeacher = role === 'teacher';
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { metadata } = useRoomInfo();
  useAttributeTick();
  const clock = useClock(props.endsAt);

  const meta: RoomMeta = useMemo(() => {
    try {
      return { board: false, allowStudentShare: false, ...JSON.parse(metadata || '{}') };
    } catch {
      return { board: false, allowStudentShare: false };
    }
  }, [metadata]);

  const [panel, setPanel] = useState<Panel>(null);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const chat = useRoomChat(sessionId, panel === 'chat');
  const quiz = useQuizzes(sessionId);
  const teacherId = participants.find((p) => roleOf(p) === 'teacher')?.identity;

  // Thông báo nhỏ góc dưới bên trái, tự ẩn sau 4 giây; giữ tối đa 3 cái.
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const say = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // Tin điều khiển giáo viên gửi riêng cho học viên (mời phát biểu, hạ tay).
  const onControl = useCallback(
    (msg: { payload: Uint8Array }) => {
      if (isTeacher) return;
      try {
        const data = JSON.parse(decoder.decode(msg.payload));
        if (data.type === 'speak') {
          localParticipant.setAttributes({ hand: '0' });
          localParticipant
            .setMicrophoneEnabled(true)
            .catch(() => say('Không bật được micro, kiểm tra quyền truy cập micro của trình duyệt'));
          say('Giáo viên mời bạn phát biểu, micro đã bật');
        } else if (data.type === 'lower') {
          localParticipant.setAttributes({ hand: '0' });
          say('Giáo viên đã hạ tay của bạn');
        }
      } catch {
        /* bỏ qua tin không hợp lệ */
      }
    },
    [isTeacher, localParticipant, say],
  );
  useDataChannel('control', onControl);

  // Chia nhóm: server báo "start"/"end", trình duyệt gọi lại join để sang đúng phòng.
  const [notice, setNotice] = useState('');
  const onBreakout = useCallback(
    (msg: { payload: Uint8Array }) => {
      try {
        const data = JSON.parse(decoder.decode(msg.payload));
        if (data.type === 'announce') {
          setNotice(`${data.from}: ${data.text}`);
        } else if (!isTeacher && (data.type === 'start' || data.type === 'end')) {
          say(data.type === 'start' ? 'Đang chuyển bạn sang phòng nhóm…' : 'Giáo viên gọi các nhóm về, đang về phòng chính…');
          switchRoom();
        }
      } catch {
        /* bỏ qua tin không hợp lệ */
      }
    },
    [isTeacher, say, switchRoom],
  );
  useDataChannel('breakout', onBreakout);

  const groupLeft = group?.endsAt ? Math.round((new Date(group.endsAt).getTime() - Date.now()) / 60_000) : null;

  const sendControl = useCallback(
    (identity: string, type: 'speak' | 'lower') =>
      localParticipant.publishData(encoder.encode(JSON.stringify({ type })), {
        reliable: true,
        topic: 'control',
        destinationIdentities: [identity],
      }),
    [localParticipant],
  );

  // Học viên mất quyền chia sẻ thì tắt chia sẻ đang chạy.
  useEffect(() => {
    if (!isTeacher && !meta.allowStudentShare && localParticipant.isScreenShareEnabled) {
      localParticipant.setScreenShareEnabled(false);
    }
  }, [isTeacher, meta.allowStudentShare, localParticipant]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );
  const screen = tracks.find((t) => isTrackReference(t) && t.publication.source === Track.Source.ScreenShare);
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);
  const sharer = screen ? participants.find((p) => p.identity === screen.participant.identity) : undefined;

  const hands = participants.filter(handUp);
  const myHand = handUp(localParticipant);
  const canShare = isTeacher || meta.allowStudentShare;

  // Nút micro, camera, chia sẻ màn hình tự vẽ theo kiểu Meet, dùng hook của LiveKit để bật tắt.
  const mic = useTrackToggle({ source: Track.Source.Microphone, onDeviceError: () => say('Không mở được micro, kiểm tra quyền truy cập của trình duyệt') });
  const cam = useTrackToggle({ source: Track.Source.Camera, onDeviceError: () => say('Không mở được camera, kiểm tra quyền truy cập của trình duyệt') });
  const share = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true, contentHint: 'detail', resolution: { width: 1920, height: 1080, frameRate: 15 } },
    onDeviceError: () => say('Không chia sẻ được màn hình'),
  });

  // Nút ghi hình / phát trực tiếp chỉ hiện khi máy chủ bật tính năng (RECORDING_ENABLED) và có nơi lưu trữ.
  const [canRecord, setCanRecord] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  useEffect(() => {
    if (isTeacher) api<{ recording: boolean }>('/features').then((f) => setCanRecord(!!f.recording)).catch(() => {});
  }, [isTeacher]);
  const toggleRecording = async () => {
    if (!meta.recording && !window.confirm('Bắt đầu ghi hình? Mọi người trong lớp sẽ thấy biểu tượng đang ghi.')) return;
    setRecBusy(true);
    try {
      await api(`/sessions/${sessionId}/recording/${meta.recording ? 'stop' : 'start'}`, { method: 'POST' });
      say(meta.recording ? 'Đã dừng ghi hình, bản ghi sẽ có trong vài phút' : 'Đang ghi hình');
    } catch (e) {
      say((e as Error).message);
    } finally {
      setRecBusy(false);
    }
  };

  const toggleLive = async () => {
    setRecBusy(true);
    try {
      if (meta.live) {
        if (!window.confirm('Dừng phát trực tiếp? Người xem sẽ thấy bản xem lại sau ít phút.')) return;
        await api(`/sessions/${sessionId}/live/stop`, { method: 'POST' });
        say('Đã dừng phát trực tiếp');
        return;
      }
      if (!window.confirm('Bắt đầu phát trực tiếp buổi học? Mọi người trong lớp sẽ thấy biểu tượng đang phát.')) return;
      const isPublic = window.confirm('Cho phép AI CÓ LINK cũng xem được?\n\nOK: công khai\nHuỷ: chỉ học viên của khoá');
      await api(`/sessions/${sessionId}/live/start`, { json: { public: isPublic } });
      const link = `${window.location.origin}/live/${sessionId}`;
      await navigator.clipboard?.writeText(link).catch(() => {});
      say(`Đang phát trực tiếp. Đã chép link xem: ${link}`);
    } catch (e) {
      say((e as Error).message);
    } finally {
      setRecBusy(false);
    }
  };

  const toggleBoard = async () => {
    try {
      await api(`/sessions/${sessionId}/mod/board`, { json: { open: !meta.board } });
    } catch (e) {
      say((e as Error).message);
    }
  };
  const endClass = async () => {
    if (!window.confirm('Kết thúc buổi học cho tất cả mọi người?')) return;
    try {
      await api(`/sessions/${sessionId}/end`, { method: 'POST' });
    } finally {
      room.disconnect();
    }
  };
  const toggleHand = () => {
    localParticipant.setAttributes({ hand: myHand ? '0' : '1' });
    say(myHand ? 'Đã hạ tay' : 'Đã giơ tay, giáo viên sẽ thấy bạn trong danh sách');
  };
  const togglePanel = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));
  const closeSettings = useCallback(() => setSettings(false), []);

  // Esc đóng menu "Thêm".
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  const pick = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  // Bảng trắng và ghi hình gắn với phòng chính; ẩn khi giáo viên đang ghé nhóm.
  const teacherMain = isTeacher && !group;

  return (
    <div className="mt mt-room">
      <header className="mt-top">
        <div className="mt-top__title">
          <b>{props.courseTitle} · {props.title}</b>
          <span>{isTeacher ? 'Bạn là giáo viên' : `Đến ${new Date(props.endsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`} · {clock.left}</span>
        </div>
        <span className="mt-top__grow" />
        {group && (
          <span className="mt-pill mt-pill--live" role="status">
            <Icon name="groups" size={14} /> {group.name} / {group.count} nhóm
            {groupLeft != null && (groupLeft > 0 ? ` · còn ${groupLeft} phút` : ' · đã hết giờ')}
          </span>
        )}
        {meta.recording && <span className="mt-pill mt-pill--rec" role="status"><i /> Đang ghi</span>}
        {meta.live && <span className="mt-pill mt-pill--rec" role="status"><Icon name="live" size={14} /> Đang phát</span>}
        {hands.length > 0 && (
          <button type="button" className="mt-pill" style={{ border: 0, color: '#f6b026' }} onClick={() => setPanel('people')}>
            <Icon name="hand" size={14} /> {hands.length} giơ tay
          </button>
        )}
        <span className="mt-pill mt-pill--count"><Icon name="people" size={15} /> {participants.length}</span>
      </header>

      <div className="mt-body">
        <main className="mt-stage" aria-label="Màn hình lớp học">
          {meta.board ? (
            <FocusStage
              cameras={cameras}
              main={
                <div className="mt-boardwrap">
                  <Whiteboard sessionId={sessionId} canClear={isTeacher} />
                </div>
              }
            />
          ) : screen ? (
            <FocusStage cameras={cameras} main={<ShareTile trackRef={screen} by={sharer?.name || 'Ai đó'} />} />
          ) : (
            <GridStage cameras={cameras} />
          )}
          <div className="mt-toasts" aria-live="polite">
            {notice && (
              <div className="mt-toast" role="alert">
                <Icon name="chat" size={18} />
                <span><b>Thông báo:</b> {notice}</span>
                <button type="button" className="mt-panel__close" aria-label="Đóng thông báo" onClick={() => setNotice('')}><Icon name="close" size={18} /></button>
              </div>
            )}
            {toasts.map((t) => (
              <div key={t.id} className="mt-toast" role="status">{t.text}</div>
            ))}
          </div>
        </main>
        {panel && (
          <SidePanel
            panel={panel}
            setPanel={setPanel}
            sessionId={sessionId}
            isTeacher={isTeacher}
            meta={meta}
            participants={participants}
            sendControl={sendControl}
            say={say}
            chat={chat}
            quiz={quiz}
            teacherId={teacherId}
            courseId={props.courseId}
            group={group}
            switchRoom={switchRoom}
            activities={
              teacherMain
                ? {
                    board: meta.board,
                    toggleBoard,
                    canRecord,
                    recording: !!meta.recording,
                    live: !!meta.live,
                    busy: recBusy,
                    toggleRecording,
                    toggleLive,
                  }
                : null
            }
          />
        )}
        {!isTeacher && <QuizCard quiz={quiz} say={say} />}
      </div>

      <footer className="mt-controls">
        <div className="mt-controls__left">
          <span>{clock.time}</span>
          <i aria-hidden />
          <span>{props.title}</span>
        </div>

        <div className="mt-controls__mid" style={{ position: 'relative' }}>
          <button type="button" className={`mt-cbtn${mic.enabled ? '' : ' mt-cbtn--off'}`} aria-pressed={mic.enabled} aria-label={mic.enabled ? 'Tắt micro' : 'Bật micro'} title={mic.enabled ? 'Tắt micro' : 'Bật micro'} disabled={mic.pending} onClick={() => mic.toggle()}>
            <Icon name={mic.enabled ? 'mic' : 'mic-off'} />
          </button>
          <button type="button" className={`mt-cbtn${cam.enabled ? '' : ' mt-cbtn--off'}`} aria-pressed={cam.enabled} aria-label={cam.enabled ? 'Tắt camera' : 'Bật camera'} title={cam.enabled ? 'Tắt camera' : 'Bật camera'} disabled={cam.pending} onClick={() => cam.toggle()}>
            <Icon name={cam.enabled ? 'cam' : 'cam-off'} />
          </button>
          <button
            type="button"
            className={`mt-cbtn mt-hide-sm${share.enabled ? ' mt-cbtn--on' : ''}`}
            aria-pressed={share.enabled}
            aria-label={share.enabled ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
            title={canShare ? (share.enabled ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình') : 'Giáo viên chưa cho phép học viên chia sẻ màn hình'}
            disabled={!canShare || share.pending}
            onClick={() => share.toggle()}
          >
            <Icon name="screen" />
          </button>
          {!isTeacher && (
            <button type="button" className={`mt-cbtn${myHand ? ' mt-cbtn--on' : ''}`} aria-pressed={myHand} aria-label={myHand ? 'Hạ tay' : 'Giơ tay'} title={myHand ? 'Hạ tay' : 'Giơ tay'} onClick={toggleHand}>
              <Icon name="hand" />
            </button>
          )}
          {teacherMain && (
            <button type="button" className={`mt-cbtn mt-hide-sm${meta.board ? ' mt-cbtn--on' : ''}`} aria-pressed={meta.board} aria-label={meta.board ? 'Đóng bảng trắng' : 'Mở bảng trắng'} title={meta.board ? 'Đóng bảng trắng' : 'Mở bảng trắng cho cả lớp'} onClick={toggleBoard}>
              <Icon name="board" />
            </button>
          )}
          <button type="button" className={`mt-cbtn${menu ? ' mt-cbtn--on' : ''}`} aria-expanded={menu} aria-haspopup="menu" aria-label="Thêm tuỳ chọn" title="Thêm tuỳ chọn" onClick={() => setMenu(!menu)}>
            <Icon name="more" />
          </button>
          <button type="button" className="mt-cbtn mt-cbtn--leave" aria-label="Rời lớp" title="Rời lớp" onClick={() => room.disconnect()}>
            <Icon name="leave" size={24} />
          </button>

          {menu && (
            <div className="mt-menu mt-menu--more" role="menu" aria-label="Thêm tuỳ chọn">
              {/* Trên điện thoại một số nút bị ẩn khỏi thanh điều khiển: đưa vào đây. */}
              {canShare && (
                <button type="button" role="menuitem" className="mt-hide-lg" onClick={pick(() => share.toggle())}>
                  <Icon name="screen" /> {share.enabled ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                </button>
              )}
              {teacherMain && (
                <button type="button" role="menuitem" className="mt-hide-lg" onClick={pick(toggleBoard)}>
                  <Icon name="board" /> {meta.board ? 'Đóng bảng trắng' : 'Mở bảng trắng'}
                </button>
              )}
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={pick(() => setPanel('people'))}>
                <Icon name="people" /> Người tham gia <small>{participants.length}</small>
              </button>
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={pick(() => setPanel('chat'))}>
                <Icon name="chat" /> Trò chuyện {chat.unread > 0 && <small>{chat.unread} tin mới</small>}
              </button>
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={pick(() => setPanel('files'))}>
                <Icon name="files" /> Tài liệu
              </button>
              {isTeacher && (
                <>
                  <button type="button" role="menuitem" onClick={pick(() => setPanel('quiz'))}>
                    <Icon name="poll" /> Câu hỏi nhanh {quiz.open && <small>đang mở</small>}
                  </button>
                  <button type="button" role="menuitem" onClick={pick(() => setPanel('groups'))}>
                    <Icon name="groups" /> {group ? `Đang ở ${group.name}` : 'Chia nhóm nhỏ'}
                  </button>
                </>
              )}
              {teacherMain && canRecord && (
                <>
                  <button type="button" role="menuitem" disabled={recBusy} onClick={pick(toggleRecording)}>
                    <Icon name="record" /> {meta.recording ? 'Dừng ghi hình' : 'Ghi hình buổi học'}
                  </button>
                  <button type="button" role="menuitem" disabled={recBusy} onClick={pick(toggleLive)}>
                    <Icon name="live" /> {meta.live ? 'Dừng phát trực tiếp' : 'Phát trực tiếp'}
                  </button>
                </>
              )}
              <hr />
              <button type="button" role="menuitem" onClick={pick(() => setSettings(true))}>
                <Icon name="settings" /> Cài đặt thiết bị
              </button>
              {isTeacher && (
                <>
                  <hr />
                  <button type="button" role="menuitem" style={{ color: '#ff8d84' }} onClick={pick(endClass)}>
                    <Icon name="close" /> Kết thúc buổi học cho mọi người
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-controls__right">
          <button type="button" className="mt-ibtn" aria-pressed={panel === 'people'} aria-label="Người tham gia" title="Người tham gia" onClick={() => togglePanel('people')}>
            <Icon name="people" />
            {hands.length > 0 && <span className="mt-cbtn__badge">{hands.length}</span>}
          </button>
          <button type="button" className="mt-ibtn" aria-pressed={panel === 'chat'} aria-label="Trò chuyện" title="Trò chuyện" onClick={() => togglePanel('chat')}>
            <Icon name="chat" />
            {chat.unread > 0 && <span className="mt-cbtn__badge">{chat.unread}</span>}
          </button>
          <button type="button" className="mt-ibtn" aria-pressed={panel === 'files'} aria-label="Tài liệu" title="Tài liệu" onClick={() => togglePanel('files')}>
            <Icon name="files" />
          </button>
          {isTeacher && (
            <button type="button" className="mt-ibtn" aria-pressed={panel === 'activities'} aria-label="Hoạt động" title="Hoạt động: câu hỏi, chia nhóm, ghi hình" onClick={() => togglePanel('activities')}>
              <Icon name="apps" />
              {quiz.open && <span className="mt-cbtn__badge">{quiz.open.total ?? 0}</span>}
            </button>
          )}
        </div>
      </footer>

      {settings && <SettingsDialog onClose={closeSettings} />}
    </div>
  );
}
