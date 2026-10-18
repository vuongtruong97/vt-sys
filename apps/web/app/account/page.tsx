'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Alert, Button, Card, Input, Muted, Page, PageHeader, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/useMe';

export default function AccountPage() {
  const me = useMe({ redirect: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [methods, setMethods] = useState<{ hasPassword: boolean; google: boolean } | null>(null);

  useEffect(() => {
    if (me) api<{ hasPassword: boolean; google: boolean }>('/auth/methods').then(setMethods).catch(() => {});
  }, [me]);
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
      <Nav me={me} />
      <Page narrow>
        <PageHeader
          title="Tài khoản"
          description={
            me && (
              <>
                {me.name} · {me.email}
                {methods && (
                  <>
                    <br />
                    Đăng nhập bằng: {[methods.hasPassword && 'email và mật khẩu', methods.google && 'Google'].filter(Boolean).join(', ')}
                  </>
                )}
              </>
            )
          }
        />

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
      </Page>
    </>
  );
}
