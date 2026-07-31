import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { restorationVerifications } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  EXECUTION_RESTORED,
  EXECUTION_VERIFIED,
} from '../isolation-execution/isolation-execution.constants';
import { IsolationExecutionService } from '../isolation-execution/isolation-execution.service';
import { RestorationVerificationDto } from './dto/restoration-verification.dto';
import { HistoryService } from './history.service';
import { RestorationCacheService } from './restoration-cache.service';
import { RestorationLogService } from './restoration-log.service';
import { RESTORATION_PASS } from './restoration.constants';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly executionService: IsolationExecutionService,
    private readonly historyService: HistoryService,
    private readonly auditService: AuditService,
    private readonly cacheService: RestorationCacheService,
    private readonly logService: RestorationLogService,
  ) {}

  async record(executionId: string, dto: RestorationVerificationDto, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    if (execution.status !== EXECUTION_VERIFIED && execution.status !== EXECUTION_RESTORED) {
      throw new ConflictException(
        `Restoration verification requires execution status '${EXECUTION_VERIFIED}' or '${EXECUTION_RESTORED}', but it is '${execution.status}'`,
      );
    }
    await this.executionService.assertPointBelongsToPlan(dto.isolationPointId, execution.planId);

    if (dto.result === RESTORATION_PASS) {
      const [existingPass] = await this.db
        .select()
        .from(restorationVerifications)
        .where(
          and(
            eq(restorationVerifications.executionId, executionId),
            eq(restorationVerifications.isolationPointId, dto.isolationPointId),
            eq(restorationVerifications.result, RESTORATION_PASS),
          ),
        );
      if (existingPass) {
        throw new ConflictException(
          'Isolation point already has a passing restoration verification for this execution',
        );
      }
    }

    const [verification] = await this.db
      .insert(restorationVerifications)
      .values({
        tenantId: execution.tenantId,
        executionId,
        restorationId: dto.restorationId ?? null,
        isolationPointId: dto.isolationPointId,
        result: dto.result,
        method: dto.method ?? null,
        comment: dto.comment ?? null,
        verifiedBy: user.id,
        createdBy: user.id,
      })
      .returning();

    await this.historyService.record({
      tenantId: execution.tenantId,
      planId: execution.planId,
      executionId,
      action: 'restoration.verified',
      entityType: 'restoration_verification',
      entityId: verification.id,
      actorId: user.id,
      metadata: { isolationPointId: dto.isolationPointId, result: dto.result },
    });

    await this.auditService.log({
      action: 'isolation.restoration.verified',
      entityType: 'restoration_verification',
      entityId: verification.id,
      userId: user.id,
      tenantId: execution.tenantId,
      metadata: { executionId, isolationPointId: dto.isolationPointId, result: dto.result },
    });
    this.logService.logEvent({
      action: 'restoration.verified',
      executionId,
      planId: execution.planId,
      tenantId: execution.tenantId,
      userId: user.id,
      metadata: { isolationPointId: dto.isolationPointId, result: dto.result },
    });
    await this.cacheService.invalidate(execution.tenantId, executionId, execution.planId);

    return verification;
  }
}
