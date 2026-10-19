'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { people, session, waiting } from './data';
import { Icon } from '@/components/meet/icons';
import { RecordDialog, SettingsDialog } from './Modals';
import { Panel, PanelId } from './Panels';
import { BoardLayout, GridLayout, ScreenLayout, SpeakerLayout } from './Tiles';

export type Layout = 'grid' | 'speaker' | 'screen' | 'board';
type Modal = 'settings' | 'record' | null;
type Menu = 'more' | 'react' | null;

const PANELS: PanelId[] = ['people', 'chat', 'quiz', 'breakout', 'files', 'activities', 'info'];

function useClock() {
  const [now, setNow] = useState<string>('14:32');
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Màn hình phòng học kiểu Google Meet. Trạng thái ban đầu lấy từ tham số URL để chia sẻ đúng màn hình. */
export function Room(props: { layout?: string; panel?: string; modal?: string; menu?: string }) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>((['grid', 'speaker', 'screen', 'board'] as const).find((l) => l === props.layout) ?? 'grid');
  const [panel, setPanel] = useState<PanelId | null>(PANELS.find((p) => p === props.panel) ?? null);
  const [modal, setModal] = useState<Modal>(props.modal === 'settings' || props.modal === 'record' ? props.modal : null);
  const [menu, setMenu] = useState<Menu>(props.menu === 'more' || props.menu === 'react' ? props.menu : null);
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(true);
  const [hand, setHand] = useState(false);
  const [recording, setRecording] = useState(true);
  const [color, setColor] = useState('white');
  const [emoji, setEmoji] = useState<string | null>(props.menu === 'react' ? '👏' : null);
  const clock = useClock();
  const me = { mic, cam };
  const hands = people.filter((p) => p.hand).length + (hand ? 1 : 0);

  const toggle = useCallback((p: PanelId) => setPanel((cur) => (cur === p ? null : p)), []);
  const closeModal = useCallback(() => setModal(null), []);
  const open = (p: PanelId | 'record') => (p === 'record' ? setModal('record') : setPanel(p));

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <div className="mt mt-room">
      <header className="mt-top">
        <div className="mt-top__title">
          <b>{session.course} · {session.title}</b>
          <span>{session.time}</span>
        </div>
        <span className="mt-top__grow" />
        {recording && <span className="mt-pill mt-pill--rec"><i /> Đang ghi</span>}
        {layout === 'screen' && <span className="mt-pill mt-pill--live mt-hide-sm"><Icon name="screen" size={14} /> Đang trình bày</span>}
        <span className="mt-pill mt-pill--count"><Icon name="people" size={15} /> {people.length}</span>
      </header>

      <div className="mt-body">
        <main className="mt-stage" aria-label="Màn hình lớp học">
          {layout === 'grid' && <GridLayout me={me} />}
          {layout === 'speaker' && <SpeakerLayout me={me} />}
          {layout === 'screen' && <ScreenLayout me={me} />}
          {layout === 'board' && <BoardLayout me={me} color={color} setColor={setColor} />}
          <div className="mt-toasts" aria-live="polite">
            <div className="mt-toast"><Icon name="hand" size={18} /><span><b>Quốc Bảo</b> đang giơ tay</span></div>
            <div className="mt-toast">
              <Icon name="people" size={18} />
              <span><b>{waiting.length} người</b> muốn vào lớp</span>
              <button type="button" className="mt-pbtn mt-pbtn--sm" onClick={() => setPanel('people')}>Xem</button>
            </div>
          </div>
          {emoji && <span className="mt-float-emoji" aria-hidden>{emoji}</span>}
        </main>
        {panel && <Panel id={panel} onClose={() => setPanel(null)} open={open} />}
      </div>

      <footer className="mt-controls">
        <div className="mt-controls__left">
          <span>{clock}</span>
          <i aria-hidden />
          <span>{session.title}</span>
        </div>

        <div className="mt-controls__mid" style={{ position: 'relative' }}>
          <button type="button" className={`mt-cbtn${mic ? '' : ' mt-cbtn--off'}`} aria-pressed={mic} aria-label={mic ? 'Tắt micro' : 'Bật micro'} title={mic ? 'Tắt micro (Ctrl + D)' : 'Bật micro (Ctrl + D)'} onClick={() => setMic(!mic)}>
            <Icon name={mic ? 'mic' : 'mic-off'} />
          </button>
          <button type="button" className={`mt-cbtn${cam ? '' : ' mt-cbtn--off'}`} aria-pressed={cam} aria-label={cam ? 'Tắt camera' : 'Bật camera'} title={cam ? 'Tắt camera (Ctrl + E)' : 'Bật camera (Ctrl + E)'} onClick={() => setCam(!cam)}>
            <Icon name={cam ? 'cam' : 'cam-off'} />
          </button>
          <button type="button" className={`mt-cbtn mt-hide-sm${layout === 'screen' ? ' mt-cbtn--on' : ''}`} aria-pressed={layout === 'screen'} aria-label="Chia sẻ màn hình" title="Chia sẻ màn hình" onClick={() => setLayout(layout === 'screen' ? 'grid' : 'screen')}>
            <Icon name="screen" />
          </button>
          <button type="button" className={`mt-cbtn${hand ? ' mt-cbtn--on' : ''}`} aria-pressed={hand} aria-label={hand ? 'Hạ tay' : 'Giơ tay'} title={hand ? 'Hạ tay' : 'Giơ tay'} onClick={() => setHand(!hand)}>
            <Icon name="hand" />
          </button>
          <button type="button" className={`mt-cbtn mt-hide-sm${menu === 'react' ? ' mt-cbtn--on' : ''}`} aria-expanded={menu === 'react'} aria-label="Thả cảm xúc" title="Thả cảm xúc" onClick={() => setMenu(menu === 'react' ? null : 'react')}>
            <Icon name="smile" />
          </button>
          <button type="button" className={`mt-cbtn mt-hide-sm${layout === 'board' ? ' mt-cbtn--on' : ''}`} aria-pressed={layout === 'board'} aria-label="Bảng trắng" title="Bảng trắng" onClick={() => setLayout(layout === 'board' ? 'grid' : 'board')}>
            <Icon name="board" />
          </button>
          <button type="button" className={`mt-cbtn${menu === 'more' ? ' mt-cbtn--on' : ''}`} aria-expanded={menu === 'more'} aria-haspopup="menu" aria-label="Thêm tuỳ chọn" title="Thêm tuỳ chọn" onClick={() => setMenu(menu === 'more' ? null : 'more')}>
            <Icon name="more" />
          </button>
          <button type="button" className="mt-cbtn mt-cbtn--leave" aria-label="Rời lớp" title="Rời lớp" onClick={() => router.push('/ui/meeting/left')}>
            <Icon name="leave" size={24} />
          </button>

          {menu === 'react' && (
            <div className="mt-reactions" role="menu" aria-label="Cảm xúc">
              {['👏', '❤️', '😂', '👍', '🎉', '🤔', '😮'].map((e) => (
                <button key={e} type="button" role="menuitem" aria-label={`Thả ${e}`} onClick={() => { setEmoji(e); setMenu(null); }}>{e}</button>
              ))}
            </div>
          )}
          {menu === 'more' && (
            <div className="mt-menu mt-menu--more" role="menu" aria-label="Thêm tuỳ chọn">
              <button type="button" role="menuitem" onClick={() => { setLayout(layout === 'grid' ? 'speaker' : 'grid'); setMenu(null); }}>
                <Icon name="layout" /> Đổi bố cục <small>{layout === 'grid' ? 'Lưới' : 'Người nói'}</small>
              </button>
              <button type="button" role="menuitem" onClick={() => { setRecording(!recording); setMenu(null); }}>
                <Icon name="record" /> {recording ? 'Dừng ghi hình' : 'Ghi hình buổi học'}
              </button>
              <button type="button" role="menuitem"><Icon name="captions" /> Bật phụ đề</button>
              <button type="button" role="menuitem"><Icon name="monitor" /> Toàn màn hình</button>
              {/* Trên điện thoại các nút ở góc phải bị ẩn: đưa vào menu này. */}
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={() => { setLayout('board'); setMenu(null); }}><Icon name="board" /> Bảng trắng</button>
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={() => { setPanel('people'); setMenu(null); }}><Icon name="people" /> Người tham gia <small>{hands} giơ tay</small></button>
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={() => { setPanel('chat'); setMenu(null); }}><Icon name="chat" /> Trò chuyện</button>
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={() => { setPanel('activities'); setMenu(null); }}><Icon name="apps" /> Hoạt động</button>
              <button type="button" role="menuitem" className="mt-hide-lg" onClick={() => { setMenu('react'); }}><Icon name="smile" /> Thả cảm xúc</button>
              <hr />
              <button type="button" role="menuitem" onClick={() => { setModal('settings'); setMenu(null); }}><Icon name="settings" /> Cài đặt</button>
              <button type="button" role="menuitem"><Icon name="info" /> Báo lỗi kết nối</button>
              <hr />
              <Link role="menuitem" href="/ui/meeting/ended"><Icon name="close" /> Kết thúc buổi học cho mọi người</Link>
            </div>
          )}
        </div>

        <div className="mt-controls__right">
          {(
            [
              ['info', 'info', 'Thông tin buổi học', 0],
              ['people', 'people', 'Người tham gia', hands],
              ['chat', 'chat', 'Trò chuyện', 3],
              ['activities', 'apps', 'Hoạt động', 0],
            ] as const
          ).map(([id, icon, label, badge]) => (
            <button key={id} type="button" className="mt-ibtn" aria-pressed={panel === id} aria-label={label} title={label} onClick={() => toggle(id)}>
              <Icon name={icon} />
              {badge > 0 && <span className="mt-cbtn__badge">{badge}</span>}
            </button>
          ))}
        </div>
      </footer>

      {modal === 'settings' && <SettingsDialog onClose={closeModal} />}
      {modal === 'record' && <RecordDialog onClose={closeModal} onStart={() => { setRecording(true); closeModal(); }} />}
    </div>
  );
}
