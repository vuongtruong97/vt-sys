'use client';
import type { LocalVideoTrack } from 'livekit-client';
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/meet/Dialog';
import { Icon } from '@/components/meet/icons';
import {
  applyEffect,
  backgroundsSupported,
  loadCustomImage,
  PRESETS,
  sameEffect,
  saveCustomImage,
  useVideoEffect,
  VideoEffect,
} from '@/lib/videoEffect';

function Tile(props: { value: VideoEffect; label: string; current: VideoEffect; disabled: boolean; onPick: (e: VideoEffect) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="mt-bg-tile"
      aria-pressed={sameEffect(props.current, props.value)}
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={() => props.onPick(props.value)}
    >
      {props.children}
    </button>
  );
}

/** Dùng chung cho nút ✨ ở màn xem trước và mục "Phông nền" trong phòng: true khi trình duyệt làm được phông nền. */
export function useBackgroundsSupported() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    backgroundsSupported().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

/**
 * Hộp thoại chọn phông nền: xem trước camera của mình, chọn làm mờ, ảnh có sẵn hoặc ảnh tải từ máy.
 * Chọn là áp ngay; lựa chọn được nhớ cho lần sau (localStorage).
 */
export function BackgroundPicker({ track, onClose }: { track: LocalVideoTrack | undefined; onClose: () => void }) {
  const [effect, setEffect] = useVideoEffect();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCustom(loadCustomImage());
    backgroundsSupported().then(setSupported);
  }, []);

  // Xem trước: gắn thêm một thẻ video vào track (khung hình trong phòng vẫn chạy bình thường).
  useEffect(() => {
    const el = video.current;
    if (!track || !el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  const pick = async (e: VideoEffect) => {
    setError('');
    setEffect(e);
    if (!track) return;
    setBusy(true);
    try {
      await applyEffect(track, e);
    } catch {
      setError('Không áp được hiệu ứng trên máy này. Thử làm mờ, hoặc tắt hiệu ứng.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setError('');
    try {
      setCustom(await saveCustomImage(f));
      await pick({ kind: 'image', id: 'custom' });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const tile = { current: effect, disabled: false, onPick: pick };

  return (
    <Dialog
      title="Phông nền"
      onClose={onClose}
      footer={
        <button type="button" className="mt-pbtn" onClick={onClose}>
          Xong
        </button>
      }
    >
      <div className="mt-bg">
        <div className="mt-preview mt-bg__preview">
          {track ? (
            <video ref={video} className="mt-flip" muted playsInline autoPlay />
          ) : (
            <div className="mt-prev__off">
              <Icon name="cam-off" size={30} />
              Bật camera để xem trước phông nền
            </div>
          )}
          {busy && <span className="mt-bg__status" role="status">Đang chuẩn bị hiệu ứng…</span>}
        </div>

        {supported === false ? (
          <p className="mt-muted">Trình duyệt này chưa làm được phông nền. Dùng Chrome, Edge hoặc Firefox bản mới trên máy tính.</p>
        ) : (
          <>
            {error && <p className="mt-error" role="alert">{error}</p>}
            <div className="mt-bg__group" role="group" aria-label="Làm mờ">
              <Tile {...tile} value={{ kind: 'none' }} label="Không dùng hiệu ứng">
                <Icon name="x" />
              </Tile>
              <Tile {...tile} value={{ kind: 'blur', strength: 'light' }} label="Làm mờ nhẹ">
                <span className="mt-bg__blur mt-bg__blur--light" aria-hidden />
              </Tile>
              <Tile {...tile} value={{ kind: 'blur', strength: 'strong' }} label="Làm mờ mạnh">
                <span className="mt-bg__blur mt-bg__blur--strong" aria-hidden />
              </Tile>
            </div>
            <h3 className="mt-bg__heading">Ảnh nền</h3>
            <div className="mt-bg__group" role="group" aria-label="Ảnh nền">
              {PRESETS.map((p) => (
                <Tile {...tile} key={p.id} value={{ kind: 'image', id: p.id }} label={p.label}>
                  <img src={p.src} alt="" />
                </Tile>
              ))}
              {custom && (
                <Tile {...tile} value={{ kind: 'image', id: 'custom' }} label="Ảnh của bạn">
                  <img src={custom} alt="" />
                </Tile>
              )}
              <button type="button" className="mt-bg-tile mt-bg-tile--add" disabled={busy} onClick={() => file.current?.click()}>
                <Icon name="upload" />
                <span>{custom ? 'Đổi ảnh' : 'Tải ảnh lên'}</span>
              </button>
              <input ref={file} type="file" accept="image/*" hidden onChange={upload} />
            </div>
            <p className="mt-muted">Ảnh tải lên chỉ lưu trên trình duyệt này, không gửi lên máy chủ. Máy yếu có thể nóng hoặc giật khi dùng hiệu ứng.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
