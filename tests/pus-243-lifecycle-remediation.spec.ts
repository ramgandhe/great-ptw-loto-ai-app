import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import * as schema from '../app/src/database/schema';
import { HOD_INITIAL_REVIEW_ACTION } from '../app/src/modules/approval/approval.constants';
import { ApprovalHistoryService } from '../app/src/modules/approval/approval-history.service';
import { ApprovalCacheService } from '../app/src/modules/approval/approval-cache.service';
import { ApprovalLogService } from '../app/src/modules/approval/approval-log.service';
import { ApprovalService } from '../app/src/modules/approval/approval.service';
import { NotificationService } from '../app/src/modules/approval/notification.service';
import { WorkflowEngineService } from '../app/src/modules/approval/workflow-engine.service';
import { HOD_FINAL_CLOSURE_ACTION } from '../app/src/modules/closure/closure.constants';
import { ClosureCacheService } from '../app/src/modules/closure/closure-cache.service';
import { ClosureLogService } from '../app/src/modules/closure/closure-log.service';
import { ClosureService } from '../app/src/modules/closure/closure.service';
import { NotificationService as ClosureNotificationService } from '../app/src/modules/closure/notification.service';
import { StatusTransitionService } from '../app/src/modules/execution/status-transition.service';
import { AuditService } from '../app/src/modules/logging/audit.service';
import { PermitCacheService } from '../app/src/modules/permit/permit-cache.service';
import { PermitLifecycleService } from '../app/src/modules/permit/permit-lifecycle.service';
import { PermitService } from '../app/src/modules/permit/permit.service';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('PUS-243 lifecycle remediation DB IT', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let approvalService: ApprovalService;
  let workflowEngine: WorkflowEngineService;
  let closureService: ClosureService;
  let auditService: { log: jest.Mock };

  const issuerId = randomUUID();
  const supervisorId = randomUUID();
  const orgAdminId = randomUUID();
  const safetyId = randomUUID();
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
    const notificationService = {
      enqueueApprovalNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
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
    const approvalLogService = { logEvent: jest.fn() } as unknown as ApprovalLogService;

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
      auditService as unknown as AuditService,
      permitCacheService,
      approvalCacheService,
      approvalLogService,
      new PermitLifecycleService(),
      {
        findActiveForDelegate: jest.fn().mockResolvedValue(null),
      } as never,
    );

    closureService = new ClosureService(
      db,
      permitService,
      new StatusTransitionService(db, new PermitLifecycleService()),
      auditService as unknown as AuditService,
      permitCacheService,
      {
        invalidatePermit: jest.fn().mockResolvedValue(undefined),
      } as unknown as ClosureCacheService,
      { logEvent: jest.fn() } as unknown as ClosureLogService,
      {
        enqueueClosureNotification: jest.fn().mockResolvedValue(undefined),
      } as unknown as ClosureNotificationService,
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

  function users(tenantId: string) {
    return {
      supervisor: {
        id: supervisorId,
        username: 'supervisor',
        tenantId,
        roles: ['supervisor'],
        email: 'supervisor@example.com',
      } satisfies AuthenticatedUser,
      orgAdmin: {
        id: orgAdminId,
        username: 'org-admin',
        tenantId,
        roles: ['org-admin'],
        email: 'org-admin@example.com',
      } satisfies AuthenticatedUser,
      safety: {
        id: safetyId,
        username: 'safety',
        tenantId,
        roles: ['supervisor'],
        email: 'safety@example.com',
      } satisfies AuthenticatedUser,
      platformAdmin: {
        id: randomUUID(),
        username: 'platform-admin',
        tenantId,
        roles: ['platform-admin'],
        email: 'platform-admin@example.com',
      } satisfies AuthenticatedUser,
    };
  }

  async function createPendingPermit(tenantId: string, permitTypeId: string) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'pending_approval',
        permitTypeId,
        title: 'PUS-243 remediation permit',
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

  dbTest('FR-PTW-016 parallel quorum=all requires both approvals before final', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { supervisor, orgAdmin } = users(tenantId);

    await db.insert(schema.workflowSteps).values([
      {
        tenantId,
        permitTypeId,
        stepSequence: 1,
        name: 'Safety parallel',
        approverRole: 'supervisor',
        parallelGroup: 'wave-a',
        quorumMode: 'all',
        createdBy: issuerId,
      },
      {
        tenantId,
        permitTypeId,
        stepSequence: 2,
        name: 'HOD parallel',
        approverRole: 'org-admin',
        parallelGroup: 'wave-a',
        quorumMode: 'all',
        createdBy: issuerId,
      },
    ]);

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);

    const afterFirst = await approvalService.approve(permit.id, {}, supervisor);
    expect(afterFirst.permit.status).toBe('pending_approval');
    expect(afterFirst.decisions).toHaveLength(1);

    const afterSecond = await approvalService.approve(permit.id, {}, orgAdmin);
    expect(afterSecond.permit.status).toBe('approved');
    expect(afterSecond.decisions).toHaveLength(2);
  });

  dbTest('FR-PTW-016 parallel quorum=first finalises on first approve and skips peer', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { supervisor, orgAdmin } = users(tenantId);

    await db.insert(schema.workflowSteps).values([
      {
        tenantId,
        permitTypeId,
        stepSequence: 1,
        name: 'Safety first',
        approverRole: 'supervisor',
        parallelGroup: 'wave-b',
        quorumMode: 'first',
        createdBy: issuerId,
      },
      {
        tenantId,
        permitTypeId,
        stepSequence: 2,
        name: 'HOD first',
        approverRole: 'org-admin',
        parallelGroup: 'wave-b',
        quorumMode: 'first',
        createdBy: issuerId,
      },
    ]);

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);

    const result = await approvalService.approve(permit.id, {}, supervisor);
    expect(result.permit.status).toBe('approved');

    const assignments = await workflowEngine.listAssignmentsForPermit(permit.id);
    expect(assignments.some((row) => row.assignment.status === 'skipped')).toBe(true);

    await expect(approvalService.approve(permit.id, {}, orgAdmin)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  dbTest('FR-PTW-028 reject in parallel rejects whole permit; partial approve is not final', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { supervisor, orgAdmin } = users(tenantId);

    await db.insert(schema.workflowSteps).values([
      {
        tenantId,
        permitTypeId,
        stepSequence: 1,
        name: 'Safety parallel reject',
        approverRole: 'supervisor',
        parallelGroup: 'wave-c',
        quorumMode: 'all',
        createdBy: issuerId,
      },
      {
        tenantId,
        permitTypeId,
        stepSequence: 2,
        name: 'HOD parallel reject',
        approverRole: 'org-admin',
        parallelGroup: 'wave-c',
        quorumMode: 'all',
        createdBy: issuerId,
      },
    ]);

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);

    const partial = await approvalService.approve(permit.id, {}, supervisor);
    expect(partial.permit.status).toBe('pending_approval');

    const rejected = await approvalService.reject(
      permit.id,
      { comment: 'Missing controls', reasonCode: 'insufficient_controls' },
      orgAdmin,
    );
    expect(rejected.permit.status).toBe('rejected');
  });

  dbTest('FR-PTW-026 resume_from_rejecting_stage preserves upstream approvals', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { supervisor, orgAdmin } = users(tenantId);

    await db.insert(schema.approvalWorkflowTemplates).values({
      tenantId,
      permitTypeId,
      code: `resume-${permitTypeId.slice(0, 8)}`,
      name: 'Resume template',
      resubmitMode: 'resume_from_rejecting_stage',
      isDefault: true,
      createdBy: issuerId,
    });

    const [step1, step2, step3] = await db
      .insert(schema.workflowSteps)
      .values([
        {
          tenantId,
          permitTypeId,
          stepSequence: 1,
          name: 'Stage 1',
          approverRole: 'supervisor',
          createdBy: issuerId,
        },
        {
          tenantId,
          permitTypeId,
          stepSequence: 2,
          name: 'Stage 2',
          approverRole: 'org-admin',
          createdBy: issuerId,
        },
        {
          tenantId,
          permitTypeId,
          stepSequence: 3,
          name: 'Stage 3',
          approverRole: 'supervisor',
          createdBy: issuerId,
        },
      ])
      .returning();

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);

    await approvalService.approve(permit.id, {}, supervisor);
    await approvalService.reject(
      permit.id,
      { comment: 'Need denser isolation', reasonCode: 'incomplete_hazard_information' },
      orgAdmin,
    );

    const mode = await workflowEngine.resolveResubmitMode(tenantId, permitTypeId);
    expect(mode).toBe('resume_from_rejecting_stage');

    const { assignments, resubmitMode, resumeFromSequence } =
      await workflowEngine.initializeAtSubmit(
        permit.id,
        tenantId,
        permitTypeId,
        issuerId,
        undefined,
        { isResubmit: true, fromStatus: 'rejected' },
      );

    expect(resubmitMode).toBe('resume_from_rejecting_stage');
    expect(resumeFromSequence).toBe(step2.stepSequence);

    const byStep = new Map(assignments.map((row) => [row.workflowStepId, row]));
    expect(byStep.get(step1.id)?.status).toBe('completed');
    expect(byStep.get(step2.id)?.status).toBe('active');
    expect(byStep.get(step3.id)?.status).toBe('pending');

    const approvals = await db
      .select()
      .from(schema.permitApprovals)
      .where(eq(schema.permitApprovals.permitId, permit.id));
    expect(approvals).toHaveLength(1);
    expect(approvals[0].workflowStepId).toBe(step1.id);
    expect(approvals[0].decision).toBe('approve');
  });

  dbTest('FR-PTW-026 default restart_from_stage_1 clears prior approvals', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { supervisor, orgAdmin } = users(tenantId);

    await db.insert(schema.workflowSteps).values([
      {
        tenantId,
        permitTypeId,
        stepSequence: 1,
        name: 'Stage 1 restart',
        approverRole: 'supervisor',
        createdBy: issuerId,
      },
      {
        tenantId,
        permitTypeId,
        stepSequence: 2,
        name: 'Stage 2 restart',
        approverRole: 'org-admin',
        createdBy: issuerId,
      },
    ]);

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);
    await approvalService.approve(permit.id, {}, supervisor);
    await approvalService.reject(
      permit.id,
      { comment: 'Restart me', reasonCode: 'other' },
      orgAdmin,
    );

    const [stage1] = await db
      .select()
      .from(schema.workflowSteps)
      .where(
        and(
          eq(schema.workflowSteps.tenantId, tenantId),
          eq(schema.workflowSteps.permitTypeId, permitTypeId),
          eq(schema.workflowSteps.stepSequence, 1),
        ),
      );

    const { assignments, resubmitMode } = await workflowEngine.initializeAtSubmit(
      permit.id,
      tenantId,
      permitTypeId,
      issuerId,
      undefined,
      { isResubmit: true, fromStatus: 'rejected' },
    );

    expect(resubmitMode).toBe('restart_from_stage_1');
    const active = assignments.filter((row) => row.status === 'active');
    expect(active).toHaveLength(1);
    expect(active[0].workflowStepId).toBe(stage1.id);
    expect(assignments.every((row) => row.status !== 'completed')).toBe(true);

    const approvals = await db
      .select()
      .from(schema.permitApprovals)
      .where(eq(schema.permitApprovals.permitId, permit.id));
    expect(approvals).toHaveLength(0);
  });

  dbTest('FR-ROL-001 HOD dual audit: initial review vs final closure remain distinct', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { orgAdmin } = users(tenantId);

    await db.insert(schema.workflowSteps).values({
      tenantId,
      permitTypeId,
      stepSequence: 1,
      name: 'HOD only',
      approverRole: 'org-admin',
      createdBy: issuerId,
    });

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);

    const approved = await approvalService.approve(permit.id, { comment: 'Initial OK' }, orgAdmin);
    expect(approved.permit.status).toBe('approved');

    const history = await approvalService.getHistory(permit.id, orgAdmin);
    expect(history.some((entry) => entry.action === HOD_INITIAL_REVIEW_ACTION)).toBe(true);

    await db
      .update(schema.permits)
      .set({ status: 'active', updatedBy: orgAdminId })
      .where(eq(schema.permits.id, permit.id));

    await db.insert(schema.permitVerifications).values({
      permitId: permit.id,
      verifiedBy: orgAdminId,
      verifiedAt: new Date(),
      createdBy: orgAdminId,
      checklist: {
        workCompleted: true,
        evidenceReviewed: true,
        areaSecured: true,
        hazardsRemoved: true,
      },
    });

    auditService.log.mockClear();
    await closureService.close(permit.id, { comment: 'Closed by HOD' }, orgAdmin);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: `permit.${HOD_FINAL_CLOSURE_ACTION}`,
        entityId: permit.id,
      }),
    );

    const initial = history.find((entry) => entry.action === HOD_INITIAL_REVIEW_ACTION);
    expect(initial?.action).not.toBe(HOD_FINAL_CLOSURE_ACTION);
  });

  dbTest('FR-ROL-003 platform-admin cannot approve', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();
    const { platformAdmin } = users(tenantId);

    await db.insert(schema.workflowSteps).values({
      tenantId,
      permitTypeId,
      stepSequence: 1,
      name: 'Supervisor gate',
      approverRole: 'supervisor',
      createdBy: issuerId,
    });

    const permit = await createPendingPermit(tenantId, permitTypeId);
    await workflowEngine.initializeAtSubmit(permit.id, tenantId, permitTypeId, issuerId);

    await expect(approvalService.approve(permit.id, {}, platformAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  dbTest('FR-PTW-030 blocks direct draft → active via lifecycle guard', async () => {
    const lifecycle = new PermitLifecycleService();
    expect(() => lifecycle.assertTransition('draft', 'active')).toThrow();
  });
});
