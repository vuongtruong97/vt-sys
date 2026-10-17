'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { fmtSize } from '@/components/Materials';
import { Nav } from '@/components/Nav';
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
        <main className="container page"><p className="error">Trang này chỉ dành cho quản trị viên.</p></main>
      </>
    );
  }

  return (
    <>
      <Nav me={me} />
      <main className="container page">
        <h1>Quản trị</h1>
        {error && <p className="error" role="alert">{error}</p>}
        {msg && <p className="small" role="status" style={{ color: 'var(--good)' }}>{msg}</p>}

        {stats && (
          <div className="stats">
            <div className="card stat"><b>{stats.users.TEACHER + stats.users.ADMIN}</b><span>giáo viên</span></div>
            <div className="card stat"><b>{stats.users.STUDENT}</b><span>học viên</span></div>
            <div className="card stat"><b>{stats.courses}</b><span>khoá học</span></div>
            <div className="card stat"><b>{stats.upcomingSessions}</b><span>buổi sắp tới</span></div>
            <div className="card stat"><b>{stats.liveSessions}</b><span>đang diễn ra</span></div>
            <div className="card stat"><b>{stats.recordings.count}</b><span>bản ghi · {fmtSize(stats.recordings.bytes)}</span></div>
          </div>
        )}

        <section className="stack">
          <h2>Tài khoản</h2>
          <form className="row" onSubmit={search}>
            <label className="field" htmlFor="u-q" style={{ flex: 1, minWidth: 200 }}>Tìm theo tên hoặc email
              <input id="u-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="hocvien@gmail.com" />
            </label>
            <label className="field" htmlFor="u-role" style={{ minWidth: 140 }}>Vai trò
              <select id="u-role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); loadUsers(q, e.target.value).catch((err) => setError(err.message)); }}>
                <option value="">Tất cả</option>
                <option value="ADMIN">Quản trị</option>
                <option value="TEACHER">Giáo viên</option>
                <option value="STUDENT">Học viên</option>
              </select>
            </label>
            <button className="btn" style={{ alignSelf: 'end' }}>Tìm</button>
          </form>
          <p className="small muted">Người được cấp quyền giáo viên thấy mục "Quản lý lớp" ngay lần tải trang tiếp theo, không cần đăng nhập lại. Hiện tối đa 100 tài khoản mới nhất.</p>
          <div className="tbl">
            <table>
              <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Dạy / học</th><th>Tạo lúc</th></tr></thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}{u.id === me?.id && <span className="small muted"> (bạn)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      {u.id === me?.id ? (
                        <span className="tag">{roleLabel[u.role]}</span>
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
                    <td className="num">{u._count.courses} khoá / {u._count.enrollments} khoá</td>
                    <td className="num">{fmtDay(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users?.length === 0 && <p className="muted small">Không có tài khoản nào khớp.</p>}
        </section>

        <section className="stack">
          <h2>Khoá học</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Khoá học</th><th>Giáo viên</th><th>Học viên</th><th>Buổi tiếp theo</th></tr></thead>
              <tbody>
                {courses?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}{!c.published && <span className="tag off" style={{ marginLeft: 6 }}>Ẩn</span>}<br /><span className="small muted">{c.sessions} buổi</span></td>
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
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td className="num">{c.students}</td>
                    <td className="num">{c.nextSession ? `${fmtDay(c.nextSession)} ${fmtTime(c.nextSession)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">Chọn giáo viên khác để chuyển khoá, kèm toàn bộ buổi học, học viên, tài liệu và bản ghi.</p>
        </section>
      </main>
    </>
  );
}
