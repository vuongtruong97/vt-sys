import { CSSProperties } from 'react';
import { MockPerson, people } from './data';
import { Icon } from '@/components/meet/icons';

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export function Av({ p, size }: { p: Pick<MockPerson, 'name' | 'tint'>; size?: number }) {
  return (
    <span className="mt-person__av" style={{ background: p.tint, ...(size ? { width: size, height: size } : {}) }} aria-hidden>
      {initials(p.name)}
    </span>
  );
}

/** Một ô video: ảnh giả lập camera hoặc avatar, tên, trạng thái mic, tay giơ. */
export function Tile({ p, me, cam, mic, style }: { p: MockPerson; me?: boolean; cam?: boolean; mic?: boolean; style?: CSSProperties }) {
  const camOn = cam ?? p.cam;
  const micOn = mic ?? p.mic;
  return (
    <div className={`mt-tile${p.speaking && micOn ? ' mt-tile--speaking' : ''}`} style={style}>
      {camOn && p.photo ? (
        <img className="mt-tile__video" src={p.photo} alt="" style={me ? { transform: 'scaleX(-1)' } : undefined} />
      ) : (
        <span className="mt-tile__avatar" style={{ background: p.tint }} aria-hidden>
          {initials(p.name)}
        </span>
      )}
      <div className="mt-tile__state">
        {p.hand && (
          <span className="mt-tile__badge mt-tile__badge--hand" title="Đang giơ tay">
            <Icon name="hand" size={16} />
          </span>
        )}
        {micOn ? (
          p.speaking && (
            <span className="mt-tile__badge mt-tile__badge--talk" title="Đang nói">
              <span className="mt-wave" aria-hidden><i /><i /><i /></span>
            </span>
          )
        ) : (
          <span className="mt-tile__badge" title="Đã tắt micro">
            <Icon name="mic-off" size={15} />
          </span>
        )}
      </div>
      <div className="mt-tile__name">
        {p.role === 'teacher' && <em className="mt-tag">GV</em>}
        <span>{p.name}</span>
      </div>
    </div>
  );
}

/** Số cột hợp lý cho n ô (giống Meet: 2, 3, 4 cột). */
const colsFor = (n: number) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

export function GridLayout({ me }: { me: { cam: boolean; mic: boolean } }) {
  return (
    <div className="mt-grid" style={{ '--cols': colsFor(people.length) } as CSSProperties}>
      {people.map((p) => (
        <Tile key={p.id} p={p} me={p.id === 'p-me'} cam={p.id === 'p-me' ? me.cam : undefined} mic={p.id === 'p-me' ? me.mic : undefined} />
      ))}
    </div>
  );
}

function Strip({ me, count }: { me: { cam: boolean; mic: boolean }; count: number }) {
  const rest = people.filter((p) => !p.speaking);
  return (
    <div className="mt-strip" style={{ '--rows': count + 1 } as CSSProperties}>
      {rest.slice(0, count).map((p) => (
        <Tile key={p.id} p={p} me={p.id === 'p-me'} cam={p.id === 'p-me' ? me.cam : undefined} mic={p.id === 'p-me' ? me.mic : undefined} />
      ))}
      <div className="mt-strip__more">+{rest.length - count} người khác</div>
    </div>
  );
}

export function SpeakerLayout({ me }: { me: { cam: boolean; mic: boolean } }) {
  return (
    <div className="mt-speaker">
      <Tile p={people[0]} />
      <Strip me={me} count={3} />
    </div>
  );
}

export function ScreenLayout({ me }: { me: { cam: boolean; mic: boolean } }) {
  return (
    <div className="mt-speaker">
      <div className="mt-share">
        <span className="mt-share__label">
          <Icon name="screen" size={16} /> Cô Linh đang trình bày
        </span>
        <div className="mt-slide" aria-label="Slide: Hàm trong Python">
          <div>
            <h3>Hàm trong Python</h3>
            <ul>
              <li>Định nghĩa bằng từ khoá def</li>
              <li>Tham số mặc định và tham số tên</li>
              <li>return trả về một hoặc nhiều giá trị</li>
              <li>Phạm vi biến: cục bộ và toàn cục</li>
            </ul>
          </div>
          <pre>
            <b>def</b> chao(ten, loi=<i>&quot;Xin chào&quot;</i>):{'\n'}    <b>return</b> f<i>&quot;{'{'}loi{'}'}, {'{'}ten{'}'}!&quot;</i>{'\n\n'}
            <b>def</b> tong_hieu(a, b):{'\n'}    <b>return</b> a + b, a - b{'\n\n'}
            print(chao(<i>&quot;Lan&quot;</i>)){'\n'}t, h = tong_hieu(<i>7</i>, <i>3</i>)
          </pre>
        </div>
      </div>
      <Strip me={me} count={3} />
    </div>
  );
}

const COLORS = [
  { id: 'white', label: 'Phấn trắng', c: 'var(--chalk-white, #eef2e6)' },
  { id: 'yellow', label: 'Vàng', c: 'var(--chalk-yellow, #f2d266)' },
  { id: 'pink', label: 'Hồng', c: 'var(--chalk-pink, #f1a5a0)' },
  { id: 'blue', label: 'Xanh', c: 'var(--chalk-blue, #a8d4f0)' },
];

export function BoardLayout({ me, color, setColor }: { me: { cam: boolean; mic: boolean }; color: string; setColor: (c: string) => void }) {
  return (
    <div className="mt-speaker">
      <div className="mt-board">
        <div className="mt-board__tools" role="toolbar" aria-label="Công cụ bảng trắng">
          {COLORS.map((c) => (
            <button key={c.id} type="button" aria-pressed={color === c.id} aria-label={c.label} onClick={() => setColor(c.id)}>
              <span className="mt-swatch" style={{ background: c.c }} />
            </button>
          ))}
          <button type="button" aria-pressed={color === 'eraser'} onClick={() => setColor('eraser')}>Tẩy</button>
          <button type="button">Hoàn tác</button>
          <button type="button">Xoá bảng</button>
        </div>
        <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" aria-label="Nội dung bảng trắng: ví dụ hàm tính diện tích">
          <text x="60" y="130">def dien_tich(dai, rong):</text>
          <text x="110" y="190" className="y">return dai * rong</text>
          <path d="M58 220 C 260 205, 420 232, 600 214" />
          <rect x="640" y="90" width="230" height="140" className="b" />
          <text x="720" y="270" className="y" style={{ fontSize: 22 }}>dài = 5</text>
          <text x="890" y="170" style={{ fontSize: 22 }}>3</text>
          <text x="60" y="330">dien_tich(5, 3)  →  15</text>
          <path d="M470 316 l 60 0 m -18 -14 l 18 14 l -18 14" className="p" />
          <path d="M70 420 q 40 -60 80 0 t 80 0 t 80 0" className="p" />
          <circle cx="800" cy="420" r="60" className="b" />
          <text x="760" y="430" style={{ fontSize: 22 }}>π r²</text>
        </svg>
        <span className="mt-cursor" style={{ left: '62%', top: '58%', '--c': '#f2d266' } as CSSProperties}><span>Hà My</span></span>
        <span className="mt-cursor" style={{ left: '30%', top: '76%', '--c': '#a8d4f0' } as CSSProperties}><span>Quốc Bảo</span></span>
      </div>
      <Strip me={me} count={3} />
    </div>
  );
}
