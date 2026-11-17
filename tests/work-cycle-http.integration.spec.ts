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

function authGuardAs(getUser: () => AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = getUser();
      return true;
    },
  };
}

function utcDay(offset: number, hour = 8): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, hour, 0, 0));
}

function utcDate(offset: number): string {
  return utcDay(offset, 0).toISOString().slice(0, 10);
}

const PAUSE_CHECKLIST = {
  personnelCleared: true,
  workAreaLeftSafe: true,
  materialsToolsSecured: true,
  isolationsIntact: true,
  openingsBarricaded: true,
  emergencyAccessClear: true,
  overnightHazardsNoted: true,
};

describe('Work cycle HTTP (pause / resume day boundary)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const pauserId = randomUUID();
  const otherId = randomUUID();
  const permitTypeId = randomUUID();

  const pauser: AuthenticatedUser = {
    id: pauserId,
    username: 'pauser',
    tenantId,
    roles: ['permit-operator'],
    email: 'pauser@example.com',
  };
  const other: AuthenticatedUser = {
    id: otherId,
    username: 'other',
    tenantId,
    roles: ['permit-operator'],
    email: 'other@example.com',
  };

  let actingUser = pauser;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    const db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
    } catch {
      canConnect = false;
      return;
    }
    await migrate(db, { migrationsFolder });

    const [industry] = await db
      .insert(schema.industries)
      .values({ name: `Work cycle ${randomUUID()}`, createdBy: pauserId })
      .returning();
    await db.insert(schema.organisations).values({
      tenantId,
      name: 'Work cycle org',
      industryId: industry.id,
      timezone: 'UTC',
      operationalDayCutoff: '23:59',
      dailyCrewRosterRequired: true,
      dailyToolboxTalkRequired: true,
      dailyPpeHazardReconfirm: true,
      hardMdpCustodyEnforced: true,
      createdBy: pauserId,
    });
    await db.insert(schema.tenantUsers).values([
      {
        tenantId,
        keycloakUserId: pauserId,
        email: pauser.email!,
        firstName: 'Pause',
        lastName: 'Owner',
        role: 'permit-operator',
        roles: ['permit-operator'],
      },
      {
        tenantId,
        keycloakUserId: otherId,
        email: other.email!,
        firstName: 'Incoming',
        lastName: 'Operator',
        role: 'permit-operator',
        roles: ['permit-operator'],
      },
    ]);

    app = await createTestApp(() => actingUser);
  });

  afterAll(async () => {
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
      actingUser = pauser;
      await fn();
    });
  };

  async function setOrg(patch: { operationalDayCutoff?: string; dailyCrewRosterRequired?: boolean }) {
    const db = drizzle(pool, { schema });
    await db.update(schema.organisations).set(patch).where(eq(schema.organisations.tenantId, tenantId));
  }

  async function seedActivePermit(startOffset: number, endOffset: number, executors: string[]) {
    const db = drizzle(pool, { schema });
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'Work cycle permit',
        plannedStartAt: utcDay(startOffset),
        plannedEndAt: utcDay(endOffset, 18),
        dailyRevalidationRequired: true,
        lototoRequired: false,
        gasTestingRequired: false,
        createdBy: pauserId,
      })
      .returning();
    await db.insert(schema.permitExecutors).values(
      executors.map((workforceUserId, index) => ({
        permitId: permit.id,
        workforceUserId,
        isPrimary: index === 0,
        createdBy: pauserId,
      })),
    );
    await db.insert(schema.permitExecution).values({
      permitId: permit.id,
      activatedBy: pauserId,
      actualStartAt: new Date(),
      workState: 'in_progress',
      createdBy: pauserId,
      updatedBy: pauserId,
    });
    await db
      .update(schema.permits)
      .set({ status: 'active' })
      .where(eq(schema.permits.id, permit.id));
    return permit.id;
  }

  async function counts(permitId: string) {
    const [secures, reopens, talks, crew] = await Promise.all([
      pool.query(
        `select count(*)::int as n from permit_day_secures where permit_id = $1 and late = false`,
        [permitId],
      ),
      pool.query(
        `select count(*)::int as n from permit_revalidations where permit_id = $1 and outcome = 'passed'`,
        [permitId],
      ),
      pool.query(`select count(*)::int as n from permit_toolbox_talks where permit_id = $1`, [permitId]),
      pool.query(`select count(*)::int as n from permit_daily_crew where permit_id = $1`, [permitId]),
    ]);
    const late = await pool.query(
      `select count(*)::int as n from permit_day_secures where permit_id = $1 and late = true`,
      [permitId],
    );
    return {
      secures: secures.rows[0].n as number,
      late: late.rows[0].n as number,
      reopens: reopens.rows[0].n as number,
      talks: talks.rows[0].n as number,
      crew: crew.rows[0].n as number,
    };
  }

  async function pause(permitId: string, extra: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/work/pause`)
      .send({ summary: 'Left the area safe', checklist: PAUSE_CHECKLIST, ...extra });
  }

  async function resumeChecklist(permitId: string) {
    const cycle = await request(app.getHttpServer()).get(`/api/v1/permits/${permitId}/work`).expect(200);
    const items = cycle.body.data.resumeTemplate.items as Array<{ key: string; required: boolean }>;
    const checklist: Record<string, boolean> = {};
    for (const item of items) {
      if (item.required) {
        checklist[item.key] = true;
      }
    }
    return { cycle: cycle.body.data, checklist };
  }

  async function resume(
    permitId: string,
    checklist: Record<string, boolean>,
    crew?: Array<{ workforceUserId: string; role: 'primary' | 'substitute' }>,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/work/resume`)
      .send({ checklist, crew });
  }

  async function backdateOpenPause(permitId: string, operationalDate: string) {
    await pool.query(
      `update permit_work_pauses p
       set operational_date = $2
       where p.permit_id = $1
         and not exists (select 1 from permit_work_resumes r where r.pause_id = p.id)`,
      [permitId, operationalDate],
    );
  }

  httpTest('same-day pause and resume writes no day-secure, reopen, or toolbox talk', async () => {
    await setOrg({ operationalDayCutoff: '23:59', dailyCrewRosterRequired: true });
    const permitId = await seedActivePermit(0, 3, [pauserId]);
    expect((await pause(permitId)).status).toBe(201);
    const { checklist } = await resumeChecklist(permitId);
    expect((await resume(permitId, checklist)).status).toBe(201);
    const after = await counts(permitId);
    expect(after).toMatchObject({ secures: 0, late: 0, reopens: 0, talks: 0, crew: 0 });
  });

  httpTest('next-morning resume writes one secure, one reopen, and one toolbox talk; the next resume writes none', async () => {
    await setOrg({ operationalDayCutoff: '23:59', dailyCrewRosterRequired: true });
    const permitId = await seedActivePermit(0, 3, [pauserId]);
    expect((await pause(permitId)).status).toBe(201);
    await backdateOpenPause(permitId, utcDate(-1));

    const first = await resumeChecklist(permitId);
    expect(first.cycle.crewRosterRequired).toBe(true);
    const blocked = await resume(permitId, first.checklist);
    expect(blocked.status).toBe(400);

    const opened = await resume(permitId, first.checklist, [
      { workforceUserId: pauserId, role: 'primary' },
    ]);
    expect(opened.status).toBe(201);
    expect(await counts(permitId)).toMatchObject({ secures: 1, reopens: 1, talks: 1, crew: 1 });

    expect((await pause(permitId)).status).toBe(201);
    const second = await resumeChecklist(permitId);
    expect(second.cycle.crewRosterRequired).toBeFalsy();
    expect((await resume(permitId, second.checklist)).status).toBe(201);
    expect(await counts(permitId)).toMatchObject({ secures: 1, reopens: 1, talks: 1, crew: 1 });
  });

  httpTest('crew is not asked when the organisation policy is off', async () => {
    await setOrg({ operationalDayCutoff: '23:59', dailyCrewRosterRequired: false });
    const permitId = await seedActivePermit(0, 3, [pauserId]);
    expect((await pause(permitId)).status).toBe(201);
    await backdateOpenPause(permitId, utcDate(-1));
    const { cycle, checklist } = await resumeChecklist(permitId);
    expect(cycle.crewRosterRequired).toBeFalsy();
    expect((await resume(permitId, checklist)).status).toBe(201);
    expect((await counts(permitId)).crew).toBe(0);
  });

  httpTest('an open job with missed days blocks progress and resume until one late pause', async () => {
    await setOrg({ operationalDayCutoff: '23:59', dailyCrewRosterRequired: true });
    const permitId = await seedActivePermit(-2, 2, [pauserId]);
    const cycle = await request(app.getHttpServer()).get(`/api/v1/permits/${permitId}/work`).expect(200);
    const missed = cycle.body.data.missingPriorSecureDates as string[];
    expect(missed.length).toBeGreaterThan(1);

    const progress = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/progress`)
      .send({ summary: 'Still working' });
    expect(progress.status).toBe(409);
    expect(JSON.stringify(progress.body)).toMatch(/late secure/i);

    const resumeNow = await resumeChecklist(permitId);
    expect((await resume(permitId, resumeNow.checklist)).status).toBe(409);

    const withoutReason = await pause(permitId);
    expect(withoutReason.status).toBe(400);

    expect((await pause(permitId, { lateReason: 'Left the job running overnight' })).status).toBe(201);
    expect((await counts(permitId)).late).toBe(missed.length);
  });

  httpTest('progress after the cut-off is rejected and a same-day resume writes no day-secure', async () => {
    await setOrg({ operationalDayCutoff: '00:00', dailyCrewRosterRequired: false });
    const permitId = await seedActivePermit(0, 2, [pauserId]);
    const progress = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/progress`)
      .send({ summary: 'After cut-off' });
    expect(progress.status).toBe(409);
    expect(JSON.stringify(progress.body)).toMatch(/cut-off/i);

    expect((await pause(permitId)).status).toBe(201);
    const { checklist } = await resumeChecklist(permitId);
    expect((await resume(permitId, checklist)).status).toBe(201);
    const after = await counts(permitId);
    expect(after.secures).toBe(0);
    expect(after.late).toBe(0);
  });

  httpTest('handover is required only when a different person resumes', async () => {
    await setOrg({ operationalDayCutoff: '23:59', dailyCrewRosterRequired: false });
    const permitId = await seedActivePermit(0, 2, [pauserId, otherId]);
    expect((await pause(permitId)).status).toBe(201);

    actingUser = other;
    const { checklist } = await resumeChecklist(permitId);
    const blocked = await resume(permitId, checklist);
    expect(blocked.status).toBe(409);
    expect(JSON.stringify(blocked.body)).toMatch(/handover/i);

    actingUser = pauser;
    expect((await resume(permitId, checklist)).status).toBe(201);
  });

  httpTest('handover only targets assigned executors and outgoing may cancel and reassign', async () => {
    const permitId = await seedActivePermit(0, 2, [pauserId, otherId]);
    const payload = {
      completedActivities: 'Prepared the work area',
      outstandingWork: 'Continue the task',
    };

    const invalid = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/handover`)
      .send({ ...payload, incomingUserId: randomUUID() });
    expect(invalid.status).toBe(400);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/handover`)
      .send({ ...payload, incomingUserId: otherId });
    expect(first.status).toBe(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/handovers/${first.body.data.id}/cancel`)
      .send({});
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.data.status).toBe('cancelled');

    const replacement = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/handover`)
      .send({ ...payload, incomingUserId: otherId });
    expect(replacement.status).toBe(201);

    actingUser = other;
    expect((await request(app.getHttpServer()).get(`/api/v1/permits/${permitId}`)).status).toBe(200);
    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/handovers/${replacement.body.data.id}/reject`)
      .send({ notes: 'Not available for this shift' });
    expect(rejected.status).toBe(201);
    expect(rejected.body.data.status).toBe('rejected');
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
