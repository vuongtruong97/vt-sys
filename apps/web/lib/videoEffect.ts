'use client';
import type { BackgroundProcessorWrapper, SwitchBackgroundProcessorOptions } from '@livekit/track-processors';
import type { LocalVideoTrack } from 'livekit-client';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Phông nền camera: làm mờ hoặc thay bằng ảnh (MediaPipe qua @livekit/track-processors).
 * Lựa chọn và ảnh tự chọn chỉ lưu trong localStorage của trình duyệt, không gửi lên máy chủ.
 */
export type VideoEffect =
  | { kind: 'none' }
  | { kind: 'blur'; strength: 'light' | 'strong' }
  /** id của ảnh có sẵn, hoặc 'custom' là ảnh người dùng tải lên. */
  | { kind: 'image'; id: string };

export const PRESETS = [
  { id: 'lavender', label: 'Tím nhạt', src: '/backgrounds/lavender.svg' },
  { id: 'chalkboard', label: 'Bảng phấn', src: '/backgrounds/chalkboard.svg' },
  { id: 'classroom', label: 'Phòng học', src: '/backgrounds/classroom.svg' },
  { id: 'sky', label: 'Bầu trời', src: '/backgrounds/sky.svg' },
  { id: 'night', label: 'Đêm', src: '/backgrounds/night.svg' },
] as const;

const BLUR = { light: 8, strong: 20 } as const;
const EFFECT_KEY = 'bd-video-effect';
const CUSTOM_KEY = 'bd-video-bg-custom';
const CHANGE = 'bd-video-effect-change';
const NONE: VideoEffect = { kind: 'none' };

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

function parseEffect(raw: string | null): VideoEffect {
  try {
    const e = raw ? JSON.parse(raw) : null;
    if (e?.kind === 'blur' && (e.strength === 'light' || e.strength === 'strong')) return { kind: 'blur', strength: e.strength };
    if (e?.kind === 'image' && typeof e.id === 'string') {
      if (e.id === 'custom' ? read(CUSTOM_KEY) : PRESETS.some((p) => p.id === e.id)) return { kind: 'image', id: e.id };
    }
  } catch {
    /* giá trị hỏng: coi như không có hiệu ứng */
  }
  return NONE;
}

/** Ảnh nền của hiệu ứng, hoặc null nếu không phải hiệu ứng ảnh. */
export function imageOf(effect: VideoEffect): string | null {
  if (effect.kind !== 'image') return null;
  if (effect.id === 'custom') return read(CUSTOM_KEY);
  return PRESETS.find((p) => p.id === effect.id)?.src ?? null;
}

export const sameEffect = (a: VideoEffect, b: VideoEffect) => JSON.stringify(a) === JSON.stringify(b);

// ----- Lưu lựa chọn, đồng bộ giữa các component trong trang -----

let cachedRaw: string | null | undefined;
let cached: VideoEffect = NONE;
function snapshot(): VideoEffect {
  const raw = read(EFFECT_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseEffect(raw);
  }
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener('storage', cb);
  };
}

export function saveEffect(effect: VideoEffect) {
  try {
    localStorage.setItem(EFFECT_KEY, JSON.stringify(effect));
  } catch {
    /* chế độ ẩn danh chặn localStorage: vẫn áp hiệu ứng, chỉ không nhớ */
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Hiệu ứng đang chọn, dùng chung cho màn xem trước, phòng học và hộp thoại chọn phông nền. */
export function useVideoEffect(): [VideoEffect, (e: VideoEffect) => void] {
  const effect = useSyncExternalStore(subscribe, snapshot, () => NONE);
  return [effect, useCallback((e: VideoEffect) => saveEffect(e), [])];
}

export const loadCustomImage = () => read(CUSTOM_KEY);

/** Thu nhỏ ảnh về tối đa 1280×720, lưu dạng JPEG trong localStorage. Trả về data URL. */
export async function saveCustomImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Chỉ chọn được tệp ảnh (JPG, PNG, WebP)');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh này, thử ảnh khác');
  }
  const scale = Math.min(1, 1280 / bitmap.width, 720 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  try {
    localStorage.setItem(CUSTOM_KEY, url);
  } catch {
    throw new Error('Trình duyệt không cho lưu ảnh (bộ nhớ đầy hoặc đang ở chế độ ẩn danh)');
  }
  return url;
}

// ----- Áp hiệu ứng lên track camera -----

type Lib = typeof import('@livekit/track-processors');
let lib: Promise<Lib> | null = null;
/** Tải thư viện khi cần, để các trang không dùng camera không phải tải MediaPipe. */
const loadLib = () => (lib ??= import('@livekit/track-processors'));

/** Trình duyệt có làm được phông nền không (cần WebGL và Insertable Streams hoặc OffscreenCanvas). */
export async function backgroundsSupported(): Promise<boolean> {
  try {
    return (await loadLib()).supportsBackgroundProcessors();
  } catch {
    return false;
  }
}

const toOptions = (effect: VideoEffect): SwitchBackgroundProcessorOptions | null => {
  if (effect.kind === 'blur') return { mode: 'background-blur', blurRadius: BLUR[effect.strength] };
  const src = imageOf(effect);
  return src ? { mode: 'virtual-background', imagePath: src } : null;
};

/** Mỗi track một hàng đợi: đổi hiệu ứng liên tục không chạy chồng lên nhau. */
const queues = new WeakMap<LocalVideoTrack, Promise<unknown>>();
const applied = new WeakMap<LocalVideoTrack, string>();

/**
 * Áp hiệu ứng lên track camera của mình. Gọi lại với cùng hiệu ứng thì bỏ qua.
 * Track mới (bật lại camera) cần gọi lại vì processor gắn theo track.
 */
export function applyEffect(track: LocalVideoTrack, effect: VideoEffect): Promise<void> {
  const key = JSON.stringify([effect, imageOf(effect)]);
  const run = async () => {
    if (applied.get(track) === key) return;
    const options = toOptions(effect);
    const current = track.getProcessor() as BackgroundProcessorWrapper | undefined;
    if (!options) {
      if (current) await track.stopProcessor();
    } else {
      const { BackgroundProcessor, supportsBackgroundProcessors } = await loadLib();
      if (!supportsBackgroundProcessors()) return;
      if (current && typeof current.switchTo === 'function') await current.switchTo(options);
      else await track.setProcessor(BackgroundProcessor(options, 'bd-background'));
    }
    applied.set(track, key);
  };
  const next = (queues.get(track) ?? Promise.resolve()).then(run, run);
  queues.set(track, next.catch(() => {}));
  return next;
}
