'use client';
import { LocalUserChoices, useMediaDevices, usePersistentUserChoices, usePreviewTracks } from '@livekit/components-react';
import { LocalAudioTrack, LocalVideoTrack, Track } from 'livekit-client';
import Link from 'next/link';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, IconName } from '@/components/meet/icons';

/** Khung chung của các màn hình ngoài phòng học (nền sáng, logo). */
export function LobbyShell({ children, account }: { children: ReactNode; account?: string }) {
  return (
    <div className="mt mt-lobby">
      <header className="mt-lobby__top" style={{ paddingTop: 20 }}>
        <Link href="/" className="mt-brand" style={{ textDecoration: 'none' }}><i>BĐ</i>Bảng Đen</Link>
        {account && <span className="mt-muted">{account}</span>}
      </header>
      {children}
    </div>
  );
}

/** Thông báo giữa màn hình: chờ duyệt, đã rời lớp, lỗi. */
export function LobbyMessage(props: { icon?: IconName; spinner?: boolean; title: string; children?: ReactNode; actions?: ReactNode; account?: string }) {
  return (
    <LobbyShell account={props.account}>
      <div className="mt-center">
        <div className="mt-endcard">
          {props.spinner ? (
            <div className="mt-spinner" role="status" aria-label="Đang chờ" />
          ) : (
            props.icon && (
              <span className="mt-act__ic" style={{ color: '#12595a', background: '#e3f3f3', width: 64, height: 64, borderRadius: 20 }}>
                <Icon name={props.icon} size={32} />
              </span>
            )
          )}
          <h1>{props.title}</h1>
          {props.children}
          {props.actions && <div className="mt-row" style={{ justifyContent: 'center' }}>{props.actions}</div>}
        </div>
      </div>
    </LobbyShell>
  );
}

function DevicePick({ kind, icon, value, onChange, fallback }: { kind: MediaDeviceKind; icon: IconName; value: string; onChange: (id: string) => void; fallback: string }) {
  const devices = useMediaDevices({ kind });
  return (
    <label className="mt-device">
      <Icon name={icon} size={17} />
      <span className="mt-sr">{fallback}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {devices.length === 0 && <option value="">{fallback}</option>}
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${fallback} ${i + 1}`}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Trước khi vào lớp: xem trước camera, bật tắt micro/camera, chọn thiết bị (nhớ cho lần sau).
 * Dựng bằng hook của LiveKit thay cho PreJoin mặc định để cùng kiểu với phòng học.
 */
export function PreJoinScreen(props: {
  name: string;
  account?: string;
  courseTitle?: string;
  title?: string;
  time?: string;
  /** null: chưa có trong danh sách lớp, phải chờ giáo viên duyệt. */
  role: 'teacher' | 'student' | null | undefined;
  joining: boolean;
  onJoin: (c: LocalUserChoices) => void;
}) {
  const { userChoices, saveAudioInputEnabled, saveVideoInputEnabled, saveAudioInputDeviceId, saveVideoInputDeviceId } = usePersistentUserChoices({
    defaults: { audioEnabled: props.role === 'teacher', videoEnabled: true },
  });
  const [audioEnabled, setAudio] = useState(userChoices.audioEnabled);
  const [videoEnabled, setVideo] = useState(userChoices.videoEnabled);
  const [audioDeviceId, setAudioDevice] = useState(userChoices.audioDeviceId);
  const [videoDeviceId, setVideoDevice] = useState(userChoices.videoDeviceId);
  const [error, setError] = useState('');
  // Trình duyệt từ chối hoặc không có thiết bị: không ghi "Đang mở…" mãi.
  const failed = !!error;

  const options = useMemo(
    () => ({
      audio: audioEnabled ? { deviceId: audioDeviceId || undefined } : false,
      video: videoEnabled ? { deviceId: videoDeviceId || undefined } : false,
    }),
    [audioEnabled, videoEnabled, audioDeviceId, videoDeviceId],
  );
  // Hàm báo lỗi phải cố định: usePreviewTracks tạo lại camera/micro mỗi khi hàm này đổi
  // (viết thẳng trong lúc render thì mỗi lần render lại là một hàm mới → camera tắt mở liên tục).
  const onPreviewError = useCallback(
    (e: Error) =>
      setError(
        e.message.includes('Permission') || e.name === 'NotAllowedError'
          ? 'Trình duyệt chưa cho dùng camera hoặc micro. Bấm biểu tượng ổ khoá trên thanh địa chỉ để cho phép.'
          : 'Không mở được camera hoặc micro',
      ),
    [],
  );
  const tracks = usePreviewTracks(options, onPreviewError);
  const video = tracks?.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
  const audio = tracks?.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;

  const el = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!video || !el.current) return;
    video.attach(el.current);
    return () => {
      video.detach();
    };
  }, [video]);

  // Mức âm lượng micro để học viên biết micro có nhận tiếng.
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!audio?.mediaStreamTrack) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(new MediaStream([audio.mediaStreamTrack]));
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    // 10 lần mỗi giây là đủ cho thanh 10 vạch; làm tròn theo vạch để chỉ render lại khi thanh thật sự đổi.
    const t = setInterval(() => {
      an.getByteFrequencyData(buf);
      const v = Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 60);
      setLevel(Math.round(v * 10) / 10);
    }, 100);
    return () => {
      clearInterval(t);
      ctx.close();
    };
  }, [audio]);

  const toggleAudio = () => {
    setAudio(!audioEnabled);
    saveAudioInputEnabled(!audioEnabled);
  };
  const toggleVideo = () => {
    setVideo(!videoEnabled);
    saveVideoInputEnabled(!videoEnabled);
  };

  const join = () =>
    props.onJoin({ audioEnabled, videoEnabled, audioDeviceId, videoDeviceId, username: props.name });

  return (
    <LobbyShell account={props.account}>
      <main className="mt-lobby__main">
        <div>
          <div className="mt-prev">
            {videoEnabled && video ? (
              <video ref={el} muted playsInline autoPlay />
            ) : (
              <div className="mt-prev__off"><Icon name="cam-off" size={34} />{!videoEnabled ? 'Camera đang tắt' : failed ? 'Không mở được camera' : 'Đang mở camera…'}</div>
            )}
            <span className="mt-prev__name">{props.name}</span>
            <div className="mt-prev__ctrls">
              <button type="button" className={`mt-cbtn${audioEnabled ? '' : ' mt-cbtn--off'}`} aria-pressed={audioEnabled} aria-label={audioEnabled ? 'Tắt micro' : 'Bật micro'} onClick={toggleAudio}>
                <Icon name={audioEnabled ? 'mic' : 'mic-off'} />
              </button>
              <button type="button" className={`mt-cbtn${videoEnabled ? '' : ' mt-cbtn--off'}`} aria-pressed={videoEnabled} aria-label={videoEnabled ? 'Tắt camera' : 'Bật camera'} onClick={toggleVideo}>
                <Icon name={videoEnabled ? 'cam' : 'cam-off'} />
              </button>
            </div>
          </div>
          <div className="mt-devices">
            <DevicePick kind="audioinput" icon="mic" fallback="Micro" value={audioDeviceId} onChange={(id) => { setAudioDevice(id); saveAudioInputDeviceId(id); }} />
            <DevicePick kind="videoinput" icon="cam" fallback="Camera" value={videoDeviceId} onChange={(id) => { setVideoDevice(id); saveVideoInputDeviceId(id); }} />
            <div className="mt-device" aria-label="Mức âm lượng micro">
              <Icon name="speaker" size={17} />
              <div className="mt-meter" style={{ flex: 1 }}>
                {Array.from({ length: 10 }, (_, i) => <i key={i} className={audioEnabled && level * 10 > i ? 'on' : ''} />)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-join">
          {props.courseTitle && <span className="mt-muted">{props.courseTitle}{props.time ? ` · ${props.time}` : ''}</span>}
          <h1>{props.title ? props.title : 'Sẵn sàng vào lớp?'}</h1>
          <p>{props.role === null ? 'Bạn chưa có trong danh sách lớp nên cần chờ giáo viên duyệt.' : 'Kiểm tra camera và micro rồi bấm Vào lớp.'}</p>
          <button type="button" className="mt-pbtn" disabled={props.joining} onClick={join}>
            {props.joining ? 'Đang vào…' : props.role === null ? 'Xin vào lớp' : 'Vào lớp'}
          </button>
          {error && <p className="mt-error" role="alert">{error}</p>}
          <div className="mt-checks" aria-label="Kiểm tra trước khi vào">
            <div className={videoEnabled && video ? 'ok' : 'warn'}><Icon name={videoEnabled && video ? 'check' : 'cam-off'} size={18} /> {!videoEnabled ? 'Camera đang tắt' : video ? 'Camera hoạt động' : failed ? 'Không mở được camera' : 'Đang mở camera…'}</div>
            <div className={audioEnabled && audio ? 'ok' : 'warn'}><Icon name={audioEnabled && audio ? 'check' : 'mic-off'} size={18} /> {!audioEnabled ? 'Micro đang tắt, bật khi được mời phát biểu' : !audio ? (failed ? 'Không mở được micro' : 'Đang mở micro…') : level > 0.05 ? 'Micro đang nhận tiếng' : 'Micro đã bật, thử nói vài câu'}</div>
          </div>
          <p className="mt-muted" style={{ fontSize: 13 }}>Tên hiển thị trong lớp lấy theo tài khoản của bạn. Điểm danh tự động khi vào lớp.</p>
        </div>
      </main>
    </LobbyShell>
  );
}
