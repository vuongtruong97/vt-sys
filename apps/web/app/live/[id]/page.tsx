'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';

type Info = {
  id: string;
  title: string;
  course: string;
  startsAt: string;
  endsAt: string;
  status: 'STARTING' | 'RECORDING' | 'PROCESSING' | 'READY' | 'FAILED' | null;
  public: boolean;
  canWatch: boolean;
  playlist: string | null;
};

/**
 * Xem phát trực tiếp (webinar). Người xem tải HLS qua /api/live, không vào phòng LiveKit,
 * nên một buổi học chịu được rất nhiều người xem. Trễ khoảng 10–20 giây so với trong lớp.
 */
export default function LivePage({ params }: { params: { id: string } }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);

  // Hỏi lại trạng thái mỗi 10 giây: luồng có thể chưa bắt đầu hoặc vừa kết thúc.
  useEffect(() => {
    const load = () => api<Info>(`/live/${params.id}`).then(setInfo).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [params.id]);

  const playlist = info?.status === 'RECORDING' || info?.status === 'READY' ? info.playlist : null;

  useEffect(() => {
    const el = video.current;
    if (!el || !playlist) return;
    // Safari phát HLS sẵn.
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = playlist;
      return () => el.removeAttribute('src');
    }
    let destroyed = false;
    let hls: import('hls.js').default | null = null;
    import('hls.js').then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) {
        setError('Trình duyệt này không phát được video trực tiếp. Thử Chrome, Edge, Firefox hoặc Safari bản mới.');
        return;
      }
      hls = new Hls({ liveSyncDurationCount: 3, manifestLoadingMaxRetry: 10, levelLoadingMaxRetry: 10 });
      hls.loadSource(playlist);
      hls.attachMedia(el);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
      });
    });
    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [playlist]);

  const state =
    !info ? 'Đang tải…'
    : !info.canWatch ? null
    : info.status === null || info.status === 'STARTING' ? 'Buổi học chưa phát trực tiếp. Trang tự mở video khi giáo viên bắt đầu.'
    : info.status === 'PROCESSING' ? 'Buổi phát vừa kết thúc, bản xem lại sẽ có sau ít phút.'
    : info.status === 'FAILED' ? 'Buổi phát gặp lỗi. Liên hệ giáo viên để biết thêm.'
    : null;

  return (
    <div className="center" style={{ alignItems: 'start' }}>
      <div className="box" style={{ width: '100%', maxWidth: 960 }}>
        <div>
          <p style={{ color: 'var(--on-room-muted)', fontSize: 13 }}>{info?.course}</p>
          <h2>{info?.title}</h2>
          {info && (
            <p style={{ color: 'var(--on-room-muted)', fontSize: 13, marginTop: 6 }}>
              {fmtDay(info.startsAt)}, {fmtTime(info.startsAt)} – {fmtTime(info.endsAt)}
              {info.status === 'RECORDING' && <span className="pill rec" style={{ marginLeft: 8 }}>● Trực tiếp</span>}
              {info.status === 'READY' && ' · Bản xem lại'}
            </p>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {info && !info.canWatch && (
          <p>
            Buổi phát này chỉ dành cho học viên của khoá. <Link href={`/login?next=/live/${params.id}`}>Đăng nhập</Link> để xem.
          </p>
        )}
        {state && <p style={{ color: 'var(--on-room-muted)' }}>{state}</p>}
        {playlist && (
          <video ref={video} className="live-video" controls autoPlay playsInline muted={false} aria-label={`Video buổi học ${info?.title}`} />
        )}
        {info?.status === 'RECORDING' && (
          <p style={{ color: 'var(--on-room-muted)', fontSize: 12 }}>Video trễ khoảng 10–20 giây so với lớp học. Muốn hỏi giáo viên, vào lớp từ trang Lịch học (nếu bạn là học viên).</p>
        )}
      </div>
    </div>
  );
}
