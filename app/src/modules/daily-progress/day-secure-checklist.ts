/**
 * End-of-day secure checklist defaults (Slice B3).
 * Light = daily audit OFF; full = daily audit ON.
 * Personnel clear is always required (locked rule #6).
 */

export const DAY_SECURE_CHECKLIST_MODES = ['light', 'full'] as const;
export type DaySecureChecklistMode = (typeof DAY_SECURE_CHECKLIST_MODES)[number];

/** Shared items — always required for overnight secure. */
export const DAY_SECURE_LIGHT_KEYS = [
  'personnelCleared',
  'workAreaLeftSafe',
  'materialsToolsSecured',
] as const;

/** Extra items when daily revalidation / audit is ON. */
export const DAY_SECURE_FULL_EXTRA_KEYS = [
  'isolationsIntact',
  'openingsBarricaded',
  'emergencyAccessClear',
  'overnightHazardsNoted',
] as const;

export const DAY_SECURE_FULL_KEYS = [
  ...DAY_SECURE_LIGHT_KEYS,
  ...DAY_SECURE_FULL_EXTRA_KEYS,
] as const;

export type DaySecureChecklistKey =
  | (typeof DAY_SECURE_LIGHT_KEYS)[number]
  | (typeof DAY_SECURE_FULL_EXTRA_KEYS)[number];

export type DaySecureChecklistAnswers = Partial<Record<DaySecureChecklistKey, boolean>>;

export type DaySecureChecklistTemplate = {
  mode: DaySecureChecklistMode;
  requiredKeys: readonly DaySecureChecklistKey[];
  items: Array<{ key: DaySecureChecklistKey; label: string; required: boolean }>;
};

const LABELS: Record<DaySecureChecklistKey, string> = {
  personnelCleared: 'All personnel clear / accounted for',
  workAreaLeftSafe: 'Work area left in a safe condition',
  materialsToolsSecured: 'Materials and tools secured / removed from hazards',
  isolationsIntact: 'Energy isolations remain intact overnight',
  openingsBarricaded: 'Openings covered or barricaded',
  emergencyAccessClear: 'Emergency access routes remain clear',
  overnightHazardsNoted: 'Overnight hazards communicated / noted',
};

export function resolveDaySecureChecklistMode(
  dailyRevalidationRequired: boolean,
): DaySecureChecklistMode {
  return dailyRevalidationRequired ? 'full' : 'light';
}

export function requiredDaySecureChecklistKeys(
  mode: DaySecureChecklistMode,
): readonly DaySecureChecklistKey[] {
  return mode === 'full' ? DAY_SECURE_FULL_KEYS : DAY_SECURE_LIGHT_KEYS;
}

/** Template for UI: required keys + unchecked defaults. */
export function buildDaySecureChecklistTemplate(
  dailyRevalidationRequired: boolean,
): DaySecureChecklistTemplate {
  const mode = resolveDaySecureChecklistMode(dailyRevalidationRequired);
  const requiredKeys = requiredDaySecureChecklistKeys(mode);
  const requiredSet = new Set<string>(requiredKeys);

  const allKeys: DaySecureChecklistKey[] =
    mode === 'full' ? [...DAY_SECURE_FULL_KEYS] : [...DAY_SECURE_LIGHT_KEYS];

  return {
    mode,
    requiredKeys,
    items: allKeys.map((key) => ({
      key,
      label: LABELS[key],
      required: requiredSet.has(key),
    })),
  };
}

/** Defaults object stored / sent to clients (all required keys false). */
export function buildDaySecureChecklistDefaults(
  dailyRevalidationRequired: boolean,
): Record<string, unknown> {
  const template = buildDaySecureChecklistTemplate(dailyRevalidationRequired);
  const answers: Record<string, unknown> = { mode: template.mode };
  for (const key of template.requiredKeys) {
    answers[key] = false;
  }
  return answers;
}

/**
 * Returns missing required keys (not present or not true).
 * `personnelCleared` may be supplied via the dedicated column/DTO field.
 */
export function missingDaySecureChecklistKeys(
  dailyRevalidationRequired: boolean,
  checklist: DaySecureChecklistAnswers | Record<string, unknown> | null | undefined,
  personnelCleared?: boolean,
): DaySecureChecklistKey[] {
  const required = requiredDaySecureChecklistKeys(
    resolveDaySecureChecklistMode(dailyRevalidationRequired),
  );
  const source = checklist ?? {};
  const missing: DaySecureChecklistKey[] = [];

  for (const key of required) {
    const value =
      key === 'personnelCleared' && personnelCleared !== undefined
        ? personnelCleared
        : source[key];
    if (value !== true) {
      missing.push(key);
    }
  }

  return missing;
}

export function assertDaySecureChecklistComplete(
  dailyRevalidationRequired: boolean,
  checklist: DaySecureChecklistAnswers | Record<string, unknown> | null | undefined,
  personnelCleared?: boolean,
): void {
  const missing = missingDaySecureChecklistKeys(
    dailyRevalidationRequired,
    checklist,
    personnelCleared,
  );
  if (missing.length > 0) {
    throw new Error(`Incomplete day-secure checklist: ${missing.join(', ')}`);
  }
}
