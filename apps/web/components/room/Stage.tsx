'use client';
import { isTrackReference, TrackReferenceOrPlaceholder, VideoTrack } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/components/meet/icons';
import { AvatarImg } from '@/components/ui/AvatarImg';
import { handUp, roleOf } from './shared';

/** Màu nền avatar cố định theo người (khi tắt camera). */
const TINTS = ['#3b6e6f', '#6b5bb3', '#b2643a', '#3d6bb3', '#2f7a46', '#a34a72', '#7a6a2f', '#4a5aa3', '#8a3f9b', '#3b7d8a', '#9b4a3f', '#566b2f'];
export function tintOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}
export const displayName = (p: Participant) => p.name || p.identity;

/** Ảnh đại diện theo identity (= users.id). Chưa có ảnh thì API trả 404, AvatarImg tự ẩn để hiện chữ cái đầu. */
export const avatarOf = (identity: string) => `/api/users/${encodeURIComponent(identity)}/avatar`;

/** Avatar tròn chữ cái đầu (danh sách người tham gia, ô tắt camera). */
export function PersonAvatar({ p, size }: { p: Participant; size?: number }) {
  return (
    <span className="mt-person__av" style={{ background: tintOf(p.identity), ...(size ? { width: size, height: size } : {}) }} aria-hidden>
      {initials(displayName(p))}
      <AvatarImg src={avatarOf(p.identity)} />
    </span>
  );
}

/** Một ô video: camera (hoặc avatar khi tắt), tên, mic tắt, đang nói, giơ tay. */
export function RoomTile({ trackRef, style }: { trackRef: TrackReferenceOrPlaceholder; style?: CSSProperties }) {
  const p = trackRef.participant;
  const name = displayName(p);
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted && !!trackRef.publication.track;
  const speaking = p.isSpeaking && p.isMicrophoneEnabled;
  return (
    <div className={`mt-tile${speaking ? ' mt-tile--speaking' : ''}`} style={style}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} className="mt-tile__video" style={p.isLocal ? { transform: 'scaleX(-1)' } : undefined} />
      ) : (
        <span className="mt-tile__avatar" style={{ background: tintOf(p.identity) }} aria-hidden>
          {initials(name)}
          <AvatarImg src={avatarOf(p.identity)} />
        </span>
      )}
      <div className="mt-tile__state">
        {handUp(p) && (
          <span className="mt-tile__badge mt-tile__badge--hand" title="Đang giơ tay">
            <Icon name="hand" size={16} />
          </span>
        )}
        {!p.isMicrophoneEnabled ? (
          <span className="mt-tile__badge" title="Đã tắt micro">
            <Icon name="mic-off" size={15} />
          </span>
        ) : (
          speaking && (
            <span className="mt-tile__badge mt-tile__badge--talk" title="Đang nói">
              <span className="mt-wave" aria-hidden><i /><i /><i /></span>
            </span>
          )
        )}
      </div>
      <div className="mt-tile__name">
        {roleOf(p) === 'teacher' && <em className="mt-tag">GV</em>}
        <span>{name}{p.isLocal ? ' (bạn)' : ''}</span>
      </div>
    </div>
  );
}

/** Ô màn hình chia sẻ: giữ tỉ lệ, không cắt (object-fit: contain). */
export function ShareTile({ trackRef, by }: { trackRef: TrackReferenceOrPlaceholder; by: string }) {
  return (
    <div className="mt-share">
      <span className="mt-share__label"><Icon name="screen" size={16} /> {by} đang trình bày</span>
      {isTrackReference(trackRef) && <VideoTrack trackRef={trackRef} className="mt-share__video" />}
    </div>
  );
}

/** Số cột hợp lý cho n ô (giống Meet). */
const colsFor = (n: number) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

/**
 * Giáo viên và người giơ tay lên đầu. Người đang nói chỉ được đẩy lên khi không đủ chỗ hiện tất cả
 * (bySpeaking), để các ô không nhảy chỗ mỗi khi có người nói.
 */
function ordered(tracks: TrackReferenceOrPlaceholder[], bySpeaking: boolean) {
  const score = (t: TrackReferenceOrPlaceholder) =>
    (bySpeaking && t.participant.isSpeaking ? 4 : 0) + (roleOf(t.participant) === 'teacher' ? 2 : 0) + (handUp(t.participant) ? 1 : 0);
  return [...tracks].sort((a, b) => score(b) - score(a));
}

/** Tối đa bao nhiêu ô hiện trên lưới; còn lại gom vào "+N người khác". */
const MAX_GRID = 16;

export function GridStage({ cameras }: { cameras: TrackReferenceOrPlaceholder[] }) {
  const list = ordered(cameras, cameras.length > MAX_GRID);
  const shown = list.length > MAX_GRID ? list.slice(0, MAX_GRID - 1) : list;
  const extra = list.length - shown.length;
  return (
    <div className="mt-grid" data-n={Math.min(shown.length, 3)} style={{ '--cols': colsFor(shown.length + (extra ? 1 : 0)) } as CSSProperties}>
      {shown.map((t) => (
        <RoomTile key={`${t.participant.identity}-${t.source}`} trackRef={t} />
      ))}
      {extra > 0 && <div className="mt-strip__more">+{extra} người khác</div>}
    </div>
  );
}

/** Khung lớn (màn hình chia sẻ / bảng trắng) và dải người bên cạnh. */
export function FocusStage({ main, cameras }: { main: ReactNode; cameras: TrackReferenceOrPlaceholder[] }) {
  const list = ordered(cameras, cameras.length > 4);
  const count = Math.min(list.length, 4);
  const extra = list.length - count;
  return (
    <div className="mt-speaker">
      {main}
      {/* Số hàng qua biến CSS (không đặt grid-template-rows thẳng) để màn hẹp đổi được thành một hàng ngang. */}
      <div className="mt-strip" style={{ '--rows': count + (extra ? 1 : 0) } as CSSProperties}>
        {list.slice(0, count).map((t) => (
          <RoomTile key={`${t.participant.identity}-${t.source}`} trackRef={t} />
        ))}
        {extra > 0 && <div className="mt-strip__more">+{extra} người khác</div>}
      </div>
    </div>
  );
}
