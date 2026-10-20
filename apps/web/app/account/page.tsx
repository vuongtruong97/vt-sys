'use client';
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { AvatarEditor } from '@/components/AvatarEditor';
import { Nav } from '@/components/Nav';
import { Alert, Avatar, Button, Card, Input, Muted, Page, PageHeader, Section, Tabs, Textarea } from '@/components/ui';
import { api, Me } from '@/lib/api';
import { useMe } from '@/lib/useMe';

type Profile = { name: string; email: string; phone: string | null; bio: string; birthday: string | null; avatarUrl: string | null };

const BIO_MAX = 500;
const today = () => new Date().toISOString().slice(0, 10);

function ProfileTab({ me, onChanged }: { me: Me; onChanged: (patch: Partial<Me>) => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', bio: '', birthday: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Profile>('/me/profile')
      .then((d) => {
        setP(d);
        setForm({ name: d.name, phone: d.phone ?? '', bio: d.bio, birthday: d.birthday ?? '' });
      })
      .catch((e) => setError(e.message));
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    try {
      const d = await api<Profile>('/me/profile', { method: 'PATCH', json: form });
      setP(d);
      onChanged({ name: d.name });
      setDone('Đã lưu hồ sơ');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (f: File | undefined | null) => {
    setError('');
    setDone('');
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setError('Chọn ảnh JPEG, PNG hoặc WebP');
    if (f.size > 15 * 1024 * 1024) return setError('Ảnh quá lớn (tối đa 15 MB trước khi cắt)');
    setFile(f);
  };

  const upload = async (blob: Blob) => {
    const fd = new FormData();
    fd.append('file', blob, blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg');
    const r = await api<{ avatarUrl: string }>('/me/avatar', { method: 'PUT', body: fd });
    setP((x) => x && { ...x, avatarUrl: r.avatarUrl });
    onChanged({ avatarUrl: r.avatarUrl });
    setFile(null);
    setDone('Đã cập nhật ảnh đại diện');
  };

  const removeAvatar = async () => {
    if (!window.confirm('Xoá ảnh đại diện? Mọi nơi sẽ hiện chữ cái đầu của tên bạn.')) return;
    try {
      await api('/me/avatar', { method: 'DELETE' });
      setP((x) => x && { ...x, avatarUrl: null });
      onChanged({ avatarUrl: null });
      setDone('Đã xoá ảnh đại diện');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  if (!p) return error ? <Alert tone="error">{error}</Alert> : <Muted>Đang tải…</Muted>;

  return (
    <div className="profile">
      <Card padded>
        <div
          className={`profile__photo${dragOver ? ' is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <Avatar name={form.name || me.name} src={p.avatarUrl} size={128} decorative />
          <div className="profile__photo-actions">
            <Button onClick={() => input.current?.click()}>{p.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}</Button>
            {p.avatarUrl && (
              <Button variant="ghost" onClick={removeAvatar}>
                Xoá ảnh
              </Button>
            )}
          </div>
          <Muted small>Kéo thả ảnh vào đây hoặc bấm nút. JPEG, PNG, WebP; ảnh được cắt vuông trước khi lưu.</Muted>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card padded>
        <form className="ui-form" onSubmit={save}>
          <Input label="Họ và tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={80} autoComplete="name" />
          <Input label="Email" value={p.email} readOnly hint="Email dùng để đăng nhập, chưa đổi được." />
          <div className="ui-form-row">
            <Input
              label="Số điện thoại"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0912 345 678"
              autoComplete="tel"
              maxLength={20}
              hint="Chỉ giáo viên của khoá bạn học và quản trị viên thấy."
            />
            <Input label="Ngày sinh" type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} max={today()} min="1900-01-01" />
          </div>
          <Textarea
            label="Giới thiệu ngắn"
            rows={4}
            value={form.bio}
            maxLength={BIO_MAX}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Vài dòng về bạn: đang học gì, mục tiêu khi tham gia lớp…"
            hint={`${form.bio.length}/${BIO_MAX} ký tự`}
          />
          {error && <Alert tone="error">{error}</Alert>}
          {done && <Alert tone="success">{done}</Alert>}
          <div className="ui-actions">
            <Button type="submit" loading={busy}>
              Lưu hồ sơ
            </Button>
          </div>
        </form>
      </Card>

      <AvatarEditor file={file} onCancel={() => setFile(null)} onSave={upload} />
    </div>
  );
}

function SecurityTab() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [methods, setMethods] = useState<{ hasPassword: boolean; google: boolean } | null>(null);

  useEffect(() => {
    api<{ hasPassword: boolean; google: boolean }>('/auth/methods').then(setMethods).catch(() => {});
  }, []);
  // Tài khoản tạo bằng Google chưa có mật khẩu: đặt lần đầu, không hỏi mật khẩu hiện tại.
  const firstPassword = methods?.hasPassword === false;

  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError('');
    setDone('');
    if (f.get('newPassword') !== f.get('confirm')) {
      setError('Hai lần nhập mật khẩu mới không khớp');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password', {
        json: { ...(firstPassword ? {} : { currentPassword: f.get('currentPassword') }), newPassword: f.get('newPassword') },
      });
      form.reset();
      setDone(firstPassword ? 'Đã đặt mật khẩu. Giờ bạn đăng nhập được bằng email và mật khẩu.' : 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.');
      if (firstPassword) setMethods((m) => m && { ...m, hasPassword: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logoutAll = async () => {
    if (!window.confirm('Đăng xuất khỏi mọi thiết bị, kể cả máy này?')) return;
    try {
      await api('/auth/logout-all', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      {methods && (
        <Muted small>Đăng nhập bằng: {[methods.hasPassword && 'email và mật khẩu', methods.google && 'Google'].filter(Boolean).join(', ')}</Muted>
      )}
      <Section title={firstPassword ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}>
        <Card padded>
          <form className="ui-form" onSubmit={changePassword}>
            {firstPassword ? (
              <Muted small>Tài khoản này tạo bằng Google. Đặt mật khẩu nếu muốn đăng nhập thêm bằng email.</Muted>
            ) : (
              <Input label="Mật khẩu hiện tại" name="currentPassword" type="password" required autoComplete="current-password" />
            )}
            <Input label="Mật khẩu mới" hint="Ít nhất 8 ký tự" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
            <Input label="Nhập lại mật khẩu mới" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            {error && <Alert tone="error">{error}</Alert>}
            {done && <Alert tone="success">{done}</Alert>}
            <div className="ui-actions">
              <Button type="submit" loading={busy}>
                {firstPassword ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}
              </Button>
            </div>
          </form>
        </Card>
      </Section>

      <Section title="Phiên đăng nhập">
        <Card padded className="ui-form">
          <Muted small>Quên đăng xuất ở máy khác, hoặc nghi lộ tài khoản? Đăng xuất khỏi mọi thiết bị rồi đăng nhập lại.</Muted>
          <div className="ui-actions">
            <Button variant="outline" onClick={logoutAll}>
              Đăng xuất khỏi mọi thiết bị
            </Button>
          </div>
        </Card>
      </Section>
    </>
  );
}

/** Hồ sơ cá nhân (ảnh đại diện, thông tin) và bảo mật (mật khẩu, phiên đăng nhập). */
export default function AccountPage() {
  const me = useMe({ redirect: true });
  // Bản sao để thanh điều hướng đổi ngay khi lưu tên / ảnh, không cần tải lại trang.
  const [patch, setPatch] = useState<Partial<Me>>({});
  const current = me ? { ...me, ...patch } : me;

  return (
    <>
      <Nav me={current} />
      <Page narrow>
        <PageHeader title="Hồ sơ" description={current && `${current.name} · ${current.email} · ${current.role.name}`} />
        {current && (
          <Tabs
            label="Hồ sơ và bảo mật"
            items={[
              { id: 'profile', label: 'Hồ sơ', content: <ProfileTab me={current} onChanged={(p) => setPatch((x) => ({ ...x, ...p }))} /> },
              { id: 'security', label: 'Bảo mật', content: <SecurityTab /> },
            ]}
          />
        )}
      </Page>
    </>
  );
}
