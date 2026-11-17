import {
  assertWorkStateTransition,
  canCompleteWork,
  canPauseWork,
  canRecordProgress,
  canResumeWork,
  resolveWorkUiState,
} from '../app/src/modules/execution/work-state';

describe('work-state', () => {
  describe('resolveWorkUiState', () => {
    it('returns not_started when approved without execution', () => {
      expect(
        resolveWorkUiState({
          permitStatus: 'approved',
          hasExecution: false,
          workState: null,
          suspendedAt: null,
        }),
      ).toBe('not_started');
    });

    it('returns in_progress for active execution', () => {
      expect(
        resolveWorkUiState({
          permitStatus: 'active',
          hasExecution: true,
          workState: 'in_progress',
          suspendedAt: null,
        }),
      ).toBe('in_progress');
    });

    it('returns paused when workState is paused', () => {
      expect(
        resolveWorkUiState({
          permitStatus: 'active',
          hasExecution: true,
          workState: 'paused',
          suspendedAt: null,
        }),
      ).toBe('paused');
    });

    it('returns suspended ahead of pause', () => {
      expect(
        resolveWorkUiState({
          permitStatus: 'suspended',
          hasExecution: true,
          workState: 'paused',
          suspendedAt: new Date(),
        }),
      ).toBe('suspended');
    });

    it('returns completed for execution_completed', () => {
      expect(
        resolveWorkUiState({
          permitStatus: 'execution_completed',
          hasExecution: true,
          workState: 'in_progress',
          suspendedAt: null,
        }),
      ).toBe('completed');
    });
  });

  describe('gates', () => {
    it('allows progress/pause/complete only in in_progress', () => {
      expect(canRecordProgress('in_progress')).toBe(true);
      expect(canPauseWork('in_progress')).toBe(true);
      expect(canCompleteWork('in_progress')).toBe(true);
      expect(canResumeWork('in_progress')).toBe(false);

      expect(canRecordProgress('paused')).toBe(false);
      expect(canPauseWork('paused')).toBe(false);
      expect(canCompleteWork('paused')).toBe(false);
      expect(canResumeWork('paused')).toBe(true);
    });
  });

  describe('assertWorkStateTransition', () => {
    it('allows in_progress ⇄ paused only', () => {
      expect(assertWorkStateTransition('in_progress', 'paused')).toEqual({ ok: true });
      expect(assertWorkStateTransition('paused', 'in_progress')).toEqual({ ok: true });
      expect(assertWorkStateTransition('in_progress', 'in_progress').ok).toBe(false);
      expect(assertWorkStateTransition('paused', 'paused').ok).toBe(false);
    });
  });
});
