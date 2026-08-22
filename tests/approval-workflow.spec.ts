import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import * as schema from '../app/src/database/schema';
import { ApprovalCacheService } from '../app/src/modules/approval/approval-cache.service';
import { ApprovalHistoryService } from '../app/src/modules/approval/approval-history.service';
import { ApprovalJobsService } from '../app/src/modules/approval/approval-jobs.service';
import { ApprovalLogService } from '../app/src/modules/approval/approval-log.service';
import { ApprovalService } from '../app/src/modules/approval/approval.service';
import { DelegationService } from '../app/src/modules/approval/delegation.service';
import { NotificationService } from '../app/src/modules/approval/notification.service';
import { WorkflowEngineService } from '../app/src/modules/approval/workflow-engine.service';
import { AuditService } from '../app/src/modules/logging/audit.service';
import { PermitCacheService } from '../app/src/modules/permit/permit-cache.service';
import { PermitService } from '../app/src/modules/permit/permit.service';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Approval workflow remediation (SP-09.01)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let approvalService: ApprovalService;
  let approvalJobsService: ApprovalJobsService;
  let workflowEngine: WorkflowEngineService;
  let notificationService: NotificationService;

  const issuerId = randomUUID();
  const supervisorId = randomUUID();
  const safetyOfficerId = randomUUID();
  const delegateId = randomUUID();
  const locationId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });

    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
    }

    if (!canConnect) {
      return;
    }

    workflowEngine = new WorkflowEngineService(db);
    const approvalHistoryService = new ApprovalHistoryService(db);
    const delegationService = new DelegationService(db);
    notificationService = {
      enqueueApprovalNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;
    const auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const permitCacheService = {
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
      getPermitDetail: jest.fn().mockResolvedValue(null),
      setPermitDetail: jest.fn().mockResolvedValue(undefined),
    } as unknown as PermitCacheService;
    const approvalCacheService = {
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
      delegationService,
    );

    approvalJobsService = new ApprovalJobsService(
      db,
      { getQueue: jest.fn().mockReturnValue({ add: jest.fn().mockResolvedValue(undefined) }) } as never,
      { get: jest.fn().mockReturnValue('0 * * * *') } as never,
      approvalLogService,
      approvalCacheService,
      approvalHistoryService,
      { fromApprovalPayload: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterAll(async () => {
    if (canConnect) {
      await pool.end();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
      username: 'hod',
      tenantId,
      roles: ['hod'],
      email: 'supervisor@example.com',
    };

    const safetyOfficerUser: AuthenticatedUser = {
      id: safetyOfficerId,
      username: 'safety-officer',
      tenantId,
      roles: ['safety-officer'],
      email: 'safety@example.com',
    };

    const delegateUser: AuthenticatedUser = {
      id: delegateId,
      username: 'delegate',
      tenantId,
      roles: ['job-issuer'],
      email: 'delegate@example.com',
    };

    async function createPendingPermit(status: 'pending_approval' | 'approved' = 'pending_approval') {
      const [permit] = await db
        .insert(schema.permits)
        .values({
          tenantId,
          status,
          permitTypeId,
          title: 'Hot work permit',
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

    async function createParallelStep(quorumMode: 'all' | 'first') {
      const [step] = await db
        .insert(schema.workflowSteps)
        .values({
          tenantId,
          permitTypeId,
          stepSequence: 1,
          name: 'Joint sign-off',
          approverRole: 'hod',
          stageMode: 'parallel',
          quorumMode,
          parallelRoles: ['hod', 'safety-officer'],
          createdBy: issuerId,
        })
        .returning();

      return step;
    }

    return {
      tenantId,
      permitTypeId,
      supervisorUser,
      safetyOfficerUser,
      delegateUser,
      createPendingPermit,
      createParallelStep,
    };
  }

  dbTest('parallel quorum all requires every role before finalising', async () => {
    const { supervisorUser, safetyOfficerUser, createPendingPermit, createParallelStep } =
      testContext();
    const permit = await createPendingPermit();
    await createParallelStep('all');

    const afterSupervisor = await approvalService.approve(
      permit.id,
      { comment: 'Supervisor ok' },
      supervisorUser,
    );
    expect(afterSupervisor.permit.status).toBe('pending_approval');

    const activeAssignments = await workflowEngine.getActiveAssignments(permit.id);
    expect(activeAssignments).toHaveLength(1);
    expect(activeAssignments[0]?.assignment.assignmentSlot).toBe('safety-officer');

    const afterSafetyOfficer = await approvalService.approve(
      permit.id,
      { comment: 'Safety ok' },
      safetyOfficerUser,
    );
    expect(afterSafetyOfficer.permit.status).toBe('approved');
  });

  dbTest('parallel quorum first finalises after the first approval', async () => {
    const { supervisorUser, createPendingPermit, createParallelStep } = testContext();
    const permit = await createPendingPermit();
    await createParallelStep('first');

    const result = await approvalService.approve(
      permit.id,
      { comment: 'Supervisor ok' },
      supervisorUser,
    );
    expect(result.permit.status).toBe('approved');

    const assignments = await workflowEngine.listAssignmentsForPermit(permit.id);
    const skipped = assignments.filter((row) => row.assignment.status === 'skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.assignment.assignmentSlot).toBe('safety-officer');
  });

  dbTest('allows delegated approver and records decidedOnBehalfOf', async () => {
    const { tenantId, delegateUser, createPendingPermit } = testContext();
    const permit = await createPendingPermit();

    await db.insert(schema.workflowSteps).values({
      tenantId,
      permitTypeId: permit.permitTypeId,
      stepSequence: 1,
      name: 'Supervisor review',
      approverRole: 'hod',
      createdBy: issuerId,
    });

    const validFrom = new Date(Date.now() - 60 * 60 * 1000);
    const validTo = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(schema.approvalDelegations).values({
      tenantId,
      delegatorId: supervisorId,
      delegateId,
      role: 'hod',
      validFrom,
      validTo,
      createdBy: supervisorId,
    });

    const result = await approvalService.approve(
      permit.id,
      { comment: 'Approved on behalf' },
      delegateUser,
    );

    expect(result.permit.status).toBe('approved');

    const [decision] = await db
      .select()
      .from(schema.permitApprovals)
      .where(eq(schema.permitApprovals.permitId, permit.id));

    expect(decision.decidedBy).toBe(delegateId);
    expect(decision.decidedOnBehalfOf).toBe(supervisorId);
  });

  dbTest('stores rejection reason code on reject', async () => {
    const { supervisorUser, createPendingPermit } = testContext();
    const permit = await createPendingPermit();

    await db.insert(schema.workflowSteps).values({
      tenantId: permit.tenantId,
      permitTypeId: permit.permitTypeId,
      stepSequence: 1,
      name: 'Supervisor review',
      approverRole: 'hod',
      createdBy: issuerId,
    });

    await approvalService.reject(
      permit.id,
      { comment: 'Incomplete hazard assessment', reasonCode: 'incomplete_hazard_info' },
      supervisorUser,
    );

    const [decision] = await db
      .select()
      .from(schema.permitApprovals)
      .where(eq(schema.permitApprovals.permitId, permit.id));

    expect(decision.reasonCode).toBe('incomplete_hazard_info');
  });

  dbTest('safety officer can veto an approved permit', async () => {
    const { safetyOfficerUser, createPendingPermit } = testContext();
    const permit = await createPendingPermit('approved');

    const result = await approvalService.safetyVeto(
      permit.id,
      { comment: 'Unsafe conditions observed on site' },
      safetyOfficerUser,
    );

    expect(result.permit.status).toBe('rejected');

    const history = await approvalService.getHistory(permit.id, safetyOfficerUser);
    expect(history.some((entry) => entry.action === 'safety_veto')).toBe(true);
    expect(notificationService.enqueueApprovalNotification).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'safety_veto', permitId: permit.id }),
    );
  });

  dbTest('rejects safety veto from non-safety-officer', async () => {
    const { supervisorUser, createPendingPermit } = testContext();
    const permit = await createPendingPermit('approved');

    await expect(
      approvalService.safetyVeto(
        permit.id,
        { comment: 'Should not be allowed' },
        supervisorUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  dbTest('rejects safety veto on closed permit', async () => {
    const { tenantId, permitTypeId, safetyOfficerUser } = testContext();

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'closed',
        permitTypeId,
        title: 'Closed permit',
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        submittedAt: new Date(),
        submittedBy: issuerId,
        createdBy: issuerId,
      })
      .returning();

    await expect(
      approvalService.safetyVeto(
        permit.id,
        { comment: 'Too late' },
        safetyOfficerUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('escalates overdue SLA assignments and records audit trail', async () => {
    const { tenantId, createPendingPermit } = testContext();
    const permit = await createPendingPermit();

    const [step] = await db
      .insert(schema.workflowSteps)
      .values({
        tenantId,
        permitTypeId: permit.permitTypeId,
        stepSequence: 1,
        name: 'Supervisor review',
        approverRole: 'hod',
        slaHours: 4,
        stepConfig: { escalationRole: 'safety-officer' },
        createdBy: issuerId,
      })
      .returning();

    const [assignment] = await db
      .insert(schema.workflowAssignments)
      .values({
        permitId: permit.id,
        workflowStepId: step.id,
        assigneeId: supervisorId,
        assignmentSlot: 'default',
        status: 'active',
        slaDeadlineAt: new Date(Date.now() - 60 * 60 * 1000),
        escalationLevel: 0,
        createdBy: issuerId,
      })
      .returning();

    const escalated = await approvalJobsService.escalateOverdueSlas();
    expect(escalated).toBeGreaterThanOrEqual(1);

    const [updated] = await db
      .select()
      .from(schema.workflowAssignments)
      .where(eq(schema.workflowAssignments.id, assignment.id));

    expect(updated.escalationLevel).toBe(1);
    expect(updated.slaDeadlineAt).toBeInstanceOf(Date);
    expect(updated.slaDeadlineAt!.getTime()).toBeGreaterThan(Date.now());

    const escalations = await db
      .select()
      .from(schema.approvalSlaEscalations)
      .where(
        and(
          eq(schema.approvalSlaEscalations.permitId, permit.id),
          eq(schema.approvalSlaEscalations.workflowAssignmentId, assignment.id),
        ),
      );

    expect(escalations).toHaveLength(1);
    expect(escalations[0]?.escalationLevel).toBe(1);
    expect(escalations[0]?.fallbackRole).toBe('safety-officer');

    const history = await db
      .select()
      .from(schema.approvalHistory)
      .where(eq(schema.approvalHistory.permitId, permit.id));

    expect(history.some((entry) => entry.action === 'sla_escalated')).toBe(true);
  });
});
