import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth/auth.module';
import { ClassroomModule } from './classroom/classroom.module';
import { InteractionModule } from './classroom/interaction.module';
import { MediaModule } from './classroom/media.module';
import { StorageModule } from './common/storage.service';
import { ReminderModule } from './notifications/reminder.module';
import { config } from './common/config';
import { PrismaModule } from './common/prisma.service';
import { CoursesModule } from './courses/courses.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, CoursesModule, ClassroomModule, InteractionModule, MediaModule, ReminderModule],
  controllers: [HealthController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // LiveKit gửi webhook với content-type application/webhook+json.
  app.useBodyParser('json', { type: ['application/json', 'application/webhook+json'] });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  console.log(`API chạy ở cổng ${config.port}`);
}

bootstrap();
