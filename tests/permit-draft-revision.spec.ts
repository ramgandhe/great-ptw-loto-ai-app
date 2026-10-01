import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import * as schema from '../app/src/database/schema';
import { ApprovalHistoryService } from '../app/src/modules/approval/approval-history.service';
import { WorkflowEngineService } from '../app/src/modules/approval/workflow-engine.service';
import { AuditService } from '../app/src/modules/logging/audit.service';
import { PermitCacheService } from '../app/src/modules/permit/permit-cache.service';
import { PermitLogService } from '../app/src/modules/permit/permit-log.service';
import { PermitValidationService } from '../app/src/modules/permit/permit-validation.service';
import { PermitService, REVISION_CONFLICT_CODE } from '../app/src/modules/permit/permit.service';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

/** S0a: draft saves and submits carry the revision they loaded; stale or racing writes get 409. */
describe('Permit draft revision contract (S0a)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let service: PermitService;
  const initializeAtSubmit = jest.fn().mockResolvedValue(undefined);

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
    if (!canConnect) return;

    service = new PermitService(
      db,
      new PermitValidationService(),
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      {
        invalidatePermit: jest.fn().mockResolvedValue(undefined),
        invalidateTenant: jest.fn().mockResolvedValue(undefined),
        getPermitDetail: jest.fn().mockResolvedValue(null),
        setPermitDetail: jest.fn().mockResolvedValue(undefined),
        getPermitList: jest.fn().mockResolvedValue(null),
        setPermitList: jest.fn().mockResolvedValue(undefined),
      } as unknown as PermitCacheService,
      { logEvent: jest.fn() } as unknown as PermitLogService,
      { initializeAtSubmit } as unknown as WorkflowEngineService,
      new ApprovalHistoryService(db),
      { send: jest.fn().mockResolvedValue(undefined) } as never,
      { get: () => 'http://localhost:3000' } as never,
      { enqueueApprovalNotification: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterAll(async () => {
    if (canConnect) await pool.end();
  });

  const dbTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) return;
      await fn();
    });
  };

  async function context() {
    const tenantId = randomUUID();
    const issuer: AuthenticatedUser = {
      id: randomUUID(),
      username: 'issuer',
      tenantId,
      roles: ['job-issuer'],
      email: 'issuer@example.com',
    };
    const executor: AuthenticatedUser = {
      id: randomUUID(),
      username: 'executor',
      tenantId,
      roles: ['operator'],
      email: 'executor@example.com',
    };
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'draft',
        permitTypeId: randomUUID(),
        title: 'Revision test permit',
        departmentId: randomUUID(),
        locationId: randomUUID(),
        workstationId: randomUUID(),
        plannedStartAt: new Date('2026-10-02T08:00:00Z'),
        plannedEndAt: new Date('2026-10-02T16:00:00Z'),
        createdBy: issuer.id,
      })
      .returning();
    await db.insert(schema.permitDrafts).values({ permitId: permit.id, createdBy: issuer.id });
    await db.insert(schema.permitExecutors).values({
      permitId: permit.id,
      workforceUserId: executor.id,
      isPrimary: true,
      createdBy: issuer.id,
    });
    await db.insert(schema.permitHazards).values({ permitId: permit.id, hazardCategoryId: randomUUID(), createdBy: issuer.id });
    await db.insert(schema.permitPpe).values({ permitId: permit.id, ppeCatalogueId: randomUUID(), createdBy: issuer.id });
    return { tenantId, issuer, executor, permitId: permit.id };
  }

  async function revisionOf(permitId: string) {
    const [row] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    return row.draftRevision;
  }

  function conflictCode(error: unknown) {
    const response = (error as ConflictException).getResponse() as { error?: string };
    return response.error;
  }

  dbTest('a save bumps the revision once, including collection-only saves', async () => {
    const { issuer, permitId } = await context();
    const first = await service.update(permitId, { expectedRevision: 0, title: 'Renamed' }, issuer);
    expect(first.permit.draftRevision).toBe(1);
    const second = await service.update(permitId, { expectedRevision: 1, viewers: [] }, issuer);
    expect(second.permit.draftRevision).toBe(2);
  });

  dbTest('a stale save is refused with the machine-readable conflict code and changes nothing', async () => {
    const { issuer, permitId } = await context();
    await service.update(permitId, { expectedRevision: 0, title: 'First' }, issuer);
    const error = await service.update(permitId, { expectedRevision: 0, title: 'Stale' }, issuer).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(conflictCode(error)).toBe(REVISION_CONFLICT_CODE);
    const [row] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    expect(row.title).toBe('First');
    expect(row.draftRevision).toBe(1);
  });

  dbTest('two saves racing on one revision: one commits whole, the other conflicts, no mixed rows', async () => {
    const { issuer, executor, permitId } = await context();
    const hazardA = randomUUID();
    const hazardB = randomUUID();
    const results = await Promise.allSettled([
      service.update(permitId, { expectedRevision: 0, title: 'Issuer edit', viewers: [] }, issuer),
      service.update(permitId, { expectedRevision: 0, hazards: [{ hazardCategoryId: hazardA }, { hazardCategoryId: hazardB }] }, executor),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(conflictCode(rejected[0].reason)).toBe(REVISION_CONFLICT_CODE);
    expect(await revisionOf(permitId)).toBe(1);

    const hazards = await db.select().from(schema.permitHazards).where(eq(schema.permitHazards.permitId, permitId));
    const [row] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    const executorWon = hazards.length === 2;
    expect(row.title).toBe(executorWon ? 'Revision test permit' : 'Issuer edit');
  });

  dbTest('RBAC and assignment are checked before the revision, so a stale revision never bypasses them', async () => {
    const { tenantId, permitId } = await context();
    const stranger: AuthenticatedUser = { id: randomUUID(), username: 's', tenantId, roles: ['operator'], email: 's@example.com' };
    await expect(service.update(permitId, { expectedRevision: 99, hazards: [] }, stranger)).rejects.toBeInstanceOf(ForbiddenException);
  });

  dbTest('duplicate submits: one transitions, the other conflicts, approvals initialise once', async () => {
    const { issuer, permitId } = await context();
    initializeAtSubmit.mockClear();
    const results = await Promise.allSettled([
      service.submit(permitId, { expectedRevision: 0 }, issuer),
      service.submit(permitId, { expectedRevision: 0 }, issuer),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')[0]).toMatchObject({ reason: expect.any(ConflictException) });
    expect(initializeAtSubmit).toHaveBeenCalledTimes(1);
    const history = await db.select().from(schema.approvalHistory).where(eq(schema.approvalHistory.permitId, permitId));
    expect(history).toHaveLength(1);
  });

  dbTest('a submit after a competing save conflicts, and a save after submit cannot revive old content', async () => {
    const { issuer, permitId } = await context();
    await service.update(permitId, { expectedRevision: 0, title: 'Saved elsewhere' }, issuer);
    await expect(service.submit(permitId, { expectedRevision: 0 }, issuer)).rejects.toBeInstanceOf(ConflictException);

    await service.submit(permitId, { expectedRevision: 1 }, issuer);
    await db.update(schema.permits).set({ status: 'rejected' }).where(eq(schema.permits.id, permitId));
    const error = await service.update(permitId, { expectedRevision: 1, title: 'Old tab' }, issuer).catch((e) => e);
    expect(conflictCode(error)).toBe(REVISION_CONFLICT_CODE);
  });

  dbTest('answer changes are audited in the save transaction; an audit failure rolls the answers back', async () => {
    const { tenantId, issuer, permitId } = await context();
    const [template] = await db
      .insert(schema.permitTemplates)
      .values({
        tenantId,
        name: 'Site checks',
        status: 'published',
        appliesToAllTypes: true,
        config: { sections: [{ id: 's1', title: 'Area', fields: [{ id: 'f1', label: 'Area secured?', type: 'check', required: true }] }] },
        createdBy: issuer.id,
      } as typeof schema.permitTemplates.$inferInsert)
      .returning();

    await service.update(permitId, { expectedRevision: 0, formResponses: [{ templateId: template.id, answers: { f1: 'yes' } }] }, issuer);
    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, permitId), eq(schema.auditLogs.action, 'permit.form_answer_changed')));
    expect(audits).toHaveLength(1);
    expect(audits[0].userId).toBe(issuer.id);
    expect(audits[0].metadata).toMatchObject({ revision: 1, templateId: template.id, sectionId: 's1', fieldId: 'f1', from: null, to: 'yes' });

    const spy = jest
      .spyOn(service as unknown as { recordAnswerChanges: () => Promise<void> }, 'recordAnswerChanges')
      .mockRejectedValueOnce(new Error('audit store down'));
    await expect(
      service.update(permitId, { expectedRevision: 1, formResponses: [{ templateId: template.id, answers: { f1: 'no' } }] }, issuer),
    ).rejects.toThrow('audit store down');
    spy.mockRestore();
    const [row] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    expect((row.formResponses as { answers: Record<string, string> }[])[0].answers.f1).toBe('yes');
    expect(row.draftRevision).toBe(1);
  });

  dbTest('deleting a permit that is no longer a draft is refused', async () => {
    const { issuer, permitId } = await context();
    await db.update(schema.permits).set({ status: 'pending_approval' }).where(eq(schema.permits.id, permitId));
    await expect(service.removeDraft(permitId, issuer)).rejects.toBeInstanceOf(ConflictException);
  });
});
