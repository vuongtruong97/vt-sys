import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthGuard, AuthUser, TeacherGuard } from '../src/auth/auth.guard';
import { AuthService } from '../src/auth/auth.module';
import { mockPrisma } from './helpers';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'hv1',
  name: 'Lan',
  email: 'hv1@test',
  role: 'STUDENT',
  tokenVersion: 0,
  passwordHash: bcrypt.hashSync('dung-mat-khau', 4),
  ...over,
});

/** ExecutionContext giả mang request có cookie bd_session. */
function ctxWith(token: string) {
  const req: { cookies: Record<string, string>; headers: object; user?: AuthUser } = { cookies: { bd_session: token }, headers: {} };
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('Phiên đăng nhập (tokenVersion)', () => {
  it('cookie còn đúng phiên bản thì qua, vai trò lấy từ DB chứ không từ JWT', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(row({ role: 'TEACHER', tokenVersion: 2 }));
    const token = new AuthService(prisma as any).sign({ ...row({ tokenVersion: 2 }), role: 'STUDENT' } as any);
    const { ctx, req } = ctxWith(token);
    await expect(new TeacherGuard(prisma as any).canActivate(ctx)).resolves.toBe(true);
    expect(req.user?.role).toBe('TEACHER');
  });

  it('đổi mật khẩu hoặc đăng xuất mọi nơi (tokenVersion tăng) thì cookie cũ bị từ chối', async () => {
    const prisma = mockPrisma();
    const token = new AuthService(prisma as any).sign(row({ tokenVersion: 0 }) as any);
    prisma.user.findUnique.mockResolvedValue(row({ tokenVersion: 1 }));
    await expect(new AuthGuard(prisma as any).canActivate(ctxWith(token).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cookie cấp trước khi có tokenVersion (không có ver) vẫn dùng được khi DB là 0', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(row());
    const old = jwt.sign({ sub: 'hv1', name: 'Lan', email: 'hv1@test', role: 'STUDENT' }, 'test-jwt');
    await expect(new AuthGuard(prisma as any).canActivate(ctxWith(old).ctx)).resolves.toBe(true);
  });

  it('tài khoản đã bị xoá thì cookie không còn hiệu lực', async () => {
    const prisma = mockPrisma();
    const token = new AuthService(prisma as any).sign(row() as any);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(new AuthGuard(prisma as any).canActivate(ctxWith(token).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('Đổi mật khẩu', () => {
  it('sai mật khẩu hiện tại thì báo lỗi, không đổi gì', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(row());
    await expect(
      new AuthService(prisma as any).changePassword('hv1', { currentPassword: 'sai', newPassword: 'mat-khau-moi' }),
    ).rejects.toThrow('Mật khẩu hiện tại không đúng');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('đúng mật khẩu thì lưu hash mới và tăng tokenVersion', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(row());
    prisma.user.update.mockImplementation(({ data }: any) => Promise.resolve(row({ tokenVersion: 1, passwordHash: data.passwordHash })));
    const u = await new AuthService(prisma as any).changePassword('hv1', { currentPassword: 'dung-mat-khau', newPassword: 'mat-khau-moi' });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.tokenVersion).toEqual({ increment: 1 });
    expect(await bcrypt.compare('mat-khau-moi', data.passwordHash)).toBe(true);
    expect(u.tokenVersion).toBe(1);
  });
});

describe('Khoá đăng nhập khi sai nhiều lần', () => {
  afterEach(() => jest.useRealTimers());

  it('sai 5 lần thì lần sau bị khoá dù đúng mật khẩu; hết 15 phút thì vào được', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T08:00:00Z') });
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(row());
    const auth = new AuthService(prisma as any);
    for (let i = 0; i < 5; i++) {
      await expect(auth.login({ email: 'HV1@test ', password: 'sai' })).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const locked = await auth.login({ email: 'hv1@test', password: 'dung-mat-khau' }).catch((e) => e);
    expect(locked).toBeInstanceOf(HttpException);
    expect(locked.getStatus()).toBe(429);
    expect(locked.message).toMatch(/thử lại sau 15 phút/);

    jest.setSystemTime(new Date('2026-10-18T08:15:01Z'));
    await expect(auth.login({ email: 'hv1@test', password: 'dung-mat-khau' })).resolves.toMatchObject({ id: 'hv1' });
  });

  it('đăng nhập đúng thì xoá số lần sai trước đó', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(row());
    const auth = new AuthService(prisma as any);
    for (let i = 0; i < 4; i++) await auth.login({ email: 'hv1@test', password: 'sai' }).catch(() => {});
    await auth.login({ email: 'hv1@test', password: 'dung-mat-khau' });
    for (let i = 0; i < 4; i++) await auth.login({ email: 'hv1@test', password: 'sai' }).catch(() => {});
    await expect(auth.login({ email: 'hv1@test', password: 'dung-mat-khau' })).resolves.toMatchObject({ id: 'hv1' });
  });
});
