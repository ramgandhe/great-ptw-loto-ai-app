import { PERMIT_STATUS_HISTORY_ACTIONS } from '../app/src/database/schema/execution';
import { APPROVAL_HISTORY_ACTIONS } from '../app/src/database/schema/approval';
import { EDGES, NODE_BY_ID, buildJourney } from '../frontend/src/lib/permit/process';

const permit = {
  status: 'active',
  createdAt: '2026-09-01T08:00:00.000Z',
  createdBy: 'issuer',
  submittedAt: null,
  submittedBy: 'issuer',
  updatedAt: '2026-09-03T09:00:00.000Z',
};

function entry(id: string, at: string, action: string, fromStatus: string, toStatus: string, actorId = 'someone') {
  return { id, createdAt: at, action, fromStatus, toStatus, actorId, comment: null };
}

describe('permit process map', () => {
  it('only links stages that exist', () => {
    for (const edge of EDGES) {
      expect(NODE_BY_ID.has(edge.from)).toBe(true);
      expect(NODE_BY_ID.has(edge.to)).toBe(true);
    }
  });

  it('has an arrow for every logged move the API can record', () => {
    const notMoves = new Set(['sla_escalated', 'workflow_blocked']);
    const drawn = new Set(EDGES.flatMap((edge) => edge.actions));
    const logged = [...PERMIT_STATUS_HISTORY_ACTIONS, ...APPROVAL_HISTORY_ACTIONS].filter((a) => !notMoves.has(a));
    expect(logged.filter((action) => !drawn.has(action))).toEqual([]);
  });
});

describe('buildJourney', () => {
  it('follows loops, counts repeated moves and marks where the permit is now', () => {
    const journey = buildJourney(permit, [
      entry('1', '2026-09-01T09:00:00.000Z', 'submitted', 'draft', 'pending_approval', 'issuer'),
      entry('2', '2026-09-01T10:00:00.000Z', 'deferred', 'pending_approval', 'deferred', 'hod'),
      entry('3', '2026-09-01T11:00:00.000Z', 'resubmitted', 'deferred', 'pending_approval', 'issuer'),
      entry('4', '2026-09-01T12:00:00.000Z', 'stage_advanced', 'pending_approval', 'pending_approval', 'hod'),
      entry('5', '2026-09-01T13:00:00.000Z', 'approved', 'pending_approval', 'approved', 'hod'),
      entry('6', '2026-09-02T08:00:00.000Z', 'activated', 'approved', 'active', 'executor'),
    ]);

    expect(journey.anomalies).toEqual([]);
    expect(journey.current).toBe('active');
    expect(journey.enteredCurrentAt).toBe('2026-09-02T08:00:00.000Z');
    expect([...journey.visited].sort()).toEqual(['active', 'approved', 'deferred', 'draft', 'pending_approval']);
    expect(journey.edges.get('defer')).toBe(1);
    expect(journey.edges.get('stage')).toBe(1);
    // Time spent waiting for approval before the deferral.
    expect(journey.events.find((e) => e.id === '2')?.stayMs).toBe(60 * 60 * 1000);
  });

  it('flags a status change that was never logged', () => {
    const journey = buildJourney({ ...permit, status: 'closed' }, [
      entry('1', '2026-09-01T09:00:00.000Z', 'submitted', 'draft', 'pending_approval'),
    ]);

    expect(journey.current).toBe('closed');
    expect(journey.anomalies).toHaveLength(1);
    expect(journey.events.at(-1)).toMatchObject({ action: 'unlogged', inferred: true });
  });

  it('shows moves made by scheduled jobs as the system', () => {
    const journey = buildJourney({ ...permit, status: 'expired' }, [
      entry('1', '2026-09-01T09:00:00.000Z', 'submitted', 'draft', 'pending_approval'),
      entry('2', '2026-09-01T10:00:00.000Z', 'approved', 'pending_approval', 'approved'),
      entry('3', '2026-09-01T11:00:00.000Z', 'activated', 'approved', 'active'),
      { ...entry('4', '2026-09-03T00:00:00.000Z', 'expired', 'active', 'expired', 'issuer'), metadata: { system: true } },
    ]);

    expect(journey.anomalies).toEqual([]);
    expect(journey.edges.get('expire')).toBe(1);
    expect(journey.events.at(-1)?.actorId).toBeNull();
  });
});
