import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Prisma } from '@prisma/client';
import { IsObject } from 'class-validator';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Need, PermissionGuard } from '../auth/auth.guard';
import { imageInfo } from '../common/image';
import { PrismaService } from '../common/prisma.service';
import { assetIdsIn, DEFAULT_CONTENT, sanitize, SiteContent } from './site-content';

/** Ảnh đã được trình duyệt thu nhỏ trước khi gửi; 3 MB là đủ rộng. */
export const MAX_ASSET_BYTES = 3 * 1024 * 1024;

const KEYS = { draft: 'draft', published: 'published' } as const;

class DraftDto {
  @IsObject() content: Record<string, unknown>;
}

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService) {}

  async assetIds(): Promise<Set<string>> {
    const rows = await this.prisma.siteAsset.findMany({ select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }

  /** Đọc một bản (nháp hoặc đã xuất bản), làm sạch lại để ảnh đã xoá hay trường mới thêm vẫn đúng. */
  async read(key: string, ids?: Set<string>): Promise<{ content: SiteContent; updatedAt: Date | null }> {
    const row = await this.prisma.siteContent.findUnique({ where: { key } });
    if (!row) return { content: DEFAULT_CONTENT, updatedAt: null };
    return { content: sanitize(row.data, ids ?? (await this.assetIds())), updatedAt: row.updatedAt };
  }

  write(key: string, content: SiteContent, userId: string) {
    const data = content as unknown as Prisma.InputJsonValue;
    return this.prisma.siteContent.upsert({
      where: { key },
      create: { key, data, updatedById: userId },
      update: { data, updatedById: userId },
    });
  }
}

/** Nội dung và ảnh công khai: trang chủ, layout (SEO, favicon) đọc ở đây, không cần đăng nhập. */
@Controller('site')
@SkipThrottle()
export class SiteController {
  constructor(private svc: SiteService, private prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=30')
  async get() {
    return (await this.svc.read(KEYS.published)).content;
  }

  @Get('assets/:id')
  async asset(@Param('id') id: string, @Res() res: Response) {
    const a = await this.prisma.siteAsset.findUnique({ where: { id }, select: { data: true, contentType: true } });
    if (!a) throw new NotFoundException('Không tìm thấy ảnh');
    res.set({
      'Content-Type': a.contentType,
      // Ảnh không bao giờ đổi nội dung (đổi ảnh là id mới).
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    });
    res.send(Buffer.from(a.data));
  }
}

@Controller('admin/site')
@UseGuards(PermissionGuard)
@Need('site.manage')
export class SiteAdminController {
  constructor(private svc: SiteService, private prisma: PrismaService) {}

  @Get()
  async get() {
    const ids = await this.svc.assetIds();
    const [draft, published] = await Promise.all([this.svc.read(KEYS.draft, ids), this.svc.read(KEYS.published, ids)]);
    return {
      // Chưa có nháp thì nháp là bản đang xuất bản.
      draft: draft.updatedAt ? draft.content : published.content,
      published: published.content,
      draftUpdatedAt: draft.updatedAt,
      publishedAt: published.updatedAt,
    };
  }

  @Put('draft')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async saveDraft(@CurrentUser() user: AuthUser, @Body() dto: DraftDto) {
    const content = sanitize(dto.content, await this.svc.assetIds());
    const row = await this.svc.write(KEYS.draft, content, user.id);
    return { content, draftUpdatedAt: row.updatedAt };
  }

  @Post('publish')
  @HttpCode(200)
  async publish(@CurrentUser() user: AuthUser) {
    const ids = await this.svc.assetIds();
    const draft = await this.svc.read(KEYS.draft, ids);
    const content = draft.updatedAt ? draft.content : (await this.svc.read(KEYS.published, ids)).content;
    const row = await this.svc.write(KEYS.published, content, user.id);
    return { publishedAt: row.updatedAt };
  }

  /** Bỏ nháp: nháp quay về bản đang xuất bản. */
  @Post('discard')
  @HttpCode(200)
  async discard(@CurrentUser() user: AuthUser) {
    const published = await this.svc.read(KEYS.published);
    const row = await this.svc.write(KEYS.draft, published.content, user.id);
    return { content: published.content, draftUpdatedAt: row.updatedAt };
  }

  @Post('assets')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ASSET_BYTES } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true })) file: Express.Multer.File,
  ) {
    const info = imageInfo(file.buffer);
    if (!info || !info.width || !info.height) throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
    const a = await this.prisma.siteAsset.create({
      data: { data: file.buffer, contentType: info.type, width: info.width, height: info.height, size: file.size, createdById: user.id },
      select: { id: true, width: true, height: true, size: true },
    });
    return a;
  }

  /** Xoá ảnh không bản nào dùng, đã tải lên quá 1 ngày (ảnh vừa tải có thể chưa kịp lưu vào nháp). */
  @Post('assets/cleanup')
  @HttpCode(200)
  async cleanup() {
    const ids = await this.svc.assetIds();
    const [draft, published] = await Promise.all([this.svc.read(KEYS.draft, ids), this.svc.read(KEYS.published, ids)]);
    const used = new Set([...assetIdsIn(draft.content), ...assetIdsIn(published.content)]);
    const { count } = await this.prisma.siteAsset.deleteMany({
      where: { id: { notIn: [...used] }, createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
    });
    return { deleted: count };
  }
}

@Module({ controllers: [SiteController, SiteAdminController], providers: [SiteService] })
export class SiteModule {}
