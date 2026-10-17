/**
 * Tạo tài khoản giáo viên đầu tiên (chạy mỗi lần khởi động, không tạo trùng).
 * Đặt SEED_DEMO=true để thêm khoá học mẫu, 5 học viên và một buổi học đang mở cửa.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_TEACHER_EMAIL ?? 'giaovien@bangden.local').toLowerCase();
  const password = process.env.SEED_TEACHER_PASSWORD ?? 'doimatkhau123';
  const name = process.env.SEED_TEACHER_NAME ?? 'Giáo viên';

  let teacher = await prisma.user.findUnique({ where: { email } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: { email, name, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Đã tạo tài khoản quản trị ${email}`);
  } else if (teacher.role !== 'ADMIN') {
    // Tài khoản trong SEED_TEACHER_EMAIL là chủ trang: luôn có quyền quản trị.
    await prisma.user.update({ where: { id: teacher.id }, data: { role: 'ADMIN' } });
  }

  if (process.env.SEED_DEMO !== 'true') return;
  if (await prisma.course.count({ where: { teacherId: teacher.id } })) return;

  const course = await prisma.course.create({
    data: {
      teacherId: teacher.id,
      title: 'Python cơ bản',
      description: '10 buổi học trực tuyến, từ biến và vòng lặp đến viết chương trình nhỏ.',
      published: true,
    },
  });
  const students = ['Nguyễn An', 'Trần Bình', 'Lê Chi', 'Phạm Dũng', 'Võ Hà'];
  const hash = await bcrypt.hash('hocvien123', 10);
  for (let i = 0; i < students.length; i++) {
    const u = await prisma.user.upsert({
      where: { email: `hocvien${i + 1}@bangden.local` },
      create: { email: `hocvien${i + 1}@bangden.local`, name: students[i], passwordHash: hash },
      update: {},
    });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id } });
  }
  const now = Date.now();
  await prisma.classSession.createMany({
    data: [
      {
        courseId: course.id,
        title: 'Buổi 5: Vòng lặp for',
        startsAt: new Date(now + 5 * 60_000),
        endsAt: new Date(now + 95 * 60_000),
        roomName: `bd-${randomBytes(6).toString('hex')}`,
      },
      {
        courseId: course.id,
        title: 'Buổi 6: Hàm',
        startsAt: new Date(now + 2 * 24 * 3600_000),
        endsAt: new Date(now + 2 * 24 * 3600_000 + 90 * 60_000),
        roomName: `bd-${randomBytes(6).toString('hex')}`,
      },
    ],
  });
  console.log('Đã tạo dữ liệu mẫu: hocvien1..5@bangden.local / hocvien123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
