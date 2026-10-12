export type LototoPointExecutionStatus =
  | 'na'
  | 'pending_crew'
  | 'pending_verify'
  | 'failed'
  | 'passed';

export function lototoPointExecutionStatus(input: {
  na: boolean;
  crewAt: Date | string | null;
  verifyAt: Date | string | null;
  verifyResult: 'pass' | 'fail' | null;
}): LototoPointExecutionStatus {
  if (input.na) {
    return 'na';
  }
  if (!input.crewAt) {
    return 'pending_crew';
  }
  if (!input.verifyAt || new Date(input.verifyAt) < new Date(input.crewAt)) {
    return 'pending_verify';
  }
  if (input.verifyResult === 'fail') {
    return 'failed';
  }
  if (input.verifyResult === 'pass') {
    return 'passed';
  }
  return 'pending_verify';
}

export function isLototoIsolationComplete(
  points: Array<{ status: LototoPointExecutionStatus }>,
): boolean {
  if (points.length === 0) {
    return false;
  }
  return points.every((point) => point.status === 'na' || point.status === 'passed');
}

export function isLototoCrewApplyComplete(
  points: Array<{ status: LototoPointExecutionStatus }>,
): boolean {
  if (points.length === 0) {
    return false;
  }
  return points.every(
    (point) => point.status === 'na' || point.status === 'pending_verify' || point.status === 'passed',
  );
}

export function isLototoRestorationComplete(
  points: Array<{ restoreStatus: LototoPointExecutionStatus }>,
): boolean {
  return isLototoIsolationComplete(points.map((point) => ({ status: point.restoreStatus })));
}

export function nextSequenceStepId(
  steps: Array<{ id: string; sequenceOrder: number }>,
  tickedStepIds: string[],
): string | null {
  const ticked = new Set(tickedStepIds);
  const ordered = steps.slice().sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  return ordered.find((step) => !ticked.has(step.id))?.id ?? null;
}

export function canConfirmSequencePhase(
  steps: Array<{ id: string }>,
  tickedStepIds: string[],
): boolean {
  if (steps.length === 0) {
    return true;
  }
  const ticked = new Set(tickedStepIds);
  return steps.every((step) => ticked.has(step.id));
}

export function isLototoSequencePhasePassed(
  run: { result: string | null } | null,
): boolean {
  return run?.result === 'pass';
}
