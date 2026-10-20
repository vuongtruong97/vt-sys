import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { AuthUser, CurrentUser, Need, PermissionGuard } from '../auth/auth.guard';
import { effectivePermissions, Permission, PERMISSION_CODES, permissionLabel, PERMISSIONS } from '../auth/permissions';
import { brief } from '../common/avatar';
import { PrismaService } from '../common/prisma.service';

class SetRoleDto {
  @IsString() roleId: string;
}

class TransferDto {
  @IsString() teacherId: string;
}

class RoleDto {
  @IsString()
  @MinLength(2, { message: 'Tên vai trò cần ít nhất 2 ký tự' })
  @MaxLength(60, { message: 'Tên vai trò tối đa 60 ký tự' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Mô tả tối đa 200 ký tự' })
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_CODES, { each: true, message: 'Có quyền không nằm trong danh mục' })
  permissions: Permission[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên vai trò cần ít nhất 2 ký tự' })
  @MaxLength(60, { message: 'Tên vai trò tối đa 60 ký tự' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Mô tả tối đa 200 ký tự' })
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_CODES, { each: true, message: 'Có quyền không nằm trong danh mục' })
  permissions?: Permission[];
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  avatarVersion: true,
  createdAt: true,
  role: { select: { id: true, key: true, name: true } },
} as const;

/** Kiểm tra nghiệp vụ của phân quyền, tách khỏi controller để test. */
@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /** Không được trao quyền mình không có (chặn tự nâng quyền qua người khác hoặc qua vai trò). */
  assertGrantable(me: AuthUser, perms: string[], what: string) {
    const missing = perms.filter((p) => !me.permissions.includes(p as Permission));
    if (missing.length) {
      throw new ForbiddenException(`Không ${what} được vì bạn chưa có quyền: ${missing.map(permissionLabel).join(', ')}`);
    }
  }

  /**
   * Sau thay đổi vẫn phải còn ít nhất một người quản lý được vai trò, để không ai bị khoá ngoài.
   * `except`: người dùng sắp đổi vai trò; `roleChange`: vai trò sắp đổi quyền.
   */
  async assertManagerRemains(opts: { exceptUser?: string; roleChange?: { id: string; permissions: string[] } }) {
    const roles = await this.prisma.role.findMany({ select: { id: true, key: true, permissions: true } });
    const managing = roles
      .map((r) => (r.id === opts.roleChange?.id ? { ...r, permissions: opts.roleChange.permissions } : r))
      .filter((r) => effectivePermissions(r).includes('role.manage'))
      .map((r) => r.id);
    const left = await this.prisma.user.count({
      where: { roleId: { in: managing }, ...(opts.exceptUser ? { id: { not: opts.exceptUser } } : {}) },
    });
    if (left === 0) throw new BadRequestException('Phải còn ít nhất một tài khoản quản lý được vai trò. Gán quyền này cho người khác trước.');
  }

  async setUserRole(me: AuthUser, id: string, roleId: string) {
    if (id === me.id) throw new BadRequestException('Không tự đổi vai trò của chính mình được');
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id }, include: { role: true, _count: { select: { courses: true } } } }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    const next = effectivePermissions(role);
    // Đổi vai trò của người đang có quyền cao hơn mình cũng là một cách hạ quyền họ: chỉ làm được khi mình có đủ quyền đó.
    this.assertGrantable(me, [...next, ...effectivePermissions(user.role)], 'đổi vai trò này');
    if (!next.includes('course.create') && user._count.courses > 0) {
      throw new BadRequestException(`${user.name} đang dạy ${user._count.courses} khoá. Chuyển các khoá sang giáo viên khác trước.`);
    }
    if (effectivePermissions(user.role).includes('role.manage') && !next.includes('role.manage')) {
      await this.assertManagerRemains({ exceptUser: id });
    }
    return this.prisma.user.update({ where: { id }, data: { roleId }, select: userSelect });
  }

  async createRole(me: AuthUser, dto: RoleDto) {
    this.assertGrantable(me, dto.permissions, 'tạo vai trò có quyền này');
    return this.prisma.role.create({
      data: {
        key: `r_${randomBytes(6).toString('hex')}`,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        permissions: dto.permissions,
      },
    });
  }

  async updateRole(me: AuthUser, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (dto.permissions) {
      if (role.system) throw new BadRequestException(`Không đổi quyền của vai trò hệ thống "${role.name}" được. Tạo vai trò mới nếu cần bộ quyền khác.`);
      this.assertGrantable(me, [...dto.permissions, ...role.permissions], 'sửa quyền của vai trò này');
      if (role.permissions.includes('role.manage') && !dto.permissions.includes('role.manage')) {
        await this.assertManagerRemains({ roleChange: { id, permissions: dto.permissions } });
      }
    }
    return this.prisma.role.update({
      where: { id },
      data: { name: dto.name?.trim(), description: dto.description?.trim(), permissions: dto.permissions },
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.system) throw new BadRequestException(`"${role.name}" là vai trò hệ thống, không xoá được`);
    if (role._count.users > 0) {
      throw new BadRequestException(`Còn ${role._count.users} tài khoản mang vai trò "${role.name}". Đổi họ sang vai trò khác trước.`);
    }
    await this.prisma.role.delete({ where: { id } });
  }
}

/** Trang quản trị: thống kê, tài khoản và vai trò, khoá học của mọi giáo viên. Mỗi endpoint cần quyền riêng. */
@Controller('admin')
@UseGuards(PermissionGuard)
export class AdminController {
  constructor(private prisma: PrismaService, private roles: RolesService) {}

  @Get('stats')
  @Need('stats.view')
  async stats() {
    const now = new Date();
    const [roles, courses, upcoming, live, recordings] = await Promise.all([
      this.prisma.role.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, _count: { select: { users: true } } } }),
      this.prisma.course.count(),
      this.prisma.classSession.count({ where: { status: 'SCHEDULED', startsAt: { gte: now } } }),
      this.prisma.classSession.count({ where: { status: 'LIVE' } }),
      this.prisma.recording.aggregate({ where: { status: 'READY' }, _count: true, _sum: { sizeBytes: true } }),
    ]);
    return {
      users: roles.map((r) => ({ id: r.id, name: r.name, count: r._count.users })),
      courses,
      upcomingSessions: upcoming,
      liveSessions: live,
      recordings: { count: recordings._count, bytes: Number(recordings._sum.sizeBytes ?? 0) },
    };
  }

  /** Danh mục quyền để vẽ ô tick. */
  @Get('permissions')
  @Need('role.manage', 'user.manage')
  permissions() {
    return PERMISSIONS;
  }

  @Get('roles')
  @Need('role.manage', 'user.manage', 'course.manage_all')
  async listRoles() {
    const roles = await this.prisma.role.findMany({ orderBy: [{ system: 'desc' }, { createdAt: 'asc' }], include: { _count: { select: { users: true } } } });
    return roles.map(({ _count, ...r }) => ({ ...r, permissions: effectivePermissions(r), users: _count.users }));
  }

  @Post('roles')
  @Need('role.manage')
  createRole(@CurrentUser() me: AuthUser, @Body() dto: RoleDto) {
    return this.roles.createRole(me, dto);
  }

  @Patch('roles/:id')
  @Need('role.manage')
  updateRole(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.updateRole(me, id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @Need('role.manage')
  async deleteRole(@Param('id') id: string) {
    await this.roles.deleteRole(id);
  }

  @Get('users')
  @Need('user.manage')
  async users(@Query('q') q?: string, @Query('roleId') roleId?: string) {
    const where: Prisma.UserWhereInput = {};
    const term = q?.trim();
    if (term) where.OR = [{ email: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }];
    if (roleId) where.roleId = roleId;
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { ...userSelect, _count: { select: { courses: true, enrollments: true } } },
    });
    return users.map(brief);
  }

  @Patch('users/:id')
  @Need('user.manage')
  setRole(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.roles.setUserRole(me, id, dto.roleId);
  }

  @Get('courses')
  @Need('course.manage_all', 'course.view_all')
  async courses() {
    const now = new Date();
    const list = await this.prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        sessions: { where: { startsAt: { gte: now }, status: 'SCHEDULED' }, orderBy: { startsAt: 'asc' }, take: 1 },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });
    return list.map((c) => ({
      id: c.id,
      title: c.title,
      published: c.published,
      teacher: c.teacher,
      students: c._count.enrollments,
      sessions: c._count.sessions,
      nextSession: c.sessions[0]?.startsAt ?? null,
    }));
  }

  /** Người nhận khoá học được: tài khoản có quyền tạo khoá học. */
  @Get('teachers')
  @Need('course.manage_all')
  async teachers() {
    const roles = await this.prisma.role.findMany({ select: { id: true, key: true, permissions: true } });
    const ids = roles.filter((r) => effectivePermissions(r).includes('course.create')).map((r) => r.id);
    return this.prisma.user.findMany({ where: { roleId: { in: ids } }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } });
  }

  /** Chuyển khoá học (cùng buổi học, học viên, tài liệu, bản ghi) sang giáo viên khác. */
  @Patch('courses/:id/teacher')
  @Need('course.manage_all')
  async transfer(@Param('id') id: string, @Body() dto: TransferDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    const teacher = await this.prisma.user.findUnique({ where: { id: dto.teacherId }, include: { role: true } });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên');
    if (!effectivePermissions(teacher.role).includes('course.create')) {
      throw new BadRequestException(`${teacher.name} chưa có quyền tạo và dạy khoá học`);
    }
    if (await this.prisma.classSession.count({ where: { courseId: id, status: 'LIVE' } })) {
      throw new BadRequestException('Khoá đang có buổi học diễn ra, chuyển sau khi buổi học kết thúc');
    }
    // Giáo viên mới từng là học viên của khoá thì bỏ khỏi danh sách học viên.
    await this.prisma.enrollment.deleteMany({ where: { courseId: id, userId: teacher.id } });
    await this.prisma.course.update({ where: { id }, data: { teacherId: teacher.id } });
    return { id, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } };
  }
}

@Module({ controllers: [AdminController], providers: [RolesService] })
export class AdminModule {}

