'use client';
import { Participant } from 'livekit-client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { roleOf } from './shared';

type Group = { index: number; name: string; members: string[]; online: string[] };
type State = { active: boolean; endsAt: string | null; groups: Group[] };

/** Xếp đều học viên vào n nhóm theo thứ tự ngẫu nhiên. */
function autoAssign(ids: string[], n: number): Record<string, number> {
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  return Object.fromEntries(shuffled.map((id, i) => [id, i % n]));
}

/**
 * Tab "Nhóm" của giáo viên. Chưa chia: chọn số nhóm, xếp học viên đang trong phòng.
 * Đang chia: xem ai đang ở nhóm nào, ghé nhóm, nhắn cho mọi nhóm, gọi các nhóm về.
 */
export function BreakoutPanel(props: {
  sessionId: string;
  participants: Participant[];
  /** Nhóm giáo viên đang ghé; null là phòng chính. */
  currentGroup: number | null;
  switchRoom: (group?: number) => Promise<void>;
  say: (m: string) => void;
}) {
  const { sessionId, participants, currentGroup, switchRoom, say } = props;
  const [state, setState] = useState<State | null>(null);
  const [count, setCount] = useState(2);
  const [minutes, setMinutes] = useState(10);
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<State>(`/sessions/${sessionId}/breakouts`).then(setState).catch((e) => say(e.message)), [sessionId, say]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const students = participants.filter((p) => roleOf(p) !== 'teacher');
  // Học viên mới vào phòng chưa được xếp thì đưa vào nhóm ít người nhất.
  useEffect(() => {
    setAssign((cur) => {
      const missing = students.filter((p) => cur[p.identity] == null);
      if (!missing.length) return cur;
      const next = { ...cur };
      for (const p of missing) {
        const sizes = Array.from({ length: count }, (_, g) => Object.values(next).filter((v) => v === g).length);
        next[p.identity] = sizes.indexOf(Math.min(...sizes));
      }
      return next;
    });
    for (const p of students) setNames((n) => (n[p.identity] ? n : { ...n, [p.identity]: p.name || p.identity }));
  }, [students, count]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) say(ok);
      await load();
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    const present = new Set(students.map((p) => p.identity));
    const groups = Array.from({ length: count }, (_, g) => ({
      name: `Nhóm ${g + 1}`,
      members: Object.entries(assign).filter(([id, v]) => v === g && present.has(id)).map(([id]) => id),
    }));
    if (groups.some((g) => g.members.length === 0) && !window.confirm('Có nhóm chưa có ai. Vẫn chia nhóm?')) return;
    run(() => api(`/sessions/${sessionId}/breakouts`, { json: { groups, minutes } }), `Đã chia ${count} nhóm, học viên đang được chuyển sang`);
  };

  const announce = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    run(() => api(`/sessions/${sessionId}/breakouts/announce`, { json: { text: note } }), 'Đã gửi cho mọi nhóm').then(() => setNote(''));
  };

  if (!state) return <div className="side-body"><p className="sub">Đang tải…</p></div>;

  if (!state.active) {
    return (
      <div className="side-body">
        <div className="grp">Chia nhóm nhỏ</div>
        {students.length < 2 ? (
          <p className="sub">Cần ít nhất 2 học viên trong phòng để chia nhóm.</p>
        ) : (
          <>
            <div className="row" style={{ gap: 8 }}>
              <label className="sub" htmlFor="bo-count">Số nhóm
                <select id="bo-count" className="mini" value={count} onChange={(e) => { const n = Number(e.target.value); setCount(n); setAssign(autoAssign(students.map((p) => p.identity), n)); }}>
                  {Array.from({ length: Math.min(10, students.length) - 1 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="sub" htmlFor="bo-min">Thời gian
                <select id="bo-min" className="mini" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                  {[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} phút</option>)}
                </select>
              </label>
              <button type="button" className="mini" onClick={() => setAssign(autoAssign(students.map((p) => p.identity), count))}>Xếp ngẫu nhiên</button>
            </div>
            {students.map((p) => (
              <div key={p.identity} className="person">
                <span className="pn">{names[p.identity]}</span>
                <select className="mini" aria-label={`Nhóm của ${names[p.identity]}`} value={assign[p.identity] ?? 0} onChange={(e) => setAssign({ ...assign, [p.identity]: Number(e.target.value) })}>
                  {Array.from({ length: count }, (_, g) => <option key={g} value={g}>Nhóm {g + 1}</option>)}
                </select>
              </div>
            ))}
            <button className="mini pri" style={{ justifySelf: 'start' }} disabled={busy} onClick={start}>Bắt đầu chia nhóm</button>
            <small className="sub">Học viên tự chuyển sang phòng nhóm. Bảng trắng và ghi hình chỉ có ở phòng chính.</small>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="side-body">
      <div className="grp">
        Đang chia {state.groups.length} nhóm
        {state.endsAt && ` · hẹn về lúc ${new Date(state.endsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
      </div>
      {currentGroup != null && (
        <button className="mini pri" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => run(() => switchRoom())}>← Về phòng chính</button>
      )}
      {state.groups.map((g) => (
        <div key={g.index} className="quiz-item">
          <div className="row" style={{ gap: 6 }}>
            <b style={{ flex: 1, fontSize: 14 }}>{g.name}{currentGroup === g.index && ' (bạn đang ở đây)'}</b>
            <small className="sub">{g.online.length}/{g.members.length} đang trong nhóm</small>
            {currentGroup !== g.index && <button className="mini" disabled={busy} onClick={() => run(() => switchRoom(g.index))}>Ghé nhóm</button>}
          </div>
          <small className="sub">{g.members.map((m) => `${g.online.includes(m) ? '● ' : ''}${names[m] ?? 'Học viên'}`).join(', ') || 'Chưa có ai'}</small>
        </div>
      ))}
      <form className="chat-form" style={{ padding: 0, border: 0 }} onSubmit={announce}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhắn mọi nhóm, ví dụ: còn 2 phút" maxLength={300} />
        <button className="mini" disabled={busy}>Gửi</button>
      </form>
      <button
        className="mini warn"
        style={{ justifySelf: 'start' }}
        disabled={busy}
        onClick={() => run(async () => { await api(`/sessions/${sessionId}/breakouts/end`, { method: 'POST' }); if (currentGroup != null) await switchRoom(); }, 'Đã gọi các nhóm về phòng chính')}
      >
        Gọi các nhóm về
      </button>
    </div>
  );
}
