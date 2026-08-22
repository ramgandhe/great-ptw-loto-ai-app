import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../app/src/app.module';
import { JwtAuthGuard } from '../app/src/common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';
import { StorageService } from '../app/src/infrastructure/storage/storage.service';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

/**
 * PUS-227 — Retroactive MS-04/MS-05 continuous journeys against real Postgres.
 * Complements suite regression; asserts end-to-end behaviour and cross-milestone gates.
 */
function authGuardAs(user: AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = user;
      return true;
    },
  };
}

async function createTestApp(user: AuthenticatedUser): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JwtAuthGuard)
    .useValue(authGuardAs(user))
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      registerHandler: jest.fn(),
    })
    .overrideProvider(StorageService)
    .useValue({
      getBucket: () => 'ptw-documents',
      putObject: jest.fn().mockResolvedValue(undefined),
      getPresignedPutUrl: jest.fn().mockResolvedValue('http://minio/put'),
      getPresignedGetUrl: jest.fn().mockResolvedValue('http://minio/get'),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: 'v1', prefix: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

describe('MS-04/MS-05 integration journeys (PUS-227)', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const actorId = randomUUID();
  const permitTypeId = randomUUID();

  const user: AuthenticatedUser = {
    id: actorId,
    username: 'hod',
    tenantId,
    roles: ['hod', 'job-issuer', 'safety-officer', 'org-admin'],
    email: 'supervisor@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
      return;
    }
    app = await createTestApp(user);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (canConnect) {
      await pool.end();
    }
  });

  const journey = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  async function seedSharedAssets() {
    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Integration bay',
        createdBy: actorId,
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Shared pump',
        workstationId: workstation.id,
        createdBy: actorId,
      })
      .returning();

    return { workstation, machinery };
  }

  async function seedOverlappingPermits(status: string = 'active') {
    const { workstation, machinery } = await seedSharedAssets();
    const shared = {
      tenantId,
      status,
      permitTypeId,
      workstationId: workstation.id,
      machineryId: machinery.id,
      plannedStartAt: new Date('2026-08-10T08:00:00Z'),
      plannedEndAt: new Date('2026-08-12T16:00:00Z'),
      createdBy: actorId,
    };

    const [permitA] = await db
      .insert(schema.permits)
      .values({
        ...shared,
        title: 'SIMOPS journey A',
        reference: `PTW-A-${randomUUID().slice(0, 6)}`,
      })
      .returning();

    const [permitB] = await db
      .insert(schema.permits)
      .values({
        ...shared,
        title: 'SIMOPS journey B',
        reference: `PTW-B-${randomUUID().slice(0, 6)}`,
        plannedStartAt: new Date('2026-08-11T08:00:00Z'),
        plannedEndAt: new Date('2026-08-13T16:00:00Z'),
      })
      .returning();

    return { permitA, permitB, machinery };
  }

  journey(
    'SIMOPS: overlapping permits → detect → assess → mitigate → approve',
    async () => {
      await seedOverlappingPermits('approved');

      const analyseRes = await request(app.getHttpServer())
        .post('/api/v1/simops/analyse')
        .send({})
        .expect(201);

      expect(analyseRes.body.data.detectedCount).toBeGreaterThanOrEqual(1);
      expect(analyseRes.body.data.createdCount).toBeGreaterThanOrEqual(1);

      const listRes = await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(200);
      const conflictId = listRes.body.data[0].id as string;

      await request(app.getHttpServer())
        .post(`/api/v1/simops/conflicts/${conflictId}/assess`)
        .send({
          assessedSeverity: 'high',
          riskSummary: 'Shared pump isolation overlap',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/simops/conflicts/${conflictId}/mitigation`)
        .send({
          planSummary: 'Stagger isolation windows',
          actions: [{ description: 'Reschedule permit B start +24h' }],
        })
        .expect(201);

      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/simops/conflicts/${conflictId}/approve`)
        .send({ comments: 'Mitigation accepted' })
        .expect(201);

      expect(approveRes.body.data.outcome).toBe('approved');
    },
  );

  journey(
    'SIMOPS: analyse scoped by permitId still detects peer overlaps (PUS-227 fix)',
    async () => {
      const { permitA } = await seedOverlappingPermits('active');

      const analyseRes = await request(app.getHttpServer())
        .post('/api/v1/simops/analyse')
        .send({ permitId: permitA.id })
        .expect(201);

      expect(analyseRes.body.data.analysedPermitCount).toBeGreaterThanOrEqual(2);
      expect(analyseRes.body.data.detectedCount).toBeGreaterThanOrEqual(1);
    },
  );

  journey(
    'SIMOPS reject suspends permits and blocks MDP continue (cross-milestone)',
    async () => {
      const { permitA, permitB } = await seedOverlappingPermits('active');

      await request(app.getHttpServer()).post('/api/v1/simops/analyse').send({}).expect(201);
      const listRes = await request(app.getHttpServer()).get('/api/v1/simops/conflicts').expect(200);
      const conflictId = listRes.body.data.find(
        (row: { status: string }) => row.status === 'open',
      )?.id as string;

      await request(app.getHttpServer())
        .post(`/api/v1/simops/conflicts/${conflictId}/reject`)
        .send({ reason: 'Unsafe simultaneous isolation' })
        .expect(201);

      const [a] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitA.id));
      const [b] = await db.select().from(schema.permits).where(eq(schema.permits.id, permitB.id));
      expect(a.status).toBe('suspended');
      expect(b.status).toBe('suspended');

      const suspensions = await db
        .select()
        .from(schema.permitSuspensions)
        .where(eq(schema.permitSuspensions.permitId, permitA.id));
      expect(suspensions.length).toBeGreaterThanOrEqual(1);
      expect(suspensions[0].reason).toMatch(/^SIMOPS conflict rejected:/);

      // Passed revalidation must not clear a SIMOPS hold.
      await request(app.getHttpServer())
        .post(`/api/v1/permits/${permitA.id}/revalidate`)
        .send({
          operationalDate: '2026-08-11',
          outcome: 'passed',
          findings: 'Controls in place',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/permits/${permitA.id}/continue`)
        .send({})
        .expect(409);
    },
  );

  journey(
    'Multi-Day: progress → revalidate pass → continue; fail → suspend; extension approve',
    async () => {
      const { machinery } = await seedSharedAssets();
      const [permit] = await db
        .insert(schema.permits)
        .values({
          tenantId,
          status: 'active',
          permitTypeId,
          title: 'Multi-day journey permit',
          reference: `PTW-MDP-${randomUUID().slice(0, 6)}`,
          machineryId: machinery.id,
          plannedStartAt: new Date('2026-08-20T08:00:00Z'),
          plannedEndAt: new Date('2026-08-25T16:00:00Z'),
          createdBy: actorId,
        })
        .returning();

      await request(app.getHttpServer())
        .post(`/api/v1/permits/${permit.id}/daily-progress`)
        .send({
          operationalDate: '2026-08-20',
          completedWork: 'Isolated feed line',
          pendingWork: 'Reconnect tomorrow',
          summary: 'Day 1 complete',
          submit: true,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/permits/${permit.id}/revalidate`)
        .send({
          operationalDate: '2026-08-20',
          outcome: 'passed',
          findings: 'Isolations verified',
        })
        .expect(201);

      const continueRes = await request(app.getHttpServer())
        .post(`/api/v1/permits/${permit.id}/continue`)
        .send({})
        .expect(201);
      expect(continueRes.body.data.status).toBe('active');

      await request(app.getHttpServer())
        .post(`/api/v1/permits/${permit.id}/revalidate`)
        .send({
          operationalDate: '2026-08-21',
          outcome: 'failed',
          findings: 'Barrier degraded',
        })
        .expect(201);

      const [suspended] = await db
        .select()
        .from(schema.permits)
        .where(eq(schema.permits.id, permit.id));
      expect(suspended.status).toBe('suspended');

      // New active permit for extension path (failed path left prior permit suspended).
      const [extPermit] = await db
        .insert(schema.permits)
        .values({
          tenantId,
          status: 'active',
          permitTypeId,
          title: 'Extension journey permit',
          reference: `PTW-EXT-${randomUUID().slice(0, 6)}`,
          plannedStartAt: new Date('2026-08-20T08:00:00Z'),
          plannedEndAt: new Date('2026-08-22T16:00:00Z'),
          createdBy: actorId,
        })
        .returning();

      const extRes = await request(app.getHttpServer())
        .post(`/api/v1/permits/${extPermit.id}/extensions`)
        .send({
          requestedEndAt: '2026-08-28T16:00:00.000Z',
          justification: 'Weather delay',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/extensions/${extRes.body.data.id}/approve`)
        .send({ comments: 'Approved' })
        .expect(201);

      const [extended] = await db
        .select()
        .from(schema.permits)
        .where(eq(schema.permits.id, extPermit.id));
      expect(new Date(extended.plannedEndAt!).toISOString()).toBe('2026-08-28T16:00:00.000Z');
    },
  );

  journey(
    'Cross-check: SIMOPS detection uses MS-02 permit fields; no LOTOTO plan join',
    async () => {
      const { permitA, machinery } = await seedOverlappingPermits('active');

      // LOTOTO plan on same machinery must not be required for detection.
      await db.insert(schema.lototoPlans).values({
        tenantId,
        permitId: permitA.id,
        machineryId: machinery.id,
        title: 'Isolation plan A',
        status: 'draft',
        createdBy: actorId,
      });

      const analyseRes = await request(app.getHttpServer())
        .post('/api/v1/simops/analyse')
        .send({})
        .expect(201);

      expect(analyseRes.body.data.detectedCount).toBeGreaterThanOrEqual(1);
      // Documented gap: detection does not read lototo_plans / isolation_points tables.
    },
  );
});
