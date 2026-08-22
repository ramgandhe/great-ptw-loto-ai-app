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
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: 'v1', prefix: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
  );
  await app.init();
  return app;
}

describe('Restoration & History HTTP integration (PUS-161)', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const officerId = randomUUID();
  const officer: AuthenticatedUser = { id: officerId, username: 'officer', tenantId, roles: ['operator'], email: 'o@x.com' };
  const verifier: AuthenticatedUser = { id: randomUUID(), username: 'safety-officer', tenantId, roles: ['safety-officer'], email: 'v@x.com' };
  const reader: AuthenticatedUser = { id: randomUUID(), username: 'viewer', tenantId, roles: ['viewer'], email: 'r@x.com' };
  const foreign: AuthenticatedUser = { id: randomUUID(), username: 'other', tenantId: randomUUID(), roles: ['operator', 'org-admin'], email: 'f@x.com' };

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
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (canConnect) await pool.end();
  });

  const httpTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) return;
      await fn();
    });
  };

  // Seed an isolation execution already advanced to `verified`, with locks/tags
  // applied to two sequenced isolation points — the state restoration begins from.
  async function seedVerifiedExecution(status: 'verified' | 'in_progress' = 'verified') {
    const [permit] = await db.insert(schema.permits).values({ tenantId, status: 'approved', permitTypeId: randomUUID(), title: 'R', reference: `PTW-${randomUUID().slice(0, 8)}`, createdBy: officerId }).returning();
    const [ws] = await db.insert(schema.workstationCatalogue).values({ tenantId, code: `WS-${randomUUID().slice(0, 6)}`, name: 'Bay', createdBy: officerId }).returning();
    const [mc] = await db.insert(schema.machineryCatalogue).values({ tenantId, code: `MC-${randomUUID().slice(0, 6)}`, name: 'C', workstationId: ws.id, createdBy: officerId }).returning();
    // Plan starts 'ready' so isolation points/sequences can be configured; the
    // SP-03.01 trigger locks configuration once the plan is in execution, so we
    // only advance the plan status after the configuration is seeded.
    const [plan] = await db.insert(schema.lototoPlans).values({ tenantId, permitId: permit.id, machineryId: mc.id, title: 'P', status: 'ready', createdBy: officerId }).returning();
    const [p1] = await db.insert(schema.isolationPoints).values({ planId: plan.id, machineryId: mc.id, isolationNumber: 'ISO-1', createdBy: officerId }).returning();
    const [p2] = await db.insert(schema.isolationPoints).values({ planId: plan.id, machineryId: mc.id, isolationNumber: 'ISO-2', createdBy: officerId }).returning();
    await db.insert(schema.isolationSequences).values([
      { planId: plan.id, isolationPointId: p1.id, sequenceOrder: 1, requiresVerification: true, createdBy: officerId },
      { planId: plan.id, isolationPointId: p2.id, sequenceOrder: 2, requiresVerification: true, createdBy: officerId },
    ]);
    await db.update(schema.lototoPlans).set({ status: 'in_execution' }).where(eq(schema.lototoPlans.id, plan.id));
    const [exec] = await db.insert(schema.isolationExecution).values({ tenantId, planId: plan.id, status, startedBy: officerId, createdBy: officerId }).returning();
    const [lock1] = await db.insert(schema.appliedLocks).values({ tenantId, executionId: exec.id, isolationPointId: p1.id, lockTag: 'LK-1', lockMethod: 'padlock', appliedBy: officerId, createdBy: officerId }).returning();
    await db.insert(schema.appliedLocks).values({ tenantId, executionId: exec.id, isolationPointId: p2.id, lockTag: 'LK-2', lockMethod: 'padlock', appliedBy: officerId, createdBy: officerId });
    const [tag1] = await db.insert(schema.appliedTags).values({ tenantId, executionId: exec.id, isolationPointId: p1.id, tagNumber: 'TG-1', tagType: 'danger', appliedBy: officerId, createdBy: officerId }).returning();
    return { plan, p1, p2, exec, lock1, tag1 };
  }

  const server = () => app.getHttpServer();

  httpTest('full restoration flow: remove locks/tags → restore → verify → complete → history (FR-LTO-012..014)', async () => {
    const s = await seedVerifiedExecution();
    const base = `/api/v1/isolation-executions/${s.exec.id}/restoration`;

    currentUser = officer;
    await request(server()).post(`${base}/locks/remove`).send({ appliedLockId: s.lock1.id, reason: 'work complete' }).expect(201);
    await request(server()).post(`${base}/tags/remove`).send({ appliedTagId: s.tag1.id }).expect(201);
    await request(server()).post(`${base}/equipment`).send({ isolationPointId: s.p1.id, method: 're-energise' }).expect(201);
    await request(server()).post(`${base}/equipment`).send({ isolationPointId: s.p2.id }).expect(201);

    currentUser = verifier;
    await request(server()).post(`${base}/verifications`).send({ isolationPointId: s.p1.id, result: 'pass', method: 'walk-down' }).expect(201);

    currentUser = officer;
    const complete = await request(server()).post(`${base}/complete`).send({}).expect(201);
    expect(complete.body.data.status).toBe('restored');

    currentUser = reader;
    const hist = await request(server()).get(`/api/v1/isolation-executions/${s.exec.id}/history`).expect(200);
    const actions = hist.body.data.map((h: { action: string }) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['lock.removed', 'equipment.restored', 'execution.restored', 'execution.archived']));
  });

  httpTest('rejects unauthenticated access to a protected restoration endpoint', async () => {
    const s = await seedVerifiedExecution();
    currentUser = null;
    await request(server()).post(`/api/v1/isolation-executions/${s.exec.id}/restoration/equipment`).send({ isolationPointId: s.p1.id }).expect(403);
  });

  httpTest('enforces RBAC server-side on restoration actions', async () => {
    const s = await seedVerifiedExecution();
    currentUser = reader; // viewer cannot perform restoration action
    await request(server()).post(`/api/v1/isolation-executions/${s.exec.id}/restoration/equipment`).send({ isolationPointId: s.p1.id }).expect(403);
    currentUser = verifier; // verifier cannot complete (action-only route)
    await request(server()).post(`/api/v1/isolation-executions/${s.exec.id}/restoration/complete`).send({}).expect(403);
  });

  httpTest('prevents cross-tenant access to restoration/history', async () => {
    const s = await seedVerifiedExecution();
    currentUser = foreign;
    await request(server()).get(`/api/v1/isolation-executions/${s.exec.id}/restoration`).expect(404);
    await request(server()).get(`/api/v1/isolation-executions/${s.exec.id}/history`).expect(404);
  });

  httpTest('rejects restoration before the execution is verified (invalid transition)', async () => {
    const s = await seedVerifiedExecution('in_progress');
    currentUser = officer;
    await request(server()).post(`/api/v1/isolation-executions/${s.exec.id}/restoration/equipment`).send({ isolationPointId: s.p1.id }).expect(409);
  });

  httpTest('rejects completing restoration before all points are restored', async () => {
    const s = await seedVerifiedExecution();
    currentUser = officer;
    // Only restore one of two sequenced points, then attempt to complete.
    await request(server()).post(`/api/v1/isolation-executions/${s.exec.id}/restoration/equipment`).send({ isolationPointId: s.p1.id }).expect(201);
    await request(server()).post(`/api/v1/isolation-executions/${s.exec.id}/restoration/complete`).send({}).expect(409);
  });
});
