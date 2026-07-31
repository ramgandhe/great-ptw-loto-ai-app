import { ConflictDetectionService } from '../app/src/modules/simops/conflict-detection.service';
import { RiskCalculationService } from '../app/src/modules/simops/risk-calculation.service';

describe('ConflictDetectionService pairing rules (PUS-166)', () => {
  const risk = new RiskCalculationService();

  // Exercise private evaluatePair via a thin subclass for unit coverage.
  class TestableDetection extends ConflictDetectionService {
    evaluate(
      a: Parameters<ConflictDetectionService['analyse']> extends never ? never : {
        id: string;
        tenantId: string;
        status: string;
        permitTypeId: string;
        permitTypeCode: string | null;
        locationId: string | null;
        workstationId: string | null;
        machineryId: string | null;
        plannedStartAt: Date | null;
        plannedEndAt: Date | null;
        createdAt: Date;
        submittedBy: string | null;
      },
      b: typeof a,
    ) {
      return (
        this as unknown as {
          evaluatePair: (x: typeof a, y: typeof a) => unknown;
        }
      ).evaluatePair(a, b);
    }
  }

  const service = new TestableDetection(
    {} as never,
    risk,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const base = {
    id: 'a',
    tenantId: 't1',
    status: 'active',
    permitTypeId: 'pt',
    permitTypeCode: 'COLD-WORK',
    locationId: 'loc-1',
    workstationId: null as string | null,
    machineryId: null as string | null,
    plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
    plannedEndAt: new Date('2026-08-01T16:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    submittedBy: null as string | null,
  };

  it('ignores plant-level location overlap without workstation/machinery/type signal', () => {
    const result = service.evaluate(
      { ...base, id: '1' },
      { ...base, id: '2', createdAt: new Date('2026-07-02T00:00:00.000Z') },
    );
    expect(result).toBeNull();
  });

  it('detects workstation overlap as location conflict', () => {
    const result = service.evaluate(
      { ...base, id: '1', workstationId: 'ws-1' },
      {
        ...base,
        id: '2',
        workstationId: 'ws-1',
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    ) as { types: string[]; severity: string };

    expect(result.types).toEqual(expect.arrayContaining(['schedule', 'location']));
    expect(result.severity).toBe('medium');
  });

  it('detects equipment conflict at high severity', () => {
    const result = service.evaluate(
      { ...base, id: '1', machineryId: 'm-1' },
      {
        ...base,
        id: '2',
        machineryId: 'm-1',
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    ) as { types: string[]; severity: string };

    expect(result.types).toEqual(expect.arrayContaining(['schedule', 'equipment']));
    expect(result.severity).toBe('high');
  });

  it('detects hot-work vs confined-space permit type interaction', () => {
    const result = service.evaluate(
      { ...base, id: '1', permitTypeCode: 'HOT-WORK', workstationId: 'ws-1' },
      {
        ...base,
        id: '2',
        permitTypeCode: 'CONFINED-SPACE',
        workstationId: 'ws-1',
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    ) as { types: string[]; severity: string };

    expect(result.types).toEqual(expect.arrayContaining(['permit_type', 'location']));
    expect(result.severity).toBe('high');
  });

  it('requires schedule overlap', () => {
    const result = service.evaluate(
      { ...base, id: '1', workstationId: 'ws-1' },
      {
        ...base,
        id: '2',
        workstationId: 'ws-1',
        plannedStartAt: new Date('2026-08-02T08:00:00.000Z'),
        plannedEndAt: new Date('2026-08-02T16:00:00.000Z'),
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    );
    expect(result).toBeNull();
  });
});
