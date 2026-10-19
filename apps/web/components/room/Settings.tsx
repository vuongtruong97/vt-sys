'use client';
import { useMediaDeviceSelect } from '@livekit/components-react';
import { useState } from 'react';
import { Dialog } from '@/components/meet/Dialog';
import { Icon, IconName } from '@/components/meet/icons';

function DeviceSelect({ kind, label }: { kind: MediaDeviceKind; label: string }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: false });
  const [error, setError] = useState('');
  return (
    <label className="mt-label">
      {label}
      <select
        className="mt-select"
        value={activeDeviceId}
        onChange={(e) => {
          setError('');
          setActiveMediaDevice(e.target.value).catch(() => setError('Không chuyển được sang thiết bị này'));
        }}
      >
        {devices.length === 0 && <option value="">Chưa tìm thấy thiết bị (hãy cho phép trình duyệt dùng thiết bị)</option>}
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
      {error && <span style={{ color: 'var(--md-error)' }}>{error}</span>}
    </label>
  );
}

const TABS: { id: 'audio' | 'video'; label: string; icon: IconName }[] = [
  { id: 'audio', label: 'Âm thanh', icon: 'speaker' },
  { id: 'video', label: 'Video', icon: 'cam' },
];

/** Cài đặt thiết bị trong phòng học: đổi micro, loa, camera ngay khi đang học. */
export function SettingsDialog({ onClose, onBackground }: { onClose: () => void; /** Mở hộp chọn phông nền; không có khi trình duyệt không hỗ trợ. */ onBackground?: () => void }) {
  const [tab, setTab] = useState<'audio' | 'video'>('audio');
  // Trình duyệt Safari, Firefox chưa cho chọn loa (setSinkId).
  const canPickSpeaker = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
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
          {tab === 'audio' ? (
            <>
              <DeviceSelect kind="audioinput" label="Micro" />
              {canPickSpeaker ? (
                <DeviceSelect kind="audiooutput" label="Loa" />
              ) : (
                <p className="mt-muted">Trình duyệt này chưa cho chọn loa; âm thanh phát qua loa mặc định của máy.</p>
              )}
              <p className="mt-muted">Nên dùng tai nghe để tránh tiếng vọng. Micro tự giảm tiếng ồn.</p>
            </>
          ) : (
            <>
              <DeviceSelect kind="videoinput" label="Camera" />
              {onBackground && (
                <div>
                  <button type="button" className="mt-pbtn mt-pbtn--ghost" onClick={onBackground}>
                    <Icon name="spark" size={18} /> Đổi phông nền
                  </button>
                </div>
              )}
              <p className="mt-muted">Hình gửi đi tự điều chỉnh chất lượng theo tốc độ mạng của bạn và người xem.</p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
