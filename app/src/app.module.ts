import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { RedisInfrastructureModule } from './infrastructure/redis';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { SystemModule } from './modules/system/system.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { OrganisationModule } from './modules/organisation/organisation.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { PermitModule } from './modules/permit/permit.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { IsolationExecutionModule } from './modules/isolation-execution/isolation-execution.module';
import { LototoModule } from './modules/lototo/lototo.module';
import { RestorationModule } from './modules/restoration/restoration.module';
import { SimopsModule } from './modules/simops/simops.module';
import { DailyProgressModule } from './modules/daily-progress/daily-progress.module';
import { RevalidationModule } from './modules/revalidation/revalidation.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { InvestigationModule } from './modules/investigation/investigation.module';
import { IncidentClosureModule } from './modules/incident-closure/incident-closure.module';
import { ClosureModule } from './modules/closure/closure.module';
import { LoggingModule } from './modules/logging/logging.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env', '../infrastructure/.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        customProps: () => ({ service: 'ptw-api' }),
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    RedisInfrastructureModule,
    StorageModule,
    QueueModule,
    LoggingModule,
    AuthModule,
    SystemModule,
    MasterDataModule,
    OrganisationModule,
    WorkforceModule,
    ClosureModule,
    IncidentClosureModule,
    PermitModule,
    ApprovalModule,
    ExecutionModule,
    LototoModule,
    IsolationExecutionModule,
    RestorationModule,
    SimopsModule,
    DailyProgressModule,
    RevalidationModule,
    IncidentsModule,
    InvestigationModule,
    AiModule,
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
