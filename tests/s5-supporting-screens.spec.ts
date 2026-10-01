import { isolationProgress } from '../frontend/src/lib/isolation-execution/progress';
import { restorationProgress } from '../frontend/src/lib/restoration/progress';
import { notificationTarget } from '../frontend/src/lib/notifications/routes';
import { sharedWindow } from '../frontend/src/lib/simops/overlap';
import type { AppliedLock, AppliedTag, IsolationVerification, SequenceStep } from '../frontend/src/lib/isolation-execution/types';
import type { Notification } from '../frontend/src/lib/notifications/types';
import type { ConflictParticipant } from '../frontend/src/lib/simops/types';
import type { RestorationDetail } from '../frontend/src/lib/restoration/types';

const step = (n: number, requiresVerification = true) =>
  ({ sequenceOrder: n, requiresVerification, isolationPointId: `p${n}`, isolationNumber: `ISO-${n}`, description: null }) as SequenceStep;
const lock = (point: string, status = 'applied') => ({ id: `l-${point}`, isolationPointId: point, status, lockTag: 'L', lockMethod: 'padlock' }) as AppliedLock;
const tag = (point: string) => ({ id: `t-${point}`, isolationPointId: point, status: 'applied', tagNumber: 'T', tagType: 'danger' }) as AppliedTag;
const pass = (point: string) => ({ id: `v-${point}`, isolationPointId: point, result: 'pass' }) as IsolationVerification;

describe('LOTOTO execution progress (S5)', () => {
  it('opens a point only once every earlier point is locked, and works on the first unfinished point', () => {
    const sequence = [step(2), step(1), step(3, false)];
    let progress = isolationProgress(sequence, [], [], []);
    expect(progress.points.map((p) => [p.step.isolationNumber, p.open])).toEqual([['ISO-1', true], ['ISO-2', false], ['ISO-3', false]]);
    expect(progress.current?.step.isolationNumber).toBe('ISO-1');

    progress = isolationProgress(sequence, [lock('p1')], [tag('p1')], []);
    // Locked and tagged but not verified: still the current point; the next one is open to lock.
    expect(progress.current?.step.isolationNumber).toBe('ISO-1');
    expect(progress.points[1].open).toBe(true);

    progress = isolationProgress(sequence, [lock('p1'), lock('p2'), lock('p3', 'removed')], [tag('p1'), tag('p2'), tag('p3')], [pass('p1'), pass('p2')]);
    expect(progress.current?.step.isolationNumber).toBe('ISO-3');
    expect(progress.left).toBe(1);
  });
});

describe('restoration progress (S5)', () => {
  it('counts what is still on and finishes a point only when it is clear and restored', () => {
    const restoration = {
      lockRemovals: [{ appliedLockId: 'l-p1' }],
      tagRemovals: [],
      restorations: [{ isolationPointId: 'p1', restoredAt: '' }],
    } as unknown as RestorationDetail;
    const progress = restorationProgress([step(1), step(2)], [lock('p1'), lock('p2')], [tag('p1'), tag('p2')], restoration);
    expect(progress.outstanding).toEqual({ locks: 1, tags: 2, points: 1 });
    expect(progress.points[0].done).toBe(false);
    expect(progress.current?.step.isolationNumber).toBe('ISO-1');
  });
});

describe('messages and clashes (S5)', () => {
  it('names the record a message opens, and has none for unknown targets', () => {
    const n = (entityType: string | null, entityId: string | null = 'x') => ({ entityType, entityId }) as Notification;
    expect(notificationTarget(n('permit'))).toEqual({ href: '/permits/x', label: 'Open permit' });
    expect(notificationTarget(n('approval'))?.href).toBe('/permits/x?tab=review');
    expect(notificationTarget(n('simops_conflict'))?.href).toBe('/simops/conflicts/x');
    expect(notificationTarget(n('lototo_plan'))?.href).toBe('/lototo/plans/x');
    expect(notificationTarget(n('notification'))).toBeNull();
    expect(notificationTarget(n('permit', null))).toBeNull();
  });

  it('works out the time clashing permits share', () => {
    const p = (start: string | null, end: string | null) => ({ permit: { plannedStartAt: start, plannedEndAt: end } }) as ConflictParticipant;
    expect(sharedWindow([p('2026-10-01T08:00', '2026-10-01T16:00'), p('2026-10-01T12:00', '2026-10-02T10:00')])).toEqual({
      start: '2026-10-01T12:00',
      end: '2026-10-01T16:00',
    });
    expect(sharedWindow([p('2026-10-01T08:00', '2026-10-01T10:00'), p('2026-10-01T12:00', '2026-10-01T14:00')])).toBeNull();
    expect(sharedWindow([p(null, null), p('2026-10-01T12:00', '2026-10-01T14:00')])).toBeNull();
  });
});
