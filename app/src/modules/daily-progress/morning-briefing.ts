/**
 * Wave 2: morning briefing gates (toolbox talk, daily crew, PPE/hazard reconfirm).
 */

export type MorningBriefingPolicy = {
  dailyToolboxTalkRequired: boolean;
  dailyCrewRosterRequired: boolean;
  dailyPpeHazardReconfirm: boolean;
};

export const DEFAULT_MORNING_BRIEFING_POLICY: MorningBriefingPolicy = {
  dailyToolboxTalkRequired: true,
  dailyCrewRosterRequired: true,
  dailyPpeHazardReconfirm: true,
};

export function resolveMorningBriefingPolicy(
  org: Partial<MorningBriefingPolicy> | null | undefined,
): MorningBriefingPolicy {
  return {
    dailyToolboxTalkRequired:
      org?.dailyToolboxTalkRequired ?? DEFAULT_MORNING_BRIEFING_POLICY.dailyToolboxTalkRequired,
    dailyCrewRosterRequired:
      org?.dailyCrewRosterRequired ?? DEFAULT_MORNING_BRIEFING_POLICY.dailyCrewRosterRequired,
    dailyPpeHazardReconfirm:
      org?.dailyPpeHazardReconfirm ?? DEFAULT_MORNING_BRIEFING_POLICY.dailyPpeHazardReconfirm,
  };
}

/** TBT is required for clear when org policy ON and permit daily audit ON. */
export function isToolboxTalkRequiredForClear(input: {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
  dailyToolboxTalkRequired: boolean;
}): boolean {
  return (
    input.isMultiDay && input.dailyRevalidationRequired && input.dailyToolboxTalkRequired
  );
}

export function isDailyCrewRequiredForClear(input: {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
  dailyCrewRosterRequired: boolean;
}): boolean {
  return (
    input.isMultiDay && input.dailyRevalidationRequired && input.dailyCrewRosterRequired
  );
}

export function isPpeHazardReconfirmRequired(input: {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
  dailyPpeHazardReconfirm: boolean;
}): boolean {
  return (
    input.isMultiDay && input.dailyRevalidationRequired && input.dailyPpeHazardReconfirm
  );
}

export function evaluateToolboxTalkGate(input: {
  required: boolean;
  talkRecorded: boolean;
}): string[] {
  if (!input.required) {
    return [];
  }
  if (!input.talkRecorded) {
    return ['Record today’s toolbox talk before clearing work'];
  }
  return [];
}

export function evaluateDailyCrewGate(input: {
  required: boolean;
  crewCount: number;
  /** When TBT has attendees, every attendee should be on today’s roster (D7). */
  attendeeUserIds?: string[];
  rosterUserIds?: string[];
}): string[] {
  if (!input.required) {
    return [];
  }
  if (input.crewCount < 1) {
    return ['Record today’s crew roster (at least one worker) before clearing work'];
  }
  const roster = new Set(input.rosterUserIds ?? []);
  const missing = (input.attendeeUserIds ?? []).filter((id) => !roster.has(id));
  if (missing.length > 0) {
    return [
      `${missing.length} toolbox talk attendee(s) are not on today’s crew roster`,
    ];
  }
  return [];
}

export function evaluatePpeHazardReconfirm(input: {
  required: boolean;
  checklist: Record<string, unknown> | null | undefined;
  requiredHazardKeys: string[];
  requiredPpeIds: string[];
}): string[] {
  if (!input.required) {
    return [];
  }
  const blockers: string[] = [];
  if (input.checklist?.ppeHazardReconfirmedToday !== true) {
    blockers.push('Confirm today’s PPE and hazard controls');
  }
  const hazards = new Set(
    Array.isArray(input.checklist?.confirmedHazardKeys)
      ? (input.checklist?.confirmedHazardKeys as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
  );
  const ppe = new Set(
    Array.isArray(input.checklist?.confirmedPpeIds)
      ? (input.checklist?.confirmedPpeIds as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
  );
  if (input.requiredHazardKeys.some((key) => !hazards.has(key))) {
    blockers.push('Reconfirm every required hazard control for today');
  }
  if (input.requiredPpeIds.some((id) => !ppe.has(id))) {
    blockers.push('Reconfirm every required PPE item for today');
  }
  return blockers;
}
