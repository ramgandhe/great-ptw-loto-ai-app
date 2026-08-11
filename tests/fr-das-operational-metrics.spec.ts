import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  FR_DAS_METRIC_DEFINITIONS,
  FR_DAS_TRACEABILITY,
  REPORT_TYPES,
} from '../app/src/modules/dashboards/fr-das.traceability';
import { DASHBOARD_KIND_ROLES } from '../app/src/modules/dashboards/dashboards.constants';
import { DashboardService } from '../app/src/modules/dashboards/dashboard.service';
import { KpiService } from '../app/src/modules/dashboards/kpi.service';
import { OperationalMetricsService } from '../app/src/modules/dashboards/operational-metrics.service';
import { ReportingService } from '../app/src/modules/dashboards/reporting.service';

describe('FR-DAS operational metrics (PUS-247)', () => {
  it('maps every FR-DAS-002…008 requirement to FR-DSH evidence surfaces', () => {
    const ids: Array<keyof typeof FR_DAS_TRACEABILITY> = [
      'FR-DAS-002',
      'FR-DAS-003',
      'FR-DAS-004',
      'FR-DAS-005',
      'FR-DAS-006',
      'FR-DAS-007',
      'FR-DAS-008',
    ];
    for (const id of ids) {
      expect(FR_DAS_TRACEABILITY[id].frDsh.length).toBeGreaterThan(0);
      expect(FR_DAS_TRACEABILITY[id].surface).toBeTruthy();
      expect(FR_DAS_TRACEABILITY[id].sourceTables.length).toBeGreaterThan(0);
    }
  });

  it('defines report types for permit, incident, SIMOPS and LOTOTO summaries', () => {
    expect(REPORT_TYPES).toEqual(
      expect.arrayContaining([
        'permit_summary',
        'incident_summary',
        'simops_summary',
        'lototo_summary',
        'operational_kpis',
      ]),
    );
  });

  it('documents metric definitions reconciled to PostgreSQL counts', () => {
    expect(FR_DAS_METRIC_DEFINITIONS.active_permits.requirementIds).toContain('FR-DAS-002');
    expect(FR_DAS_METRIC_DEFINITIONS.open_simops_conflicts.requirementIds).toContain('FR-DAS-005');
    expect(FR_DAS_METRIC_DEFINITIONS.active_lototo_executions.requirementIds).toContain(
      'FR-DAS-006',
    );
  });

  it('rejects invalid date ranges (FR-DAS-008)', () => {
    const metrics = new OperationalMetricsService({} as never);
    expect(() =>
      metrics.validatePeriod({
        periodStart: '2026-08-10T00:00:00.000Z',
        periodEnd: '2026-08-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  it('denies unauthorized dashboard kinds (FR-DAS-002 RBAC)', () => {
    const service = new DashboardService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(() => service.assertKindAccess(['operator'], 'management')).toThrow(
      ForbiddenException,
    );
    expect(DASHBOARD_KIND_ROLES.management).toContain('org-admin');
  });

  it('KPI bundle includes SIMOPS and LOTOTO metrics with empty dataset flag', async () => {
    const metrics = {
      validatePeriod: jest.fn(),
      permitCounts: jest.fn().mockResolvedValue({
        active: 0,
        pending: 0,
        suspended: 0,
        closed: 0,
      }),
      incidentCounts: jest.fn().mockResolvedValue({ open: 0, closed: 0 }),
      simopsCounts: jest.fn().mockResolvedValue({ open: 0, resolved: 0 }),
      lototoCounts: jest.fn().mockResolvedValue({ activeExecutions: 0, readyPlans: 0 }),
    };
    const cache = {
      getKpi: jest.fn().mockResolvedValue(null),
      setKpi: jest.fn().mockResolvedValue(undefined),
    };
    const logService = { logEvent: jest.fn() };
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
        }),
      }),
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
      update: jest.fn(),
    };

    const kpi = new KpiService(db as never, cache as never, logService as never, metrics as never);
    const result = (await kpi.getKpis(
      {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'admin',
        roles: ['org-admin'],
        tenantId: '00000000-0000-0000-0000-0000000000aa',
      },
      { kind: 'management', periodLabel: 'current' },
    )) as {
      items: Array<{ key: string; value: { count: number } }>;
      empty: boolean;
      requirementIds: string[];
    };

    const keys = result.items.map((item) => item.key);
    expect(keys).toEqual(
      expect.arrayContaining(['open_simops_conflicts', 'active_lototo_executions', 'active_permits']),
    );
    expect(result.empty).toBe(true);
    expect(result.requirementIds).toEqual(
      expect.arrayContaining(['FR-DAS-002', 'FR-DAS-007', 'FR-DAS-008']),
    );
  });

  it('builds filtered report datasets per FR-DAS report type', async () => {
    const metrics = {
      validatePeriod: jest.fn(),
      permitCounts: jest.fn().mockResolvedValue({ active: 2, pending: 1, suspended: 0, closed: 0 }),
      listPermits: jest.fn().mockResolvedValue([{ id: 'p1', status: 'active' }]),
      incidentCounts: jest.fn().mockResolvedValue({ open: 1, closed: 0 }),
      listIncidents: jest.fn().mockResolvedValue([{ id: 'i1', status: 'open' }]),
      simopsCounts: jest.fn().mockResolvedValue({ open: 3, resolved: 0 }),
      listSimops: jest.fn().mockResolvedValue([{ id: 's1', status: 'open' }]),
      lototoCounts: jest.fn().mockResolvedValue({ activeExecutions: 4, readyPlans: 1 }),
      listLototoExecutions: jest.fn().mockResolvedValue([{ id: 'l1', status: 'isolated' }]),
      organizationalBundle: jest.fn().mockResolvedValue({
        permits: { active: 2 },
        incidents: { open: 1 },
        simops: { open: 3 },
        lototo: { activeExecutions: 4 },
        empty: false,
      }),
    };

    const putObject = jest.fn().mockResolvedValue(undefined);
    const storageService = { putObject, getBucket: () => 'ptw-documents' };
    const logService = { logEvent: jest.fn() };
    const auditService = { log: jest.fn() };

    const reportRow = {
      id: 'r-simops',
      tenantId: 't1',
      requestedBy: 'u1',
      reportType: 'simops_summary',
      format: 'csv',
      status: 'pending',
      filters: { status: 'open' },
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-10T00:00:00.000Z'),
    };

    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([reportRow]) }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...reportRow, status: 'ready' }]),
          }),
        }),
      }),
    };

    const reporting = new ReportingService(
      db as never,
      storageService as never,
      { get: () => 'dashboards/reports' } as never,
      logService as never,
      auditService as never,
      metrics as never,
    );

    await reporting.processReport('r-simops');

    expect(metrics.simopsCounts).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        status: 'open',
        periodStart: reportRow.periodStart,
        periodEnd: reportRow.periodEnd,
      }),
    );
    expect(metrics.listSimops).toHaveBeenCalled();
    expect(putObject).toHaveBeenCalled();
    const body = putObject.mock.calls[0][1] as Buffer;
    expect(body.toString('utf8')).toContain('open,3');
  });

  it('marks empty report datasets when no source rows exist', async () => {
    const metrics = {
      validatePeriod: jest.fn(),
      permitCounts: jest.fn().mockResolvedValue({ active: 0, pending: 0, suspended: 0, closed: 0 }),
      listPermits: jest.fn().mockResolvedValue([]),
    };
    const putObject = jest.fn().mockResolvedValue(undefined);
    const reportRow = {
      id: 'r-empty',
      tenantId: 't1',
      requestedBy: 'u1',
      reportType: 'permit_summary',
      format: 'pdf',
      status: 'pending',
      filters: {},
      periodStart: null,
      periodEnd: null,
    };
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([reportRow]) }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...reportRow, status: 'ready' }]),
          }),
        }),
      }),
    };

    const reporting = new ReportingService(
      db as never,
      { putObject, getBucket: () => 'ptw-documents' } as never,
      { get: () => 'dashboards/reports' } as never,
      { logEvent: jest.fn() } as never,
      { log: jest.fn() } as never,
      metrics as never,
    );

    await reporting.processReport('r-empty');
    const payload = JSON.parse((putObject.mock.calls[0][1] as Buffer).toString('utf8'));
    expect(payload.dataset.empty).toBe(true);
    expect(payload.dataset.requirementId).toBe('FR-DAS-003');
  });

  it('reconciles organizational analytics bundle counts from metrics service', async () => {
    const metrics = new OperationalMetricsService({} as never);
    jest.spyOn(metrics, 'permitCounts').mockResolvedValue({
      active: 5,
      pending: 2,
      suspended: 1,
      closed: 3,
    });
    jest.spyOn(metrics, 'incidentCounts').mockResolvedValue({ open: 4, closed: 7 });
    jest.spyOn(metrics, 'simopsCounts').mockResolvedValue({ open: 2, resolved: 1 });
    jest.spyOn(metrics, 'lototoCounts').mockResolvedValue({
      activeExecutions: 6,
      readyPlans: 3,
    });

    const bundle = await metrics.organizationalBundle('tenant-a');
    expect(bundle.permits.active).toBe(5);
    expect(bundle.incidents.open).toBe(4);
    expect(bundle.simops.open).toBe(2);
    expect(bundle.lototo.activeExecutions).toBe(6);
    expect(bundle.empty).toBe(false);
  });
});
