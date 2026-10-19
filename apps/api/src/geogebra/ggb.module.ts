import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { GgbDocument } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard, AuthUser, CurrentUser, TeacherGuard } from '../auth/auth.guard';
import { ClassroomModule, ClassroomService } from '../classroom/classroom.module';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';

/** Bài GeoGebra thường vài chục KB; 2 MB là đủ rộng mà vẫn chặn được gửi rác. */
export const MAX_GGB_BASE64 = 2_000_000;
const MAX_THUMB = 400_000;
const APPS = ['classic', 'graphing', 'geometry', '3d', 'notes'] as const;

class CreateGgbDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsIn(APPS) appName?: (typeof APPS)[number];
  @IsOptional() @IsString() @MaxLength(MAX_GGB_BASE64, { message: 'Bài GeoGebra quá lớn (tối đa 2 MB)' }) base64?: string;
}

class SaveGgbDto {
  @IsString() @MaxLength(MAX_GGB_BASE64, { message: 'Bài GeoGebra quá lớn (tối đa 2 MB)' }) base64: string;
  /** Phiên bản lúc mở bài; khác bản trong DB nghĩa là đã có người lưu đè ở nơi khác. */
  @IsInt() @Min(0) version: number;
}

class RenameGgbDto {
  @IsString() @MinLength(1, { message: 'Tên bài không được để trống' }) @MaxLength(120) title: string;
}

class ThumbDto {
  @IsString()
  @MaxLength(MAX_THUMB, { message: 'Ảnh thu nhỏ quá lớn' })
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { message: 'Ảnh thu nhỏ phải là PNG' })
  png: string;
}

@Injectable()
export class GgbService {
  constructor(private prisma: PrismaService, private room: ClassroomService) {}

  /** Bài người dùng được xem: bài của mình, hoặc bài gắn với buổi học mà người đó vào được. */
  async readable(user: AuthUser, id: string): Promise<GgbDocument> {
    const doc = await this.prisma.ggbDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Không tìm thấy bài GeoGebra');
    if (doc.ownerId === user.id) return doc;
    if (doc.sessionId) {
      const s = await this.room.session(doc.sessionId).catch(() => null);
      if (s && (await this.room.roleOf(user, s))) return doc;
    }
    // Không nói rõ là bài có tồn tại hay không với người không có quyền.
    throw new NotFoundException('Không tìm thấy bài GeoGebra');
  }

  async owned(user: AuthUser, id: string): Promise<GgbDocument> {
    const doc = await this.prisma.ggbDocument.findUnique({ where: { id } });
    if (!doc || doc.ownerId !== user.id) throw new NotFoundException('Không tìm thấy bài GeoGebra');
    return doc;
  }
}

@Controller('ggb-documents')
@UseGuards(AuthGuard)
export class GgbController {
  constructor(private prisma: PrismaService, private svc: GgbService, private storage: StorageService) {}

  private thumbUrl(key: string | null) {
    return key && this.storage.enabled ? this.storage.downloadUrl(key, undefined, 3600) : Promise.resolve(null);
  }

  /** Bài của mình, mới sửa trước. Không trả nội dung bài để danh sách nhẹ. */
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.ggbDocument.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, title: true, appName: true, sessionId: true, thumbnailKey: true, updatedAt: true },
    });
    return Promise.all(
      rows.map(async ({ thumbnailKey, ...r }) => ({ ...r, thumbnailUrl: await this.thumbUrl(thumbnailKey).catch(() => null) })),
    );
  }

  @Post()
  @UseGuards(TeacherGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGgbDto) {
    return this.prisma.ggbDocument.create({
      data: { ownerId: user.id, title: dto.title?.trim() || 'Bài GeoGebra mới', appName: dto.appName ?? 'classic', base64: dto.base64 ?? '' },
      select: { id: true, title: true, version: true },
    });
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { thumbnailKey, ...doc } = await this.svc.readable(user, id);
    return { ...doc, canEdit: doc.ownerId === user.id };
  }

  /** Lưu bài. Kiểm tra quyền sở hữu và phiên bản trong cùng một câu lệnh. */
  @Put(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async save(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveGgbDto) {
    const { count } = await this.prisma.ggbDocument.updateMany({
      where: { id, ownerId: user.id, version: dto.version },
      data: { base64: dto.base64, version: { increment: 1 } },
    });
    if (count === 0) {
      await this.svc.owned(user, id);
      throw new ConflictException('Bài đã được sửa ở nơi khác. Tải lại trang để lấy bản mới nhất.');
    }
    return { version: dto.version + 1 };
  }

  @Patch(':id')
  async rename(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RenameGgbDto) {
    await this.svc.owned(user, id);
    return this.prisma.ggbDocument.update({ where: { id }, data: { title: dto.title.trim() }, select: { id: true, title: true } });
  }

  /** Ảnh thu nhỏ cho danh sách; không có nơi lưu trữ (S3) thì bỏ qua, không báo lỗi. */
  @Put(':id/thumbnail')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async thumbnail(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ThumbDto) {
    const doc = await this.svc.owned(user, id);
    if (!this.storage.enabled) return;
    const buf = Buffer.from(dto.png.slice(dto.png.indexOf(',') + 1), 'base64');
    if (buf.length === 0) throw new BadRequestException('Ảnh thu nhỏ rỗng');
    const key = doc.thumbnailKey ?? `ggb/${doc.id}.png`;
    await this.storage.put(key, buf, 'image/png');
    if (!doc.thumbnailKey) await this.prisma.ggbDocument.update({ where: { id }, data: { thumbnailKey: key } });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const doc = await this.svc.owned(user, id);
    await this.prisma.ggbDocument.delete({ where: { id } });
    if (doc.thumbnailKey && this.storage.enabled) await this.storage.remove(doc.thumbnailKey).catch(() => {});
  }
}

@Module({ imports: [ClassroomModule], providers: [GgbService], controllers: [GgbController], exports: [GgbService] })
export class GgbModule {}
