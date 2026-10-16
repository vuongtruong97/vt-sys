'use client';
import { Participant } from 'livekit-client';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { useQuizzes, useRoomChat } from './interaction';
import { QuizPanel } from './Quiz';
import { handUp, Panel, roleOf, RoomMeta } from './shared';

type JoinRequest = { id: string; user: { id: string; name: string; email: string } };

export function SidePanel(props: {
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
}) {
  const { panel, setPanel, isTeacher } = props;
  return (
    <aside className="side">
      <div className="side-head">
        <button className="tab" aria-pressed={panel === 'chat'} onClick={() => setPanel('chat')}>Trò chuyện</button>
        <button className="tab" aria-pressed={panel === 'people'} onClick={() => setPanel('people')}>
          Học viên ({props.participants.length})
        </button>
        {isTeacher && (
          <button className="tab" aria-pressed={panel === 'quiz'} onClick={() => setPanel('quiz')}>Câu hỏi</button>
        )}
        <button className="tab x" aria-label="Đóng" onClick={() => setPanel(null)}>✕</button>
      </div>
      {panel === 'chat' ? (
        <ChatPanel chat={props.chat} teacherId={props.teacherId} say={props.say} />
      ) : panel === 'quiz' && isTeacher ? (
        <QuizPanel quiz={props.quiz} say={props.say} />
      ) : (
        <PeoplePanel {...props} />
      )}
    </aside>
  );
}

function ChatPanel({ chat, teacherId, say }: { chat: ReturnType<typeof useRoomChat>; teacherId: string | undefined; say: (m: string) => void }) {
  const { messages, send } = chat;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length]);

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
      <div className="side-body" aria-live="polite">
        {messages.length === 0 && <p className="sub" style={{ color: 'var(--on-room-muted)', fontSize: 13 }}>Chưa có tin nhắn. Tin nhắn được lưu lại cùng buổi học.</p>}
        {messages.map((m) => (
          <div key={m.id} className="msg">
            <div className="who">
              <b className={m.from.id === teacherId ? 'gv' : ''}>{m.from.name}</b> ·{' '}
              {new Date(m.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="txt">{m.text}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhắn cho cả lớp" autoComplete="off" maxLength={1000} />
        <button className="mini pri" disabled={sending}>Gửi</button>
      </form>
    </>
  );
}

function PeoplePanel(props: Parameters<typeof SidePanel>[0]) {
  const { sessionId, isTeacher, meta, participants, sendControl, say } = props;
  const [waiting, setWaiting] = useState<JoinRequest[]>([]);

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

  return (
    <div className="side-body">
      {isTeacher && waiting.length > 0 && (
        <>
          <div className="grp">Đang chờ duyệt ({waiting.length})</div>
          {waiting.map((w) => (
            <div key={w.id} className="wait">
              <div className="person"><span className="pn">{w.user.name}<br /><small>{w.user.email}</small></span></div>
              <div className="row" style={{ gap: 6 }}>
                <button className="mini pri" onClick={() => mod(`join-requests/${w.id}`, { approve: true }, `Đã cho ${w.user.name} vào lớp`).then(loadWaiting)}>Cho vào</button>
                <button className="mini" onClick={() => mod(`join-requests/${w.id}`, { approve: false }, `Đã từ chối ${w.user.name}`).then(loadWaiting)}>Từ chối</button>
              </div>
            </div>
          ))}
        </>
      )}

      {isTeacher && (
        <>
          <label className="switch" htmlFor="allow-share">
            <input
              id="allow-share"
              type="checkbox"
              checked={meta.allowStudentShare}
              onChange={(e) =>
                mod('mod/allow-share', { allow: e.target.checked }, e.target.checked ? 'Học viên đã được phép chia sẻ màn hình' : 'Đã thu quyền chia sẻ màn hình')
              }
            />
            Cho phép học viên chia sẻ màn hình
          </label>
          <button className="mini" style={{ justifySelf: 'start' }} onClick={() => mod('mod/mute-all', {}, 'Đã tắt mic tất cả học viên')}>
            Tắt mic tất cả học viên
          </button>
        </>
      )}

      {hands.length > 0 && (
        <>
          <div className="grp">Đang giơ tay ({hands.length})</div>
          {hands.map((p) => (
            <div key={p.identity} className="person">
              <span className="pn">✋ {p.name || p.identity}</span>
              {isTeacher && (
                <>
                  <button className="mini pri" onClick={() => sendControl(p.identity, 'speak').then(() => say(`Đã mời ${p.name} phát biểu`))}>Mời phát biểu</button>
                  <button className="mini" onClick={() => sendControl(p.identity, 'lower')}>Hạ tay</button>
                </>
              )}
            </div>
          ))}
        </>
      )}

      <div className="grp">Trong lớp ({participants.length})</div>
      {participants.map((p) => {
        const teacher = roleOf(p) === 'teacher';
        return (
          <div key={p.identity} className="person">
            <span className="pn">
              {p.name || p.identity}
              {p.isLocal && <small> (bạn)</small>}
              {teacher && <small> · Giáo viên</small>}
            </span>
            <small title="Micro">{p.isMicrophoneEnabled ? '🎙️' : '🔇'}</small>
            <small title="Camera">{p.isCameraEnabled ? '📷' : '—'}</small>
            {isTeacher && !teacher && (
              <>
                {p.isMicrophoneEnabled && (
                  <button className="mini" onClick={() => mod('mod/mute', { identity: p.identity }, `Đã tắt mic của ${p.name}`)}>Tắt mic</button>
                )}
                <button
                  className="mini warn"
                  onClick={() => {
                    if (window.confirm(`Mời ${p.name} ra khỏi lớp?`)) mod('mod/remove', { identity: p.identity }, `Đã mời ${p.name} ra khỏi lớp`);
                  }}
                >
                  Mời ra
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
