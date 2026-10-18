import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import bcrypt from 'bcryptjs';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard, AuthUser, CurrentUser } from './auth.guard';

class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(2, { message: 'Tên cần ít nhất 2 ký tự' })
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu cần ít nhất 8 ký tự' })
  password: string;
}

class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  password: string;
}

class PasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới cần ít nhất 8 ký tự' })
  @MaxLength(200)
  newPassword: string;
}

const SESSION_DAYS = 7;
/** Sai mật khẩu quá MAX_FAILS lần trong LOCK_MS thì khoá đăng nhập email đó LOCK_MS. */
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
/** Giới hạn riêng cho các đường đăng nhập, đăng ký, đổi mật khẩu (mỗi IP). */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@Injectable()
export class AuthService {
  /**
   * Đếm đăng nhập sai theo email, chống dò mật khẩu một tài khoản từ nhiều IP.
   * Nằm trong RAM: đủ cho một tiến trình API; chạy nhiều bản thì chuyển sang Redis.
   */
  private fails = new Map<string, { count: number; first: number; lockedUntil: number }>();

  constructor(private prisma: PrismaService) {}

  sign(user: AuthUser & { tokenVersion: number }): string {
    return jwt.sign(
      { sub: user.id, name: user.name, email: user.email, role: user.role, ver: user.tokenVersion },
      config.jwtSecret,
      { expiresIn: `${SESSION_DAYS}d` },
    );
  }

  private checkLocked(email: string, now = Date.now()) {
    const f = this.fails.get(email);
    if (f && f.lockedUntil > now) {
      const minutes = Math.ceil((f.lockedUntil - now) / 60_000);
      throw new HttpException(
        `Đăng nhập sai quá nhiều lần, thử lại sau ${minutes} phút`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFail(email: string, now = Date.now()) {
    let f = this.fails.get(email);
    if (!f || now - f.first > LOCK_MS) f = { count: 0, first: now, lockedUntil: 0 };
    f.count++;
    if (f.count >= MAX_FAILS) f.lockedUntil = now + LOCK_MS;
    this.fails.set(email, f);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email này đã có tài khoản');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), passwordHash: await bcrypt.hash(dto.password, 10) },
    });
    return pick(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    this.checkLocked(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.recordFail(email);
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }
    this.fails.delete(email);
    return pick(user);
  }

  /** Đổi mật khẩu và tăng tokenVersion: mọi phiên khác bị đăng xuất. */
  async changePassword(id: string, dto: PasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10), tokenVersion: { increment: 1 } },
    });
    return pick(updated);
  }

  /** Vô hiệu mọi cookie đăng nhập của tài khoản. */
  async revokeAll(id: string) {
    await this.prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  }
}

type UserRow = AuthUser & { tokenVersion: number };
function pick(u: UserRow): UserRow {
  return { id: u.id, name: u.name, email: u.email, role: u.role, tokenVersion: u.tokenVersion };
}
/** Bỏ tokenVersion trước khi trả về trình duyệt. */
function view({ tokenVersion: _v, ...user }: UserRow): AuthUser {
  return user;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private setCookie(res: Response, token: string) {
    res.cookie(config.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: SESSION_DAYS * 24 * 3600 * 1000,
      path: '/',
    });
  }

  @Post('register')
  @Throttle(STRICT)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    this.setCookie(res, this.auth.sign(user));
    return view(user);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto);
    this.setCookie(res, this.auth.sign(user));
    return view(user);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieName, { path: '/' });
  }

  /** Đổi mật khẩu: máy hiện tại nhận cookie mới, các máy khác bị đăng xuất. */
  @Post('password')
  @HttpCode(200)
  @Throttle(STRICT)
  @UseGuards(AuthGuard)
  async password(@CurrentUser() user: AuthUser, @Body() dto: PasswordDto, @Res({ passthrough: true }) res: Response) {
    const updated = await this.auth.changePassword(user.id, dto);
    this.setCookie(res, this.auth.sign(updated));
    return view(updated);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAll(user.id);
    res.clearCookie(config.cookieName, { path: '/' });
  }

  /**
   * Tài khoản đang đăng nhập. AuthGuard đã đọc lại từ DB nên tên và vai trò luôn mới nhất,
   * không cần cấp lại cookie khi quản trị viên đổi vai trò.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
