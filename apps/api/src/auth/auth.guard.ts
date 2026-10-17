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

type JwtPayload = { sub: string; name: string; email: string; role: AuthUser['role'] };

export function readUser(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  const token =
    (req.cookies?.[config.cookieName] as string | undefined) ??
    (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return { id: p.sub, name: p.name, email: p.email, role: p.role };
  } catch {
    return null;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = readUser(req);
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
    req.user = user;
    return true;
  }
}

/**
 * Giáo viên hoặc quản trị viên. Đọc vai trò trong DB (JWT có hạn 7 ngày),
 * để người vừa bị thu quyền giáo viên không tạo khoá học bằng cookie cũ.
 */
@Injectable()
export class TeacherGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = readUser(req);
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
    const db = await this.prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (!db || db.role === 'STUDENT') throw new ForbiddenException('Chỉ giáo viên làm được thao tác này');
    req.user = { ...user, role: db.role };
    return true;
  }
}

/**
 * Chỉ quản trị viên. Kiểm tra lại vai trò trong DB (không tin JWT 7 ngày),
 * để thu quyền quản trị có hiệu lực ngay.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = readUser(req);
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
    const db = await this.prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (db?.role !== 'ADMIN') throw new ForbiddenException('Chỉ quản trị viên làm được thao tác này');
    req.user = { ...user, role: 'ADMIN' };
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});
