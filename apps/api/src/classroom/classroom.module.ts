import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { ClassSession, Course } from '@prisma/client';
import { IsBoolean, IsString } from 'class-validator';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { WebhookReceiver } from 'livekit-server-sdk';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { LivekitService, RoomRole } from './livekit.service';
import { RecordingService } from './recording.service';

class IdentityDto {
  @IsString() identity: string;
}
class AllowDto {
  @IsBoolean() allow: boolean;
}
class OpenDto {
  @IsBoolean() open: boolean;
}
class DecideDto {
  @IsBoolean() approve: boolean;
}

type SessionWithCourse = ClassSession & { course: Course };

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || 'Asia/Ho_Chi_Minh' });

@Injectable()
export class ClassroomService {
  constructor(private prisma: PrismaService, private lk: LivekitService) {}

  async session(id: string): Promise<SessionWithCourse> {
    const s = await this.prisma.classSession.findUnique({ where: { id }, include: { course: true } });
    if (!s) throw new NotFoundException('Không tìm thấy buổi học');
    return s;
  }

  /** Vai trò của người dùng trong buổi học, hoặc null nếu chưa có quyền vào. */
  async roleOf(user: AuthUser, s: SessionWithCourse): Promise<RoomRole | null> {
    if (s.course.teacherId === user.id) return 'teacher';
    const enrolled = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: s.courseId } },
    });
    if (enrolled) return 'student';
    const req = await this.prisma.joinRequest.findUnique({
      where: { sessionId_userId: { sessionId: s.id, userId: user.id } },
    });
    return req?.status === 'APPROVED' ? 'student' : null;
  }

  async requireTeacher(user: AuthUser, id: string) {
    const s = await this.session(id);
    if (s.course.teacherId !== user.id) throw new ForbiddenException('Chỉ giáo viên của lớp làm được thao tác này');
    return s;
  }
}

@Controller('sessions')
@UseGuards(AuthGuard)
export class ClassroomController {
  constructor(
    private svc: ClassroomService,
    private lk: LivekitService,
    private prisma: PrismaService,
    private recordings: RecordingService,
  ) {}

  @Get(':id')
  async info(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.session(id);
    const role = await this.svc.roleOf(user, s);
    return {
      id: s.id,
      title: s.title,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      course: { id: s.course.id, title: s.course.title },
      role,
    };
  }

  /**
   * Vào lớp. Trả về token LiveKit, hoặc trạng thái chờ duyệt với người ngoài danh sách lớp.
   * Trình duyệt gọi lại endpoint này mỗi vài giây khi đang chờ.
   */
  @Post(':id/join')
  @HttpCode(200)
  async join(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.session(id);
    if (s.status === 'CANCELLED') throw new BadRequestException('Buổi học này đã bị huỷ');

    const role = await this.svc.roleOf(user, s);
    if (!role) {
      const req = await this.prisma.joinRequest.upsert({
        where: { sessionId_userId: { sessionId: s.id, userId: user.id } },
        create: { sessionId: s.id, userId: user.id },
        update: {},
      });
      return { status: req.status === 'DENIED' ? 'denied' : 'waiting' };
    }

    if (role === 'student') {
      const now = Date.now();
      const opens = s.startsAt.getTime() - config.openBeforeMinutes * 60_000;
      const closes = s.endsAt.getTime() + config.closeAfterMinutes * 60_000;
      if (now < opens) throw new ForbiddenException(`Lớp mở cửa lúc ${fmtTime(new Date(opens))}`);
      if (now > closes || s.status === 'ENDED') throw new ForbiddenException('Buổi học đã kết thúc');
    } else if (s.status === 'SCHEDULED' || s.status === 'ENDED') {
      await this.prisma.classSession.update({ where: { id: s.id }, data: { status: 'LIVE' } });
    }

    await this.lk.ensureRoom(s.roomName, { board: false, allowStudentShare: s.allowStudentShare });
    const token = await this.lk.token({
      room: s.roomName,
      identity: user.id,
      name: user.name,
      role,
      allowStudentShare: s.allowStudentShare,
    });
    return { status: 'ok', role, token, url: config.livekit.publicUrl };
  }

  /** Token cho máy chủ bảng trắng (Hocuspocus). */
  @Get(':id/board-token')
  async boardToken(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.session(id);
    const role = await this.svc.roleOf(user, s);
    if (!role) throw new ForbiddenException('Bạn chưa được vào lớp này');
    const token = jwt.sign({ sub: user.id, name: user.name, role, doc: `session:${s.id}` }, config.whiteboardSecret, {
      expiresIn: '4h',
    });
    return { token, document: `session:${s.id}` };
  }

  // ----- Phòng chờ -----

  @Get(':id/join-requests')
  async requests(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.svc.requireTeacher(user, id);
    return this.prisma.joinRequest.findMany({
      where: { sessionId: id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  @Post(':id/join-requests/:reqId')
  @HttpCode(200)
  async decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() dto: DecideDto,
  ) {
    await this.svc.requireTeacher(user, id);
    const r = await this.prisma.joinRequest.findFirst({ where: { id: reqId, sessionId: id } });
    if (!r) throw new NotFoundException('Không tìm thấy yêu cầu');
    return this.prisma.joinRequest.update({
      where: { id: reqId },
      data: { status: dto.approve ? 'APPROVED' : 'DENIED' },
    });
  }

  // ----- Quyền giáo viên -----

  @Post(':id/mod/mute')
  @HttpCode(204)
  async mute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: IdentityDto) {
    const s = await this.svc.requireTeacher(user, id);
    await this.lk.muteMic(s.roomName, dto.identity);
  }

  @Post(':id/mod/mute-all')
  @HttpCode(204)
  async muteAll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.requireTeacher(user, id);
    for (const p of await this.lk.students(s.roomName)) await this.lk.muteMic(s.roomName, p.identity);
  }

  @Post(':id/mod/remove')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: IdentityDto) {
    const s = await this.svc.requireTeacher(user, id);
    if (dto.identity === user.id) throw new BadRequestException('Không thể mời chính mình ra khỏi lớp');
    // Thu quyền vào lại nếu người này vào qua phòng chờ.
    await this.prisma.joinRequest.updateMany({
      where: { sessionId: id, userId: dto.identity },
      data: { status: 'DENIED' },
    });
    await this.lk.rooms.removeParticipant(s.roomName, dto.identity);
  }

  @Post(':id/mod/allow-share')
  @HttpCode(200)
  async allowShare(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AllowDto) {
    const s = await this.svc.requireTeacher(user, id);
    await this.prisma.classSession.update({ where: { id }, data: { allowStudentShare: dto.allow } });
    await this.lk.setStudentShare(s.roomName, dto.allow);
    return this.lk.patchMeta(s.roomName, { allowStudentShare: dto.allow });
  }

  @Post(':id/mod/board')
  @HttpCode(200)
  async board(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OpenDto) {
    const s = await this.svc.requireTeacher(user, id);
    return this.lk.patchMeta(s.roomName, { board: dto.open });
  }

  @Post(':id/end')
  @HttpCode(204)
  async end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.requireTeacher(user, id);
    await this.prisma.classSession.update({ where: { id }, data: { status: 'ENDED' } });
    // Dừng ghi hình trước khi đóng phòng để egress kịp ghi xong file.
    if (await this.recordings.active(id)) await this.recordings.stop(s).catch(() => {});
    try {
      await this.lk.rooms.deleteRoom(s.roomName);
    } catch {
      /* phòng đã đóng */
    }
  }

  // ----- Điểm danh -----

  @Get(':id/attendance')
  async attendance(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.requireTeacher(user, id);
    const [rows, enrolled] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { sessionId: id },
        orderBy: { joinedAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.enrollment.findMany({
        where: { courseId: s.courseId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    type Row = {
      user: { id: string; name: string; email: string };
      firstJoin: Date | null;
      lastLeave: Date | null;
      minutes: number;
      visits: number;
      present: boolean;
    };
    const byUser = new Map<string, Row>();
    const now = Date.now();
    for (const r of rows) {
      const cur: Row = byUser.get(r.userId) ?? { user: r.user, firstJoin: r.joinedAt, lastLeave: null, minutes: 0, visits: 0, present: true };
      const end = r.leftAt?.getTime() ?? now;
      cur.minutes += Math.max(0, (end - r.joinedAt.getTime()) / 60_000);
      cur.visits += 1;
      if (r.leftAt && (!cur.lastLeave || r.leftAt > cur.lastLeave)) cur.lastLeave = r.leftAt;
      byUser.set(r.userId, cur);
    }
    const teacherId = s.course.teacherId;
    const result: Row[] = [...byUser.values()]
      .filter((v) => v.user.id !== teacherId)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }));
    for (const e of enrolled) {
      if (!byUser.has(e.userId)) {
        result.push({ user: e.user, firstJoin: null, lastLeave: null, minutes: 0, visits: 0, present: false });
      }
    }
    return { session: { id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt }, rows: result };
  }
}

/** LiveKit gọi về đây khi có người vào/ra phòng; dùng để điểm danh. */
@Controller('webhooks')
export class WebhookController {
  private log = new Logger('Webhook');
  private receiver = new WebhookReceiver(config.livekit.apiKey, config.livekit.apiSecret);
  constructor(private prisma: PrismaService, private recordings: RecordingService) {}

  @Post('livekit')
  @HttpCode(200)
  async livekit(@Req() req: Request & { rawBody?: Buffer }, @Headers('authorization') auth?: string) {
    if (!req.rawBody) throw new BadRequestException('Thiếu nội dung');
    let event;
    try {
      event = await this.receiver.receive(req.rawBody.toString('utf8'), auth);
    } catch {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
    if (event.egressInfo && event.event.startsWith('egress_')) {
      await this.recordings.onEgress(event.egressInfo);
      this.log.debug(`${event.event} ${event.egressInfo.egressId}`);
      return { ok: true };
    }

    const roomName = event.room?.name;
    if (!roomName) return { ok: true };
    const session = await this.prisma.classSession.findUnique({ where: { roomName } });
    if (!session) return { ok: true };

    const at = event.createdAt ? new Date(Number(event.createdAt) * 1000) : new Date();
    const userId = event.participant?.identity;

    switch (event.event) {
      case 'participant_joined':
        if (userId && (await this.prisma.user.findUnique({ where: { id: userId } }))) {
          await this.prisma.attendance.create({ data: { sessionId: session.id, userId, joinedAt: at } });
        }
        break;
      case 'participant_left':
        if (userId) {
          const open = await this.prisma.attendance.findFirst({
            where: { sessionId: session.id, userId, leftAt: null },
            orderBy: { joinedAt: 'desc' },
          });
          if (open) await this.prisma.attendance.update({ where: { id: open.id }, data: { leftAt: at } });
        }
        break;
      case 'room_finished':
        await this.prisma.attendance.updateMany({ where: { sessionId: session.id, leftAt: null }, data: { leftAt: at } });
        if (session.status === 'LIVE') {
          await this.prisma.classSession.update({ where: { id: session.id }, data: { status: 'ENDED' } });
        }
        break;
    }
    this.log.debug(`${event.event} ${roomName} ${userId ?? ''}`);
    return { ok: true };
  }
}

@Module({
  controllers: [ClassroomController, WebhookController],
  providers: [ClassroomService, LivekitService, RecordingService],
  exports: [ClassroomService, LivekitService, RecordingService],
})
export class ClassroomModule {}
