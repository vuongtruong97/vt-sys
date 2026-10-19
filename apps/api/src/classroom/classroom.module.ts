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
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { ClassSession, Course } from '@prisma/client';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookReceiver } from 'livekit-server-sdk';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { LivekitService, RoomRole } from './livekit.service';
import { LiveStreamService } from './live.service';
import { RecordingService } from './recording.service';

class IdentityDto {
  @IsString() identity: string;
}
class AllowDto {
  @IsBoolean() allow: boolean;
}
class OpenDto {
  @IsBoolean() open: boolean;
  /** Mở bảng nào; bỏ trống là bảng phấn. */
  @IsOptional() @IsIn(['chalk', 'ggb']) kind?: 'chalk' | 'ggb';
}
class DecideDto {
  @IsBoolean() approve: boolean;
}
class JoinDto {
  /** Giáo viên chọn ghé nhóm nào khi đang chia nhóm; bỏ trống là phòng chính. Học viên gửi lên sẽ bị bỏ qua. */
  @IsOptional() @IsInt() @Min(0) group?: number;
}

/** Buổi học (có khoá học) hoặc meeting độc lập (course = null, chủ phòng là hostId). */
export type SessionWithCourse = ClassSession & { course: Course | null };

/** Chủ phòng: giáo viên của khoá học, hoặc người tạo meeting. */
export const hostIdOf = (s: SessionWithCourse): string => s.course?.teacherId ?? s.hostId ?? '';
export const isMeeting = (s: ClassSession) => !s.courseId;

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
    if (hostIdOf(s) === user.id) return 'teacher';
    if (s.courseId) {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: s.courseId } },
      });
      if (enrolled) return 'student';
    }
    const req = await this.prisma.joinRequest.findUnique({
      where: { sessionId_userId: { sessionId: s.id, userId: user.id } },
    });
    return req?.status === 'APPROVED' ? 'student' : null;
  }

  async requireTeacher(user: AuthUser, id: string) {
    const s = await this.session(id);
    if (hostIdOf(s) !== user.id) {
      throw new ForbiddenException(isMeeting(s) ? 'Chỉ chủ phòng làm được thao tác này' : 'Chỉ giáo viên của lớp làm được thao tác này');
    }
    return s;
  }

  /** Mọi phòng LiveKit của buổi: phòng chính và các phòng nhóm đang mở. Dùng để phát tin cho cả lớp. */
  async rooms(s: ClassSession): Promise<string[]> {
    if (!s.breakoutActive) return [s.roomName];
    const groups = await this.prisma.breakoutGroup.findMany({ where: { sessionId: s.id }, select: { index: true } });
    return [s.roomName, ...groups.map((g) => groupRoom(s.roomName, g.index))];
  }
}

export const groupRoom = (roomName: string, index: number) => `${roomName}-g${index}`;
/** Tên phòng chính từ tên phòng nhóm; phòng chính thì trả về chính nó. */
export const mainRoom = (name: string) => name.replace(/-g\d+$/, '');

@Controller('sessions')
@UseGuards(AuthGuard)
export class ClassroomController {
  constructor(
    private svc: ClassroomService,
    private lk: LivekitService,
    private prisma: PrismaService,
    private recordings: RecordingService,
    private live: LiveStreamService,
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
      kind: isMeeting(s) ? 'meeting' : 'class',
      course: s.course ? { id: s.course.id, title: s.course.title } : null,
      role,
    };
  }

  /**
   * Vào lớp. Trả về token LiveKit, hoặc trạng thái chờ duyệt với người ngoài danh sách lớp.
   * Trình duyệt gọi lại endpoint này mỗi vài giây khi đang chờ.
   */
  @Post(':id/join')
  @HttpCode(200)
  async join(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: JoinDto = {}) {
    const s = await this.svc.session(id);
    if (s.status === 'CANCELLED') throw new BadRequestException(isMeeting(s) ? 'Meeting này đã bị huỷ' : 'Buổi học này đã bị huỷ');

    const role = await this.svc.roleOf(user, s);
    if (!role) {
      const req = await this.prisma.joinRequest.upsert({
        where: { sessionId_userId: { sessionId: s.id, userId: user.id } },
        create: { sessionId: s.id, userId: user.id },
        update: {},
      });
      return { status: req.status === 'DENIED' ? 'denied' : 'waiting' };
    }

    // Giáo viên đã mở lớp (LIVE) thì học viên vào được ngay, kể cả khi mở sớm hơn lịch.
    if (role === 'student' && s.status !== 'LIVE') {
      const now = Date.now();
      const opens = s.startsAt.getTime() - config.openBeforeMinutes * 60_000;
      const closes = s.endsAt.getTime() + config.closeAfterMinutes * 60_000;
      if (now < opens) throw new ForbiddenException(`Lớp mở cửa lúc ${fmtTime(new Date(opens))}`);
      if (now > closes || s.status === 'ENDED') throw new ForbiddenException('Buổi học đã kết thúc');
    } else if (s.status === 'SCHEDULED' || s.status === 'ENDED') {
      await this.prisma.classSession.update({ where: { id: s.id }, data: { status: 'LIVE' } });
    }

    // Đang chia nhóm: học viên vào phòng nhóm của mình, giáo viên vào nhóm đã chọn.
    let group: { index: number; name: string; count: number; endsAt: Date | null } | null = null;
    if (s.breakoutActive) {
      const groups = await this.prisma.breakoutGroup.findMany({ where: { sessionId: s.id }, orderBy: { index: 'asc' } });
      const g =
        role === 'teacher'
          ? dto.group != null ? groups.find((x) => x.index === dto.group) : undefined
          : groups.find((x) => x.members.includes(user.id));
      if (role === 'teacher' && dto.group != null && !g) throw new BadRequestException('Không có nhóm này');
      if (g) group = { index: g.index, name: g.name, count: groups.length, endsAt: s.breakoutEndsAt };
    }
    const room = group ? groupRoom(s.roomName, group.index) : s.roomName;

    await this.lk.ensureRoom(room, { board: false, allowStudentShare: s.allowStudentShare });
    const token = await this.lk.token({
      room,
      identity: user.id,
      name: user.name,
      role,
      allowStudentShare: s.allowStudentShare,
    });
    return { status: 'ok', role, token, url: config.livekit.publicUrl, group };
  }

  /** Token cho máy chủ bảng trắng (Hocuspocus). */
  /** Token cho máy chủ bảng trắng (Hocuspocus). `kind=ggb` là bảng GeoGebra: chỉ giáo viên được ghi (máy chủ chặn). */
  @Get(':id/board-token')
  async boardToken(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('kind') kind?: string) {
    const s = await this.svc.session(id);
    const role = await this.svc.roleOf(user, s);
    if (!role) throw new ForbiddenException('Bạn chưa được vào lớp này');
    const document = `${kind === 'ggb' ? 'ggb' : 'session'}:${s.id}`;
    const token = jwt.sign({ sub: user.id, name: user.name, role, doc: document }, config.whiteboardSecret, { expiresIn: '4h' });
    return { token, document };
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
    // Học viên có thể đang ở phòng nhóm: thử từng phòng của buổi.
    for (const r of await this.svc.rooms(s)) await this.lk.muteMic(r, dto.identity).catch(() => {});
  }

  @Post(':id/mod/mute-all')
  @HttpCode(204)
  async muteAll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.requireTeacher(user, id);
    for (const r of await this.svc.rooms(s)) {
      for (const p of await this.lk.students(r).catch(() => [])) await this.lk.muteMic(r, p.identity).catch(() => {});
    }
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
    // Bỏ khỏi nhóm để vào lại không được xếp về nhóm cũ.
    const groups = await this.prisma.breakoutGroup.findMany({ where: { sessionId: id } });
    for (const g of groups.filter((x) => x.members.includes(dto.identity))) {
      await this.prisma.breakoutGroup.update({ where: { id: g.id }, data: { members: g.members.filter((m) => m !== dto.identity) } });
    }
    for (const r of await this.svc.rooms(s)) await this.lk.rooms.removeParticipant(r, dto.identity).catch(() => {});
  }

  @Post(':id/mod/allow-share')
  @HttpCode(200)
  async allowShare(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AllowDto) {
    const s = await this.svc.requireTeacher(user, id);
    await this.prisma.classSession.update({ where: { id }, data: { allowStudentShare: dto.allow } });
    const [main, ...groups] = await this.svc.rooms(s);
    for (const r of groups) {
      await this.lk.setStudentShare(r, dto.allow).catch(() => {});
      await this.lk.patchMeta(r, { allowStudentShare: dto.allow }).catch(() => {});
    }
    await this.lk.setStudentShare(main, dto.allow);
    return this.lk.patchMeta(main, { allowStudentShare: dto.allow });
  }

  @Post(':id/mod/board')
  @HttpCode(200)
  async board(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OpenDto) {
    const s = await this.svc.requireTeacher(user, id);
    return this.lk.patchMeta(s.roomName, dto.open ? { board: true, boardKind: dto.kind ?? 'chalk' } : { board: false });
  }

  @Post(':id/end')
  @HttpCode(204)
  async end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.svc.requireTeacher(user, id);
    const rooms = await this.svc.rooms(s);
    await this.prisma.classSession.update({ where: { id }, data: { status: 'ENDED', breakoutActive: false } });
    // Dừng ghi hình trước khi đóng phòng để egress kịp ghi xong file.
    if (await this.recordings.active(id)) await this.recordings.stop(s).catch(() => {});
    await this.live.stop(s).catch(() => {});
    for (const r of rooms) {
      try {
        await this.lk.rooms.deleteRoom(r);
      } catch {
        /* phòng đã đóng */
      }
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
      // Meeting không có danh sách lớp: chỉ liệt kê người đã vào.
      s.courseId
        ? this.prisma.enrollment.findMany({
            where: { courseId: s.courseId },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
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
    const teacherId = hostIdOf(s);
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
@SkipThrottle()
@Controller('webhooks')
export class WebhookController {
  private log = new Logger('Webhook');
  private receiver = new WebhookReceiver(config.livekit.apiKey, config.livekit.apiSecret);
  constructor(private prisma: PrismaService, private recordings: RecordingService, private live: LiveStreamService) {}

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
      if (!(await this.live.onEgress(event.egressInfo))) await this.recordings.onEgress(event.egressInfo);
      this.log.debug(`${event.event} ${event.egressInfo.egressId}`);
      return { ok: true };
    }

    const roomName = event.room?.name;
    if (!roomName) return { ok: true };
    // Phòng nhóm (`<roomName>-g<n>`) ghi điểm danh vào cùng buổi học với phòng chính.
    const isGroup = mainRoom(roomName) !== roomName;
    const session = await this.prisma.classSession.findUnique({ where: { roomName: mainRoom(roomName) } });
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
        // Phòng nhóm đóng không có nghĩa buổi học kết thúc; ai rời phòng nhóm đã có participant_left.
        if (isGroup) break;
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
  providers: [ClassroomService, LivekitService, RecordingService, LiveStreamService],
  exports: [ClassroomService, LivekitService, RecordingService, LiveStreamService],
})
export class ClassroomModule {}
