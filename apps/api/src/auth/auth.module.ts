import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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

const SESSION_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  sign(user: AuthUser): string {
    return jwt.sign(
      { sub: user.id, name: user.name, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: `${SESSION_DAYS}d` },
    );
  }

  async register(dto: RegisterDto): Promise<AuthUser> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email này đã có tài khoản');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), passwordHash: await bcrypt.hash(dto.password, 10) },
    });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  async fresh(id: string): Promise<AuthUser | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    return u && { id: u.id, name: u.name, email: u.email, role: u.role };
  }

  async login(dto: LoginDto): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
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
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    this.setCookie(res, this.auth.sign(user));
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto);
    this.setCookie(res, this.auth.sign(user));
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieName, { path: '/' });
  }

  /**
   * Đọc lại tài khoản từ DB: vai trò vừa được quản trị viên đổi thì cấp lại cookie,
   * người dùng không phải đăng nhập lại.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const fresh = await this.auth.fresh(user.id);
    if (!fresh) {
      res.clearCookie(config.cookieName, { path: '/' });
      throw new UnauthorizedException('Tài khoản không còn tồn tại');
    }
    if (fresh.role !== user.role || fresh.name !== user.name) this.setCookie(res, this.auth.sign(fresh));
    return fresh;
  }
}

@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
