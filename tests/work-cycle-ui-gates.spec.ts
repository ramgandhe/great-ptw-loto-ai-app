import {
  canCompleteWork,
  canPauseWork,
  canRecordProgress,
  canResumeWork,
  resolveWorkUiState,
} from '../app/src/modules/execution/work-state';

describe('work-cycle UI gates (J3)', () => {
  it('never allows Pause and Resume together', () => {
    for (const ui of ['not_started', 'in_progress', 'paused', 'completed', 'suspended'] as const) {
      expect(canPauseWork(ui) && canResumeWork(ui)).toBe(false);
    }
  });

  it('blocks Complete and Progress while paused', () => {
    expect(canCompleteWork('paused')).toBe(false);
    expect(canRecordProgress('paused')).toBe(false);
    expect(canResumeWork('paused')).toBe(true);
  });

  it('allows Pause and Complete only while in_progress', () => {
    expect(canPauseWork('in_progress')).toBe(true);
    expect(canCompleteWork('in_progress')).toBe(true);
    expect(canResumeWork('in_progress')).toBe(false);
  });

  it('single-day and multi-day share the same derived states', () => {
    expect(
      resolveWorkUiState({
        permitStatus: 'active',
        hasExecution: true,
        workState: 'paused',
        suspendedAt: null,
      }),
    ).toBe('paused');
  });
});
