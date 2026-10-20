import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IsBoolean, IsEmail, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { brief, USER_BRIEF } from '../common/avatar';
import { AuthGuard, AuthUser, CurrentUser, Need, PermissionGuard } from '../auth/auth.guard';
import { can } from '../auth/permissions';

class CourseDto {
  @IsString()
  @MinLength(3, { message: 'Tên khoá học cần ít nhất 3 ký tự' })
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

class UpdateCourseDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

class EnrollDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;
}

class SessionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @IsISO8601({}, { message: 'Giờ bắt đầu không hợp lệ' })
  startsAt: string;

  @IsISO8601({}, { message: 'Giờ kết thúc không hợp lệ' })
  endsAt: string;
}

class UpdateSessionDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;
  @IsOptional() @IsBoolean() cancelled?: boolean;
}

@Controller()
export class CoursesController {
  constructor(private prisma: PrismaService) {}

  /**
   * Khoá học mà người này được xem (mode view) hoặc sửa (mode manage): giáo viên của khoá,
   * hoặc người có quyền xem/quản lý mọi khoá học.
   */
  private async ownCourse(user: AuthUser, id: string, mode: 'view' | 'manage' = 'manage') {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    const allowed =
      course.teacherId === user.id || can(user, 'course.manage_all') || (mode === 'view' && can(user, 'course.view_all'));
    if (!allowed) throw new ForbiddenException('Đây không phải khoá học của bạn');
    return course;
  }

  /** Trang chủ: các khoá học đã công khai. */
  @Get('courses/public')
  async publicCourses() {
    const now = new Date();
    const courses = await this.prisma.course.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: { select: { name: true } },
        sessions: { where: { startsAt: { gte: now }, status: 'SCHEDULED' }, orderBy: { startsAt: 'asc' }, take: 1 },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });
    return courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      teacher: c.teacher.name,
      students: c._count.enrollments,
      sessions: c._count.sessions,
      nextSession: c.sessions[0]?.startsAt ?? null,
    }));
  }

  /** Khoá học mình dạy; người có quyền xem/quản lý mọi khoá thấy tất cả (kèm tên giáo viên). */
  @Get('courses')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.view_all', 'course.manage_all')
  async myCourses(@CurrentUser() user: AuthUser) {
    const all = can(user, 'course.view_all') || can(user, 'course.manage_all');
    const courses = await this.prisma.course.findMany({
      where: all ? {} : { teacherId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { teacher: { select: { id: true, name: true } }, _count: { select: { enrollments: true, sessions: true } } },
    });
    return courses.map((c) => ({ ...c, mine: c.teacherId === user.id }));
  }

  @Post('courses')
  @UseGuards(PermissionGuard)
  @Need('course.create')
  createCourse(@CurrentUser() user: AuthUser, @Body() dto: CourseDto) {
    return this.prisma.course.create({
      data: { teacherId: user.id, title: dto.title, description: dto.description ?? '', published: dto.published ?? false },
    });
  }

  @Get('courses/:id')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.view_all', 'course.manage_all')
  async course(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.ownCourse(user, id, 'view');
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        sessions: { orderBy: { startsAt: 'asc' } },
        // Số điện thoại chỉ đi qua đây: người được xem khoá này (giáo viên, quản lý khoá học).
        enrollments: { include: { user: { select: { ...USER_BRIEF, phone: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    return course && { ...course, enrollments: course.enrollments.map((e) => ({ ...e, user: brief(e.user) })) };
  }

  @Patch('courses/:id')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.manage_all')
  async updateCourse(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCourseDto) {
    await this.ownCourse(user, id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  @Post('courses/:id/enrollments')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.manage_all')
  async enroll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EnrollDto) {
    await this.ownCourse(user, id);
    const student = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!student) throw new NotFoundException('Email này chưa có tài khoản. Nhờ học viên đăng ký trước.');
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: student.id, courseId: id } },
      create: { userId: student.id, courseId: id },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  @Delete('courses/:id/enrollments/:userId')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.manage_all')
  @HttpCode(204)
  async unenroll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    await this.ownCourse(user, id);
    await this.prisma.enrollment.deleteMany({ where: { courseId: id, userId } });
  }

  @Post('courses/:id/sessions')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.manage_all')
  async createSession(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SessionDto) {
    await this.ownCourse(user, id);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
    return this.prisma.classSession.create({
      data: { courseId: id, title: dto.title, startsAt, endsAt, roomName: `bd-${randomBytes(6).toString('hex')}` },
    });
  }

  @Patch('sessions/:id')
  @UseGuards(PermissionGuard)
  @Need('course.create', 'course.manage_all')
  async updateSession(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    const s = await this.prisma.classSession.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Không tìm thấy buổi học');
    if (s.courseId) await this.ownCourse(user, s.courseId);
    else if (s.hostId !== user.id) throw new ForbiddenException('Đây không phải meeting của bạn');
    return this.prisma.classSession.update({
      where: { id },
      data: {
        title: dto.title,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        status: dto.cancelled === true ? 'CANCELLED' : dto.cancelled === false ? 'SCHEDULED' : undefined,
      },
    });
  }

  /** Lịch học: giáo viên thấy buổi của khoá mình dạy và meeting mình tạo, học viên thấy buổi của khoá đã đăng ký. */
  @Get('schedule')
  @UseGuards(AuthGuard)
  async schedule(@CurrentUser() user: AuthUser) {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    // Buổi mình dạy, meeting mình tạo và buổi của khoá mình học (một người có thể vừa dạy vừa học).
    const whose = {
      OR: [{ course: { teacherId: user.id } }, { hostId: user.id }, { course: { enrollments: { some: { userId: user.id } } } }],
    };
    const sessions = await this.prisma.classSession.findMany({
      where: { startsAt: { gte: since }, ...whose },
      orderBy: { startsAt: 'asc' },
      include: { course: { select: { id: true, title: true, teacherId: true, _count: { select: { enrollments: true } } } } },
    });
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      kind: s.course ? ('class' as const) : ('meeting' as const),
      course: s.course ? { id: s.course.id, title: s.course.title } : null,
      students: s.course?._count.enrollments ?? 0,
      /** Mình là người dạy/chủ phòng của buổi này (nút Mở lớp, Điểm danh). */
      mine: s.course ? s.course.teacherId === user.id : s.hostId === user.id,
    }));
  }
}

@Module({ controllers: [CoursesController] })
export class CoursesModule {}
