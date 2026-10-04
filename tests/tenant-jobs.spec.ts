import { randomUUID } from 'crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import { forEachTenant } from '../app/src/database/context';
import { DEFAULT_JOB_OPTIONS } from '../app/src/infrastructure/queue/queue.service';
import { assertIdsOnly } from '../app/src/infrastructure/queue/tenant-job';
import { connectApi, connectOwner } from './helpers/db';
import { createTenantGraph, TenantGraph } from './helpers/fixtures';

const connection = { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) };

describe('Tenant-scoped jobs (NFR-SEC-008)', () => {
  const owner = connectOwner();
  const api = connectApi();
  let a: TenantGraph;
  let x: TenantGraph;

  beforeAll(async () => {
    a = await createTenantGraph(owner);
    x = await createTenantGraph(owner);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('accepts only the tenant ID and record IDs in a job payload', () => {
    expect(() => assertIdsOnly({ tenantId: randomUUID(), permitId: randomUUID() })).not.toThrow();
    expect(() => assertIdsOnly({ tenantId: randomUUID(), name: 'Asha Rao' })).toThrow('record ID');
    expect(() => assertIdsOnly({ tenantId: randomUUID(), email: 'asha@example.test' })).toThrow('record ID');
    expect(() => assertIdsOnly({ tenantId: randomUUID(), attempts: 3 })).toThrow('record ID');
    expect(() => assertIdsOnly({ permitId: randomUUID() })).toThrow('tenantId');
  });

  it('removes a failed job as soon as it finally fails, so none is kept beyond 7 days on an idle queue', async () => {
    const name = `retention-${randomUUID()}`;
    const queue = new Queue(name, { connection, defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 1 } });
    const events = new QueueEvents(name, { connection });
    const worker = new Worker(name, async () => {
      throw new Error('handler failed');
    }, { connection });
    try {
      await events.waitUntilReady();
      // Listen before adding, so a job that fails at once is not missed.
      const failed = new Promise<string>((resolve) => events.on('failed', ({ jobId }) => resolve(jobId)));
      const job = await queue.add('fails', { tenantId: randomUUID() });
      expect(await failed).toBe(job.id);
      expect(await queue.getJob(job.id as string)).toBeUndefined();
      expect(await queue.getJobCounts('failed')).toEqual({ failed: 0 });
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("visits each tenant under its own context, and one tenant's failure does not stop the others", async () => {
    const seen = new Map<string, { own: number; foreign: number }>();
    const run = forEachTenant(api.db, async (tx, tenantId) => {
      if (tenantId === a.tenantId) throw new Error('tenant a failed');
      const { rows } = await tx.execute<{ own: number; foreign: number }>(sql`
        select count(*) filter (where tenant_id = ${tenantId})::int as own,
               count(*) filter (where tenant_id <> ${tenantId})::int as foreign
          from legal_entities`);
      seen.set(tenantId, rows[0]);
    });
    await expect(run).rejects.toBeInstanceOf(AggregateError);
    expect(seen.get(x.tenantId)).toEqual({ own: 1, foreign: 0 });
    expect(seen.has(a.tenantId)).toBe(false);
  });
});
