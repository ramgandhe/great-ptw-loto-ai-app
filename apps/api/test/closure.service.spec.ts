import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../src/common/interfaces/authenticated-user.interface';
import * as schema from '../src/database/schema';
import { AuditService } from '../src/modules/logging/audit.service';
import { PermitCacheService } from '../src/modules/permit/permit-cache.service';
import { PermitService } from '../src/modules/permit/permit.service';
import { StatusTransitionService } from '../src/modules/execution/status-transition.service';
import { ClosureLogService } from '../src/modules/closure/closure-log.service';
import { ClosureService } from '../src/modules/closure/closure.service';
import { VerificationService } from '../src/modules/closure/verification.service';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Closure services integration (PUS-146)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let verificationService: VerificationService;
  let closureService: ClosureService;

  const tenantId = randomUUID();
  const supervisorId = randomUUID();
  const locationId = randomUUID();

  const supervisorUser: AuthenticatedUser = {
    id: supervisorId,
    username: 'supervisor',
    tenantId,
    roles: ['supervisor'],
    email: 'supervisor@example.com',
  };

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

    const auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const permitCacheService = {
      invalidatePermit: jest.fn().mockResolvedValue(undefined),
    } as unknown as PermitCacheService;
    const closureLogService = { logEvent: jest.fn() } as unknown as ClosureLogService;

    verificationService = new VerificationService(
      db,
      permitService,
      auditService,
      permitCacheService,
      closureLogService,
    );

    closureService = new ClosureService(
      db,
      permitService,
      new StatusTransitionService(db),
      auditService,
      permitCacheService,
      closureLogService,
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

  async function createActivePermit() {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId: randomUUID(),
        title: 'Closure service permit',
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        submittedAt: new Date(),
        submittedBy: supervisorId,
        createdBy: supervisorId,
      })
      .returning();

    return permit;
  }

  const completeChecklist = {
    workCompleted: true,
    evidenceReviewed: true,
    areaSecured: true,
    hazardsRemoved: true,
  };

  dbTest('verifies active permit without changing status', async () => {
    const permit = await createActivePermit();

    const result = await verificationService.verify(
      permit.id,
      { checklist: completeChecklist, comment: 'All clear' },
      supervisorUser,
    );

    expect(result.permit.status).toBe('active');
    expect(result.verification.permitId).toBe(permit.id);
  });

  dbTest('rejects closure without verification', async () => {
    const permit = await createActivePermit();

    await expect(
      closureService.close(permit.id, { comment: 'Done' }, supervisorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('closes verified permit and archives it', async () => {
    const permit = await createActivePermit();

    await verificationService.verify(
      permit.id,
      { checklist: completeChecklist },
      supervisorUser,
    );

    const result = await closureService.close(
      permit.id,
      { comment: 'Work complete' },
      supervisorUser,
    );

    expect(result.permit.status).toBe('closed');
    expect(result.closure.permitId).toBe(permit.id);

    const [archive] = await db
      .select()
      .from(schema.permitArchive)
      .where(eq(schema.permitArchive.permitId, permit.id));

    expect(archive?.title).toBe('Closure service permit');
  });

  dbTest('rejects duplicate verification', async () => {
    const permit = await createActivePermit();

    await verificationService.verify(
      permit.id,
      { checklist: completeChecklist },
      supervisorUser,
    );

    await expect(
      verificationService.verify(permit.id, { checklist: completeChecklist }, supervisorUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
