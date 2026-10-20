'use client';
import { LiveKitRoom, LocalUserChoices, RoomAudioRenderer } from '@livekit/components-react';
import { DisconnectReason, RoomOptions, ScreenSharePresets, VideoPresets } from 'livekit-client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/components/meet/meet.css';
import { Classroom } from '@/components/room/Classroom';
import { LobbyMessage, PreJoinScreen } from '@/components/room/Lobby';
import { api, ApiError } from '@/lib/api';
import { useMe } from '@/lib/useMe';

type SessionInfo = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  kind: 'class' | 'meeting';
  /** null: meeting độc lập. */
  course: { id: string; title: string } | null;
  role: 'teacher' | 'student' | null;
};
import type { GroupInfo } from '@/components/room/shared';
type JoinRes =
  | { status: 'ok'; role: 'teacher' | 'student'; token: string; url: string; group: GroupInfo | null }
  | { status: 'waiting' }
  | { status: 'denied' };

type Phase =
  | { k: 'prejoin' }
  | { k: 'joining' }
  | { k: 'waiting' }
  | { k: 'in'; token: string; url: string; role: 'teacher' | 'student'; group: GroupInfo | null }
  | { k: 'left'; reason: string; ended?: boolean }
  | { k: 'error'; message: string };

export default function RoomPage({ params }: { params: { id: string } }) {
  const me = useMe({ redirect: true });
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: 'prejoin' });
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!me) return;
    api<SessionInfo>(`/sessions/${params.id}`)
      .then(setInfo)
      .catch((e) => setPhase({ k: 'error', message: e.message }));
  }, [me, params.id]);

  const stopPoll = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };
  useEffect(() => stopPoll, []);

  /** Đang chuyển phòng (nhóm ↔ phòng chính): bỏ qua sự kiện ngắt kết nối của phòng cũ. */
  const switching = useRef(false);

  const join = useCallback(async (group?: number) => {
    try {
      // Link mời trực tiếp của meeting có ?key=...: vào thẳng, không qua phòng chờ.
      const key = new URLSearchParams(window.location.search).get('key') || undefined;
      const r = await api<JoinRes>(`/sessions/${params.id}/join`, { json: { ...(group != null && { group }), ...(key && { key }) } });
      if (r.status === 'ok') {
        stopPoll();
        setPhase({ k: 'in', token: r.token, url: r.url, role: r.role, group: r.group });
      } else if (r.status === 'waiting') {
        setPhase({ k: 'waiting' });
        if (!poll.current) poll.current = setInterval(join, 3000);
      } else {
        stopPoll();
        setPhase({ k: 'error', message: 'Giáo viên đã từ chối yêu cầu vào lớp của bạn.' });
      }
    } catch (e) {
      stopPoll();
      setPhase({ k: 'error', message: e instanceof ApiError ? e.message : 'Không kết nối được máy chủ' });
    }
  }, [params.id]);

  /** Chuyển sang phòng nhóm hoặc về phòng chính; server quyết định phòng (giáo viên chọn được nhóm). */
  const switchRoom = useCallback(
    async (group?: number) => {
      switching.current = true;
      await join(group);
      // Phòng cũ ngắt kết nối sau khi LiveKitRoom mới gắn vào; đợi một nhịp rồi mới nhận sự kiện rời lớp trở lại.
      setTimeout(() => (switching.current = false), 1500);
    },
    [join],
  );

  const roomOptions = useMemo<RoomOptions>(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { deviceId: choices?.videoDeviceId || undefined, resolution: VideoPresets.h720.resolution },
      audioCaptureDefaults: { deviceId: choices?.audioDeviceId || undefined },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
        dtx: true,
        red: true,
        // Tắt mic thì nhả hẳn thiết bị, không chỉ mute track (trình duyệt hết báo đang thu âm).
        stopMicTrackOnMute: true,
      },
    }),
    [choices],
  );

  const time = info
    ? `${new Date(info.startsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(info.endsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : undefined;
  const rejoin = () => {
    setPhase({ k: 'joining' });
    join();
  };

  if (phase.k === 'error') {
    return (
      <LobbyMessage icon="info" title="Chưa vào được phòng" account={me?.name} actions={<Link className="mt-pbtn" href="/schedule">Về lịch học</Link>}>
        <p>{phase.message}</p>
      </LobbyMessage>
    );
  }

  if (phase.k === 'left') {
    return phase.ended ? (
      <LobbyMessage
        icon="check"
        title="Buổi học đã kết thúc"
        account={me?.name}
        actions={
          <>
            <Link className="mt-pbtn" href={`/sessions/${params.id}`}>Xem lại buổi học</Link>
            <Link className="mt-pbtn mt-pbtn--ghost" href="/schedule">Về lịch học</Link>
          </>
        }
      >
        <p>Giáo viên đã kết thúc <b>{info?.title}</b>. Bản ghi hình (nếu có) và tài liệu nằm trong mục Xem lại sau vài phút.</p>
      </LobbyMessage>
    ) : (
      <LobbyMessage
        icon="leave"
        title="Bạn đã rời lớp"
        account={me?.name}
        actions={
          <>
            <button type="button" className="mt-pbtn" onClick={rejoin}>Vào lại lớp</button>
            <Link className="mt-pbtn mt-pbtn--ghost" href="/schedule">Về lịch học</Link>
          </>
        }
      >
        <p>{phase.reason}</p>
      </LobbyMessage>
    );
  }

  if (phase.k === 'waiting') {
    return (
      <LobbyMessage
        spinner
        title="Đang chờ giáo viên cho vào"
        account={me?.name}
        actions={<button type="button" className="mt-pbtn mt-pbtn--ghost" onClick={() => { stopPoll(); setPhase({ k: 'prejoin' }); }}>Huỷ yêu cầu</button>}
      >
        {info?.course ? (
          <p>Bạn chưa có trong danh sách lớp <b>{info.course.title}</b>. Giáo viên đã nhận được yêu cầu của bạn; trang tự vào lớp khi được duyệt.</p>
        ) : (
          <p>Chủ phòng của <b>{info?.title}</b> đã nhận được yêu cầu của bạn; trang tự vào phòng khi được duyệt.</p>
        )}
      </LobbyMessage>
    );
  }

  if (phase.k === 'in' && info && choices) {
    return (
      <LiveKitRoom
        // Token mới (đổi phòng) thì gắn lại LiveKitRoom từ đầu.
        key={phase.token}
        className="mt-lk"
        serverUrl={phase.url}
        token={phase.token}
        connect
        options={roomOptions}
        audio={choices.audioEnabled}
        video={choices.videoEnabled}
        onDisconnected={(reason?: DisconnectReason) =>
          !switching.current &&
          setPhase({
            k: 'left',
            ended: reason === DisconnectReason.ROOM_DELETED,
            reason:
              reason === DisconnectReason.PARTICIPANT_REMOVED
                ? 'Giáo viên đã mời bạn ra khỏi lớp.'
                : 'Điểm danh đã được ghi lại. Buổi học vẫn đang diễn ra, bạn có thể vào lại bất cứ lúc nào.',
          })
        }
        onError={(e) => console.error(e)}
      >
        <Classroom
          sessionId={info.id}
          title={info.title}
          courseId={info.course?.id ?? null}
          courseTitle={info.course?.title ?? null}
          endsAt={info.endsAt}
          role={phase.role}
          group={phase.group}
          switchRoom={switchRoom}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  // Kiểm tra thiết bị trước khi vào
  if (me === null) {
    // Không đọc được tài khoản (mất mạng, máy chủ đang khởi động lại); 401 thì useMe đã chuyển sang trang đăng nhập.
    return (
      <LobbyMessage icon="info" title="Không tải được buổi học" actions={<button type="button" className="mt-pbtn" onClick={() => window.location.reload()}>Thử lại</button>}>
        <p>Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.</p>
      </LobbyMessage>
    );
  }
  if (!me || !info) {
    return <LobbyMessage spinner title="Đang tải buổi học…" />;
  }
  return (
    <PreJoinScreen
      name={me.name}
      account={me.name}
      courseTitle={info.course?.title ?? 'Cuộc họp'}
      title={info.title}
      time={time}
      role={info.role}
      joining={phase.k === 'joining'}
      onJoin={(c) => {
        setChoices(c);
        setPhase({ k: 'joining' });
        join();
      }}
    />
  );
}
