import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { validateEnv } from './config/validate-env';
import { StorageService } from './infrastructure/storage/storage.service';

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);

  if (configService.get<boolean>('security.trustProxy')) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  if (configService.get<boolean>('security.helmetEnabled') !== false) {
    app.use(
      helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
        crossOriginEmbedderPolicy: false,
      }),
    );
  }

  const bodyLimit = process.env.API_BODY_LIMIT ?? '1mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: configService.get<string>('apiVersion') ?? 'v1',
    // apiVersion already includes the "v" prefix (e.g. "v1"); disable Nest's default "v" prefix
    prefix: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const storageService = app.get(StorageService);
  await storageService.ensureBucket();

  const configuredPort = configService.get<number>('port');
  const port =
    typeof configuredPort === 'number' && Number.isFinite(configuredPort) && configuredPort > 0
      ? configuredPort
      : 4000;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api/v1/health`);
}

bootstrap();
