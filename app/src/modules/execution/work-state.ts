/**
 * Locked Work loop visibility / transition rules.
 * States: in_progress ⇄ paused; Complete only from in_progress.
 * Suspension is separate (permit.status + suspendedAt).
 */

import type { WorkState } from '../../database/schema/execution';

export type WorkUiState = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'suspended';

export function resolveWorkUiState(input: {
  permitStatus: string;
  hasExecution: boolean;
  workState: string | null | undefined;
  suspendedAt: Date | string | null | undefined;
}): WorkUiState {
  if (input.permitStatus === 'execution_completed' || input.permitStatus === 'pending_closure' || input.permitStatus === 'closed') {
    return 'completed';
  }
  if (input.permitStatus === 'suspended' || input.suspendedAt) {
    return 'suspended';
  }
  if (!input.hasExecution || input.permitStatus === 'approved') {
    return 'not_started';
  }
  if (input.workState === 'paused') {
    return 'paused';
  }
  return 'in_progress';
}

export function canRecordProgress(ui: WorkUiState): boolean {
  return ui === 'in_progress';
}

export function canPauseWork(ui: WorkUiState): boolean {
  return ui === 'in_progress';
}

export function canResumeWork(ui: WorkUiState): boolean {
  return ui === 'paused';
}

export function canCompleteWork(ui: WorkUiState): boolean {
  return ui === 'in_progress';
}

export function assertWorkStateTransition(
  from: WorkState,
  to: WorkState,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) {
    return { ok: false, reason: `Work is already ${from}` };
  }
  if (from === 'in_progress' && to === 'paused') {
    return { ok: true };
  }
  if (from === 'paused' && to === 'in_progress') {
    return { ok: true };
  }
  return { ok: false, reason: `Cannot move work from ${from} to ${to}` };
}
