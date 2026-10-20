import { AuthUser, toAuthUser } from '../src/auth/auth.guard';
import { ClassroomService } from '../src/classroom/classroom.module';

/** Vai trò hệ thống như trong migration 11_roles (kèm danh sách quyền đã tính). */
export const roles = {
  admin: { id: 'role_admin', key: 'admin', name: 'Quản trị viên', permissions: [] as string[], system: true },
  teacher: { id: 'role_teacher', key: 'teacher', name: 'Giáo viên', permissions: ['course.create', 'meeting.create', 'ggb.create', 'session.record'], system: true },
  student: { id: 'role_student', key: 'student', name: 'Học viên', permissions: [] as string[], system: true },
};
/** Người dùng kèm vai trò → AuthUser như AuthGuard trả về. */
export const asUser = (u: { id: string; name: string; email: string }, role: { id: string; key: string; name: string; permissions: string[] }, extra: string[] = []) =>
  toAuthUser({ ...u, role: { ...role, permissions: [...role.permissions, ...extra] } });

export const teacher: AuthUser = asUser({ id: 'gv', name: 'Thầy Minh', email: 'gv@test' }, roles.teacher);
export const student: AuthUser = asUser({ id: 'hv1', name: 'Lan', email: 'hv1@test' }, roles.student);
export const outsider: AuthUser = asUser({ id: 'ngoai', name: 'Người lạ', email: 'x@test' }, roles.student);
export const admin: AuthUser = asUser({ id: 'qt', name: 'Quản trị', email: 'qt@test' }, roles.admin);

export const session = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  courseId: 'c1',
  title: 'Buổi 1',
  roomName: 'bd-room',
  status: 'LIVE',
  startsAt: new Date('2026-10-17T12:00:00Z'),
  endsAt: new Date('2026-10-17T13:30:00Z'),
  allowStudentShare: false,
  createdAt: new Date(),
  course: { id: 'c1', teacherId: teacher.id, title: 'Python cơ bản' },
  ...over,
});

/** Prisma giả: mỗi bảng là một bộ jest.fn; test tự đặt giá trị trả về. */
export function mockPrisma() {
  const table = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  });
  return {
    classSession: table(),
    enrollment: table(),
    joinRequest: table(),
    chatMessage: table(),
    quiz: table(),
    quizAnswer: table(),
    recording: table(),
    reminder: table(),
    attendance: table(),
    user: table(),
    role: table(),
    breakoutGroup: table(),
    ggbDocument: table(),
    siteContent: table(),
    siteAsset: table(),
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}
export type MockPrisma = ReturnType<typeof mockPrisma>;

/** LiveKitService giả, ghi lại các tin đã phát. */
export function mockLivekit() {
  return {
    broadcast: jest.fn().mockResolvedValue(undefined),
    patchMeta: jest.fn().mockResolvedValue({}),
    ensureRoom: jest.fn().mockResolvedValue({}),
    token: jest.fn().mockResolvedValue('jwt'),
    rooms: { listParticipants: jest.fn().mockResolvedValue([]), deleteRoom: jest.fn() },
  };
}

/**
 * ClassroomService thật trên Prisma giả: lớp có giáo viên `gv`, học viên `hv1` đã đăng ký,
 * người ngoài chưa có yêu cầu vào lớp.
 */
export function classroom(prisma: MockPrisma, s = session()) {
  prisma.classSession.findUnique.mockResolvedValue(s);
  prisma.enrollment.findUnique.mockImplementation(({ where }: any) =>
    Promise.resolve(where.userId_courseId.userId === student.id ? { id: 'e1' } : null),
  );
  prisma.joinRequest.findUnique.mockResolvedValue(null);
  return new ClassroomService(prisma as any, {} as any);
}
