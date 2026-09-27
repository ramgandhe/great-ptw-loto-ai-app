import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { InsightsQueryDto, ReportViewQueryDto } from '../app/src/modules/dashboards/dto/dashboard.dto';
import { InsightsService, dailySeries, median } from '../app/src/modules/dashboards/insights.service';
import { testDatabaseUrl } from './helpers/db';

describe('Insights helpers', () => {
  it('takes the median of an odd and even sorted list', () => {
    expect(median([])).toBeNull();
    expect(median([1, 5, 9])).toBe(5);
    expect(median([1, 2, 4, 10])).toBe(3);
  });

  it('fills every day in the period, including days with nothing recorded', () => {
    const rows = dailySeries(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T12:00:00Z'), {
      raised: [{ day: '2026-09-02', count: '3' }],
    });
    expect(rows).toEqual([
      { day: '2026-09-01', raised: 0 },
      { day: '2026-09-02', raised: 3 },
      { day: '2026-09-03', raised: 0 },
    ]);
  });
});

describe('Insights query validation', () => {
  const errors = async (cls: new () => object, input: object) =>
    (await validate(plainToInstance(cls, input))).map((e) => e.property);

  it('accepts a period between 7 and 365 days', async () => {
    expect(await errors(InsightsQueryDto, { days: '90' })).toEqual([]);
    expect(await errors(InsightsQueryDto, { days: '3' })).toContain('days');
    expect(await errors(InsightsQueryDto, { days: '400' })).toContain('days');
  });

  it('only allows known report types', async () => {
    expect(await errors(ReportViewQueryDto, { type: 'permit_summary' })).toEqual([]);
    expect(await errors(ReportViewQueryDto, { type: 'payroll' })).toContain('type');
  });
});

describe('InsightsService against the database', () => {
  let pool: Pool;
  let canConnect = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    canConnect = await pool.query('SELECT 1').then(() => true, () => false);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns an empty, well-formed picture for a tenant with no data', async () => {
    if (!canConnect) return;
    const service = new InsightsService(drizzle(pool, { schema }) as never);
    const user = { id: randomUUID(), username: 't', tenantId: randomUUID(), roles: ['tenant-owner'] };

    const insights = await service.getInsights(user, 30);
    expect(insights.permits.byStatus).toEqual([]);
    expect(insights.permits.timeline).toHaveLength(31);
    expect(insights.approvals.medianHoursToDecision).toBeNull();
    expect(insights.attention).toEqual({
      overdueActivePermits: 0,
      approvalsWaitingOverDay: 0,
      highSeverityConflicts: 0,
      criticalIncidentsOpen: 0,
      overdueCorrectiveActions: 0,
      suspendedPermits: 0,
    });

    const report = await service.viewReport(user, 'permit_summary', 30);
    expect(report.rows).toEqual([]);
    const incidents = await service.viewReport(user, 'incident_summary', 30);
    expect(incidents.rows).toEqual([]);
  });
});
