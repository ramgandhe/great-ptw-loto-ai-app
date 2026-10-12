import {
  canConfirmSequencePhase,
  isLototoCrewApplyComplete,
  isLototoIsolationComplete,
  isLototoRestorationComplete,
  isLototoSequencePhasePassed,
  lototoPointExecutionStatus,
  nextSequenceStepId,
} from '../app/src/modules/permit/permit-lototo-execution-status';

describe('LOTOTO isolation point status', () => {
  it('skips N/A points', () => {
    expect(lototoPointExecutionStatus({ na: true, crewAt: null, verifyAt: null, verifyResult: null })).toBe('na');
  });

  it('waits for crew, then verification, and returns failed points to crew', () => {
    expect(lototoPointExecutionStatus({ na: false, crewAt: null, verifyAt: null, verifyResult: null })).toBe(
      'pending_crew',
    );
    expect(
      lototoPointExecutionStatus({
        na: false,
        crewAt: '2026-09-30T08:00:00Z',
        verifyAt: null,
        verifyResult: null,
      }),
    ).toBe('pending_verify');
    expect(
      lototoPointExecutionStatus({
        na: false,
        crewAt: '2026-09-30T08:00:00Z',
        verifyAt: '2026-09-30T09:00:00Z',
        verifyResult: 'fail',
      }),
    ).toBe('failed');
    expect(
      lototoPointExecutionStatus({
        na: false,
        crewAt: '2026-09-30T10:00:00Z',
        verifyAt: '2026-09-30T09:00:00Z',
        verifyResult: 'fail',
      }),
    ).toBe('pending_verify');
    expect(
      lototoPointExecutionStatus({
        na: false,
        crewAt: '2026-09-30T08:00:00Z',
        verifyAt: '2026-09-30T09:00:00Z',
        verifyResult: 'pass',
      }),
    ).toBe('passed');
  });

  it('is isolated only when every point is passed or N/A', () => {
    expect(isLototoIsolationComplete([])).toBe(false);
    expect(isLototoIsolationComplete([{ status: 'na' }, { status: 'passed' }])).toBe(true);
    expect(isLototoIsolationComplete([{ status: 'na' }, { status: 'failed' }])).toBe(false);
  });

  it('crew apply is complete when every point is ticked or N/A', () => {
    expect(isLototoCrewApplyComplete([])).toBe(false);
    expect(isLototoCrewApplyComplete([{ status: 'na' }, { status: 'pending_verify' }])).toBe(true);
    expect(isLototoCrewApplyComplete([{ status: 'na' }, { status: 'pending_crew' }])).toBe(false);
  });

  it('is restored only when every point is passed or N/A', () => {
    expect(isLototoRestorationComplete([])).toBe(false);
    expect(isLototoRestorationComplete([{ restoreStatus: 'na' }, { restoreStatus: 'passed' }])).toBe(true);
    expect(isLototoRestorationComplete([{ restoreStatus: 'na' }, { restoreStatus: 'pending_crew' }])).toBe(false);
  });

  it('ticks sequence steps in order and confirms only when every step is ticked', () => {
    const steps = [
      { id: 'a', sequenceOrder: 1 },
      { id: 'b', sequenceOrder: 2 },
    ];
    expect(nextSequenceStepId(steps, [])).toBe('a');
    expect(nextSequenceStepId(steps, ['a'])).toBe('b');
    expect(nextSequenceStepId(steps, ['a', 'b'])).toBeNull();
    expect(canConfirmSequencePhase(steps, ['a'])).toBe(false);
    expect(canConfirmSequencePhase(steps, ['a', 'b'])).toBe(true);
  });

  it('treats isolation as ready only after a passed sequence confirm', () => {
    expect(isLototoSequencePhasePassed(null)).toBe(false);
    expect(isLototoSequencePhasePassed({ result: 'fail' })).toBe(false);
    expect(isLototoSequencePhasePassed({ result: 'pass' })).toBe(true);
  });
});
