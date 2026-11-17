/**
 * Resume work checklist (locked): fuller when daily audit ON; minimal when OFF.
 * Audit-ON site-security keys align with reopen composition SITE_SECURITY_CHECK_KEYS.
 */

export const WORK_RESUME_AUDIT_ON_KEYS = [
  'workAreaInspected',
  'barriersSignageIntact',
  'emergencyRoutesClear',
  'personnelAccounted',
  'overnightChangesReviewed',
  'safeToContinue',
] as const;

export const WORK_RESUME_AUDIT_OFF_KEYS = ['safeToContinue'] as const;

export type WorkResumeChecklistKey =
  | (typeof WORK_RESUME_AUDIT_ON_KEYS)[number]
  | (typeof WORK_RESUME_AUDIT_OFF_KEYS)[number];

const LABELS: Record<string, string> = {
  workAreaInspected: 'Work area inspected / safe to resume',
  barriersSignageIntact: 'Barriers and signage intact',
  emergencyRoutesClear: 'Emergency routes clear',
  personnelAccounted: 'Crew / persons covered accounted for',
  overnightChangesReviewed: 'Overnight changes / hazards reviewed',
  safeToContinue: 'Safe to continue work',
  toolboxTalkConfirmed: 'Toolbox talk completed for this resume',
  lototoIntegrityConfirmed: 'Confirm energy isolations / equipment still locked',
  lototoReisolated: 'LOTOTO re-isolation completed before resume (full procedure)',
  ppeHazardReconfirmed: 'PPE and hazard controls reconfirmed for this period',
  gasConfirmedToday: 'Today’s gas testing is current',
};

export function buildWorkResumeChecklistTemplate(input: {
  dailyRevalidationRequired: boolean;
  lototoRequired: boolean;
  reisolateRequired: boolean;
  ppeHazardReconfirmRequired?: boolean;
  gasTestingRequired?: boolean;
  simopsBlocked?: boolean;
  simopsBlockReason?: string;
}) {
  const keys = input.dailyRevalidationRequired
    ? [...WORK_RESUME_AUDIT_ON_KEYS]
    : [...WORK_RESUME_AUDIT_OFF_KEYS];

  const items: Array<{ key: string; label: string; required: boolean }> = keys.map((key) => ({
    key,
    label: LABELS[key],
    required: true,
  }));

  items.push({
    key: 'toolboxTalkConfirmed',
    label: LABELS.toolboxTalkConfirmed,
    required: true,
  });

  if (input.dailyRevalidationRequired && input.ppeHazardReconfirmRequired) {
    items.push({
      key: 'ppeHazardReconfirmed',
      label: LABELS.ppeHazardReconfirmed,
      required: true,
    });
  }

  if (input.dailyRevalidationRequired && input.gasTestingRequired) {
    items.push({
      key: 'gasConfirmedToday',
      label: LABELS.gasConfirmedToday,
      required: true,
    });
  }

  if (input.lototoRequired && !input.reisolateRequired) {
    items.push({
      key: 'lototoIntegrityConfirmed',
      label: LABELS.lototoIntegrityConfirmed,
      required: true,
    });
  }

  if (input.reisolateRequired) {
    items.push({
      key: 'lototoReisolated',
      label: LABELS.lototoReisolated,
      required: true,
    });
  }

  return {
    purpose: 'resume' as const,
    title: 'Resume work',
    mode: input.dailyRevalidationRequired ? ('full' as const) : ('minimal' as const),
    reisolateRequired: input.reisolateRequired,
    simopsBlocked: input.simopsBlocked === true,
    simopsBlockReason: input.simopsBlockReason ?? null,
    items,
  };
}

export function missingWorkResumeChecklistKeys(
  template: ReturnType<typeof buildWorkResumeChecklistTemplate>,
  checklist: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  if (template.simopsBlocked) {
    missing.push(template.simopsBlockReason || 'Resolve blocking SIMOPS before resume');
  }
  for (const item of template.items) {
    if (item.required && checklist[item.key] !== true) {
      missing.push(item.label);
    }
  }
  return missing;
}
