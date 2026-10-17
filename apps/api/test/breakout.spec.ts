import { ClassroomController, groupRoom, mainRoom } from '../src/classroom/classroom.module';
import { BreakoutController } from '../src/classroom/breakout.module';
import { classroom, mockLivekit, mockPrisma, session, student, teacher } from './helpers';

function setup(s = session()) {
  const prisma = mockPrisma();
  const lk = mockLivekit();
  const room = classroom(prisma, s);
  return {
    prisma,
    lk,
    breakout: new BreakoutController(prisma as any, room, lk as any),
    classroom: new ClassroomController(room, lk as any, prisma as any, {} as any, {} as any),
  };
}

const groups = [
  // Không có `student` (hv1) trong nhóm nào; test cần thì tự thêm.
  { id: 'g0', sessionId: 's1', index: 0, name: 'Nhóm 1', members: ['hv2', 'hv4'] },
  { id: 'g1', sessionId: 's1', index: 1, name: 'Nhóm 2', members: ['hv3'] },
];

describe('Tên phòng nhóm', () => {
  it('phòng nhóm và phòng chính đổi qua lại được', () => {
    expect(groupRoom('bd-abc', 2)).toBe('bd-abc-g2');
    expect(mainRoom('bd-abc-g2')).toBe('bd-abc');
    expect(mainRoom('bd-abc')).toBe('bd-abc');
  });
});

describe('Chia nhóm', () => {
  const dto = { groups: [{ name: 'Nhóm 1', members: ['hv1', 'hv2'] }, { name: 'Nhóm 2', members: ['hv3'] }] };

  it('bắt đầu: lưu nhóm, tạo phòng nhóm, báo riêng cho học viên được xếp nhóm', async () => {
    const { prisma, lk, breakout } = setup();
    await breakout.start(teacher, 's1', { ...dto, minutes: 10 });
    expect(prisma.breakoutGroup.createMany).toHaveBeenCalled();
    expect(lk.ensureRoom.mock.calls.map((c) => c[0])).toEqual(['bd-room-g0', 'bd-room-g1']);
    const [room, topic, payload, to] = lk.broadcast.mock.calls[0];
    expect([room, topic, payload.type]).toEqual(['bd-room', 'breakout', 'start']);
    expect(to).toEqual(['hv1', 'hv2', 'hv3']);
  });

  it('không cho một học viên nằm trong hai nhóm', async () => {
    const { breakout } = setup();
    await expect(
      breakout.start(teacher, 's1', { groups: [{ name: 'A', members: ['hv1'] }, { name: 'B', members: ['hv1'] }] }),
    ).rejects.toThrow('hai nhóm');
  });

  it('chỉ chia nhóm khi lớp đang diễn ra', async () => {
    const { breakout } = setup(session({ status: 'SCHEDULED' }));
    await expect(breakout.start(teacher, 's1', dto)).rejects.toThrow('đang diễn ra');
  });

  it('học viên không chia nhóm được', async () => {
    const { breakout } = setup();
    await expect(breakout.start(student, 's1', dto)).rejects.toThrow('Chỉ giáo viên');
  });

  it('gọi về: báo "end" tới từng phòng nhóm, tắt chia nhóm', async () => {
    const { prisma, lk, breakout } = setup(session({ breakoutActive: true }));
    prisma.breakoutGroup.findMany.mockResolvedValue(groups);
    await breakout.end(teacher, 's1');
    expect(prisma.classSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: { breakoutActive: false, breakoutEndsAt: null } }));
    expect(lk.broadcast.mock.calls.map((c) => [c[0], c[2].type])).toEqual([
      ['bd-room-g0', 'end'],
      ['bd-room-g1', 'end'],
    ]);
  });
});

describe('Vào lớp khi đang chia nhóm', () => {
  it('học viên được xếp nhóm nhận token của phòng nhóm', async () => {
    const { prisma, lk, classroom } = setup(session({ breakoutActive: true, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3600_000) }));
    prisma.breakoutGroup.findMany.mockResolvedValue([{ ...groups[0], members: [student.id] }, groups[1]]);
    const r = await classroom.join(student, 's1', {});
    expect(lk.token.mock.calls[0][0].room).toBe('bd-room-g0');
    expect(r).toMatchObject({ status: 'ok', group: { index: 0, name: 'Nhóm 1', count: 2 } });
  });

  it('học viên không có trong nhóm nào vào phòng chính', async () => {
    const { prisma, lk, classroom } = setup(session({ breakoutActive: true, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3600_000) }));
    prisma.breakoutGroup.findMany.mockResolvedValue(groups);
    const r = await classroom.join(student, 's1', {});
    expect(lk.token.mock.calls[0][0].room).toBe('bd-room');
    expect(r).toMatchObject({ group: null });
  });

  it('học viên tự chọn nhóm thì bị bỏ qua', async () => {
    const { prisma, lk, classroom } = setup(session({ breakoutActive: true, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3600_000) }));
    prisma.breakoutGroup.findMany.mockResolvedValue(groups);
    await classroom.join(student, 's1', { group: 1 });
    expect(lk.token.mock.calls[0][0].room).toBe('bd-room');
  });

  it('giáo viên ghé nhóm đã chọn', async () => {
    const { prisma, lk, classroom } = setup(session({ breakoutActive: true }));
    prisma.breakoutGroup.findMany.mockResolvedValue(groups);
    await classroom.join(teacher, 's1', { group: 1 });
    expect(lk.token.mock.calls[0][0].room).toBe('bd-room-g1');
  });
});

describe('Học viên vào lớp theo giờ', () => {
  const tomorrow = { startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000) };

  it('giáo viên đã mở lớp sớm (LIVE) thì học viên vào được ngay', async () => {
    const { classroom } = setup(session({ status: 'LIVE', ...tomorrow }));
    await expect(classroom.join(student, 's1', {})).resolves.toMatchObject({ status: 'ok' });
  });

  it('lớp chưa mở và chưa tới giờ thì học viên bị chặn', async () => {
    const { classroom } = setup(session({ status: 'SCHEDULED', ...tomorrow }));
    await expect(classroom.join(student, 's1', {})).rejects.toThrow(/Lớp mở cửa lúc/);
  });
});
