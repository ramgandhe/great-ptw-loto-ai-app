import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { isolationVerifications } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { RecordVerificationDto } from './dto/record-verification.dto';
import { IsolationExecutionService } from './isolation-execution.service';
import { VERIFICATION_PASS } from './isolation-execution.constants';
import { StatusValidationService } from './status-validation.service';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly executionService: IsolationExecutionService,
    private readonly statusValidation: StatusValidationService,
    private readonly auditService: AuditService,
  ) {}

  async record(executionId: string, dto: RecordVerificationDto, user: AuthenticatedUser) {
    const execution = await this.executionService.getExecutionEntity(executionId, user);
    this.statusValidation.assertVerifiable(execution.status);
    await this.executionService.assertPointBelongsToPlan(dto.isolationPointId, execution.planId);
    await this.statusValidation.assertPointLocked(execution.id, dto.isolationPointId);

    if (dto.result === VERIFICATION_PASS) {
      const [existingPass] = await this.db
        .select()
        .from(isolationVerifications)
        .where(
          and(
            eq(isolationVerifications.executionId, executionId),
            eq(isolationVerifications.isolationPointId, dto.isolationPointId),
            eq(isolationVerifications.result, VERIFICATION_PASS),
          ),
        );
      if (existingPass) {
        throw new ConflictException(
          'Isolation point already has a passing verification for this execution',
        );
      }
    }

    const [verification] = await this.db
      .insert(isolationVerifications)
      .values({
        tenantId: execution.tenantId,
        executionId,
        isolationPointId: dto.isolationPointId,
        result: dto.result,
        method: dto.method ?? null,
        comment: dto.comment ?? null,
        verifiedBy: user.id,
        createdBy: user.id,
      })
      .returning();

    await this.auditService.log({
      action: 'isolation.verification.recorded',
      entityType: 'isolation_verification',
      entityId: verification.id,
      userId: user.id,
      tenantId: execution.tenantId,
      metadata: {
        executionId,
        isolationPointId: dto.isolationPointId,
        result: dto.result,
      },
    });

    return verification;
  }

  async list(executionId: string, user: AuthenticatedUser) {
    await this.executionService.getExecutionEntity(executionId, user);
    return this.db
      .select()
      .from(isolationVerifications)
      .where(eq(isolationVerifications.executionId, executionId));
  }
}
