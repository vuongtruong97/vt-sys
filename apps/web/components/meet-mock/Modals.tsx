'use client';
import { useState } from 'react';
import { Dialog } from '@/components/meet/Dialog';
import { Icon, IconName } from '@/components/meet/icons';

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'audio', label: 'Âm thanh', icon: 'speaker' },
  { id: 'video', label: 'Video', icon: 'cam' },
  { id: 'layout', label: 'Bố cục', icon: 'layout' },
  { id: 'perm', label: 'Quyền học viên', icon: 'shield' },
];

function Switch({ label, on: initial = false }: { label: string; on?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="mt-switchrow">
      <span>{label}</span>
      <button type="button" className="mt-toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => setOn(!on)} />
    </div>
  );
}

const LayoutThumb = ({ kind }: { kind: 'auto' | 'grid' | 'speaker' | 'side' }) => (
  <svg viewBox="0 0 120 70" aria-hidden>
    <rect width="120" height="70" rx="6" fill="#2d3035" />
    {kind === 'grid' && [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={6 + c * 37} y={5 + r * 21} width="34" height="18" rx="3" fill="#5b6067" />))}
    {kind === 'speaker' && <rect x="6" y="5" width="108" height="60" rx="4" fill="#5b6067" />}
    {kind === 'side' && (<><rect x="6" y="5" width="78" height="60" rx="4" fill="#5b6067" />{[0, 1, 2].map((i) => <rect key={i} x="88" y={5 + i * 21} width="26" height="18" rx="3" fill="#7d838a" />)}</>)}
    {kind === 'auto' && (<><rect x="6" y="5" width="52" height="60" rx="4" fill="#5b6067" /><rect x="62" y="5" width="52" height="28" rx="4" fill="#7d838a" /><rect x="62" y="37" width="52" height="28" rx="4" fill="#7d838a" /></>)}
  </svg>
);

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('audio');
  const [layout, setLayout] = useState('auto');
  return (
    <Dialog title="Cài đặt" onClose={onClose}>
      <div className="mt-settings">
        <div className="mt-settings__nav" role="tablist" aria-label="Nhóm cài đặt">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={19} /> {t.label}
            </button>
          ))}
        </div>
        <div className="mt-settings__pane" role="tabpanel">
          {tab === 'audio' && (
            <>
              <h3>Micro</h3>
              <select className="mt-select" aria-label="Micro"><option>Mặc định – Micro tai nghe (USB)</option><option>Micro máy tính</option></select>
              <div className="mt-meter" aria-label="Mức âm lượng micro">{Array.from({ length: 18 }, (_, i) => <i key={i} className={i < 7 ? 'on' : ''} />)}</div>
              <h3>Loa</h3>
              <div className="mt-row" style={{ flexWrap: 'nowrap' }}>
                <select className="mt-select" aria-label="Loa"><option>Mặc định – Tai nghe (USB)</option><option>Loa máy tính</option></select>
                <button type="button" className="mt-pbtn mt-pbtn--ghost">Thử</button>
              </div>
              <Switch label="Giảm tiếng ồn" on />
              <Switch label="Tự cân bằng âm lượng" on />
            </>
          )}
          {tab === 'video' && (
            <>
              <h3>Camera</h3>
              <select className="mt-select" aria-label="Camera"><option>HD Webcam 1080p</option><option>Camera tích hợp</option></select>
              <div className="mt-preview"><img src="/ui/auth-hero.jpg" alt="" /></div>
              <h3>Chất lượng gửi đi</h3>
              <select className="mt-select" aria-label="Chất lượng gửi đi" defaultValue="auto"><option value="auto">Tự động (khuyên dùng)</option><option>720p</option><option>360p (tiết kiệm mạng)</option></select>
              <Switch label="Làm mờ phông nền" />
              <Switch label="Lật hình của tôi" on />
            </>
          )}
          {tab === 'layout' && (
            <>
              <h3>Bố cục</h3>
              <div className="mt-layouts" role="radiogroup" aria-label="Bố cục">
                {([['auto', 'Tự động'], ['grid', 'Lưới'], ['speaker', 'Người nói'], ['side', 'Thanh bên']] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={layout === k} className="mt-layout-opt" onClick={() => setLayout(k)}>
                    <LayoutThumb kind={k} />
                    {l}
                  </button>
                ))}
              </div>
              <label className="mt-label">Số ô tối đa<select className="mt-select" defaultValue="16"><option>9</option><option>16</option><option>25</option><option>49</option></select></label>
              <Switch label="Ẩn ô không bật camera" />
            </>
          )}
          {tab === 'perm' && (
            <>
              <h3>Học viên được</h3>
              <Switch label="Bật micro" on />
              <Switch label="Bật camera" on />
              <Switch label="Chia sẻ màn hình" />
              <Switch label="Gửi tin nhắn" on />
              <Switch label="Thả cảm xúc" on />
              <h3>Vào lớp</h3>
              <Switch label="Người ngoài danh sách phải chờ duyệt" on />
              <Switch label="Tắt mic người mới vào" on />
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function RecordDialog({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  return (
    <Dialog
      small
      title="Bắt đầu ghi hình?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="mt-pbtn mt-pbtn--ghost" onClick={onClose}>Huỷ</button>
          <button type="button" className="mt-pbtn mt-pbtn--danger" onClick={onStart}><Icon name="record" size={17} /> Bắt đầu ghi</button>
        </>
      }
    >
      <div className="mt-info">
        <p>Mọi người trong lớp sẽ thấy biểu tượng <b style={{ color: 'var(--md-error)' }}>● Đang ghi</b>. Bản ghi lưu cùng buổi học, học viên xem lại được sau vài phút khi buổi kết thúc.</p>
        <Switch label="Ghi cả bảng trắng và màn hình chia sẻ" on />
        <Switch label="Ghi kèm phụ đề tự động" />
        <p className="mt-muted">Phòng nhóm nhỏ không được ghi lại.</p>
      </div>
    </Dialog>
  );
}
