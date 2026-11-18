import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
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

function authGuardAs(getUser: () => AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = getUser();
      return true;
    },
  };
}

function user(id: string, tenantId: string, roles: string[]): AuthenticatedUser {
  return { id, username: roles[0], tenantId, roles, email: `${roles[0]}@example.com` };
}

describe('permit report HTTP', () => {
  let app: INestApplication;
  let pool: Pool;

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const receiverId = randomUUID();
  const strangerId = randomUUID();
  const operatorId = randomUUID();
  const viewerId = randomUUID();
  const otherAdminId = randomUUID();
  const permitTypeA = randomUUID();
  const permitTypeB = randomUUID();

  const receiver = user(receiverId, tenantA, ['permit-receiver']);
  const stranger = user(strangerId, tenantA, ['permit-receiver']);
  const operator = user(operatorId, tenantA, ['permit-operator']);
  const viewer = user(viewerId, tenantA, ['viewer']);
  const otherAdmin = user(otherAdminId, tenantB, ['tenant-admin']);
  let acting = receiver;

  let approvedId = '';
  let draftId = '';
  let pendingId = '';
  let resubmittedId = '';
  let otherId = '';

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder });

    const [industry] = await db
      .insert(schema.industries)
      .values({ name: `Report ${randomUUID()}`, createdBy: receiverId })
      .returning();
    await db.insert(schema.organisations).values([
      { tenantId: tenantA, name: 'Report org A', industryId: industry.id, timezone: 'UTC', createdBy: receiverId },
      { tenantId: tenantB, name: 'Report org B', industryId: industry.id, timezone: 'UTC', createdBy: otherAdminId },
    ]);
    await db.insert(schema.permitTypes).values([
      { id: permitTypeA, tenantId: tenantA, code: `R-${permitTypeA.slice(0, 8)}`, name: 'Cold work', createdBy: receiverId },
      { id: permitTypeB, tenantId: tenantB, code: `R-${permitTypeB.slice(0, 8)}`, name: 'Cold work', createdBy: otherAdminId },
    ]);

    const inserted = await db
      .insert(schema.permits)
      .values([
        {
          tenantId: tenantA,
          permitTypeId: permitTypeA,
          title: 'Approved report',
          status: 'approved',
          reference: 'PTW-REPORT-OK',
          approvedAt: new Date('2026-11-01T08:00:00.000Z'),
          createdBy: receiverId,
        },
        {
          tenantId: tenantA,
          permitTypeId: permitTypeA,
          title: 'Draft report',
          status: 'draft',
          reference: 'PTW-REPORT-DRAFT',
          createdBy: receiverId,
        },
        {
          tenantId: tenantA,
          permitTypeId: permitTypeA,
          title: 'Waiting report',
          status: 'pending_approval',
          reference: 'PTW-REPORT-WAIT',
          createdBy: receiverId,
        },
        {
          tenantId: tenantA,
          permitTypeId: permitTypeA,
          title: 'Resubmitted report',
          status: 'pending_approval',
          reference: 'PTW-REPORT-AGAIN',
          approvedAt: null,
          createdBy: receiverId,
        },
        {
          tenantId: tenantB,
          permitTypeId: permitTypeB,
          title: 'Other tenant report',
          status: 'approved',
          reference: 'PTW-REPORT-OTHER',
          approvedAt: new Date('2026-11-01T08:00:00.000Z'),
          createdBy: otherAdminId,
        },
      ])
      .returning({ id: schema.permits.id, reference: schema.permits.reference });

    const idOf = (reference: string) => inserted.find((row) => row.reference === reference)?.id ?? '';
    approvedId = idOf('PTW-REPORT-OK');
    draftId = idOf('PTW-REPORT-DRAFT');
    pendingId = idOf('PTW-REPORT-WAIT');
    resubmittedId = idOf('PTW-REPORT-AGAIN');
    otherId = idOf('PTW-REPORT-OTHER');

    await db.insert(schema.permitExecutors).values({
      permitId: approvedId,
      workforceUserId: operatorId,
      isPrimary: true,
      createdBy: receiverId,
    });
    await db.insert(schema.approvalHistory).values({
      permitId: resubmittedId,
      action: 'approved',
      fromStatus: 'pending_approval',
      toStatus: 'approved',
      actorId: receiverId,
      createdBy: receiverId,
    });

    app = await createTestApp(() => acting);
  }, 60000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  function report(id: string) {
    return request(app.getHttpServer()).get(`/api/v1/permits/${id}/report.pdf`);
  }

  it('gives the creator and the assigned operator the PDF, and keeps it out of the cache', async () => {
    acting = receiver;
    const created = await report(approvedId).expect(200);
    expect(created.headers['content-type']).toMatch(/application\/pdf/);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(created.headers['content-disposition']).toMatch(/^inline; filename="PTW-REPORT-OK-interim-\d{8}-\d{6}\.pdf"$/);
    expect(created.body.subarray(0, 5).toString()).toBe('%PDF-');

    acting = operator;
    const operated = await report(approvedId).expect(200);
    expect(operated.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('refuses a viewer, a draft, a permit that was never approved, and someone who cannot see it', async () => {
    acting = viewer;
    const denied = await report(approvedId).expect(403);
    expect(denied.body.error.message).toBe('Insufficient permissions');

    acting = receiver;
    const draft = await report(draftId).expect(403);
    expect(draft.body.error.message).toBe('This permit report is not available.');
    const waiting = await report(pendingId).expect(403);
    expect(waiting.body.error.message).toBe('This permit report is not available.');

    acting = stranger;
    const hidden = await report(approvedId).expect(403);
    expect(hidden.body.error.message).toBe('You are not allowed to view this permit');
  });

  it('keeps the report inside the tenant, and still offers it after approval is cleared', async () => {
    acting = otherAdmin;
    await report(approvedId).expect(404);
    const own = await report(otherId).expect(200);
    expect(own.body.subarray(0, 5).toString()).toBe('%PDF-');

    acting = receiver;
    const detail = await request(app.getHttpServer()).get(`/api/v1/permits/${resubmittedId}`).expect(200);
    expect(detail.body.data.previouslyApproved).toBe(true);
    expect(detail.body.data.permit.approvedAt).toBeNull();
    const again = await report(resubmittedId).expect(200);
    expect(again.headers['content-disposition']).toMatch(/^inline; filename="PTW-REPORT-AGAIN-interim-/);
  });
});

async function createTestApp(getUser: () => AuthenticatedUser): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JwtAuthGuard)
    .useValue(authGuardAs(getUser))
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}
