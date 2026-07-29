import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StorageService } from './infrastructure/storage/storage.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  const apiVersion = configService.get<string>('apiVersion') ?? 'v1';
  app.setGlobalPrefix(`api/${apiVersion}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  const storageService = app.get(StorageService);
  await storageService.ensureBucket();

  const port = configService.get<number>('port') ?? 4000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api/v1/health`);
}

bootstrap();
