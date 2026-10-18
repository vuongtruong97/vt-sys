'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { fmtSize } from '@/components/Materials';
import { Nav } from '@/components/Nav';
import { Alert, Badge, Button, Input, Muted, Page, PageHeader, Section, Select, Stat, Table } from '@/components/ui';
import { api, Me } from '@/lib/api';
import { fmtDay, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';

type Role = Me['role'];
type User = { id: string; email: string; name: string; role: Role; createdAt: string; _count: { courses: number; enrollments: number } };
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
  users: Record<Role, number>;
  courses: number;
  upcomingSessions: number;
  liveSessions: number;
  recordings: { count: number; bytes: number };
};

const roleLabel: Record<Role, string> = { ADMIN: 'Quản trị', TEACHER: 'Giáo viên', STUDENT: 'Học viên' };

export default function AdminPage() {
  const me = useMe({ redirect: true });
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadUsers = useCallback(
    (term = q, role = roleFilter) => {
      const p = new URLSearchParams();
      if (term.trim()) p.set('q', term.trim());
      if (role) p.set('role', role);
      return api<User[]>(`/admin/users?${p}`).then(setUsers);
    },
    [q, roleFilter],
  );
  // Danh sách giáo viên để chuyển khoá, độc lập với bộ lọc của bảng tài khoản.
  const [teachers, setTeachers] = useState<User[]>([]);
  const loadAll = useCallback(
    () =>
      Promise.all([
        api<Stats>('/admin/stats').then(setStats),
        api<Course[]>('/admin/courses').then(setCourses),
        Promise.all([api<User[]>('/admin/users?role=TEACHER'), api<User[]>('/admin/users?role=ADMIN')]).then(([t, a]) => setTeachers([...a, ...t])),
        loadUsers(),
      ]).catch((e) => setError(e.message)),
    [loadUsers],
  );

  useEffect(() => {
    if (me?.role === 'ADMIN') loadAll();
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
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    loadUsers().catch((err) => setError(err.message));
  };

  if (me && me.role !== 'ADMIN') {
    return (
      <>
        <Nav me={me} />
        <Page>
          <Alert tone="error">Trang này chỉ dành cho quản trị viên.</Alert>
        </Page>
      </>
    );
  }

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader title="Quản trị" description="Thống kê toàn hệ thống, cấp quyền giáo viên và chuyển khoá học." />
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}

        {stats && (
          <div className="ui-stats">
            <Stat value={stats.users.TEACHER + stats.users.ADMIN} label="giáo viên" />
            <Stat value={stats.users.STUDENT} label="học viên" />
            <Stat value={stats.courses} label="khoá học" />
            <Stat value={stats.upcomingSessions} label="buổi sắp tới" />
            <Stat value={stats.liveSessions} label="đang diễn ra" />
            <Stat value={stats.recordings.count} label={`bản ghi · ${fmtSize(stats.recordings.bytes)}`} />
          </div>
        )}

        <Section title="Tài khoản">
          <form className="ui-form-row" style={{ alignItems: 'end' }} onSubmit={search}>
            <Input label="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} placeholder="hocvien@gmail.com" />
            <Select
              label="Vai trò"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                loadUsers(q, e.target.value).catch((err) => setError(err.message));
              }}
              options={[
                { value: '', label: 'Tất cả' },
                { value: 'ADMIN', label: 'Quản trị' },
                { value: 'TEACHER', label: 'Giáo viên' },
                { value: 'STUDENT', label: 'Học viên' },
              ]}
            />
            <div className="ui-actions">
              <Button type="submit">Tìm</Button>
            </div>
          </form>
          <Muted small>Người được cấp quyền giáo viên thấy mục &quot;Quản lý lớp&quot; ngay lần tải trang tiếp theo, không cần đăng nhập lại. Hiện tối đa 100 tài khoản mới nhất.</Muted>
          <Table caption="Tài khoản">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Dạy / học</th>
                <th>Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.id === me?.id && <span className="ui-sub">(bạn)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {u.id === me?.id ? (
                      <Badge>{roleLabel[u.role]}</Badge>
                    ) : (
                      <select
                        aria-label={`Vai trò của ${u.name}`}
                        value={u.role}
                        onChange={(e) => {
                          const role = e.target.value as Role;
                          if (role === 'ADMIN' && !window.confirm(`Cấp quyền quản trị cho ${u.name}? Người này sẽ đổi được vai trò của mọi tài khoản.`)) return;
                          run(() => api(`/admin/users/${u.id}`, { method: 'PATCH', json: { role } }), `${u.name} giờ là ${roleLabel[role].toLowerCase()}`);
                        }}
                      >
                        <option value="STUDENT">Học viên</option>
                        <option value="TEACHER">Giáo viên</option>
                        <option value="ADMIN">Quản trị</option>
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

        <Section title="Khoá học">
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
                    {c.title} {!c.published && <Badge variant="neutral">Ẩn</Badge>}
                    <span className="ui-sub">{c.sessions} buổi</span>
                  </td>
                  <td>
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
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ui-num">{c.students}</td>
                  <td className="ui-num">{c.nextSession ? `${fmtDay(c.nextSession)} ${fmtTime(c.nextSession)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Muted small>Chọn giáo viên khác để chuyển khoá, kèm toàn bộ buổi học, học viên, tài liệu và bản ghi.</Muted>
        </Section>
      </Page>
    </>
  );
}
