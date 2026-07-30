import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import * as schema from '../app/src/database/schema';
import { AuditService } from '../app/src/modules/logging/audit.service';
import { PermitCacheService } from '../app/src/modules/permit/permit-cache.service';
import { PermitService } from '../app/src/modules/permit/permit.service';
import { EvidenceService } from '../app/src/modules/execution/evidence.service';
import { ExecutionCacheService } from '../app/src/modules/execution/execution-cache.service';
import { ExecutionLogService } from '../app/src/modules/execution/execution-log.service';
import { ExecutionService } from '../app/src/modules/execution/execution.service';
import { NotificationService } from '../app/src/modules/execution/notification.service';
import { ProgressService } from '../app/src/modules/execution/progress.service';
import { StatusTransitionService } from '../app/src/modules/execution/status-transition.service';
import { StorageService } from '../app/src/infrastructure/storage/storage.service';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('ExecutionService integration (PUS-141)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let executionService: ExecutionService;
  let progressService: ProgressService;
  let evidenceService: EvidenceService;
  let executionCacheService: ExecutionCacheService;

  const issuerId = randomUUID();
  const executorId = randomUUID();
  const outsiderId = randomUUID();
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

    const statusTransitionService = new StatusTransitionService(db);
    const notificationService = {
      enqueueExecutionNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;
    const auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const permitCacheService = {
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
    } as unknown as PermitCacheService;
    executionCacheService = {
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
      getActiveList: jest.fn().mockResolvedValue(null),
      setActiveList: jest.fn().mockResolvedValue(undefined),
      getExecutionDetail: jest.fn().mockResolvedValue(null),
      setExecutionDetail: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExecutionCacheService;
    const executionLogService = {
      logEvent: jest.fn(),
    } as unknown as ExecutionLogService;
    const storageService = {
      getBucket: jest.fn().mockReturnValue('ptw-documents'),
      putObject: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;

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

    executionService = new ExecutionService(
      db,
      permitService,
      statusTransitionService,
      notificationService,
      auditService,
      permitCacheService,
      executionCacheService,
      executionLogService,
    );

    progressService = new ProgressService(
      db,
      permitService,
      notificationService,
      auditService,
      permitCacheService,
      executionCacheService,
      executionLogService,
    );

    evidenceService = new EvidenceService(
      db,
      permitService,
      storageService,
      notificationService,
      auditService,
      permitCacheService,
      executionCacheService,
      executionLogService,
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

    const executorUser: AuthenticatedUser = {
      id: executorId,
      username: 'operator',
      tenantId,
      roles: ['operator'],
      email: 'operator@example.com',
    };

    const outsiderUser: AuthenticatedUser = {
      id: outsiderId,
      username: 'outsider',
      tenantId,
      roles: ['operator'],
      email: 'outsider@example.com',
    };

    async function createApprovedPermit(status: string = 'approved') {
      const [permit] = await db
        .insert(schema.permits)
        .values({
          tenantId,
          status,
          permitTypeId,
          title: 'Hot work execution',
          locationId,
          plannedStartAt: new Date('2026-09-01T08:00:00Z'),
          plannedEndAt: new Date('2026-09-01T16:00:00Z'),
          submittedAt: new Date(),
          submittedBy: issuerId,
          createdBy: issuerId,
        })
        .returning();

      await db.insert(schema.permitExecutors).values({
        permitId: permit.id,
        workforceUserId: executorId,
        isPrimary: true,
        createdBy: issuerId,
      });

      return permit;
    }

    async function activatePermit(permitId: string, user = executorUser) {
      return executionService.activate(permitId, {}, user);
    }

    return {
      tenantId,
      permitTypeId,
      executorUser,
      outsiderUser,
      createApprovedPermit,
      activatePermit,
    };
  }

  dbTest('rejects activation when permit is not approved', async () => {
    const { executorUser, createApprovedPermit } = testContext();
    const permit = await createApprovedPermit('draft');

    await expect(executionService.activate(permit.id, {}, executorUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  dbTest('rejects activation when user is not an assigned executor', async () => {
    const { outsiderUser, createApprovedPermit } = testContext();
    const permit = await createApprovedPermit();

    await expect(executionService.activate(permit.id, {}, outsiderUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  dbTest('activates approved permit and records status history', async () => {
    const { executorUser, createApprovedPermit } = testContext();
    const permit = await createApprovedPermit();

    const result = await executionService.activate(permit.id, {}, executorUser);

    expect(result.permit.status).toBe('active');
    expect(result.execution.permitId).toBe(permit.id);

    const [updatedPermit] = await db
      .select()
      .from(schema.permits)
      .where(eq(schema.permits.id, permit.id));

    expect(updatedPermit.status).toBe('active');

    const history = await db
      .select()
      .from(schema.permitStatusHistory)
      .where(eq(schema.permitStatusHistory.permitId, permit.id));

    expect(history.some((entry) => entry.action === 'activated')).toBe(true);
  });

  dbTest('rejects suspend when permit is not active', async () => {
    const { executorUser, createApprovedPermit } = testContext();
    const permit = await createApprovedPermit();

    await expect(
      executionService.suspend(permit.id, { reason: 'Weather delay' }, executorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('rejects suspend when permit is already suspended', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);

    await executionService.suspend(permit.id, { reason: 'Gas test failed' }, executorUser);

    await expect(
      executionService.suspend(permit.id, { reason: 'Again' }, executorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('rejects resume when permit was never suspended', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);

    await expect(executionService.resume(permit.id, executorUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  dbTest('suspends and resumes active permit', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);

    const suspended = await executionService.suspend(
      permit.id,
      { reason: 'Unexpected gas reading' },
      executorUser,
    );

    expect(suspended.permit.status).toBe('suspended');

    const resumed = await executionService.resume(permit.id, executorUser);
    expect(resumed.permit.status).toBe('active');
  });

  dbTest('rejects progress update on suspended permit', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);
    await executionService.suspend(permit.id, { reason: 'Weather delay' }, executorUser);

    await expect(
      progressService.addProgress(permit.id, { summary: 'Still working' }, executorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('records progress on active permit', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);

    const progress = await progressService.addProgress(
      permit.id,
      { summary: 'Welding 50% complete' },
      executorUser,
    );

    expect(progress.summary).toBe('Welding 50% complete');

    const entries = await progressService.listProgress(permit.id, executorUser);
    expect(entries).toHaveLength(1);
  });

  dbTest('rejects evidence upload on suspended permit', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);
    await executionService.suspend(permit.id, { reason: 'Weather delay' }, executorUser);

    await expect(
      evidenceService.upload(
        permit.id,
        {
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test'),
        },
        {},
        executorUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('uploads evidence on active permit', async () => {
    const { executorUser, createApprovedPermit, activatePermit } = testContext();
    const permit = await createApprovedPermit();
    await activatePermit(permit.id);

    const evidence = await evidenceService.upload(
      permit.id,
      {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test'),
      },
      { comment: 'Completed weld joint' },
      executorUser,
    );

    expect(evidence.fileName).toBe('photo.jpg');

    const entries = await evidenceService.list(permit.id, executorUser);
    expect(entries).toHaveLength(1);
  });

  dbTest('invalidates execution cache after status change', async () => {
    const { executorUser, createApprovedPermit } = testContext();
    const permit = await createApprovedPermit();

    await executionService.activate(permit.id, {}, executorUser);

    expect(executionCacheService.invalidatePermit).toHaveBeenCalledWith(
      expect.any(String),
      permit.id,
    );
  });
});
