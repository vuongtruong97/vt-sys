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
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
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
  /** Bỏ trống khi tài khoản (tạo bằng Google) chưa có mật khẩu. */
  @IsOptional()
  @IsString()
  currentPassword?: string;

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
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.recordFail(email);
      throw new UnauthorizedException(
        user && !user.passwordHash
          ? 'Tài khoản này đăng nhập bằng Google. Bấm "Đăng nhập bằng Google", hoặc đặt mật khẩu ở trang Tài khoản'
          : 'Sai email hoặc mật khẩu',
      );
    }
    this.fails.delete(email);
    return pick(user);
  }

  /**
   * Đổi mật khẩu và tăng tokenVersion: mọi phiên khác bị đăng xuất.
   * Tài khoản tạo bằng Google chưa có mật khẩu thì đặt lần đầu, không cần mật khẩu hiện tại.
   */
  async changePassword(id: string, dto: PasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
    if (user.passwordHash && !(await bcrypt.compare(dto.currentPassword ?? '', user.passwordHash))) {
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

  /** Cách đăng nhập của tài khoản, cho trang Tài khoản. */
  async methods(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { passwordHash: true, googleId: true } });
    return { hasPassword: !!u?.passwordHash, google: !!u?.googleId };
  }

  // ----- Đăng nhập bằng Google (OAuth authorization code, chạy hoàn toàn phía server) -----

  googleEnabled() {
    return !!(config.google.clientId && config.google.clientSecret);
  }

  private googleRedirectUri() {
    return `${config.appUrl}/api/auth/google/callback`;
  }

  googleAuthUrl(state: string) {
    const q = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: this.googleRedirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  /**
   * Đổi code lấy id_token. Token nhận thẳng từ Google qua HTTPS nên chỉ cần kiểm tra
   * người nhận (aud), nơi cấp (iss), hạn dùng và email đã xác minh, không cần kiểm chữ ký.
   */
  async googleProfile(code: string, now = Date.now()): Promise<GoogleProfile> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: this.googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
    if (!res.ok || !body.id_token) throw new UnauthorizedException('Google không xác nhận được đăng nhập, thử lại');
    const p = JSON.parse(Buffer.from(body.id_token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      iss?: string; aud?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean; name?: string;
    };
    const issOk = p.iss === 'https://accounts.google.com' || p.iss === 'accounts.google.com';
    if (!issOk || p.aud !== config.google.clientId || !p.exp || p.exp * 1000 < now || !p.sub || !p.email) {
      throw new UnauthorizedException('Thông tin đăng nhập Google không hợp lệ');
    }
    if (!p.email_verified) throw new UnauthorizedException('Email Google này chưa được xác minh');
    return { sub: p.sub, email: p.email.toLowerCase(), name: p.name?.trim() || p.email.split('@')[0] };
  }

  /**
   * Tìm hoặc tạo tài khoản theo Google: đã liên kết thì theo googleId; chưa thì gắn vào tài khoản
   * cùng email (Google đã xác minh email); chưa có tài khoản thì tạo học viên mới, chưa có mật khẩu.
   */
  async googleSignIn(g: GoogleProfile) {
    const linked = await this.prisma.user.findUnique({ where: { googleId: g.sub } });
    if (linked) return pick(linked);
    const byEmail = await this.prisma.user.findUnique({ where: { email: g.email } });
    if (byEmail) return pick(await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId: g.sub } }));
    return pick(await this.prisma.user.create({ data: { email: g.email, name: g.name.slice(0, 80), googleId: g.sub } }));
  }
}

export type GoogleProfile = { sub: string; email: string; name: string };

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

  /** Cách đăng nhập đang có (mật khẩu, Google) cho trang Tài khoản. */
  @Get('methods')
  @UseGuards(AuthGuard)
  methods(@CurrentUser() user: AuthUser) {
    return this.auth.methods(user.id);
  }

  /** Trang đăng nhập hỏi có hiện nút Google không. */
  @Get('providers')
  providers() {
    return { google: this.auth.googleEnabled() };
  }

  /** Bắt đầu đăng nhập Google: lưu state (chống CSRF) và trang cần quay về vào cookie ngắn hạn. */
  @Get('google')
  @Throttle(STRICT)
  google(@Query('next') next: string | undefined, @Res() res: Response) {
    if (!this.auth.googleEnabled()) return res.redirect(loginError('Chưa bật đăng nhập bằng Google'));
    const state = randomBytes(16).toString('hex');
    res.cookie(OAUTH_COOKIE, JSON.stringify({ state, next: safeNext(next) }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 10 * 60_000,
      path: '/api/auth/google',
    });
    res.redirect(this.auth.googleAuthUrl(state));
  }

  @Get('google/callback')
  @Throttle(STRICT)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    let saved: { state?: string; next?: string } = {};
    try {
      saved = JSON.parse(req.cookies?.[OAUTH_COOKIE] ?? '{}');
    } catch {
      /* cookie hỏng: coi như không có */
    }
    res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/google' });
    if (error) return res.redirect(loginError('Bạn đã huỷ đăng nhập bằng Google'));
    if (!code || !state || state !== saved.state) {
      return res.redirect(loginError('Phiên đăng nhập Google đã hết hạn, thử lại'));
    }
    try {
      const user = await this.auth.googleSignIn(await this.auth.googleProfile(code));
      this.setCookie(res, this.auth.sign(user));
      res.redirect(safeNext(saved.next));
    } catch (e) {
      res.redirect(loginError(e instanceof HttpException ? e.message : 'Không đăng nhập được bằng Google, thử lại'));
    }
  }
}

const OAUTH_COOKIE = 'bd_oauth';
/** Chỉ cho quay về đường dẫn trong trang (chống chuyển hướng ra ngoài). */
function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/schedule';
}
function loginError(message: string) {
  return `/login?error=${encodeURIComponent(message)}`;
}

@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
