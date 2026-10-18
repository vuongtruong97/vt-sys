import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';

export type AuthUser = { id: string; name: string; email: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };

type JwtPayload = { sub: string; name: string; email: string; role: AuthUser['role']; ver?: number };

/** Giải mã cookie/Bearer. Chỉ kiểm tra chữ ký và hạn, chưa đối chiếu DB. */
function decode(req: Request): JwtPayload | null {
  const header = req.headers.authorization;
  const token =
    (req.cookies?.[config.cookieName] as string | undefined) ??
    (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Người đang đăng nhập, đối chiếu với DB: tài khoản còn tồn tại, `tokenVersion` khớp
 * (đổi mật khẩu hay "đăng xuất mọi nơi" làm cookie cũ hết hiệu lực), vai trò lấy từ DB
 * nên cấp/thu quyền có hiệu lực ngay.
 */
export async function currentUser(req: Request, prisma: PrismaService): Promise<AuthUser | null> {
  const p = decode(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({
    where: { id: p.sub },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });
  if (!u || u.tokenVersion !== (p.ver ?? 0)) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

async function requireUser(ctx: ExecutionContext, prisma: PrismaService): Promise<AuthUser> {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
  const user = await currentUser(req, prisma);
  if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
  req.user = user;
  return user;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await requireUser(ctx, this.prisma);
    return true;
  }
}

/** Giáo viên hoặc quản trị viên. */
@Injectable()
export class TeacherGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = await requireUser(ctx, this.prisma);
    if (user.role === 'STUDENT') throw new ForbiddenException('Chỉ giáo viên làm được thao tác này');
    return true;
  }
}

/** Chỉ quản trị viên. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = await requireUser(ctx, this.prisma);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Chỉ quản trị viên làm được thao tác này');
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});
