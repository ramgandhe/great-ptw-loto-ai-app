import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../../infrastructure/keycloak/keycloak-admin.module';
import { ExecutionModule } from '../execution/execution.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PermitModule } from '../permit/permit.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { ClosureAttachmentService } from './closure-attachment.service';
import { ClosureCacheService } from './closure-cache.service';
import { ClosureController } from './closure.controller';
import { ClosureJobsService } from './closure-jobs.service';
import { ClosureLogService } from './closure-log.service';
import { ClosureService } from './closure.service';
import { HistoryService } from './history.service';
import { NotificationService } from './notification.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [PermitModule, ExecutionModule, NotificationsModule, KeycloakAdminModule],
  controllers: [ArchiveController, ClosureController],
  providers: [
    VerificationService,
    ClosureService,
    ArchiveService,
    HistoryService,
    ClosureLogService,
    ClosureCacheService,
    ClosureJobsService,
    ClosureAttachmentService,
    NotificationService,
  ],
  exports: [
    VerificationService,
    ClosureService,
    ArchiveService,
    HistoryService,
    ClosureCacheService,
    ClosureLogService,
  ],
})
export class ClosureModule {}
