/**
 * Risk-based reopen composition (Slice G + Wave 2 morning briefing).
 * When daily audit ON: site security; gas / LOTOTO / SIMOPS when applicable;
 * optional TBT / crew / PPE-hazard modules from tenant morning-briefing policy.
 * Pass → clear is blocked until required sections are current.
 */

import {
  evaluateDailyCrewGate,
  evaluatePpeHazardReconfirm,
  evaluateToolboxTalkGate,
} from '../daily-progress/morning-briefing';

export const SITE_SECURITY_CHECK_KEYS = [
  'workAreaInspected',
  'barriersSignageIntact',
  'emergencyRoutesClear',
  'personnelAccounted',
] as const;

export type SiteSecurityCheckKey = (typeof SITE_SECURITY_CHECK_KEYS)[number];

export const SITE_SECURITY_LABELS: Record<SiteSecurityCheckKey, string> = {
  workAreaInspected: 'Work area inspected / safe to resume',
  barriersSignageIntact: 'Barriers and signage intact',
  emergencyRoutesClear: 'Emergency routes clear',
  personnelAccounted: 'Crew / persons covered accounted for',
};

export type ReopenCompositionModuleKey =
  | 'site_security'
  | 'toolbox'
  | 'crew'
  | 'ppe_hazard'
  | 'gas'
  | 'lototo'
  | 'simops';

export type ReopenCompositionModule = {
  key: ReopenCompositionModuleKey;
  required: boolean;
  label: string;
  reason: string;
  href: string;
  satisfied: boolean;
  blockers: string[];
};

export type GasItemForReopen = {
  gasTestingCatalogueId: string;
  parameter: string;
  minimum: number;
  maximum: number;
  unit: string;
};

export type GasReadingInput = {
  gasTestingCatalogueId: string;
  value: number;
};

/** Which modules apply for this permit (independent of checklist answers). */
export function decideReopenModules(input: {
  permitId: string;
  dailyRevalidationRequired: boolean;
  gasTestingRequired: boolean;
  openIsolationsRemain: boolean;
  unresolvedSimopsCount: number;
  toolboxTalkRequired?: boolean;
  crewRosterRequired?: boolean;
  ppeHazardReconfirmRequired?: boolean;
}): Array<Omit<ReopenCompositionModule, 'satisfied' | 'blockers'>> {
  const modules: Array<Omit<ReopenCompositionModule, 'satisfied' | 'blockers'>> = [];

  if (input.dailyRevalidationRequired) {
    modules.push({
      key: 'site_security',
      required: true,
      label: 'Site security',
      reason: 'Daily audit requires site security checks every morning',
      href: `/permits/${input.permitId}?tab=work`,
    });
  }

  if (input.toolboxTalkRequired) {
    modules.push({
      key: 'toolbox',
      required: true,
      label: 'Toolbox talk',
      reason: 'Per-day toolbox talk must be recorded before clearing work',
      href: `/permits/${input.permitId}?tab=work`,
    });
  }

  if (input.crewRosterRequired) {
    modules.push({
      key: 'crew',
      required: true,
      label: 'Daily crew',
      reason: 'Today’s authorised crew roster must be recorded before clearing work',
      href: `/permits/${input.permitId}?tab=work`,
    });
  }

  if (input.ppeHazardReconfirmRequired) {
    modules.push({
      key: 'ppe_hazard',
      required: true,
      label: 'PPE / hazards',
      reason: 'Reconfirm PPE and hazard controls for today’s work',
      href: `/permits/${input.permitId}?tab=work`,
    });
  }

  if (input.gasTestingRequired) {
    modules.push({
      key: 'gas',
      required: true,
      label: 'Gas testing',
      reason: 'Permit requires gas testing; today’s readings must be current',
      href: `/execution/${input.permitId}`,
    });
  }

  if (input.openIsolationsRemain) {
    modules.push({
      key: 'lototo',
      required: true,
      label: 'LOTOTO integrity',
      reason:
        'Live open isolations remain overnight; confirm integrity after a field check before clearing work',
      href: `/lototo/active`,
    });
  }

  if (input.unresolvedSimopsCount > 0) {
    modules.push({
      key: 'simops',
      required: true,
      label: 'SIMOPS',
      reason: `${input.unresolvedSimopsCount} unresolved blocking SIMOPS case(s) for this permit`,
      href: `/simops?permitId=${input.permitId}`,
    });
  }

  return modules;
}

export function siteSecurityMissing(checklist: Record<string, unknown> | null | undefined): string[] {
  const missing: string[] = [];
  for (const key of SITE_SECURITY_CHECK_KEYS) {
    if (checklist?.[key] !== true) {
      missing.push(SITE_SECURITY_LABELS[key]);
    }
  }
  return missing;
}

export function evaluateGasReadings(input: {
  items: GasItemForReopen[];
  readings: GasReadingInput[];
}): string[] {
  const blockers: string[] = [];
  const byId = new Map(input.readings.map((row) => [row.gasTestingCatalogueId, row.value]));
  for (const item of input.items) {
    const value = byId.get(item.gasTestingCatalogueId);
    if (typeof value !== 'number' || Number.isNaN(value)) {
      blockers.push(`Missing ${item.parameter} reading`);
      continue;
    }
    if (value < item.minimum || value > item.maximum) {
      blockers.push(
        `${item.parameter} ${value} ${item.unit} outside ${item.minimum}–${item.maximum} ${item.unit}`,
      );
    }
  }
  return blockers;
}

export function parseGasReadingsFromChecklist(
  checklist: Record<string, unknown> | null | undefined,
): GasReadingInput[] {
  const raw = checklist?.gasReadings;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: GasReadingInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { gasTestingCatalogueId?: unknown }).gasTestingCatalogueId;
    const value = (row as { value?: unknown }).value;
    if (typeof id === 'string' && typeof value === 'number' && !Number.isNaN(value)) {
      out.push({ gasTestingCatalogueId: id, value });
    }
  }
  return out;
}

/**
 * Evaluate composition for a passed reopen.
 * When daily audit is OFF, site security is not required here (module rules still apply elsewhere).
 * SIMOPS unresolved cases always block clear when present.
 */
export function evaluateReopenComposition(input: {
  dailyRevalidationRequired: boolean;
  gasTestingRequired: boolean;
  openIsolationsRemain: boolean;
  unresolvedSimopsCount: number;
  gasItems: GasItemForReopen[];
  checklist: Record<string, unknown> | null | undefined;
  /** Live count of open isolation certificates / crew locks (optional messaging). */
  openIsolationCount?: number;
  toolboxTalkRequired?: boolean;
  crewRosterRequired?: boolean;
  ppeHazardReconfirmRequired?: boolean;
  talkRecorded?: boolean;
  crewCount?: number;
  attendeeUserIds?: string[];
  rosterUserIds?: string[];
  requiredHazardKeys?: string[];
  requiredPpeIds?: string[];
}): {
  ok: boolean;
  modules: ReopenCompositionModule[];
  missing: string[];
} {
  const decided = decideReopenModules({
    permitId: 'preview',
    dailyRevalidationRequired: input.dailyRevalidationRequired,
    gasTestingRequired: input.gasTestingRequired,
    openIsolationsRemain: input.openIsolationsRemain,
    unresolvedSimopsCount: input.unresolvedSimopsCount,
    toolboxTalkRequired: input.toolboxTalkRequired,
    crewRosterRequired: input.crewRosterRequired,
    ppeHazardReconfirmRequired: input.ppeHazardReconfirmRequired,
  });

  const modules: ReopenCompositionModule[] = decided.map((mod) => {
    if (mod.key === 'site_security') {
      const blockers = siteSecurityMissing(input.checklist);
      return { ...mod, satisfied: blockers.length === 0, blockers };
    }
    if (mod.key === 'toolbox') {
      const blockers = evaluateToolboxTalkGate({
        required: true,
        talkRecorded: input.talkRecorded === true,
      });
      return { ...mod, satisfied: blockers.length === 0, blockers };
    }
    if (mod.key === 'crew') {
      const blockers = evaluateDailyCrewGate({
        required: true,
        crewCount: input.crewCount ?? 0,
        attendeeUserIds: input.attendeeUserIds,
        rosterUserIds: input.rosterUserIds,
      });
      return { ...mod, satisfied: blockers.length === 0, blockers };
    }
    if (mod.key === 'ppe_hazard') {
      const blockers = evaluatePpeHazardReconfirm({
        required: true,
        checklist: input.checklist,
        requiredHazardKeys: input.requiredHazardKeys ?? [],
        requiredPpeIds: input.requiredPpeIds ?? [],
      });
      return { ...mod, satisfied: blockers.length === 0, blockers };
    }
    if (mod.key === 'gas') {
      const blockers: string[] = [];
      // Live catalogue drives gas: tick-alone is not enough when items are missing or unread.
      if (input.gasItems.length === 0) {
        blockers.push(
          'Permit gas testing catalogue has no live items — configure gas limits before clear',
        );
      } else {
        blockers.push(
          ...evaluateGasReadings({
            items: input.gasItems,
            readings: parseGasReadingsFromChecklist(input.checklist),
          }),
        );
      }
      if (input.checklist?.gasConfirmedToday !== true) {
        blockers.push('Confirm today’s gas testing is current');
      }
      return { ...mod, satisfied: blockers.length === 0, blockers };
    }
    if (mod.key === 'lototo') {
      const blockers: string[] = [];
      // Live open isolations gate the module; attestation alone cannot invent clearance.
      if (!input.openIsolationsRemain) {
        blockers.push('Live LOTOTO module requires open isolations; refresh composition');
      } else {
        const count =
          typeof input.openIsolationCount === 'number' && input.openIsolationCount > 0
            ? input.openIsolationCount
            : null;
        if (input.checklist?.lototoIntegrityConfirmed !== true) {
          blockers.push(
            count != null
              ? `Confirm LOTOTO isolation integrity (${count} open isolation(s) remain)`
              : 'Confirm LOTOTO isolation integrity (open isolations remain)',
          );
        }
      }
      return {
        ...mod,
        satisfied: blockers.length === 0,
        blockers,
      };
    }
    // simops: unresolved cases never satisfiable via checklist alone
    return {
      ...mod,
      satisfied: false,
      blockers: [
        'Resolve or clear blocking SIMOPS case(s) before MDP reopen can clear work',
      ],
    };
  });

  const missing = modules.flatMap((mod) => (mod.required && !mod.satisfied ? mod.blockers : []));
  return { ok: missing.length === 0, modules, missing };
}

export function buildSiteSecurityTemplate() {
  return SITE_SECURITY_CHECK_KEYS.map((key) => ({
    key,
    label: SITE_SECURITY_LABELS[key],
    required: true,
  }));
}
