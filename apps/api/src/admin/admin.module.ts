import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { IsIn, IsString } from 'class-validator';
import { AdminGuard, AuthUser, CurrentUser } from '../auth/auth.guard';
import { PrismaService } from '../common/prisma.service';

const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const;

class RoleDto {
  @IsIn(ROLES, { message: 'Vai trò phải là ADMIN, TEACHER hoặc STUDENT' })
  role: (typeof ROLES)[number];
}

class TransferDto {
  @IsString() teacherId: string;
}

const userSelect = { id: true, email: true, name: true, role: true, createdAt: true } as const;

/** Trang quản trị: cấp quyền giáo viên, xem và chuyển khoá học giữa các giáo viên. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const now = new Date();
    const [roles, courses, upcoming, live, recordings] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.course.count(),
      this.prisma.classSession.count({ where: { status: 'SCHEDULED', startsAt: { gte: now } } }),
      this.prisma.classSession.count({ where: { status: 'LIVE' } }),
      this.prisma.recording.aggregate({ where: { status: 'READY' }, _count: true, _sum: { sizeBytes: true } }),
    ]);
    const byRole = Object.fromEntries(ROLES.map((r) => [r, roles.find((x) => x.role === r)?._count ?? 0]));
    return {
      users: byRole,
      courses,
      upcomingSessions: upcoming,
      liveSessions: live,
      recordings: { count: recordings._count, bytes: Number(recordings._sum.sizeBytes ?? 0) },
    };
  }

  @Get('users')
  users(@Query('q') q?: string, @Query('role') role?: string) {
    const where: Prisma.UserWhereInput = {};
    const term = q?.trim();
    if (term) where.OR = [{ email: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }];
    if (role && (ROLES as readonly string[]).includes(role)) where.role = role as (typeof ROLES)[number];
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { ...userSelect, _count: { select: { courses: true, enrollments: true } } },
    });
  }

  @Patch('users/:id')
  async setRole(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: RoleDto) {
    // Không tự đổi vai trò của mình: tránh trường hợp không còn ai quản trị.
    if (id === me.id) throw new BadRequestException('Không tự đổi vai trò của chính mình được');
    const user = await this.prisma.user.findUnique({ where: { id }, include: { _count: { select: { courses: true } } } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    if (dto.role === 'STUDENT' && user._count.courses > 0) {
      throw new BadRequestException(`${user.name} đang dạy ${user._count.courses} khoá. Chuyển các khoá sang giáo viên khác trước.`);
    }
    return this.prisma.user.update({ where: { id }, data: { role: dto.role }, select: userSelect });
  }

  @Get('courses')
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

  /** Chuyển khoá học (cùng buổi học, học viên, tài liệu, bản ghi) sang giáo viên khác. */
  @Patch('courses/:id/teacher')
  async transfer(@Param('id') id: string, @Body() dto: TransferDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    const teacher = await this.prisma.user.findUnique({ where: { id: dto.teacherId } });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên');
    if (teacher.role === 'STUDENT') throw new BadRequestException(`${teacher.name} chưa có quyền giáo viên`);
    if (await this.prisma.classSession.count({ where: { courseId: id, status: 'LIVE' } })) {
      throw new BadRequestException('Khoá đang có buổi học diễn ra, chuyển sau khi buổi học kết thúc');
    }
    // Giáo viên mới từng là học viên của khoá thì bỏ khỏi danh sách học viên.
    await this.prisma.enrollment.deleteMany({ where: { courseId: id, userId: teacher.id } });
    await this.prisma.course.update({ where: { id }, data: { teacherId: teacher.id } });
    return { id, teacher: { id: teacher.id, name: teacher.name, email: teacher.email } };
  }
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
