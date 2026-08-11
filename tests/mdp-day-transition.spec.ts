import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import * as schema from '../app/src/database/schema';
import { PermitService } from '../app/src/modules/permit/permit.service';
import { PermitCacheService } from '../app/src/modules/permit/permit-cache.service';
import { PermitLogService } from '../app/src/modules/permit/permit-log.service';
import { PermitValidationService } from '../app/src/modules/permit/permit-validation.service';
import { AuditService } from '../app/src/modules/logging/audit.service';
import { ApprovalHistoryService } from '../app/src/modules/approval/approval-history.service';
import { WorkflowEngineService } from '../app/src/modules/approval/workflow-engine.service';
import { RevalidationJobsService } from '../app/src/modules/revalidation/revalidation-jobs.service';
import { RevalidationLogService } from '../app/src/modules/revalidation/revalidation-log.service';
import { RevalidationNotificationService } from '../app/src/modules/revalidation/revalidation-notification.service';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('MDP day-transition and renewal (SP-09.03 / FR-MDP-009)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let permitService: PermitService;
  let revalidationJobs: RevalidationJobsService;

  const issuerId = randomUUID();
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

    const workflowEngine = new WorkflowEngineService(db);
    const approvalHistoryService = new ApprovalHistoryService(db);
    const auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const permitCacheService = {
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
      invalidateTenant: jest.fn().mockResolvedValue(undefined),
      getPermitDetail: jest.fn().mockResolvedValue(null),
      setPermitDetail: jest.fn().mockResolvedValue(undefined),
      getPermitList: jest.fn().mockResolvedValue(null),
      setPermitList: jest.fn().mockResolvedValue(undefined),
    } as unknown as PermitCacheService;
    const permitLogService = { logEvent: jest.fn() } as unknown as PermitLogService;

    permitService = new PermitService(
      db,
      new PermitValidationService(),
      auditService,
      permitCacheService,
      permitLogService,
      workflowEngine,
      approvalHistoryService,
    );

    revalidationJobs = new RevalidationJobsService(
      db,
      { getQueue: jest.fn() } as never,
      { get: jest.fn() } as never,
      { logEvent: jest.fn() } as unknown as RevalidationLogService,
      { enqueueValidityNotification: jest.fn().mockResolvedValue(undefined) } as unknown as RevalidationNotificationService,
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

  function context() {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const issuerUser: AuthenticatedUser = {
      id: issuerId,
      username: 'issuer',
      tenantId,
      roles: ['job-issuer'],
      email: 'issuer@example.com',
    };

    async function seedOrg(timezone = 'UTC') {
      await db.insert(schema.organisations).values({
        tenantId,
        name: 'Test Org',
        timezone,
        createdBy: issuerId,
      });
    }

    async function createActivePermit(plannedEndAt: Date) {
      const [permit] = await db
        .insert(schema.permits)
        .values({
          tenantId,
          status: 'active',
          permitTypeId,
          title: 'Multi-day permit',
          locationId,
          plannedStartAt: new Date('2026-08-01T08:00:00Z'),
          plannedEndAt,
          submittedAt: new Date(),
          submittedBy: issuerId,
          createdBy: issuerId,
        })
        .returning();

      await db.insert(schema.permitDrafts).values({
        permitId: permit.id,
        currentStep: 2,
        formSnapshot: { section: 'hazards' },
        createdBy: issuerId,
      });

      await db.insert(schema.permitHazards).values({
        permitId: permit.id,
        hazardCategoryId: randomUUID(),
        description: 'Hot surface',
        createdBy: issuerId,
      });

      return permit;
    }

    return { tenantId, permitTypeId, issuerUser, seedOrg, createActivePermit };
  }

  dbTest('expires overdue permits and records validity_expired history', async () => {
    const { seedOrg, createActivePermit } = context();
    await seedOrg();
    const permit = await createActivePermit(new Date(Date.now() - 60_000));

    await revalidationJobs.runDayTransitionValidityChecks();

    const [updated] = await db
      .select()
      .from(schema.permits)
      .where(eq(schema.permits.id, permit.id));

    expect(updated.status).toBe('expired');

    const history = await db
      .select()
      .from(schema.revalidationHistory)
      .where(eq(schema.revalidationHistory.permitId, permit.id));

    expect(history.some((row) => row.eventType === 'validity_expired')).toBe(true);
  });

  dbTest('day-transition expiry is idempotent on repeated runs', async () => {
    const { seedOrg, createActivePermit } = context();
    await seedOrg();
    const permit = await createActivePermit(new Date(Date.now() - 60_000));

    await revalidationJobs.runDayTransitionValidityChecks();
    await revalidationJobs.runDayTransitionValidityChecks();

    const history = await db
      .select()
      .from(schema.revalidationHistory)
      .where(eq(schema.revalidationHistory.permitId, permit.id));

    const expiredEvents = history.filter((row) => row.eventType === 'validity_expired');
    expect(expiredEvents).toHaveLength(1);
  });

  dbTest('creates renewal draft from expired permit with copied relations', async () => {
    const { issuerUser, seedOrg, createActivePermit } = context();
    await seedOrg();
    const source = await createActivePermit(new Date(Date.now() - 60_000));

    await db
      .update(schema.permits)
      .set({ status: 'expired' })
      .where(eq(schema.permits.id, source.id));

    const renewal = await permitService.renewFromExpired(
      source.id,
      {
        plannedStartAt: '2026-08-10T08:00:00.000Z',
        plannedEndAt: '2026-08-12T16:00:00.000Z',
      },
      issuerUser,
    );

    expect(renewal.permit.status).toBe('draft');
    expect(renewal.permit.renewedFromPermitId).toBe(source.id);
    expect(renewal.permit.plannedEndAt?.toISOString()).toBe('2026-08-12T16:00:00.000Z');
    expect(renewal.hazards).toHaveLength(1);
    expect(renewal.draft?.formSnapshot).toEqual({ section: 'hazards' });

    const history = await db
      .select()
      .from(schema.revalidationHistory)
      .where(eq(schema.revalidationHistory.permitId, source.id));

    expect(history.some((row) => row.eventType === 'renewal_initiated')).toBe(true);
  });

  dbTest('rejects renewal when permit is not expired', async () => {
    const { issuerUser, seedOrg, createActivePermit } = context();
    await seedOrg();
    const permit = await createActivePermit(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    await expect(permitService.renewFromExpired(permit.id, {}, issuerUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  dbTest('rejects renewal from non-issuer without job-issuer role', async () => {
    const { tenantId, seedOrg, createActivePermit } = context();
    await seedOrg();
    const source = await createActivePermit(new Date(Date.now() - 60_000));

    await db
      .update(schema.permits)
      .set({ status: 'expired' })
      .where(eq(schema.permits.id, source.id));

    const outsider: AuthenticatedUser = {
      id: randomUUID(),
      username: 'viewer',
      tenantId,
      roles: ['viewer'],
      email: 'viewer@example.com',
    };

    await expect(permitService.renewFromExpired(source.id, {}, outsider)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
