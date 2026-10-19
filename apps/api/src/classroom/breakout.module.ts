import { BadRequestException, Body, Controller, Get, HttpCode, Module, Param, Post, UseGuards } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { ClassroomModule, ClassroomService, groupRoom, hostIdOf } from './classroom.module';
import { LivekitService } from './livekit.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class GroupDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) name: string;
  @IsArray() @IsString({ each: true }) @ArrayMaxSize(60) members: string[];
}

class StartDto {
  @IsArray()
  @ArrayMinSize(2, { message: 'Cần ít nhất 2 nhóm' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 nhóm' })
  @ValidateNested({ each: true })
  @Type(() => GroupDto)
  groups: GroupDto[];

  /** Hẹn gọi các nhóm về sau bao nhiêu phút; chỉ để hiện đồng hồ. */
  @IsOptional() @IsInt() @Min(1) @Max(180) minutes?: number;
}

class AnnounceDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Thông báo đang trống' }) @MaxLength(300) text: string;
}

/** Chủ đề tin dữ liệu điều khiển chia nhóm; web lắng nghe đúng tên này. */
export const BREAKOUT_TOPIC = 'breakout';

/**
 * Chia nhóm nhỏ. Mỗi nhóm là một phòng LiveKit `<roomName>-g<index>`.
 * Server quyết định ai vào phòng nào (POST /sessions/:id/join); tin "start"/"end" chỉ báo trình duyệt gọi lại join.
 */
@Controller('sessions/:id/breakouts')
@UseGuards(AuthGuard)
export class BreakoutController {
  constructor(private prisma: PrismaService, private room: ClassroomService, private lk: LivekitService) {}

  /** Giáo viên: các nhóm và số người đang trong từng phòng nhóm. */
  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.requireTeacher(user, id);
    const groups = await this.prisma.breakoutGroup.findMany({ where: { sessionId: id }, orderBy: { index: 'asc' } });
    return {
      active: s.breakoutActive,
      endsAt: s.breakoutEndsAt,
      groups: await Promise.all(
        groups.map(async (g) => ({
          index: g.index,
          name: g.name,
          members: g.members,
          online: s.breakoutActive
            ? (await this.lk.rooms.listParticipants(groupRoom(s.roomName, g.index)).catch(() => [])).map((p) => p.identity)
            : [],
        })),
      ),
    };
  }

  @Post()
  @HttpCode(200)
  async start(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StartDto) {
    const s = await this.room.requireTeacher(user, id);
    if (s.status !== 'LIVE') throw new BadRequestException('Chỉ chia nhóm được khi lớp đang diễn ra');
    if (s.breakoutActive) throw new BadRequestException('Lớp đang chia nhóm, gọi các nhóm về trước khi chia lại');
    const seen = new Set<string>();
    for (const g of dto.groups) {
      for (const m of g.members) {
        if (m === hostIdOf(s)) throw new BadRequestException('Giáo viên không cần xếp vào nhóm, ghé nhóm nào cũng được');
        if (seen.has(m)) throw new BadRequestException('Một học viên đang nằm trong hai nhóm');
        seen.add(m);
      }
    }
    if (seen.size === 0) throw new BadRequestException('Chưa xếp học viên nào vào nhóm');

    const endsAt = dto.minutes ? new Date(Date.now() + dto.minutes * 60_000) : null;
    await this.prisma.$transaction([
      this.prisma.breakoutGroup.deleteMany({ where: { sessionId: id } }),
      this.prisma.breakoutGroup.createMany({
        data: dto.groups.map((g, index) => ({ sessionId: id, index, name: g.name, members: g.members })),
      }),
      this.prisma.classSession.update({ where: { id }, data: { breakoutActive: true, breakoutEndsAt: endsAt } }),
    ]);
    // Tạo sẵn phòng nhóm để học viên chuyển sang nhanh.
    for (let i = 0; i < dto.groups.length; i++) {
      await this.lk.ensureRoom(groupRoom(s.roomName, i), { board: false, allowStudentShare: s.allowStudentShare });
    }
    await this.lk.broadcast(s.roomName, BREAKOUT_TOPIC, { type: 'start', endsAt }, [...seen]);
    return { active: true, endsAt, groups: dto.groups.length };
  }

  /** Gọi các nhóm về phòng chính. */
  @Post('end')
  @HttpCode(204)
  async end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.requireTeacher(user, id);
    if (!s.breakoutActive) return;
    const rooms = await this.room.rooms(s);
    await this.prisma.classSession.update({ where: { id }, data: { breakoutActive: false, breakoutEndsAt: null } });
    for (const r of rooms.slice(1)) {
      await this.lk.broadcast(r, BREAKOUT_TOPIC, { type: 'end' });
    }
    // Phòng nhóm tự đóng khi trống (emptyTimeout); không xoá ngay để trình duyệt kịp nhận tin "end".
  }

  /** Giáo viên nhắn cho mọi nhóm, ví dụ "còn 2 phút". */
  @Post('announce')
  @HttpCode(204)
  async announce(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AnnounceDto) {
    const s = await this.room.requireTeacher(user, id);
    if (!s.breakoutActive) throw new BadRequestException('Lớp đang không chia nhóm');
    for (const r of (await this.room.rooms(s)).slice(1)) {
      await this.lk.broadcast(r, BREAKOUT_TOPIC, { type: 'announce', text: dto.text, from: user.name });
    }
  }
}

@Module({ imports: [ClassroomModule], controllers: [BreakoutController] })
export class BreakoutModule {}
