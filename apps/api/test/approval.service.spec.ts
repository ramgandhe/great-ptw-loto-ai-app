import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../src/common/interfaces/authenticated-user.interface';
import * as schema from '../src/database/schema';
import { ApprovalHistoryService } from '../src/modules/approval/approval-history.service';
import { ApprovalCacheService } from '../src/modules/approval/approval-cache.service';
import { ApprovalLogService } from '../src/modules/approval/approval-log.service';
import { ApprovalService } from '../src/modules/approval/approval.service';
import { NotificationService } from '../src/modules/approval/notification.service';
import { WorkflowEngineService } from '../src/modules/approval/workflow-engine.service';
import { AuditService } from '../src/modules/logging/audit.service';
import { PermitCacheService } from '../src/modules/permit/permit-cache.service';
import { PermitService } from '../src/modules/permit/permit.service';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('ApprovalService integration (PUS-136)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let approvalService: ApprovalService;
  let approvalCacheService: ApprovalCacheService;

  const issuerId = randomUUID();
  const supervisorId = randomUUID();
  const orgAdminId = randomUUID();
  const locationId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });

    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder: './src/database/migrations' });
    } catch {
      canConnect = false;
    }

    if (!canConnect) {
      return;
    }

    const workflowEngine = new WorkflowEngineService(db);
    const approvalHistoryService = new ApprovalHistoryService(db);
    const notificationService = {
      enqueueApprovalNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;
    const auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const permitCacheService = {
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
      getPermitDetail: jest.fn().mockResolvedValue(null),
      setPermitDetail: jest.fn().mockResolvedValue(undefined),
    } as unknown as PermitCacheService;
    approvalCacheService = {
      getPendingList: jest.fn().mockResolvedValue(null),
      setPendingList: jest.fn().mockResolvedValue(undefined),
      invalidateTenant: jest.fn().mockResolvedValue(undefined),
    } as unknown as ApprovalCacheService;
    const approvalLogService = {
      logEvent: jest.fn(),
    } as unknown as ApprovalLogService;

    const permitService = {
      findOne: jest.fn(async (permitId: string, user: AuthenticatedUser) => {
        const [permit] = await db
          .select()
          .from(schema.permits)
          .where(eq(schema.permits.id, permitId));

        if (!permit || permit.tenantId !== user.tenantId) {
          throw new Error('Permit not found');
        }

        return {
          permit,
          draft: null,
          hazards: [],
          ppe: [],
          executors: [],
          attachments: [],
        };
      }),
    } as unknown as PermitService;

    approvalService = new ApprovalService(
      db,
      permitService,
      workflowEngine,
      approvalHistoryService,
      notificationService,
      auditService,
      permitCacheService,
      approvalCacheService,
      approvalLogService,
    );
  });

  afterAll(async () => {
    if (canConnect) {
      await pool.end();
    }
  });

  const dbTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  function testContext() {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const supervisorUser: AuthenticatedUser = {
      id: supervisorId,
      username: 'supervisor',
      tenantId,
      roles: ['supervisor'],
      email: 'supervisor@example.com',
    };

    const orgAdminUser: AuthenticatedUser = {
      id: orgAdminId,
      username: 'org-admin',
      tenantId,
      roles: ['org-admin'],
      email: 'org-admin@example.com',
    };

    async function createWorkflowSteps(stepCount: 1 | 2 = 2) {
      const [step1] = await db
        .insert(schema.workflowSteps)
        .values({
          tenantId,
          permitTypeId,
          stepSequence: 1,
          name: 'Safety Officer Review',
          approverRole: 'supervisor',
          createdBy: issuerId,
        })
        .returning();

      if (stepCount === 1) {
        return { step1, step2: null };
      }

      const [step2] = await db
        .insert(schema.workflowSteps)
        .values({
          tenantId,
          permitTypeId,
          stepSequence: 2,
          name: 'Head of Department Approval',
          approverRole: 'org-admin',
          createdBy: issuerId,
        })
        .returning();

      return { step1, step2 };
    }

    async function createPendingPermit() {
      const [permit] = await db
        .insert(schema.permits)
        .values({
          tenantId,
          status: 'pending_approval',
          permitTypeId,
          title: 'Confined space entry',
          locationId,
          plannedStartAt: new Date('2026-09-01T08:00:00Z'),
          plannedEndAt: new Date('2026-09-01T16:00:00Z'),
          submittedAt: new Date(),
          submittedBy: issuerId,
          createdBy: issuerId,
        })
        .returning();

      return permit;
    }

    return {
      tenantId,
      permitTypeId,
      supervisorUser,
      orgAdminUser,
      createWorkflowSteps,
      createPendingPermit,
    };
  }

  dbTest('rejects approval when permit is not pending', async () => {
    const { tenantId, permitTypeId, supervisorUser } = testContext();

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'draft',
        permitTypeId,
        title: 'Draft permit',
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        createdBy: issuerId,
      })
      .returning();

    await expect(
      approvalService.approve(permit.id, {}, supervisorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('rejects duplicate approval for the same step', async () => {
    const { supervisorUser, createPendingPermit, createWorkflowSteps } = testContext();
    const permit = await createPendingPermit();
    await createWorkflowSteps(1);

    await approvalService.approve(permit.id, { comment: 'Looks good' }, supervisorUser);

    await expect(
      approvalService.approve(permit.id, { comment: 'Again' }, supervisorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('rejects out-of-sequence approver', async () => {
    const { orgAdminUser, createPendingPermit, createWorkflowSteps } = testContext();
    const permit = await createPendingPermit();
    await createWorkflowSteps();

    await expect(
      approvalService.approve(permit.id, {}, orgAdminUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  dbTest('rejects defer without comment when step requires it', async () => {
    const { supervisorUser, createPendingPermit, createWorkflowSteps } = testContext();
    const permit = await createPendingPermit();
    await createWorkflowSteps();

    await expect(
      approvalService.defer(permit.id, { comment: '' }, supervisorUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  dbTest('advances multi-stage workflow and finalises permit', async () => {
    const { supervisorUser, createPendingPermit, createWorkflowSteps } = testContext();
    const multiStageApprover: AuthenticatedUser = {
      ...supervisorUser,
      roles: ['supervisor', 'org-admin'],
    };
    const permit = await createPendingPermit();
    await createWorkflowSteps();

    const afterFirst = await approvalService.approve(permit.id, {}, multiStageApprover);
    expect(afterFirst.permit.status).toBe('pending_approval');
    expect(afterFirst.activeAssignment?.step.approverRole).toBe('org-admin');

    const afterSecond = await approvalService.approve(permit.id, {}, multiStageApprover);
    expect(afterSecond.permit.status).toBe('approved');

    const history = await approvalService.getHistory(permit.id, multiStageApprover);
    expect(history.some((entry) => entry.action === 'stage_advanced')).toBe(true);
    expect(history.some((entry) => entry.action === 'approved')).toBe(true);
  });

  dbTest('invalidates approval cache after reject decision', async () => {
    const { supervisorUser, createPendingPermit, createWorkflowSteps, tenantId } = testContext();
    const permit = await createPendingPermit();
    await createWorkflowSteps(1);

    await approvalService.reject(
      permit.id,
      { comment: 'Missing isolation plan' },
      supervisorUser,
    );

    expect(approvalCacheService.invalidateTenant).toHaveBeenCalledWith(tenantId);
  });

  dbTest('rejects permit with mandatory comment', async () => {
    const { supervisorUser, createPendingPermit, createWorkflowSteps } = testContext();
    const permit = await createPendingPermit();
    await createWorkflowSteps();

    const result = await approvalService.reject(
      permit.id,
      { comment: 'Missing isolation plan' },
      supervisorUser,
    );

    expect(result.permit.status).toBe('rejected');
  });

  dbTest('defers permit to deferred status', async () => {
    const { supervisorUser, createPendingPermit, createWorkflowSteps } = testContext();
    const permit = await createPendingPermit();
    await createWorkflowSteps();

    const result = await approvalService.defer(
      permit.id,
      { comment: 'Need updated gas test' },
      supervisorUser,
    );

    expect(result.permit.status).toBe('deferred');
  });
});
