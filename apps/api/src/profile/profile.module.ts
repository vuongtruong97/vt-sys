import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { avatarUrl } from '../common/avatar';
import { imageInfo } from '../common/image';
import { PrismaService } from '../common/prisma.service';

/** Ảnh đại diện đã được trình duyệt cắt và thu nhỏ (khoảng 512×512); 2 MB là rộng rãi. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_SIDE = 2048;

/** Bỏ khoảng trắng hai đầu; chuỗi rỗng thì coi như xoá giá trị (null). */
const trimOrNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class ProfileDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2, { message: 'Họ tên cần ít nhất 2 ký tự' })
  @MaxLength(80, { message: 'Họ tên tối đa 80 ký tự' })
  name?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Matches(/^[0-9+ .()-]{8,20}$/, { message: 'Số điện thoại không hợp lệ (8–20 ký tự, chỉ gồm số, dấu cách, + . ( ) -)' })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500, { message: 'Giới thiệu tối đa 500 ký tự' })
  bio?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày sinh không hợp lệ' })
  birthday?: string | null;
}

const PROFILE_SELECT = { id: true, name: true, email: true, phone: true, bio: true, birthday: true, avatarVersion: true } as const;

type ProfileRow = { id: string; name: string; email: string; phone: string | null; bio: string; birthday: Date | null; avatarVersion: number };
const view = (u: ProfileRow) => ({
  name: u.name,
  email: u.email,
  phone: u.phone,
  bio: u.bio,
  birthday: u.birthday ? u.birthday.toISOString().slice(0, 10) : null,
  avatarUrl: avatarUrl(u),
});

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!u) throw new NotFoundException('Không tìm thấy tài khoản');
    return view(u);
  }

  async update(userId: string, dto: ProfileDto, now = new Date()) {
    let birthday: Date | null | undefined;
    if (dto.birthday === null) birthday = null;
    else if (dto.birthday) {
      birthday = new Date(`${dto.birthday}T00:00:00Z`);
      if (Number.isNaN(birthday.getTime()) || birthday.toISOString().slice(0, 10) !== dto.birthday) throw new BadRequestException('Ngày sinh không hợp lệ');
      if (birthday > now) throw new BadRequestException('Ngày sinh không thể ở tương lai');
      if (birthday.getUTCFullYear() < 1900) throw new BadRequestException('Ngày sinh không hợp lệ (trước năm 1900)');
    }
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone, bio: dto.bio, birthday },
      select: PROFILE_SELECT,
    });
    return view(u);
  }

  async setAvatar(userId: string, buf: Buffer) {
    const info = imageInfo(buf);
    if (!info || !info.width || !info.height) throw new BadRequestException('Ảnh đại diện phải là ảnh JPEG, PNG hoặc WebP');
    if (info.width > MAX_AVATAR_SIDE || info.height > MAX_AVATAR_SIDE) {
      throw new BadRequestException(`Ảnh quá lớn (${info.width}×${info.height}). Tối đa ${MAX_AVATAR_SIDE}×${MAX_AVATAR_SIDE} điểm ảnh`);
    }
    const [, u] = await this.prisma.$transaction([
      this.prisma.userAvatar.upsert({
        where: { userId },
        create: { userId, data: buf, contentType: info.type },
        update: { data: buf, contentType: info.type },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { avatarVersion: { increment: 1 } }, select: { id: true, avatarVersion: true } }),
    ]);
    return { avatarUrl: avatarUrl(u) };
  }

  async removeAvatar(userId: string) {
    await this.prisma.$transaction([
      this.prisma.userAvatar.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { avatarVersion: 0 } }),
    ]);
  }

  async avatar(userId: string) {
    const a = await this.prisma.userAvatar.findUnique({ where: { userId }, select: { data: true, contentType: true } });
    if (!a) throw new NotFoundException('Người dùng chưa có ảnh đại diện');
    return a;
  }
}

/** Hồ sơ của chính mình. */
@Controller('me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private svc: ProfileService) {}

  @Get('profile')
  get(@CurrentUser() user: AuthUser) {
    return this.svc.get(user.id);
  }

  @Patch('profile')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.svc.update(user.id, dto);
  }

  @Put('avatar')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }))
  setAvatar(@CurrentUser() user: AuthUser, @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true })) file: Express.Multer.File) {
    return this.svc.setAvatar(user.id, file.buffer);
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: AuthUser) {
    await this.svc.removeAvatar(user.id);
    return { avatarUrl: null };
  }
}

/** Ảnh đại diện của người dùng (cần đăng nhập). Có ?v= thì cache lâu vì URL đổi khi ảnh đổi. */
@Controller('users')
@UseGuards(AuthGuard)
export class AvatarController {
  constructor(private svc: ProfileService) {}

  @Get(':id/avatar')
  async avatar(@Param('id') id: string, @Query('v') v: string | undefined, @Res() res: Response) {
    const a = await this.svc.avatar(id);
    res.set({
      'Content-Type': a.contentType,
      'Cache-Control': v ? 'private, max-age=31536000, immutable' : 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(a.data));
  }
}

@Module({ controllers: [ProfileController, AvatarController], providers: [ProfileService] })
export class ProfileModule {}
