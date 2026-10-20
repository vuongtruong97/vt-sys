import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { avatarUrl } from '../common/avatar';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { can, effectivePermissions, Permission, permissionLabel } from './permissions';

/** Vai trò rút gọn gắn với người dùng (key: admin, teacher, student hoặc chuỗi của vai trò tự tạo). */
export type RoleRef = { id: string; key: string; name: string };

export type AuthUser = { id: string; name: string; email: string; avatarUrl: string | null; role: RoleRef; permissions: Permission[] };

type JwtPayload = { sub: string; ver?: number };

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

/** Người dùng kèm vai trò từ DB → AuthUser (quyền thực tế đã tính, admin có tất cả). */
export function toAuthUser(u: { id: string; name: string; email: string; avatarVersion?: number; role: RoleRef & { permissions: string[] } }): AuthUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: avatarUrl({ id: u.id, avatarVersion: u.avatarVersion ?? 0 }),
    role: { id: u.role.id, key: u.role.key, name: u.role.name },
    permissions: effectivePermissions(u.role),
  };
}

/** Phần select dùng chung để đọc người dùng kèm vai trò. */
export const USER_WITH_ROLE = {
  id: true,
  name: true,
  email: true,
  avatarVersion: true,
  role: { select: { id: true, key: true, name: true, permissions: true } },
} as const;

/**
 * Người đang đăng nhập, đối chiếu với DB: tài khoản còn tồn tại, `tokenVersion` khớp
 * (đổi mật khẩu hay "đăng xuất mọi nơi" làm cookie cũ hết hiệu lực), vai trò và quyền lấy từ DB
 * nên cấp/thu quyền có hiệu lực ngay.
 */
export async function currentUser(req: Request, prisma: PrismaService): Promise<AuthUser | null> {
  const p = decode(req);
  if (!p) return null;
  const u = await prisma.user.findUnique({ where: { id: p.sub }, select: { ...USER_WITH_ROLE, tokenVersion: true } });
  if (!u || u.tokenVersion !== (p.ver ?? 0)) return null;
  return toAuthUser(u);
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

const NEED = 'need-permissions';

/**
 * Endpoint cần (ít nhất một trong) các quyền này. Dùng kèm PermissionGuard, đặt ở hàm hoặc ở controller:
 *   @UseGuards(PermissionGuard) @Need('course.create')
 */
export const Need = (...perms: Permission[]) => SetMetadata(NEED, perms);

/** Báo lỗi 403 tiếng Việt khi thiếu quyền. */
export function denied(perms: Permission[]) {
  return new ForbiddenException(`Bạn chưa có quyền: ${perms.map(permissionLabel).join(' hoặc ')}. Liên hệ quản trị viên để được cấp quyền.`);
}

/** Đăng nhập và có ít nhất một quyền khai báo bằng @Need. Không khai báo @Need thì chỉ cần đăng nhập. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private prisma: PrismaService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = await requireUser(ctx, this.prisma);
    const need = this.reflector.getAllAndOverride<Permission[] | undefined>(NEED, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (need.length && !need.some((p) => can(user, p))) throw denied(need);
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});
