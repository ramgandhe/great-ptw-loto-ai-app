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

export function isLototoRestorationComplete(
  points: Array<{ restoreStatus: LototoPointExecutionStatus }>,
): boolean {
  return isLototoIsolationComplete(points.map((point) => ({ status: point.restoreStatus })));
}
