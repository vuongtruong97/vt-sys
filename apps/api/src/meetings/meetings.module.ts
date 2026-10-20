import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Need, PermissionGuard } from '../auth/auth.guard';
import { ClassroomModule, ClassroomService } from '../classroom/classroom.module';
import { LivekitService } from '../classroom/livekit.service';
import { PrismaService } from '../common/prisma.service';

class MeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên cuộc họp cần ít nhất 2 ký tự' })
  @MaxLength(160)
  title?: string;

  /** Bỏ trống là họp ngay. */
  @IsOptional() @IsISO8601() startsAt?: string;

  @IsOptional() @IsInt() @Min(15) @Max(240) durationMinutes?: number;
}

/**
 * Meeting độc lập kiểu Google Meet: buổi không thuộc khoá học, chủ phòng là người tạo.
 * Hai loại link mời: `/room/:id` thì xin vào qua phòng chờ như buổi học (POST /sessions/:id/join);
 * `/room/:id?key=<inviteKey>` thì vào thẳng. Chỉ chủ phòng thấy inviteKey.
 */
@Controller('meetings')
@UseGuards(PermissionGuard)
@Need('meeting.create')
export class MeetingsController {
  constructor(private prisma: PrismaService, private room: ClassroomService, private lk: LivekitService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: MeetingDto) {
    const now = Date.now();
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date(now);
    // Hẹn giờ trong quá khứ (lệch đồng hồ vài phút thì bỏ qua).
    if (dto.startsAt && startsAt.getTime() < now - 5 * 60_000) throw new BadRequestException('Giờ bắt đầu đã qua');
    const endsAt = new Date(startsAt.getTime() + (dto.durationMinutes ?? 120) * 60_000);
    const m = await this.prisma.classSession.create({
      data: {
        hostId: user.id,
        title: dto.title?.trim() || `Cuộc họp của ${user.name}`,
        startsAt,
        endsAt,
        roomName: `bd-${randomBytes(6).toString('hex')}`,
        inviteKey: randomBytes(12).toString('base64url'),
      },
    });
    return { id: m.id, title: m.title, startsAt: m.startsAt, endsAt: m.endsAt, status: m.status, inviteKey: m.inviteKey };
  }

  /** Meeting mình tạo, mới nhất trước. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.classSession.findMany({
      where: { hostId: user.id },
      orderBy: { startsAt: 'desc' },
      take: 50,
      select: { id: true, title: true, startsAt: true, endsAt: true, status: true, inviteKey: true },
    });
  }

  @Post(':id/cancel')
  @HttpCode(204)
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.requireTeacher(user, id);
    if (s.courseId) throw new BadRequestException('Đây là buổi học của khoá, huỷ trong trang quản lý lớp');
    const rooms = await this.room.rooms(s);
    await this.prisma.classSession.update({ where: { id }, data: { status: 'CANCELLED', breakoutActive: false } });
    if (s.status === 'LIVE') {
      for (const r of rooms) await this.lk.rooms.deleteRoom(r).catch(() => {});
    }
  }
}

@Module({ imports: [ClassroomModule], controllers: [MeetingsController] })
export class MeetingsModule {}
