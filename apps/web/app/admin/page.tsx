'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { fmtSize } from '@/components/Materials';
import { Nav } from '@/components/Nav';
import { Alert, Avatar, Badge, Button, ButtonLink, Checkbox, Input, Modal, Muted, Page, PageHeader, Section, Select, Stat, Table, Tabs, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { can, canAdminArea } from '@/lib/can';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type RoleRef = { id: string; key: string; name: string };
type Role = RoleRef & { description: string; permissions: string[]; system: boolean; users: number };
type PermissionDef = { code: string; group: string; label: string; hint: string };
type User = { id: string; email: string; name: string; phone: string | null; avatarUrl: string | null; role: RoleRef; createdAt: string; _count: { courses: number; enrollments: number } };
type Course = {
  id: string;
  title: string;
  published: boolean;
  teacher: { id: string; name: string; email: string };
  students: number;
  sessions: number;
  nextSession: string | null;
};
type Stats = {
  users: { id: string; name: string; count: number }[];
  courses: number;
  upcomingSessions: number;
  liveSessions: number;
  recordings: { count: number; bytes: number };
};
type Draft = { id?: string; name: string; description: string; permissions: string[]; system: boolean };

export default function AdminPage() {
  const me = useMe({ redirect: true });
  const [tab, setTab] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<PermissionDef[]>([]);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const show = {
    stats: can(me, 'stats.view'),
    users: can(me, 'user.manage'),
    roles: can(me, 'role.manage', 'user.manage'),
    courses: can(me, 'course.manage_all', 'course.view_all'),
    site: can(me, 'site.manage'),
  };
  const canEditRoles = can(me, 'role.manage');
  const canTransfer = can(me, 'course.manage_all');

  const loadUsers = useCallback(
    (term = q, roleId = roleFilter) => {
      const p = new URLSearchParams();
      if (term.trim()) p.set('q', term.trim());
      if (roleId) p.set('roleId', roleId);
      return api<User[]>(`/admin/users?${p}`).then(setUsers);
    },
    [q, roleFilter],
  );

  const loadAll = useCallback(() => {
    if (!me) return Promise.resolve();
    const jobs: Promise<unknown>[] = [];
    if (can(me, 'stats.view')) jobs.push(api<Stats>('/admin/stats').then(setStats));
    if (can(me, 'user.manage')) jobs.push(loadUsers());
    if (can(me, 'role.manage', 'user.manage')) {
      jobs.push(api<Role[]>('/admin/roles').then(setRoles), api<PermissionDef[]>('/admin/permissions').then(setPerms));
    }
    if (can(me, 'course.manage_all', 'course.view_all')) jobs.push(api<Course[]>('/admin/courses').then(setCourses));
    if (can(me, 'course.manage_all')) jobs.push(api<{ id: string; name: string }[]>('/admin/teachers').then(setTeachers));
    return Promise.all(jobs).catch((e) => setError(e.message));
  }, [me, loadUsers]);

  useEffect(() => {
    if (canAdminArea(me)) loadAll();
    // Chỉ tải lần đầu; tìm kiếm tự gọi loadUsers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError('');
    setMsg('');
    try {
      await fn();
      setMsg(ok);
      await loadAll();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    loadUsers().catch((err) => setError(err.message));
  };

  const saveRole = async () => {
    if (!draft) return;
    setSaving(true);
    const body = draft.system
      ? { name: draft.name, description: draft.description }
      : { name: draft.name, description: draft.description, permissions: draft.permissions };
    const ok = await run(
      () => (draft.id ? api(`/admin/roles/${draft.id}`, { method: 'PATCH', json: body }) : api('/admin/roles', { json: body })),
      draft.id ? `Đã lưu vai trò "${draft.name}"` : `Đã tạo vai trò "${draft.name}"`,
    );
    setSaving(false);
    if (ok) setDraft(null);
  };

  if (me && !canAdminArea(me)) {
    return (
      <>
        <Nav me={me} />
        <Page>
          <Alert tone="error">Tài khoản của bạn chưa có quyền quản trị nào. Liên hệ quản trị viên nếu bạn cần.</Alert>
        </Page>
      </>
    );
  }

  const groups = Array.from(new Set(perms.map((p) => p.group)));

  const statsTab = stats && (
    <>
      <Section title="Tài khoản">
        <div className="ui-stats">
          {stats.users.map((r) => (
            <Stat key={r.id} value={r.count} label={r.name.toLowerCase()} />
          ))}
        </div>
      </Section>
      <Section title="Hoạt động">
        <div className="ui-stats">
          <Stat value={stats.courses} label="khoá học" />
          <Stat value={stats.upcomingSessions} label="buổi sắp tới" />
          <Stat value={stats.liveSessions} label="đang diễn ra" />
          <Stat value={stats.recordings.count} label={`bản ghi · ${fmtSize(stats.recordings.bytes)}`} />
        </div>
      </Section>
    </>
  );

  const usersTab = (
    <Section>
      <form className="ui-form-row" style={{ alignItems: 'end' }} onSubmit={search}>
        <Input label="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} placeholder="hocvien@gmail.com" />
        <Select
          label="Vai trò"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            loadUsers(q, e.target.value).catch((err) => setError(err.message));
          }}
          options={[{ value: '', label: 'Tất cả' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
        />
        <div className="ui-actions">
          <Button type="submit">Tìm</Button>
        </div>
      </form>
      <Muted small>Đổi vai trò có hiệu lực ngay, người đó không cần đăng nhập lại. Hiện tối đa 100 tài khoản mới nhất.</Muted>
      <Table caption="Tài khoản">
        <thead>
          <tr>
            <th>Họ tên</th>
            <th>Liên hệ</th>
            <th>Vai trò</th>
            <th>Dạy / học</th>
            <th>Tạo lúc</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id}>
              <td>
                <span className="ui-who">
                              <Avatar name={u.name} src={u.avatarUrl} size={32} decorative />
                              <span>
                                {u.name}{u.id === me?.id && ' (bạn)'}
                              </span>
                            </span>
              </td>
              <td>
                {u.email}
                {u.phone && <span className="ui-sub">{u.phone}</span>}
              </td>
              <td>
                {u.id === me?.id ? (
                  <Badge>{u.role.name}</Badge>
                ) : (
                  <select
                    aria-label={`Vai trò của ${u.name}`}
                    value={u.role.id}
                    onChange={(e) => {
                      const role = roles.find((r) => r.id === e.target.value);
                      if (!role) return;
                      if (role.key === 'admin' && !window.confirm(`Cấp vai trò quản trị viên cho ${u.name}? Người này sẽ có mọi quyền, kể cả đổi vai trò của bạn.`)) return;
                      run(() => api(`/admin/users/${u.id}`, { method: 'PATCH', json: { roleId: role.id } }), `${u.name} giờ là ${role.name.toLowerCase()}`);
                    }}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className="ui-num">
                {u._count.courses} khoá / {u._count.enrollments} khoá
              </td>
              <td className="ui-num">{fmtDay(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {users?.length === 0 && <Muted small>Không có tài khoản nào khớp.</Muted>}
    </Section>
  );

  const rolesTab = (
    <Section
      actions={
        canEditRoles && (
          <Button size="sm" onClick={() => setDraft({ name: '', description: '', permissions: [], system: false })}>
            Tạo vai trò
          </Button>
        )
      }
    >
      <Muted small>Mỗi vai trò là một tập quyền. Ba vai trò hệ thống không xoá được; quản trị viên luôn có mọi quyền.</Muted>
      <Table caption="Vai trò">
        <thead>
          <tr>
            <th>Vai trò</th>
            <th>Quyền</th>
            <th>Người dùng</th>
            {canEditRoles && <th aria-label="Thao tác" />}
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>
                <b>{r.name}</b> {r.system && <Badge variant="neutral">Hệ thống</Badge>}
                {r.description && <span className="ui-sub">{r.description}</span>}
              </td>
              <td>
                {r.key === 'admin'
                  ? 'Mọi quyền'
                  : r.permissions.length === 0
                    ? '—'
                    : r.permissions.map((p) => perms.find((x) => x.code === p)?.label ?? p).join(', ')}
              </td>
              <td className="ui-num">{r.users}</td>
              {canEditRoles && (
                <td>
                  <div className="ui-actions" style={{ justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="outline" onClick={() => setDraft({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, system: r.system })}>
                      Sửa
                    </Button>
                    {!r.system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Xoá vai trò "${r.name}"?`)) run(() => api(`/admin/roles/${r.id}`, { method: 'DELETE' }), `Đã xoá vai trò "${r.name}"`);
                        }}
                      >
                        Xoá
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );

  const coursesTab = (
    <Section>
      <Table caption="Khoá học">
        <thead>
          <tr>
            <th>Khoá học</th>
            <th>Giáo viên</th>
            <th>Học viên</th>
            <th>Buổi tiếp theo</th>
          </tr>
        </thead>
        <tbody>
          {courses?.map((c) => (
            <tr key={c.id}>
              <td>
                <a className="ui-link" href={`/teach/courses/${c.id}`}>{c.title}</a> {!c.published && <Badge variant="neutral">Ẩn</Badge>}
                <span className="ui-sub">{c.sessions} buổi</span>
              </td>
              <td>
                {canTransfer ? (
                  <select
                    aria-label={`Giáo viên của ${c.title}`}
                    value={c.teacher.id}
                    onChange={(e) => {
                      const t = teachers.find((x) => x.id === e.target.value);
                      if (!t || !window.confirm(`Chuyển khoá "${c.title}" sang ${t.name}? ${c.teacher.name} sẽ không quản lý khoá này nữa.`)) return;
                      run(() => api(`/admin/courses/${c.id}/teacher`, { method: 'PATCH', json: { teacherId: t.id } }), `Đã chuyển "${c.title}" sang ${t.name}`);
                    }}
                  >
                    {!teachers.some((t) => t.id === c.teacher.id) && <option value={c.teacher.id}>{c.teacher.name}</option>}
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  c.teacher.name
                )}
              </td>
              <td className="ui-num">{c.students}</td>
              <td className="ui-num">{c.nextSession ? `${fmtDay(c.nextSession)} ${fmtTime(c.nextSession)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {canTransfer && <Muted small>Chọn giáo viên khác để chuyển khoá, kèm toàn bộ buổi học, học viên, tài liệu và bản ghi. Chỉ hiện tài khoản có quyền dạy học.</Muted>}
    </Section>
  );

  const items = [
    show.stats && { id: 'stats', label: 'Tổng quan', content: statsTab ?? <Muted>Đang tải…</Muted> },
    show.users && { id: 'users', label: 'Tài khoản', content: usersTab },
    show.roles && { id: 'roles', label: 'Vai trò', content: rolesTab },
    show.courses && { id: 'courses', label: 'Khoá học', content: coursesTab },
    show.site && {
      id: 'site',
      label: 'Trang web',
      content: (
        <Section title="Nội dung trang web">
          <Muted>Ảnh, slider, nội dung trang chủ, tên và logo, màu chủ đạo, chân trang, SEO, trang đăng nhập. Sửa trong bản nháp, xem trước rồi mới xuất bản.</Muted>
          <div className="ui-actions"><ButtonLink href="/admin/site">Mở trình chỉnh sửa trang web</ButtonLink></div>
        </Section>
      ),
    },
  ].filter(Boolean) as { id: string; label: string; content: React.ReactNode }[];

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader title="Quản trị" description="Thống kê, tài khoản và vai trò, khoá học của mọi giáo viên." />
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        {items.length > 0 && <Tabs label="Mục quản trị" items={items} value={tab || items[0].id} onChange={setTab} />}
      </Page>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Sửa vai trò "${draft.name}"` : 'Tạo vai trò'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Huỷ</Button>
            <Button loading={saving} disabled={!draft || draft.name.trim().length < 2} onClick={saveRole}>Lưu</Button>
          </>
        }
      >
        {draft && (
          <div className="ui-form">
            <Input label="Tên vai trò" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ví dụ: Trợ giảng" maxLength={60} />
            <Textarea label="Mô tả" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Vai trò này dùng cho ai" maxLength={200} />
            {draft.system && <Alert tone="info">Đây là vai trò hệ thống: chỉ đổi được tên và mô tả. Cần bộ quyền khác thì tạo vai trò mới.</Alert>}
            {groups.map((g) => (
              <fieldset key={g} className="ui-fieldset" disabled={draft.system}>
                <legend className="ui-sub" style={{ fontWeight: 600 }}>{g}</legend>
                {perms
                  .filter((p) => p.group === g)
                  .map((p) => (
                    <Checkbox
                      key={p.code}
                      checked={roles.find((r) => r.id === draft.id)?.key === 'admin' || draft.permissions.includes(p.code)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          permissions: e.target.checked ? [...draft.permissions, p.code] : draft.permissions.filter((x) => x !== p.code),
                        })
                      }
                      label={
                        <>
                          {p.label}
                          <span className="ui-sub">{p.hint}</span>
                        </>
                      }
                    />
                  ))}
              </fieldset>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
