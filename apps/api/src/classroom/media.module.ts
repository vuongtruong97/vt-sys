import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Recording } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { randomBytes } from 'crypto';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { ClassroomModule, ClassroomService } from './classroom.module';
import { RecordingService } from './recording.service';

class UploadDto {
  /** Gắn tài liệu với một buổi học của khoá; bỏ trống là tài liệu chung của khoá. */
  @IsOptional() @IsString() sessionId?: string;
}

/** Ai được xem tài liệu và bản ghi của khoá: giáo viên dạy khoá, học viên đã đăng ký. */
@Injectable()
export class CourseAccess {
  constructor(private prisma: PrismaService) {}

  async check(user: AuthUser, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    if (course.teacherId === user.id) return { course, teacher: true };
    const enrolled = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
    if (!enrolled) throw new ForbiddenException('Bạn chưa đăng ký khoá học này');
    return { course, teacher: false };
  }
}

function toRecording(r: Recording) {
  return {
    id: r.id,
    status: r.status,
    durationSec: r.durationSec,
    sizeBytes: r.sizeBytes != null ? Number(r.sizeBytes) : null,
    error: r.error,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  };
}

/** Bỏ ký tự đường dẫn và ký tự lạ khỏi tên file, giữ chữ tiếng Việt. */
function safeName(name: string) {
  // multer đọc tên file theo latin1; đổi lại sang UTF-8 để giữ dấu tiếng Việt.
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 160) || 'tai-lieu';
}

@Controller()
@UseGuards(AuthGuard)
export class MediaController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private room: ClassroomService,
    private recordings: RecordingService,
    private access: CourseAccess,
  ) {}

  // ----- Ghi hình -----

  @Post('sessions/:id/recording/start')
  @HttpCode(200)
  async startRecording(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.requireTeacher(user, id);
    if (s.status !== 'LIVE') throw new BadRequestException('Chỉ ghi hình được khi lớp đang diễn ra');
    return toRecording(await this.recordings.start(s));
  }

  @Post('sessions/:id/recording/stop')
  @HttpCode(204)
  async stopRecording(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.requireTeacher(user, id);
    await this.recordings.stop(s);
  }

  /** Giáo viên thấy mọi bản ghi; học viên chỉ thấy bản đã xử lý xong. */
  @Get('sessions/:id/recordings')
  async listRecordings(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await this.room.session(id);
    const { teacher } = await this.access.check(user, s.courseId);
    const rows = await this.prisma.recording.findMany({
      where: { sessionId: id, ...(teacher ? {} : { status: 'READY' }) },
      orderBy: { startedAt: 'asc' },
    });
    return rows.map(toRecording);
  }

  @Get('recordings/:id/url')
  async recordingUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const r = await this.prisma.recording.findUnique({ where: { id }, include: { session: true } });
    if (!r) throw new NotFoundException('Không tìm thấy bản ghi');
    await this.access.check(user, r.session.courseId);
    if (r.status !== 'READY') throw new BadRequestException('Bản ghi chưa xử lý xong');
    const name = `${r.session.title} ${r.startedAt.toISOString().slice(0, 10)}.mp4`;
    return { url: await this.storage.downloadUrl(r.key, name, 4 * 3600) };
  }

  @Delete('recordings/:id')
  @HttpCode(204)
  async deleteRecording(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const r = await this.prisma.recording.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Không tìm thấy bản ghi');
    await this.room.requireTeacher(user, r.sessionId);
    if (r.status === 'STARTING' || r.status === 'RECORDING') throw new BadRequestException('Dừng ghi hình trước khi xoá');
    if (r.status === 'READY') await this.storage.remove(r.key);
    await this.prisma.recording.delete({ where: { id } });
  }

  // ----- Tài liệu -----

  @Get('courses/:id/materials')
  async courseMaterials(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('sessionId') sessionId?: string) {
    await this.access.check(user, id);
    return this.prisma.material.findMany({
      // Theo buổi: tài liệu của buổi đó và tài liệu chung của khoá.
      where: { courseId: id, ...(sessionId ? { OR: [{ sessionId }, { sessionId: null }] } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, contentType: true, sizeBytes: true, sessionId: true, createdAt: true },
    });
  }

  @Post('courses/:id/materials')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: config.maxMaterialMb * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadDto,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
  ) {
    this.storage.require();
    const { teacher } = await this.access.check(user, id);
    if (!teacher) throw new ForbiddenException('Chỉ giáo viên của khoá được tải tài liệu lên');
    if (dto.sessionId) {
      const s = await this.prisma.classSession.findFirst({ where: { id: dto.sessionId, courseId: id } });
      if (!s) throw new BadRequestException('Buổi học không thuộc khoá này');
    }
    const name = safeName(file.originalname);
    const key = `materials/${id}/${randomBytes(8).toString('hex')}-${name}`;
    const contentType = file.mimetype || 'application/octet-stream';
    await this.storage.put(key, file.buffer, contentType);
    return this.prisma.material.create({
      data: { courseId: id, sessionId: dto.sessionId || null, name, key, contentType, sizeBytes: file.size },
      select: { id: true, name: true, contentType: true, sizeBytes: true, sessionId: true, createdAt: true },
    });
  }

  @Get('materials/:id/url')
  async materialUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Không tìm thấy tài liệu');
    await this.access.check(user, m.courseId);
    return { url: await this.storage.downloadUrl(m.key, m.name) };
  }

  @Delete('materials/:id')
  @HttpCode(204)
  async deleteMaterial(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Không tìm thấy tài liệu');
    const { teacher } = await this.access.check(user, m.courseId);
    if (!teacher) throw new ForbiddenException('Chỉ giáo viên của khoá được xoá tài liệu');
    await this.storage.remove(m.key);
    await this.prisma.material.delete({ where: { id } });
  }

  /** Cho trang web biết lưu trữ đã cấu hình chưa, để ẩn nút ghi hình / tải lên. */
  @Get('features')
  features() {
    return { storage: this.storage.enabled };
  }
}

@Module({
  imports: [ClassroomModule],
  controllers: [MediaController],
  providers: [CourseAccess],
})
export class MediaModule {}
