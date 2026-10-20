import 'reflect-metadata';
import { HttpException, HttpStatus, Injectable, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BreakoutModule } from './classroom/breakout.module';
import { ClassroomModule } from './classroom/classroom.module';
import { InteractionModule } from './classroom/interaction.module';
import { MediaModule } from './classroom/media.module';
import { WebinarModule } from './classroom/webinar.module';
import { StorageModule } from './common/storage.service';
import { ReminderModule } from './notifications/reminder.module';
import { config } from './common/config';
import { PrismaModule } from './common/prisma.service';
import { CoursesModule } from './courses/courses.module';
import { HealthController } from './health.controller';
import { MeetingsModule } from './meetings/meetings.module';
import { GgbModule } from './geogebra/ggb.module';
import { SiteModule } from './site/site.module';

/** Giới hạn số lần gọi API theo IP, báo lỗi bằng tiếng Việt. */
@Injectable()
class RateLimitGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException('Bạn thao tác quá nhanh, thử lại sau ít phút', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule, StorageModule, AuthModule, CoursesModule, ClassroomModule, InteractionModule, MediaModule, ReminderModule, AdminModule, BreakoutModule, WebinarModule, MeetingsModule, GgbModule, SiteModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // LiveKit gửi webhook với content-type application/webhook+json.
  // Bài GeoGebra lưu dạng Base64 tối đa 2 MB (MAX_GGB_BASE64), nên nới giới hạn body JSON lên 3 MB.
  app.useBodyParser('json', { type: ['application/json', 'application/webhook+json'], limit: '3mb' });
  // API đứng sau Next.js rewrite (và Caddy trên VPS): lấy IP người dùng từ X-Forwarded-For.
  app.set('trust proxy', config.trustProxy);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  console.log(`API chạy ở cổng ${config.port}`);
}

bootstrap();
