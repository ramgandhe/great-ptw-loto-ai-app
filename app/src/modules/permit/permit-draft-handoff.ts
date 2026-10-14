export const DRAFT_HOLDERS = ['receiver', 'operator', 'safety_officer', 'ready_for_review'] as const;
export type DraftHolder = (typeof DRAFT_HOLDERS)[number];

export function parseDraftHolder(value: string | null | undefined): DraftHolder {
  if (value && (DRAFT_HOLDERS as readonly string[]).includes(value)) {
    return value as DraftHolder;
  }
  return 'receiver';
}

export function nextHandoffTarget(
  holder: DraftHolder,
  hasSafetyOfficer: boolean,
): DraftHolder | null {
  if (holder === 'receiver') {
    return 'operator';
  }
  if (holder === 'operator') {
    return hasSafetyOfficer ? 'safety_officer' : 'ready_for_review';
  }
  if (holder === 'safety_officer') {
    return 'ready_for_review';
  }
  return null;
}

export function returnHandoffTarget(
  holder: DraftHolder,
  hasSafetyOfficer: boolean,
): DraftHolder | null {
  if (holder === 'operator') {
    return 'receiver';
  }
  if (holder === 'safety_officer') {
    return 'operator';
  }
  if (holder === 'ready_for_review') {
    return hasSafetyOfficer ? 'safety_officer' : 'operator';
  }
  return null;
}

export function holderStageLabel(holder: DraftHolder): string {
  switch (holder) {
    case 'receiver':
      return 'permit receiver';
    case 'operator':
      return 'permit operator';
    case 'safety_officer':
      return 'safety officer';
    case 'ready_for_review':
      return 'permit receiver (review)';
  }
}

export function holderNextWork(holder: DraftHolder): string {
  switch (holder) {
    case 'receiver':
      return 'Work, Place and schedule';
    case 'operator':
      return 'Site safety, Crew, Forms and evidence';
    case 'safety_officer':
      return 'Safety Approval';
    case 'ready_for_review':
      return 'Review and submit';
  }
}

export function stepsEditableForHolder(holder: DraftHolder): number[] {
  switch (holder) {
    case 'receiver':
      return [0, 1];
    case 'operator':
      return [2, 3, 4];
    case 'safety_officer':
      return [5];
    case 'ready_for_review':
      return [6];
  }
}
