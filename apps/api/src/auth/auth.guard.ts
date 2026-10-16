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

export type AuthUser = { id: string; name: string; email: string; role: 'TEACHER' | 'STUDENT' };

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

@Injectable()
export class TeacherGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = readUser(req);
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
    if (user.role !== 'TEACHER') throw new ForbiddenException('Chỉ giáo viên làm được thao tác này');
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});
