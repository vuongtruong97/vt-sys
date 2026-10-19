import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthGuard, AuthUser, CurrentUser, currentUser, denied } from '../auth/auth.guard';
import { can } from '../auth/permissions';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { ClassroomModule, ClassroomService, isMeeting } from './classroom.module';
import { LIVE_PLAYLIST, LiveStreamService } from './live.service';

class StartLiveDto {
  /** true: ai có link cũng xem được. Mặc định chỉ thành viên khoá. */
  @IsOptional() @IsBoolean() public?: boolean;
}

/** Chỉ cho đọc playlist và đoạn video, không có dấu "/" để không đi ra ngoài thư mục luồng. */
const HLS_FILE = /^[\w-]+\.(m3u8|ts|m4s|mp4)$/;

@Controller()
export class WebinarController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private room: ClassroomService,
    private live: LiveStreamService,
  ) {}

  // ----- Giáo viên -----

  @Post('sessions/:id/live/start')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async start(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StartLiveDto) {
    const s = await this.room.requireTeacher(user, id);
    if (!can(user, 'session.record')) throw denied(['session.record']);
    if (isMeeting(s)) throw new BadRequestException('Meeting chưa hỗ trợ phát trực tiếp');
    if (s.status !== 'LIVE') throw new BadRequestException('Chỉ phát trực tiếp được khi lớp đang diễn ra');
    const live = await this.live.start(s, dto.public ?? false);
    return { status: live.status, public: live.public, watchPath: `/live/${id}` };
  }

  @Post('sessions/:id/live/stop')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async stop(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.requireTeacher(user, id);
    await this.live.stop(s);
  }

  // ----- Người xem (không cần vào phòng LiveKit) -----

  /** Thông tin trang xem: luồng công khai thì không cần đăng nhập. */
  @Get('live/:id')
  async info(@Req() req: Request, @Param('id') id: string) {
    const { s, stream } = await this.load(id);
    const canWatch = await this.canWatch(req, s, stream?.public ?? false);
    return {
      id: s.id,
      title: s.title,
      course: s.course?.title ?? null,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: stream?.status ?? null,
      public: stream?.public ?? false,
      canWatch,
      // Đang phát: playlist cửa sổ trượt; đã xong: playlist đầy đủ để xem lại.
      playlist: stream && canWatch ? `/api/live/${id}/${stream.status === 'READY' ? 'index.m3u8' : LIVE_PLAYLIST}` : null,
    };
  }

  /**
   * Chuyển tiếp playlist và đoạn video từ bucket. Header Cache-Control để CDN (Cloudflare…) cache được:
   * đoạn video không bao giờ đổi, playlist trực tiếp đổi vài giây một lần.
   */
  // Trình phát tải playlist, đoạn video liên tục: không tính vào giới hạn.
  @SkipThrottle()
  @Get('live/:id/:file')
  async file(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Param('file') file: string) {
    if (!HLS_FILE.test(file)) throw new NotFoundException('Không có file này');
    const { s, stream } = await this.load(id);
    if (!stream) throw new NotFoundException('Buổi học chưa phát trực tiếp');
    if (!(await this.canWatch(req, s, stream.public))) throw new ForbiddenException('Bạn không có quyền xem buổi học này');

    let obj;
    try {
      obj = await this.storage.get(`${stream.prefix}/${file}`);
    } catch {
      // Lúc mới bắt đầu, playlist chưa kịp có trên bucket; trình phát tự thử lại.
      throw new NotFoundException('Luồng chưa sẵn sàng, thử lại sau vài giây');
    }
    const scope = stream.public ? 'public' : 'private';
    const isPlaylist = file.endsWith('.m3u8');
    res.setHeader('Content-Type', isPlaylist ? 'application/vnd.apple.mpegurl' : obj.contentType || 'video/mp2t');
    res.setHeader(
      'Cache-Control',
      isPlaylist && stream.status !== 'READY' ? `${scope}, max-age=2` : `${scope}, max-age=86400, immutable`,
    );
    if (obj.length != null) res.setHeader('Content-Length', String(obj.length));
    obj.body.pipe(res);
  }

  private async load(id: string) {
    const s = await this.room.session(id);
    const stream = await this.prisma.liveStream.findUnique({ where: { sessionId: id } });
    return { s, stream };
  }

  private async canWatch(req: Request, s: Awaited<ReturnType<ClassroomService['session']>>, isPublic: boolean) {
    if (isPublic) return true;
    const user = await currentUser(req, this.prisma);
    return !!user && (await this.room.roleOf(user, s)) !== null;
  }
}

@Module({ imports: [ClassroomModule], controllers: [WebinarController] })
export class WebinarModule {}
