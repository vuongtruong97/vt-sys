import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InteractionController, InteractionService } from '../src/classroom/interaction.module';
import { classroom, mockLivekit, mockPrisma, outsider, session, student, teacher } from './helpers';

function setup(s = session()) {
  const prisma = mockPrisma();
  const lk = mockLivekit();
  const room = classroom(prisma, s);
  const svc = new InteractionService(prisma as any, room, lk as any);
  const ctl = new InteractionController(svc, room, lk as any, prisma as any);
  return { prisma, lk, ctl };
}

const quiz = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  sessionId: 's1',
  question: '2 ** 3 = ?',
  options: ['6', '8', '9'],
  correct: 1,
  closedAt: null,
  createdAt: new Date(),
  ...over,
});

describe('Trò chuyện', () => {
  it('lưu tin rồi phát xuống phòng với tên do server xác định', async () => {
    const { prisma, lk, ctl } = setup();
    prisma.chatMessage.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'm1', text: data.text, createdAt: new Date(), user: { id: student.id, name: student.name, avatarVersion: 3 } }),
    );
    const msg = await ctl.send(student, 's1', { text: 'Em chào thầy' });
    expect(msg.from).toEqual({ id: student.id, name: 'Lan', avatarUrl: '/api/users/hv1/avatar?v=3' });
    expect(lk.broadcast).toHaveBeenCalledWith('bd-room', 'chat', msg, undefined);
  });

  it('đang chia nhóm: tin phát tới phòng chính và mọi phòng nhóm', async () => {
    const { prisma, lk, ctl } = setup(session({ breakoutActive: true }));
    prisma.breakoutGroup.findMany.mockResolvedValue([{ index: 0 }, { index: 1 }]);
    prisma.chatMessage.create.mockResolvedValue({ id: 'm2', text: 'a', createdAt: new Date(), user: { id: teacher.id, name: teacher.name } });
    await ctl.send(teacher, 's1', { text: 'Cả lớp chú ý' });
    expect(lk.broadcast.mock.calls.map((c) => c[0])).toEqual(['bd-room', 'bd-room-g0', 'bd-room-g1']);
  });

  it('người chưa được vào lớp không gửi được tin', async () => {
    const { ctl } = setup();
    await expect(ctl.send(outsider, 's1', { text: 'xin chào' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('chặn gửi dồn dập trong 500 ms', async () => {
    const { prisma, ctl } = setup();
    prisma.chatMessage.create.mockResolvedValue({ id: 'm', text: 'a', createdAt: new Date(), user: { id: 'gv2', name: 'x' } });
    // Dùng tài khoản khác test trước để không dính bộ đếm.
    const u = { ...student, id: 'hv-nhanh' };
    prisma.enrollment.findUnique.mockResolvedValue({ id: 'e' });
    await ctl.send(u, 's1', { text: 'một' });
    await expect(ctl.send(u, 's1', { text: 'hai' })).rejects.toThrow('gửi nhanh quá');
  });

  it('buổi đã kết thúc thì không gửi được', async () => {
    const { ctl } = setup(session({ status: 'ENDED' }));
    await expect(ctl.send(teacher, 's1', { text: 'còn ai không' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Câu hỏi nhanh', () => {
  it('tin "open" gửi cho học viên không lộ đáp án đúng', async () => {
    const { prisma, lk, ctl } = setup();
    prisma.quiz.create.mockImplementation(({ data }: any) => Promise.resolve(quiz({ ...data, id: 'q2' })));
    await ctl.create(teacher, 's1', { question: '2 ** 3 = ?', options: ['6', '8', '9'], correct: 1 });
    const [, topic, payload] = lk.broadcast.mock.calls[0];
    expect(topic).toBe('quiz');
    expect(payload.type).toBe('open');
    expect(payload.quiz).not.toHaveProperty('correct');
  });

  it('mở câu mới thì đóng câu đang mở', async () => {
    const { prisma, lk, ctl } = setup();
    prisma.quiz.findMany.mockResolvedValue([quiz()]);
    prisma.quiz.update.mockResolvedValue(quiz({ closedAt: new Date() }));
    prisma.quiz.create.mockResolvedValue(quiz({ id: 'q2' }));
    await ctl.create(teacher, 's1', { question: 'Câu 2', options: ['a', 'b'] });
    expect(prisma.quiz.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'q1' } }));
    expect(lk.broadcast.mock.calls.map((c) => c[2].type)).toEqual(['close', 'open']);
  });

  it('báo lỗi khi đáp án đúng nằm ngoài các lựa chọn', async () => {
    const { ctl } = setup();
    await expect(ctl.create(teacher, 's1', { question: 'x', options: ['a', 'b'], correct: 3 })).rejects.toThrow('Đáp án đúng');
  });

  it('chỉ giáo viên tạo được câu hỏi', async () => {
    const { ctl } = setup();
    await expect(ctl.create(student, 's1', { question: 'x', options: ['a', 'b'] })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('học viên trả lời: lưu lựa chọn, gửi số liệu riêng cho giáo viên', async () => {
    const { prisma, lk, ctl } = setup();
    prisma.quiz.findFirst.mockResolvedValue(quiz());
    prisma.quizAnswer.groupBy.mockResolvedValue([{ choice: 1, _count: 3 }, { choice: 0, _count: 1 }]);
    await ctl.answer(student, 's1', 'q1', { choice: 1 });
    expect(prisma.quizAnswer.upsert).toHaveBeenCalled();
    expect(lk.broadcast).toHaveBeenCalledWith('bd-room', 'quiz', { type: 'tally', quizId: 'q1', counts: [1, 3, 0], total: 4 }, [teacher.id]);
  });

  it('không trả lời được câu đã đóng', async () => {
    const { prisma, ctl } = setup();
    prisma.quiz.findFirst.mockResolvedValue(quiz({ closedAt: new Date() }));
    await expect(ctl.answer(student, 's1', 'q1', { choice: 0 })).rejects.toThrow('đã đóng');
  });

  it('giáo viên không tự trả lời', async () => {
    const { ctl } = setup();
    await expect(ctl.answer(teacher, 's1', 'q1', { choice: 0 })).rejects.toThrow('Giáo viên');
  });

  it('học viên không thấy kết quả và đáp án khi câu hỏi còn mở', async () => {
    const { prisma, ctl } = setup();
    prisma.quiz.findMany.mockResolvedValue([
      { ...quiz({ id: 'mo' }), answers: [{ choice: 2 }] },
      { ...quiz({ id: 'dong', closedAt: new Date() }), answers: [] },
    ]);
    const [open, closed] = await ctl.quizzes(student, 's1');
    expect(open).toMatchObject({ id: 'mo', mine: 2 });
    expect(open).not.toHaveProperty('correct');
    expect(open).not.toHaveProperty('counts');
    expect(closed).toMatchObject({ id: 'dong', correct: 1, total: 0 });
  });
});
