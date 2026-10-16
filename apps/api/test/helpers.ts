import type { AuthUser } from '../src/auth/auth.guard';
import { ClassroomService } from '../src/classroom/classroom.module';

export const teacher: AuthUser = { id: 'gv', name: 'Thầy Minh', email: 'gv@test', role: 'TEACHER' };
export const student: AuthUser = { id: 'hv1', name: 'Lan', email: 'hv1@test', role: 'STUDENT' };
export const outsider: AuthUser = { id: 'ngoai', name: 'Người lạ', email: 'x@test', role: 'STUDENT' };

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
  };
}
export type MockPrisma = ReturnType<typeof mockPrisma>;

/** LiveKitService giả, ghi lại các tin đã phát. */
export function mockLivekit() {
  return {
    broadcast: jest.fn().mockResolvedValue(undefined),
    patchMeta: jest.fn().mockResolvedValue({}),
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
