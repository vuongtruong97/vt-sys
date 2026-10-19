import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { RolesService } from '../src/admin/admin.module';
import { Need, PermissionGuard } from '../src/auth/auth.guard';
import { effectivePermissions } from '../src/auth/permissions';
import { ClassroomService } from '../src/classroom/classroom.module';
import { admin, asUser, mockPrisma, roles, session, student, teacher } from './helpers';

/** Người dùng với vai trò tuỳ biến. */
const custom = (perms: string[], id = 'gv2') =>
  asUser({ id, name: 'Giáo vụ', email: `${id}@test` }, { id: 'r_giaovu', key: 'r_giaovu', name: 'Giáo vụ', permissions: perms });

function guardCtx(userRow: unknown, handler: () => void) {
  const prisma = mockPrisma();
  prisma.user.findUnique.mockResolvedValue(userRow);
  const token = jwt.sign({ sub: 'x', ver: 0 }, 'test-jwt');
  const req = { cookies: { bd_session: token }, headers: {} };
  const ctx = { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => Object } as unknown as ExecutionContext;
  return { guard: new PermissionGuard(prisma as any, new Reflector()), ctx };
}

class Endpoints {
  @Need('course.create') createCourse() {}
  @Need('stats.view', 'user.manage') adminPage() {}
}
const row = (role: unknown) => ({ id: 'x', name: 'A', email: 'a@test', tokenVersion: 0, role });

describe('PermissionGuard', () => {
  it('giáo viên tạo khoá học được, học viên bị chặn kèm tên quyền tiếng Việt', async () => {
    const t = guardCtx(row(roles.teacher), Endpoints.prototype.createCourse);
    await expect(t.guard.canActivate(t.ctx)).resolves.toBe(true);
    const s = guardCtx(row(roles.student), Endpoints.prototype.createCourse);
    await expect(s.guard.canActivate(s.ctx)).rejects.toThrow('Bạn chưa có quyền: Tạo và dạy khoá học của mình');
  });

  it('quản trị viên luôn qua, kể cả khi danh sách quyền trong DB trống', async () => {
    const g = guardCtx(row(roles.admin), Endpoints.prototype.adminPage);
    await expect(g.guard.canActivate(g.ctx)).resolves.toBe(true);
    expect(effectivePermissions(roles.admin)).toContain('role.manage');
  });

  it('cần một trong nhiều quyền: vai trò chỉ có xem thống kê vẫn qua', async () => {
    const g = guardCtx(row({ id: 'r1', key: 'r1', name: 'Giáo vụ', permissions: ['stats.view'] }), Endpoints.prototype.adminPage);
    await expect(g.guard.canActivate(g.ctx)).resolves.toBe(true);
  });

  it('bỏ qua mã quyền lạ còn sót trong DB', () => {
    expect(effectivePermissions({ key: 'r1', permissions: ['stats.view', 'quyen.da.xoa'] })).toEqual(['stats.view']);
  });
});

describe('Phòng học theo quyền', () => {
  const s = session({ course: { id: 'c1', teacherId: 'gv-khac', title: 'Khoá khác' } });

  it('người quản lý mọi khoá học điều khiển được lớp không phải của mình', async () => {
    const prisma = mockPrisma();
    prisma.classSession.findUnique.mockResolvedValue(s);
    const room = new ClassroomService(prisma as any, {} as any);
    await expect(room.requireTeacher(teacher, 's1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(room.requireTeacher(custom(['course.manage_all']), 's1')).resolves.toMatchObject({ id: 's1' });
    await expect(room.roleOf(custom(['course.manage_all']), s as any)).resolves.toBe('teacher');
  });

  it('người được xem mọi khoá học vào lớp như học viên', async () => {
    const prisma = mockPrisma();
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.joinRequest.findUnique.mockResolvedValue(null);
    const room = new ClassroomService(prisma as any, {} as any);
    await expect(room.roleOf(custom(['course.view_all']), s as any)).resolves.toBe('student');
    await expect(room.roleOf(student, s as any)).resolves.toBeNull();
  });
});

describe('Quản lý vai trò', () => {
  it('tạo vai trò với quyền đã chọn; không trao được quyền mình không có', async () => {
    const prisma = mockPrisma();
    prisma.role.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r_new', ...data }));
    const svc = new RolesService(prisma as any);
    await expect(svc.createRole(admin, { name: 'Trợ giảng', permissions: ['course.manage_all'] })).resolves.toMatchObject({ name: 'Trợ giảng', permissions: ['course.manage_all'] });
    const manager = custom(['role.manage', 'stats.view']);
    await expect(svc.createRole(manager, { name: 'Siêu', permissions: ['user.manage'] })).rejects.toThrow('chưa có quyền: Quản lý tài khoản');
  });

  it('không đổi quyền của vai trò hệ thống, không xoá vai trò hệ thống hay vai trò còn người dùng', async () => {
    const prisma = mockPrisma();
    const svc = new RolesService(prisma as any);
    prisma.role.findUnique.mockResolvedValueOnce(roles.teacher);
    await expect(svc.updateRole(admin, 'role_teacher', { permissions: [] })).rejects.toThrow('vai trò hệ thống');
    prisma.role.findUnique.mockResolvedValueOnce({ ...roles.student, _count: { users: 0 } });
    await expect(svc.deleteRole('role_student')).rejects.toThrow('không xoá được');
    prisma.role.findUnique.mockResolvedValueOnce({ id: 'r1', name: 'Giáo vụ', system: false, _count: { users: 2 } });
    await expect(svc.deleteRole('r1')).rejects.toThrow('Còn 2 tài khoản');
  });

  it('được đổi tên vai trò hệ thống', async () => {
    const prisma = mockPrisma();
    prisma.role.findUnique.mockResolvedValue(roles.teacher);
    prisma.role.update.mockResolvedValue({ ...roles.teacher, name: 'Giảng viên' });
    await expect(new RolesService(prisma as any).updateRole(admin, 'role_teacher', { name: 'Giảng viên' })).resolves.toMatchObject({ name: 'Giảng viên' });
  });
});

describe('Đổi vai trò người dùng', () => {
  const target = (over: Record<string, unknown> = {}) => ({ id: 'u2', name: 'Bình', role: roles.student, _count: { courses: 0 }, ...over });

  it('không tự đổi vai trò của mình', async () => {
    await expect(new RolesService(mockPrisma() as any).setUserRole(admin, admin.id, 'role_student')).rejects.toThrow('chính mình');
  });

  it('người chỉ có quyền quản lý tài khoản không cấp được vai trò quản trị', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(target());
    prisma.role.findUnique.mockResolvedValue(roles.admin);
    await expect(new RolesService(prisma as any).setUserRole(custom(['user.manage']), 'u2', 'role_admin')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('giáo viên còn khoá học thì không đổi sang vai trò không có quyền dạy', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(target({ role: roles.teacher, _count: { courses: 2 } }));
    prisma.role.findUnique.mockResolvedValue(roles.student);
    await expect(new RolesService(prisma as any).setUserRole(admin, 'u2', 'role_student')).rejects.toThrow('đang dạy 2 khoá');
  });

  it('không hạ người quản lý vai trò cuối cùng', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(target({ role: roles.admin }));
    prisma.role.findUnique.mockResolvedValue(roles.student);
    prisma.role.findMany.mockResolvedValue([roles.admin, roles.teacher, roles.student]);
    prisma.user.count.mockResolvedValue(0);
    await expect(new RolesService(prisma as any).setUserRole(admin, 'u2', 'role_student')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('đổi được khi hợp lệ', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(target());
    prisma.role.findUnique.mockResolvedValue(roles.teacher);
    prisma.user.update.mockResolvedValue({ id: 'u2', role: roles.teacher });
    await new RolesService(prisma as any).setUserRole(admin, 'u2', 'role_teacher');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u2' }, data: { roleId: 'role_teacher' } }));
  });
});
