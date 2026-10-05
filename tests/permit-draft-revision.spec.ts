import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
import { assertStageAnswered, PermitService, REVISION_CONFLICT_CODE } from '../app/src/modules/permit/permit.service';
import { AttachmentService } from '../app/src/modules/permit/attachment.service';
import { StatusTransitionService } from '../app/src/modules/execution/status-transition.service';
import type { StorageService } from '../app/src/infrastructure/storage/storage.service';
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
    } catch {
      canConnect = false;
    }
    // A failed migration fails the suite; it must never look like "no database".
    if (canConnect) await migrate(db, { migrationsFolder });
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

  dbTest('stage answers: status and revision checked under lock, audited, other answers kept, missing listed', async () => {
    const { tenantId, issuer, permitId } = await context();
    const hod: AuthenticatedUser = { id: randomUUID(), username: 'hod', tenantId, roles: ['hod'], email: 'hod@example.com' };
    const [template] = await db
      .insert(schema.permitTemplates)
      .values({
        tenantId,
        name: 'Safe work permit',
        status: 'published',
        appliesToAllTypes: true,
        config: {
          sections: [
            {
              id: 'a',
              title: 'Authorisation',
              fields: [
                { id: 'issuer', label: 'Job issued by', type: 'signature', required: true },
                { id: 'hod', label: 'HOD of job issuer', type: 'signature', required: true, requiredAt: 'approval' },
              ],
            },
          ],
        },
        createdBy: issuer.id,
      } as typeof schema.permitTemplates.$inferInsert)
      .returning();
    await service.update(permitId, { expectedRevision: 0, formResponses: [{ templateId: template.id, answers: { issuer: { name: 'I' } } }] }, issuer);
    await db.update(schema.permits).set({ status: 'pending_approval' }).where(eq(schema.permits.id, permitId));
    const save = (input?: { expectedRevision: number; formResponses: { templateId: string; answers: Record<string, unknown> }[] }, status = 'pending_approval') =>
      db.transaction((tx) => service.saveStageAnswers(tx, { permitId, tenantId, user: hod, stage: 'approval', status, input }));

    // Nothing sent: no revision needed, nothing written, the missing HOD signature is reported.
    const missing = await save();
    expect(missing).toEqual(['Safe work permit: 1 required answer missing (HOD of job issuer)']);
    expect(() => assertStageAnswered(missing, 'approving')).toThrow(BadRequestException);
    await expect(save(undefined, 'pending_closure')).rejects.toBeInstanceOf(ConflictException);

    const answer = { templateId: template.id, answers: { hod: { name: 'H' }, issuer: { name: 'Overwritten?' } } };
    expect(conflictCode(await save({ expectedRevision: 0, formResponses: [answer] }).catch((e) => e))).toBe(REVISION_CONFLICT_CODE);
    expect(await save({ expectedRevision: 1, formResponses: [answer] })).toEqual([]);

    const [row] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    expect(row.draftRevision).toBe(2);
    expect((row.formResponses as { answers: Record<string, { name: string }> }[])[0].answers).toMatchObject({ issuer: { name: 'I' }, hod: { name: 'hod' } });
    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, permitId), eq(schema.auditLogs.action, 'permit.form_answer_changed')));
    expect(audits.find((a) => (a.metadata as { fieldId: string }).fieldId === 'hod')).toMatchObject({ userId: hod.id, metadata: { revision: 2 } });
  });

  dbTest('attestations: drafts cannot pre-sign, archiving cannot drop a requirement, a new round signs again', async () => {
    const { tenantId, issuer, permitId } = await context();
    const hod: AuthenticatedUser = { id: randomUUID(), username: 'hod', firstName: 'Hema', lastName: 'Rao', tenantId, roles: ['hod'], email: 'hod@example.com' };
    const [template] = await db
      .insert(schema.permitTemplates)
      .values({
        tenantId,
        name: 'Safe work permit',
        status: 'published',
        appliesToAllTypes: true,
        config: {
          sections: [
            {
              id: 'a',
              title: 'Authorisation',
              fields: [
                { id: 'issuer', label: 'Job issued by', type: 'signature', required: true },
                { id: 'hod', label: 'HOD of job issuer', type: 'signature', required: true, requiredAt: 'approval' },
                { id: 'done', label: 'Job completion accepted by', type: 'signature', required: true, requiredAt: 'closure' },
              ],
            },
          ],
        },
        createdBy: issuer.id,
      } as typeof schema.permitTemplates.$inferInsert)
      .returning();
    const answersOf = async () =>
      ((await db.select().from(schema.permits).where(eq(schema.permits.id, permitId)))[0].formResponses as { answers: Record<string, { name: string }> }[])[0]
        .answers;

    // The issuer tries to fill the HOD's and the closer's signatures while drafting: not stored.
    await service.update(
      permitId,
      { expectedRevision: 0, formResponses: [{ templateId: template.id, answers: { issuer: { name: 'I' }, hod: { name: 'Hema Rao' }, done: { name: 'C' } } }] },
      issuer,
    );
    expect(await answersOf()).toEqual({ issuer: { name: 'I' } });

    // Archive the template after it was captured: the approval signature is still required.
    await db.update(schema.permitTemplates).set({ status: 'archived' }).where(eq(schema.permitTemplates.id, template.id));
    await db.update(schema.permits).set({ status: 'pending_approval' }).where(eq(schema.permits.id, permitId));
    const missing = await db.transaction((tx) => service.saveStageAnswers(tx, { permitId, tenantId, user: hod, stage: 'approval', status: 'pending_approval' }));
    expect(missing).toEqual(['Safe work permit: 1 required answer missing (HOD of job issuer)']);

    // The HOD signs; a name typed for someone else is replaced by the HOD's own.
    await db.transaction((tx) =>
      service.saveStageAnswers(tx, {
        permitId,
        tenantId,
        user: hod,
        stage: 'approval',
        status: 'pending_approval',
        input: { expectedRevision: 1, formResponses: [{ templateId: template.id, answers: { hod: { name: 'Someone else' } } }] },
      }),
    );
    expect((await answersOf()).hod.name).toBe('Hema Rao');

    // Sent back and resubmitted: the earlier round's approval signature does not carry over.
    await db.update(schema.permits).set({ status: 'deferred' }).where(eq(schema.permits.id, permitId));
    const [deferred] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    await service.submit(permitId, { expectedRevision: deferred.draftRevision }, issuer);
    expect(await answersOf()).toEqual({ issuer: { name: 'I' } });
    const cleared = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entityId, permitId), eq(schema.auditLogs.action, 'permit.form_answer_changed')));
    expect(cleared.some((a) => (a.metadata as { fieldId: string; reason?: string }).fieldId === 'hod' && /approval round/.test((a.metadata as { reason?: string }).reason ?? ''))).toBe(true);
  });

  dbTest('issuer signs at verification, HOD signs at closure: the issuer\'s signature stays the issuer\'s', async () => {
    const { tenantId, permitId } = await context();
    const issuer: AuthenticatedUser = { id: randomUUID(), username: 'issuer', firstName: 'Ishaan', lastName: 'Iyer', tenantId, roles: ['job-issuer'], email: 'i@example.com' };
    const hod: AuthenticatedUser = { id: randomUUID(), username: 'hod', firstName: 'Hema', lastName: 'Rao', tenantId, roles: ['hod'], email: 'h@example.com' };
    const templateId = randomUUID();
    const config = {
      kind: 'permit',
      sections: [
        {
          id: 'c',
          title: 'Completion',
          fields: [
            { id: 'done', label: 'Job completion accepted by', type: 'signature', required: true, requiredAt: 'closure' },
            { id: 'watch', label: 'Fire watch: three hours after completion', type: 'signature', required: true, requiredAt: 'closure' },
          ],
        },
      ],
    };
    await db
      .update(schema.permits)
      .set({ status: 'execution_completed', formResponses: [{ templateId, name: 'Hot work', config, answers: {} }] })
      .where(eq(schema.permits.id, permitId));
    const sign = (user: AuthenticatedUser, status: string, expectedRevision: number, answers: Record<string, unknown>) =>
      db.transaction((tx) =>
        service.saveStageAnswers(tx, { permitId, tenantId, user, stage: 'closure', status, input: { expectedRevision, formResponses: [{ templateId, answers }] } }),
      );
    const answersOf = async () =>
      ((await db.select().from(schema.permits).where(eq(schema.permits.id, permitId)))[0].formResponses as { answers: Record<string, unknown> }[])[0].answers;

    expect(await sign(issuer, 'execution_completed', 0, { done: { name: 'x', date: '2026-10-02', time: '15:00' } })).toEqual([
      'Hot work: 1 required answer missing (Fire watch: three hours after completion)',
    ]);
    const issuerSignature = (await answersOf()).done;
    expect(issuerSignature).toEqual({ name: 'Ishaan Iyer', date: '2026-10-02', time: '15:00' });

    await db.update(schema.permits).set({ status: 'pending_closure' }).where(eq(schema.permits.id, permitId));
    // The HOD's screen sends the issuer's signature back unchanged with the fire watch it signs.
    expect(await sign(hod, 'pending_closure', 1, { done: issuerSignature, watch: { name: 'x', date: '2026-10-02', time: '18:00' } })).toEqual([]);
    expect(await answersOf()).toEqual({ done: issuerSignature, watch: { name: 'Hema Rao', date: '2026-10-02', time: '18:00' } });
  });

  dbTest('a new closure round (work completed again) clears closure signatures from the earlier round', async () => {
    const { tenantId, issuer, permitId } = await context();
    const config = { sections: [{ id: 'c', title: 'Completion', fields: [{ id: 'done', label: 'Job completion accepted by', type: 'signature', required: true, requiredAt: 'closure' }] }] };
    await db
      .update(schema.permits)
      .set({ status: 'active', formResponses: [{ templateId: randomUUID(), name: 'Safe work permit', config, answers: { done: { name: 'Earlier closer' } } }] })
      .where(eq(schema.permits.id, permitId));
    await new StatusTransitionService(db).transition({ permitId, tenantId, action: 'execution_completed', fromStatus: 'active', toStatus: 'execution_completed', actorId: issuer.id });
    const [row] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitId));
    expect((row.formResponses as { answers: Record<string, unknown> }[])[0].answers).toEqual({});
  });

  dbTest('attachments: stored file removed when the permit stopped being editable, and after metadata removal', async () => {
    const { issuer, permitId } = await context();
    const stored = new Set<string>();
    const storage = {
      getBucket: () => 'test',
      putObject: jest.fn(async (key: string) => void stored.add(key)),
      deleteObject: jest.fn(async (key: string) => void stored.delete(key)),
    } as unknown as StorageService;
    const attachments = new AttachmentService(
      db,
      storage,
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { invalidatePermit: jest.fn().mockResolvedValue(undefined) } as unknown as PermitCacheService,
      { logEvent: jest.fn() } as unknown as PermitLogService,
    );
    const file = { originalname: 'photo.png', mimetype: 'image/png', size: 3, buffer: Buffer.from('abc') } as never;

    const attachment = await attachments.upload(permitId, file, issuer);
    expect(stored.size).toBe(1);
    await attachments.remove(permitId, attachment.id, issuer);
    expect(stored.size).toBe(0);
    expect(await db.select().from(schema.permitAttachments).where(eq(schema.permitAttachments.permitId, permitId))).toHaveLength(0);

    // A submit wins between the file being stored and its metadata: nothing is attached, nothing is left stored.
    const putObject = storage.putObject as jest.Mock;
    putObject.mockImplementationOnce(async (key: string) => {
      stored.add(key);
      await db.update(schema.permits).set({ status: 'pending_approval' }).where(eq(schema.permits.id, permitId));
    });
    await expect(attachments.upload(permitId, file, issuer)).rejects.toBeInstanceOf(ConflictException);
    expect(stored.size).toBe(0);
    expect(await db.select().from(schema.permitAttachments).where(eq(schema.permitAttachments.permitId, permitId))).toHaveLength(0);
  });

  dbTest('deleting a draft removes its attachments\' stored files after the delete commits', async () => {
    const { issuer, permitId } = await context();
    const deleteObject = jest.fn().mockResolvedValue(undefined);
    const withStorage = Object.assign(Object.create(Object.getPrototypeOf(service)), service, { storageService: { deleteObject } });
    await db.insert(schema.permitAttachments).values({
      permitId,
      fileName: 'a.png',
      contentType: 'image/png',
      fileSize: 1,
      storageBucket: 'test',
      storageKey: 'k/a.png',
      uploadedBy: issuer.id,
      createdBy: issuer.id,
    } as typeof schema.permitAttachments.$inferInsert);
    const admin = { ...issuer, roles: ['tenant-admin'] };
    await (withStorage as PermitService).removeDraft(permitId, admin);
    expect(deleteObject).toHaveBeenCalledWith('k/a.png');
  });
});
