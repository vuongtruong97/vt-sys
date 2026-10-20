'use client';
import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { people, session } from './data';
import { Icon } from '@/components/meet/icons';
import { useSite } from '@/lib/site';
import { Av } from './Tiles';

function LobbyShell({ children }: { children: ReactNode }) {
  const { brand } = useSite();
  return (
    <div className="mt mt-lobby">
      <header className="mt-lobby__top">
        <span className="mt-brand"><i>{brand.short}</i>{brand.name}</span>
        <span className="mt-muted">lananh.hv@gmail.com</span>
      </header>
      {children}
    </div>
  );
}

/** Trước khi vào lớp: xem trước camera, bật tắt mic/camera, chọn thiết bị. */
export function PreJoin() {
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(true);
  const inRoom = people.slice(0, 5);
  return (
    <LobbyShell>
      <main className="mt-lobby__main">
        <div>
          <div className="mt-prev">
            {cam ? <img src="/ui/auth-hero.jpg" alt="" style={{ transform: 'scaleX(-1)' }} /> : <div className="mt-prev__off"><Icon name="cam-off" size={34} />Camera đang tắt</div>}
            <span className="mt-prev__name">Lan Anh</span>
            <div className="mt-prev__ctrls">
              <button type="button" className={`mt-cbtn${mic ? '' : ' mt-cbtn--off'}`} aria-pressed={mic} aria-label={mic ? 'Tắt micro' : 'Bật micro'} onClick={() => setMic(!mic)}><Icon name={mic ? 'mic' : 'mic-off'} /></button>
              <button type="button" className={`mt-cbtn${cam ? '' : ' mt-cbtn--off'}`} aria-pressed={cam} aria-label={cam ? 'Tắt camera' : 'Bật camera'} onClick={() => setCam(!cam)}><Icon name={cam ? 'cam' : 'cam-off'} /></button>
            </div>
            <div className="mt-prev__fx"><button type="button" className="mt-cbtn" aria-label="Hiệu ứng phông nền"><Icon name="spark" size={20} /></button></div>
          </div>
          <div className="mt-devices">
            <span className="mt-device"><Icon name="mic" size={17} /><span>Micro tai nghe (USB)</span></span>
            <span className="mt-device"><Icon name="speaker" size={17} /><span>Tai nghe (USB)</span></span>
            <span className="mt-device"><Icon name="cam" size={17} /><span>HD Webcam 1080p</span></span>
          </div>
        </div>

        <div className="mt-join">
          <span className="mt-muted">{session.course} · {session.time}</span>
          <h1>Sẵn sàng vào lớp?</h1>
          <div className="mt-row" style={{ justifyContent: 'center' }}>
            <span className="mt-faces">{inRoom.map((p) => <Av key={p.id} p={p} />)}</span>
            <p>Cô Linh và {people.length - 1} bạn khác đang trong lớp</p>
          </div>
          <div className="mt-row" style={{ justifyContent: 'center' }}>
            <Link className="mt-pbtn" href="/ui/meeting/room?layout=grid">Vào lớp</Link>
            <button type="button" className="mt-pbtn mt-pbtn--ghost"><Icon name="screen" size={18} /> Chỉ trình bày</button>
          </div>
          <div className="mt-checks" aria-label="Kiểm tra trước khi vào">
            <div className="ok"><Icon name="check" size={18} /> Mạng ổn định (42 ms)</div>
            <div className={mic ? 'ok' : 'warn'}><Icon name={mic ? 'check' : 'mic-off'} size={18} /> {mic ? 'Micro hoạt động' : 'Micro đang tắt, bật khi được mời phát biểu'}</div>
            <div className={cam ? 'ok' : 'warn'}><Icon name={cam ? 'check' : 'cam-off'} size={18} /> {cam ? 'Camera hoạt động' : 'Camera đang tắt'}</div>
          </div>
          <p className="mt-muted" style={{ fontSize: 13 }}>Lớp mở cửa từ 10 phút trước giờ học. Điểm danh tự động khi bạn vào lớp.</p>
        </div>
      </main>
    </LobbyShell>
  );
}

/** Chưa có trong danh sách lớp: chờ giáo viên duyệt. */
export function Waiting() {
  return (
    <LobbyShell>
      <div className="mt-center">
        <div className="mt-endcard">
          <div className="mt-spinner" role="status" aria-label="Đang chờ" />
          <h1>Đang chờ giáo viên cho vào</h1>
          <p>Bạn chưa có trong danh sách lớp <b>{session.course}</b>. Cô Linh đã nhận được yêu cầu của bạn; trang tự vào lớp khi được duyệt.</p>
          <div className="mt-checks">
            <div className="ok"><Icon name="check" size={18} /> Đã gửi yêu cầu lúc 14:03</div>
            <div><Icon name="clock" size={18} /> Thường được duyệt trong vòng 1 phút</div>
          </div>
          <div className="mt-row" style={{ justifyContent: 'center' }}>
            <Link className="mt-pbtn mt-pbtn--ghost" href="/ui/meeting/prejoin">Huỷ yêu cầu</Link>
            <Link className="mt-pbtn" href="/ui/meeting/room">Xem khi được duyệt</Link>
          </div>
        </div>
      </div>
    </LobbyShell>
  );
}

/** Đã rời lớp: vào lại, đánh giá, tóm tắt. */
export function Left() {
  const [stars, setStars] = useState(0);
  return (
    <LobbyShell>
      <div className="mt-center">
        <div className="mt-endcard">
          <h1>Bạn đã rời lớp</h1>
          <p>Điểm danh đã được ghi lại. Buổi học vẫn đang diễn ra, bạn có thể vào lại bất cứ lúc nào.</p>
          <div className="mt-row" style={{ justifyContent: 'center' }}>
            <Link className="mt-pbtn" href="/ui/meeting/room">Vào lại lớp</Link>
            <Link className="mt-pbtn mt-pbtn--ghost" href="/schedule">Về lịch học</Link>
          </div>
          <div className="mt-summary">
            <div><b>48 phút</b><small>đã học</small></div>
            <div><b>3/3</b><small>câu hỏi đúng</small></div>
            <div><b>12</b><small>tin nhắn</small></div>
          </div>
          <div className="mt-rate">
            <b>Buổi học hôm nay thế nào?</b>
            <div className="mt-stars" role="group" aria-label="Đánh giá buổi học">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={n <= stars} aria-label={`${n} sao`} onClick={() => setStars(n)}><Icon name="star" size={28} /></button>
              ))}
            </div>
            {stars > 0 && <span className="mt-muted">Cảm ơn bạn! Giáo viên sẽ xem góp ý sau buổi học.</span>}
          </div>
        </div>
      </div>
    </LobbyShell>
  );
}

/** Giáo viên kết thúc buổi học. */
export function Ended() {
  return (
    <LobbyShell>
      <div className="mt-center">
        <div className="mt-endcard">
          <span className="mt-act__ic" style={{ color: 'var(--md-on-secondary-container)', background: 'var(--md-secondary-container)', width: 64, height: 64, borderRadius: 20 }}><Icon name="check" size={32} /></span>
          <h1>Buổi học đã kết thúc</h1>
          <p>Cô Linh đã kết thúc <b>{session.title}</b>. Bản ghi hình và tài liệu sẽ có trong mục Xem lại sau vài phút.</p>
          <div className="mt-row" style={{ justifyContent: 'center' }}>
            <Link className="mt-pbtn" href="/schedule">Xem lại buổi học</Link>
            <Link className="mt-pbtn mt-pbtn--ghost" href="/schedule">Lịch học tiếp theo</Link>
          </div>
          <div className="mt-checks">
            <div className="ok"><Icon name="record" size={18} /> Bản ghi đang xử lý (khoảng 5 phút)</div>
            <div className="ok"><Icon name="files" size={18} /> 3 tài liệu của buổi học</div>
            <div><Icon name="clock" size={18} /> Buổi tới: Thứ Tư 21/10, 14:00</div>
          </div>
        </div>
      </div>
    </LobbyShell>
  );
}
