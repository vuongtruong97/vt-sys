'use client';
import { useLocalParticipant } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Materials } from '@/components/Materials';
import { Icon, IconName } from '@/components/meet/icons';
import { api } from '@/lib/api';
import type { useQuizzes, useRoomChat } from './interaction';
import type { GroupInfo } from './shared';
import { BreakoutPanel } from './Breakout';
import { QuizPanel } from './Quiz';
import { handUp, Panel, roleOf, RoomMeta } from './shared';
import { displayName, PersonAvatar } from './Stage';

type JoinRequest = { id: string; user: { id: string; name: string; email: string } };

/** Các việc giáo viên làm từ bảng "Hoạt động" (chỉ có ở phòng chính). */
export type Activities = {
  board: boolean;
  toggleBoard: () => void;
  /** Bảng GeoGebra đang mở. */
  ggb: boolean;
  toggleGgb: () => void;
  canRecord: boolean;
  recording: boolean;
  live: boolean;
  busy: boolean;
  toggleRecording: () => void;
  toggleLive: () => void;
};

const TITLES: Record<Exclude<Panel, null>, string> = {
  people: 'Người tham gia',
  chat: 'Trò chuyện trong lớp',
  quiz: 'Câu hỏi nhanh',
  files: 'Tài liệu buổi học',
  groups: 'Chia nhóm nhỏ',
  activities: 'Hoạt động',
};

type Props = {
  panel: Exclude<Panel, null>;
  setPanel: (p: Panel) => void;
  sessionId: string;
  isTeacher: boolean;
  meta: RoomMeta;
  participants: Participant[];
  sendControl: (identity: string, type: 'speak' | 'lower') => Promise<void>;
  say: (msg: string) => void;
  chat: ReturnType<typeof useRoomChat>;
  quiz: ReturnType<typeof useQuizzes>;
  teacherId: string | undefined;
  courseId: string | null;
  group: GroupInfo | null;
  switchRoom: (group?: number) => Promise<void>;
  activities: Activities | null;
};

/** Bảng bên phải kiểu Meet (trên điện thoại thành tấm trượt từ dưới lên). */
export function SidePanel(props: Props) {
  const { panel, setPanel, isTeacher } = props;
  // Bảng "Câu hỏi", "Nhóm" mở từ "Hoạt động" có nút quay lại.
  const fromActivities = isTeacher && (panel === 'quiz' || panel === 'groups');
  return (
    <aside className="mt-panel mt-panel--live" aria-label={TITLES[panel]}>
      <div className="mt-panel__head">
        {fromActivities && (
          <button type="button" className="mt-panel__close" aria-label="Quay lại Hoạt động" onClick={() => setPanel('activities')}>
            <Icon name="chevron" className="mt-flip" />
          </button>
        )}
        <h2 style={{ flex: 1 }}>{TITLES[panel]}{panel === 'people' ? ` (${props.participants.length})` : ''}</h2>
        <button type="button" className="mt-panel__close" aria-label="Đóng bảng" onClick={() => setPanel(null)}><Icon name="close" /></button>
      </div>
      {panel === 'chat' ? (
        <ChatPanel chat={props.chat} teacherId={props.teacherId} say={props.say} />
      ) : (
        <div className="mt-panel__body">
          {panel === 'files' ? (
            props.courseId ? (
              <Materials courseId={props.courseId} sessionId={props.sessionId} canEdit={isTeacher} room onMessage={props.say} />
            ) : (
              <p className="mt-muted">Meeting chưa có mục tài liệu.</p>
            )
          ) : panel === 'groups' && isTeacher ? (
            <BreakoutPanel sessionId={props.sessionId} participants={props.participants} currentGroup={props.group?.index ?? null} switchRoom={props.switchRoom} say={props.say} />
          ) : panel === 'quiz' && isTeacher ? (
            <QuizPanel quiz={props.quiz} say={props.say} />
          ) : panel === 'activities' && isTeacher ? (
            <ActivitiesPanel {...props} />
          ) : (
            <PeoplePanel {...props} />
          )}
        </div>
      )}
    </aside>
  );
}

function ChatPanel({ chat, teacherId, say }: { chat: ReturnType<typeof useRoomChat>; teacherId: string | undefined; say: (m: string) => void }) {
  const { messages, send } = chat;
  const myId = useLocalParticipant().localParticipant.identity;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setSending(true);
    try {
      await send(v);
      setText('');
    } catch (err) {
      say((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="mt-panel__body" aria-live="polite">
        <p className="mt-muted" style={{ textAlign: 'center' }}>Tin nhắn được lưu lại cùng buổi học. Người vào muộn vẫn xem được.</p>
        {messages.map((m) => {
          const mine = m.from.id === myId;
          return (
            <div key={m.id} className={`mt-msg${mine ? ' mt-msg--me' : ''}`}>
              <div className="mt-msg__meta">
                <b className={m.from.id === teacherId ? 't' : undefined}>{mine ? 'Bạn' : m.from.name}</b>
                <small>{new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <div className="mt-msg__text">{m.text}</div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="mt-panel__foot">
        <form className="mt-compose" onSubmit={submit}>
          <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhắn cho cả lớp" aria-label="Nhắn cho cả lớp" autoComplete="off" maxLength={1000} />
          <button type="submit" aria-label="Gửi" disabled={sending || !text.trim()}><Icon name="send" size={18} /></button>
        </form>
      </div>
    </>
  );
}

function PeoplePanel(props: Props) {
  const { sessionId, isTeacher, meta, participants, sendControl, say } = props;
  const [waiting, setWaiting] = useState<JoinRequest[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadWaiting = useCallback(() => {
    if (!isTeacher) return;
    api<JoinRequest[]>(`/sessions/${sessionId}/join-requests`).then(setWaiting).catch(() => {});
  }, [isTeacher, sessionId]);
  useEffect(() => {
    loadWaiting();
    if (!isTeacher) return;
    const t = setInterval(loadWaiting, 4000);
    return () => clearInterval(t);
  }, [isTeacher, loadWaiting]);

  const mod = async (path: string, json: unknown, ok: string) => {
    try {
      await api(`/sessions/${sessionId}/${path}`, { json });
      say(ok);
    } catch (e) {
      say((e as Error).message);
    }
  };

  const hands = participants.filter(handUp);
  const q = query.trim().toLowerCase();
  const list = q ? participants.filter((p) => displayName(p).toLowerCase().includes(q)) : participants;

  return (
    <>
      {isTeacher && (
        <div className="mt-row">
          <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm" onClick={() => mod('mod/mute-all', {}, 'Đã tắt mic tất cả học viên')}>
            <Icon name="mic-off" size={16} /> Tắt mic tất cả
          </button>
        </div>
      )}
      {participants.length > 6 && (
        <label className="mt-search">
          <Icon name="search" size={18} />
          <span className="mt-sr">Tìm người tham gia</span>
          <input placeholder="Tìm người tham gia" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}

      {isTeacher && waiting.length > 0 && (
        <div className="mt-group">
          <div className="mt-group__head"><span>Phòng chờ · {waiting.length}</span></div>
          {waiting.map((w) => (
            <div key={w.id} className="mt-person">
              <span className="mt-person__av" style={{ background: 'var(--md-outline)' }} aria-hidden>{w.user.name.trim()[0]?.toUpperCase()}</span>
              <div className="mt-person__name"><b>{w.user.name}</b><small>{w.user.email} · chưa có trong lớp</small></div>
              <div className="mt-person__acts">
                <button type="button" aria-label={`Từ chối ${w.user.name}`} title="Từ chối" onClick={() => mod(`join-requests/${w.id}`, { approve: false }, `Đã từ chối ${w.user.name}`).then(loadWaiting)}>
                  <Icon name="x" size={18} />
                </button>
                <button type="button" aria-label={`Cho ${w.user.name} vào lớp`} title="Cho vào" style={{ color: 'var(--md-success)' }} onClick={() => mod(`join-requests/${w.id}`, { approve: true }, `Đã cho ${w.user.name} vào lớp`).then(loadWaiting)}>
                  <Icon name="check" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hands.length > 0 && (
        <div className="mt-group">
          <div className="mt-group__head"><span>Đang giơ tay · {hands.length}</span></div>
          {hands.map((p) => (
            <div key={p.identity} className="mt-person">
              <PersonAvatar p={p} />
              <div className="mt-person__name"><b>{displayName(p)}</b>{p.isLocal && <small>Bạn</small>}</div>
              {isTeacher && (
                <div className="mt-person__acts">
                  <button type="button" aria-label={`Hạ tay ${displayName(p)}`} title="Hạ tay" onClick={() => sendControl(p.identity, 'lower')}>
                    <Icon name="x" size={18} />
                  </button>
                  <button type="button" className="mt-pbtn mt-pbtn--sm" style={{ width: 'auto', color: '#fff' }} onClick={() => sendControl(p.identity, 'speak').then(() => say(`Đã mời ${displayName(p)} phát biểu`))}>
                    Mời nói
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-group">
        <div className="mt-group__head"><span>Trong lớp · {participants.length}</span></div>
        {list.map((p) => {
          const teacher = roleOf(p) === 'teacher';
          const canModerate = isTeacher && !teacher;
          return (
            <div key={p.identity}>
              <div className="mt-person">
                <PersonAvatar p={p} />
                <div className="mt-person__name">
                  <b>{displayName(p)}</b>
                  <small>{teacher ? 'Giáo viên' : 'Học viên'}{p.isLocal ? ' · bạn' : ''}</small>
                </div>
                <div className="mt-person__acts">
                  {handUp(p) && <span className="mt-person__hand" title="Đang giơ tay"><Icon name="hand" size={18} /></span>}
                  {canModerate && p.isMicrophoneEnabled ? (
                    <button type="button" aria-label={`Tắt mic ${displayName(p)}`} title="Tắt mic" onClick={() => mod('mod/mute', { identity: p.identity }, `Đã tắt mic của ${displayName(p)}`)}>
                      <Icon name="mic" size={18} />
                    </button>
                  ) : (
                    <span className={p.isMicrophoneEnabled ? '' : 'is-off'} title={p.isMicrophoneEnabled ? 'Đang bật micro' : 'Đã tắt micro'} style={{ display: 'grid', placeItems: 'center', width: 34, height: 34 }}>
                      <Icon name={p.isMicrophoneEnabled ? 'mic' : 'mic-off'} size={18} />
                    </span>
                  )}
                  {canModerate && (
                    <button type="button" aria-label={`Thao tác với ${displayName(p)}`} aria-expanded={menu === p.identity} onClick={() => setMenu(menu === p.identity ? null : p.identity)}>
                      <Icon name="more" size={18} />
                    </button>
                  )}
                </div>
              </div>
              {canModerate && menu === p.identity && (
                <div className="mt-pmenu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenu(null); sendControl(p.identity, 'speak').then(() => say(`Đã mời ${displayName(p)} phát biểu`)); }}>
                    <Icon name="mic" size={17} /> Mời phát biểu
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setMenu(null);
                      if (window.confirm(`Mời ${displayName(p)} ra khỏi lớp?`)) mod('mod/remove', { identity: p.identity }, `Đã mời ${displayName(p)} ra khỏi lớp`);
                    }}
                  >
                    <Icon name="leave" size={17} /> Mời ra khỏi lớp
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isTeacher && (
        <div className="mt-switchrow">
          <span>Cho phép học viên chia sẻ màn hình</span>
          <button
            type="button"
            className="mt-toggle"
            role="switch"
            aria-checked={meta.allowStudentShare}
            aria-label="Cho phép học viên chia sẻ màn hình"
            onClick={() =>
              mod('mod/allow-share', { allow: !meta.allowStudentShare }, !meta.allowStudentShare ? 'Học viên đã được phép chia sẻ màn hình' : 'Đã thu quyền chia sẻ màn hình')
            }
          />
        </div>
      )}
    </>
  );
}

function Activity({ icon, color, title, text, onClick, disabled, on }: { icon: IconName; color: [string, string]; title: string; text: ReactNode; onClick: () => void; disabled?: boolean; on?: boolean }) {
  return (
    <button type="button" className="mt-act" onClick={onClick} disabled={disabled} aria-pressed={on}>
      <span className="mt-act__ic" style={{ color: color[0], background: color[1] }}><Icon name={icon} size={24} /></span>
      <span className="mt-act__txt"><b>{title}</b><small>{text}</small></span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

function ActivitiesPanel({ setPanel, activities, quiz, group, courseId }: Props) {
  return (
    <>
      <Activity icon="poll" color={['var(--md-on-tertiary-container)', 'var(--md-tertiary-container)']} title="Câu hỏi nhanh" text={quiz.open ? 'Đang có câu hỏi mở, xem kết quả trực tiếp.' : 'Trắc nghiệm hoặc thăm dò, xem kết quả tức thì.'} onClick={() => setPanel('quiz')} />
      <Activity icon="groups" color={['var(--md-on-primary-container)', 'var(--md-primary-container)']} title="Chia nhóm nhỏ" text={group ? `Bạn đang ở ${group.name}. Ghé nhóm khác hoặc gọi các nhóm về.` : 'Chia lớp thành các phòng thảo luận có đếm giờ.'} onClick={() => setPanel('groups')} />
      {activities && (
        <>
          <Activity icon="board" color={['var(--md-on-success-container)', 'var(--md-success-container)']} title={activities.board ? 'Đóng bảng trắng' : 'Bảng trắng'} text="Bảng phấn chung, cả lớp cùng viết. Lưu lại cho buổi sau." onClick={activities.toggleBoard} on={activities.board} />
          <Activity icon="layout" color={['var(--md-on-primary-container)', 'var(--md-primary-container)']} title={activities.ggb ? 'Đóng bảng GeoGebra' : 'Bảng GeoGebra'} text="Dựng hình, vẽ đồ thị bằng GeoGebra; cả lớp xem trực tiếp, chỉ bạn vẽ." onClick={activities.toggleGgb} on={activities.ggb} />
          {activities.canRecord && (
            <>
              <Activity icon="record" color={['var(--md-on-error-container)', 'var(--md-error-container)']} title={activities.recording ? 'Dừng ghi hình' : 'Ghi hình'} text="Ghi lại buổi học để học viên xem lại. Mọi người thấy biểu tượng đang ghi." onClick={activities.toggleRecording} disabled={activities.busy} on={activities.recording} />
              <Activity icon="live" color={['var(--md-on-secondary-container)', 'var(--md-secondary-container)']} title={activities.live ? 'Dừng phát trực tiếp' : 'Phát trực tiếp'} text="Phát buổi học cho người xem qua liên kết, không cần vào lớp." onClick={activities.toggleLive} disabled={activities.busy} on={activities.live} />
            </>
          )}
        </>
      )}
      {!activities && <p className="mt-muted">Bảng trắng, ghi hình và phát trực tiếp chỉ dùng được ở phòng chính.</p>}
      {activities && !courseId && <p className="mt-muted">Meeting chưa hỗ trợ ghi hình và phát trực tiếp.</p>}
    </>
  );
}
