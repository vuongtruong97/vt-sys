import { ReminderService } from '../src/notifications/reminder.module';
import { mockPrisma, session } from './helpers';

const now = new Date('2026-10-17T11:00:00Z');
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

function setup(startsInMinutes: number) {
  const prisma = mockPrisma();
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  prisma.classSession.findMany.mockResolvedValue([
    session({
      status: 'SCHEDULED',
      startsAt: at(startsInMinutes),
      course: {
        id: 'c1',
        title: 'Python <cơ bản>',
        teacherId: 'gv',
        enrollments: [
          { user: { id: 'hv1', email: 'hv1@test', name: 'Lan' } },
          { user: { id: 'hv2', email: 'hv2@test', name: 'Nam' } },
        ],
      },
    }),
  ]);
  prisma.reminder.create.mockResolvedValue({});
  return { prisma, email, svc: new ReminderService(prisma as any, email as any) };
}

describe('Nhắc lịch', () => {
  it('chỉ tìm buổi học (không phải meeting) đã lên lịch, bắt đầu trong vòng 60 phút tới', async () => {
    const { prisma, svc } = setup(45);
    await svc.tick(now);
    expect(prisma.classSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'SCHEDULED', courseId: { not: null }, startsAt: { gt: now, lte: at(60) } } }),
    );
  });

  it('còn 45 phút: gửi nhắc loại "60" cho từng học viên', async () => {
    const { prisma, email, svc } = setup(45);
    await svc.tick(now);
    expect(prisma.reminder.create.mock.calls.map((c) => c[0].data.kind)).toEqual(['60', '60']);
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send.mock.calls[0][0]).toBe('hv1@test');
  });

  it('còn 5 phút: gửi nhắc loại "10" kèm link vào lớp', async () => {
    const { prisma, email, svc } = setup(5);
    await svc.tick(now);
    expect(prisma.reminder.create.mock.calls[0][0].data.kind).toBe('10');
    expect(email.send.mock.calls[0][1]).toMatch(/^Sắp vào lớp/);
    expect(email.send.mock.calls[0][2]).toContain('/room/s1');
  });

  it('đã nhắc rồi (trùng khoá) thì không gửi lại', async () => {
    const { prisma, email, svc } = setup(45);
    prisma.reminder.create.mockRejectedValue(new Error('Unique constraint failed'));
    await svc.tick(now);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('thoát ký tự HTML trong tên khoá học', async () => {
    const { email, svc } = setup(45);
    await svc.tick(now);
    expect(email.send.mock.calls[0][2]).toContain('Python &lt;cơ bản&gt;');
  });

  it('lỗi gửi một email không làm dừng các email khác', async () => {
    const { email, svc } = setup(45);
    email.send.mockRejectedValueOnce(new Error('Resend 500'));
    await svc.tick(now);
    expect(email.send).toHaveBeenCalledTimes(2);
  });
});
