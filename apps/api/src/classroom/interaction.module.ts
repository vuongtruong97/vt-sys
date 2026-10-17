import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Quiz } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { ClassroomModule, ClassroomService } from './classroom.module';
import { LivekitService } from './livekit.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class ChatDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Tin nhắn đang trống' }) @MaxLength(1000, { message: 'Tin nhắn dài quá 1000 ký tự' })
  text: string;
}

class QuizDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Chưa nhập câu hỏi' }) @MaxLength(300, { message: 'Câu hỏi dài quá 300 ký tự' })
  question: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Cần ít nhất 2 lựa chọn' })
  @ArrayMaxSize(6, { message: 'Tối đa 6 lựa chọn' })
  @IsString({ each: true })
  @MaxLength(120, { each: true, message: 'Mỗi lựa chọn tối đa 120 ký tự' })
  options: string[];

  /** Vị trí đáp án đúng; bỏ trống nếu chỉ thăm dò ý kiến. */
  @IsOptional() @IsInt() @Min(0) @Max(5)
  correct?: number;
}

class AnswerDto {
  @IsInt() @Min(0) @Max(5)
  choice: number;
}

/** Chủ đề tin dữ liệu trong phòng; web lắng nghe đúng các tên này. */
export const TOPIC = { chat: 'chat', quiz: 'quiz' } as const;

/** Mỗi người gửi tối đa một tin mỗi 500 ms, chặn spam làm nghẽn phòng. */
const CHAT_GAP_MS = 500;

@Injectable()
export class InteractionService {
  private lastChat = new Map<string, number>();

  constructor(private prisma: PrismaService, private room: ClassroomService, private lk: LivekitService) {}

  /** Buổi học + vai trò; người chưa được vào lớp thì báo lỗi. */
  async member(user: AuthUser, sessionId: string) {
    const s = await this.room.session(sessionId);
    const role = await this.room.roleOf(user, s);
    if (!role) throw new ForbiddenException('Bạn chưa được vào lớp này');
    return { s, role };
  }

  throttle(userId: string) {
    const now = Date.now();
    if (now - (this.lastChat.get(userId) ?? 0) < CHAT_GAP_MS) {
      throw new BadRequestException('Bạn gửi nhanh quá, đợi một chút rồi gửi tiếp');
    }
    this.lastChat.set(userId, now);
  }

  async counts(quiz: Quiz) {
    const rows = await this.prisma.quizAnswer.groupBy({ by: ['choice'], where: { quizId: quiz.id }, _count: true });
    const counts = quiz.options.map((_, i) => rows.find((r) => r.choice === i)?._count ?? 0);
    return { counts, total: counts.reduce((a, b) => a + b, 0) };
  }

  /** Dạng gửi cho học viên khi câu hỏi đang mở: không lộ đáp án. */
  publicQuiz(q: Quiz) {
    return { id: q.id, question: q.question, options: q.options, closed: !!q.closedAt };
  }
}

@Controller('sessions/:id')
@UseGuards(AuthGuard)
export class InteractionController {
  constructor(private svc: InteractionService, private room: ClassroomService, private lk: LivekitService, private prisma: PrismaService) {}

  // ----- Trò chuyện -----

  @Get('chat')
  async chat(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.svc.member(user, id);
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, name: true } } },
    });
    return rows.reverse().map(toChat);
  }

  @Post('chat')
  async send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChatDto) {
    const { s } = await this.svc.member(user, id);
    if (s.status === 'ENDED' || s.status === 'CANCELLED') throw new BadRequestException('Buổi học đã kết thúc, không gửi tin được nữa');
    this.svc.throttle(user.id);
    const m = await this.prisma.chatMessage.create({
      data: { sessionId: id, userId: user.id, text: dto.text },
      include: { user: { select: { id: true, name: true } } },
    });
    const msg = toChat(m);
    await this.lk.broadcast(s.roomName, TOPIC.chat, msg);
    return msg;
  }

  // ----- Câu hỏi nhanh -----

  /**
   * Giáo viên: mọi câu hỏi của buổi kèm kết quả.
   * Học viên: câu hỏi đang mở (nếu có), lựa chọn của mình, và kết quả các câu đã đóng.
   */
  @Get('quizzes')
  async quizzes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { role } = await this.svc.member(user, id);
    const list = await this.prisma.quiz.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
      include: { answers: { where: { userId: user.id }, select: { choice: true } } },
    });
    return Promise.all(
      list.map(async (q) => {
        const showResult = role === 'teacher' || !!q.closedAt;
        return {
          ...this.svc.publicQuiz(q),
          mine: q.answers[0]?.choice ?? null,
          ...(showResult ? { correct: q.correct, ...(await this.svc.counts(q)) } : {}),
        };
      }),
    );
  }

  @Post('quizzes')
  async create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: QuizDto) {
    const s = await this.room.requireTeacher(user, id);
    const options = dto.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) throw new BadRequestException('Cần ít nhất 2 lựa chọn có nội dung');
    if (dto.correct != null && dto.correct >= options.length) throw new BadRequestException('Đáp án đúng không nằm trong các lựa chọn');
    // Mỗi lúc chỉ một câu hỏi mở: đóng câu trước nếu giáo viên quên.
    const open = await this.prisma.quiz.findMany({ where: { sessionId: id, closedAt: null } });
    for (const q of open) await this.close(s.roomName, q);
    const q = await this.prisma.quiz.create({
      data: { sessionId: id, question: dto.question, options, correct: dto.correct ?? null },
    });
    await this.lk.broadcast(s.roomName, TOPIC.quiz, { type: 'open', quiz: this.svc.publicQuiz(q) });
    return { ...this.svc.publicQuiz(q), correct: q.correct, counts: options.map(() => 0), total: 0 };
  }

  @Post('quizzes/:quizId/answer')
  @HttpCode(200)
  async answer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('quizId') quizId: string, @Body() dto: AnswerDto) {
    const { s, role } = await this.svc.member(user, id);
    if (role === 'teacher') throw new BadRequestException('Giáo viên không trả lời câu hỏi của mình');
    const q = await this.prisma.quiz.findFirst({ where: { id: quizId, sessionId: id } });
    if (!q) throw new NotFoundException('Không tìm thấy câu hỏi');
    if (q.closedAt) throw new BadRequestException('Câu hỏi đã đóng, không trả lời được nữa');
    if (dto.choice >= q.options.length) throw new BadRequestException('Lựa chọn không hợp lệ');
    // Được đổi ý cho tới khi giáo viên đóng câu hỏi.
    await this.prisma.quizAnswer.upsert({
      where: { quizId_userId: { quizId, userId: user.id } },
      create: { quizId, userId: user.id, choice: dto.choice },
      update: { choice: dto.choice },
    });
    await this.lk.broadcast(s.roomName, TOPIC.quiz, { type: 'tally', quizId, ...(await this.svc.counts(q)) }, [s.course.teacherId]);
    return { mine: dto.choice };
  }

  @Post('quizzes/:quizId/close')
  @HttpCode(200)
  async closeQuiz(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('quizId') quizId: string) {
    const s = await this.room.requireTeacher(user, id);
    const q = await this.prisma.quiz.findFirst({ where: { id: quizId, sessionId: id } });
    if (!q) throw new NotFoundException('Không tìm thấy câu hỏi');
    return this.close(s.roomName, q);
  }

  private async close(roomName: string, q: Quiz) {
    const closed = q.closedAt ? q : await this.prisma.quiz.update({ where: { id: q.id }, data: { closedAt: new Date() } });
    const result = { ...this.svc.publicQuiz(closed), correct: closed.correct, ...(await this.svc.counts(closed)) };
    await this.lk.broadcast(roomName, TOPIC.quiz, { type: 'close', quiz: result });
    return result;
  }
}

function toChat(m: { id: string; text: string; createdAt: Date; user: { id: string; name: string } }) {
  return { id: m.id, text: m.text, at: m.createdAt, from: { id: m.user.id, name: m.user.name } };
}

@Module({
  imports: [ClassroomModule],
  controllers: [InteractionController],
  providers: [InteractionService],
})
export class InteractionModule {}
