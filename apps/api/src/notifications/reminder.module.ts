import { Injectable, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';

/** Gửi email qua Resend (HTTP). Chưa có RESEND_API_KEY thì chỉ ghi log để thử trên máy. */
@Injectable()
export class EmailService {
  private log = new Logger('Email');

  async send(to: string, subject: string, html: string) {
    if (!config.email.resendKey) {
      this.log.log(`(chưa cấu hình RESEND_API_KEY, không gửi) tới ${to}: ${subject}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.email.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.email.from, to: [to], subject, html }),
    });
    if (!res.ok) throw new Error(`Resend trả lỗi ${res.status}: ${await res.text()}`);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (d: Date) =>
  d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', weekday: 'long', day: '2-digit', month: '2-digit', timeZone: process.env.TZ || 'Asia/Ho_Chi_Minh' });

/**
 * Nhắc lịch học. Mỗi phút quét các buổi sắp bắt đầu và gửi hai lần:
 * - "60": khi còn 10–60 phút (buổi tạo sát giờ vẫn được nhắc một lần);
 * - "10": khi còn dưới 10 phút, lúc học viên đã vào phòng được.
 * Bảng reminders chống gửi trùng (kể cả khi API khởi động lại); đổi giờ buổi học thì nhắc lại.
 */
@Injectable()
export class ReminderService implements OnModuleInit, OnApplicationShutdown {
  private log = new Logger('Reminder');
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private prisma: PrismaService, private email: EmailService) {}

  onModuleInit() {
    if (process.env.REMINDERS === 'false') return;
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const sessions = await this.prisma.classSession.findMany({
        where: { status: 'SCHEDULED', startsAt: { gt: now, lte: new Date(now.getTime() + 60 * 60_000) } },
        include: {
          course: { include: { enrollments: { include: { user: { select: { id: true, email: true, name: true } } } } } },
        },
      });
      for (const s of sessions) {
        const minutes = (s.startsAt.getTime() - now.getTime()) / 60_000;
        const kind = minutes <= 10 ? '10' : '60';
        for (const { user } of s.course.enrollments) {
          // Ghi trước rồi mới gửi: trùng khoá nghĩa là đã nhắc, bỏ qua.
          const claimed = await this.prisma.reminder
            .create({ data: { sessionId: s.id, userId: user.id, kind, startsAt: s.startsAt } })
            .then(() => true)
            .catch(() => false);
          if (!claimed) continue;
          const link = `${config.appUrl}/room/${s.id}`;
          const subject =
            kind === '10' ? `Sắp vào lớp: ${s.course.title} · ${s.title}` : `Nhắc lịch: ${s.course.title} · ${s.title} lúc ${fmt(s.startsAt)}`;
          const html = `<p>Chào ${esc(user.name)},</p>
<p>Buổi <b>${esc(s.title)}</b> của khoá <b>${esc(s.course.title)}</b> bắt đầu lúc <b>${fmt(s.startsAt)}</b>.</p>
<p>${kind === '10' ? 'Lớp đã mở cửa, bạn vào được ngay:' : 'Lớp mở cửa trước giờ học 10 phút:'} <a href="${link}">${link}</a></p>
<p>Bảng Đen</p>`;
          try {
            await this.email.send(user.email, subject, html);
          } catch (e) {
            this.log.warn(`Không gửi được nhắc lịch tới ${user.email}: ${(e as Error).message}`);
          }
        }
      }
    } catch (e) {
      this.log.error(`Lỗi khi quét nhắc lịch: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}

@Module({ providers: [EmailService, ReminderService], exports: [EmailService, ReminderService] })
export class ReminderModule {}
