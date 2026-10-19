import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassroomController } from '../src/classroom/classroom.module';
import { MeetingsController } from '../src/meetings/meetings.module';
import { ReminderService } from '../src/notifications/reminder.module';
import { classroom, mockLivekit, mockPrisma, outsider, session, student, teacher } from './helpers';

/** Meeting của giáo viên `gv`: không thuộc khoá học nào. */
const meeting = (over: Record<string, unknown> = {}) =>
  session({ courseId: null, course: null, hostId: teacher.id, title: 'Họp phụ huynh', ...over });

function setup(s = meeting()) {
  const prisma = mockPrisma();
  const lk = mockLivekit();
  const room = classroom(prisma, s);
  (lk.rooms as any).deleteRoom = jest.fn().mockResolvedValue(undefined);
  return {
    prisma,
    lk,
    room,
    meetings: new MeetingsController(prisma as any, room, lk as any),
    classroom: new ClassroomController(room, lk as any, prisma as any, {} as any, {} as any),
  };
}

const dtoErrors = async (body: object) => {
  // Lấy lớp DTO từ metadata của controller để không phải export riêng.
  const [, Dto] = Reflect.getMetadata('design:paramtypes', MeetingsController.prototype, 'create');
  return validate(plainToInstance(Dto, body));
};

describe('Tạo meeting', () => {
  it('họp ngay: bắt đầu bây giờ, dài 60 phút, chủ phòng là người tạo, không thuộc khoá học', async () => {
    const { prisma, meetings } = setup();
    prisma.classSession.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'm1', status: 'SCHEDULED', ...data }));
    const before = Date.now();
    const m = await meetings.create(teacher, {});
    const data = prisma.classSession.create.mock.calls[0][0].data;
    expect(data.hostId).toBe(teacher.id);
    expect(data.courseId).toBeUndefined();
    expect(data.title).toBe('Meeting của Thầy Minh');
    expect(data.roomName).toMatch(/^bd-[0-9a-f]{12}$/);
    expect(data.startsAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.endsAt.getTime() - data.startsAt.getTime()).toBe(60 * 60_000);
    expect(m.id).toBe('m1');
  });

  it('hẹn giờ: dùng giờ và thời lượng đã chọn', async () => {
    const { prisma, meetings } = setup();
    prisma.classSession.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'm2', ...data }));
    const startsAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    await meetings.create(teacher, { title: 'Ôn thi', startsAt, durationMinutes: 90 });
    const data = prisma.classSession.create.mock.calls[0][0].data;
    expect(data.title).toBe('Ôn thi');
    expect(data.startsAt.toISOString()).toBe(startsAt);
    expect(data.endsAt.getTime() - data.startsAt.getTime()).toBe(90 * 60_000);
  });

  it('không hẹn giờ trong quá khứ', async () => {
    const { meetings } = setup();
    const startsAt = new Date(Date.now() - 3600_000).toISOString();
    await expect(meetings.create(teacher, { startsAt })).rejects.toThrow('đã qua');
  });

  it('kiểm tra dữ liệu gửi lên', async () => {
    expect(await dtoErrors({})).toHaveLength(0);
    expect(await dtoErrors({ title: 'A' })).not.toHaveLength(0);
    expect(await dtoErrors({ startsAt: 'mai' })).not.toHaveLength(0);
    expect(await dtoErrors({ durationMinutes: 5 })).not.toHaveLength(0);
    expect(await dtoErrors({ durationMinutes: 300 })).not.toHaveLength(0);
  });
});

describe('Vào meeting', () => {
  it('người tạo là chủ phòng (vai trò giáo viên)', async () => {
    const { room, prisma } = setup();
    expect(await room.roleOf(teacher, meeting() as any)).toBe('teacher');
    // Meeting không có danh sách lớp nên không hỏi bảng ghi danh.
    expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it('người có link phải chờ chủ phòng duyệt', async () => {
    const { classroom, prisma } = setup();
    prisma.joinRequest.upsert.mockResolvedValue({ status: 'PENDING' });
    expect(await classroom.join(outsider, 's1')).toEqual({ status: 'waiting' });
    expect(await classroom.join(student, 's1')).toEqual({ status: 'waiting' });
  });

  it('thông tin phòng: loại meeting, không có khoá học', async () => {
    const { classroom } = setup();
    const info = await classroom.info(teacher, 's1');
    expect(info).toMatchObject({ kind: 'meeting', course: null, role: 'teacher' });
  });

  it('meeting đã huỷ thì không vào được', async () => {
    const { classroom } = setup(meeting({ status: 'CANCELLED' }));
    await expect(classroom.join(teacher, 's1')).rejects.toThrow('Meeting này đã bị huỷ');
  });

  it('điểm danh: chỉ liệt kê người đã vào, không tính chủ phòng', async () => {
    const { classroom, prisma } = setup();
    const t = new Date('2026-10-17T12:00:00Z');
    prisma.attendance.findMany.mockResolvedValue([
      { userId: teacher.id, user: { id: teacher.id, name: 'Thầy Minh', email: 'gv@test' }, joinedAt: t, leftAt: new Date(t.getTime() + 600_000) },
      { userId: 'ngoai', user: { id: 'ngoai', name: 'Người lạ', email: 'x@test' }, joinedAt: t, leftAt: new Date(t.getTime() + 300_000) },
    ]);
    const res = await classroom.attendance(teacher, 's1');
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(res.rows.map((r) => [r.user.id, r.minutes])).toEqual([['ngoai', 5]]);
  });
});

describe('Huỷ meeting', () => {
  it('chủ phòng huỷ được; đang họp thì đóng phòng', async () => {
    const { meetings, prisma, lk } = setup();
    await meetings.cancel(teacher, 's1');
    expect(prisma.classSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'CANCELLED', breakoutActive: false } });
    expect(lk.rooms.deleteRoom).toHaveBeenCalledWith('bd-room');
  });

  it('người khác không huỷ được', async () => {
    const { meetings } = setup();
    await expect(meetings.cancel({ ...teacher, id: 'gv2' }, 's1')).rejects.toThrow('Chỉ chủ phòng');
  });

  it('không dùng để huỷ buổi học của khoá', async () => {
    const { meetings } = setup(session());
    await expect(meetings.cancel(teacher, 's1')).rejects.toThrow('buổi học của khoá');
  });
});

describe('Nhắc lịch bỏ qua meeting', () => {
  it('buổi không có khoá học thì không gửi gì', async () => {
    const prisma = mockPrisma();
    const email = { send: jest.fn() };
    prisma.classSession.findMany.mockResolvedValue([meeting({ status: 'SCHEDULED' })]);
    await new ReminderService(prisma as any, email as any).tick(new Date('2026-10-17T11:30:00Z'));
    expect(email.send).not.toHaveBeenCalled();
  });
});
