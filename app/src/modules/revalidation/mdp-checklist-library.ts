/**
 * Slice J2: default MDP checklist library (secure light/full + reopen site checks).
 * Seeded into safety_checklists so tenants can view/edit via organisation checklists.
 */

import {
  DAY_SECURE_FULL_KEYS,
  DAY_SECURE_LIGHT_KEYS,
  type DaySecureChecklistKey,
} from '../daily-progress/day-secure-checklist';

const SECURE_LABELS: Record<DaySecureChecklistKey, string> = {
  personnelCleared: 'All personnel clear / accounted for',
  workAreaLeftSafe: 'Work area left in a safe condition',
  materialsToolsSecured: 'Materials and tools secured / removed from hazards',
  isolationsIntact: 'Energy isolations remain intact overnight',
  openingsBarricaded: 'Openings covered or barricaded',
  emergencyAccessClear: 'Emergency access routes remain clear',
  overnightHazardsNoted: 'Overnight hazards communicated / noted',
};

export const MDP_CHECKLIST_SEED_CODES = {
  daySecureLight: 'mdp-day-secure-light',
  daySecureFull: 'mdp-day-secure-full',
  reopenSite: 'mdp-reopen-site',
} as const;

export type MdpChecklistSeed = {
  code: string;
  name: string;
  description: string;
  items: Array<{ description: string; isMandatory: boolean; key?: string }>;
};

export const MDP_CHECKLIST_SEEDS: readonly MdpChecklistSeed[] = [
  {
    code: MDP_CHECKLIST_SEED_CODES.daySecureLight,
    name: 'MDP end-of-day secure (light)',
    description: 'Default light secure when daily audit is OFF. Personnel clear is always required.',
    items: DAY_SECURE_LIGHT_KEYS.map((key) => ({
      key,
      description: SECURE_LABELS[key],
      isMandatory: true,
    })),
  },
  {
    code: MDP_CHECKLIST_SEED_CODES.daySecureFull,
    name: 'MDP end-of-day secure (full)',
    description: 'Default full secure when daily audit is ON.',
    items: DAY_SECURE_FULL_KEYS.map((key) => ({
      key,
      description: SECURE_LABELS[key],
      isMandatory: true,
    })),
  },
  {
    code: MDP_CHECKLIST_SEED_CODES.reopenSite,
    name: 'MDP morning reopen — site security',
    description: 'Default site security checks composed into reopen when daily audit is ON.',
    items: [
      { key: 'areaClear', description: 'Work area clear of unauthorised personnel', isMandatory: true },
      { key: 'barricadesIntact', description: 'Barricades / signs intact', isMandatory: true },
      { key: 'housekeepingOk', description: 'Housekeeping acceptable to resume', isMandatory: true },
      { key: 'overnightChangesReviewed', description: 'Overnight changes reviewed', isMandatory: true },
    ],
  },
];
