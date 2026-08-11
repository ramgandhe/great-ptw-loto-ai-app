import {
  DEFAULT_HIGH_ESCALATION_HOURS,
  FROZEN_PEER_STATUSES,
  SIMOPS_LOW_ACK_ROLES,
  SIMOPS_RESOLVE_ROLES,
  SIMOPS_SYSTEM_ACTOR_ID,
} from '../app/src/modules/simops/simops.constants';
import {
  detectPairConflict,
  newerPermitId,
  type PermitForAnalysis,
} from '../app/src/modules/simops/conflict-detection.service';

describe('SIMOPS remediation rules (PUS-246)', () => {
  it('defaults high cross-dept escalation to 4 hours (FR-SIM-019)', () => {
    expect(DEFAULT_HIGH_ESCALATION_HOURS).toBe(4);
  });

  it('maps resolve authority to Safety Officer/HOD roles without platform-admin', () => {
    expect(SIMOPS_RESOLVE_ROLES).toEqual(['supervisor', 'org-admin']);
    expect(SIMOPS_LOW_ACK_ROLES).toContain('job-issuer');
  });

  it('freezes only against approved/active peers (FR-SIM-017)', () => {
    expect(FROZEN_PEER_STATUSES).toEqual(['approved', 'active']);
  });

  it('uses a UUID system actor for jobs', () => {
    expect(SIMOPS_SYSTEM_ACTOR_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('identifies the newer permit by submittedAt (FR-SIM-017)', () => {
    const older = {
      id: 'a',
      submittedAt: new Date('2026-08-01T08:00:00.000Z'),
      createdAt: new Date('2026-08-01T07:00:00.000Z'),
    } as PermitForAnalysis;
    const newer = {
      id: 'b',
      submittedAt: new Date('2026-08-01T10:00:00.000Z'),
      createdAt: new Date('2026-08-01T09:00:00.000Z'),
    } as PermitForAnalysis;

    expect(newerPermitId(older, newer)).toBe('b');
  });

  it('treats same-location-only pairs as non-conflicts (FR-SIM-011 negative)', () => {
    const locationId = 'loc-1';
    const a = {
      id: 'a',
      locationId,
      workstationId: 'ws-1',
      machineryId: 'm-1',
      plannedStartAt: new Date('2026-08-01T08:00:00.000Z'),
      plannedEndAt: new Date('2026-08-01T16:00:00.000Z'),
      hazardCategoryCodes: [],
      submittedAt: new Date(),
      createdAt: new Date(),
      permitTypeId: 't1',
      reference: null,
      title: 'A',
      departmentId: 'd1',
      status: 'approved',
    } as PermitForAnalysis;
    const b = {
      ...a,
      id: 'b',
      workstationId: 'ws-2',
      machineryId: 'm-2',
    } as PermitForAnalysis;

    expect(detectPairConflict(a, b)).toBeNull();
  });
});
