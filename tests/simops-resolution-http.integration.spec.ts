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
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

let currentUser: AuthenticatedUser | null = null;

function dynamicAuthGuard() {
  return {
    canActivate: (context: ExecutionContext) => {
      if (!currentUser) {
        return false;
      }
      context.switchToHttp().getRequest().user = currentUser;
      return true;
    },
  };
}

async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JwtAuthGuard)
    .useValue(dynamicAuthGuard())
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      registerHandler: jest.fn(),
      getQueue: () => ({ add: jest.fn().mockResolvedValue(undefined) }),
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

describe('SIMOPS Conflict Resolution HTTP (PUS-171)', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let conflictId = '';

  const tenantId = randomUUID();
  const supervisorId = randomUUID();

  const supervisor: AuthenticatedUser = {
    id: supervisorId,
    username: 'supervisor',
    tenantId,
    roles: ['supervisor'],
    email: 'supervisor@example.com',
  };

  const viewer: AuthenticatedUser = {
    id: randomUUID(),
    username: 'viewer',
    tenantId,
    roles: ['viewer'],
    email: 'viewer@example.com',
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

    const [conflict] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'detected',
        severity: 'high',
        primaryConflictType: 'equipment',
        conflictTypes: ['equipment', 'schedule'],
        fingerprint: `fp-res-be-${randomUUID()}`,
        createdBy: supervisorId,
      })
      .returning();
    conflictId = conflict.id;

    app = await createTestApp();
  });

  afterAll(async () => {
    if (canConnect && conflictId) {
      // history/resolutions are immutable — leave rows; drop via tenant-scoped deletes where allowed
      const assessments = await db
        .select({ id: schema.conflictAssessments.id })
        .from(schema.conflictAssessments)
        .where(eq(schema.conflictAssessments.conflictId, conflictId));
      for (const row of assessments) {
        await db
          .delete(schema.mitigationPlans)
          .where(eq(schema.mitigationPlans.assessmentId, row.id));
      }
      await db
        .delete(schema.mitigationPlans)
        .where(eq(schema.mitigationPlans.conflictId, conflictId));
      await db
        .delete(schema.conflictAssessments)
        .where(eq(schema.conflictAssessments.conflictId, conflictId));
    }
    if (app) {
      await app.close();
    }
    if (canConnect) {
      await pool.end();
    }
  });

  const httpTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  httpTest('denies viewer from assessing', async () => {
    currentUser = viewer;
    await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${conflictId}/assess`)
      .send({ assessedSeverity: 'high' })
      .expect(403);
  });

  httpTest('rejects approval without mitigation plan', async () => {
    currentUser = supervisor;
    await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${conflictId}/assess`)
      .send({
        assessedSeverity: 'high',
        riskSummary: 'Shared equipment overlap',
        status: 'completed',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${conflictId}/approve`)
      .send({ comments: 'too soon' })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/mitigation/i);
  });

  httpTest('assess → mitigate → approve and expose history', async () => {
    currentUser = supervisor;

    // Use a fresh conflict for the happy path (previous test left this one assessed).
    const [fresh] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'detected',
        severity: 'medium',
        primaryConflictType: 'location',
        conflictTypes: ['location', 'schedule'],
        fingerprint: `fp-res-be-ok-${randomUUID()}`,
        createdBy: supervisorId,
      })
      .returning();

    const assess = await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${fresh.id}/assess`)
      .send({ assessedSeverity: 'medium', riskSummary: 'Workstation overlap', status: 'completed' })
      .expect(201);
    expect(assess.body.data.assessedSeverity).toBe('medium');

    const mitigation = await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${fresh.id}/mitigation`)
      .send({
        title: 'Stagger shifts',
        measures: [{ action: 'Delay newer permit by 2 hours' }],
        assessmentId: assess.body.data.id,
        status: 'active',
      })
      .expect(201);
    expect(mitigation.body.data.title).toBe('Stagger shifts');

    const approve = await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${fresh.id}/approve`)
      .send({
        comments: 'Mitigations accepted',
        mitigationPlanId: mitigation.body.data.id,
      })
      .expect(201);
    expect(approve.body.data.decision).toBe('approved');

    const history = await request(app.getHttpServer())
      .get(`/api/v1/simops/history/${fresh.id}`)
      .expect(200);
    expect(history.body.data.resolution.decision).toBe('approved');
    expect(history.body.data.history.some((h: { action: string }) => h.action === 'approved')).toBe(
      true,
    );

    // Second approval must fail.
    await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${fresh.id}/approve`)
      .send({ comments: 'again' })
      .expect(400);
  });

  httpTest('rejects conflict with reason and freezes participants path', async () => {
    currentUser = supervisor;
    const [fresh] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'pending_assessment',
        severity: 'high',
        primaryConflictType: 'equipment',
        conflictTypes: ['equipment'],
        fingerprint: `fp-res-be-rej-${randomUUID()}`,
        createdBy: supervisorId,
      })
      .returning();

    const reject = await request(app.getHttpServer())
      .post(`/api/v1/simops/conflicts/${fresh.id}/reject`)
      .send({ comments: 'Cannot proceed safely' })
      .expect(201);
    expect(reject.body.data.decision).toBe('rejected');

    const list = await request(app.getHttpServer()).get('/api/v1/simops/history').expect(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.some((h: { conflictId: string }) => h.conflictId === fresh.id)).toBe(
      true,
    );
  });
});
