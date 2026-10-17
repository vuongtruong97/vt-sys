'use client';
import {
  CarouselLayout,
  DisconnectButton,
  GridLayout,
  isTrackReference,
  ParticipantTile,
  TrackToggle,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useRoomInfo,
  useTracks,
} from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { GroupInfo } from './shared';
import { useQuizzes, useRoomChat } from './interaction';
import { QuizCard } from './Quiz';
import { handUp, Panel, roleOf, RoomMeta } from './shared';
import { SidePanel } from './SidePanel';
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

function useClock(endsAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.round((new Date(endsAt).getTime() - now) / 60_000);
  return left > 0 ? `Còn ${left} phút` : 'Đã quá giờ';
}

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
  const chat = useRoomChat(sessionId, panel === 'chat');
  const quiz = useQuizzes(sessionId);
  const teacherId = participants.find((p) => roleOf(p) === 'teacher')?.identity;
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const say = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
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

  // Nút ghi hình chỉ hiện khi API đã cấu hình nơi lưu trữ.
  const [canRecord, setCanRecord] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  useEffect(() => {
    if (isTeacher) api<{ storage: boolean }>('/features').then((f) => setCanRecord(f.storage)).catch(() => {});
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

  return (
    <>
      <header className="room-top">
        <div style={{ minWidth: 0 }}>
          <div className="title">{props.courseTitle} · {props.title}</div>
          <div className="sub">{participants.length} người trong lớp{isTeacher ? ' · bạn là giáo viên' : ''}</div>
        </div>
        <span className="grow" />
        {group && (
          <span className="pill hand" role="status">
            {group.name} / {group.count} nhóm{groupLeft != null && (groupLeft > 0 ? ` · còn ${groupLeft} phút` : ' · đã hết giờ')}
          </span>
        )}
        {meta.recording && <span className="pill rec" role="status">● Đang ghi hình</span>}
        {hands.length > 0 && (
          <button className="pill hand" style={{ border: 0 }} onClick={() => setPanel('people')}>
            ✋ {hands.length} người giơ tay
          </button>
        )}
        <span className="pill">{clock}</span>
      </header>

      <div className={`room-main${panel ? '' : ' no-side'}`}>
        <section className="stage">
          {meta.board ? (
            <div className="focus">
              <div className="main"><Whiteboard sessionId={sessionId} canClear={isTeacher} /></div>
              <div className="strip"><CarouselLayout tracks={cameras}><ParticipantTile /></CarouselLayout></div>
            </div>
          ) : screen ? (
            <div className="focus">
              <div className="sub" style={{ fontSize: 12 }}>{sharer?.name || 'Ai đó'} đang chia sẻ màn hình</div>
              <div className="main"><ParticipantTile trackRef={screen} /></div>
              <div className="strip"><CarouselLayout tracks={cameras}><ParticipantTile /></CarouselLayout></div>
            </div>
          ) : (
            <GridLayout tracks={cameras}><ParticipantTile /></GridLayout>
          )}
        </section>
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
          />
        )}
        {!isTeacher && <QuizCard quiz={quiz} say={say} />}
      </div>

      <footer className="controls">
        <TrackToggle source={Track.Source.Microphone} onDeviceError={() => say('Không mở được micro')}>
          <span className="label">Micro</span>
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera} onDeviceError={() => say('Không mở được camera')}>
          <span className="label">Camera</span>
        </TrackToggle>
        {canShare ? (
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true, contentHint: 'detail', resolution: { width: 1920, height: 1080, frameRate: 15 } }}
            onDeviceError={() => say('Không chia sẻ được màn hình')}
          >
            <span className="label">Chia sẻ màn hình</span>
          </TrackToggle>
        ) : (
          <button className="cb" disabled title="Giáo viên chưa cho phép học viên chia sẻ màn hình">
            <span className="label">Chia sẻ màn hình</span>
          </button>
        )}
        {/* Bảng trắng và ghi hình gắn với phòng chính; ẩn khi giáo viên đang ghé nhóm. */}
        {isTeacher && !group && (
          <button className="cb" aria-pressed={meta.board} onClick={toggleBoard}>
            <span className="label">{meta.board ? 'Đóng bảng trắng' : 'Bảng trắng'}</span>
          </button>
        )}
        {isTeacher && canRecord && !group && (
          <button className={`cb${meta.recording ? ' rec-on' : ''}`} disabled={recBusy} onClick={toggleRecording}>
            ● <span className="label">{meta.recording ? 'Dừng ghi hình' : 'Ghi hình'}</span>
          </button>
        )}
        {!isTeacher && (
          <button
            className={`cb${myHand ? ' hand-on' : ''}`}
            onClick={() => {
              localParticipant.setAttributes({ hand: myHand ? '0' : '1' });
              say(myHand ? 'Đã hạ tay' : 'Đã giơ tay, giáo viên sẽ thấy bạn trong danh sách');
            }}
          >
            ✋ <span className="label">{myHand ? 'Hạ tay' : 'Giơ tay'}</span>
          </button>
        )}
        <button className="cb" aria-pressed={panel === 'chat'} onClick={() => setPanel(panel === 'chat' ? null : 'chat')}>
          <span className="label">Trò chuyện</span>
          {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
        </button>
        {isTeacher && (
          <button className="cb" aria-pressed={panel === 'groups'} onClick={() => setPanel(panel === 'groups' ? null : 'groups')}>
            <span className="label">{group ? `Đang ở ${group.name}` : 'Chia nhóm'}</span>
          </button>
        )}
        {isTeacher && (
          <button className="cb" aria-pressed={panel === 'quiz'} onClick={() => setPanel(panel === 'quiz' ? null : 'quiz')}>
            <span className="label">Câu hỏi</span>
            {quiz.open && <span className="badge">{quiz.open.total ?? 0}</span>}
          </button>
        )}
        <button className="cb" aria-pressed={panel === 'files'} onClick={() => setPanel(panel === 'files' ? null : 'files')}>
          <span className="label">Tài liệu</span>
        </button>
        <button className="cb" aria-pressed={panel === 'people'} onClick={() => setPanel(panel === 'people' ? null : 'people')}>
          <span className="label">Học viên</span>
          {isTeacher && hands.length > 0 && <span className="badge">{hands.length}</span>}
        </button>
        {isTeacher && (
          <button className="cb" onClick={endClass} title="Đóng phòng cho tất cả mọi người">
            <span className="label">Kết thúc buổi học</span>
          </button>
        )}
        <DisconnectButton>Rời lớp</DisconnectButton>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
      {notice && (
        <div className="quiz-card" role="alert" style={{ bottom: 'auto', top: 72 }}>
          <div className="row" style={{ gap: 6 }}>
            <b style={{ flex: 1 }}>📣 {notice}</b>
            <button className="mini" aria-label="Đóng" onClick={() => setNotice('')}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
