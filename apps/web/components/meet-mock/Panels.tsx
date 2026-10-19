'use client';
import { ReactNode, useState } from 'react';
import { files, groups, ME_ID, messages, people, quiz, session, waiting } from './data';
import { Icon, IconName } from '@/components/meet/icons';
import { Av } from './Tiles';

export type PanelId = 'people' | 'chat' | 'quiz' | 'breakout' | 'files' | 'activities' | 'info';

export const PANEL_TITLES: Record<PanelId, string> = {
  people: 'Người tham gia',
  chat: 'Trò chuyện trong lớp',
  quiz: 'Câu hỏi nhanh',
  breakout: 'Chia nhóm nhỏ',
  files: 'Tài liệu buổi học',
  activities: 'Hoạt động',
  info: 'Thông tin buổi học',
};

function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="mt-switchrow">
      <span>{label}</span>
      <button type="button" className="mt-toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => setOn(!on)} />
    </div>
  );
}

function People() {
  const [menu, setMenu] = useState<string | null>(null);
  const [admitted, setAdmitted] = useState<string[]>([]);
  const hands = people.filter((p) => p.hand);
  const queue = waiting.filter((w) => !admitted.includes(w.id));
  return (
    <>
      <div className="mt-row">
        <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm"><Icon name="mic-off" size={16} /> Tắt mic tất cả</button>
        <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm"><Icon name="people" size={16} /> Thêm học viên</button>
      </div>
      <label className="mt-search">
        <Icon name="search" size={18} />
        <span className="mt-sr">Tìm người tham gia</span>
        <input placeholder="Tìm người tham gia" />
      </label>

      {queue.length > 0 && (
        <div className="mt-group">
          <div className="mt-group__head">
            <span>Phòng chờ · {queue.length}</span>
            <button type="button" className="mt-pbtn mt-pbtn--sm" onClick={() => setAdmitted(waiting.map((w) => w.id))}>Cho vào tất cả</button>
          </div>
          {queue.map((w) => (
            <div key={w.id} className="mt-person">
              <Av p={{ name: w.name, tint: 'var(--md-outline)' }} />
              <div className="mt-person__name"><b>{w.name}</b><small>{w.email} · chưa có trong lớp</small></div>
              <div className="mt-person__acts">
                <button type="button" aria-label={`Từ chối ${w.name}`} onClick={() => setAdmitted((a) => [...a, w.id])}><Icon name="x" size={18} /></button>
                <button type="button" aria-label={`Cho ${w.name} vào lớp`} onClick={() => setAdmitted((a) => [...a, w.id])} style={{ color: 'var(--md-success)' }}><Icon name="check" size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-group">
        <div className="mt-group__head"><span>Đang giơ tay · {hands.length}</span><button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm">Hạ tất cả</button></div>
        {hands.map((p, i) => (
          <div key={p.id} className="mt-person">
            <Av p={p} />
            <div className="mt-person__name"><b>{p.name}</b><small>Giơ tay {i === 0 ? '2 phút' : '30 giây'} trước</small></div>
            <div className="mt-person__acts">
              <button type="button" className="mt-pbtn mt-pbtn--sm" style={{ width: 'auto' }}>Mời nói</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-group">
        <div className="mt-group__head"><span>Trong lớp · {people.length}</span></div>
        {people.map((p) => (
          <div key={p.id}>
            <div className="mt-person">
              <Av p={p} />
              <div className="mt-person__name">
                <b>{p.name}</b>
                <small>{p.role === 'teacher' ? 'Giáo viên' : p.id === ME_ID ? 'Học viên · bạn' : 'Học viên'}</small>
              </div>
              <div className="mt-person__acts">
                {p.hand && <span className="mt-person__hand" title="Đang giơ tay"><Icon name="hand" size={18} /></span>}
                <button type="button" className={p.mic ? '' : 'is-off'} aria-label={p.mic ? `Tắt mic ${p.name}` : `${p.name} đã tắt mic`}>
                  <Icon name={p.mic ? 'mic' : 'mic-off'} size={18} />
                </button>
                <button type="button" aria-label={`Thao tác với ${p.name}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)}>
                  <Icon name="more" size={18} />
                </button>
              </div>
            </div>
            {menu === p.id && (
              <div className="mt-pmenu" role="menu">
                <button type="button" role="menuitem"><Icon name="pin" size={17} /> Ghim lên màn hình</button>
                <button type="button" role="menuitem"><Icon name="mic" size={17} /> Mời phát biểu</button>
                <button type="button" role="menuitem"><Icon name="screen" size={17} /> Cho phép chia sẻ màn hình</button>
                <button type="button" role="menuitem"><Icon name="cam-off" size={17} /> Tắt camera</button>
                <button type="button" role="menuitem" className="danger"><Icon name="leave" size={17} /> Mời ra khỏi lớp</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Chat() {
  const pinned = messages.find((m) => m.pinned);
  return (
    <>
      <Toggle label="Cho học viên gửi tin nhắn" defaultOn />
      {pinned && (
        <div className="mt-pinned"><Icon name="pin" size={17} /><span><b>Đã ghim:</b> {pinned.text}</span></div>
      )}
      <p className="mt-muted" style={{ textAlign: 'center' }}>Tin nhắn được lưu lại cùng buổi học. Người vào muộn vẫn xem được.</p>
      {messages.map((m) => (
        <div key={m.id} className={`mt-msg${m.me ? ' mt-msg--me' : ''}`}>
          <div className="mt-msg__meta">
            <b className={m.teacher ? 't' : undefined}>{m.from}</b>
            <small>{m.at}</small>
          </div>
          <div className="mt-msg__text">{m.text}</div>
        </div>
      ))}
    </>
  );
}

function Quiz() {
  const [tab, setTab] = useState<'live' | 'new'>('live');
  const total = quiz.options.reduce((a, o) => a + o.votes, 0);
  return (
    <>
      <div className="mt-row">
        <button type="button" className={`mt-pbtn mt-pbtn--sm${tab === 'live' ? '' : ' mt-pbtn--ghost'}`} aria-pressed={tab === 'live'} onClick={() => setTab('live')}>Đang mở</button>
        <button type="button" className={`mt-pbtn mt-pbtn--sm${tab === 'new' ? '' : ' mt-pbtn--ghost'}`} aria-pressed={tab === 'new'} onClick={() => setTab('new')}>Tạo câu hỏi</button>
      </div>
      {tab === 'live' ? (
        <div className="mt-card">
          <span className="mt-muted">Câu 3 · Trắc nghiệm có đáp án</span>
          <h3>{quiz.question}</h3>
          {quiz.options.map((o) => {
            const pct = total ? Math.round((o.votes / total) * 100) : 0;
            return (
              <div key={o.text} className={`mt-opt${o.correct ? ' mt-opt--ok' : ''}`} style={{ '--w': `${pct}%` } as React.CSSProperties}>
                <span>{o.text}{o.correct ? ' ✓' : ''}</span>
                <b>{pct}%</b>
              </div>
            );
          })}
          <div className="mt-progress" aria-label={`${quiz.answered}/${quiz.total} học viên đã trả lời`}><i style={{ width: `${(quiz.answered / quiz.total) * 100}%` }} /></div>
          <div className="mt-row" style={{ justifyContent: 'space-between' }}>
            <span className="mt-muted">{quiz.answered}/{quiz.total} đã trả lời</span>
            <button type="button" className="mt-pbtn mt-pbtn--sm">Đóng và công bố đáp án</button>
          </div>
        </div>
      ) : (
        <div className="mt-card">
          <label className="mt-label">Câu hỏi<input className="mt-input" placeholder="Ví dụ: Kết quả của 7 // 2 là?" /></label>
          {['A', 'B', 'C'].map((k, i) => (
            <label key={k} className="mt-label">Lựa chọn {k}
              <div className="mt-row" style={{ flexWrap: 'nowrap' }}>
                <input className="mt-input" defaultValue={['3', '3.5', '4'][i]} />
                <input type="radio" name="correct" defaultChecked={i === 0} aria-label={`Đáp án đúng là ${k}`} />
              </div>
            </label>
          ))}
          <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm" style={{ justifySelf: 'start' }}>+ Thêm lựa chọn</button>
          <Toggle label="Thăm dò ý kiến (không có đáp án)" />
          <button type="button" className="mt-pbtn">Gửi cho cả lớp</button>
        </div>
      )}
    </>
  );
}

function Breakout() {
  const [running, setRunning] = useState(true);
  return (
    <>
      {running ? (
        <div className="mt-timer"><Icon name="clock" size={20} /><span>Các nhóm đang thảo luận, còn</span><b>07:42</b></div>
      ) : (
        <div className="mt-card">
          <label className="mt-label">Số nhóm<select className="mt-select" defaultValue="3"><option>2</option><option>3</option><option>4</option></select></label>
          <label className="mt-label">Thời gian<select className="mt-select" defaultValue="10 phút"><option>5 phút</option><option>10 phút</option><option>15 phút</option></select></label>
          <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm">Xếp ngẫu nhiên</button>
        </div>
      )}
      <p className="mt-muted">Kéo tên học viên để đổi nhóm. Giáo viên ghé được từng nhóm.</p>
      {groups.map((g) => (
        <div key={g.name} className="mt-bgroup">
          <div className="mt-bgroup__head">
            <span>{g.name} · {g.members.length} người</span>
            {running && <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm">Ghé nhóm</button>}
          </div>
          <div className="mt-chips">
            {g.members.map((n) => {
              const p = people.find((x) => x.name === n)!;
              return (
                <span key={n} className="mt-chip" draggable><i style={{ background: p.tint }}>{n.split(' ').pop()![0]}</i>{n}</span>
              );
            })}
          </div>
        </div>
      ))}
      <div className="mt-row">
        {running ? (
          <>
            <button type="button" className="mt-pbtn mt-pbtn--ghost">Nhắn mọi nhóm</button>
            <button type="button" className="mt-pbtn mt-pbtn--danger" onClick={() => setRunning(false)}>Gọi các nhóm về</button>
          </>
        ) : (
          <button type="button" className="mt-pbtn mt-pbtn--block" onClick={() => setRunning(true)}>Bắt đầu chia nhóm</button>
        )}
      </div>
    </>
  );
}

function Files() {
  return (
    <>
      <div className="mt-drop"><Icon name="files" size={26} /><b>Kéo thả tài liệu vào đây</b><span>PDF, slide, mã nguồn… tối đa 50 MB</span><button type="button" className="mt-pbtn mt-pbtn--sm">Chọn tệp</button></div>
      {files.map((f) => (
        <div key={f.name} className="mt-file">
          <span className={`mt-file__kind${f.kind === 'PY' ? ' mt-file__kind--py' : f.kind === 'DOC' ? ' mt-file__kind--doc' : ''}`}>{f.kind}</span>
          <div className="mt-file__name"><b>{f.name}</b><small>{f.size} · {f.by}</small></div>
          <button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm">Mở</button>
        </div>
      ))}
    </>
  );
}

function Activity({ icon, color, title, text, onClick }: { icon: IconName; color: [string, string]; title: string; text: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="mt-act" onClick={onClick}>
      <span className="mt-act__ic" style={{ color: color[0], background: color[1] }}><Icon name={icon} size={24} /></span>
      <span className="mt-act__txt"><b>{title}</b><small>{text}</small></span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

function Activities({ open }: { open: (p: PanelId | 'record') => void }) {
  return (
    <>
      <Activity icon="record" color={['var(--md-on-error-container)', 'var(--md-error-container)']} title="Ghi hình" text="Ghi lại buổi học để học viên xem lại. Mọi người thấy biểu tượng đang ghi." onClick={() => open('record')} />
      <Activity icon="live" color={['var(--md-on-secondary-container)', 'var(--md-secondary-container)']} title="Phát trực tiếp" text="Phát buổi học cho người xem qua liên kết, không cần vào lớp." />
      <Activity icon="poll" color={['var(--md-on-tertiary-container)', 'var(--md-tertiary-container)']} title="Câu hỏi nhanh" text="Trắc nghiệm hoặc thăm dò, xem kết quả tức thì." onClick={() => open('quiz')} />
      <Activity icon="groups" color={['var(--md-on-primary-container)', 'var(--md-primary-container)']} title="Chia nhóm nhỏ" text="Chia lớp thành các phòng thảo luận có đếm giờ." onClick={() => open('breakout')} />
      <Activity icon="board" color={['var(--md-on-success-container)', 'var(--md-success-container)']} title="Bảng trắng" text="Mở bảng phấn chung cho cả lớp cùng viết." />
    </>
  );
}

function Info() {
  return (
    <div className="mt-info">
      <p><b>{session.course} · {session.title}</b></p>
      <p className="mt-muted">Thứ Hai, 19/10 · {session.time}</p>
      <div className="mt-copy"><span>hoc.chapter97.xyz/room/{session.code}</span><button type="button" className="mt-pbtn mt-pbtn--ghost mt-pbtn--sm"><Icon name="copy" size={15} /> Chép</button></div>
      <p className="mt-muted">Chỉ học viên có trong danh sách lớp vào thẳng được. Người khác phải chờ giáo viên duyệt.</p>
      <Toggle label="Học viên được chia sẻ màn hình" />
      <Toggle label="Học viên được bật micro" defaultOn />
      <Toggle label="Khoá lớp (không nhận thêm người)" />
      <div className="mt-row"><Icon name="shield" size={18} /><span className="mt-muted">Mã hoá kết nối, chỉ giáo viên mời ra hoặc tắt mic người khác.</span></div>
    </div>
  );
}

/** Bảng bên phải (trên điện thoại thành tấm trượt từ dưới lên). */
export function Panel({ id, onClose, open }: { id: PanelId; onClose: () => void; open: (p: PanelId | 'record') => void }) {
  return (
    <aside className="mt-panel" aria-label={PANEL_TITLES[id]}>
      <div className="mt-panel__head">
        <h2>{PANEL_TITLES[id]}</h2>
        <button type="button" className="mt-panel__close" aria-label="Đóng bảng" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="mt-panel__body">
        {id === 'people' && <People />}
        {id === 'chat' && <Chat />}
        {id === 'quiz' && <Quiz />}
        {id === 'breakout' && <Breakout />}
        {id === 'files' && <Files />}
        {id === 'activities' && <Activities open={open} />}
        {id === 'info' && <Info />}
      </div>
      {id === 'chat' && (
        <div className="mt-panel__foot">
          <form className="mt-compose" onSubmit={(e) => e.preventDefault()}>
            <input placeholder="Nhắn cho cả lớp" aria-label="Nhắn cho cả lớp" />
            <button type="submit" aria-label="Gửi"><Icon name="send" size={18} /></button>
          </form>
        </div>
      )}
    </aside>
  );
}
